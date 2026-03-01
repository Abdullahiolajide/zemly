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

/* ── Sub-view types ── */
type QuizView = 'loading' | 'quiz' | 'results';

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

    /* Per-question interaction state (keyed by question id) */
    const [answersMap, setAnswersMap] = useState<Record<number, number>>({}); // questionId -> selectedOptionIndex
    const [explanationsMap, setExplanationsMap] = useState<Record<number, string>>({});
    const [loadingExplanation, setLoadingExplanation] = useState(false);
    const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);

    const currentQ = questions[currentIndex] ?? null;

    /* Derived state for current question */
    const selectedOption = currentQ ? (answersMap[currentQ.id] ?? null) : null;
    const answered = selectedOption !== null;
    const explanation = currentQ ? (explanationsMap[currentQ.id] ?? null) : null;

    /* ── Status counts ── */
    const unfamiliarCount = questions.filter((q) => q.status === 'unfamiliar').length;
    const learningCount = questions.filter((q) => q.status === 'learning').length;
    const newCount = questions.filter((q) => q.status === 'new').length;
    const masteredCount = questions.filter((q) => q.status === 'mastered').length;

    /* ── Load or auto-generate on first visit ── */
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
                    // Auto-generate on first visit
                    setIsGenerating(true);
                    await autoGenerate();
                }
            } catch (err) {
                console.error('Failed to load quiz:', err);
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load quiz');
                    setView('quiz');
                }
            }
        };

        const autoGenerate = async () => {
            const text = getNoteText();
            if (!text.trim()) {
                setError('Your note is empty. Write some content first, then come back!');
                setView('quiz');
                return;
            }

            try {
                const generated: QuizQuestion[] = await generateQuiz(text);
                const { set, questions: saved } = await saveQuizSet(
                    noteId,
                    generated.map((q) => ({
                        question: q.question,
                        options: q.options,
                        correctIndex: q.correctIndex,
                    })),
                );
                if (!cancelled) {
                    setSetId(set.id);
                    setQuestions(saved);
                    setView('quiz');
                }
            } catch (err) {
                console.error('Quiz generation failed:', err);
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to generate quiz');
                    setView('quiz');
                }
            }
        };

        load();
        return () => { cancelled = true; };
    }, [noteId]);

    /* ── Handle answer selection ── */
    const handleSelect = useCallback(
        async (optionIndex: number) => {
            if (answered || !currentQ) return;

            setAnswersMap((prev) => ({ ...prev, [currentQ.id]: optionIndex }));

            const isCorrect = optionIndex === currentQ.correct_index;

            let newStatus: QuizStatus;
            let newKnowCount: number;

            if (isCorrect) {
                newKnowCount = currentQ.know_count + 1;
                newStatus = newKnowCount >= 2 ? 'mastered' : 'learning';
            } else {
                newKnowCount = 0;
                newStatus = 'unfamiliar';
            }

            // Optimistic update
            setQuestions((prev) =>
                prev.map((q) =>
                    q.id === currentQ.id
                        ? { ...q, status: newStatus, know_count: newKnowCount }
                        : q,
                ),
            );

            try {
                await updateQuizQuestionStatus(currentQ.id, newStatus, newKnowCount);
            } catch (err) {
                console.error('Failed to update question status:', err);
            }
        },
        [answered, currentQ],
    );

    /* ── Navigate ── */
    const goNext = () => {
        setLoadingExplanation(false);
        if (currentIndex < questions.length - 1) {
            setSlideDir('right');
            setCurrentIndex((i) => i + 1);
        } else {
            setView('results');
        }
    };

    const goPrev = () => {
        setLoadingExplanation(false);
        if (currentIndex > 0) {
            setSlideDir('left');
            setCurrentIndex((i) => i - 1);
        }
    };

    /* ── On-demand explanation ── */
    const handleExplain = useCallback(async () => {
        if (!currentQ || loadingExplanation) return;
        setLoadingExplanation(true);
        try {
            const text = getNoteText();
            const result = await generateQuizExplanation(
                currentQ.question,
                currentQ.options,
                currentQ.correct_index,
                text,
            );
            setExplanationsMap((prev) => ({ ...prev, [currentQ.id]: result }));
        } catch (err) {
            console.error('Failed to generate explanation:', err);
            setExplanationsMap((prev) => ({ ...prev, [currentQ.id]: 'Could not generate explanation. Please try again.' }));
        } finally {
            setLoadingExplanation(false);
        }
    }, [currentQ, loadingExplanation, getNoteText]);

    /* ── Reset progress ── */
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
        } catch (err) {
            console.error('Failed to reset quiz:', err);
        }
    }, [setId]);

    /* ── Loading ── */
    if (view === 'loading') {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 px-8 py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                {isGenerating ? (
                    <>
                        <p className="text-[14px] font-medium text-zinc-400">Generating your quiz…</p>
                        <p className="text-[12px] text-zinc-600">The AI is crafting questions based on your notes</p>
                    </>
                ) : (
                    <p className="text-[14px] font-medium text-zinc-400">Loading quiz…</p>
                )}
            </div>
        );
    }

    /* ── Results view ── */
    if (view === 'results') {
        const total = questions.length;
        const masteredPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
        const learningPct = total > 0 ? Math.round((learningCount / total) * 100) : 0;
        const unfamiliarPct = total > 0 ? Math.round((unfamiliarCount / total) * 100) : 0;
        const newPct = total > 0 ? Math.round((newCount / total) * 100) : 0;

        // Determine level
        let level = 'Beginner';
        let levelEmoji = '🌱';
        if (masteredPct >= 80) { level = 'Expert'; levelEmoji = '🏆'; }
        else if (masteredPct >= 50) { level = 'Advanced'; levelEmoji = '🚀'; }
        else if (masteredPct + learningPct >= 50) { level = 'Intermediate'; levelEmoji = '📚'; }

        // Motivational message
        let message = '';
        if (masteredPct === 100) {
            message = "Perfect score! You've mastered everything!";
        } else if (masteredPct >= 50) {
            message = `Great progress! ${total - masteredCount} questions left to master.`;
        } else if (learningCount > 0) {
            message = `You're getting there! Keep studying to turn those ${learningCount} learning items into mastered ones.`;
        } else {
            message = `Time to review! Focus on the ${unfamiliarCount + newCount} questions you haven't mastered yet.`;
        }

        return (
            <div className="mx-auto w-full max-w-4xl px-8 py-10 lg:px-16">
                <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/60 p-8 shadow-xl shadow-black/20">
                    {/* Level header */}
                    <div className="mb-6">
                        <h2 className="mb-1 text-2xl font-bold text-zinc-100">
                            <span className="mr-2">{levelEmoji}</span>
                            {level}
                        </h2>
                        <p className="text-[14px] leading-relaxed text-zinc-400">
                            💡 {message}
                        </p>
                    </div>

                    <div className="h-px bg-zinc-800/60" />

                    {/* Progress bar */}
                    <div className="mt-6 mb-6">
                        <p className="mb-3 text-[13px] font-semibold text-zinc-400">Your progress:</p>
                        <div className="flex h-8 w-full overflow-hidden rounded-full">
                            {masteredPct > 0 && (
                                <div
                                    className="flex items-center justify-center bg-green-500 text-[11px] font-bold text-white transition-all duration-500"
                                    style={{ width: `${masteredPct}%` }}
                                >
                                    {masteredPct}%
                                </div>
                            )}
                            {learningPct > 0 && (
                                <div
                                    className="flex items-center justify-center bg-amber-500 text-[11px] font-bold text-white transition-all duration-500"
                                    style={{ width: `${learningPct}%` }}
                                >
                                    {learningPct}%
                                </div>
                            )}
                            {unfamiliarPct > 0 && (
                                <div
                                    className="flex items-center justify-center bg-red-500 text-[11px] font-bold text-white transition-all duration-500"
                                    style={{ width: `${unfamiliarPct}%` }}
                                >
                                    {unfamiliarPct}%
                                </div>
                            )}
                            {newPct > 0 && (
                                <div
                                    className="flex items-center justify-center bg-blue-500 text-[11px] font-bold text-white transition-all duration-500"
                                    style={{ width: `${newPct}%` }}
                                >
                                    {newPct}%
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="mb-8 space-y-2">
                        {masteredCount > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="w-8 text-right text-[14px] font-bold text-zinc-300">{masteredCount}</span>
                                <span className="rounded-full bg-green-500/15 px-3 py-0.5 text-[12px] font-semibold text-green-400">Mastered</span>
                            </div>
                        )}
                        {learningCount > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="w-8 text-right text-[14px] font-bold text-zinc-300">{learningCount}</span>
                                <span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-[12px] font-semibold text-amber-400">Learning</span>
                            </div>
                        )}
                        {unfamiliarCount > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="w-8 text-right text-[14px] font-bold text-zinc-300">{unfamiliarCount}</span>
                                <span className="rounded-full bg-red-500/15 px-3 py-0.5 text-[12px] font-semibold text-red-400">Unfamiliar</span>
                            </div>
                        )}
                        {newCount > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="w-8 text-right text-[14px] font-bold text-zinc-300">{newCount}</span>
                                <span className="rounded-full bg-blue-500/15 px-3 py-0.5 text-[12px] font-semibold text-blue-400">New</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={handleReset}
                            className="rounded-xl border border-zinc-700 px-5 py-2.5 text-[13px] font-semibold text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-200"
                        >
                            Reset Progress
                        </button>
                        <button
                            onClick={() => {
                                setCurrentIndex(0);
                                setAnswersMap({});
                                setExplanationsMap({});
                                setLoadingExplanation(false);
                                setView('quiz');
                            }}
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/35 hover:brightness-110"
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
                    className="rounded-xl border border-zinc-700 px-5 py-2 text-[13px] font-semibold text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-200"
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
            {/* ── Header ── */}
            <div className="mb-4 flex flex-shrink-0 items-center gap-3">
                <PiExam className="h-6 w-6 text-indigo-400" />
                <h2 className="text-xl font-bold text-zinc-100">Quiz</h2>
            </div>

            {/* ── Status badges ── */}
            <div className="mb-6 flex flex-shrink-0 flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-semibold text-red-400">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    {unfamiliarCount} Unfamiliar
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[12px] font-semibold text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {learningCount} Learning
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-[12px] font-semibold text-blue-400">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    {newCount} New
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-[12px] font-semibold text-green-400">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    {masteredCount} Mastered
                </span>
            </div>

            {/* ── Scrollable question area ── */}
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
                        {/* Question text — fixed height so layout is stable */}
                        <div className="mb-6 mt-4 flex min-h-[80px] items-center justify-center">
                            <p className="text-center text-[16px] font-bold leading-relaxed text-zinc-100">
                                {currentQ.question}
                            </p>
                        </div>

                        {/* Options grid — staggered entrance from bottom */}
                        <div className="mb-6 grid grid-cols-2 gap-3">
                            {currentQ.options.map((option, i) => {
                                const isSelected = selectedOption === i;
                                const isCorrect = i === currentQ.correct_index;

                                let optionClasses = 'border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50 cursor-pointer';

                                if (answered) {
                                    if (isCorrect) {
                                        optionClasses = 'border-green-500/50 bg-green-500/10';
                                    } else if (isSelected && !isCorrect) {
                                        optionClasses = 'border-red-500/50 bg-red-500/10';
                                    } else {
                                        optionClasses = 'border-zinc-800/40 bg-zinc-900/20 opacity-50';
                                    }
                                }

                                return (
                                    <motion.button
                                        key={`${currentQ.id}-${i}`}
                                        initial={{ opacity: 0, y: 24 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.35,
                                            delay: 0.1 + i * 0.07,
                                            ease: [0.25, 0.1, 0.25, 1],
                                        }}
                                        onClick={() => handleSelect(i)}
                                        disabled={answered}
                                        className={`flex min-h-[72px] items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${optionClasses}`}
                                    >
                                        {/* Number or icon */}
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
                                                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${
                                                    answered
                                                        ? 'bg-zinc-800/50 text-zinc-500'
                                                        : 'bg-indigo-500/15 text-indigo-400'
                                                }`}>
                                                    {i + 1}
                                                </span>
                                            )}
                                        </span>

                                        <span className={`pt-0.5 text-[15px] leading-relaxed ${
                                            answered && isCorrect
                                                ? 'font-medium text-green-300'
                                                : answered && isSelected && !isCorrect
                                                    ? 'text-red-300'
                                                    : answered
                                                        ? 'text-zinc-500'
                                                        : 'text-zinc-300'
                                        }`}>
                                            {option}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>

                        {/* ── Post-answer actions ── */}
                        {answered && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                                className="mb-4"
                            >
                                {/* Explanation area */}
                                {explanation && (
                                    <div className="mb-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                                        <p className="text-[13px] leading-relaxed text-zinc-300">
                                            {explanation}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3">
                                    {!explanation && selectedOption !== currentQ?.correct_index && (
                                        <button
                                            onClick={handleExplain}
                                            disabled={loadingExplanation}
                                            className="flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-2.5 text-[13px] font-semibold text-zinc-300 transition-all hover:bg-gray-200 hover:text-zinc-100 disabled:opacity-50"
                                        >
                                            <MdAutoAwesome className="h-4 w-4 text-indigo-400" />
                                            {loadingExplanation ? 'Loading…' : 'Correct Answer Explained'}
                                        </button>
                                    )}
                                    <button
                                        onClick={goNext}
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/35 hover:brightness-110"
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

            {/* ── Bottom navigation (pinned) ── */}
            <div className="flex flex-shrink-0 items-center justify-between border-t border-zinc-800/40 pt-4">
                <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-zinc-300 transition-all hover:bg-zinc-800/50 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
                >
                    <FiChevronLeft className="h-7 w-7" strokeWidth={3} />
                </button>
                <span className="text-[15px] font-bold text-zinc-400">
                    <span className="text-zinc-100">{currentIndex + 1}</span>/{questions.length}
                </span>
                <button
                    onClick={() => { if (currentIndex < questions.length - 1) { setSlideDir('right'); setCurrentIndex((i) => i + 1); } }}
                    disabled={currentIndex === questions.length - 1}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-zinc-300 transition-all hover:bg-zinc-800/50 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
                >
                    <FiChevronRight className="h-7 w-7" strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};

export default QuizPanel;
