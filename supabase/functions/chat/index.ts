// supabase/functions/chat/index.ts
// Chat Bot — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callGemini, truncateNote } from '../_shared/gemini.ts';

interface ChatRequest {
    noteContent: string;
    messages: { role: 'user' | 'model'; content: string }[];
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { noteContent, messages } = (await req.json()) as ChatRequest;

        if (!noteContent) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // Only keep last 6 messages to save input tokens
        const recentMessages = (messages || []).slice(-6);
        const geminiMessages = recentMessages.map((m) => ({
            role: m.role as 'user' | 'model',
            parts: [{ text: m.content }],
        }));

        const note = truncateNote(noteContent);

        const systemInstruction = `You are Zemly AI, a concise study assistant. Use the note below as context. Keep answers brief.

${note}`;

        const { text } = await callGemini(geminiMessages, {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 512,
        });

        return new Response(
            JSON.stringify({ reply: text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('Chat function error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
