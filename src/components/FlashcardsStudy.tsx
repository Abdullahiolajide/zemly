import { useState, useCallback, useEffect, useRef } from 'react';
import { FiChevronLeft } from 'react-icons/fi';
import { IoClose, IoCheckmark } from 'react-icons/io5';
import type { FlashcardCard, FlashcardStatus } from '../types';
import MasteryModal from './MasteryModal';

interface FlashcardsStudyProps {
    cards: FlashcardCard[];
    onBack: () => void;
    onCardUpdate: (cardId: number, status: FlashcardStatus, knowCount: number) => void;
    onReset: () => void;
    onExit: () => void;
}

const FlashcardsStudy: React.FC<FlashcardsStudyProps> = ({ cards, onBack, onCardUpdate, onReset, onExit }) => {
    const CARD_ADVANCE_MS = 180;
    const [isFlipped, setIsFlipped] = useState(false);
    const [showMastery, setShowMastery] = useState(false);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [sessionQueueIds, setSessionQueueIds] = useState<number[]>([]);
    const advanceTimerRef = useRef<number | null>(null);

    const unfamiliarCount = cards.filter((c) => c.status === 'unfamiliar').length;
    const newCount = cards.filter((c) => c.status === 'new').length;
    const learningCount = cards.filter((c) => c.status === 'learning').length;
    const masteredCount = cards.filter((c) => c.status === 'mastered').length;

    const activeCards = cards.filter((c) => c.status !== 'mastered');
    const currentCardId = sessionQueueIds[0] ?? null;
    const currentCard = currentCardId ? cards.find((c) => c.id === currentCardId) ?? null : null;
    const progressPercent = cards.length > 0 ? (masteredCount / cards.length) * 100 : 0;

    useEffect(() => {
        const activeIds = activeCards.map((card) => card.id);
        const activeSet = new Set(activeIds);

        setSessionQueueIds((prev) => {
            const kept = prev.filter((id) => activeSet.has(id));
            const missing = activeIds.filter((id) => !kept.includes(id));
            return [...kept, ...missing];
        });
    }, [activeCards]);

    useEffect(() => {
        return () => {
            if (advanceTimerRef.current !== null) {
                window.clearTimeout(advanceTimerRef.current);
            }
        };
    }, []);

    const handleAnswer = useCallback((knows: boolean) => {
        if (!currentCard || isAdvancing) return;
        setIsAdvancing(true);

        let newStatus: FlashcardStatus;
        let newKnowCount: number;
        if (knows) {
            newKnowCount = currentCard.know_count + 1;
            newStatus = newKnowCount >= 2 ? 'mastered' : 'learning';
        } else {
            newKnowCount = 0;
            newStatus = 'unfamiliar';
        }
        const willCompleteStudy = newStatus === 'mastered' && sessionQueueIds.length === 1;

        advanceTimerRef.current = window.setTimeout(() => {
            onCardUpdate(currentCard.id, newStatus, newKnowCount);
            setSessionQueueIds((prev) => {
                const remaining = prev.filter((id) => id !== currentCard.id);
                if (newStatus === 'mastered') return remaining;
                return [...remaining, currentCard.id];
            });
            setIsFlipped(false);
            if (willCompleteStudy) {
                window.setTimeout(() => setShowMastery(true), 400);
            }
            setIsAdvancing(false);
        }, CARD_ADVANCE_MS);
    }, [CARD_ADVANCE_MS, currentCard, isAdvancing, onCardUpdate, sessionQueueIds]);

    const handleReset = () => { setShowMastery(false); setIsFlipped(false); setSessionQueueIds([]); onReset(); };
    const handleExit = () => { setShowMastery(false); onExit(); };
    const allMastered = sessionQueueIds.length === 0 && masteredCount === cards.length && cards.length > 0;

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-4 sm:px-8 sm:py-6 lg:px-16">
            {/* Top Bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                    <FiChevronLeft className="h-4 w-4" />
                    Back
                </button>
                {/* Status badges — scrollable on mobile */}
                <div className="note-tab-scroll flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:gap-3">
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-red-400 sm:gap-1.5 sm:text-[12px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400 sm:h-2 sm:w-2" />{unfamiliarCount} Unfamiliar
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-blue-400 sm:gap-1.5 sm:text-[12px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 sm:h-2 sm:w-2" />{newCount} New
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-amber-400 sm:gap-1.5 sm:text-[12px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 sm:h-2 sm:w-2" />{learningCount} Learning
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-green-400 sm:gap-1.5 sm:text-[12px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 sm:h-2 sm:w-2" />{masteredCount} Mastered
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-glass)' }}>
                <div
                    className="study-progress-bar h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #00C896, #00A87A)' }}
                />
            </div>

            {/* Card */}
            {currentCard ? (
                <>
                    <div className={`study-card-shell ${isAdvancing ? 'study-card-leaving' : ''}`} key={currentCard.id}>
                        <div
                            className={`study-card-container mb-8 ${isAdvancing ? 'cursor-default' : 'cursor-pointer'}`}
                            onClick={() => { if (!isAdvancing) setIsFlipped(!isFlipped); }}
                        >
                            <div className={`study-card-inner ${isFlipped ? 'study-card-flipped' : ''}`}>
                            {/* Front */}
                            <div
                                className="study-card-face study-card-front flex min-h-[200px] items-center justify-center rounded-2xl p-6 sm:min-h-[280px] sm:p-8"
                                style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)', backdropFilter: 'blur(12px)' }}
                            >
                                <p className="text-center text-base font-medium leading-relaxed text-zinc-200 sm:text-lg">
                                    {currentCard.front}
                                </p>
                            </div>
                            {/* Back */}
                            <div
                                className="study-card-face study-card-back flex min-h-[200px] items-center justify-center rounded-2xl p-6 sm:min-h-[280px] sm:p-8"
                                style={{ border: '1px solid var(--brand-emerald)', background: 'var(--bg-glass-hover)', backdropFilter: 'blur(12px)' }}
                            >
                                <p className="text-center text-base font-medium leading-relaxed text-zinc-300 sm:text-lg">
                                    {currentCard.back}
                                </p>
                            </div>
                            </div>
                        </div>
                    </div>

                    <p className="mb-6 text-center text-[12px] text-zinc-600">Click the card to reveal the answer</p>

                    {/* Answer Buttons */}
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                        <button
                            onClick={() => handleAnswer(false)}
                            disabled={isAdvancing}
                            className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[13px] font-bold text-red-400 transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:text-[14px]"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                        >
                            <IoClose className="h-5 w-5" /> Don't Know
                        </button>
                        <button
                            onClick={() => handleAnswer(true)}
                            disabled={isAdvancing}
                            className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[13px] font-bold text-green-400 transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:text-[14px]"
                            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.18)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.1)'; }}
                        >
                            <IoCheckmark className="h-5 w-5" /> Know
                        </button>
                    </div>
                </>
            ) : allMastered ? (
                <div
                    className="flex min-h-[280px] items-center justify-center rounded-2xl p-8"
                    style={{ border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.06)' }}
                >
                    <div className="text-center">
                        <p className="mb-2 text-4xl">🎉</p>
                        <p className="text-lg font-bold text-zinc-100">All cards mastered!</p>
                        <p className="mt-1 text-[14px] text-zinc-400">Great job!</p>
                    </div>
                </div>
            ) : null}

            {/* Reset Progress (all mastered) */}
            {allMastered && (
                <div className="mt-6 flex items-center justify-center">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-zinc-400 transition-all hover:text-zinc-200"
                        style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                    >
                        Reset Progress
                    </button>
                </div>
            )}

            {/* Mastery Modal */}
            <MasteryModal
                open={showMastery}
                totalCards={cards.length}
                masteredCards={masteredCount}
                onReset={handleReset}
                onExit={handleExit}
            />
        </div>
    );
};

export default FlashcardsStudy;
