// supabase/functions/extract-document/index.ts
// Document extractor + AI note generator — plain text output, no JSON parsing issues

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

        if (!contentType.includes('multipart/form-data')) {
            return new Response(
                JSON.stringify({ error: 'Request must be multipart/form-data' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return new Response(
                JSON.stringify({ error: 'No file provided' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const mimeType = file.type || 'application/pdf';
        const fileName = file.name;
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const fileBase64 = uint8ToBase64(fileBytes);

        // ── Single call: extract text + generate notes + title in plain text ──
        const prompt = `Read the attached document and respond in this EXACT format with these three markers — do not deviate:

##TITLE##
Write a short title here (max 8 words)
##EXTRACTED##
Write all the raw text from the document here, verbatim, preserving paragraphs
##NOTES##
Write comprehensive study notes here using this structure:
- Section headings in ALL CAPS followed by a colon
- Bullet points using "- " prefix for each item
- End with a KEY TAKEAWAYS section
- Use plain text only, no special characters or markdown

Document filename: ${fileName}`;

        const raw = await callGemini(fileBase64, mimeType, prompt, 6000);

        // ── Parse the three sections ──
        const titleMatch = raw.match(/##TITLE##\s*([\s\S]*?)(?=##EXTRACTED##|##NOTES##|$)/i);
        const extractedMatch = raw.match(/##EXTRACTED##\s*([\s\S]*?)(?=##NOTES##|$)/i);
        const notesMatch = raw.match(/##NOTES##\s*([\s\S]*?)$/i);

        const title = (titleMatch?.[1] || '').trim() || fileName.replace(/\.[^.]+$/, '');
        const extractedText = (extractedMatch?.[1] || '').trim();
        const noteContent = (notesMatch?.[1] || extractedText || raw).trim();

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'Could not extract content from this document.' }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        return new Response(
            JSON.stringify({ title, noteContent, extractedText: extractedText || noteContent }),
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
