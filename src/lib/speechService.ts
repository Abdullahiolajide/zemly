// src/lib/speechService.ts
// Azure Speech SDK wrapper for real-time speech-to-text.
// The SDK is lazy-loaded so the ~2 MB bundle only ships when needed.

import { supabase } from './supabaseClient';
import { getEdgeFunctionAuthHeaders } from './edgeFunctionAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/* ── Token management ── */

interface CachedToken {
    token: string;
    region: string;
    expiresAt: number;
}

let cachedToken: CachedToken | null = null;

async function fetchSpeechToken(): Promise<{ token: string; region: string }> {
    // Return cached token if still valid (tokens last 10 min; refresh at 8 min)
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return { token: cachedToken.token, region: cachedToken.region };
    }

    const authHeaders = await getEdgeFunctionAuthHeaders();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/speech-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
            apikey: SUPABASE_ANON_KEY,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to fetch speech token');
    }

    const { token, region } = await res.json();

    cachedToken = {
        token,
        region,
        expiresAt: Date.now() + 8 * 60 * 1000, // refresh 2 min early
    };

    return { token, region };
}

/* ── Public types ── */

export interface RecognitionHandle {
    /** Stop recognition and dispose the recognizer. */
    stop: () => void;
}

export interface RecognitionCallbacks {
    /** Fired frequently with the full accumulated text + current partial. */
    onInterim: (text: string) => void;
    /** Fired when Azure finalises a phrase. `text` is full accumulated final text. */
    onRecognized: (text: string) => void;
    /** Fired on errors (auth failure, mic denied, etc.). */
    onError: (error: string) => void;
    /** Fired when the recognizer session fully stops. */
    onEnd: () => void;
}

/* ── Warmup ── */

/**
 * Pre-loads the Azure SDK and fetches a speech token.
 * Call this while the greeting audio plays so the first listen is instant.
 */
export async function warmupSpeechRecognition(): Promise<void> {
    await Promise.all([
        import('microsoft-cognitiveservices-speech-sdk'),
        fetchSpeechToken(),
    ]);
}

/* ── Start recognition ── */

/**
 * Creates an Azure SpeechRecognizer with continuous recognition,
 * wires up the callbacks, and starts listening.
 *
 * Returns a handle to stop/dispose the recognizer.
 */
export async function startRecognition(
    callbacks: RecognitionCallbacks,
): Promise<RecognitionHandle> {
    const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk');
    const { token, region } = await fetchSpeechToken();

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = 'en-US';

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    let accumulated = '';
    let disposed = false;

    /* Partial / interim results */
    recognizer.recognizing = (_s: unknown, e: { result: { text: string } }) => {
        if (disposed) return;
        const interim = accumulated
            ? accumulated + ' ' + e.result.text
            : e.result.text;
        callbacks.onInterim(interim);
    };

    /* Final result for one phrase */
    recognizer.recognized = (_s: unknown, e: { result: { text: string; reason: number } }) => {
        if (disposed) return;
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            accumulated = accumulated
                ? accumulated + ' ' + e.result.text
                : e.result.text;
            callbacks.onRecognized(accumulated);
        }
        // NoMatch is normal (silence) — ignore
    };

    /* Error / cancellation */
    recognizer.canceled = (_s: unknown, e: { reason: number; errorDetails?: string; errorCode?: number }) => {
        if (disposed) return;
        if (e.reason === SpeechSDK.CancellationReason.Error) {
            // Clear cached token on auth failure so next attempt refreshes
            if (e.errorCode === SpeechSDK.CancellationErrorCode.AuthenticationFailure) {
                cachedToken = null;
            }
            callbacks.onError(e.errorDetails || 'Speech recognition failed');
        }
    };

    /* Session stopped (after stopContinuousRecognitionAsync) */
    recognizer.sessionStopped = () => {
        if (disposed) return;
        callbacks.onEnd();
    };

    /* Start */
    await new Promise<void>((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(
            () => resolve(),
            (err: string) => reject(new Error(err)),
        );
    });

    const handle: RecognitionHandle = {
        stop: () => {
            if (disposed) return;
            disposed = true;
            recognizer.stopContinuousRecognitionAsync(
                () => recognizer.close(),
                () => recognizer.close(),
            );
        },
    };

    return handle;
}
