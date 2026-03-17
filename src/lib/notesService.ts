import { supabase } from './supabaseClient';
import type { Note } from '../types';

/**
 * Insert a blank note with the given title.
 * Returns the newly created note row.
 */
export async function createNote(title: string): Promise<Note> {
    const { data, error } = await supabase
        .from('notes')
        .insert({ title })
        .select()
        .single();

    if (error) throw error;
    return data as Note;
}

/**
 * Insert a document-sourced note.
 * Stores the public file URL, extracted plain text, and AI-generated content.
 */
export async function createDocumentNote(
    title: string,
    sourceUrl: string,
    extractedText: string,
    fileName: string,
    content: Record<string, unknown>,
): Promise<Note> {
    const { data, error } = await supabase
        .from('notes')
        .insert({
            title,
            source_type: 'document',
            source_url: sourceUrl,
            extracted_text: extractedText,
            file_name: fileName,
            content,
        })
        .select()
        .single();

    if (error) throw error;
    return data as Note;
}

/**
 * Fetch a single note by its id.
 */
export async function getNote(id: number): Promise<Note> {
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as Note;
}

/**
 * Fetch all notes for the current authenticated user, newest first.
 */
export async function getUserNotes(): Promise<Note[]> {
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Note[];
}

/**
 * Update a note's content (TipTap JSON) and optionally its title.
 */
export async function updateNote(
    id: number,
    updates: { title?: string; content?: Record<string, unknown> }
): Promise<Note> {
    const { data, error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data as Note;
}

/**
 * Delete a note by its id.
 */
export async function deleteNote(id: number): Promise<void> {
    const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
