// supabase/functions/generate-quiz/index.ts
// Quiz Generator — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { promptGemini, truncateNote } from '../_shared/gemini.ts';

interface QuizRequest {
    noteContent: string;
    count?: number;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { noteContent, count = 5 } = (await req.json()) as QuizRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const safeCount = Math.min(count, 10);
        const note = truncateNote(noteContent);

        const prompt = `Generate ${safeCount} multiple-choice questions from this note. Each has 4 options, correctIndex (0-based), and a short explanation.
Return ONLY JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]}

${note}`;

        const raw = await promptGemini(prompt, {
            temperature: 0.5,
            maxOutputTokens: safeCount <= 5 ? 1024 : 2048,
        });

        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

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
