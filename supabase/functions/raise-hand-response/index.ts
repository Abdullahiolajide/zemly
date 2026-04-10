// supabase/functions/raise-hand-response/index.ts
// Handles a raised-hand question:
// Streams Gemini text → sentence-level concurrent Azure TTS → SSE events back to client.
//
// SSE event types:
//   event: text   — a complete sentence of the reply
//   event: audio  — base64-encoded MP3 for one sentence (sent in order)
//   event: done   — final event with the full reply text
//   event: error  — an error occurred

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { streamGemini, truncateNote } from '../_shared/gemini.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

interface RaiseHandRequest {
    noteContent: string;
    question: string;
    noteTitle?: string;
    podcastScript?: { speaker: string; text: string }[];
    currentLineIndex?: number;
    conversationHistory?: { question: string; answer: string }[];
}

function buildPodcastWindow(
    script: { speaker: string; text: string }[] | undefined,
    currentLineIndex: number | undefined,
): string {
    if (!script || script.length === 0) return '';
    const idx = typeof currentLineIndex === 'number' ? Math.max(0, Math.min(script.length - 1, currentLineIndex)) : script.length - 1;
    const start = Math.max(0, idx - 4);
    const end = Math.min(script.length, idx + 5);
    const windowLines = script.slice(start, end);
    return windowLines
        .map((line) => `${line.speaker || 'Host'}: ${line.text || ''}`)
        .join('\n');
}

function buildConversationHistory(history: { question: string; answer: string }[] | undefined): string {
    if (!history || history.length === 0) return '';
    return history
        .slice(-4)
        .map((turn, idx) => `Q${idx + 1}: ${turn.question}\nA${idx + 1}: ${turn.answer}`)
        .join('\n\n');
}

