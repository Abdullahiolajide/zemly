// supabase/functions/_shared/gemini.ts
// Shared helper for calling the Google Gemini API (optimized for free tier)

declare const Deno: { env: { get(key: string): string | undefined } };

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Max characters of note content to send — keeps input tokens under free tier limits */
const MAX_NOTE_CHARS = 6000;

interface GeminiMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

interface GeminiOptions {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
}

interface GeminiResponse {
    text: string;
    raw: Record<string, unknown>;
}

/**
 * Truncate note content to stay within free tier input token limits.
 * ~4 chars per token, 6000 chars ≈ 1500 tokens input.
 */
export function truncateNote(content: string, maxChars = MAX_NOTE_CHARS): string {
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars) + '\n...(truncated)';
}

/**
 * Call the Gemini API with a list of messages.
 */
export async function callGemini(
    contents: GeminiMessage[],
    options: GeminiOptions = {},
): Promise<GeminiResponse> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set. Run: supabase secrets set GEMINI_API_KEY=your-key');
    }

    const {
        systemInstruction,
        temperature = 0.7,
        maxOutputTokens = 1024,
    } = options;

    const body: Record<string, unknown> = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens,
        },
    };

    if (systemInstruction) {
        body.system_instruction = {
            parts: [{ text: systemInstruction }],
        };
    }

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return { text, raw: data };
}

/**
 * Convenience: single-turn prompt (no conversation history).
 */
export async function promptGemini(
    prompt: string,
    options: GeminiOptions = {},
): Promise<string> {
    const { text } = await callGemini(
        [{ role: 'user', parts: [{ text: prompt }] }],
        options,
    );
    return text;
}
