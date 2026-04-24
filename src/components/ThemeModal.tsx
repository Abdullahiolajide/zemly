import React, { useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { RiSunLine, RiMoonLine, RiComputerLine } from 'react-icons/ri';
import { useThemeStore, type ThemeChoice } from '../store/useThemeStore';

interface ThemeModalProps {
    open: boolean;
    onClose: () => void;
}

const options: { value: ThemeChoice; label: string; icon: React.FC<{ className?: string }> }[] = [
    { value: 'light', label: 'Light', icon: RiSunLine },
    { value: 'dark', label: 'Dark', icon: RiMoonLine },
    { value: 'system', label: 'System', icon: RiComputerLine },
];

const ThemeModal: React.FC<ThemeModalProps> = ({ open, onClose }) => {
    const { theme, setTheme } = useThemeStore();

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" />

            {/* Card */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-xl mx-4 rounded-2xl shadow-2xl shadow-black/50 cursor-default animate-[modalSlideUp_250ms_ease-out]"
                style={{
                    background: 'rgba(18, 21, 27, 0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                    aria-label="Close modal"
                >
                    <IoClose className="h-5 w-5" />
                </button>

                <div className="px-8 pt-8 pb-8">
                    <h2
                        className="text-xl font-bold text-zinc-100"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                    >
                        Choose your theme
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Select the appearance you prefer!
                    </p>

                    {/* Theme Options */}
                    <div className="mt-6 grid grid-cols-3 gap-4">
                        {options.map((opt) => {
                            const isActive = theme === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => setTheme(opt.value)}
                                    className={`group flex flex-col items-center gap-2.5 rounded-xl p-2 transition-all duration-200 ${
                                        isActive
                                        ? 'ring-2 ring-offset-0'
                                        : 'ring-1 ring-transparent hover:ring-zinc-700'
                                    }`}
                                    style={isActive ? { '--tw-ring-color': '#00C896' } as React.CSSProperties : {}}
                                >
                                    {/* Preview Card */}
                                    <div
                                        className={`w-full aspect-[4/3] rounded-lg overflow-hidden ${opt.value === 'light'
                                            ? 'bg-zinc-100'
                                            : opt.value === 'dark'
                                                ? 'bg-zinc-800'
                                                : 'bg-gradient-to-r from-zinc-100 via-zinc-100 to-zinc-800'
                                            }`}
                                    >
                                        {/* Mini wireframe preview */}
                                        <div className="flex h-full w-full flex-col p-3 gap-2">
                                            {opt.value === 'light' ? (
                                                <>
                                                    <div className="h-2 w-16 rounded-full bg-zinc-300" />
                                                    <div className="h-2 w-24 rounded-full bg-zinc-300" />
                                                    <div className="h-2 w-20 rounded-full bg-zinc-300" />
                                                    <div className="mt-auto h-2 w-12 rounded-full bg-zinc-300" />
                                                </>
                                            ) : opt.value === 'dark' ? (
                                                <>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                                                        <div className="h-2 w-14 rounded-full bg-zinc-600" />
                                                    </div>
                                                    <div className="h-2 w-full rounded-full bg-zinc-600" />
                                                    <div className="h-2 w-20 rounded-full bg-zinc-600" />
                                                    <div className="mt-auto h-2 w-12 rounded-full bg-zinc-600" />
                                                </>
                                            ) : (
                                                <div className="flex h-full w-full">
                                                    <div className="flex w-1/2 flex-col gap-2 p-1 pr-2">
                                                        <div className="h-2 w-12 rounded-full bg-zinc-300" />
                                                        <div className="h-2 w-16 rounded-full bg-zinc-300" />
                                                        <div className="mt-auto h-2 w-8 rounded-full bg-zinc-300" />
                                                    </div>
                                                    <div className="flex w-1/2 flex-col gap-2 p-1 pl-2">
                                                        <div className="h-2 w-12 rounded-full bg-zinc-600" />
                                                        <div className="h-2 w-16 rounded-full bg-zinc-600" />
                                                        <div className="mt-auto h-2 w-8 rounded-full bg-zinc-600" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Label */}
                                    <div className="flex items-center gap-1.5">
                                        <span style={{ color: isActive ? '#00C896' : '#71717a' }}>
                                            <opt.icon className="h-4 w-4" />
                                        </span>
                                        <span
                                            className={`text-sm font-medium`}
                                            style={{ color: isActive ? '#00C896' : '#71717a' }}
                                        >
                                            {opt.label}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeModal;
