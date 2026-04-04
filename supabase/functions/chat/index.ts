// supabase/functions/chat/index.ts
// Chat Bot — streaming responses, optimized for Gemini free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { streamGemini, callGemini, truncateNote } from '../_shared/gemini.ts';

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

        // Use memory if available (follow-ups), otherwise note context (first message).
        // Never send both — memory already captures the note content.
        const contextBlock = hasMemory
            ? `\n\nCOMPACT NOTE MEMORY:\n${memory}`
            : hasNoteContext
                ? `\n\nNOTE CONTEXT:\n${truncateNote(noteContent)}`
                : '';

        const systemInstruction = isFirstMessage
            ? `You are Zemly AI, a concise study assistant. The student's note is provided below as context.

You can use **bold**, *italic*, bullet points, numbered lists, and headings to format your response clearly. Use markdown formatting to make your answer easier to scan and understand. Keep it concise but well-structured (about 3-6 main points or paragraphs).

When answering:
- Ground your response in the provided note when available
- You can supplement with your knowledge base for clarity and deeper understanding
- Use formatting to highlight key concepts, definitions, or important information
- Format lists and key points with bullets or numbers for readability${contextBlock}`
            : `You are Zemly AI, a concise study assistant. Continue helping based on the conversation so far.

You can use **bold**, *italic*, bullet points, numbered lists, and headings to format your response. Use markdown formatting strategically to improve clarity. Keep follow-up answers concise but well-formatted (about 2-5 main points or short paragraphs).

When answering:
- Ground your response in the provided note when available
- You can supplement with your knowledge base for fuller explanations
- Use formatting to highlight key concepts and make connections clear
- Format lists and definitions with bullets or numbers for better readability${contextBlock}`;

        // --- Stream the main reply ---
        const geminiRes = await streamGemini(geminiMessages, {
            systemInstruction,
            temperature: 0.5,
            maxOutputTokens: isFirstMessage ? 2000 : 1400,
        });

        const geminiBody = geminiRes.body;
        if (!geminiBody) {
            throw new Error('No response body from Gemini streaming endpoint');
        }

        // We'll collect the full reply text so we can generate memory afterward
        let fullReplyText = '';

        // Whether we should generate memory after streaming finishes
        const shouldGenerateMemory = hasNoteContext && !hasMemory && recentMessages.length > 1;

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const outputStream = new ReadableStream({
            async start(controller) {
                try {
                    const reader = geminiBody.getReader();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });

                        // Process complete SSE lines
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // keep incomplete line in buffer

                        for (const line of lines) {
                            if (!line.startsWith('data: ')) continue;
                            const jsonStr = line.slice(6).trim();
                            if (!jsonStr) continue;

                            try {
                                const parsed = JSON.parse(jsonStr);
                                const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (chunk) {
                                    fullReplyText += chunk;
                                    // Send as SSE text event
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                                }
                            } catch {
                                // skip unparseable lines
                            }
                        }
                    }

                    // Process any remaining buffer
                    if (buffer.startsWith('data: ')) {
                        const jsonStr = buffer.slice(6).trim();
                        if (jsonStr) {
                            try {
                                const parsed = JSON.parse(jsonStr);
                                const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (chunk) {
                                    fullReplyText += chunk;
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                                }
                            } catch { /* ignore */ }
                        }
                    }

                    // --- Generate memory (non-streaming, after reply is done) ---
                    let nextMemory = hasMemory ? memory! : '';

                    if (shouldGenerateMemory) {
                        try {
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
                        } catch (memErr) {
                            console.error('Memory generation failed (non-fatal):', memErr);
                        }
                    }

                    // Send memory event
                    controller.enqueue(
                        encoder.encode(`event: memory\ndata: ${JSON.stringify({ memory: nextMemory })}\n\n`),
                    );

                    // Signal stream end
                    controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
                    controller.close();
                } catch (err) {
                    console.error('Stream processing error:', err);
                    controller.enqueue(
                        encoder.encode(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`),
                    );
                    controller.close();
                }
            },
        });

        return new Response(outputStream, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err) {
        const error = err as Error;
        console.error('Chat function error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
