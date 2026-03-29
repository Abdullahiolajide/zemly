// supabase/functions/chat/index.ts
// Chat Bot — optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callGemini, truncateNote } from '../_shared/gemini.ts';

interface ChatRequest {
    noteContent: string;
    messages: { role: 'user' | 'model'; content: string }[];
    memory?: string;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    try {
        const { noteContent, messages, memory } = (await req.json()) as ChatRequest;

        if (!noteContent && !memory && (!messages || messages.length === 0)) {
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

        // First message can carry full note content. Follow-ups should use compact memory.
        const hasNoteContext = !!noteContent?.trim();
        const hasMemory = !!memory?.trim();
        const isFirstMessage = recentMessages.length <= 1;

        const contextBlock = hasNoteContext && hasMemory
            ? `\n\nCOMPACT NOTE MEMORY:\n${memory}\n\nRELEVANT NOTE SNIPPET:\n${truncateNote(noteContent, 2500)}`
            : hasNoteContext
                ? `\n\nNOTE CONTEXT:\n${truncateNote(noteContent)}`
                : hasMemory
                    ? `\n\nCOMPACT NOTE MEMORY:\n${memory}`
                    : '';

        const systemInstruction = isFirstMessage
            ? `You are Zemly AI, a concise study assistant. The student's note is provided below as context.\n\nAnswer in plain text only. No markdown, no headings, no bullet points, no bold formatting. Keep it short and direct (about 3-6 sentences), but still accurate and helpful.${contextBlock}`
            : `You are Zemly AI, a concise study assistant. Continue helping based on the conversation so far.\n\nAnswer in plain text only. No markdown, no headings, no bullet points, no bold formatting. Keep follow-up answers short and direct (about 2-5 sentences). Always ground answers in the provided note context when available.${contextBlock}`;

        const { text } = await callGemini(geminiMessages, {
            systemInstruction,
            temperature: 0.4,
            maxOutputTokens: isFirstMessage ? 320 : 220,
        });

        let nextMemory = hasMemory ? memory : '';
        if (hasNoteContext && !hasMemory) {
            const memoryPrompt = `Create a compact study memory from the note for multi-turn chat.
Rules:
- Keep only key facts, definitions, formulas, names, dates, and section-level points.
- Preserve crucial details that are easy to lose in summaries.
- Max 2000 characters.
- Plain text only, no markdown code fences.

NOTE:
${truncateNote(noteContent)}`;

            const { text: memoryText } = await callGemini([
                { role: 'user', parts: [{ text: memoryPrompt }] },
            ], {
                systemInstruction: 'You compress large study notes into accurate compact memory for later Q&A turns.',
                temperature: 0.2,
                maxOutputTokens: 700,
            });

            nextMemory = memoryText.trim().slice(0, 2000);
        }

        return new Response(
            JSON.stringify({ reply: text, memory: nextMemory }),
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
