import { useState } from 'react';
import { IoClose, IoCheckmarkCircle, IoInfinite } from 'react-icons/io5';
import { BsMic, BsChatDots } from 'react-icons/bs';
import { TbCards } from 'react-icons/tb';
import { PiExam, PiLightningFill } from 'react-icons/pi';
import { openPremiumCheckout } from '../lib/paymentService';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    userId?: string;
}

const features = [
    {
        icon: IoInfinite,
        text: 'Unlimited notes',
        detail: '2 hour lecture → done in minutes',
        color: '#00C896',
    },
    {
        icon: PiExam,
        text: 'Unlimited practice exams',
        detail: "Keep practicing until you're perfect",
        color: '#00C896',
    },
    {
        icon: BsChatDots,
        text: 'AI tutor 24/7',
        detail: 'Get real help on what matters',
        color: '#00C896',
    },
    {
        icon: BsMic,
        text: 'Unlimited study podcasts',
        detail: 'Review material between classes',
        color: '#00C896',
    },
    {
        icon: TbCards,
        text: 'Unlimited flashcards',
        detail: 'Active recall made effortless',
        color: '#00C896',
    },
    {
        icon: PiLightningFill,
        text: 'Faster AI',
        detail: 'Polish notes in seconds, not hours',
        color: '#00C896',
    },
];

type BillingCycle = 'monthly' | 'annual';

