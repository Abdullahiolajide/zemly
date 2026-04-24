import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { IoCheckmark, IoClose } from 'react-icons/io5';
import { MdAutoAwesome } from 'react-icons/md';
import { PiExam } from 'react-icons/pi';
import type { QuizQuestionRow, QuizStatus } from '../types';
import type { QuizQuestion } from '../lib/aiService';
import { generateQuiz, generateQuizExplanation } from '../lib/aiService';
import {
    saveQuizSet,
    getLatestQuizSet,
    getQuizQuestions,
    updateQuizQuestionStatus,
    resetQuizProgress,
} from '../lib/quizService';

type QuizView = 'loading' | 'generate' | 'quiz' | 'results';

interface QuizPanelProps {
    noteId: number;
    getNoteText: () => string;
}

function getResumeQuestionIndex(items: QuizQuestionRow[]): number {
    const firstNew = items.findIndex((q) => q.status === 'new');
    if (firstNew >= 0) return firstNew;

    const firstUnfamiliar = items.findIndex((q) => q.status === 'unfamiliar');
    if (firstUnfamiliar >= 0) return firstUnfamiliar;

    const firstLearning = items.findIndex((q) => q.status === 'learning');
    if (firstLearning >= 0) return firstLearning;

    return 0;
}

const QuizPanel: React.FC<QuizPanelProps> = ({ noteId, getNoteText }) => {
    const [view, setView] = useState<QuizView>('loading');
    const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
    const [setId, setSetId] = useState<number | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [answersMap, setAnswersMap] = useState<Record<number, number>>({});
    const [explanationsMap, setExplanationsMap] = useState<Record<number, string>>({});
    const [loadingExplanation, setLoadingExplanation] = useState(false);
    const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const currentQ = questions[currentIndex] ?? null;
    const selectedOption = currentQ ? (answersMap[currentQ.id] ?? null) : null;
    const answered = selectedOption !== null;
    const explanation = currentQ ? (explanationsMap[currentQ.id] ?? null) : null;

    const unfamiliarCount = questions.filter((q) => q.status === 'unfamiliar').length;
    const learningCount = questions.filter((q) => q.status === 'learning').length;
    const newCount = questions.filter((q) => q.status === 'new').length;
    const masteredCount = questions.filter((q) => q.status === 'mastered').length;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const existingSet = await getLatestQuizSet(noteId);
                if (existingSet && !cancelled) {
                    const existingQs = await getQuizQuestions(existingSet.id);
                    setSetId(existingSet.id);
                    setQuestions(existingQs);
                    setCurrentIndex(getResumeQuestionIndex(existingQs));
                    setView('quiz');
                } else if (!cancelled) {
                    setView('generate');
                }
            } catch (err) {
                console.error('Failed to load quiz:', err);
                if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to load quiz'); setView('generate'); }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [noteId]);

    const handleGenerate = useCallback(async () => {
        if (setId) { setError('Quiz has already been generated for this note.'); return; }
        const text = getNoteText();
        if (!text.trim()) { setError('Your note is empty. Write some content first, then generate the quiz.'); return; }
        setIsGenerating(true);
        setError(null);
        try {
            const generated: QuizQuestion[] = await generateQuiz(text);
            const { set, questions: saved } = await saveQuizSet(noteId, generated.map((q) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex })));
            setSetId(set.id);
            setQuestions(saved);
            setCurrentIndex(0);
            setAnswersMap({});
            setExplanationsMap({});
            setLoadingExplanation(false);
            setView('quiz');
        } catch (err) {
            console.error('Quiz generation failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate quiz');
        } finally {
            setIsGenerating(false);
        }
    }, [setId, getNoteText, noteId]);

    const handleSelect = useCallback(async (optionIndex: number) => {
        if (answered || !currentQ) return;
        setAnswersMap((prev) => ({ ...prev, [currentQ.id]: optionIndex }));
        const isCorrect = optionIndex === currentQ.correct_index;
        let newStatus: QuizStatus;
        let newKnowCount: number;
        if (isCorrect) { newKnowCount = currentQ.know_count + 1; newStatus = newKnowCount >= 2 ? 'mastered' : 'learning'; }
        else { newKnowCount = 0; newStatus = 'unfamiliar'; }
        setQuestions((prev) => prev.map((q) => q.id === currentQ.id ? { ...q, status: newStatus, know_count: newKnowCount } : q));
        try { await updateQuizQuestionStatus(currentQ.id, newStatus, newKnowCount); }
        catch (err) { console.error('Failed to update question status:', err); }
    }, [answered, currentQ]);

    const goNext = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setLoadingExplanation(false);
        if (currentIndex < questions.length - 1) { setSlideDir('right'); setCurrentIndex((i) => i + 1); }
        else { setIsAnimating(false); setView('results'); }
    };
    const goPrev = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setLoadingExplanation(false);
        if (currentIndex > 0) { setSlideDir('left'); setCurrentIndex((i) => i - 1); }
        else { setIsAnimating(false); }
    };

    const handleExplain = useCallback(async () => {
        if (!currentQ || loadingExplanation) return;
        setLoadingExplanation(true);
        try {
            const text = getNoteText();
            const result = await generateQuizExplanation(currentQ.question, currentQ.options, currentQ.correct_index, text);
            setExplanationsMap((prev) => ({ ...prev, [currentQ.id]: result }));
        } catch (err) {
            console.error('Failed to generate explanation:', err);
            setExplanationsMap((prev) => ({ ...prev, [currentQ.id]: 'Could not generate explanation. Please try again.' }));
        } finally {
            setLoadingExplanation(false);
        }
    }, [currentQ, loadingExplanation, getNoteText]);

    const handleReset = useCallback(async () => {
        if (!setId) return;
        try {
            await resetQuizProgress(setId);
            const fresh = await getQuizQuestions(setId);
            setQuestions(fresh);
            setCurrentIndex(0);
            setAnswersMap({});
            setExplanationsMap({});
            setLoadingExplanation(false);
            setView('quiz');
        } catch (err) { console.error('Failed to reset quiz:', err); }
    }, [setId]);

    /* ── Loading ── */
    if (view === 'loading') {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 py-20 sm:px-8">
                <div className="h-10 w-10 animate-spin rounded-full border-2" style={{ borderColor: 'var(--border-glass-strong)', borderTopColor: 'var(--brand-emerald)' }} />
                <p className="text-[13px] font-medium text-zinc-400">Loading quiz…</p>
            </div>
        );
    }

    /* ── Generate ── */
    if (view === 'generate') {
        return (
            <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-12 lg:px-16">
                <div className="mb-8 text-center sm:mb-10">
                    <h2
                        className="mb-2 text-2xl font-bold text-zinc-100 sm:mb-3 sm:text-3xl"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                    >
                        ✨ Generate Quiz
                    </h2>
                    <p className="text-[13px] text-zinc-500 sm:text-[15px]">Test yourself with multichoice questions </p>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl px-4 py-3 text-[13px] text-red-400 sm:text-[14px]" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn-emerald group relative flex w-full items-center justify-center gap-2.5 py-3.5 text-[14px] font-bold disabled:cursor-not-allowed disabled:opacity-60 sm:py-4 sm:text-[15px]"
                >
                    {isGenerating ? (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--text-on-brand)' }} />
                            <span>Generating Quiz...</span>
                        </>
                    ) : (
                        <>
                            <MdAutoAwesome className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                            <span>Generate Quiz</span>
                        </>
                    )}
                </button>
            </div>
        );
    }

    /* ── Results ── */
    if (view === 'results') {
        const total = questions.length;
        const masteredPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
        const learningPct = total > 0 ? Math.round((learningCount / total) * 100) : 0;
        const unfamiliarPct = total > 0 ? Math.round((unfamiliarCount / total) * 100) : 0;
        const newPct = total > 0 ? Math.round((newCount / total) * 100) : 0;
        let level = 'Beginner'; let levelEmoji = '🌱';
        if (masteredPct >= 80) { level = 'Expert'; levelEmoji = '🏆'; }
        else if (masteredPct >= 50) { level = 'Advanced'; levelEmoji = '🚀'; }
        else if (masteredPct + learningPct >= 50) { level = 'Intermediate'; levelEmoji = '📚'; }
        let message = '';
        if (masteredPct === 100) { message = "Perfect score! You've mastered everything!"; }
        else if (masteredPct >= 50) { message = `Great progress! ${total - masteredCount} questions left to master.`; }
        else if (learningCount > 0) { message = `You're getting there! Keep studying those ${learningCount} in-progress items.`; }
        else { message = `Time to review! Focus on the ${unfamiliarCount + newCount} questions you haven't mastered yet.`; }

        return (
            <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10 lg:px-16">
                <div
                    className="rounded-2xl p-5 sm:p-8"
                    style={{ background: 'var(--bg-glass-hover)', border: '1px solid var(--border-glass)', backdropFilter: 'blur(12px)' }}
                >
                    <div className="mb-5">
                        <h2
                            className="mb-1 text-xl font-bold text-zinc-100 sm:text-2xl"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            <span className="mr-2">{levelEmoji}</span>{level}
                        </h2>
                        <p className="text-[13px] leading-relaxed text-zinc-400">💡 {message}</p>
                    </div>

                    <div className="h-px" style={{ background: 'var(--border-glass)' }} />

                    {/* Progress bar */}
                    <div className="mt-5 mb-5 sm:mt-6 sm:mb-6">
                        <p className="mb-2 text-[12px] font-semibold text-zinc-400 sm:mb-3 sm:text-[13px]">Your progress:</p>
                        <div className="flex h-7 w-full overflow-hidden rounded-full sm:h-8" style={{ background: 'var(--border-glass)' }}>
                            {masteredPct > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500 sm:text-[11px]" style={{ width: `${masteredPct}%`, background: '#22c55e' }}>{masteredPct}%</div>}
                            {learningPct > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500 sm:text-[11px]" style={{ width: `${learningPct}%`, background: '#f59e0b' }}>{learningPct}%</div>}
                            {unfamiliarPct > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500 sm:text-[11px]" style={{ width: `${unfamiliarPct}%`, background: '#ef4444' }}>{unfamiliarPct}%</div>}
                            {newPct > 0 && <div className="flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500 sm:text-[11px]" style={{ width: `${newPct}%`, background: '#4F9CF9' }}>{newPct}%</div>}
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="mb-6 space-y-2 sm:mb-8">
                        {masteredCount > 0 && <div className="flex items-center gap-3"><span className="w-7 text-right text-[13px] font-bold text-zinc-300 sm:w-8 sm:text-[14px]">{masteredCount}</span><span className="rounded-full bg-green-500/15 px-3 py-0.5 text-[12px] font-bold text-green-400">Mastered</span></div>}
                        {learningCount > 0 && <div className="flex items-center gap-3"><span className="w-7 text-right text-[13px] font-bold text-zinc-300 sm:w-8 sm:text-[14px]">{learningCount}</span><span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-[12px] font-bold text-amber-400">Learning</span></div>}
                        {unfamiliarCount > 0 && <div className="flex items-center gap-3"><span className="w-7 text-right text-[13px] font-bold text-zinc-300 sm:w-8 sm:text-[14px]">{unfamiliarCount}</span><span className="rounded-full bg-red-500/15 px-3 py-0.5 text-[12px] font-bold text-red-400">Unfamiliar</span></div>}
                        {newCount > 0 && <div className="flex items-center gap-3"><span className="w-7 text-right text-[13px] font-bold text-zinc-300 sm:w-8 sm:text-[14px]">{newCount}</span><span className="rounded-full bg-blue-500/15 px-3 py-0.5 text-[12px] font-bold text-blue-400">New</span></div>}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                        <button
                            onClick={handleReset}
                            className="w-full rounded-xl px-5 py-2.5 text-[13px] font-semibold text-zinc-400 transition-all hover:text-zinc-200 sm:w-auto sm:text-[14px]"
                            style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass-strong)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)'; }}
                        >
                            Reset Progress
                        </button>
                        <button
                            onClick={() => { setCurrentIndex(0); setAnswersMap({}); setExplanationsMap({}); setLoadingExplanation(false); setView('quiz'); }}
                            className="btn-emerald flex w-full items-center justify-center gap-2 px-6 py-2.5 text-[13px] font-bold sm:w-auto sm:text-[14px]"
                        >
                            Continue learning →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Error state ── */
    if (error && questions.length === 0) {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 py-20 sm:px-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
                    <PiExam className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-center text-[13px] text-red-400">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="rounded-xl px-5 py-2 text-[13px] font-semibold text-zinc-400 transition-all hover:text-zinc-200"
                    style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                >
                    Try Again
                </button>
            </div>
        );
    }

    /* ── Quiz view ── */
    const slideX = slideDir === 'right' ? 40 : -40;

    return (
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 py-4 sm:px-8 sm:py-6 lg:px-16">
            {/* Header */}
            <div className="mb-3 flex flex-shrink-0 items-center gap-2 sm:mb-4 sm:gap-3">
                <PiExam className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: 'var(--brand-emerald)' }} />
                <h2 className="text-lg font-bold text-zinc-100 sm:text-xl" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Quiz</h2>
            </div>

            {/* Status badges — scrollable row on mobile */}
            <div className="note-tab-scroll mb-4 flex flex-shrink-0 items-center gap-2 overflow-x-auto sm:mb-6 sm:flex-wrap sm:justify-center sm:gap-3">
                <motion.span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-400 sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-[13px]"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0 }}
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 sm:h-2 sm:w-2" />{unfamiliarCount} Unfamiliar
                </motion.span>
                <motion.span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400 sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-[13px]"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.08 }}
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 sm:h-2 sm:w-2" />{learningCount} Learning
                </motion.span>
                <motion.span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-bold text-blue-400 sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-[13px]"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.16 }}
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 sm:h-2 sm:w-2" />{newCount} New
                </motion.span>
                <motion.span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-bold text-green-400 sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-[13px]"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.24 }}
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 sm:h-2 sm:w-2" />{masteredCount} Mastered
                </motion.span>
            </div>

            {/* Question area */}
            <div className="min-h-0 flex-1 overflow-hidden">
                <AnimatePresence mode="wait" initial={false} onExitComplete={() => setIsAnimating(false)}>
                    {currentQ && (
                        <motion.div
                            key={currentQ.id}
                            initial={{ opacity: 0, x: slideX }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -slideX }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                            className="flex h-full flex-col overflow-y-auto"
                        >
                            {/* Question text */}
                            <div className="mb-4 mt-2 flex min-h-[60px] items-center justify-center sm:mb-6 sm:min-h-[80px]">
                                <p className="text-center text-[15px] font-bold leading-relaxed text-zinc-100 sm:text-[18px]">
                                    {currentQ.question}
                                </p>
                            </div>

                            {/* Options — single column on mobile, 2 cols on sm+ */}
                            <div className="mb-4 grid grid-cols-1 gap-2 sm:mb-6 sm:grid-cols-2 sm:gap-3">
                                {currentQ.options.map((option, i) => {
                                    const isSelected = selectedOption === i;
                                    const isCorrect = i === currentQ.correct_index;
                                    let borderColor = 'var(--border-glass)';
                                    let bg = 'var(--bg-glass-hover)';
                                    let opacity = '1';
                                    if (answered) {
                                        if (isCorrect) { borderColor = 'rgba(34,197,94,0.5)'; bg = 'rgba(34,197,94,0.08)'; }
                                        else if (isSelected) { borderColor = 'rgba(239,68,68,0.5)'; bg = 'rgba(239,68,68,0.08)'; }
                                        else { opacity = '0.4'; }
                                    }
                                    return (
                                        <motion.button
                                            key={`${currentQ.id}-${i}`}
                                            initial={{ opacity: 0, y: 24 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                                            onClick={() => handleSelect(i)}
                                            disabled={answered}
                                            className="flex min-h-[52px] items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-colors cursor-pointer sm:min-h-[72px] sm:gap-3 sm:p-4"
                                            style={{ borderColor, background: bg, opacity }}
                                        >
                                            <span className="flex-shrink-0">
                                                {answered && isCorrect ? (
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 sm:h-7 sm:w-7">
                                                        <IoCheckmark className="h-3.5 w-3.5 text-green-400 sm:h-4 sm:w-4" />
                                                    </span>
                                                ) : answered && isSelected && !isCorrect ? (
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 sm:h-7 sm:w-7">
                                                        <IoClose className="h-3.5 w-3.5 text-red-400 sm:h-4 sm:w-4" />
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold sm:h-7 sm:w-7 sm:text-[12px]"
                                                        style={answered
                                                            ? { background: 'var(--border-glass)', color: '#71717a' }
                                                            : { background: 'var(--bg-glass-hover)', color: 'var(--brand-emerald)', border: '1px solid var(--brand-emerald)' }
                                                        }
                                                    >
                                                        {i + 1}
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`pt-0.5 text-[13px] font-medium leading-relaxed sm:text-[15px] ${answered && (isCorrect || isSelected) ? 'text-zinc-200' : answered ? 'text-zinc-500' : 'text-zinc-200'}`}>
                                                {option}
                                            </span>
                                        </motion.button>
                                    );
                                })}
                            </div>

                            {/* Post-answer */}
                            {answered && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                                    className="mb-4"
                                >
                                    {explanation && (
                                        <div
                                            className="mb-4 rounded-xl p-4 sm:p-5"
                                            style={{ border: '1px solid var(--brand-emerald)', background: 'rgba(0,200,150,0.04)' }}
                                        >
                                            <p className="mb-2 text-[13px] font-bold text-zinc-100">Here's an explanation of the correct answer</p>
                                            <p className="text-[13px] leading-relaxed text-zinc-300">{explanation}</p>
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                                        {!explanation && selectedOption !== currentQ?.correct_index && (
                                            <button
                                                onClick={handleExplain}
                                                disabled={loadingExplanation}
                                                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all hover:text-zinc-100 disabled:opacity-50 sm:w-auto sm:px-5"
                                                style={{ border: '1px solid var(--border-glass-strong)', background: 'var(--bg-glass-hover)' }}
                                            >
                                                <MdAutoAwesome className="h-4 w-4" style={{ color: 'var(--brand-emerald)' }} />
                                                {loadingExplanation ? 'Loading…' : 'Explain Answer'}
                                            </button>
                                        )}
                                        <button
                                            onClick={goNext}
                                            className="btn-emerald flex w-full items-center justify-center gap-2 px-6 py-2.5 text-[13px] font-bold sm:w-auto sm:text-[14px]"
                                        >
                                            {currentIndex < questions.length - 1 ? 'Next' : 'See Results'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom nav */}
            <div
                className="flex flex-shrink-0 items-center justify-between pt-3 sm:pt-4"
                style={{ borderTop: '1px solid var(--border-glass)' }}
            >
                <button
                    onClick={goPrev}
                    disabled={currentIndex === 0 || isAnimating}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition-all hover:text-zinc-100 disabled:opacity-30 sm:h-12 sm:w-12"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { !(currentIndex === 0 || isAnimating) && ((e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'); }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                    <FiChevronLeft className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={3} />
                </button>
                <span className="text-[14px] font-bold text-zinc-400 sm:text-[16px]">
                    <span className="text-zinc-100">{currentIndex + 1}</span>/{questions.length}
                </span>
                <button
                    onClick={goNext}
                    disabled={isAnimating}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition-all hover:text-zinc-100 disabled:opacity-30 sm:h-12 sm:w-12"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { !isAnimating && ((e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'); }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                    <FiChevronRight className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};

export default QuizPanel;
