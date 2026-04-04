// supabase/functions/_shared/gemini.ts
// Shared helper for calling the Google Gemini API (optimized for free tier)

declare const Deno: { env: { get(key: string): string | undefined } };

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
//Deno.env.get('GEMINI_MODEL') || 
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;

/** Max characters of note content to send — supports up to ~30 pages (~25k tokens) */
const MAX_NOTE_CHARS = 100000;

interface GeminiMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

interface GeminiOptions {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
}

interface GeminiResponse {
    text: string;
    raw: Record<string, unknown>;
}

/**
 * Truncate note content to stay within token limits.
 * ~4 chars per token, 100000 chars ≈ 25000 tokens (supports ~30 pages).
 */
export function truncateNote(content: string, maxChars = MAX_NOTE_CHARS): string {
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars) + '\n...(truncated)';
}

/**
 * When a note contains multiple SOURCE blocks, keep representation from each block
 * instead of truncating only the beginning of the combined note.
 */
export function balanceMultiSourceNote(content: string, maxChars = MAX_NOTE_CHARS): string {
    const sourceMatches = content.match(/(^\s*SOURCE:\s*.*$)/gmi);
    if (!sourceMatches || sourceMatches.length <= 1) {
        return truncateNote(content, maxChars);
    }

    const sections = content
        .split(/(?=^\s*SOURCE:\s*.*$)/gmi)
        .map((section) => section.trim())
        .filter(Boolean);

    if (sections.length <= 1) {
        return truncateNote(content, maxChars);
    }

    const perSectionBudget = Math.max(800, Math.floor(maxChars / sections.length));
    const balanced = sections
        .map((section) => section.slice(0, perSectionBudget).trim())
        .join('\n\n');

    return balanced.length > maxChars ? truncateNote(balanced, maxChars) : balanced;
}

/** Build the request body shared by both callGemini and streamGemini. */
function buildRequestBody(
    contents: GeminiMessage[],
    options: GeminiOptions,
): Record<string, unknown> {
    const {
        systemInstruction,
        temperature = 0.7,
        maxOutputTokens = 1024,
        responseMimeType,
        responseSchema,
    } = options;

    const generationConfig: Record<string, unknown> = {
        temperature,
        maxOutputTokens,
    };

    if (responseMimeType) {
        generationConfig.responseMimeType = responseMimeType;
    }

    if (responseSchema) {
        generationConfig.responseSchema = responseSchema;
    }

    const body: Record<string, unknown> = {
        contents,
        generationConfig,
    };

    if (systemInstruction) {
        body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    return body;
}

/** Fetch with retry logic shared by both call paths. */
async function fetchWithRetry(url: string, body: Record<string, unknown>): Promise<Response> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set. Run: supabase secrets set GEMINI_API_KEY=your-key');
    }

    let res: Response | null = null;
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const separator = url.includes('?') ? '&' : '?';
        res = await fetch(`${url}${separator}key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            continue;
        }
        break;
    }

    if (!res || !res.ok) {
        const errText = res ? await res.text() : 'No response';
        if (res?.status === 429) {
            if (errText.includes('limit: 0')) {
                throw new Error(
                    `The model "${GEMINI_MODEL}" is not available on the free tier. ` +
                    'Update the GEMINI_MODEL secret to a free-tier model (e.g. gemini-2.0-flash-lite).',
                );
            }
            const retryMatch = errText.match(/retry in ([\d.]+)s/i);
            const wait = retryMatch ? Math.ceil(Number(retryMatch[1])) : 15;
            throw new Error(
                `AI rate limit reached — please wait ~${wait} seconds and try again.`,
            );
        }
        throw new Error(`Gemini API error (${res?.status}): ${errText}`);
    }

    return res;
}

/**
 * Call the Gemini API with a list of messages (non-streaming).
 */
export async function callGemini(
    contents: GeminiMessage[],
    options: GeminiOptions = {},
): Promise<GeminiResponse> {
    const body = buildRequestBody(contents, options);
    const res = await fetchWithRetry(`${GEMINI_URL}:generateContent`, body);

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return { text, raw: data };
}

/**
 * Stream Gemini response as SSE. Returns the raw Response whose body is
 * an SSE stream (`data:` lines containing JSON with
 * `candidates[0].content.parts[0].text`).
 */
export async function streamGemini(
    contents: GeminiMessage[],
    options: GeminiOptions = {},
): Promise<Response> {
    const body = buildRequestBody(contents, options);
    const res = await fetchWithRetry(
        `${GEMINI_URL}:streamGenerateContent?alt=sse`,
        body,
    );
    return res;
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
