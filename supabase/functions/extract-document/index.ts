import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { sanitizeNoteForPrompt } from '../_shared/sanitize.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_OUTPUT_TOKENS = 30000;

function uint8ToBase64(bytes: Uint8Array): string {
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
}

async function callGemini(
    fileBase64: string,
    mimeType: string,
    prompt: string,
): Promise<string> {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

    const body = {
        contents: [
            {
                parts: [
                    { inline_data: { mime_type: mimeType, data: fileBase64 } },
                    { text: prompt },
                ],
            },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: MAX_OUTPUT_TOKENS },
    };

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function normalizeNoteContent(note: string): string {
    return note
        .replace(/\r\n/g, '\n')
        .replace(/ \* /g, '\n- ')
        .split('\n')
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (/^[•*]\s+/.test(trimmed)) return trimmed.replace(/^[•*]\s+/, '- ');
            return line;
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function buildPrompt(isAudio: boolean, fileName: string): string {
    if (isAudio) {
        return `
You are an expert study notes generator and transcription assistant.

INPUT:
- The uploaded file is an audio recording (lecture, discussion, lesson, or voice note).

TASK:
1) Transcribe the audio faithfully into clean readable text.
2) Turn it into dense, high-value study notes.

LENGTH RULES:
- First, estimate the character count of the audio transcript.
- If under 10,000 characters: be thorough and detailed.
- If 10,000–50,000 characters: be selective — key concepts and definitions only.
- If over 50,000 characters: be highly concise — only the most critical points per section.

STYLE RULES:
- Identify the natural topics/sections and use those as your section headers.
- Each section header must start with a relevant emoji, e.g. "🧠 Memory and Learning".
- Under each section, bold every named concept, term, or category: **Term:** then explain it in 1–3 plain-English sentences.
- Use bullet points for sub-details, examples, or lists. Avoid dense paragraphs.
- Write as if explaining to a smart peer — no jargon without a definition.
- No filler phrases like "In this audio..." or "The speaker discusses...".
- Keep speaker wording faithful while cleaning obvious filler and stutters.
- Preserve technical terms, formulas, dates, named entities, and key examples.
- If audio is unclear in places, use [inaudible] briefly.
- Use markdown structure only: headings for major topics, bullets for details.
- Do not dump raw OCR fragments or page headers/footers.
- If you include formulas, format them as readable markdown or short inline math.

OUTPUT EXACTLY THIS FORMAT (no extra text outside these tags):

##TITLE##
A concise, descriptive title

##NOTES##
Your structured study notes here

Audio filename: ${fileName}
`;
    }

    return `
You are an expert study notes generator.

TASK:
- Distill this document into dense, high-value, student-friendly notes in a single pass.
- Preserve all critical concepts, definitions, formulas, dates, examples, and key facts.

LENGTH RULES:
- First, estimate the character count of the document.
- If under 10,000 characters: be thorough and detailed.
- If 10,000–50,000 characters: be selective — key concepts and definitions only.
- If over 50,000 characters: be highly concise — only the most critical points per section.

STYLE RULES:
- Identify the natural topics/sections in the document and use those as your section headers. Do NOT use generic headers like "Overview" or "Key Concepts" — mirror the document's own structure.
- Each section header must start with a relevant emoji, e.g. "⚡ Electric Drives" or "🧬 Cell Division".
- Under each section, bold every named concept, term, or category: **Term:** then explain it in 1–3 plain-English sentences.
- Use bullet points for sub-details, examples, or lists. Avoid dense paragraphs.
- Use standard markdown only: hyphens for bullets, double hashes for headings, and bold terms for emphasis. Do not leave literal asterisks in the final note text.
- Never use " * " as an inline separator. Each bullet point must be on its own new line.
- Preserve mathematical notation exactly when it appears in the source. Keep LaTeX commands like \vec, \hat, \frac, \sqrt, \sum, and \int as LaTeX and wrap equations only in $...$ or $$...$$.
- Always wrap ALL LaTeX expressions in $...$ for inline or $$...$$ for block/display equations. This includes \begin{} environments like \begin{vmatrix}, \begin{matrix}, \begin{pmatrix} etc. — these must always be wrapped in $$...$$.
- Write as if explaining to a smart peer — no jargon without a definition.
- No filler phrases like "In this document..." or "The author explains...".
- Rewrite clearly and concisely — no long verbatim copying.
- Use markdown structure only: headings for major topics, bullets for details.
- Do not dump raw OCR fragments or page headers/footers.
- If you include formulas, wrap them in LaTeX math delimiters such as $...$ or $$...$$ so they render correctly.

OUTPUT EXACTLY THIS FORMAT (no extra text outside these tags):

##TITLE##
A concise, descriptive title

##NOTES##
Your structured study notes here

Document filename: ${fileName}
`;
}

function parseOutput(raw: string): { title: string; notes: string } {
    const titleMatch = raw.match(/##TITLE##\s*([\s\S]*?)(?=##NOTES##|$)/i);
    const notesMatch = raw.match(/##NOTES##\s*([\s\S]*?)$/i);

    return {
        title: (titleMatch?.[1] || '').trim(),
        notes: (notesMatch?.[1] || raw).trim(),
    };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    const { unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    try {
        const contentType = req.headers.get('content-type') || '';

        let fileBytes: Uint8Array;
        let mimeType = 'application/pdf';
        let fileName = 'document';

        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const file = formData.get('file') as File | null;
            if (!file) {
                return new Response(JSON.stringify({ error: 'No file provided' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            mimeType = file.type || 'application/pdf';
            fileName = file.name;
            fileBytes = new Uint8Array(await file.arrayBuffer());
        } else if (contentType.includes('application/json')) {
            const body = await req.json();
            const publicUrl = typeof body?.publicUrl === 'string' ? body.publicUrl : '';
            if (!publicUrl) {
                return new Response(JSON.stringify({ error: 'publicUrl is required for JSON requests' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const fileRes = await fetch(publicUrl);
            if (!fileRes.ok) {
                return new Response(
                    JSON.stringify({ error: `Failed to fetch uploaded file (${fileRes.status})` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
                );
            }

            const fetchedType = fileRes.headers.get('content-type') || '';
            mimeType = (typeof body?.mimeType === 'string' && body.mimeType) || fetchedType || 'application/pdf';
            fileName = (typeof body?.fileName === 'string' && body.fileName) || 'document';
            fileBytes = new Uint8Array(await fileRes.arrayBuffer());
        } else {
            return new Response(
                JSON.stringify({ error: 'Request must be multipart/form-data or application/json' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const fileBase64 = uint8ToBase64(fileBytes);
        const isAudio = mimeType.toLowerCase().startsWith('audio/');
        const prompt = buildPrompt(isAudio, fileName);
        const raw = await callGemini(fileBase64, mimeType, prompt);
        const { title, notes } = parseOutput(raw);

        const noteContent = normalizeNoteContent(notes);
        const finalTitle = title || fileName.replace(/\.[^.]+$/, '');

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'Could not extract content from this document.' }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        return new Response(JSON.stringify({ title: finalTitle, noteContent, extractedText: noteContent }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        const error = err as Error;
        console.error('extract-document error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});