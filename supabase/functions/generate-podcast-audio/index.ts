// supabase/functions/generate-podcast-audio/index.ts
// Converts a podcast script into audio using Azure Speech Service (TTS)
// Uses sequential batched synthesis to stay within Supabase timeout limits

import { serveWithCors } from '../_shared/server.ts';
import { requireAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

interface PodcastLine {
    speaker: string;
    text: string;
}

interface AudioRequest {
    script: PodcastLine[];
}

const VOICE_MAP: Record<string, string> = {
    Anna: 'en-US-AvaMultilingualNeural',
    Micheal: 'en-US-AdamMultilingualNeural',
};

/**
 * Larger batches = fewer Azure round-trips = faster overall.
 * Azure handles large SSML documents well, so 20 lines per call is safe.
 */
const BATCH_SIZE = 20;

/** Hard cap on script length to stay within Supabase's wall clock limit */
const MAX_LINES = 40;

/**
 * Escape special XML characters in text for SSML.
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Build an SSML document from a batch of podcast lines.
 */
function buildSsml(lines: PodcastLine[]): string {
    const voiceBlocks = lines.map((line) => {
        const voiceName = VOICE_MAP[line.speaker] || VOICE_MAP.Anna;
        const escapedText = escapeXml(line.text);
        return `    <voice name="${voiceName}">\n      <prosody rate="1.05">${escapedText}</prosody>\n      <break time="600ms"/>\n    </voice>`;
    });

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">\n${voiceBlocks.join('\n')}\n</speak>`;
}

/**
 * Synthesize a single batch of lines into an MP3 audio buffer.
 */
async function synthesizeBatch(
    lines: PodcastLine[],
    speechKey: string,
    speechRegion: string,
): Promise<Uint8Array> {
    const ssml = buildSsml(lines);
    const ttsEndpoint = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const ttsRes = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': speechKey,
            'Content-Type': 'application/ssml+xml',
            // Use a lighter MP3 format for faster synthesis and smaller payload
            'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
            'User-Agent': 'zemly-podcast',
        },
        body: ssml,
    });

    if (!ttsRes.ok) {
        const errorBody = await ttsRes.text();
        console.error(`[batch-tts] Azure error ${ttsRes.status}:`, errorBody);
        throw new Error(`Azure TTS failed (${ttsRes.status})`);
    }

    return new Uint8Array(await ttsRes.arrayBuffer());
}

/**
 * Split an array into chunks of the given size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

serveWithCors(async (req: Request) => {
    
    const { user, unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    const rateLimitExceeded = await checkRateLimit(user!.id, 'generate-podcast-audio', req);
    if (rateLimitExceeded) return rateLimitExceeded;

    try {
        const { script } = (await req.json()) as AudioRequest;

        if (!script || !Array.isArray(script) || script.length === 0) {
            return new Response(
                JSON.stringify({ error: 'A non-empty "script" array is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const speechKey = Deno.env.get('AZURE_SPEECH_KEY');
        const speechRegion = Deno.env.get('AZURE_SPEECH_REGION') || 'southafricanorth';

        if (!speechKey) {
            return new Response(
                JSON.stringify({ error: 'Azure Speech key is not configured on the server' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const trimmedScript = script.slice(0, MAX_LINES);
        const batches = chunk(trimmedScript, BATCH_SIZE);
        console.log(`[generate-podcast-audio] Synthesising ${trimmedScript.length} lines in ${batches.length} sequential batches`);

        // Process batches sequentially to avoid Azure rate-limiting.
        // With BATCH_SIZE=20 and MAX_LINES=40, this is only 2 Azure calls.
        const audioChunks: Uint8Array[] = [];
        for (let idx = 0; idx < batches.length; idx++) {
            const batch = batches[idx];
            console.log(`[generate-podcast-audio] Batch ${idx + 1}/${batches.length} (${batch.length} lines)`);
            const audioData = await synthesizeBatch(batch, speechKey, speechRegion);
            audioChunks.push(audioData);
        }

        // Concatenate all MP3 buffers (MP3 is frame-based, simple concat works)
        const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const audioChunk of audioChunks) {
            combined.set(audioChunk, offset);
            offset += audioChunk.length;
        }

        console.log(`[generate-podcast-audio] Audio generated: ${combined.length} bytes (${batches.length} batches)`);

        // Return binary MP3 directly instead of base64 JSON — much faster and ~33% smaller
        return new Response(combined, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': String(combined.length),
                'X-Line-Count': String(trimmedScript.length),
            },
        });
    } catch (err) {
        const error = err as Error;
        console.error('[generate-podcast-audio] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
