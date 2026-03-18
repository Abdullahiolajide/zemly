import { useState, useCallback } from 'react';
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
    const [isFlipped, setIsFlipped] = useState(false);
    const [showMastery, setShowMastery] = useState(false);

    const unfamiliarCount = cards.filter((c) => c.status === 'unfamiliar').length;
    const newCount = cards.filter((c) => c.status === 'new').length;
    const learningCount = cards.filter((c) => c.status === 'learning').length;
    const masteredCount = cards.filter((c) => c.status === 'mastered').length;

    const studyQueue = [
        ...cards.filter((c) => c.status === 'unfamiliar'),
        ...cards.filter((c) => c.status === 'new'),
        ...cards.filter((c) => c.status === 'learning'),
    ];
    const currentCard = studyQueue[0] ?? null;
    const progressPercent = cards.length > 0 ? (masteredCount / cards.length) * 100 : 0;

    const handleAnswer = useCallback((knows: boolean) => {
        if (!currentCard) return;
        let newStatus: FlashcardStatus;
        let newKnowCount: number;
        if (knows) {
            newKnowCount = currentCard.know_count + 1;
            newStatus = newKnowCount >= 2 ? 'mastered' : 'learning';
        } else {
            newKnowCount = 0;
            newStatus = 'unfamiliar';
        }
        onCardUpdate(currentCard.id, newStatus, newKnowCount);
        setIsFlipped(false);
        const remainingAfterUpdate = studyQueue.length - 1;
        if (newStatus === 'mastered' && remainingAfterUpdate === 0) {
            setTimeout(() => setShowMastery(true), 400);
        }
    }, [currentCard, onCardUpdate, studyQueue.length]);

    const handleReset = () => { setShowMastery(false); setIsFlipped(false); onReset(); };
    const handleExit = () => { setShowMastery(false); onExit(); };
    const allMastered = studyQueue.length === 0 && masteredCount === cards.length && cards.length > 0;

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col px-8 py-6 lg:px-16">
            {/* Top Bar */}
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                    <FiChevronLeft className="h-4 w-4" />
                    Back
                </button>
                {/* Status badges */}
                <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-red-400">
                        <span className="h-2 w-2 rounded-full bg-red-400" />{unfamiliarCount} Unfamiliar
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-400">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />{newCount} New
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-400">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />{learningCount} Learning
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-green-400">
                        <span className="h-2 w-2 rounded-full bg-green-400" />{masteredCount} Mastered
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                    className="study-progress-bar h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #00C896, #00A87A)' }}
                />
            </div>

            {/* Card */}
            {currentCard ? (
                <>
                    <div
                        className="study-card-container mb-8 cursor-pointer"
                        onClick={() => setIsFlipped(!isFlipped)}
                    >
                        <div className={`study-card-inner ${isFlipped ? 'study-card-flipped' : ''}`}>
                            {/* Front */}
                            <div
                                className="study-card-face study-card-front flex min-h-[280px] items-center justify-center rounded-2xl p-8"
                                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(12px)' }}
                            >
                                <p className="text-center text-lg font-medium leading-relaxed text-zinc-200">
                                    {currentCard.front}
                                </p>
                            </div>
                            {/* Back */}
                            <div
                                className="study-card-face study-card-back flex min-h-[280px] items-center justify-center rounded-2xl p-8"
                                style={{ border: '1px solid rgba(0,200,150,0.25)', background: 'rgba(0,200,150,0.06)', backdropFilter: 'blur(12px)' }}
                            >
                                <p className="text-center text-lg font-medium leading-relaxed text-zinc-300">
                                    {currentCard.back}
                                </p>
                            </div>
                        </div>
                    </div>

                    <p className="mb-6 text-center text-[12px] text-zinc-600">Click the card to reveal the answer</p>

                    {/* Answer Buttons */}
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => handleAnswer(false)}
                            className="flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-red-400 transition-all"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                        >
                            <IoClose className="h-5 w-5" /> Don't Know
                        </button>
                        <button
                            onClick={() => handleAnswer(true)}
                            className="flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-green-400 transition-all"
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
                        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
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
