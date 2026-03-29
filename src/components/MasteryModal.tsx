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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import('canvas-confetti').then((mod: any) => {
            const confetti = mod.default || mod;

            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.5 },
                colors: ['#00C896', '#00A87A', '#22c55e', '#f59e0b', '#4F9CF9'],
            });

            setTimeout(() => {
                confetti({ particleCount: 80, spread: 120, origin: { y: 0.4, x: 0.3 }, colors: ['#00C896', '#00A87A', '#22c55e'] });
                confetti({ particleCount: 80, spread: 120, origin: { y: 0.4, x: 0.7 }, colors: ['#00C896', '#00A87A', '#4F9CF9'] });
            }, 300);
        });

        return () => { hasFireRef.current = false; };
    }, [open]);

    if (!open) return null;

    const progressPercent = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ animation: 'fadeIn 0.3s ease' }} />

            {/* Modal */}
            <div
                className="relative z-10 mx-4 w-full max-w-md rounded-2xl p-8 shadow-2xl"
                style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-glass-strong)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
                    animation: 'modalSlideUp 0.4s ease',
                }}
            >
                <h2
                    className="mb-3 text-center text-3xl font-extrabold text-zinc-100"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                >
                    Mastery Achieved! 🎉
                </h2>
                <p className="mb-8 text-center text-[15px] text-zinc-500">
                    Congratulations! You've mastered all your flashcards!
                </p>

                {/* Progress Bar */}
                <div className="mb-8 overflow-hidden rounded-full" style={{ background: 'var(--border-glass)' }}>
                    <div
                        className="flex h-10 items-center justify-center rounded-full text-[14px] font-bold transition-all duration-1000 ease-out"
                        style={{
                            width: `${progressPercent}%`,
                            background: 'var(--brand-emerald)',
                            color: 'var(--text-on-brand)',
                            boxShadow: '0 0 20px rgba(0,200,150,0.2)',
                        }}
                    >
                        <span>✨ {progressPercent}%</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={onReset}
                        className="rounded-xl px-6 py-2.5 text-[14px] font-semibold text-zinc-400 transition-all hover:text-zinc-200"
                        style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass-strong)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)'; }}
                    >
                        Reset Progress
                    </button>
                    <button
                        onClick={onExit}
                        className="btn-emerald rounded-xl px-6 py-2.5 text-[14px] font-semibold"
                    >
                        Exit Learn
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MasteryModal;
