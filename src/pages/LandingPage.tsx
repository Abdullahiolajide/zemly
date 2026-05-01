import { Link } from 'react-router-dom';
import { MdUploadFile } from 'react-icons/md';
import { IoDocumentTextOutline, IoMicOutline, IoLinkOutline } from 'react-icons/io5';
import { BsChatDots, BsMic } from 'react-icons/bs';
import { TbCards } from 'react-icons/tb';
import { PiExam } from 'react-icons/pi';
import Navbar from '../components/Navbar';
import Logo from '../components/Logo';
import { useAuthStore } from '../store/useAuthStore';

const inputMethods = [
    {
        icon: MdUploadFile,
        label: 'Document Upload',
        description: 'PDF, Word, PowerPoint, or any file — Zemly AI reads it and builds your note.',
        accent: '#4F9CF9',
        tags: ['PDF', 'DOCX', 'PPTX', 'TXT'],
    },
    {
        icon: IoDocumentTextOutline,
        label: 'Blank Document',
        description: 'Open a fresh editor and write from scratch, then unlock every AI feature.',
        accent: '#00C896',
        tags: ['Rich editor', 'AI formatting', 'Auto-save'],
    },
    {
        icon: IoMicOutline,
        label: 'Audio / Recording',
        description: 'Upload a lecture recording or any audio file and let Zemly AI transcribe and summarize it.',
        accent: '#F5A623',
        tags: ['MP3', 'WAV', 'M4A', 'OGG'],
    },
    {
        icon: IoLinkOutline,
        label: 'YouTube & Web Links',
        description: 'Paste any YouTube video URL or website link — Zemly AI extracts and structures the content for you.',
        accent: '#E07070',
        tags: ['YouTube', 'Articles', 'Blog posts'],
    },
];

const features = [
    {
        icon: IoDocumentTextOutline,
        title: 'Smart Notes',
        description:
            'Upload a document, paste a link, or record audio — Zemly AI instantly generates clean, structured study notes using AI.',
        accent: '#00C896',
        span: 'md:col-span-2',
    },
    {
        icon: BsChatDots,
        title: 'AI Chat',
        description:
            'Ask your notes anything. Get instant answers, summaries, and explanations from your own study material.',
        accent: '#4F9CF9',
        span: 'md:col-span-1',
    },
    {
        icon: TbCards,
        title: 'Flashcards',
        description:
            'Automatically generated flashcards from your notes. Flip through them to cement active recall.',
        accent: '#F5A623',
        span: 'md:col-span-1',
    },
    {
        icon: PiExam,
        title: 'Practice Quiz',
        description:
            'Test yourself with AI-generated multiple-choice quizzes tailored to your exact content.',
        accent: '#00C896',
        span: 'md:col-span-1',
    },
    {
        icon: BsMic,
        title: 'AI Podcast',
        description:
            'Turn any note into a two-host audio podcast — perfect for learning on the go or while studying.',
        accent: '#4F9CF9',
        span: 'md:col-span-1',
    },
];

