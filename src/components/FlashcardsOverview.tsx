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

    // Navigate cards
    const goNext = () => setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
    const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

    // Handle Editing "Current Preview Card"
    const handleEditCurrent = () => {
        if (!currentCard) return;
        setEditingId(currentCard.id);
        setEditFront(currentCard.front);
        setEditBack(currentCard.back);
    };

    /* ── Group cards just for the list view below ── */
    const groupedCards = (['unfamiliar', 'learning', 'new', 'mastered'] as const).map((status) => ({
        status,
        ...statusConfig[status],
        cards: cards.filter((c) => c.status === status),
    })).filter((g) => g.cards.length > 0);

    /* ── Edit helpers ── */
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
        <div className="mx-auto w-full max-w-5xl px-6 py-6 lg:px-12">
            {/* ── Header ── */}
            <div className="mb-6 flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        <TbCards className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Flashcards</h2>
                </div>
                <p className="ml-14 text-sm text-zinc-500">{cards.length} Total Flashcards</p>
            </div>

            {/* ── Status Pills (Centered) ── */}
            <div className="mb-8 flex justify-center">
                <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                        {newCount} New
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
                        {learningCount} Learning
                    </span>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-600 dark:bg-green-500/20 dark:text-green-300">
                        {masteredCount} Mastered
                    </span>
                </div>
            </div>

            {/* ── Main Card Carousel ── */}
            <div className="relative mx-auto mb-10 w-full max-w-3xl">
                {currentCard ? (
                    <div className="group relative flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 p-12 text-center shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40">
                         {/* Card Content or Edit Form */}
                         {editingId === currentCard.id ? (
                             <div className="w-full space-y-4">
                                 <div>
                                    <label className="text-xs font-bold uppercase text-zinc-400">Front</label>
                                    <textarea
                                        value={editFront}
                                        onChange={(e) => setEditFront(e.target.value)} 
                                        rows={3}
                                        className="mt-1 w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                    />
                                 </div>
                                 <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                                    <label className="text-xs font-bold uppercase text-zinc-400">Back</label>
                                    <textarea
                                        value={editBack}
                                        onChange={(e) => setEditBack(e.target.value)}
                                        rows={3} 
                                        className="mt-1 w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                    />
                                 </div>
                                 <div className="flex justify-end gap-2 pt-2">
                                     <button onClick={cancelEditing} className="px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Cancel</button>
                                     <button onClick={saveEditing} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600">Save</button>
                                 </div>
                             </div>
                         ) : (
                             <>
                                <h3 className="text-xl font-medium leading-relaxed text-zinc-700 dark:text-zinc-200">
                                    {currentCard.front}
                                </h3>
                                {/* Small hint of back content on hover could go here, or just keep it simple as a preview */}
                             </>
                         )}
                    </div>
                ) : (
                    <div className="flex h64 w-full items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/20">
                        <p className="text-zinc-400">No cards available.</p>
                    </div>
                )}
            </div>

            {/* ── Carousel Controls ── */}
            <div className="mb-12 flex items-center justify-center gap-8">
                <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="flex h-10 w-10 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-800 disabled:opacity-30 dark:hover:text-zinc-200"
                >
                    <FiChevronLeft className="h-6 w-6" />
                </button>
                <span className="font-mono text-sm font-medium text-zinc-500">
                    {currentIndex + 1} / {cards.length}
                </span>
                <button
                    onClick={goNext}
                    disabled={currentIndex === cards.length - 1}
                    className="flex h-10 w-10 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-800 disabled:opacity-30 dark:hover:text-zinc-200"
                >
                    <FiChevronRight className="h-6 w-6" />
                </button>
            </div>

            {/* ── Main Actions Row ── */}
            <div className="flex items-center justify-between border-t border-zinc-200 pt-8 dark:border-zinc-800">
                 <button
                    onClick={handleEditCurrent}
                    disabled={!currentCard}
                    className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                    <FiEdit2 className="h-4 w-4" />
                    Edit Flashcards
                </button>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onCreateMore}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-300"
                    >
                        <FiPlus className="h-4 w-4" />
                        Add Cards
                    </button>
                    <button
                        onClick={onStartStudying}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40"
                    >
                        <BsPlay className="h-5 w-5" />
                        Start Studying
                    </button>
                </div>
            </div>

            {/* ── Grouped Card List (Secondary View) ── */}
            <div className="mt-16 space-y-12">

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
