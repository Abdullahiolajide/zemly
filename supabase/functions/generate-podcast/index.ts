// supabase/functions/generate-podcast/index.ts
// Podcast Script Generator — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { balanceMultiSourceNote, promptGemini } from '../_shared/gemini.ts';

interface PodcastRequest {
    noteContent: string;
}

interface PodcastLine {
    speaker: string;
    text: string;
}

interface SourceSection {
    label: string;
    body: string;
}

function splitSourceSections(note: string): SourceSection[] {
    const chunks = note
        .split(/(?=^\s*SOURCE:\s*.*$)/gmi)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    if (chunks.length <= 1) {
        return [{ label: 'Combined Note', body: note.trim() }];
    }

    return chunks.map((chunk, idx) => {
        const lines = chunk.split('\n');
        const first = lines[0]?.trim() || '';
        const label = first.toLowerCase().startsWith('source:')
            ? first.replace(/^source:\s*/i, '').trim()
            : `Source ${idx + 1}`;
        const body = lines.slice(1).join('\n').trim();
        return {
            label: label || `Source ${idx + 1}`,
            body,
        };
    });
}

function buildCoveragePrompt(note: string): { prompt: string; minLines: number } {
    const sections = splitSourceSections(note);
    const sourceCount = Math.max(1, sections.length);
    const minLines = Math.min(28, Math.max(10, sourceCount * 4));

    const sourceDigest = sections
        .map((section, idx) => {
            const clipped = section.body.slice(0, 1400);
            return `SOURCE ${idx + 1}: ${section.label}\n${clipped}`;
        })
        .join('\n\n');

    const prompt = `Create a podcast script as a conversation between exactly two speakers:
- Hope: curious, asks sharp follow-up questions.
- Corey: knowledgeable, explains clearly with examples.

Rules:
- Write at least ${minLines} lines (turns), alternating naturally between Hope and Corey.
- Keep each line 1-3 sentences.
- Stay grounded in the provided note content.
- Cover ALL SOURCE sections below. No source should be ignored.
- Mention source-specific ideas across the script, not just in one line.
- Use speaker names exactly as "Hope" and "Corey".

Return ONLY JSON: {"script":[{"speaker":"Hope","text":"..."},{"speaker":"Corey","text":"..."}]}

SOURCE SNAPSHOT:
${sourceDigest}`;

    return { prompt, minLines };
}

function buildFallbackPodcastScript(note: string): PodcastLine[] {
    const cleanedNote = note
        .replace(/^SOURCE:\s*.*$/gmi, '')
        .replace(/^#+\s*/gmi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const sentences = cleanedNote
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 20)
        .slice(0, 8);

    const fallbackText = sentences.length > 0
        ? sentences
        : cleanedNote
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length >= 20)
            .slice(0, 8);

    const sourceLines = fallbackText.length > 0 ? fallbackText : [
        'This note covers the core ideas from the source material.',
        'It brings together the most important points for review.',
    ];

    const script: PodcastLine[] = [];
    for (let i = 0; i < Math.max(6, Math.min(8, sourceLines.length * 2)); i++) {
        const speaker = i % 2 === 0 ? 'Hope' : 'Corey';
        const sourceLine = sourceLines[i % sourceLines.length];

        script.push({
            speaker,
            text: speaker === 'Hope'
                ? `Can you break down this part: ${sourceLine}`
                : `Yes. The key idea here is ${sourceLine}`,
        });
    }

    return script;
}

function extractLikelyJsonObject(input: string): string | null {
    const text = input.trim();
    const start = text.indexOf('{');
    if (start < 0) return null;

    let inString = false;
    let escaped = false;
    let depth = 0;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === '{') {
            depth++;
            continue;
        }

        if (ch === '}') {
            depth--;
            if (depth === 0) {
                return text.slice(start, i + 1);
            }
        }
    }

    return null;
}

function parsePodcastPayload(raw: string): { script?: PodcastLine[] } {
    const candidates = [
        raw,
        raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim(),
    ];

    const extracted = extractLikelyJsonObject(raw);
    if (extracted) candidates.push(extracted);

    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            return JSON.parse(candidate);
        } catch {
            // Continue to next parse strategy.
        }
    }

    throw new Error('Model returned invalid JSON. Please try generating again.');
}

