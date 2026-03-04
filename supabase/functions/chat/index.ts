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

        if (!noteContent && (!messages || messages.length === 0)) {
            return new Response(
                JSON.stringify({ error: 'noteContent is required for the first message' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // Only keep last 6 messages to save input tokens
        const recentMessages = (messages || []).slice(-6);
        const geminiMessages = recentMessages.map((m) => ({
            role: m.role as 'user' | 'model',
            parts: [{ text: m.content }],
        }));

        // On the first message, include the note and give a detailed answer.
        // On follow-ups, use a lighter prompt and shorter output.
        const isFirstMessage = !!noteContent;

        const systemInstruction = isFirstMessage
            ? `You are Zemly AI, a helpful and thorough study assistant. The student's note is provided below as context.\n\nWhen answering for the first time, give a detailed and well-structured explanation with examples where relevant. Use bullet points or numbered lists to organize your response clearly.\n\n${truncateNote(noteContent)}`
            : `You are Zemly AI, a concise study assistant. Continue helping based on the conversation so far. Keep follow-up answers brief and to the point.`;

        const { text } = await callGemini(geminiMessages, {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: isFirstMessage ? 1024 : 512,
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
