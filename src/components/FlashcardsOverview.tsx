import { useState } from 'react';
import { TbCards } from 'react-icons/tb';
import { FiChevronLeft, FiChevronRight, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { BsPlay } from 'react-icons/bs';
import { FiPlus } from 'react-icons/fi';
import type { FlashcardCard } from '../types';

interface FlashcardsOverviewProps {
    cards: FlashcardCard[];
    onStartStudying: () => void;
    onCreateMore: () => void;
    onDeleteCard: (cardId: number) => void;
    onEditCard: (cardId: number, front: string, back: string) => void;
}

/* ── Status config ── */
const statusConfig = {
    unfamiliar: { label: 'Unfamiliar', dot: 'bg-red-400', badge: 'bg-red-500/15 text-red-400', line: 'bg-red-500/30', order: 0 },
    learning: { label: 'Learning', dot: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-400', line: 'bg-amber-500/30', order: 1 },
    new: { label: 'New', dot: 'bg-blue-400', badge: 'bg-blue-500/15 text-blue-400', line: 'bg-blue-500/30', order: 2 },
    mastered: { label: 'Mastered', dot: 'bg-green-400', badge: 'bg-green-500/15 text-green-400', line: 'bg-green-500/30', order: 3 },
} as const;

const FlashcardsOverview: React.FC<FlashcardsOverviewProps> = ({
    cards,
    onStartStudying,
    onCreateMore,
    onDeleteCard,
    onEditCard,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    /* ── Editing state ── */
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editFront, setEditFront] = useState('');
    const [editBack, setEditBack] = useState('');

    /* ── Delete confirmation state ── */
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const confirmDelete = () => {
        if (deletingId !== null) {
            onDeleteCard(deletingId);
            setDeletingId(null);
        }
    };

    const unfamiliarCount = cards.filter((c) => c.status === 'unfamiliar').length;
    const newCount = cards.filter((c) => c.status === 'new').length;
    const learningCount = cards.filter((c) => c.status === 'learning').length;
    const masteredCount = cards.filter((c) => c.status === 'mastered').length;

    const currentCard = cards[currentIndex];

    const goNext = () => setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
    const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

    /* ── Group cards by status (Unfamiliar → Learning → New → Mastered) ── */
    const groupedCards = (['unfamiliar', 'learning', 'new', 'mastered'] as const).map((status) => ({
        status,
        ...statusConfig[status],
        cards: cards.filter((c) => c.status === status),
    })).filter((g) => g.cards.length > 0);

    /* ── Edit helpers ── */
    const startEditing = (card: FlashcardCard) => {
        setEditingId(card.id);
        setEditFront(card.front);
        setEditBack(card.back);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditFront('');
        setEditBack('');
    };

    const saveEditing = () => {
        if (editingId && editFront.trim() && editBack.trim()) {
            onEditCard(editingId, editFront.trim(), editBack.trim());
            setEditingId(null);
        }
    };

    return (
        <div className="mx-auto w-full max-w-4xl px-8 py-10 lg:px-16">
            {/* ── Header ── */}
            <div className="mb-8 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400/20 to-purple-500/20">
                    <TbCards className="h-7 w-7 text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100">Flashcards</h2>
                    <p className="text-[13px] text-zinc-500">{cards.length} Total Flashcards</p>
                </div>
            </div>

            {/* ── Status Badges ── */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-semibold text-red-400">
                    {unfamiliarCount} Unfamiliar
                </span>
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
                    onClick={onCreateMore}
                    className="flex items-center gap-2 rounded-xl border border-zinc-800/60 px-5 py-2.5 text-[13px] font-semibold text-zinc-300 transition-all hover:bg-zinc-800/50 hover:text-zinc-100"
                >
                    <FiPlus className="h-4 w-4" />
                    Create New Flashcards
                </button>

                <button
                    onClick={onStartStudying}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/35 hover:brightness-110"
                >
                    <BsPlay className="h-4 w-4" />
                    Start Studying
                </button>
            </div>

            {/* ── Grouped Card List ── */}
            <div className="mt-10 space-y-8">
                {groupedCards.map((group) => (
                    <div key={group.status}>
                        {/* Group Header — centered with lines */}
                        <div className="mb-5 flex items-center gap-4">
                            <div className={`h-px flex-1 ${group.line}`} />
                            <div className="flex items-center gap-2">
                                <h3 className={`text-[15px] font-bold ${
                                    group.status === 'unfamiliar' ? 'text-red-400' :
                                    group.status === 'learning' ? 'text-amber-400' :
                                    group.status === 'new' ? 'text-blue-400' : 'text-green-400'
                                }`}>{group.label}</h3>
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${group.badge}`}>
                                    {group.cards.length} cards
                                </span>
                            </div>
                            <div className={`h-px flex-1 ${group.line}`} />
                        </div>

                        {/* Cards */}
                        <div className="space-y-4">
                            {group.cards.map((card) => (
                                <div
                                    key={card.id}
                                    className="relative rounded-xl border border-gray-100/40 bg-zinc-900/60 shadow-lg shadow-black/20 transition-all hover:shadow-xl hover:shadow-black/30 dark:border-zinc-800/40 dark:bg-zinc-900/60"
                                >
                                    {editingId === card.id ? (
                                        /* ── Editing mode ── */
                                        <div className="p-5 space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`h-2.5 w-2.5 rounded-full ${group.dot}`} />
                                                <span className="text-[12px] font-medium text-zinc-500">Editing</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Front</label>
                                                    <textarea
                                                        value={editFront}
                                                        onChange={(e) => setEditFront(e.target.value)}
                                                        rows={3}
                                                        className="w-full resize-none rounded-xl border border-zinc-700 px-4 py-3 text-[13px] text-zinc-100 outline-none transition-colors focus:border-indigo-500/50"
                                                        placeholder="Front side..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Back</label>
                                                    <textarea
                                                        value={editBack}
                                                        onChange={(e) => setEditBack(e.target.value)}
                                                        rows={3}
                                                        className="w-full resize-none rounded-xl border border-zinc-700  px-4 py-3 text-[13px] text-zinc-100 outline-none transition-colors focus:border-indigo-500/50"
                                                        placeholder="Back side..."
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                <button
                                                    onClick={cancelEditing}
                                                    className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                                                >
                                                    <FiX className="h-3.5 w-3.5" />
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={saveEditing}
                                                    className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-4 py-1.5 text-[12px] font-medium text-indigo-400 transition-colors hover:bg-indigo-500/30"
                                                >
                                                    <FiCheck className="h-3.5 w-3.5" />
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Display mode ── */
                                        <div className="relative p-5">
                                            {/* Top row: dot + actions */}
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className={`h-3 w-3 rounded-full ${group.dot}`} />
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setDeletingId(card.id)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                                        title="Delete card"
                                                    >
                                                        <FiTrash2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => startEditing(card)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                                                        title="Edit card"
                                                    >
                                                        <FiEdit2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Two-column front / back */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="flex items-center justify-center text-center">
                                                    <p className="text-[14px] font-medium leading-relaxed text-zinc-200">
                                                        {card.front}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-center text-center">
                                                    <p className="text-[13px] leading-relaxed text-zinc-400">
                                                        {card.back}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Delete Confirmation Modal ── */}
            {deletingId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setDeletingId(null)}
                    />
                    {/* Modal */}
                    <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800/60 bg-zinc-900 p-6 shadow-2xl shadow-black/40">
                        <h3 className="mb-2 text-lg font-bold text-zinc-100">Are you sure?</h3>
                        <p className="mb-6 text-[14px] leading-relaxed text-zinc-400">
                            Are you sure you want to delete this flashcard? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDeletingId(null)}
                                className="rounded-xl border border-zinc-700 px-5 py-2 text-[13px] font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-zinc-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="rounded-xl bg-red-600 px-5 py-2 text-[13px] font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 hover:shadow-red-500/30"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlashcardsOverview;
