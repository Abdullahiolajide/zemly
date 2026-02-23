// src/lib/aiService.ts
// Frontend wrapper to invoke Supabase Edge Functions for AI features

import { supabase } from './supabaseClient';

/* ── Types ── */

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export interface Flashcard {
    front: string;
    back: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface PodcastLine {
    speaker: string;
    text: string;
}

/* ── API calls ── */

/**
 * Extract a meaningful error message from a Supabase Edge Function error.
 * The Supabase client returns a generic "Edge Function returned a non-2xx status code"
 * in `error.message`, but the actual error body is inside `error.context` (a Response).
 */
async function extractErrorMessage(
    error: { message?: string; context?: unknown },
    fallback: string,
): Promise<string> {
    try {
        const ctx = error.context;
        if (ctx && typeof (ctx as Response).json === 'function') {
            const body = await (ctx as Response).json();
            if (body?.error) return body.error;
        }
    } catch { /* ignore parse failures */ }
    return error.message || fallback;
}

/**
 * Chat with the AI about a note's content.
 * Maintains conversation history via the `messages` array.
 */
export async function chatWithNote(
    noteContent: string,
    messages: ChatMessage[],
): Promise<string> {
    const { data, error } = await supabase.functions.invoke('chat', {
        body: { noteContent, messages },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Chat request failed'));
    return data.reply;
}

/**
 * Generate study flashcards from note content.
 */
export async function generateFlashcards(
    noteContent: string,
    count = 10,
): Promise<Flashcard[]> {
    const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: { noteContent, count },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Flashcard generation failed'));
    return data.flashcards;
}

/**
 * Generate a multiple-choice quiz from note content.
 * The model decides how many questions to create (capped at 20).
 */
export async function generateQuiz(
    noteContent: string,
): Promise<QuizQuestion[]> {
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { noteContent },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Quiz generation failed'));
    return data.questions;
}

/**
 * Generate an explanation for why the correct answer is correct.
 * Called on-demand when the user clicks "Correct Answer Explained".
 */
export async function generateQuizExplanation(
    question: string,
    options: string[],
    correctIndex: number,
    noteContent: string,
): Promise<string> {
    const { data, error } = await supabase.functions.invoke('chat', {
        body: {
            noteContent,
            messages: [
                {
                    role: 'user',
                    content: `Explain why the correct answer to this quiz question is correct. Be concise (2-3 sentences max).

Question: ${question}
Options: ${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}
Correct answer: ${options[correctIndex]}

Explain why "${options[correctIndex]}" is correct.`,
                },
            ],
        },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Failed to generate explanation'));
    return data.reply;
}

/**
 * Generate a podcast-style conversational script from note content.
 */
export async function generatePodcast(
    noteContent: string,
): Promise<PodcastLine[]> {
    const { data, error } = await supabase.functions.invoke('generate-podcast', {
        body: { noteContent },
    });

    if (error) throw new Error(await extractErrorMessage(error, 'Podcast generation failed'));
    return data.script;
}
