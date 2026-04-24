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

    const handleGenerate = useCallback(async () => {
        const text = getNoteText();
        if (!text.trim()) { setError('Your note is empty. Write some content first!'); return; }
        setIsGenerating(true);
        setError(null);
        try {
            if (setId) { setError('Flashcards have already been generated for this note.'); return; }
            const generated: Flashcard[] = await generateFlashcards(text);
            const { set, cards: savedCards } = await saveFlashcardSet(noteId, generated.map((c) => ({ front: c.front, back: c.back })));
            setSetId(set.id);
            setCards(savedCards);
            setView('overview');
        } catch (err) {
            console.error('Flashcard generation failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate flashcards. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    }, [getNoteText, noteId, setId]);

    const handleCardUpdate = useCallback(async (cardId: number, status: FlashcardStatus, knowCount: number) => {
        setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, status, know_count: knowCount } : c));
        try { await updateFlashcardStatus(cardId, status, knowCount); }
        catch (err) {
            console.error('Failed to update card:', err);
            if (setId) { const fresh = await getFlashcards(setId); setCards(fresh); }
        }
    }, [setId]);

    const handleReset = useCallback(async () => {
        if (!setId) return;
        try { await resetFlashcardProgress(setId); const fresh = await getFlashcards(setId); setCards(fresh); }
        catch (err) { console.error('Failed to reset progress:', err); }
    }, [setId]);

    const handleDeleteCard = useCallback(async (cardId: number) => {
        setCards((prev) => {
            const updated = prev.filter((c) => c.id !== cardId);
            if (updated.length === 0) setView('generate');
            return updated;
        });
        try { await deleteFlashcard(cardId); }
        catch (err) {
            console.error('Failed to delete card:', err);
            if (setId) { const fresh = await getFlashcards(setId); setCards(fresh); if (fresh.length > 0) setView('overview'); }
        }
    }, [setId]);

    const handleEditCard = useCallback(async (cardId: number, front: string, back: string) => {
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, front, back } : c)));
        try { await updateFlashcardContent(cardId, front, back); }
        catch (err) {
            console.error('Failed to update card:', err);
            if (setId) { const fresh = await getFlashcards(setId); setCards(fresh); }
        }
    }, [setId]);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div
                    className="h-8 w-8 animate-spin rounded-full border-2"
                    style={{ borderColor: 'var(--border-glass-strong)', borderTopColor: 'var(--brand-emerald)' }}
                />
            </div>
        );
    }

    if (view === 'study') {
        return <FlashcardsStudy cards={cards} onBack={() => setView('overview')} onCardUpdate={handleCardUpdate} onReset={handleReset} onExit={() => setView('overview')} />;
    }

    if (view === 'overview' && cards.length > 0) {
        return <FlashcardsOverview cards={cards} onStartStudying={() => setView('study')} onDeleteCard={handleDeleteCard} onEditCard={handleEditCard} />;
    }

    /* Generate view (default) */
    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-12 lg:px-16">
            <div className="mb-8 text-center sm:mb-10">
                <h2
                    className="mb-2 text-2xl font-bold text-zinc-100 sm:mb-3 sm:text-3xl"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                >
                    <span className="flashcards-sparkle mr-1">✨</span>
                    Generate Flashcards
                    <span className="flashcards-sparkle ml-1">✨</span>
                </h2>
                <p className="text-[13px] text-zinc-500 sm:text-[15px]">Master the concepts in your notes with flashcards</p>
            </div>

            {error && (
                <div className="mb-6 rounded-xl px-4 py-3 text-[14px] text-red-400" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>
                    {error}
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flashcards-generate-btn btn-emerald group relative flex w-full items-center justify-center gap-2.5 py-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isGenerating ? (
                    <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--text-on-brand)' }} />
                        <span>Generating Flashcards...</span>
                    </>
                ) : (
                    <>
                        <MdAutoAwesome className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                        <span>Generate Flashcards</span>
                    </>
                )}
            </button>
        </div>
    );
};

export default FlashcardsPanel;