const pricingOptions: Array<{
    billing: BillingCycle;
    label: string;
    badge?: string;
    weeklyPrice: string;
    originalPrice: string;
    billedText: string;
}> = [
    {
        billing: 'annual',
        label: 'Annual',
        badge: 'Most Popular',
        weeklyPrice: '$1.88/week',
        originalPrice: '$127.99',
        billedText: 'Billed $97.99 US per year',
    },
    {
        billing: 'monthly',
        label: 'Monthly',
        weeklyPrice: '$3.74/week',
        originalPrice: '$19.99',
        billedText: 'Billed $14.99 US per month',
    },
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, userEmail, userId }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [billing, setBilling] = useState<BillingCycle>('annual');

    if (!isOpen) return null;

    const cardSurface = 'var(--bg-sidebar)';
    const cardBorder = 'var(--border-glass-strong)';
    const cardText = 'var(--text-sidebar-hover)';
    const cardMutedText = 'var(--text-sidebar)';

    const handleUpgrade = async () => {
        try {
            setIsLoading(true);
            setError(null);

            await openPremiumCheckout({
                customerEmail: userEmail,
                customerId: userId,
                billingCycle: billing,
                onEvent: (event) => {
                    if (event.event_type === 'checkout.opened') {
                        onClose();
                    }

                    if (event.event_type === 'checkout.payment_page_opened') {
                        setIsLoading(false);
                    }

                    if (event.event_type === 'checkout.closed') {
                        setIsLoading(false);
                    }

                    if (event.event_type === 'checkout.error') {
                        setIsLoading(false);
                        setError(event.data?.message || 'Checkout error occurred');
                    }
                },
            });
            // onClose();
        } catch (err) {
            console.error('Checkout error:', err);
            setIsLoading(false);
            setError((err as Error).message || 'Failed to open checkout');
        }
    };

    return (
        <>
            {/* Main Upgrade Modal */}
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-100 cursor-pointer animate-[fadeIn_150ms_ease-out]"
                onClick={onClose}
            >
                <div
                    className="relative mx-4 w-full max-w-[600px] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl p-0 cursor-default animate-[modalSlideUp_250ms_ease-out]"
                    style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-glass-strong)',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.03)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-all"
                    style={{
                        background: 'var(--bg-glass-hover)',
                        color: 'var(--text-sidebar)',
                    }}
                    aria-label="Close upgrade modal"
                >
                    <IoClose className="h-5 w-5" />
                </button>

                {/* Header with gradient accent */}
                <div
                    className="relative overflow-hidden rounded-t-2xl px-10 pb-6 pt-10 text-center"
                    style={{
                        background: 'linear-gradient(180deg, rgba(0,200,150,0.08) 0%, transparent 100%)',
                    }}
                >
                    {/* Decorative glow */}
                    <div
                        className="pointer-events-none absolute left-1/2 top-0 h-24 w-56 -translate-x-1/2 rounded-full blur-3xl"
                        style={{ background: 'rgba(0,200,150,0.12)' }}
                    />

                    <div className="relative">
                        <h2
                            className="text-xl font-bold"
                            style={{
                                color: cardText,
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Unlock Everything with Unlimited
                        </h2>
                        <p className="mt-2 text-[15px]" style={{ color: cardMutedText }}>
                            Zemly AI is Faster and more Intelligent with Unlimited
                        </p>
                    </div>
                </div>

                {/* Features list */}
                <div className="px-10 py-5">
                    <div className="gri grid-cols- gap-x-4 gap-y- sm:grid-cols-2">
                        {features.map((feature) => (
                            <div
                                key={feature.text}
                                className="flex items-start gap-3 my-2"
                            >
                                <div
                                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                                    style={{ background: `${feature.color}18` }}
                                >
                                    <IoCheckmarkCircle className="h-4 w-4" style={{ color: feature.color }} />
                                </div>
                                <div className="min-w-0 flex items-center gap-3 text-[15px] leading-relaxed">
                                    <div className="font-semibold" style={{ color: cardText }}>{feature.text}</div>
                                    <div className="text-[13px]" style={{ color: cardMutedText }}>{feature.detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="px-10 pb-5">
                    <div className="flex flex-col gap-3">
                        {pricingOptions.map((option) => {
                            const isSelected = billing === option.billing;
                            const isAnnual = option.billing === 'annual';

                            return (
                                <div key={option.billing} className="relative ">
                                    {option.badge && (
                                        <div className="absolute left-1/2 -top-3 z-10 -translate-x-1/2">
                                            <span
                                                className="inline-flex items-center rounded-full bg-[#00C896] px-3 py-1 text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(0,200,150,0.28)]"
                                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                                            >
                                                {option.badge}
                                            </span>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setBilling(option.billing)}
                                        className="flex w-full items-center justify-between gap-4 rounded-[18px] px-4 py-3 text-left transition-all duration-200"
                                        style={{
                                            background: isSelected
                                                ? 'linear-gradient(180deg, rgba(0,200,150,0.12) 0%, rgba(0,200,150,0.06) 100%)'
                                                : cardSurface,
                                            border: `1px solid ${isSelected ? '#00C896' : cardBorder}`,
                                            boxShadow: isSelected
                                                ? '0 10px 24px rgba(0,200,150,0.12), inset 0 1px 0 rgba(255,255,255,0.62)'
                                                : '0 1px 0 rgba(255,255,255,0.04) inset',
                                        }}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span
                                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                                                style={{
                                                    borderColor: isSelected ? '#00C896' : 'rgba(148,163,184,0.65)',
                                                    boxShadow: isSelected ? '0 0 0 4px rgba(0,200,150,0.10)' : 'none',
                                                }}
                                            >
                                                {isSelected && <span className="h-3 w-3 rounded-full bg-[#00C896]" />}
                                            </span>

                                            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                                                <span className="text-[16px] font-semibold" style={{ color: cardText }}>
                                                    {option.label}
                                                </span>
                                                {isAnnual && (
                                                    <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-500">
                                                        Save 45%
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <div
                                                className="text-[20px] font-semibold leading-none"
                                                style={{
                                                    color: cardText,
                                                    fontFamily: "'Bricolage Grotesque', sans-serif",
                                                }}
                                            >
                                                {option.weeklyPrice}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center justify-end gap-1.5 text-[14px]" style={{ color: cardMutedText }}>
                                                <span className="line-through">{option.originalPrice}</span>
                                                <span>{option.billedText}</span>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CTA Button */}
                <div className="px-10 pb-8 pt-2">
                    {error && (
                        <p className="mb-3 rounded-lg px-3 py-2 text-[12px] font-medium text-red-400"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                        >
                            {error}
                        </p>
                    )}

                    <button
                        onClick={handleUpgrade}
                        disabled={isLoading}
                        className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3.5 text-base font-bold text-white transition-transform duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                            background: 'linear-gradient(90deg, #00A87A 0%, #008F66 50%, #00A87A 100%)',
                            backgroundSize: '200% 100%',
                            animation: 'buttonWave 3s linear infinite',
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.transform = '';
                        }}
                    >
                        {isLoading ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                <span>Preparing checkout…</span>
                            </>
                        ) : (
                            <span>Upgrade Now</span>
                        )}
                    </button>
                </div>
            </div>
            </div>
        </>
    );
};

export default UpgradeModal;
