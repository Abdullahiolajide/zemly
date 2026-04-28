// supabase/functions/generate-quiz/index.ts
// Quiz Generator — optimized for Gemini free tier

import { serveWithCors } from '../_shared/server.ts';
import { requireAuth } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { balanceMultiSourceNote, promptGemini } from '../_shared/gemini.ts';
import { sanitizeNoteForPrompt } from '../_shared/sanitize.ts';

interface QuizRequest {
    noteContent: string;
}

function parseQuestions(raw: string): unknown[] {
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed?.questions)) return [];
    return parsed.questions;
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
            if (depth === 0) return text.slice(start, i + 1);
        }
    }

    return null;
}

function parseQuestionsWithFallback(raw: string): unknown[] {
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
            if (Array.isArray(parsed?.questions)) return parsed.questions;
        } catch {
            // try next
        }
    }

    throw new Error('Model returned invalid JSON. Please try generating again.');
}

async function repairQuizPayload(raw: string): Promise<unknown[]> {
    const repairPrompt = `Convert the following output into strict valid JSON.

Rules:
- Return ONLY JSON.
- JSON shape must be: {"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0}]}
- Keep the same meaning as much as possible.
- Do not include markdown fences or explanation.

BROKEN OUTPUT:
${raw}`;

    const repaired = await promptGemini(repairPrompt, {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
    });

    return parseQuestionsWithFallback(repaired);
}

serveWithCors(async (req: Request) => {
    

    const { user, unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    const rateLimitExceeded = await checkRateLimit(user!.id, 'generate-quiz', req);
    if (rateLimitExceeded) return rateLimitExceeded;

    try {
        const { noteContent } = (await req.json()) as QuizRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const note = sanitizeNoteForPrompt(balanceMultiSourceNote(noteContent, 100000));

        const prompt = `You are a quiz generator. Read the note below and generate multiple-choice questions.

RULES:
- Handle content coverage: If the note has multiple SOURCE blocks, sample questions across all sources.
- Meaningful depth: Decide the number of high-quality questions you can generate depending on the note length, max - 100 questions
- Generate well though natural questons a way humans would ask them, not like a robot
- Do not stop early. Cover the entire note. and a bit of inbetweens
- Prioritize quality and coverage over quantity.
- Each question must have exactly 4 options.
- correctIndex is 0-based.
- Return ONLY valid JSON, no markdown fences.

Return format: {"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0}]}

NOTE:
${note}`;

        const raw = await promptGemini(prompt, {
        temperature: 0.5,
        maxOutputTokens: 16000,
        responseMimeType: 'application/json', // add this
    });

        let questions: unknown[];
        try {
            questions = parseQuestionsWithFallback(raw);
        } catch {
            questions = await repairQuizPayload(raw);
        }

        if (questions.length === 0) {
            throw new Error('Quiz generation returned no questions. Please try again.');
        }

        // Safety cap at 100
        if (questions.length > 100) {
            questions = questions.slice(0, 100);
        }

        return new Response(
            JSON.stringify({ questions }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('Quiz function error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
