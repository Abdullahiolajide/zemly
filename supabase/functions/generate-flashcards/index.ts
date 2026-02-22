// supabase/functions/generate-flashcards/index.ts
// Flashcard Generator — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { promptGemini, truncateNote } from '../_shared/gemini.ts';

interface FlashcardsRequest {
    noteContent: string;
    count?: number;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { noteContent, count = 10 } = (await req.json()) as FlashcardsRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // Cap count to avoid huge outputs on free tier
        const safeCount = Math.min(count, 20);
        const note = truncateNote(noteContent);

        const prompt = `Generate ${safeCount} flashcards from this note. Each has "front" (question/term) and "back" (short answer).
Return ONLY JSON: {"flashcards":[{"front":"...","back":"..."}]}

${note}`;

        const raw = await promptGemini(prompt, {
            temperature: 0.5,
            maxOutputTokens: safeCount <= 10 ? 1024 : 2048,
        });

        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return new Response(
            JSON.stringify(parsed),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('Flashcards function error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