const LandingPage: React.FC = () => {
    const { user } = useAuthStore();
    const ctaDestination = user ? '/dashboard' : '/auth';

    return (
        <div className="relative min-h-screen bg-zinc-950">
            <Navbar />

            {/* ── Hero Section (Split Layout) ── */}
            <section className="relative min-h-screen overflow-hidden">
                {/* Background glows */}
                <div className="pointer-events-none absolute inset-0">
                    <div
                        className="absolute -left-32 top-1/4 h-[600px] w-[600px] rounded-full opacity-15 blur-[150px]"
                        style={{ background: 'radial-gradient(circle, #00C896 0%, transparent 65%)' }}
                    />
                    <div
                        className="absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full opacity-10 blur-[130px]"
                        style={{ background: 'radial-gradient(circle, #4F9CF9 0%, transparent 65%)' }}
                    />
                </div>

                <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 pb-16 pt-32 lg:flex-row lg:items-center lg:gap-16 lg:px-8 lg:py-0 lg:min-h-screen">
                    {/* ── Left: Copy ── */}
                    <div className="flex flex-1 flex-col items-start lg:max-w-xl">
                        {/* Social proof badge */}
                        <div
                            className="animate-fade-up mb-7 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-sm"
                            style={{
                                borderColor: 'rgba(0, 200, 150, 0.3)',
                                background: 'rgba(0, 200, 150, 0.07)',
                                color: '#00C896',
                            }}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                            </span>
                            <span className="font-medium">AI-powered study tools—free to start</span>
                        </div>

                        {/* Headline */}
                        <h1
                            className="animate-fade-up animate-delay-1 mb-6 font-extrabold leading-[1.05] tracking-tight"
                            style={{
                                fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                                fontFamily: "'Bricolage Grotesque', sans-serif",
                            }}
                        >
                            <span className="text-zinc-100">Study Smarter.</span>
                            <br />
                            <span style={{ color: '#00C896' }}>Learn Faster.</span>
                        </h1>

                        {/* Sub-headline */}
                        <p
                            className="animate-fade-up animate-delay-2 mb-10 max-w-lg text-lg leading-relaxed text-zinc-400"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                            Zemly AI is the AI study assistant that turns your documents, lectures, and notes into smart summaries, flashcards, quizzes, and podcasts — in seconds.
                        </p>

                        {/* CTAs */}
                        <div className="animate-fade-up animate-delay-3 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                            <Link
                                to={ctaDestination}
                                className="btn-emerald px-8 py-4 text-base"
                            >
                                Start Learning Faster →
                            </Link>
                            <a
                                href="#features"
                                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-7 py-4 text-base font-semibold text-zinc-400 backdrop-blur-sm transition-all duration-200 hover:border-zinc-700 hover:text-zinc-200"
                            >
                                See what's inside
                            </a>
                        </div>

                        {/* Trust line */}
                        <p className="animate-fade-up animate-delay-4 mt-6 text text-zinc-600">
                            No credit card required 
                        </p>
                    </div>

                    {/* ── Right: App Mockup ── */}
                    <div className="animate-fade-up animate-delay-2 w-full flex-1 lg:max-w-2xl">
                        <div
                            className="relative overflow-hidden rounded-2xl"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 0 80px rgba(0,200,150,0.1), 0 32px 80px rgba(0,0,0,0.6)',
                            }}
                        >
                            <img
                                src="/zemly-hero-gif-dark.gif"
                                alt="Zemly AI App Preview"
                                className="w-full h-auto object-cover opacity-90 transition-opacity hover:opacity-100"
                            />
                        </div>


                    </div>
                </div>
            </section>

            {/* ── Features Section ── */}
            <section id="features" className="relative mx-auto max-w-6xl px-6 pb-32 pt-16 lg:px-8">
                {/* Section header */}
                <div className="mb-16 text-center animate-fade-up">
                    <div
                        className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                        style={{
                            borderColor: 'rgba(0,200,150,0.25)',
                            background: 'rgba(0,200,150,0.06)',
                            color: '#00C896',
                        }}
                    >
                        Everything in Zemly AI
                    </div>
                    <h2
                        className="mb-4 font-extrabold tracking-tight text-zinc-100"
                        style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        One tool.{' '}
                        <span style={{ color: '#00C896' }}>Five ways to study.</span>
                    </h2>
                    <p className="mx-auto max-w-lg text-base text-zinc-500">
                        Upload your material once — Zemly AI transforms it into everything you need to actually learn.
                    </p>
                </div>

                {/* Bento grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {features.map((feature, i) => (
                        <div
                            key={feature.title}
                            className={`animate-fade-up group relative overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 sm:p-8 ${feature.span}`}
                            style={{
                                animationDelay: `${i * 80}ms`,
                                background: 'rgba(255,255,255,0.025)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            {/* Hover glow */}
                            <div
                                className="absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-0 blur-[80px] transition-opacity duration-500 group-hover:opacity-25"
                                style={{ background: feature.accent }}
                            />

                            <div className="relative z-10">
                                <div
                                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
                                    style={{ background: `${feature.accent}18`, border: `1px solid ${feature.accent}30` }}
                                >
                                    <feature.icon className="h-6 w-6" style={{ color: feature.accent }} />
                                </div>
                                <h3
                                    className="mb-2.5 text-xl font-bold text-zinc-100"
                                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                                >
                                    {feature.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-zinc-500">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Bottom accent line */}
                            <div
                                className="absolute inset-x-0 bottom-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}60, transparent)` }}
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Input Methods Section ── */}
            <section className="relative mx-auto max-w-6xl px-6 pb-32 pt-4 lg:px-8">
                <div className="mb-16 text-center animate-fade-up">
                    <div
                        className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                        style={{
                            borderColor: 'rgba(0,200,150,0.25)',
                            background: 'rgba(0,200,150,0.06)',
                            color: '#00C896',
                        }}
                    >
                        Bring any content
                    </div>
                    <h2
                        className="mb-4 font-extrabold tracking-tight text-zinc-100"
                        style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        Start from{' '}
                        <span style={{ color: '#00C896' }}>anything.</span>
                    </h2>
                    <p className="mx-auto max-w-lg text-base text-zinc-500">
                        Upload a document, paste a YouTube link, drop an audio file, or start blank — Zemly AI handles the rest.
                    </p>
                </div>

                {/* 2×2 grid */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {inputMethods.map((method, i) => (
                        <div
                            key={method.label}
                            className="animate-fade-up group relative flex gap-5 overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:-translate-y-0.5"
                            style={{
                                animationDelay: `${i * 80}ms`,
                                background: 'rgba(255,255,255,0.025)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            {/* Hover glow */}
                            <div
                                className="absolute -left-10 -top-10 h-44 w-44 rounded-full opacity-0 blur-[80px] transition-opacity duration-500 group-hover:opacity-20"
                                style={{ background: method.accent }}
                            />

                            {/* Icon */}
                            <div
                                className="relative z-10 mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                                style={{ background: `${method.accent}18`, border: `1px solid ${method.accent}30` }}
                            >
                                <method.icon className="h-6 w-6" style={{ color: method.accent }} />
                            </div>

                            {/* Text */}
                            <div className="relative z-10 flex-1">
                                <h3
                                    className="mb-1.5 text-lg font-bold text-zinc-100"
                                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                                >
                                    {method.label}
                                </h3>
                                <p className="mb-4 text-sm leading-relaxed text-zinc-500">
                                    {method.description}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {method.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                                            style={{
                                                background: `${method.accent}12`,
                                                color: method.accent,
                                                border: `1px solid ${method.accent}25`,
                                            }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Bottom line */}
                            <div
                                className="absolute inset-x-0 bottom-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                style={{ background: `linear-gradient(90deg, transparent, ${method.accent}60, transparent)` }}
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
                        background: 'rgba(0,200,150,0.04)',
                        border: '1px solid rgba(0,200,150,0.15)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 0 80px rgba(0,200,150,0.08)',
                    }}
                >
                    <div
                        className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full opacity-20 blur-[100px]"
                        style={{ background: '#00C896' }}
                    />
                    <div className="relative z-10">
                        <h2
                            className="mb-5 font-extrabold tracking-tight text-zinc-100"
                            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Ready to ace your next exam?
                        </h2>
                        <p className="mx-auto mb-10 max-w-md text-base text-zinc-400">
                            Join students who use Zemly AI to study smarter — not harder. Upload your first note in under 30 seconds.
                        </p>
                        <Link to={ctaDestination} className="btn-emerald px-10 py-4 text-base">
                            Get Started — It's Free
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/40 py-10">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
                    <Link to="/" className="flex items-center">
                        <Logo className="h-6 opacity-80 transition-opacity hover:opacity-100" />
                    </Link>
                    <div className="flex gap-6 text-sm text-zinc-500">
                        <Link to="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
                        <Link to="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
                    </div>
                    <p className="text-sm text-zinc-600">
                        &copy; {new Date().getFullYear()} Zemly AI. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
