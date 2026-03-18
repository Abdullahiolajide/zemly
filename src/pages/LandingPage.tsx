import { Link } from 'react-router-dom';
import { IoCreateOutline } from 'react-icons/io5';
import { IoMdChatbubbles } from 'react-icons/io';
import { MdAutoAwesome, MdLock, MdSpeed, MdDevices } from 'react-icons/md';
import Navbar from '../components/Navbar';

const features = [
    {
        icon: IoCreateOutline,
        title: 'Smart Notes',
        description:
            'Create rich, structured notes powered by AI that organizes your thoughts automatically.',
        accent: '#00C896',
        span: 'md:col-span-2',
    },
    {
        icon: IoMdChatbubbles,
        title: 'AI Assistant',
        description:
            'Chat with your notes. Ask questions, get summaries, and discover connections effortlessly.',
        accent: '#4F9CF9',
        span: 'md:col-span-1',
    },
    {
        icon: MdAutoAwesome,
        title: 'Auto-Organize',
        description: 'Tags, folders, and links generated for you — zero effort.',
        accent: '#F5A623',
        span: 'md:col-span-1',
    },
    {
        icon: MdLock,
        title: 'End-to-End Encryption',
        description: 'Your data stays yours. Military-grade encryption at rest and in transit.',
        accent: '#00C896',
        span: 'md:col-span-1',
    },
    {
        icon: MdSpeed,
        title: 'Blazing Fast',
        description: 'Optimistic UI with instant sync. Your notes load before you blink.',
        accent: '#4F9CF9',
        span: 'md:col-span-1',
    },
    {
        icon: MdDevices,
        title: 'Cross-Platform',
        description: 'Seamlessly switch between desktop, tablet, and mobile — everything syncs.',
        accent: '#F5A623',
        span: 'md:col-span-1',
    },
];

