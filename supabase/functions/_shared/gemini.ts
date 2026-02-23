// supabase/functions/_shared/gemini.ts
// Shared helper for calling the Google Gemini API (optimized for free tier)

declare const Deno: { env: { get(key: string): string | undefined } };

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
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

    let res: Response | null = null;
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        // Retry on 429 (rate limit) or 503 (overloaded) with exponential back-off
        if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            continue;
        }
        break;
    }

    if (!res || !res.ok) {
        const errText = res ? await res.text() : 'No response';
        if (res?.status === 429) {
            // Check if the model is completely unavailable on the free tier (limit: 0)
            if (errText.includes('limit: 0')) {
                throw new Error(
                    `The model "${GEMINI_MODEL}" is not available on the free tier. ` +
                    'Update the GEMINI_MODEL secret to a free-tier model (e.g. gemini-2.0-flash-lite).',
                );
            }
            // Extract retry delay if present
            const retryMatch = errText.match(/retry in ([\d.]+)s/i);
            const wait = retryMatch ? Math.ceil(Number(retryMatch[1])) : 15;
            throw new Error(
                `AI rate limit reached — please wait ~${wait} seconds and try again.`,
            );
        }
        throw new Error(`Gemini API error (${res?.status}): ${errText}`);
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
