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
