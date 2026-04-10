// src/lib/aiService.ts
// Frontend wrapper to invoke Supabase Edge Functions for AI features

import { supabase } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/* ── Types ── */

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export interface ChatResponse {
    reply: string;
    memory?: string;
}

export interface Flashcard {
    front: string;
    back: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface PodcastLine {
    speaker: string;
    text: string;
}

export interface DocumentExtractResult {
    title: string;
    noteContent: string;
    extractedText: string;
    publicUrl: string;
}

export interface DocumentUploadResult {
    path: string;
    publicUrl: string;
}

export interface ExtractDocumentFromStorageInput {
    publicUrl: string;
    fileName: string;
    mimeType?: string;
}

export interface UploadAndExtractOptions {
    onUploadProgress?: (progress: number) => void;
    onPhaseChange?: (phase: 'uploading' | 'processing') => void;
}

export interface ExtractLinkResult {
    title: string;
    noteContent: string;
    extractedText: string;
    sourceUrl: string;
}

const AUDIO_EXTENSION_MIME_MAP: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.opus': 'audio/opus',
    '.webm': 'audio/webm',
    '.mp4': 'audio/mp4',
    '.mpeg': 'audio/mpeg',
    '.mpga': 'audio/mpeg',
    '.aiff': 'audio/aiff',
    '.aif': 'audio/aiff',
    '.caf': 'audio/x-caf',
    '.amr': 'audio/amr',
    '.3gp': 'audio/3gpp',
    '.wma': 'audio/x-ms-wma',
};

function getLowercaseExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex < 0) return '';
    return fileName.slice(dotIndex).toLowerCase();
}

export function inferAudioMimeType(file: Pick<File, 'name' | 'type'>): string | undefined {
    const normalizedType = (file.type || '').toLowerCase();
    if (normalizedType.startsWith('audio/')) return normalizedType;

    const ext = getLowercaseExtension(file.name);
    if (ext && AUDIO_EXTENSION_MIME_MAP[ext]) return AUDIO_EXTENSION_MIME_MAP[ext];

    if (normalizedType === 'video/mp4') return 'audio/mp4';
    return undefined;
}

export function isLikelyAudioFile(file: Pick<File, 'name' | 'type'>): boolean {
    return Boolean(inferAudioMimeType(file));
}

export const AUDIO_UPLOAD_ACCEPT = [
    'audio/*',
    '.mp3',
    '.wav',
    '.m4a',
    '.aac',
    '.flac',
    '.ogg',
    '.oga',
    '.opus',
    '.webm',
    '.mp4',
    '.mpeg',
    '.mpga',
    '.aiff',
    '.aif',
    '.caf',
    '.amr',
    '.3gp',
    '.wma',
].join(',');

/* ── API calls ── */

/**
 * Extract a meaningful error message from a Supabase Edge Function error.
 * The Supabase client returns a generic "Edge Function returned a non-2xx status code"
 * in `error.message`, but the actual error body is inside `error.context` (a Response).
 */
async function extractErrorMessage(
    error: { message?: string; context?: unknown },
    fallback: string,
): Promise<string> {
    try {
        const ctx = error.context;
        if (ctx && typeof (ctx as Response).json === 'function') {
            const body = await (ctx as Response).json();
            if (body?.error) return body.error;
        }
    } catch { /* ignore parse failures */ }
    return error.message || fallback;
}

/**
 * Upload a document file to Supabase Storage with measurable progress.
 */
export async function uploadDocumentToStorage(
    file: File,
    options?: { onUploadProgress?: (progress: number) => void },
): Promise<DocumentUploadResult> {
    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const effectiveMimeType = file.type || inferAudioMimeType(file) || 'application/octet-stream';

    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/documents/${encodeURIComponent(safeFileName)}`;

        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('cache-control', '3600');
        xhr.setRequestHeader('content-type', effectiveMimeType);
        if (token) {
            xhr.setRequestHeader('authorization', `Bearer ${token}`);
        }

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
            options?.onUploadProgress?.(progress);
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                options?.onUploadProgress?.(100);
                resolve();
                return;
            }

            let errorMessage = 'File upload failed';
            try {
                const body = JSON.parse(xhr.responseText);
                if (body?.error) errorMessage = body.error;
                if (body?.message) errorMessage = body.message;
            } catch {
                if (xhr.responseText) errorMessage = xhr.responseText;
            }
            reject(new Error(errorMessage));
        };

        xhr.onerror = () => reject(new Error('File upload failed: network error'));
        xhr.send(file);
    });

    // 2. Get the public URL
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(safeFileName);
    return {
        path: safeFileName,
        publicUrl: urlData.publicUrl,
    };
}

/**
 * Delete a previously uploaded document object from Supabase Storage.
 */
export async function deleteDocumentFromStorage(path: string): Promise<void> {
    if (!path) return;
    const { error } = await supabase.storage.from('documents').remove([path]);
    if (error) throw new Error(`Failed to delete uploaded file: ${error.message}`);
}

/**
 * Generate AI notes from a file that has already been uploaded to Storage.
 */
export async function extractDocumentFromStorage(
    input: ExtractDocumentFromStorageInput,
): Promise<Omit<DocumentExtractResult, 'publicUrl'>> {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-document`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        let errMsg = 'Document extraction failed';
        try {
            const body = await res.json();
            if (body?.error) errMsg = body.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
    }

    const result = await res.json();
    return {
        title: result.title,
        noteContent: result.noteContent,
        extractedText: result.extractedText,
    };
}

