// supabase/functions/generate-flashcards/index.ts
// Flashcard Generator — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { promptGemini, truncateNote } from '../_shared/gemini.ts';

interface FlashcardsRequest {
    noteContent: string;
}

function getFlashcardCount(noteContent: string): number {
    const length = noteContent.trim().length;
    if (length <= 800) return 15;
    if (length >= 40000) return 50; // 30 pages
    const ratio = (length - 800) / (40000 - 800);
    return Math.round(15 + ratio * 35);
}

function parseFlashcards(raw: string): unknown[] {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.flashcards)) return [];
    return parsed.flashcards;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { noteContent } = (await req.json()) as FlashcardsRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        const safeCount = getFlashcardCount(noteContent);
        const note = truncateNote(noteContent);

        const prompt = `Generate exactly ${safeCount} flashcards from this note. Each has "front" (question/term) and "back" (short answer).
        Return ONLY JSON: {"flashcards":[{"front":"...","back":"..."}]}

        ${note}`;

        const raw = await promptGemini(prompt, {
            temperature: 0.5,
            maxOutputTokens: 6144,
        });

        let flashcards = parseFlashcards(raw);

        // Retry once if model under-returns. Do not deduplicate in backend.
        if (flashcards.length < 15) {
            const retryPrompt = `Generate exactly ${safeCount} flashcards from this note.
RULES:
- Exactly ${safeCount} flashcards.
- Each flashcard has "front" and "back".
- Return ONLY valid JSON as {"flashcards":[...]} with no markdown.

NOTE:
${note}`;

            const retryRaw = await promptGemini(retryPrompt, {
                temperature: 0.4,
                maxOutputTokens: 6144,
            });
            flashcards = parseFlashcards(retryRaw);
        }

        if (flashcards.length < 15) {
            throw new Error('Flashcard generation returned too few cards. Please try again.');
        }

        if (flashcards.length > 30) {
            flashcards = flashcards.slice(0, 30);
        }

        return new Response(
            JSON.stringify({ flashcards }),
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
