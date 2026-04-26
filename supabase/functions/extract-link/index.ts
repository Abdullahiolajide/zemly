import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { promptGemini } from '../_shared/gemini.ts';
import { sanitizeNoteForPrompt } from '../_shared/sanitize.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const SUPADATA_API_KEY = Deno.env.get('SUPADATA_API_KEY');
const SUPADATA_BASE_URL = 'https://api.supadata.ai/v1';
const LINK_SOURCE_CLIP_CHARS = 600000;
const LINK_PASS_MAX_OUTPUT_TOKENS = 6144;
const MAX_LINK_PASSES = 4;

interface ExtractLinkRequest {
    url?: string;
}

interface YouTubeMeta {
    title?: string;
    author?: string;
    description?: string;
    transcript?: string;
}

function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isSupportedHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function toReaderUrl(sourceUrl: string): string {
    const withoutProtocol = sourceUrl.replace(/^https?:\/\//i, '');
    return `https://r.jina.ai/http://${withoutProtocol}`;
}

function isYouTubeHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    return host === 'youtube.com'
        || host === 'www.youtube.com'
        || host === 'm.youtube.com'
        || host === 'youtu.be';
}

async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
    try {
        const body = await res.json();
        const details = typeof body?.details === 'string' ? body.details : '';
        const message = typeof body?.message === 'string' ? body.message : '';
        return details || message || fallback;
    } catch {
        return fallback;
    }
}

function transcriptContentToText(content: unknown): string {
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        return content
            .map((chunk) => (chunk && typeof chunk === 'object' && 'text' in chunk ? String(chunk.text) : ''))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    return '';
}

async function fetchSupadataTranscript(url: string): Promise<string> {
    const query = new URLSearchParams({
        url,
        text: 'true',
        mode: 'auto',
    });

    const firstRes = await fetch(`${SUPADATA_BASE_URL}/transcript?${query.toString()}`, {
        headers: {
            'x-api-key': SUPADATA_API_KEY,
            Accept: 'application/json',
        },
    });

    if (firstRes.status === 200) {
        const body = await firstRes.json();
        return transcriptContentToText(body?.content);
    }

    if (firstRes.status === 202) {
        const job = await firstRes.json();
        const jobId = typeof job?.jobId === 'string' ? job.jobId : '';
        if (!jobId) {
            throw new Error('Supadata transcript job did not return a valid jobId.');
        }

        for (let attempt = 0; attempt < 45; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const jobRes = await fetch(`${SUPADATA_BASE_URL}/transcript/${encodeURIComponent(jobId)}`, {
                headers: {
                    'x-api-key': SUPADATA_API_KEY,
                    Accept: 'application/json',
                },
            });

            if (!jobRes.ok) {
                const msg = await parseErrorResponse(jobRes, `Supadata transcript job failed (${jobRes.status}).`);
                throw new Error(msg);
            }

            const jobBody = await jobRes.json();
            const status = typeof jobBody?.status === 'string' ? jobBody.status : '';

            if (status === 'completed') {
                return transcriptContentToText(jobBody?.content);
            }

            if (status === 'failed') {
                const err = typeof jobBody?.error === 'string'
                    ? jobBody.error
                    : typeof jobBody?.error?.message === 'string'
                        ? jobBody.error.message
                        : 'Supadata transcript job failed.';
                throw new Error(err);
            }
        }

        throw new Error('Timed out waiting for Supadata transcript job result.');
    }

    const err = await parseErrorResponse(firstRes, `Supadata transcript request failed (${firstRes.status}).`);
    throw new Error(err);
}

async function fetchSupadataMetadata(url: string): Promise<YouTubeMeta> {
    if (!SUPADATA_API_KEY) {
        return {};
    }

    const query = new URLSearchParams({ url });
    const res = await fetch(`${SUPADATA_BASE_URL}/metadata?${query.toString()}`, {
        headers: {
            'x-api-key': SUPADATA_API_KEY,
            Accept: 'application/json',
        },
    });

    if (!res.ok) return {};

    const body = await res.json();
    const authorDisplayName = typeof body?.author?.displayName === 'string' ? body.author.displayName : '';
    const authorUsername = typeof body?.author?.username === 'string' ? body.author.username : '';

    return {
        title: typeof body?.title === 'string' ? body.title : undefined,
        description: typeof body?.description === 'string' ? body.description : undefined,
        author: authorDisplayName || authorUsername || undefined,
    };
}

