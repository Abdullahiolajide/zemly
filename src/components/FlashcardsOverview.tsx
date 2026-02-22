import { useState } from 'react';
import { TbCards } from 'react-icons/tb';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { BsPlay } from 'react-icons/bs';
import { FiEdit3 } from 'react-icons/fi';
import type { FlashcardCard } from '../types';

interface FlashcardsOverviewProps {
    cards: FlashcardCard[];
    onStartStudying: () => void;
    onRegenerate: () => void;
}

const FlashcardsOverview: React.FC<FlashcardsOverviewProps> = ({
    cards,
    onStartStudying,
    onRegenerate,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const newCount = cards.filter((c) => c.status === 'new').length;
    const learningCount = cards.filter((c) => c.status === 'learning').length;
    const masteredCount = cards.filter((c) => c.status === 'mastered').length;

    const currentCard = cards[currentIndex];

    const goNext = () => setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
    const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

    return (
        <div className="mx-auto w-full max-w-2xl px-8 py-10 lg:px-16">
            {/* ── Header ── */}
            <div className="mb-8 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20">
                    <TbCards className="h-7 w-7 text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100">Flashcards</h2>
                    <p className="text-[13px] text-zinc-500">{cards.length} Total Flashcards</p>
                </div>
            </div>

            {/* ── Status Badges ── */}
            <div className="mb-6 flex items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-[12px] font-semibold text-blue-400">
                    {newCount} New
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[12px] font-semibold text-amber-400">
                    {learningCount} Learning
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-[12px] font-semibold text-green-400">
                    {masteredCount} Mastered
                </span>
            </div>

            {/* ── Card Preview ── */}
            {currentCard && (
                <div className="mb-6 flex min-h-[260px] items-center justify-center rounded-2xl border-2 border-zinc-800/60 bg-zinc-900/30 p-8">
                    <p className="text-center text-lg font-medium text-zinc-200">
                        {currentCard.front}
                    </p>
                </div>
            )}

            {/* ── Navigation ── */}
            <div className="mb-8 flex items-center justify-center gap-6">
                <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800/60 text-zinc-400 transition-all hover:bg-zinc-800/50 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                >
                    <FiChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-[14px] font-medium text-zinc-400">
                    <span className="text-zinc-100">{currentIndex + 1}</span> / {cards.length}
                </span>
                <button
                    onClick={goNext}
                    disabled={currentIndex === cards.length - 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800/60 text-zinc-400 transition-all hover:bg-zinc-800/50 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                >
                    <FiChevronRight className="h-5 w-5" />
                </button>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onRegenerate}
                    className="flex items-center gap-2 rounded-xl border border-zinc-800/60 px-5 py-2.5 text-[13px] font-semibold text-zinc-300 transition-all hover:bg-zinc-800/50 hover:text-zinc-100"
                >
                    <FiEdit3 className="h-4 w-4" />
                    Edit Flashcards
                </button>

                <button
                    onClick={onStartStudying}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/35 hover:brightness-110"
                >
                    <BsPlay className="h-4 w-4" />
                    Start Studying
                </button>
            </div>

            {/* ── Bottom Status ── */}
            <div className="mt-8 flex items-center justify-center gap-2">
                <span className="text-[13px] font-medium text-amber-400">New</span>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                    {newCount} cards
                </span>
            </div>
        </div>
    );
};

export default FlashcardsOverview;
