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
        setLoadingExplanation(false);
        if (currentIndex < questions.length - 1) { setSlideDir('right'); setCurrentIndex((i) => i + 1); }
        else { setView('results'); }
    };
    const goPrev = () => {
        setLoadingExplanation(false);
        if (currentIndex > 0) { setSlideDir('left'); setCurrentIndex((i) => i - 1); }
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
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 px-8 py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,200,150,0.2)', borderTopColor: '#00C896' }} />
                <p className="text-[14px] font-medium text-zinc-400">Loading quiz…</p>
            </div>
        );
    }

    /* ── Generate ── */
    if (view === 'generate') {
        return (
            <div className="mx-auto w-full max-w-2xl px-8 py-12 lg:px-16">
                <div className="mb-10 text-center">
                    <h2
                        className="mb-3 text-3xl font-bold text-zinc-100"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                    >
                        ✨ Generate Quiz
                    </h2>
                    <p className="text-[15px] text-zinc-500">One-time generation based on note length (15–30 questions)</p>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl px-4 py-3 text-[14px] text-red-400" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn-emerald group relative flex w-full items-center justify-center gap-2.5 py-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isGenerating ? (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(13,15,18,0.3)', borderTopColor: '#0D0F12' }} />
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
            <div className="mx-auto w-full max-w-4xl px-8 py-10 lg:px-16">
                <div
                    className="rounded-2xl p-8"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
                >
                    <div className="mb-6">
                        <h2
                            className="mb-1 text-2xl font-bold text-zinc-100"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            <span className="mr-2">{levelEmoji}</span>{level}
                        </h2>
                        <p className="text-[14px] leading-relaxed text-zinc-400">💡 {message}</p>
                    </div>

                    <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                    {/* Progress bar */}
                    <div className="mt-6 mb-6">
                        <p className="mb-3 text-[13px] font-semibold text-zinc-400">Your progress:</p>
                        <div className="flex h-8 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            {masteredPct > 0 && <div className="flex items-center justify-center text-[11px] font-bold text-white transition-all duration-500" style={{ width: `${masteredPct}%`, background: '#22c55e' }}>{masteredPct}%</div>}
                            {learningPct > 0 && <div className="flex items-center justify-center text-[11px] font-bold text-white transition-all duration-500" style={{ width: `${learningPct}%`, background: '#f59e0b' }}>{learningPct}%</div>}
                            {unfamiliarPct > 0 && <div className="flex items-center justify-center text-[11px] font-bold text-white transition-all duration-500" style={{ width: `${unfamiliarPct}%`, background: '#ef4444' }}>{unfamiliarPct}%</div>}
                            {newPct > 0 && <div className="flex items-center justify-center text-[11px] font-bold text-white transition-all duration-500" style={{ width: `${newPct}%`, background: '#4F9CF9' }}>{newPct}%</div>}
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="mb-8 space-y-2">
                        {masteredCount > 0 && <div className="flex items-center gap-3"><span className="w-8 text-right text-[14px] font-bold text-zinc-300">{masteredCount}</span><span className="rounded-full bg-green-500/15 px-3 py-0.5 text-[12px] font-semibold text-green-400">Mastered</span></div>}
                        {learningCount > 0 && <div className="flex items-center gap-3"><span className="w-8 text-right text-[14px] font-bold text-zinc-300">{learningCount}</span><span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-[12px] font-semibold text-amber-400">Learning</span></div>}
                        {unfamiliarCount > 0 && <div className="flex items-center gap-3"><span className="w-8 text-right text-[14px] font-bold text-zinc-300">{unfamiliarCount}</span><span className="rounded-full bg-red-500/15 px-3 py-0.5 text-[12px] font-semibold text-red-400">Unfamiliar</span></div>}
                        {newCount > 0 && <div className="flex items-center gap-3"><span className="w-8 text-right text-[14px] font-bold text-zinc-300">{newCount}</span><span className="rounded-full bg-blue-500/15 px-3 py-0.5 text-[12px] font-semibold text-blue-400">New</span></div>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={handleReset}
                            className="rounded-xl px-5 py-2.5 text-[13px] font-semibold text-zinc-400 transition-all hover:text-zinc-200"
                            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        >
                            Reset Progress
                        </button>
                        <button
                            onClick={() => { setCurrentIndex(0); setAnswersMap({}); setExplanationsMap({}); setLoadingExplanation(false); setView('quiz'); }}
                            className="btn-emerald flex items-center gap-2 px-6 py-2.5 text-[13px] font-bold"
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
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 px-8 py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
                    <PiExam className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-center text-[14px] text-red-400">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="rounded-xl px-5 py-2 text-[13px] font-semibold text-zinc-400 transition-all hover:text-zinc-200"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                >
                    Try Again
                </button>
            </div>
        );
    }

    /* ── Quiz view ── */
    const slideX = slideDir === 'right' ? 40 : -40;

    return (
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-8 py-6 lg:px-16">
            {/* Header */}
            <div className="mb-4 flex flex-shrink-0 items-center gap-3">
                <PiExam className="h-6 w-6" style={{ color: '#00C896' }} />
                <h2 className="text-xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Quiz</h2>
            </div>

            {/* Status badges */}
            <div className="mb-6 flex flex-shrink-0 flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-semibold text-red-400">
                    <span className="h-2 w-2 rounded-full bg-red-400" />{unfamiliarCount} Unfamiliar
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[12px] font-semibold text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />{learningCount} Learning
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-[12px] font-semibold text-blue-400">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />{newCount} New
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-[12px] font-semibold text-green-400">
                    <span className="h-2 w-2 rounded-full bg-green-400" />{masteredCount} Mastered
                </span>
            </div>

            {/* Question area */}
            <div className="min-h-0 flex-1 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                    {currentQ && (
                        <motion.div
                            key={currentQ.id}
                            initial={{ opacity: 0, x: slideX }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -slideX }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                            className="flex h-full flex-col overflow-y-auto"
                        >
                            <div className="mb-6 mt-4 flex min-h-[80px] items-center justify-center">
                                <p className="text-center text-[16px] font-bold leading-relaxed text-zinc-100">
                                    {currentQ.question}
                                </p>
                            </div>

                            {/* Options */}
                            <div className="mb-6 grid grid-cols-2 gap-3">
                                {currentQ.options.map((option, i) => {
                                    const isSelected = selectedOption === i;
                                    const isCorrect = i === currentQ.correct_index;
                                    let borderColor = 'rgba(255,255,255,0.08)';
                                    let bg = 'rgba(255,255,255,0.025)';
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
                                            className="flex min-h-[72px] items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors"
                                            style={{ borderColor, background: bg, opacity }}
                                        >
                                            <span className="flex-shrink-0">
                                                {answered && isCorrect ? (
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/20">
                                                        <IoCheckmark className="h-4 w-4 text-green-400" />
                                                    </span>
                                                ) : answered && isSelected && !isCorrect ? (
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20">
                                                        <IoClose className="h-4 w-4 text-red-400" />
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
                                                        style={answered
                                                            ? { background: 'rgba(255,255,255,0.06)', color: '#71717a' }
                                                            : { background: 'rgba(0,200,150,0.12)', color: '#00C896' }
                                                        }
                                                    >
                                                        {i + 1}
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`pt-0.5 text-[15px] leading-relaxed ${answered && isCorrect ? 'font-medium text-green-300' : answered && isSelected && !isCorrect ? 'text-red-300' : answered ? 'text-zinc-500' : 'text-zinc-300'}`}>
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
                                            className="mb-4 rounded-xl p-4"
                                            style={{ border: '1px solid rgba(0,200,150,0.2)', background: 'rgba(0,200,150,0.06)' }}
                                        >
                                            <p className="text-[13px] leading-relaxed text-zinc-300">{explanation}</p>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-end gap-3">
                                        {!explanation && selectedOption !== currentQ?.correct_index && (
                                            <button
                                                onClick={handleExplain}
                                                disabled={loadingExplanation}
                                                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-zinc-300 transition-all hover:text-zinc-100 disabled:opacity-50"
                                                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                                            >
                                                <MdAutoAwesome className="h-4 w-4" style={{ color: '#00C896' }} />
                                                {loadingExplanation ? 'Loading…' : 'Explain Answer'}
                                            </button>
                                        )}
                                        <button
                                            onClick={goNext}
                                            className="btn-emerald flex items-center gap-2 px-6 py-2.5 text-[13px] font-bold"
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
                className="flex flex-shrink-0 items-center justify-between pt-4"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
                <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-zinc-300 transition-all hover:text-zinc-100 disabled:opacity-30"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { !(currentIndex === 0) && ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'); }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                    <FiChevronLeft className="h-7 w-7" strokeWidth={3} />
                </button>
                <span className="text-[15px] font-bold text-zinc-400">
                    <span className="text-zinc-100">{currentIndex + 1}</span>/{questions.length}
                </span>
                <button
                    onClick={() => { if (currentIndex < questions.length - 1) { setSlideDir('right'); setCurrentIndex((i) => i + 1); } }}
                    disabled={currentIndex === questions.length - 1}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-zinc-300 transition-all hover:text-zinc-100 disabled:opacity-30"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { !(currentIndex === questions.length - 1) && ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'); }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                    <FiChevronRight className="h-7 w-7" strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};

export default QuizPanel;
