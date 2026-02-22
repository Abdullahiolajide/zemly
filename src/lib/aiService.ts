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

    if (error) throw new Error(error.message || 'Chat request failed');
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

    if (error) throw new Error(error.message || 'Flashcard generation failed');
    return data.flashcards;
}

/**
 * Generate a multiple-choice quiz from note content.
 */
export async function generateQuiz(
    noteContent: string,
    count = 5,
): Promise<QuizQuestion[]> {
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { noteContent, count },
    });

    if (error) throw new Error(error.message || 'Quiz generation failed');
    return data.questions;
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

    if (error) throw new Error(error.message || 'Podcast generation failed');
    return data.script;
}