/**
 * Backward-compatible helper: upload first, then extract from uploaded URL.
 */
export async function uploadAndExtractDocument(
    file: File,
    options?: UploadAndExtractOptions,
): Promise<DocumentExtractResult> {
    options?.onPhaseChange?.('uploading');
    const upload = await uploadDocumentToStorage(file, {
        onUploadProgress: options?.onUploadProgress,
    });

    options?.onPhaseChange?.('processing');
    const extracted = await extractDocumentFromStorage({
        publicUrl: upload.publicUrl,
        fileName: file.name,
        mimeType: file.type || inferAudioMimeType(file) || undefined,
    });
    return {
        ...extracted,
        publicUrl: upload.publicUrl,
    };
}

/**
 * Generate notes from a public website or YouTube URL.
 */
export async function extractFromLink(url: string): Promise<ExtractLinkResult> {
    const { data, error } = await supabase.functions.invoke('extract-link', {
        body: { url },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Link extraction failed'));

    return {
        title: data.title,
        noteContent: data.noteContent,
        extractedText: data.extractedText,
        sourceUrl: data.sourceUrl,
    };
}

/**
 * Chat with the AI about a note's content.
 * Maintains conversation history via the `messages` array.
 */
export async function chatWithNote(
    noteContent: string,
    messages: ChatMessage[],
    memory?: string,
): Promise<ChatResponse> {
    const { data, error } = await supabase.functions.invoke('chat', {
        body: { noteContent, messages, memory },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Chat request failed'));
    return {
        reply: data.reply,
        memory: typeof data.memory === 'string' ? data.memory : undefined,
    };
}

/**
 * Chat with the AI about a note's content — streaming version.
 * Tokens arrive via onChunk callback for typewriter effect.
 */
export async function chatWithNoteStream(
    noteContent: string,
    messages: ChatMessage[],
    callbacks: {
        onChunk: (text: string) => void;
        onMemory?: (memory: string) => void;
        signal?: AbortSignal;
    },
    memory?: string,
): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ noteContent, messages, memory }),
        signal: callbacks.signal,
    });

    if (!res.ok) {
        let errMsg = 'Chat request failed';
        try {
            const body = await res.json();
            if (body?.error) errMsg = body.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
            if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
                continue;
            }

            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
                const parsed = JSON.parse(jsonStr);

                if (currentEvent === 'memory') {
                    callbacks.onMemory?.(parsed.memory ?? '');
                } else if (currentEvent === 'done') {
                    // Stream finished
                } else if (currentEvent === 'error') {
                    throw new Error(parsed.error || 'Stream error');
                } else {
                    // Default: text chunk
                    if (parsed.text) {
                        callbacks.onChunk(parsed.text);
                    }
                }
            } catch (e) {
                if (e instanceof Error && e.message !== 'Stream error') {
                    // JSON parse error, skip
                } else {
                    throw e;
                }
            }
            currentEvent = '';
        }
    }
}

/**
 * Generate study flashcards from note content.
 * The model decides the final count based on note length (15-30).
 */
export async function generateFlashcards(
    noteContent: string,
): Promise<Flashcard[]> {
    const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: { noteContent },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Flashcard generation failed'));
    return data.flashcards;
}

/**
 * Generate a multiple-choice quiz from note content.
 * The model decides how many questions to create (15-30).
 */
export async function generateQuiz(
    noteContent: string,
): Promise<QuizQuestion[]> {
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { noteContent },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Quiz generation failed'));
    return data.questions;
}

/**
 * Generate an explanation for why the correct answer is correct.
 * Called on-demand when the user clicks "Correct Answer Explained".
 */
