// supabase/functions/extract-document/index.ts
// Content extractor + AI note generator for document and audio inputs.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

        // Single call: extract transcript/text + generate notes + title in plain text.
        const prompt = isAudio
            ? `
                You are an expert study notes generator and transcription assistant.

                INPUT:
                - The uploaded file is an audio recording (lecture, discussion, lesson, or voice note).

                TASK:
                1) Transcribe the audio faithfully into clean readable text.
                2) Turn the transcription into dense, high-value study notes.

                RULES:
                - Keep speaker wording faithful while cleaning obvious filler words and stutters.
                - Preserve technical terms, formulas, dates, named entities, and key examples.
                - If audio is unclear in places, note it briefly as [inaudible] rather than guessing.
                - Notes must be concise, structured, and complete.
                - Do not include any analysis about being an AI model.

                OUTPUT EXACTLY THIS FORMAT (include the tags):

                ##TITLE##
                A concise, descriptive title for this audio lesson

                ##NOTES##
                ## 📌 Overview
                3-4 sentences. What is this recording about and why does it matter?

                ## 🗣️ Clean Transcript (Condensed)
                - A readable transcript summary in chronological flow
                - Preserve key quotes only when they matter

                ## 📚 Detailed Notes

                ### [Major Topic 1]
                - **[Key term]**: Concise but complete explanation
                - Supporting facts/examples from the recording

                ### [Major Topic 2]
                ...

                ## 🔑 Key Terms & Definitions
                - **[Term]**: Definition as intended in the recording

                ## ⚡ Must-Know Facts
                Standalone facts, formulas, dates, and stats worth memorizing.

                ## 📝 Final Summary
                4-6 sentences covering the most critical takeaways.

                Audio filename: ${fileName}
                `
            : `
                    You are an expert study notes generator. Distill this document into the densest, most useful study notes possible.

                    CORE PHILOSOPHY:
                    Every sentence must earn its place. Include key concepts, definitions, named terms, examples that aid understanding, formulas, dates, and facts. Cut filler, repetition, and verbose explanations.

                    RULES:
                    - Never copy text verbatim — rewrite clearly and concisely
                    - Never skip a key concept or important fact
                    - Preserve examples only if they genuinely aid understanding
                    - Compress aggressively but never at the cost of accuracy
                    - Work through the ENTIRE document — do not truncate early
                    - Length is proportional to content density

                    OUTPUT EXACTLY THIS FORMAT (include the tags):

                    ##TITLE##
                    A concise, descriptive title for this document (not the filename)

                    ##NOTES##
                    ## 📌 Overview
                    3-4 sentences. What is this document about and why does it matter?

                    ## 📚 Detailed Notes

                    ### [Major Topic 1]

                    #### [Subtopic if applicable]
                    - **[Key term]**: Concise but complete explanation
                    - Supporting detail only if it adds meaning
                    - Examples that genuinely aid understanding
                    - Formulas, figures, or dates with context

                    ### [Major Topic 2]
                    ...

                    (Cover every major topic — do not skip sections)

                    ## 🔑 Key Terms & Definitions
                    - **[Term]**: Definition as the document intends it

                    ## ⚡ Must-Know Facts
                    Standalone facts, dates, formulas, statistics worth memorizing — one line each.

                    ## 📝 Final Summary
                    4-6 sentences covering the most critical takeaways.

                    Document filename: ${fileName}
                    `;

        let raw = '';
        try {
            // Keep output high but within commonly supported limits for flash-lite models.
            raw = await callGemini(fileBase64, mimeType, prompt, 8192);
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            const maybeTokenLimit = /maxoutputtokens|max output|token|invalid argument|400/i.test(message);
            if (!maybeTokenLimit) throw err;

            // Fallback for stricter model limits/projects.
            raw = await callGemini(fileBase64, mimeType, prompt, 6144);
        }

        // ── Parse the three sections ──
        const titleMatch = raw.match(/##TITLE##\s*([\s\S]*?)(?=##NOTES##|$)/i);
        const notesMatch = raw.match(/##NOTES##\s*([\s\S]*?)$/i);

        const title = (titleMatch?.[1] || '').trim() || fileName.replace(/\.[^.]+$/, '');
        const noteContent = (notesMatch?.[1] || raw).trim();
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
