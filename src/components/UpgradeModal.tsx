import { useState } from 'react';
import { IoClose, IoCheckmarkCircle, IoInfinite } from 'react-icons/io5';
import { BsMic, BsChatDots } from 'react-icons/bs';
import { TbCards } from 'react-icons/tb';
import { PiExam, PiLightningFill } from 'react-icons/pi';
import { openPremiumCheckout } from '../lib/paymentService';
import Logo from './Logo';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
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

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, userEmail }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [billing, setBilling] = useState<BillingCycle>('annual');

    if (!isOpen) return null;

    const monthlyPrice = 13.99;
    const annualTotal = 94.99;
    const annualMonthly = +(annualTotal / 12).toFixed(2);

    const handleUpgrade = async () => {
        try {
            setIsLoading(true);
            setError(null);

            await openPremiumCheckout({
                customerEmail: userEmail,
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
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-100 animate-[fadeIn_150ms_ease-out]"
                onClick={onClose}
            >
                <div
                    className="relative mx-4 w-full max-w-[600px] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl p-0 animate-[modalSlideUp_250ms_ease-out]"
                    style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-glass-strong)',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-all hover:text-zinc-200"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
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
                            className="text-xl font-bold text-zinc-100"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                        >
                            Unlock Everything with Unlimited
                        </h2>
                        <p className="mt-2 text-[15px] text-zinc-500">
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
                                    <div className="font-semibold text-zinc-200">{feature.text}</div>
                                    <div className="text-[13px] text-zinc-500">{feature.detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="px-10 pb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setBilling('annual')}
                            className="relative rounded-xl px-4 py-4 text-left transition-all duration-200"
                            style={{
                                background: billing === 'annual' ? 'rgba(0,200,150,0.12)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${billing === 'annual' ? 'rgba(0,200,150,0.45)' : 'rgba(255,255,255,0.08)'}`,
                                boxShadow: billing === 'annual' ? '0 10px 24px rgba(0,200,150,0.12)' : 'none',
                            }}
                        >
                            <span className="absolute -top-2.5 left-4 rounded-full bg-[#00C896] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0D0F12]">
                                43% off
                            </span>
                            <span className="block text-[13px] font-semibold text-zinc-200">Annual</span>
                            <div className="mt-1.5 flex items-baseline gap-1.5">
                                <span
                                    className="text-2xl font-extrabold"
                                    style={{
                                        fontFamily: "'Bricolage Grotesque', sans-serif",
                                        color: billing === 'annual' ? '#00C896' : 'var(--text-sidebar-hover)',
                                    }}
                                >
                                    ${annualMonthly.toFixed(2)}
                                </span>
                                <span className="text-sm text-zinc-500">/ mo</span>
                            </div>
                            <p className="mt-0.5 text-[12px] text-zinc-600">
                                billed yearly · ${annualTotal.toFixed(2)}/yr
                            </p>
                        </button>

                        <button
                            onClick={() => setBilling('monthly')}
                            className="relative rounded-xl px-4 py-4 text-left transition-all duration-200"
                            style={{
                                background: billing === 'monthly' ? 'rgba(0,200,150,0.08)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${billing === 'monthly' ? 'rgba(0,200,150,0.45)' : 'rgba(255,255,255,0.08)'}`,
                                boxShadow: billing === 'monthly' ? '0 10px 24px rgba(0,200,150,0.12)' : 'none',
                            }}
                        >
                            <span className="block text-[13px] font-semibold text-zinc-200">Monthly</span>
                            <div className="mt-1.5 flex items-baseline gap-1.5">
                                <span
                                    className="text-2xl font-extrabold"
                                    style={{
                                        fontFamily: "'Bricolage Grotesque', sans-serif",
                                        color: billing === 'monthly' ? '#00C896' : 'var(--text-sidebar-hover)',
                                    }}
                                >
                                    ${monthlyPrice.toFixed(2)}
                                </span>
                                <span className="text-sm text-zinc-500">/ mo</span>
                            </div>
                            <p className="mt-0.5 text-[12px] text-zinc-600">
                                billed monthly
                            </p>
                        </button>
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
