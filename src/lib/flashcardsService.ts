// src/lib/flashcardsService.ts
// CRUD operations for flashcard sets and progress tracking

import { supabase } from './supabaseClient';
import type { FlashcardSet, FlashcardCard, FlashcardStatus } from '../types';

/**
 * Create a new flashcard set and insert all cards.
 * Returns the created set with its cards.
 */
export async function saveFlashcardSet(
    noteId: number,
    cards: { front: string; back: string }[],
): Promise<{ set: FlashcardSet; cards: FlashcardCard[] }> {
    const existing = await getLatestFlashcardSet(noteId);
    if (existing) {
        throw new Error('Flashcards were already generated for this note.');
    }

    // 1. Create the set
    const { data: set, error: setError } = await supabase
        .from('flashcard_sets')
        .insert({ note_id: noteId })
        .select()
        .single();

    if (setError) throw setError;

    // 2. Insert all cards linked to the set
    const cardRows = cards.map((c) => ({
        set_id: (set as FlashcardSet).id,
        front: c.front,
        back: c.back,
    }));

    const { data: insertedCards, error: cardsError } = await supabase
        .from('flashcards')
        .insert(cardRows)
        .select();

    if (cardsError) throw cardsError;

    return {
        set: set as FlashcardSet,
        cards: (insertedCards ?? []) as FlashcardCard[],
    };
}

/**
 * Add new cards to an existing flashcard set.
 * Returns the newly inserted cards.
 */
export async function addCardsToSet(
    setId: number,
    cards: { front: string; back: string }[],
): Promise<FlashcardCard[]> {
    const cardRows = cards.map((c) => ({
        set_id: setId,
        front: c.front,
        back: c.back,
    }));

    const { data, error } = await supabase
        .from('flashcards')
        .insert(cardRows)
        .select();

    if (error) throw error;
    return (data ?? []) as FlashcardCard[];
}

/**
 * Fetch the most recent flashcard set for a note (if any).
 */
export async function getLatestFlashcardSet(
    noteId: number,
): Promise<FlashcardSet | null> {
    const { data, error } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data as FlashcardSet | null;
}

/**
 * Fetch all flashcard sets for a note.
 */
export async function getFlashcardSets(
    noteId: number,
): Promise<FlashcardSet[]> {
    const { data, error } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as FlashcardSet[];
}

/**
 * Fetch all cards in a flashcard set.
 */
export async function getFlashcards(
    setId: number,
): Promise<FlashcardCard[]> {
    const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('set_id', setId)
        .order('id', { ascending: true });

    if (error) throw error;
    return (data ?? []) as FlashcardCard[];
}

/**
 * Update a single flashcard's study progress.
 */
export async function updateFlashcardStatus(
    cardId: number,
    status: FlashcardStatus,
    knowCount: number,
): Promise<FlashcardCard> {
    const { data, error } = await supabase
        .from('flashcards')
        .update({ status, know_count: knowCount })
        .eq('id', cardId)
        .select()
        .single();

    if (error) throw error;
    return data as FlashcardCard;
}

/**
 * Reset all cards in a set back to 'new' with know_count = 0.
 */
export async function resetFlashcardProgress(
    setId: number,
): Promise<void> {
    const { error } = await supabase
        .from('flashcards')
        .update({ status: 'new' as FlashcardStatus, know_count: 0 })
        .eq('set_id', setId);

    if (error) throw error;
}

/**
 * Delete an entire flashcard set (cascade deletes its cards).
 */
export async function deleteFlashcardSet(
    setId: number,
): Promise<void> {
    const { error } = await supabase
        .from('flashcard_sets')
        .delete()
        .eq('id', setId);

    if (error) throw error;
}

/**
 * Delete a single flashcard by its id.
 */
export async function deleteFlashcard(
    cardId: number,
): Promise<void> {
    const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', cardId);

    if (error) throw error;
}

/**
 * Update the front and/or back content of a single flashcard.
 */
export async function updateFlashcardContent(
    cardId: number,
    front: string,
    back: string,
): Promise<void> {
    const { error } = await supabase
        .from('flashcards')
        .update({ front, back })
        .eq('id', cardId);

    if (error) throw error;
}