async function fetchYouTubeMeta(sourceUrl: string): Promise<YouTubeMeta> {
    const [transcriptRes, metadataRes] = await Promise.allSettled([
        fetchSupadataTranscript(sourceUrl),
        fetchSupadataMetadata(sourceUrl),
    ]);

    const meta: YouTubeMeta = metadataRes.status === 'fulfilled' ? metadataRes.value : {};

    if (transcriptRes.status === 'fulfilled' && transcriptRes.value.length > 0) {
        meta.transcript = transcriptRes.value;
    }

    if (!meta.transcript && !(meta.description && meta.description.length > 40)) {
        const reason = transcriptRes.status === 'rejected'
            ? (transcriptRes.reason instanceof Error ? transcriptRes.reason.message : 'Transcript unavailable')
            : 'Transcript unavailable';

        throw new Error(`Supadata could not get a usable transcript/description: ${reason}`);
    }

    return meta;
}

function buildYouTubeText(sourceUrl: string, meta: YouTubeMeta): string {
    const title = meta.title || 'Untitled video';
    const author = meta.author || 'Unknown channel';
    const description = (meta.description || '').trim();
    const transcript = (meta.transcript || '').trim();

    return [
        `Source: YouTube`,
        `URL: ${sourceUrl}`,
        `Title: ${title}`,
        `Channel: ${author}`,
        description ? `Description:\n${description}` : '',
        transcript ? `Transcript:\n${transcript}` : '',
    ].filter(Boolean).join('\n\n');
}

function stripHtmlToText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchReadableContent(sourceUrl: string): Promise<string> {
    const parsed = new URL(sourceUrl);
    if (isYouTubeHost(parsed.hostname)) {
        const yt = await fetchYouTubeMeta(sourceUrl);
        const ytText = buildYouTubeText(sourceUrl, yt);

        // If transcript and description are both missing, avoid summarizing anti-bot/captcha pages.
        if (!yt.transcript && !(yt.description && yt.description.length > 40)) {
            throw new Error('Could not extract transcript/description from this YouTube video. Try another video or one with captions enabled.');
        }

        return ytText;
    }

    const readerRes = await fetch(toReaderUrl(sourceUrl), {
        headers: {
            'User-Agent': 'ZemlyLinkExtractor/1.0',
        },
    });

    if (readerRes.ok) {
        const readerText = (await readerRes.text()).trim();
        if (/too many requests|unusual traffic|captcha|verify you are human/i.test(readerText)) {
            throw new Error('The source blocked automated access (rate limit / anti-bot). Please try another URL.');
        }
        if (readerText.length > 400) return readerText;
    }

    const pageRes = await fetch(sourceUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ZemlyBot/1.0; +https://zemly.app)',
            Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
    });

    if (!pageRes.ok) {
        throw new Error(`Failed to fetch URL content (${pageRes.status})`);
    }

    const html = await pageRes.text();
    const text = stripHtmlToText(html);
    if (text.length < 200) {
        throw new Error('Could not extract enough readable content from this URL.');
    }

    return text;
}

interface ParsedPass {
    title: string;
    notes: string;
    continueNeeded: boolean;
    nextFocus: string;
}

