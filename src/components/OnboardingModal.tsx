import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import {
    MdUploadFile,
    MdOutlineQuiz,
} from 'react-icons/md';
import {
    IoDocumentTextOutline,
    IoMicOutline,
    IoLinkOutline,
} from 'react-icons/io5';
import { TbCards, TbRefresh } from 'react-icons/tb';
import { BsChatDots, BsMic } from 'react-icons/bs';
import { supabase } from '../lib/supabaseClient';
import confetti from 'canvas-confetti';

const TOTAL_SCREENS = 6;

/* ── Pill selector (single-select) ── */
interface PillGroupProps {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
}

const PillGroup: React.FC<PillGroupProps> = ({ label, options, value, onChange }) => (
    <div className="mt-4">
        <p
            className="mb-2.5 text-[13px] font-medium"
            style={{ color: 'var(--text-sidebar)' }}
        >
            {label}
        </p>
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const selected = value === opt;
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(selected ? '' : opt)}
                        className="rounded-full px-3.5 py-1.5 text-[12px] sm:text-[13px] font-medium transition-all duration-200"
                        style={{
                            background: selected
                                ? 'rgba(0,200,150,0.15)'
                                : 'var(--bg-glass-hover)',
                            border: `1px solid ${selected ? '#00C896' : 'var(--border-glass)'}`,
                            color: selected
                                ? '#00C896'
                                : 'var(--text-sidebar-hover)',
                            boxShadow: selected
                                ? '0 0 0 2px rgba(0,200,150,0.08)'
                                : 'none',
                        }}
                    >
                        {opt}
                    </button>
                );
            })}
        </div>
    </div>
);

