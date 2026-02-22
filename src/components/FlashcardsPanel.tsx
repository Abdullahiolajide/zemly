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
    deleteFlashcardSet,
} from '../lib/flashcardsService';
import FlashcardsOverview from './FlashcardsOverview';
import FlashcardsStudy from './FlashcardsStudy';

/* ── Sub-view types ── */
type FlashcardsView = 'generate' | 'overview' | 'study';

/* ── Count options for generation ── */
const countOptions = [
    { value: 5, label: 'Quick review' },
    { value: 10, label: 'Standard set' },
    { value: 15, label: 'Comprehensive' },
    { value: 20, label: 'Deep dive' },
];

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

    /* ── Generation form state ── */
    const [selectedCount, setSelectedCount] = useState(10);
    const [instructions, setInstructions] = useState('');

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
            const noteText = instructions
                ? `${text}\n\nSpecial instructions: ${instructions}`
                : text;

            // Delete old set if exists
            if (setId) {
                await deleteFlashcardSet(setId);
            }

            // Generate via AI
            const generated: Flashcard[] = await generateFlashcards(noteText, selectedCount);

            // Save to Supabase
            const { set, cards: savedCards } = await saveFlashcardSet(
                noteId,
                generated.map((c) => ({ front: c.front, back: c.back })),
            );

            setSetId(set.id);
            setCards(savedCards);
            setView('overview');
            setInstructions('');
        } catch (err) {
            console.error('Flashcard generation failed:', err);
            setError(
                err instanceof Error ? err.message : 'Failed to generate flashcards. Please try again.',
            );
        } finally {
            setIsGenerating(false);
        }
    }, [getNoteText, instructions, selectedCount, noteId, setId]);

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
                onRegenerate={() => setView('generate')}
            />
        );
    }

    /* ── Generate view (default) ── */
    return (
        <div className="mx-auto w-full max-w-2xl px-8 py-12 lg:px-16">
            {/* ── Header ── */}
            <div className="mb-10 text-center">
                <h2 className="mb-3 text-3xl font-bold text-zinc-100">
                    <span className="flashcards-sparkle mr-1">✨</span>
                    Welcome to Flashcards
                    <span className="flashcards-sparkle ml-1">✨</span>
                </h2>
                <p className="text-[15px] text-zinc-400">
                    Choose how many flashcards to generate from your notes
                </p>
            </div>

            {/* ── Count Selector ── */}
            <div className="mb-10 grid grid-cols-4 gap-3">
                {countOptions.map((opt) => {
                    const isSelected = selectedCount === opt.value;
                    return (
                        <button
                            key={opt.value}
                            onClick={() => setSelectedCount(opt.value)}
                            className={`flashcard-count-btn group relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-5 text-center transition-all duration-200 ${isSelected
                                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                                    : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/50'
                                }`}
                        >
                            {isSelected && (
                                <span className="absolute -top-1.5 right-2.5 text-[10px] text-indigo-400 animate-pulse">
                                    ✦
                                </span>
                            )}
                            <span
                                className={`text-2xl font-bold transition-colors ${isSelected ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-100'
                                    }`}
                            >
                                {opt.value}
                            </span>
                            <span
                                className={`text-[12px] font-medium transition-colors ${isSelected ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-400'
                                    }`}
                            >
                                {opt.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Special Instructions ── */}
            <div className="mb-8">
                <label className="mb-2.5 block text-[14px] font-semibold text-zinc-300">
                    Special Instructions{' '}
                    <span className="font-normal text-zinc-500">(Optional)</span>
                </label>
                <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Describe what you want your flashcards to focus on, or leave blank to cover the full notes..."
                    rows={4}
                    className="w-full resize-none rounded-xl border-2 border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-[14px] text-zinc-200 placeholder-zinc-600 outline-none transition-all duration-200 focus:border-indigo-500/50 focus:bg-zinc-900/60 focus:ring-2 focus:ring-indigo-500/10"
                />
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
                        <span>Generate {selectedCount} Flashcards</span>
                    </>
                )}

                {!isGenerating && (
                    <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
                )}
            </button>

            {/* ── Back to existing cards (if any) ── */}
            {cards.length > 0 && (
                <button
                    onClick={() => setView('overview')}
                    className="mt-4 w-full text-center text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                >
                    ← Back to existing flashcards ({cards.length} cards)
                </button>
            )}
        </div>
    );
};

export default FlashcardsPanel;
