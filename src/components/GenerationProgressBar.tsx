import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Simulated progress bar for long-running AI generation tasks ──
 *
 * Since AI generation calls are single HTTP requests with no streaming
 * progress, this component simulates a progress bar that moves at a
 * realistic pace through labeled phases, keeping users engaged while
 * they wait.
 *
 * Usage:
 *   <GenerationProgressBar
 *       active={isGenerating}
 *       phases={[
 *           { label: 'Analyzing your notes…', durationMs: 4000, toPercent: 30 },
 *           { label: 'Generating questions…', durationMs: 8000, toPercent: 85 },
 *           { label: 'Finishing up…', durationMs: 4000, toPercent: 96 },
 *       ]}
 *       accentColor="#00C896"
 *   />
 */

export interface ProgressPhase {
    /** Text shown below the bar during this phase */
    label: string;
    /** Estimated time for this phase in ms */
    durationMs: number;
    /** Target % at the end of this phase (max 96 — final 4% snaps on completion) */
    toPercent: number;
}

interface GenerationProgressBarProps {
    /** Whether the generation is currently in progress */
    active: boolean;
    /** Ordered list of phases to display */
    phases: ProgressPhase[];
    /** Accent color for the bar (defaults to emerald) */
    accentColor?: string;
}

const TICK_MS = 50;

const GenerationProgressBar: React.FC<GenerationProgressBarProps> = ({
    active,
    phases,
    accentColor = '#00C896',
}) => {
    const [progress, setProgress] = useState(0);
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef(0);
    const phaseStartRef = useRef(0);
    const fromPercentRef = useRef(0);

    const cleanup = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    /* Start / stop the simulation */
    useEffect(() => {
        if (active && phases.length > 0) {
            setProgress(0);
            setPhaseIndex(0);
            setVisible(true);
            startTimeRef.current = Date.now();
            phaseStartRef.current = Date.now();
            fromPercentRef.current = 0;

            intervalRef.current = setInterval(() => {
                setPhaseIndex((pi) => {
                    const phase = phases[pi];
                    if (!phase) return pi;

                    const elapsed = Date.now() - phaseStartRef.current;
                    const t = Math.min(1, elapsed / phase.durationMs);

                    // Ease-out curve so it slows down naturally
                    const eased = 1 - Math.pow(1 - t, 2.5);
                    const from = fromPercentRef.current;
                    const to = phase.toPercent;
                    const newProgress = from + (to - from) * eased;

                    setProgress(newProgress);

                    // Move to next phase when time is up
                    if (t >= 1 && pi < phases.length - 1) {
                        const nextIdx = pi + 1;
                        fromPercentRef.current = to;
                        phaseStartRef.current = Date.now();
                        return nextIdx;
                    }

                    return pi;
                });
            }, TICK_MS);
        } else if (!active && visible) {
            // Generation completed — snap to 100% and fade out
            setProgress(100);
            cleanup();
            const timer = setTimeout(() => setVisible(false), 600);
            return () => clearTimeout(timer);
        }

        return cleanup;
    }, [active, phases, visible, cleanup]);

    if (!visible) return null;

    const currentPhase = phases[phaseIndex];
    const label = currentPhase?.label ?? 'Working…';
    const completed = !active && progress >= 100;

    return (
        <div
            className="mt-5 overflow-hidden rounded-xl px-5 py-4 transition-opacity duration-500"
            style={{
                background: 'var(--bg-glass-hover)',
                border: '1px solid var(--border-glass)',
                opacity: completed ? 0 : 1,
            }}
        >
            {/* Bar */}
            <div className="mb-2.5 flex items-center gap-3">
                <div
                    className="h-2 flex-1 overflow-hidden rounded-full"
                    style={{ background: 'var(--border-glass)' }}
                >
                    <div
                        className="h-full rounded-full transition-[width] duration-200 ease-out"
                        style={{
                            width: `${Math.min(100, progress)}%`,
                            background: `linear-gradient(90deg, ${accentColor}99, ${accentColor})`,
                            boxShadow: `0 0 8px ${accentColor}40`,
                        }}
                    />
                </div>
                <span
                    className="shrink-0 text-[12px] font-bold tabular-nums"
                    style={{ color: accentColor }}
                >
                    {Math.min(100, Math.round(progress))}%
                </span>
            </div>

            {/* Phase label */}
            <p className="text-[13px] font-medium text-zinc-400">
                {completed ? 'Done!' : label}
            </p>
        </div>
    );
};

/* ── Pre-defined phase presets ── */

export const QUIZ_PHASES: ProgressPhase[] = [
    { label: 'Analysing your notes…', durationMs: 3000, toPercent: 20 },
    { label: 'Generating questions & answers…', durationMs: 12000, toPercent: 80 },
    { label: 'Finalising quiz…', durationMs: 5000, toPercent: 96 },
];

export const FLASHCARD_PHASES: ProgressPhase[] = [
    { label: 'Scanning your notes…', durationMs: 3000, toPercent: 25 },
    { label: 'Creating flashcards…', durationMs: 10000, toPercent: 82 },
    { label: 'Finishing up…', durationMs: 4000, toPercent: 96 },
];

export const PODCAST_SCRIPT_PHASES: ProgressPhase[] = [
    { label: 'Reading your notes…', durationMs: 3000, toPercent: 15 },
    { label: 'Writing the conversation script…', durationMs: 15000, toPercent: 85 },
    { label: 'Polishing dialogue…', durationMs: 5000, toPercent: 96 },
];

export const PODCAST_AUDIO_PHASES: ProgressPhase[] = [
    { label: 'Preparing voice synthesis…', durationMs: 3000, toPercent: 10 },
    { label: 'Generating audio with AI voices…', durationMs: 25000, toPercent: 88 },
    { label: 'Encoding final audio…', durationMs: 5000, toPercent: 96 },
];

export const NOTE_GENERATION_PHASES: ProgressPhase[] = [
    { label: 'Extracting content…', durationMs: 4000, toPercent: 30 },
    { label: 'Analyzing structure…', durationMs: 6000, toPercent: 60 },
    { label: 'Formatting your note…', durationMs: 5000, toPercent: 96 },
];

export default GenerationProgressBar;