async function repairPodcastPayload(raw: string): Promise<{ script?: PodcastLine[] }> {
    const repairPrompt = `Convert the following podcast output into strict valid JSON.

Rules:
- Return ONLY JSON.
- The JSON shape must be: {"script":[{"speaker":"Hope","text":"..."},{"speaker":"Corey","text":"..."}]}
- Keep the same meaning as much as possible.
- Use exactly two speakers: Hope and Corey.
- Do not include markdown fences or explanation.

BROKEN OUTPUT:
${raw}`;

    const repaired = await promptGemini(repairPrompt, {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
    });

    return parsePodcastPayload(repaired);
}

function normalizeScript(script: PodcastLine[]): PodcastLine[] {
    const cleaned = script
        .filter((line) => typeof line?.text === 'string' && line.text.trim().length > 0)
        .map((line) => ({
            speaker: (line.speaker || '').trim(),
            text: line.text.trim(),
        }));

    if (cleaned.length === 0) return [];

    const seen = new Set<string>();
    const uniqueSpeakers: string[] = [];
    for (const line of cleaned) {
        const key = line.speaker.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniqueSpeakers.push(line.speaker);
        if (uniqueSpeakers.length === 2) break;
    }

    const primary = uniqueSpeakers[0] || 'Hope';
    const secondary = uniqueSpeakers[1] || 'Corey';

    let flip = false;
    return cleaned.map((line, idx) => {
        const speaker = line.speaker.toLowerCase();
        if (speaker === primary.toLowerCase() || speaker === 'hope') {
            flip = false;
            return { speaker: 'Hope', text: line.text };
        }
        if (speaker === secondary.toLowerCase() || speaker === 'corey') {
            flip = true;
            return { speaker: 'Corey', text: line.text };
        }

        // Fallback: alternate unknown speakers so the transcript remains a dialogue.
        flip = idx === 0 ? false : !flip;
        return { speaker: flip ? 'Corey' : 'Hope', text: line.text };
    });
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { noteContent } = (await req.json()) as PodcastRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const note = balanceMultiSourceNote(noteContent, 12000); // Keep all source blocks represented

        const { prompt, minLines } = buildCoveragePrompt(note);

        const raw = await promptGemini(prompt, {
            temperature: 0.8,
            maxOutputTokens: 3072,
            responseMimeType: 'application/json',
        });

        let parsed: { script?: PodcastLine[] };
        try {
            parsed = parsePodcastPayload(raw);
        } catch {
            try {
                parsed = await repairPodcastPayload(raw);
            } catch {
                parsed = { script: buildFallbackPodcastScript(note) };
            }
        }
        const normalized = normalizeScript(Array.isArray(parsed?.script) ? parsed.script : []);

        if (normalized.length < minLines) {
            const retryRaw = await promptGemini(
                `${prompt}\n\nIMPORTANT: Your previous output was too short. Return at least ${minLines} lines in script.`,
                {
                    temperature: 0.4,
                    maxOutputTokens: 3072,
                    responseMimeType: 'application/json',
                },
            );

            let retryParsed: { script?: PodcastLine[] };
            try {
                retryParsed = parsePodcastPayload(retryRaw);
            } catch {
                try {
                    retryParsed = await repairPodcastPayload(retryRaw);
                } catch {
                    retryParsed = { script: buildFallbackPodcastScript(note) };
                }
            }

            const retried = normalizeScript(Array.isArray(retryParsed?.script)
                ? retryParsed.script
                : []);

            if (retried.length >= minLines) {
                return new Response(
                    JSON.stringify({ script: retried }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
                );
            }
        }

        if (normalized.length < 2) {
            const fallback = buildFallbackPodcastScript(note);
            const fallbackNormalized = normalizeScript(fallback);

            if (fallbackNormalized.length < 2) {
                throw new Error('Podcast generation failed. Please try again.');
            }

            return new Response(
                JSON.stringify({ script: fallbackNormalized }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        return new Response(
            JSON.stringify({ script: normalized }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('Podcast function error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