function toUserFacingError(message: string): string {
    if (!message) return 'Something went wrong. Please try again.';

    const normalized = message.toLowerCase();
    if (normalized.includes('gemini api error (503)') || normalized.includes('503')) {
        return 'AI service is temporarily unavailable. Please try again in a few seconds.';
    }
    if (normalized.includes('gemini api error (429)') || normalized.includes('rate limit')) {
        return 'AI is currently rate-limited. Please wait a bit and try again.';
    }
    if (normalized.includes('azure tts failed')) {
        return 'Voice synthesis is temporarily unavailable. Please try again.';
    }

    // Avoid leaking raw JSON blobs to the UI.
    if (message.includes('{') && message.includes('}')) {
        return 'AI request failed. Please try again.';
    }

    return message;
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildSsml(text: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="en-US-AvaMultilingualNeural">
    <prosody rate="1.02">${escapeXml(text)}</prosody>
  </voice>
</speak>`;
}

async function synthesizeReplyAudio(reply: string, speechKey: string, speechRegion: string): Promise<Uint8Array> {
    const ttsEndpoint = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ttsRes = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': speechKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
            'User-Agent': 'zemly-raise-hand-response',
        },
        body: buildSsml(reply),
    });

    if (!ttsRes.ok) {
        const errorBody = await ttsRes.text();
        console.error(`[raise-hand-response] Azure error ${ttsRes.status}:`, errorBody);
        throw new Error(`Azure TTS failed (${ttsRes.status})`);
    }

    return new Uint8Array(await ttsRes.arrayBuffer());
}

/**
 * Extract complete sentences from accumulated text starting at `cursor`.
 * Only returns sentences that are at least `minLength` chars — shorter
 * fragments are left to be merged with the next sentence automatically.
 */
function extractSentences(
    text: string,
    cursor: number,
    minLength = 25,
): { sentences: string[]; newCursor: number } {
    const sentences: string[] = [];
    let newCursor = cursor;
    const remaining = text.slice(cursor);

    // Sentence boundary: [.!?] followed by whitespace or end-of-string.
    const regex = /[.!?](?:\s|$)/g;
    let lastSplitPos = 0;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
        const sentenceEnd = match.index + 1; // include the punctuation
        const candidate = remaining.slice(lastSplitPos, sentenceEnd).trim();

        if (candidate.length >= minLength) {
            sentences.push(candidate);
            lastSplitPos = sentenceEnd;
            newCursor = cursor + sentenceEnd;
        }
    }

    return { sentences, newCursor };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    // ── Parse & validate (before we start streaming) ──
    let parsed: RaiseHandRequest;
    try {
        parsed = (await req.json()) as RaiseHandRequest;
    } catch {
        return new Response(
            JSON.stringify({ error: 'Invalid request body' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    const { noteContent, question, noteTitle, podcastScript, currentLineIndex, conversationHistory } = parsed;

    if (!question || !question.trim()) {
        return new Response(
            JSON.stringify({ error: 'A non-empty "question" value is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    const speechKey = Deno.env.get('AZURE_SPEECH_KEY');
    const speechRegion = Deno.env.get('AZURE_SPEECH_REGION') || 'southafricanorth';

    if (!speechKey) {
        return new Response(
            JSON.stringify({ error: 'Azure Speech key is not configured on the server' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    // ── Build prompt ──
    const context = truncateNote(noteContent || '', 12000).trim();
    const podcastWindow = buildPodcastWindow(podcastScript, currentLineIndex);
    const history = buildConversationHistory(conversationHistory);
    const prompt = `You are currently in a LIVE podcast Q&A moment. The student interrupted the podcast with a question.

Rules:
    - Answer the user's question directly in the first sentence.
    - Do NOT start with greetings such as "Hey" or "Hello".
    - Sound like a voice assistant, not an essay.
    - give a very shot response to affirmations ex (OK, thank you, i understand, got it, thats right etc)
- Keep answers conversational and complete.
- Default to 3-5 short sentences(could be shorter at your own will depending on the question asked).
- If the user asks for an overview, summary, explanation, or "give me the idea", give 6-10 short sentences.
- Include key points and one concrete example when relevant.
    - Ground your answer in the current podcast topic first.
    - If the question is unrelated to the podcast/note, say that briefly and still help.
    - No markdown and no bullet points.
    - Speak directly to the student.

    PODCAST TITLE:
    ${noteTitle || '(untitled)'}

    CURRENT PODCAST WINDOW:
    ${podcastWindow || '(not available)'}

    RECENT VOICE HISTORY:
    ${history || '(none)'}

    NOTE CONTEXT:
    ${context || '(none)'}

    QUESTION:
    ${question.trim()}`;

    // ── Create SSE response stream ──
    const textEncoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const sendEvent = async (event: string, data: Record<string, unknown>) => {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(textEncoder.encode(msg));
    };

    // ── Async pipeline (fire-and-forget) ──
    (async () => {
        const ttsJobs: Array<Promise<Uint8Array>> = [];
        let geminiDone = false;
        let fullText = '';

        // Concurrent TTS drain loop — awaits TTS promises in order
        // and sends audio events as soon as each completes.
        let ttsDrainIndex = 0;
        const drainPromise = (async () => {
            while (true) {
                if (ttsDrainIndex < ttsJobs.length) {
                    try {
                        const audioBytes = await ttsJobs[ttsDrainIndex];
                        await sendEvent('audio', { audio: base64Encode(audioBytes) });
                    } catch (err) {
                        console.error('[raise-hand-response] TTS chunk failed:', err);
                    }
                    ttsDrainIndex++;
                } else if (geminiDone) {
                    break;
                } else {
                    await new Promise((r) => setTimeout(r, 25));
                }
            }
        })();

        try {
            // Start streaming from Gemini
            const geminiRes = await streamGemini(
                [{ role: 'user', parts: [{ text: prompt }] }],
                {
                    systemInstruction: 'You are Zemly Voice Mode: quick, grounded, conversational, and context-aware to the ongoing podcast.',
                    temperature: 0.3,
                    maxOutputTokens: 350,
                },
            );

            const reader = geminiRes.body!.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';
            let ttsCursor = 0;

            // Read Gemini SSE token stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const chunk = JSON.parse(jsonStr);
                        const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            fullText += text;

                            // Check for complete sentences in accumulated text
                            const { sentences, newCursor } = extractSentences(fullText, ttsCursor);
                            for (const sentence of sentences) {
                                await sendEvent('text', { text: sentence });
                                ttsJobs.push(synthesizeReplyAudio(sentence, speechKey!, speechRegion));
                            }
                            ttsCursor = newCursor;
                        }
                    } catch { /* skip Gemini SSE parse errors */ }
                }
            }

            // Flush any remaining text that didn't end at a sentence boundary
            const remainder = fullText.slice(ttsCursor).trim();
            if (remainder) {
                await sendEvent('text', { text: remainder });
                ttsJobs.push(synthesizeReplyAudio(remainder, speechKey!, speechRegion));
            }

            if (!fullText.trim()) {
                throw new Error('Gemini returned an empty response');
            }

            // Wait for all TTS to drain, then send done
            geminiDone = true;
            await drainPromise;
            await sendEvent('done', { reply: fullText.trim() });
        } catch (err) {
            // Ensure the drain loop can exit
            geminiDone = true;
            try { await drainPromise; } catch { /* ignore */ }

            const error = err as Error;
            console.error('[raise-hand-response] Stream error:', error);
            try {
                await sendEvent('error', { error: toUserFacingError(error.message || 'Internal server error') });
            } catch { /* writer may already be closed */ }
        } finally {
            try { await writer.close(); } catch { /* ignore */ }
        }
    })();

    return new Response(readable, {
        headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
        },
    });
});
