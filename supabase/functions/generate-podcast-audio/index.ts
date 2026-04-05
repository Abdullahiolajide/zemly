// supabase/functions/generate-podcast-audio/index.ts
// Converts a podcast script into audio using Azure Speech Service (TTS)
// Uses batched parallel synthesis to avoid timeout on long scripts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

interface PodcastLine {
    speaker: string;
    text: string;
}

interface AudioRequest {
    script: PodcastLine[];
}

const VOICE_MAP: Record<string, string> = {
    Hope: 'en-US-AvaMultilingualNeural',
    Corey: 'en-US-AdamMultilingualNeural',
};

/** Max lines per TTS batch — keeps each Azure call fast */
const BATCH_SIZE = 8;

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
        const voiceName = VOICE_MAP[line.speaker] || VOICE_MAP.Hope;
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
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
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

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { script } = (await req.json()) as AudioRequest;

        if (!script || !Array.isArray(script) || script.length === 0) {
            return new Response(
                JSON.stringify({ error: 'A non-empty "script" array is required' }),
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

        // Cap at 60 lines max
        const trimmedScript = script.slice(0, 60);

        // Split into batches and synthesize in parallel
        const batches = chunk(trimmedScript, BATCH_SIZE);
        console.log(`[generate-podcast-audio] Synthesising ${trimmedScript.length} lines in ${batches.length} parallel batches`);

        const audioChunks = await Promise.all(
            batches.map((batch, idx) => {
                console.log(`[generate-podcast-audio] Starting batch ${idx + 1}/${batches.length} (${batch.length} lines)`);
                return synthesizeBatch(batch, speechKey, speechRegion);
            }),
        );

        // Concatenate all MP3 buffers (MP3 is frame-based, simple concat works)
        const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const audioChunk of audioChunks) {
            combined.set(audioChunk, offset);
            offset += audioChunk.length;
        }

        const audioBase64 = base64Encode(combined);
        console.log(`[generate-podcast-audio] Audio generated: ${combined.length} bytes (${batches.length} batches)`);

        return new Response(
            JSON.stringify({
                audio: audioBase64,
                mimeType: 'audio/mpeg',
                lineCount: trimmedScript.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('[generate-podcast-audio] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
