
declare const Deno: { env: { get(key: string): string | undefined } };

const SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || '';
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const PROJECT_ID = 'zemly-487808';
const LOCATION = 'us-central1';

const MAX_NOTE_CHARS = 100000;

interface GeminiMessage {
    role: 'user' | 'model';
    parts: { text: string | { mime_type: string; data: string } }[];
}

interface GeminiOptions {
    model?: string;
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

// --- Auth ---

function base64url(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlUint8(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(): Promise<string> {
    if (!SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT secret is not set');

    const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
    const now = Math.floor(Date.now() / 1000);

    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }));

    const signingInput = `${header}.${payload}`;

    const pemKey = sa.private_key as string;
    const pemBody = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
    const derBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        derBytes,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signingInput),
    );

    const jwt = `${signingInput}.${base64urlUint8(new Uint8Array(signature))}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Failed to get access token: ${err}`);
    }

    const tokenData = await tokenRes.json();
    return tokenData.access_token as string;
}

// --- URL builder ---

function buildVertexUrl(model: string): string {
    return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}`;
}

// --- Note helpers ---

export function truncateNote(content: string, maxChars = MAX_NOTE_CHARS): string {
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars) + '\n...(truncated)';
}

export function balanceMultiSourceNote(content: string, maxChars = MAX_NOTE_CHARS): string {
    const sourceMatches = content.match(/(^\s*SOURCE:\s*.*$)/gmi);
    if (!sourceMatches || sourceMatches.length <= 1) return truncateNote(content, maxChars);

    const sections = content
        .split(/(?=^\s*SOURCE:\s*.*$)/gmi)
        .map((s) => s.trim())
        .filter(Boolean);

    if (sections.length <= 1) return truncateNote(content, maxChars);

    const perSectionBudget = Math.max(800, Math.floor(maxChars / sections.length));
    const balanced = sections.map((s) => s.slice(0, perSectionBudget).trim()).join('\n\n');
    return balanced.length > maxChars ? truncateNote(balanced, maxChars) : balanced;
}

// --- Request builder ---

function buildRequestBody(contents: GeminiMessage[], options: Omit<GeminiOptions, 'model'>): Record<string, unknown> {
    const { systemInstruction, temperature = 0.7, maxOutputTokens = 8192, responseMimeType, responseSchema } = options;

    const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens };
    if (responseMimeType) generationConfig.responseMimeType = responseMimeType;
    if (responseSchema) generationConfig.responseSchema = responseSchema;

    const body: Record<string, unknown> = { contents, generationConfig };
    if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] };

    return body;
}

// --- Fetch with retry ---

async function fetchWithRetry(
    model: string,
    body: Record<string, unknown>,
    stream = false,
): Promise<Response> {
    const token = await getAccessToken();
    const baseUrl = buildVertexUrl(model);
    const url = stream
        ? `${baseUrl}:streamGenerateContent?alt=sse`
        : `${baseUrl}:generateContent`;

    let res: Response | null = null;
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
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
            const retryMatch = errText.match(/retry in ([\d.]+)s/i);
            const wait = retryMatch ? Math.ceil(Number(retryMatch[1])) : 15;
            throw new Error(`AI rate limit reached — please wait ~${wait} seconds and try again.`);
        }
        if (res?.status === 503) throw new Error('AI service is temporarily unavailable. Please try again.');
        if (errText.includes('{') && errText.includes('}')) throw new Error(`Gemini request failed (${res?.status}). Please try again.`);
        throw new Error(`Gemini request failed (${res?.status}): ${errText}`);
    }

    return res;
}

// --- Public API ---

export async function callGemini(
    contents: GeminiMessage[],
    options: GeminiOptions = {},
): Promise<GeminiResponse> {
    const { model = DEFAULT_MODEL, ...rest } = options;
    const body = buildRequestBody(contents, rest);
    const res = await fetchWithRetry(model, body);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { text, raw: data };
}

export async function streamGemini(
    contents: GeminiMessage[],
    options: GeminiOptions = {},
): Promise<Response> {
    const { model = DEFAULT_MODEL, ...rest } = options;
    const body = buildRequestBody(contents, rest);
    return await fetchWithRetry(model, body, true);
}

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