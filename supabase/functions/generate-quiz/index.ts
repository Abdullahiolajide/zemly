// supabase/functions/generate-quiz/index.ts
// Quiz Generator — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { balanceMultiSourceNote, promptGemini } from '../_shared/gemini.ts';

interface QuizRequest {
    noteContent: string;
}

function getQuizCount(noteContent: string): number {
    const length = noteContent.trim().length;
    if (length <= 800) return 15;
    if (length >= 40000) return 50; // 30 pages
    const ratio = (length - 800) / (40000 - 800);
    return Math.round(15 + ratio * 35);
}

function parseQuestions(raw: string): unknown[] {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.questions)) return [];
    return parsed.questions;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { noteContent } = (await req.json()) as QuizRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const safeCount = getQuizCount(noteContent);
        const note = balanceMultiSourceNote(noteContent, 16000);

        const prompt = `You are a quiz generator. Read the note below and generate multiple-choice questions.

RULES:
- Handle content coverage: If the note has multiple SOURCE blocks, sample questions across all sources.
- Meaningful depth: Decide the number of high-quality questions you can generate depending on the note length (not greater than ${safeCount + 5} and not less than ${safeCount - 5}).
- Each question must have exactly 4 options.
- correctIndex is 0-based.
- Return ONLY valid JSON, no markdown fences.

Return format: {"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0}]}

NOTE:
${note}`;

        const raw = await promptGemini(prompt, {
            temperature: 0.5,
            maxOutputTokens: 8192,
        });

        let questions = parseQuestions(raw);

        if (questions.length === 0) {
            throw new Error('Quiz generation returned no questions. Please try again.');
        }

        // Safety cap at 30
        if (questions.length > 30) {
            questions = questions.slice(0, 30);
        }

        return new Response(
            JSON.stringify({ questions }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('Quiz function error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
