import { useState } from 'react';
import { TbCards } from 'react-icons/tb';
import { FiChevronLeft, FiChevronRight, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { BsPlay } from 'react-icons/bs';
import type { FlashcardCard } from '../types';

interface FlashcardsOverviewProps {
    cards: FlashcardCard[];
    onStartStudying: () => void;
    onDeleteCard: (cardId: number) => void;
    onEditCard: (cardId: number, front: string, back: string) => void;
}

const statusConfig = {
    unfamiliar: { label: 'Unfamiliar', dot: 'bg-red-400', badge: 'bg-red-500/15 text-red-400', lineColor: 'rgba(239,68,68,0.3)', order: 0 },
    learning:   { label: 'Learning',   dot: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-400', lineColor: 'rgba(245,158,11,0.3)', order: 1 },
    new:        { label: 'New',        dot: 'bg-blue-400',  badge: 'bg-blue-500/15 text-blue-400',  lineColor: 'rgba(79,156,249,0.3)',  order: 2 },
    mastered:   { label: 'Mastered',   dot: 'bg-green-400', badge: 'bg-green-500/15 text-green-400', lineColor: 'rgba(34,197,94,0.3)',  order: 3 },
} as const;

const FlashcardsOverview: React.FC<FlashcardsOverviewProps> = ({ cards, onStartStudying, onDeleteCard, onEditCard }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editFront, setEditFront] = useState('');
    const [editBack, setEditBack] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const confirmDelete = () => { if (deletingId !== null) { onDeleteCard(deletingId); setDeletingId(null); } };

    const unfamiliarCount = cards.filter((c) => c.status === 'unfamiliar').length;
    const newCount = cards.filter((c) => c.status === 'new').length;
    const learningCount = cards.filter((c) => c.status === 'learning').length;
    const masteredCount = cards.filter((c) => c.status === 'mastered').length;
    const currentCard = cards[currentIndex];

    const goNext = () => setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
    const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

    const groupedCards = (['unfamiliar', 'learning', 'new', 'mastered'] as const).map((status) => ({
        status, ...statusConfig[status],
        cards: cards.filter((c) => c.status === status),
    })).filter((g) => g.cards.length > 0);

    const startEditing = (card: FlashcardCard) => { setEditingId(card.id); setEditFront(card.front); setEditBack(card.back); };
    const cancelEditing = () => { setEditingId(null); setEditFront(''); setEditBack(''); };
    const saveEditing = () => {
        if (editingId && editFront.trim() && editBack.trim()) { onEditCard(editingId, editFront.trim(), editBack.trim()); setEditingId(null); }
    };

    /* shared textarea style helper */
    const taStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        color: '#e4e4e7',
        fontFamily: "'DM Sans', sans-serif",
    };
    const taFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => { e.target.style.borderColor = '#00C896'; e.target.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.1)'; };
    const taBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => { e.target.style.borderColor = 'rgba(255,255,255,0.09)'; e.target.style.boxShadow = ''; };

    return (
        <div className="mx-auto w-full max-w-7xl px-8 py-10 lg:px-16">
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
                <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.15)' }}
                >
                    <TbCards className="h-7 w-7" style={{ color: '#00C896' }} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Flashcards</h2>
                    <p className="text-[13px] text-zinc-500">{cards.length} Total Flashcards</p>
                </div>
            </div>

            {/* Status Badges */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-semibold text-red-400">{unfamiliarCount} Unfamiliar</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-[12px] font-semibold text-blue-400">{newCount} New</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[12px] font-semibold text-amber-400">{learningCount} Learning</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-[12px] font-semibold text-green-400">{masteredCount} Mastered</span>
            </div>

            {/* Card Preview */}
            {currentCard && (
                <div
                    className="mb-6 mx-auto flex min-h-[240px] max-w-xl items-center justify-center rounded-2xl p-8"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(12px)' }}
                >
                    <p className="text-center text-lg font-medium text-zinc-100">{currentCard.front}</p>
                </div>
            )}

            {/* Navigation */}
            <div className="mb-8 flex items-center justify-center gap-6">
                <button
                    onClick={goPrev} disabled={currentIndex === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-all hover:text-zinc-200 disabled:opacity-30"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}
                >
                    <FiChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-[14px] font-medium text-zinc-400">
                    <span className="text-zinc-100">{currentIndex + 1}</span> / {cards.length}
                </span>
                <button
                    onClick={goNext} disabled={currentIndex === cards.length - 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-all hover:text-zinc-200 disabled:opacity-30"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}
                >
                    <FiChevronRight className="h-5 w-5" />
                </button>
            </div>

            {/* Start Studying */}
            <div className="flex items-center justify-end">
                <button
                    onClick={onStartStudying}
                    className="btn-emerald flex items-center gap-2 px-6 py-2.5 text-[13px] font-bold"
                >
                    <BsPlay className="h-4 w-4" />
                    Start Studying
                </button>
            </div>

            {/* Grouped Card List */}
            <div className="mt-10 space-y-8">
                {groupedCards.map((group) => (
                    <div key={group.status}>
                        {/* Group header */}
                        <div className="mb-5 flex items-center gap-4">
                            <div className="h-px flex-1" style={{ background: group.lineColor }} />
                            <div className="flex items-center gap-2">
                                <h3 className={`text-[15px] font-bold ${group.status === 'unfamiliar' ? 'text-red-400' : group.status === 'learning' ? 'text-amber-400' : group.status === 'new' ? 'text-blue-400' : 'text-green-400'}`}>
                                    {group.label}
                                </h3>
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${group.badge}`}>
                                    {group.cards.length} cards
                                </span>
                            </div>
                            <div className="h-px flex-1" style={{ background: group.lineColor }} />
                        </div>

                        {/* Cards */}
                        <div className="space-y-4">
                            {group.cards.map((card) => (
                                <div
                                    key={card.id}
                                    className="relative rounded-xl text-sm lg:text-base transition-all"
                                    style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}
                                >
                                    {editingId === card.id ? (
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
                                                        onFocus={taFocus} onBlur={taBlur}
                                                        rows={3}
                                                        className="w-full resize-none rounded-xl px-4 py-3 text-[13px] outline-none transition-all"
                                                        style={taStyle}
                                                        placeholder="Front side..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Back</label>
                                                    <textarea
                                                        value={editBack}
                                                        onChange={(e) => setEditBack(e.target.value)}
                                                        onFocus={taFocus} onBlur={taBlur}
                                                        rows={3}
                                                        className="w-full resize-none rounded-xl px-4 py-3 text-[13px] outline-none transition-all"
                                                        style={taStyle}
                                                        placeholder="Back side..."
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                <button
                                                    onClick={cancelEditing}
                                                    className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                                                >
                                                    <FiX className="h-3.5 w-3.5" /> Cancel
                                                </button>
                                                <button
                                                    onClick={saveEditing}
                                                    className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12px] font-medium transition-colors"
                                                    style={{ background: 'rgba(0,200,150,0.12)', color: '#00C896', border: '1px solid rgba(0,200,150,0.2)' }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.2)'; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.12)'; }}
                                                >
                                                    <FiCheck className="h-3.5 w-3.5" /> Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-full flex-col">
                                            <div className="flex w-full items-center justify-between rounded-t-xl px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:text-zinc-300"
                                                        style={{ background: 'transparent' }}
                                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                        title="Edit card"
                                                    >
                                                        <FiEdit2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-1 items-center justify-center overflow-y-auto p-4 lg:px-5">
                                                <div className="grid grid-cols-2 gap-6 w-full">
                                                    <div className="flex items-center justify-center text-center">
                                                        <p className="leading-relaxed text-zinc-200">{card.front}</p>
                                                    </div>
                                                    <div className="flex items-center justify-center text-center" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                                                        <p className="leading-relaxed text-zinc-400">{card.back}</p>
                                                    </div>
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

            {/* Delete Confirmation Modal */}
            {deletingId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeletingId(null)} />
                    <div
                        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                        style={{ background: 'rgba(16, 18, 24, 0.97)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
                    >
                        <h3 className="mb-2 text-lg font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Delete this card?</h3>
                        <p className="mb-6 text-[14px] leading-relaxed text-zinc-500">This action cannot be undone.</p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDeletingId(null)}
                                className="rounded-xl px-5 py-2 text-[13px] font-semibold text-zinc-400 transition-all hover:text-zinc-200"
                                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="rounded-xl bg-red-500/90 px-5 py-2 text-[13px] font-bold text-white shadow-lg transition-all hover:bg-red-500"
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