const LandingPage: React.FC = () => {
    return (
        <div className="relative min-h-screen bg-zinc-950">
            <Navbar />

            {/* ── Hero Section ── */}
            <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 lg:px-8">
                {/* Deep background glows */}
                <div className="pointer-events-none absolute inset-0">
                    <div
                        className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 rounded-full opacity-20 blur-[160px]"
                        style={{ background: 'radial-gradient(circle, #00C896 0%, transparent 65%)' }}
                    />
                    <div
                        className="absolute right-10 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full opacity-10 blur-[120px]"
                        style={{ background: 'radial-gradient(circle, #4F9CF9 0%, transparent 65%)' }}
                    />
                </div>

                <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center">
                    {/* Badge */}
                    <div
                        className="animate-fade-up mb-8 inline-flex items-center gap-2.5 rounded-full border px-5 py-2 text-sm"
                        style={{
                            borderColor: 'rgba(0, 200, 150, 0.25)',
                            background: 'rgba(0, 200, 150, 0.08)',
                            color: '#00C896',
                        }}
                    >
                        <MdAutoAwesome className="h-4 w-4" />
                        <span className="font-medium tracking-wide">AI-Powered Note Taking</span>
                    </div>

                    {/* Headline */}
                    <h1
                        className="animate-fade-up animate-delay-1 mb-7 font-extrabold leading-[1.05] tracking-tight text-zinc-100"
                        style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        Your thoughts,{' '}
                        <span style={{ color: '#00C896' }}>
                            supercharged
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p
                        className="animate-fade-up animate-delay-2 mb-12 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                        Zemly uses AI to help you capture, organize, and rediscover your
                        ideas faster than ever. Stop searching — start knowing.
                    </p>

                    {/* CTA Buttons */}
                    <div className="animate-fade-up animate-delay-3 flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
                        <Link
                            to="/auth"
                            className="btn-emerald w-full px-9 py-4 text-base sm:w-auto"
                        >
                            Start for Free →
                        </Link>
                        <a
                            href="#features"
                            className="w-full rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-8 py-4 text-center text-base font-semibold text-zinc-400 backdrop-blur-sm transition-all duration-200 hover:border-zinc-700 hover:text-zinc-200 sm:w-auto"
                        >
                            See Features
                        </a>
                    </div>

                    {/* Trust Line */}
                    <p className="animate-fade-up animate-delay-4 mt-10 text-sm text-zinc-600">
                        Free to start · No credit card required · Cancel anytime
                    </p>

                    {/* Hero terminal card */}
                    <div
                        className="animate-fade-up animate-delay-5 mt-20 w-full max-w-2xl overflow-hidden rounded-2xl"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            backdropFilter: 'blur(16px)',
                            boxShadow: '0 0 60px rgba(0, 200, 150, 0.12), 0 24px 64px rgba(0,0,0,0.5)',
                        }}
                    >
                        {/* Window chrome */}
                        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
                            <div className="h-3 w-3 rounded-full bg-red-500/70" />
                            <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: '#00C896', opacity: 0.7 }} />
                            <span className="ml-3 text-xs text-zinc-600">zemly — note.md</span>
                        </div>
                        {/* Fake editor content */}
                        <div className="px-8 py-7 text-left">
                            <p className="mb-3 text-xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                                Q3 Product Strategy
                            </p>
                            <p className="mb-2 text-sm text-zinc-400">
                                The core insight this quarter is that retention beats acquisition. Users who engage with the AI summary feature are 3x more likely to return within 7 days.
                            </p>
                            <div className="mt-4 space-y-2">
                                {['Improve onboarding to highlight AI features early', 'A/B test summary length on mobile', 'Ship flashcard export to Anki'].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm text-zinc-400">
                                        <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#00C896' }} />
                                        {item}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: 'rgba(0,200,150,0.1)', color: '#00C896' }}>
                                <MdAutoAwesome className="h-3.5 w-3.5" />
                                AI summary generated
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Bento Feature Grid ── */}
            <section
                id="features"
                className="relative mx-auto max-w-6xl px-6 pb-32 pt-8 lg:px-8"
            >
                <div className="mb-20 text-center animate-fade-up">
                    <h2
                        className="mb-5 font-extrabold tracking-tight text-zinc-100"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        Everything you need to{' '}
                        <span style={{ color: '#00C896' }}>think better</span>
                    </h2>
                    <p className="mx-auto max-w-xl text-base text-zinc-500 sm:text-lg">
                        A suite of intelligent tools crafted to make note-taking effortless
                        and insightful.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {features.map((feature, i) => (
                        <div
                            key={feature.title}
                            className={`animate-fade-up group relative overflow-hidden rounded-2xl p-7 transition-all duration-300 sm:p-8 ${feature.span}`}
                            style={{
                                animationDelay: `${i * 80}ms`,
                                background: 'rgba(255, 255, 255, 0.025)',
                                border: '1px solid rgba(255, 255, 255, 0.07)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            {/* Hover glow */}
                            <div
                                className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-[80px] transition-opacity duration-500 group-hover:opacity-30"
                                style={{ background: feature.accent }}
                            />

                            <div className="relative z-10">
                                <div
                                    className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
                                    style={{ background: `${feature.accent}18`, border: `1px solid ${feature.accent}30` }}
                                >
                                    <feature.icon className="h-5 w-5" style={{ color: feature.accent }} />
                                </div>
                                <h3
                                    className="mb-2.5 text-lg font-bold text-zinc-100"
                                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                                >
                                    {feature.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-zinc-500">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Bottom glow border on hover */}
                            <div
                                className="absolute inset-x-0 bottom-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}60, transparent)` }}
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA Section ── */}
            <section className="mx-auto max-w-4xl px-6 pb-32 text-center lg:px-8">
                <div
                    className="animate-fade-up relative overflow-hidden rounded-2xl px-8 py-20 sm:px-16"
                    style={{
                        background: 'rgba(0, 200, 150, 0.04)',
                        border: '1px solid rgba(0, 200, 150, 0.15)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 0 80px rgba(0, 200, 150, 0.08)',
                    }}
                >
                    {/* Background accent glow */}
                    <div
                        className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full opacity-20 blur-[100px]"
                        style={{ background: '#00C896' }}
                    />
                    <div className="relative z-10">
                        <h2
                            className="mb-5 font-extrabold tracking-tight text-zinc-100"
                            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Ready to supercharge your notes?
                        </h2>
                        <p className="mx-auto mb-10 max-w-md text-base text-zinc-400">
                            Join thousands of thinkers who use Zemly to capture and connect their best ideas.
                        </p>
                        <Link
                            to="/auth"
                            className="btn-emerald px-10 py-4 text-base"
                        >
                            Get Started — It's Free
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/40 py-10">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ background: '#00C896' }}
                        >
                            <span className="text-xs font-bold text-zinc-950">Z</span>
                        </div>
                        <span
                            className="text-sm font-bold text-zinc-400"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Zemly
                        </span>
                    </div>
                    <p className="text-sm text-zinc-600">
                        &copy; {new Date().getFullYear()} Zemly. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
