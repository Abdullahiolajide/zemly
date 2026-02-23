// supabase/functions/generate-quiz/index.ts
// Quiz Generator — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { promptGemini, truncateNote } from '../_shared/gemini.ts';

interface QuizRequest {
    noteContent: string;
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

        const note = truncateNote(noteContent);

        const prompt = `You are a quiz generator. Read the note below and generate multiple-choice questions.

RULES:
- Decide the number of questions based on how much content there is (minimum 5, maximum 20).
- Each question must have exactly 4 options.
- correctIndex is 0-based.
- Do NOT include explanations — they will be generated separately on demand.
- Return ONLY valid JSON, no markdown fences.

Return format: {"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0}]}

NOTE:
${note}`;

        const raw = await promptGemini(prompt, {
            temperature: 0.5,
            maxOutputTokens: 4096,
        });

        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        // Safety cap at 20
        if (parsed.questions && parsed.questions.length > 20) {
            parsed.questions = parsed.questions.slice(0, 20);
        }

        return new Response(
            JSON.stringify(parsed),
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
