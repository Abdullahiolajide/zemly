import { useEffect, useRef } from 'react';

interface MasteryModalProps {
    open: boolean;
    totalCards: number;
    masteredCards: number;
    onReset: () => void;
    onExit: () => void;
}

const MasteryModal: React.FC<MasteryModalProps> = ({
    open,
    totalCards,
    masteredCards,
    onReset,
    onExit,
}) => {
    const hasFireRef = useRef(false);

    useEffect(() => {
        if (!open || hasFireRef.current) return;
        hasFireRef.current = true;

        // Dynamic import so canvas-confetti doesn't bloat the bundle
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import('canvas-confetti').then((mod: any) => {
            const confetti = mod.default || mod;

            // Burst from center
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.5 },
                colors: ['#6366f1', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b'],
            });

            // Second wave
            setTimeout(() => {
                confetti({
                    particleCount: 80,
                    spread: 120,
                    origin: { y: 0.4, x: 0.3 },
                });
                confetti({
                    particleCount: 80,
                    spread: 120,
                    origin: { y: 0.4, x: 0.7 },
                });
            }, 300);
        });

        return () => {
            hasFireRef.current = false;
        };
    }, [open]);

    if (!open) return null;

    const progressPercent = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.3s ease' }} />

            {/* Modal */}
            <div
                className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-zinc-800/60 bg-zinc-900 p-8 shadow-2xl"
                style={{ animation: 'modalSlideUp 0.4s ease' }}
            >
                <h2 className="mb-3 text-center text-3xl font-extrabold text-zinc-100">
                    Mastery Achieved!
                </h2>
                <p className="mb-8 text-center text-[15px] text-zinc-400">
                    Congratulations! You've mastered all flashcards! 🎉
                </p>

                {/* Progress Bar */}
                <div className="mb-8 overflow-hidden rounded-full bg-zinc-800">
                    <div
                        className="flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-[14px] font-bold text-white transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    >
                        <span>✨ {progressPercent}% ✨</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={onReset}
                        className="rounded-xl border border-zinc-700 px-6 py-2.5 text-[14px] font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-zinc-100"
                    >
                        Reset Progress
                    </button>
                    <button
                        onClick={onExit}
                        className="rounded-xl border border-zinc-700 px-6 py-2.5 text-[14px] font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-zinc-100"
                    >
                        Exit Learn
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MasteryModal;