export async function generateQuizExplanation(
    question: string,
    options: string[],
    correctIndex: number,
    noteContent: string,
): Promise<string> {
    const { data, error } = await supabase.functions.invoke('chat', {
        body: {
            noteContent,
            messages: [
                {
                    role: 'user',
                    content: `Explain why the correct answer to this quiz question is correct. Be concise (2-3 sentences max).

Question: ${question}
Options: ${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}
Correct answer: ${options[correctIndex]}

Explain why "${options[correctIndex]}" is correct.`,
                },
            ],
        },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Failed to generate explanation'));
    return data.reply;
}

/**
 * Generate a podcast-style conversational script from note content.
 */
export async function generatePodcast(
    noteContent: string,
): Promise<PodcastLine[]> {
    const { data, error } = await supabase.functions.invoke('generate-podcast', {
        body: { noteContent },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Podcast generation failed'));
    return data.script;
}

/**
 * Generate podcast audio from a script using Azure Speech Service (TTS).
 * Returns an audio Blob (MP3) ready for playback.
 */
export async function generatePodcastAudio(
    script: PodcastLine[],
): Promise<Blob> {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-podcast-audio`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ script }),
    });

    if (!res.ok) {
        let errMsg = 'Podcast audio generation failed';
        try {
            const body = await res.json();
            if (body?.error) errMsg = body.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
    }

    const result = await res.json();
    // Decode base64 audio to a Blob
    const binaryString = atob(result.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: result.mimeType || 'audio/mpeg' });
}

export interface RaiseHandResponseResult {
    reply: string;
    audioBlob: Blob;
}

function sanitizeUiErrorMessage(input: unknown, fallback: string): string {
    const raw = typeof input === 'string' ? input.trim() : '';
    if (!raw) return fallback;

    const normalized = raw.toLowerCase();
    if (normalized.includes('503')) {
        return 'AI service is temporarily unavailable. Please try again in a few seconds.';
    }
    if (normalized.includes('429') || normalized.includes('rate limit')) {
        return 'AI is currently rate-limited. Please wait a bit and try again.';
    }

    if (raw.includes('{') && raw.includes('}')) {
        return fallback;
    }

    return raw;
}

export async function generateRaiseHandResponse(
    noteContent: string,
    question: string,
    options?: {
        noteTitle?: string;
        podcastScript?: PodcastLine[];
        currentLineIndex?: number;
        conversationHistory?: Array<{ question: string; answer: string }>;
    },
): Promise<RaiseHandResponseResult> {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/raise-hand-response`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
            noteContent,
            question,
            noteTitle: options?.noteTitle,
            podcastScript: options?.podcastScript,
            currentLineIndex: options?.currentLineIndex,
            conversationHistory: options?.conversationHistory,
        }),
    });

    if (!res.ok) {
        let errMsg = 'Raise hand response generation failed';
        try {
            const body = await res.json();
            if (body?.error) errMsg = sanitizeUiErrorMessage(body.error, errMsg);
            else if (body?.message) errMsg = sanitizeUiErrorMessage(body.message, errMsg);
        } catch { /* ignore */ }
        throw new Error(sanitizeUiErrorMessage(errMsg, 'Raise hand response generation failed'));
    }

    const result = await res.json();
    const reply = typeof result.reply === 'string' ? result.reply : '';
    const audioBase64 = typeof result.audio === 'string' ? result.audio : '';
    const mimeType = typeof result.mimeType === 'string' ? result.mimeType : 'audio/mpeg';

    if (!reply) {
        throw new Error('Raise hand response did not return a reply');
    }
    if (!audioBase64) {
        throw new Error('Raise hand response did not return audio');
    }

    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return {
        reply,
        audioBlob: new Blob([bytes], { type: mimeType }),
    };
}

/* ── Streaming raise-hand response ── */

export interface RaiseHandStreamCallbacks {
    /** Called for each complete sentence of the reply. */
    onTextChunk: (text: string) => void;
    /** Called for each TTS audio chunk (in sentence order). */
    onAudioChunk: (audioBlob: Blob) => void;
    /** Called once after all text and audio events are sent. */
    onDone: (fullReply: string) => void;
}

/**
 * Streaming version of generateRaiseHandResponse.
 *
 * The edge function streams Gemini text sentence-by-sentence, fires TTS
 * concurrently for each sentence, and sends audio chunks as SSE events.
 * This dramatically reduces time-to-first-audio.
 */
export async function generateRaiseHandResponseStreaming(
    noteContent: string,
    question: string,
    callbacks: RaiseHandStreamCallbacks,
    options?: {
        noteTitle?: string;
        podcastScript?: PodcastLine[];
        currentLineIndex?: number;
        conversationHistory?: Array<{ question: string; answer: string }>;
    },
): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/raise-hand-response`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
            noteContent,
            question,
            noteTitle: options?.noteTitle,
            podcastScript: options?.podcastScript,
            currentLineIndex: options?.currentLineIndex,
            conversationHistory: options?.conversationHistory,
        }),
    });

    if (!res.ok) {
        let errMsg = 'Raise hand response generation failed';
        try {
            const body = await res.json();
            if (body?.error) errMsg = sanitizeUiErrorMessage(body.error, errMsg);
            else if (body?.message) errMsg = sanitizeUiErrorMessage(body.message, errMsg);
        } catch { /* ignore */ }
        throw new Error(sanitizeUiErrorMessage(errMsg, 'Raise hand response generation failed'));
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
                continue;
            }

            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
                const parsed = JSON.parse(jsonStr);

                if (currentEvent === 'error') {
                    throw new Error(parsed.error || 'Stream error');
                }

                if (currentEvent === 'text' && parsed.text) {
                    callbacks.onTextChunk(parsed.text);
                }

                if (currentEvent === 'audio' && parsed.audio) {
                    const binaryString = atob(parsed.audio);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    callbacks.onAudioChunk(new Blob([bytes], { type: 'audio/mpeg' }));
                }

                if (currentEvent === 'done') {
                    callbacks.onDone(parsed.reply || '');
                }
            } catch (e) {
                if (e instanceof SyntaxError) {
                    // JSON parse error — skip malformed SSE data
                } else {
                    throw e;
                }
            }
            currentEvent = '';
        }
    }
}
