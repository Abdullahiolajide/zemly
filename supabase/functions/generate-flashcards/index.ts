// supabase/functions/generate-flashcards/index.ts
// Flashcard Generator — optimized for Gemini free tier

import { serveWithCors } from '../_shared/server.ts';
import { requireAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { balanceMultiSourceNote, promptGemini } from '../_shared/gemini.ts';
import { sanitizeNoteForPrompt } from '../_shared/sanitize.ts';

interface FlashcardsRequest {
    noteContent: string;
}

interface Flashcard {
    front: string;
    back: string;
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

function normalizeFlashcards(flashcards: unknown[]): Flashcard[] {
    return flashcards
        .filter((card): card is Record<string, unknown> => !!card && typeof card === 'object')
        .map((card) => ({
            front: String(card.front ?? '').trim(),
            back: String(card.back ?? '').trim(),
        }))
        .filter((card) => card.front.length > 0 && card.back.length > 0);
}

function parseFlashcards(raw: string): Flashcard[] {
    const candidates = [
        raw,
        raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim(),
    ];

    const extracted = extractLikelyJsonObject(raw);
    if (extracted) candidates.push(extracted);

    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            const parsed = JSON.parse(candidate);
            if (!Array.isArray(parsed?.flashcards)) continue;
            return normalizeFlashcards(parsed.flashcards);
        } catch {
            // Try the next parse strategy.
        }
    }

    throw new Error('Model returned invalid JSON. Please try generating again.');
}

async function repairFlashcards(raw: string): Promise<Flashcard[]> {
    const repairPrompt = `Convert the following output into strict valid JSON.

Rules:
- Return ONLY JSON.
- JSON shape must be: {"flashcards":[{"front":"...","back":"..."}]}
- Keep the same meaning as much as possible.
- Do not include markdown fences or explanation.

BROKEN OUTPUT:
${raw}`;

    const repaired = await promptGemini(repairPrompt, {
        temperature: 0.1,
        maxOutputTokens: 6144,
        responseMimeType: 'application/json',
    });

    return parseFlashcards(repaired);
}

serveWithCors(async (req: Request) => {
    

    const { user, unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    const rateLimitExceeded = await checkRateLimit(user!.id, 'generate-flashcards', req);
    if (rateLimitExceeded) return rateLimitExceeded;

    try {
        const { noteContent } = (await req.json()) as FlashcardsRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const note = sanitizeNoteForPrompt(balanceMultiSourceNote(noteContent, 50000));

        const prompt = `Generate flashcards from this note. Each has "front" (question/term) and "back" (short answer).
        If the note contains multiple SOURCE blocks, cover all of them rather than focusing on only the first one.
        Meaningful depth: Decide the number of high-quality flashcards you can generate depending on the note length, max - 100 questions
        - Generate well though natural questons a way humans would ask them, not like a robot
        - Do not stop early. Cover the entire note.
        Return ONLY JSON: {"flashcards":[{"front":"...","back":"..."}]}

        ${note}`;

        const raw = await promptGemini(prompt, {
            temperature: 0.5,
            maxOutputTokens: 6144,
            responseMimeType: 'application/json',
        });

        let flashcards: Flashcard[] = [];
        try {
            flashcards = parseFlashcards(raw);
        } catch {
            flashcards = await repairFlashcards(raw);
        }

        if (flashcards.length === 0) {
            throw new Error('Flashcard generation returned no cards. Please try again.');
        }

        if (flashcards.length > 100) {
            flashcards = flashcards.slice(0, 100);
        }

        return new Response(
            JSON.stringify({ flashcards }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('Flashcards function error:', error);
        return new Response(
            JSON.stringify({ error: 'An error occurred. Please try again.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
