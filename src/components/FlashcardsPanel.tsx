import { useState, useEffect, useCallback } from 'react';
import { MdAutoAwesome } from 'react-icons/md';
import type { FlashcardCard, FlashcardStatus } from '../types';
import type { Flashcard } from '../lib/aiService';
import { generateFlashcards } from '../lib/aiService';
import {
    saveFlashcardSet,
    getLatestFlashcardSet,
    getFlashcards,
    updateFlashcardStatus,
    resetFlashcardProgress,
    deleteFlashcard,
    updateFlashcardContent,
} from '../lib/flashcardsService';
import FlashcardsOverview from './FlashcardsOverview';
import FlashcardsStudy from './FlashcardsStudy';

/* ── Sub-view types ── */
type FlashcardsView = 'generate' | 'overview' | 'study';

interface FlashcardsPanelProps {
    noteId: number;
    getNoteText: () => string;
}

const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({ noteId, getNoteText }) => {
    const [view, setView] = useState<FlashcardsView>('generate');
    const [cards, setCards] = useState<FlashcardCard[]>([]);
    const [setId, setSetId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* ── Load existing flashcards for this note ── */
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setIsLoading(true);
                const existingSet = await getLatestFlashcardSet(noteId);
                if (existingSet && !cancelled) {
                    const existingCards = await getFlashcards(existingSet.id);
                    setSetId(existingSet.id);
                    setCards(existingCards);
                    setView('overview');
                }
            } catch (err) {
                console.error('Failed to load flashcards:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [noteId]);

/* ── Generate flashcards ── */
    const handleGenerate = useCallback(async () => {
        const text = getNoteText();
        if (!text.trim()) {
            setError('Your note is empty. Write some content first!');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            if (setId) {
                setError('Flashcards have already been generated for this note.');
                return;
            }

            // Generate via AI with backend-managed count (15-30)
            const generated: Flashcard[] = await generateFlashcards(text);

            // Create a brand new set
            const { set, cards: savedCards } = await saveFlashcardSet(
                noteId,
                generated.map((c) => ({ front: c.front, back: c.back })),
            );
            setSetId(set.id);
            setCards(savedCards);

            setView('overview');
        } catch (err) {
            console.error('Flashcard generation failed:', err);
            setError(
                err instanceof Error ? err.message : 'Failed to generate flashcards. Please try again.',
            );
        } finally {
            setIsGenerating(false);
        }
    }, [getNoteText, noteId, setId]);

    /* ── Handle Know / Don't Know ── */
    const handleCardUpdate = useCallback(
        async (cardId: number, status: FlashcardStatus, knowCount: number) => {
            // Optimistic update
            setCards((prev) =>
                prev.map((c) =>
                    c.id === cardId ? { ...c, status, know_count: knowCount } : c,
                ),
            );

            try {
                await updateFlashcardStatus(cardId, status, knowCount);
            } catch (err) {
                console.error('Failed to update card:', err);
                // Revert on error — refetch
                if (setId) {
                    const fresh = await getFlashcards(setId);
                    setCards(fresh);
                }
            }
        },
        [setId],
    );

    /* ── Reset progress ── */
    const handleReset = useCallback(async () => {
        if (!setId) return;
        try {
            await resetFlashcardProgress(setId);
            const fresh = await getFlashcards(setId);
            setCards(fresh);
        } catch (err) {
            console.error('Failed to reset progress:', err);
        }
    }, [setId]);

    /* ── Delete a single card ── */
    const handleDeleteCard = useCallback(async (cardId: number) => {
        // Optimistic remove
        setCards((prev) => {
            const updated = prev.filter((c) => c.id !== cardId);
            // If we deleted the last card, go back to generate view
            if (updated.length === 0) setView('generate');
            return updated;
        });

        try {
            await deleteFlashcard(cardId);
        } catch (err) {
            console.error('Failed to delete card:', err);
            // Revert on error
            if (setId) {
                const fresh = await getFlashcards(setId);
                setCards(fresh);
                if (fresh.length > 0) setView('overview');
            }
        }
    }, [setId]);

    /* ── Edit a single card's content ── */
    const handleEditCard = useCallback(async (cardId: number, front: string, back: string) => {
        // Optimistic update
        setCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, front, back } : c)),
        );

        try {
            await updateFlashcardContent(cardId, front, back);
        } catch (err) {
            console.error('Failed to update card:', err);
            // Revert on error
            if (setId) {
                const fresh = await getFlashcards(setId);
                setCards(fresh);
            }
        }
    }, [setId]);

    /* ── Loading state ── */
    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
            </div>
        );
    }

    /* ── Study view ── */
    if (view === 'study') {
        return (
            <FlashcardsStudy
                cards={cards}
                onBack={() => setView('overview')}
                onCardUpdate={handleCardUpdate}
                onReset={handleReset}
                onExit={() => setView('overview')}
            />
        );
    }

    /* ── Overview view ── */
    if (view === 'overview' && cards.length > 0) {
        return (
            <FlashcardsOverview
                cards={cards}
                onStartStudying={() => setView('study')}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
            />
        );
    }

    /* ── Generate view (default) ── */
    return (
        <div className="mx-auto w-full max-w-4xl px-8 py-12 lg:px-16">
            {/* ── Header ── */}
            <div className="mb-10 text-center">
                <h2 className="mb-3 text-3xl font-bold text-zinc-100">
                    <span className="flashcards-sparkle mr-1">✨</span>
                    Generate Flashcards
                    <span className="flashcards-sparkle ml-1">✨</span>
                </h2>
                <p className="text-[15px] text-zinc-400">
                    One-time generation based on note length (15-30 flashcards)
                </p>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[14px] text-red-400">
                    {error}
                </div>
            )}

            {/* ── Generate Button ── */}
            <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flashcards-generate-btn group relative flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-[15px] font-bold text-white shadow-xl shadow-indigo-500/20 transition-all duration-300 hover:shadow-indigo-500/35 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
            >
                {isGenerating ? (
                    <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Generating Flashcards...</span>
                    </>
                ) : (
                    <>
                        <MdAutoAwesome className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                        <span>Generate Flashcards</span>
                    </>
                )}

                {!isGenerating && (
                    <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
                )}
            </button>

        </div>
    );
};

export default FlashcardsPanel;
