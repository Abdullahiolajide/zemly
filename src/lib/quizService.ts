// src/lib/quizService.ts
// CRUD operations for quiz sets and questions

import { supabase } from './supabaseClient';
import type { QuizSet, QuizQuestionRow, QuizStatus } from '../types';

/**
 * Create a new quiz set and insert all questions.
 */
export async function saveQuizSet(
    noteId: number,
    questions: { question: string; options: string[]; correctIndex: number }[],
): Promise<{ set: QuizSet; questions: QuizQuestionRow[] }> {
    // 1. Create the set
    const { data: set, error: setError } = await supabase
        .from('quiz_sets')
        .insert({ note_id: noteId })
        .select()
        .single();

    if (setError) throw setError;

    // 2. Insert all questions linked to the set
    const rows = questions.map((q) => ({
        set_id: (set as QuizSet).id,
        question: q.question,
        options: q.options,
        correct_index: q.correctIndex,
    }));

    const { data: inserted, error: qError } = await supabase
        .from('quiz_questions')
        .insert(rows)
        .select();

    if (qError) throw qError;

    return {
        set: set as QuizSet,
        questions: (inserted ?? []) as QuizQuestionRow[],
    };
}

/**
 * Fetch the most recent quiz set for a note.
 */
export async function getLatestQuizSet(
    noteId: number,
): Promise<QuizSet | null> {
    const { data, error } = await supabase
        .from('quiz_sets')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data as QuizSet | null;
}

/**
 * Fetch all questions in a quiz set.
 */
export async function getQuizQuestions(
    setId: number,
): Promise<QuizQuestionRow[]> {
    const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('set_id', setId)
        .order('id', { ascending: true });

    if (error) throw error;
    return (data ?? []) as QuizQuestionRow[];
}

/**
 * Update a single quiz question's study status.
 */
export async function updateQuizQuestionStatus(
    questionId: number,
    status: QuizStatus,
    knowCount: number,
): Promise<void> {
    const { error } = await supabase
        .from('quiz_questions')
        .update({ status, know_count: knowCount })
        .eq('id', questionId);

    if (error) throw error;
}

/**
 * Reset all questions in a set back to 'new'.
 */
export async function resetQuizProgress(
    setId: number,
): Promise<void> {
    const { error } = await supabase
        .from('quiz_questions')
        .update({ status: 'new' as QuizStatus, know_count: 0 })
        .eq('set_id', setId);

    if (error) throw error;
}

/**
 * Delete a quiz set (cascade deletes questions).
 */
export async function deleteQuizSet(
    setId: number,
): Promise<void> {
    const { error } = await supabase
        .from('quiz_sets')
        .delete()
        .eq('id', setId);

    if (error) throw error;
}