/* ── Feature icon card ── */
interface FeatureCardProps {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    title: string;
    desc: string;
    color: string;
    delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, desc, color, delay }) => (
    <div
        className="onboarding-card-enter flex items-start gap-3 rounded-xl p-3 sm:p-3.5"
        style={{
            background: 'var(--bg-glass-hover)',
            border: '1px solid var(--border-glass)',
            animationDelay: `${delay}ms`,
        }}
    >
        <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${color}18` }}
        >
            <Icon className="h-[18px] w-[18px]" style={{ color }} />
        </div>
        <div className="min-w-0">
            <p
                className="text-[13px] sm:text-[14px] font-semibold"
                style={{ color: 'var(--text-sidebar-hover)' }}
            >
                {title}
            </p>
            <p
                className="mt-0.5 text-[11px] sm:text-[12px] leading-relaxed"
                style={{ color: 'var(--text-sidebar)' }}
            >
                {desc}
            </p>
        </div>
    </div>
);

/* ── Progress dots ── */
const ProgressDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
    <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
            <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                    width: i === current ? 20 : 6,
                    height: 6,
                    background:
                        i === current
                            ? '#00C896'
                            : i < current
                                ? 'rgba(0,200,150,0.4)'
                                : 'var(--border-glass-strong)',
                }}
            />
        ))}
    </div>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
interface OnboardingModalProps {
    open: boolean;
    onComplete: () => void;
    userId: string;
    googleDisplayName?: string | null;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({
    open,
    onComplete,
    userId,
    googleDisplayName,
}) => {
    const navigate = useNavigate();
    const [screen, setScreen] = useState(0);
    const [direction, setDirection] = useState<'forward' | 'back'>('forward');
    const [isAnimating, setIsAnimating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    /* Screen 1 fields */
    const [displayName, setDisplayName] = useState('');
    const [referralSource, setReferralSource] = useState('');
    const [userType, setUserType] = useState('');

    const nameInputRef = useRef<HTMLInputElement>(null);
    const confettiFired = useRef(false);

    /* Pre-fill name from Google OAuth */
    useEffect(() => {
        if (open && googleDisplayName) {
            setDisplayName(googleDisplayName);
        }
    }, [open, googleDisplayName]);

    /* Focus name input on screen 0 */
    useEffect(() => {
        if (open && screen === 0) {
            setTimeout(() => nameInputRef.current?.focus(), 350);
        }
    }, [open, screen]);

    /* Confetti on screen 5 (final) */
    useEffect(() => {
        if (screen === 5 && !confettiFired.current) {
            confettiFired.current = true;
            setTimeout(() => {
                confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#00C896', '#00DBA8', '#4F9CF9', '#F5A623', '#E07070'],
                });
            }, 400);
        }
    }, [screen]);

    const goTo = useCallback(
        (next: number) => {
            if (isAnimating) return;
            setDirection(next > screen ? 'forward' : 'back');
            setIsAnimating(true);
            setTimeout(() => {
                setScreen(next);
                setIsAnimating(false);
            }, 250);
        },
        [screen, isAnimating],
    );

    /* Save screen 1 data */
    const saveProfileData = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await supabase.from('profiles').upsert(
                {
                    id: userId,
                    display_name: displayName.trim(),
                    referral_source: referralSource || null,
                    user_type: userType || null,
                },
                { onConflict: 'id' },
            );
        } catch (err) {
            console.error('[Onboarding] Failed to save profile:', err);
        } finally {
            setIsSaving(false);
        }
    };

    /* Complete onboarding */
    const handleComplete = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await supabase
                .from('profiles')
                .update({ has_completed_onboarding: true })
                .eq('id', userId);
            onComplete();
            navigate('/dashboard');
        } catch (err) {
            console.error('[Onboarding] Failed to complete:', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!open) return null;

    /* ── Screen renderers ── */
    const renderScreen = () => {
        switch (screen) {
            /* ─── Screen 1: About You ─── */
            case 0:
                return (
                    <div className="flex flex-col px-6 sm:px-8 py-6 sm:py-8">
                        <h2
                            className="text-lg sm:text-xl font-bold"
                            style={{
                                color: 'var(--text-sidebar-hover)',
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                letterSpacing: '-0.02em',
                            }}
                        >
                            About You
                        </h2>
                        <p
                            className="mt-1 text-[13px]"
                            style={{ color: 'var(--text-sidebar)' }}
                        >
                            Help us personalise your experience.
                        </p>

                        {/* Name */}
                        <div className="mt-5">
                            <label
                                htmlFor="onboarding-name"
                                className="mb-1.5 block text-[13px] font-medium"
                                style={{ color: 'var(--text-sidebar)' }}
                            >
                                What should we call you? <span className="text-red-400">*</span>
                            </label>
                            <input
                                ref={nameInputRef}
                                id="onboarding-name"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your name"
                                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
                                style={{
                                    background: 'var(--bg-glass-hover)',
                                    border: '1px solid var(--border-glass)',
                                    color: 'var(--text-sidebar-hover)',
                                    fontFamily: "'DM Sans', sans-serif",
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#00C896';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.12)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border-glass)';
                                    e.target.style.boxShadow = '';
                                }}
                            />
                        </div>

                        <PillGroup
                            label="How did you hear about Zemly?"
                            options={[
                                'TikTok',
                                'Instagram',
                                'Twitter/X',
                                'Family or Friends',
                                'Search Engine',
                                'Other',
                            ]}
                            value={referralSource}
                            onChange={setReferralSource}
                        />

                        <PillGroup
                            label="What best describes you?"
                            options={[
                                'High School Student',
                                'Undergraduate',
                                'Postgraduate / Masters',
                                'PhD Researcher',
                                'Working Professional',
                                'Other',
                            ]}
                            value={userType}
                            onChange={setUserType}
                        />
                    </div>
                );

            /* ─── Screen 2: Welcome ─── */
            case 1:
                return (
                    <div className="flex flex-col items-center justify-center px-6 sm:px-8 py-10 sm:py-14 text-center">
                        <h2
                            className="onboarding-welcome-title text-2xl sm:text-3xl font-extrabold"
                            style={{
                                color: 'var(--text-sidebar-hover)',
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                letterSpacing: '-0.03em',
                            }}
                        >
                            Welcome to Zemly,{' '}
                            <span style={{ color: '#00C896' }}>
                                {displayName || 'there'}
                            </span>
                        </h2>
                        <p
                            className="onboarding-welcome-subtitle mt-3 text-[14px] sm:text-[16px]"
                            style={{ color: 'var(--text-sidebar)' }}
                        >
                            Learn faster. Ace your exams.
                        </p>

                        {/* decorative glow */}
                        <div
                            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full blur-[80px]"
                            style={{ background: 'rgba(0,200,150,0.12)' }}
                        />
                    </div>
                );

            /* ─── Screen 3: Create from Anything ─── */
            case 2:
                return (
                    <div className="flex flex-col px-6 sm:px-8 py-6 sm:py-8">
                        <h2
                            className="text-lg sm:text-xl font-bold"
                            style={{
                                color: 'var(--text-sidebar-hover)',
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Start with any learning material
                        </h2>
                        <p
                            className="mt-1.5 text-[13px] leading-relaxed"
                            style={{ color: 'var(--text-sidebar)' }}
                        >
                            Upload files, paste content, drop a YouTube link — we'll handle the rest.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2.5">
                            <FeatureCard icon={MdUploadFile} title="PDF / Document" desc="Upload any file format" color="#4F9CF9" delay={0} />
                            <FeatureCard icon={IoMicOutline} title="Audio File" desc="Record or upload audio" color="#F5A623" delay={80} />
                            <FeatureCard icon={IoLinkOutline} title="YouTube Link" desc="Paste any video URL" color="#E07070" delay={160} />
                            <FeatureCard icon={IoDocumentTextOutline} title="Paste Text" desc="Type or paste content" color="#00C896" delay={240} />
                        </div>
                    </div>
                );

            /* ─── Screen 4: Test Yourself ─── */
            case 3:
                return (
                    <div className="flex flex-col px-6 sm:px-8 py-6 sm:py-8">
                        <h2
                            className="text-lg sm:text-xl font-bold"
                            style={{
                                color: 'var(--text-sidebar-hover)',
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Challenge your knowledge
                        </h2>
                        <p
                            className="mt-1.5 text-[13px] leading-relaxed"
                            style={{ color: 'var(--text-sidebar)' }}
                        >
                            Turn your notes into active learning, instantly.
                        </p>
                        <div className="mt-5 flex flex-col gap-2.5">
                            <FeatureCard icon={MdOutlineQuiz} title="Quizzes" desc="Auto-generated practice exams from your notes" color="#4F9CF9" delay={0} />
                            <FeatureCard icon={TbCards} title="Flashcards" desc="Active recall made effortless" color="#00C896" delay={80} />
                            <FeatureCard icon={TbRefresh} title="Review Mode" desc="Spaced repetition to lock in knowledge" color="#F5A623" delay={160} />
                        </div>
                    </div>
                );

            /* ─── Screen 5: AI Study Partner ─── */
            case 4:
                return (
                    <div className="flex flex-col px-6 sm:px-8 py-6 sm:py-8">
                        <h2
                            className="text-lg sm:text-xl font-bold"
                            style={{
                                color: 'var(--text-sidebar-hover)',
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Go deeper with AI
                        </h2>
                        <p
                            className="mt-1.5 text-[13px] leading-relaxed"
                            style={{ color: 'var(--text-sidebar)' }}
                        >
                            Every note comes with a podcast and a tutor built from your own content.
                        </p>
                        <div className="mt-5 flex flex-col gap-2.5">
                            <FeatureCard icon={BsMic} title="Podcast" desc="Listen to AI-generated study podcasts on the go" color="#E07070" delay={0} />
                            <FeatureCard icon={BsChatDots} title="AI Chat / Tutor" desc="Ask questions and get explanations from your notes" color="#4F9CF9" delay={80} />
                        </div>
                    </div>
                );

            /* ─── Screen 6: You're All Set ─── */
            case 5:
                return (
                    <div className="flex flex-col items-center justify-center px-6 sm:px-8 py-10 sm:py-14 text-center">
                        {/* Checkmark */}
                        <div
                            className="onboarding-checkmark mb-5 flex h-16 w-16 items-center justify-center rounded-full"
                            style={{
                                background: 'rgba(0,200,150,0.12)',
                                border: '2px solid rgba(0,200,150,0.3)',
                            }}
                        >
                            <svg
                                className="h-8 w-8"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#00C896"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h2
                            className="text-2xl sm:text-3xl font-extrabold"
                            style={{
                                color: 'var(--text-sidebar-hover)',
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                letterSpacing: '-0.03em',
                            }}
                        >
                            You're ready,{' '}
                            <span style={{ color: '#00C896' }}>
                                {displayName || 'there'}
                            </span>
                            !
                        </h2>
                        <p
                            className="mt-2 text-[14px] sm:text-[15px]"
                            style={{ color: 'var(--text-sidebar)' }}
                        >
                            Create your first note and start mastering your material.
                        </p>
                    </div>
                );

            default:
                return null;
        }
    };

    const canGoNext =
        screen === 0 ? displayName.trim().length > 0 : true;

    const handleNext = async () => {
        if (!canGoNext || isAnimating) return;
        if (screen === 0) {
            await saveProfileData();
        }
        goTo(screen + 1);
    };

    const handleBack = () => {
        if (screen > 0 && !isAnimating) goTo(screen - 1);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]">
            <div
                className="relative mx-4 flex w-full max-w-[480px] flex-col overflow-hidden rounded-2xl shadow-2xl animate-[modalSlideUp_300ms_ease-out]"
                style={{
                    height: 'min(580px, calc(100vh - 2rem))',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-glass-strong)',
                    boxShadow:
                        '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.03)',
                }}
            >
                {/* ── Top bar: back + progress ── */}
                <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <div className="w-8">
                        {screen > 0 && (
                            <button
                                onClick={handleBack}
                                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                                style={{
                                    color: 'var(--text-sidebar)',
                                    background: 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background =
                                        'var(--bg-glass-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background =
                                        'transparent';
                                }}
                                aria-label="Go back"
                            >
                                <IoChevronBack className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                    <ProgressDots current={screen} total={TOTAL_SCREENS} />
                    <div className="w-8" />
                </div>

                {/* ── Content area (fixed height, animated) ── */}
                <div className="relative flex-1 overflow-y-auto">
                    <div
                        key={screen}
                        className={`onboarding-screen-${direction === 'forward' ? 'enter' : 'enter-back'}`}
                    >
                        {renderScreen()}
                    </div>
                </div>

                {/* ── Bottom bar: action button ── */}
                <div className="px-6 pb-5 pt-3 sm:px-8">
                    {screen < 5 ? (
                        <button
                            onClick={() => void handleNext()}
                            disabled={!canGoNext || isSaving}
                            className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-[14px] font-bold text-white transition-transform duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                                background:
                                    'linear-gradient(90deg, #00A87A 0%, #008F66 50%, #00A87A 100%)',
                                backgroundSize: '200% 100%',
                                animation: 'buttonWave 3s linear infinite',
                            }}
                            onMouseEnter={(e) => {
                                if (canGoNext)
                                    (e.currentTarget as HTMLElement).style.transform =
                                        'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.transform = '';
                            }}
                        >
                            {isSaving ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : screen === 0 ? (
                                'Next'
                            ) : (
                                'Continue'
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => void handleComplete()}
                            disabled={isSaving}
                            className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-[14px] font-bold text-white transition-transform duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                                background:
                                    'linear-gradient(90deg, #00A87A 0%, #008F66 50%, #00A87A 100%)',
                                backgroundSize: '200% 100%',
                                animation: 'buttonWave 3s linear infinite',
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.transform =
                                    'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.transform = '';
                            }}
                        >
                            {isSaving ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                'Create My First Note'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