function parsePass(raw: string): ParsedPass {
    const titleMatch = raw.match(/##TITLE##\s*([\s\S]*?)(?=##NOTES##|##CONTINUE##|$)/i);
    const notesMatch = raw.match(/##NOTES##\s*([\s\S]*?)(?=##CONTINUE##|##NEXT_FOCUS##|$)/i);
    const continueMatch = raw.match(/##CONTINUE##\s*([\s\S]*?)(?=##NEXT_FOCUS##|$)/i);
    const nextFocusMatch = raw.match(/##NEXT_FOCUS##\s*([\s\S]*?)$/i);

    const continueToken = (continueMatch?.[1] || '').trim().toUpperCase();
    return {
        title: (titleMatch?.[1] || '').trim(),
        notes: (notesMatch?.[1] || '').trim(),
        continueNeeded: continueToken.startsWith('Y'),
        nextFocus: (nextFocusMatch?.[1] || '').trim(),
    };
}

function buildInitialPrompt(sourceUrl: string, readableText: string): string {
    const sanitizedText = sanitizeNoteForPrompt(readableText);

    return `
You are an expert study notes generator.

INPUT:
- Source URL: ${sourceUrl}
- Extracted source text:
${sanitizedText}

TASK:
1) Understand the source deeply.
2) Generate dense, high-value study notes for students.
3) This is pass 1, so cover as much as possible while staying organized.

RULES:
- Do not mention extraction mechanics.
- Remove obvious navigation/footer noise.
- Keep meaningful concepts, arguments, definitions, facts, formulas, dates, and examples.
- Prioritize complete coverage over short output.

OUTPUT EXACTLY THIS FORMAT:

##TITLE##
A concise, descriptive title for this source

##NOTES##
Structured study notes (Overview, Detailed Notes, Key Terms, Must-Know Facts, Final Summary)

##CONTINUE##
YES or NO

##NEXT_FOCUS##
If CONTINUE is YES, list what should be covered next.
`;
}

function buildContinuationPrompt(sourceUrl: string, readableText: string, notesSoFar: string, nextFocus: string): string {
    const tail = notesSoFar.slice(-24000);
    const sanitizedText = sanitizeNoteForPrompt(readableText);
    const sanitizedTail = sanitizeNoteForPrompt(tail);

    return `
You are continuing notes generation for the same source.

SOURCE URL:
${sourceUrl}

SOURCE TEXT:
${sanitizedText}

ALREADY GENERATED NOTES (tail excerpt):
${sanitizedTail}

NEXT FOCUS GUIDANCE:
${nextFocus || 'Continue with uncovered sections, details, examples, and high-yield facts.'}

TASK:

OUTPUT EXACTLY THIS FORMAT:

##NOTES##
Only the new continuation notes

##CONTINUE##
YES or NO

##NEXT_FOCUS##
If CONTINUE is YES, list what should be covered next.
`;
}

function sanitizeGeminiError(message: string): string {
    const normalized = (message || '').toLowerCase();
    if (normalized.includes('rate limit') || normalized.includes('429')) {
        return 'AI rate limit reached. Please wait about 30-60 seconds and try again.';
    }
    if (normalized.includes('503') || normalized.includes('unavailable') || normalized.includes('high demand')) {
        return 'AI service is under high demand right now. Please try again in a few seconds.';
    }
    return message || 'Failed to generate notes from this link.';
}

async function generateNotes(sourceUrl: string, readableText: string): Promise<{ title: string; noteContent: string }> {
    const clipped = sanitizeNoteForPrompt(readableText.slice(0, LINK_SOURCE_CLIP_CHARS));

    const firstRaw = await promptGemini(buildInitialPrompt(sourceUrl, clipped), {
        temperature: 0.25,
        maxOutputTokens: LINK_PASS_MAX_OUTPUT_TOKENS,
    });
    if (!firstRaw?.trim()) throw new Error('AI returned an empty response.');

    const firstParsed = parsePass(firstRaw);
    const noteParts: string[] = [];
    if (firstParsed.notes) noteParts.push(firstParsed.notes);

    let continueNeeded = firstParsed.continueNeeded;
    let nextFocus = firstParsed.nextFocus;

    for (let pass = 2; pass <= MAX_LINK_PASSES && continueNeeded; pass++) {
        const raw = await promptGemini(
            buildContinuationPrompt(sourceUrl, clipped, noteParts.join('\n\n'), nextFocus),
            {
                temperature: 0.25,
                maxOutputTokens: LINK_PASS_MAX_OUTPUT_TOKENS,
            },
        );

        const parsed = parsePass(raw);
        if (parsed.notes) {
            const alreadyHas = noteParts.some((part) => part.includes(parsed.notes));
            if (!alreadyHas) noteParts.push(parsed.notes);
        }

        continueNeeded = parsed.continueNeeded;
        nextFocus = parsed.nextFocus;
    }

    return {
        title: firstParsed.title,
        noteContent: noteParts.join('\n\n').trim(),
    };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    const { unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    try {
        const body = (await req.json()) as ExtractLinkRequest;
        const sourceUrl = normalizeUrl(typeof body?.url === 'string' ? body.url : '');

        if (!sourceUrl || !isSupportedHttpUrl(sourceUrl)) {
            return new Response(
                JSON.stringify({ error: 'A valid HTTP/HTTPS URL is required.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const readableText = await fetchReadableContent(sourceUrl);
        const generated = await generateNotes(sourceUrl, readableText);

        const fallbackTitle = (() => {
            try {
                return new URL(sourceUrl).hostname.replace(/^www\./i, '');
            } catch {
                return 'Link Note';
            }
        })();

        const title = generated.title.trim() || fallbackTitle;
        const noteContent = generated.noteContent;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'Could not generate notes from this URL.' }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        return new Response(
            JSON.stringify({
                title,
                noteContent,
                extractedText: readableText.slice(0, 600000),
                sourceUrl,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('extract-link error:', error);
        return new Response(
            JSON.stringify({ error: sanitizeGeminiError(error.message || 'Internal server error') }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
