// supabase/functions/extract-document/index.ts
// Content extractor + AI note generator for document and audio inputs.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const PASS_MAX_OUTPUT_TOKENS = 6144;
const MAX_NOTES_PASSES = 4;

// ---------------------------------------------------------------------------
// Convert Uint8Array → base64 string
// ---------------------------------------------------------------------------
function uint8ToBase64(bytes: Uint8Array): string {
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
}

// ---------------------------------------------------------------------------
// Call Gemini with inline file (PDF or text)
// ---------------------------------------------------------------------------
async function callGemini(fileBase64: string, mimeType: string, prompt: string, maxTokens = 6000): Promise<string> {
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
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
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

async function callGeminiWithFallback(fileBase64: string, mimeType: string, prompt: string): Promise<string> {
    const attempts = [PASS_MAX_OUTPUT_TOKENS, 4096, 3072];
    let lastError: unknown = null;

    for (const tokenLimit of attempts) {
        try {
            return await callGemini(fileBase64, mimeType, prompt, tokenLimit);
        } catch (err) {
            lastError = err;
            const message = err instanceof Error ? err.message : '';
            const maybeTokenOrSizeIssue = /maxoutputtokens|max output|token|invalid argument|400|context|too large/i.test(message);
            if (!maybeTokenOrSizeIssue) throw err;
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Gemini generation failed');
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

function buildInitialPrompt(isAudio: boolean, fileName: string): string {
    if (isAudio) {
        return `
You are an expert study notes generator and transcription assistant.

INPUT:
- The uploaded file is an audio recording (lecture, discussion, lesson, or voice note).

TASK:
1) Transcribe the audio faithfully into clean readable text.
2) Turn it into dense, high-value study notes.

RULES:
- Keep speaker wording faithful while cleaning obvious filler and stutters.
- Preserve technical terms, formulas, dates, named entities, and key examples.
- If audio is unclear in places, use [inaudible] briefly.
- Prioritize completeness for students, not brevity.
- This is pass 1. Cover as much as possible without sacrificing quality.

OUTPUT EXACTLY THIS FORMAT:

##TITLE##
A concise, descriptive title

##NOTES##
Structured study notes (use headings, bullets, key terms, facts, and summary)

##CONTINUE##
YES or NO

##NEXT_FOCUS##
If CONTINUE is YES, list what should be covered next in the next pass.

Audio filename: ${fileName}
`;
    }

    return `
You are an expert study notes generator.

TASK:
- Distill this document into dense, high-value, student-friendly notes.
- Preserve all critical concepts, definitions, formulas, dates, examples, and key facts.
- This is pass 1. Cover as much as possible without sacrificing quality.

RULES:
- Rewrite clearly and concisely (no long verbatim copying).
- Do not skip important sections.
- Prefer complete coverage over short output.

OUTPUT EXACTLY THIS FORMAT:

##TITLE##
A concise, descriptive title

##NOTES##
Structured study notes (Overview, Detailed Notes, Key Terms, Must-Know Facts, Final Summary)

##CONTINUE##
YES or NO

##NEXT_FOCUS##
If CONTINUE is YES, list what should be covered next in the next pass.

Document filename: ${fileName}
`;
}

function buildContinuationPrompt(isAudio: boolean, fileName: string, notesSoFar: string, nextFocus: string): string {
    const tail = notesSoFar.slice(-24000);

    return `
You are continuing study-note generation for the same ${isAudio ? 'audio recording' : 'document'}.

ALREADY GENERATED NOTES (tail excerpt):
${tail}

NEXT FOCUS GUIDANCE:
${nextFocus || 'Continue with uncovered major sections and details.'}

TASK:
- Add only NEW material not already captured.
- Keep the same note style and quality.
- Prioritize remaining high-value details for students.

OUTPUT EXACTLY THIS FORMAT:

##NOTES##
Only the new continuation notes

##CONTINUE##
YES or NO

##NEXT_FOCUS##
If CONTINUE is YES, list what should be covered next.

Source filename: ${fileName}
`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const contentType = req.headers.get('content-type') || '';

        let fileBytes: Uint8Array;
        let mimeType = 'application/pdf';
        let fileName = 'document';

        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const file = formData.get('file') as File | null;
            if (!file) {
                return new Response(
                    JSON.stringify({ error: 'No file provided' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
                );
            }

            mimeType = file.type || 'application/pdf';
            fileName = file.name;
            fileBytes = new Uint8Array(await file.arrayBuffer());
        } else if (contentType.includes('application/json')) {
            const body = await req.json();
            const publicUrl = typeof body?.publicUrl === 'string' ? body.publicUrl : '';
            if (!publicUrl) {
                return new Response(
                    JSON.stringify({ error: 'publicUrl is required for JSON requests' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
                );
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

        const firstPrompt = buildInitialPrompt(isAudio, fileName);
        const firstRaw = await callGeminiWithFallback(fileBase64, mimeType, firstPrompt);
        const firstParsed = parsePass(firstRaw);

        const title = firstParsed.title || fileName.replace(/\.[^.]+$/, '');
        const noteParts: string[] = [];
        if (firstParsed.notes) noteParts.push(firstParsed.notes);

        let continueNeeded = firstParsed.continueNeeded;
        let nextFocus = firstParsed.nextFocus;

        for (let pass = 2; pass <= MAX_NOTES_PASSES && continueNeeded; pass++) {
            const prompt = buildContinuationPrompt(isAudio, fileName, noteParts.join('\n\n'), nextFocus);
            const raw = await callGeminiWithFallback(fileBase64, mimeType, prompt);
            const parsed = parsePass(raw);

            if (parsed.notes) {
                const alreadyHas = noteParts.some((part) => part.includes(parsed.notes));
                if (!alreadyHas) noteParts.push(parsed.notes);
            }

            continueNeeded = parsed.continueNeeded;
            nextFocus = parsed.nextFocus;
        }

        const noteContent = noteParts.join('\n\n');
        const extractedText = noteContent;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'Could not extract content from this document.' }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        return new Response(
            JSON.stringify({ title, noteContent, extractedText }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

    } catch (err) {
        const error = err as Error;
        console.error('extract-document error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
