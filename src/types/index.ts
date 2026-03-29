import type { Session } from '@supabase/supabase-js';

export interface User {
    id: string;
    email: string;
}

export interface Note {
    id: number;
    user_id: string;
    title: string;
    content: Record<string, unknown> | string | null;
    tags: string[] | null;
    created_at: string;
    updated_at?: string;
    source_type?: 'document' | 'audio' | 'link' | 'blank';
    /** Public URL of the uploaded file (PDF viewer) */
    source_url?: string | null;
    /** Plain text extracted from the uploaded document */
    extracted_text?: string | null;
    /** Original file name (e.g. lecture_notes.pdf) */
    file_name?: string | null;
}

export interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isInitialized: boolean;
    setUser: (user: User | null) => void;
    setSession: (session: Session | null) => void;
    setLoading: (isLoading: boolean) => void;
    setInitialized: (initialized: boolean) => void;
    logout: () => void;
}

export type FlashcardStatus = 'new' | 'learning' | 'mastered' | 'unfamiliar';

export interface FlashcardSet {
    id: number;
    note_id: number;
    user_id: string;
    created_at: string;
}

export interface FlashcardCard {
    id: number;
    set_id: number;
    front: string;
    back: string;
    status: FlashcardStatus;
    know_count: number;
    created_at: string;
}

/* ── Quiz types ── */

export type QuizStatus = 'new' | 'unfamiliar' | 'learning' | 'mastered';

export interface QuizSet {
    id: number;
    note_id: number;
    user_id: string;
    created_at: string;
}

export interface QuizQuestionRow {
    id: number;
    set_id: number;
    question: string;
    options: string[];
    correct_index: number;
    status: QuizStatus;
    know_count: number;
    created_at: string;
}
