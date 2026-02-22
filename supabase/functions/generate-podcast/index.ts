// supabase/functions/generate-podcast/index.ts
// Podcast Script Generator — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { promptGemini, truncateNote } from '../_shared/gemini.ts';

interface PodcastRequest {
    noteContent: string;
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

        const note = truncateNote(noteContent, 4000); // Smaller limit for podcast since output is longer

        const prompt = `Create a short podcast script (5-8 exchanges) between Alex (curious) and Sam (knowledgeable) about this note.
Return ONLY JSON: {"script":[{"speaker":"Alex","text":"..."},{"speaker":"Sam","text":"..."}]}

${note}`;

        const raw = await promptGemini(prompt, {
            temperature: 0.8,
            maxOutputTokens: 1536,
        });

        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return new Response(
            JSON.stringify(parsed),
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
