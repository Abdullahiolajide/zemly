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
        gradient: 'from-indigo-500 to-blue-500',
        span: 'md:col-span-2',
    },
    {
        icon: IoMdChatbubbles,
        title: 'AI Assistant',
        description:
            'Chat with your notes. Ask questions, get summaries, and discover connections effortlessly.',
        gradient: 'from-purple-500 to-pink-500',
        span: 'md:col-span-1',
    },
    {
        icon: MdAutoAwesome,
        title: 'Auto-Organize',
        description: 'Tags, folders, and links generated for you — zero effort.',
        gradient: 'from-amber-500 to-orange-500',
        span: 'md:col-span-1',
    },
    {
        icon: MdLock,
        title: 'End-to-End Encryption',
        description: 'Your data stays yours. Military-grade encryption at rest and in transit.',
        gradient: 'from-emerald-500 to-teal-500',
        span: 'md:col-span-1',
    },
    {
        icon: MdSpeed,
        title: 'Blazing Fast',
        description: 'Optimistic UI with instant sync. Your notes load before you blink.',
        gradient: 'from-cyan-500 to-blue-500',
        span: 'md:col-span-1',
    },
    {
        icon: MdDevices,
        title: 'Cross-Platform',
        description: 'Seamlessly switch between desktop, tablet, and mobile — everything syncs.',
        gradient: 'from-rose-500 to-red-500',
        span: 'md:col-span-1',
    },
];

const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-zinc-950">
            <Navbar />

            {/* Hero Section */}
            <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 lg:px-8">
                {/* Background glow */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[140px]" />
                    <div className="absolute right-1/4 top-1/3 h-[450px] w-[450px] rounded-full bg-purple-600/8 blur-[120px]" />
                </div>

                <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 text-center">
                    {/* Badge */}
                    <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-5 py-2 text-sm text-zinc-400">
                        <MdAutoAwesome className="h-4 w-4 text-indigo-400" />
                        <span>AI-Powered Note Taking</span>
                    </div>

                    {/* Headline */}
                    <h1 className="mb-8 text-4xl font-extrabold leading-tight tracking-tight text-zinc-100 sm:text-5xl md:text-6xl lg:text-7xl">
                        Your thoughts,{' '}
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            supercharged
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="mb-12 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg md:text-xl">
                        Zemly uses AI to help you capture, organize, and rediscover your
                        ideas faster than ever. Stop searching — start knowing.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
                        <Link
                            to="/auth"
                            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-center text-base font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110 sm:w-auto"
                        >
                            Start for Free
                        </Link>
                        <a
                            href="#features"
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-8 py-4 text-center text-base font-semibold text-zinc-300 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/80 sm:w-auto"
                        >
                            See Features
                        </a>
                    </div>

                    {/* Trust Line */}
                    <p className="mt-10 text-sm text-zinc-500">
                        Free to start · No credit card required · Cancel anytime
                    </p>
                </div>
            </section>

            {/* Bento Feature Grid */}
            <section
                id="features"
                className="relative mx-auto max-w-6xl px-6 pb-32 pt-16 lg:px-8"
            >
                <div className="mb-16 text-center">
                    <h2 className="mb-5 text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl lg:text-5xl">
                        Everything you need to{' '}
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            think better
                        </span>
                    </h2>
                    <p className="mx-auto max-w-xl text-base text-zinc-400 sm:text-lg">
                        A suite of intelligent tools crafted to make note-taking effortless
                        and insightful.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className={`group relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-7 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80 sm:p-8 ${feature.span}`}
                        >
                            {/* Subtle gradient hover glow */}
                            <div
                                className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 blur-[80px] transition-opacity duration-500 group-hover:opacity-20`}
                            />

                            <div className="relative z-10">
                                <div
                                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}
                                >
                                    <feature.icon className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="mb-3 text-lg font-semibold text-zinc-100">
                                    {feature.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-zinc-400">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="mx-auto max-w-4xl px-6 pb-32 text-center lg:px-8">
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 px-8 py-16 sm:px-16 sm:py-20">
                    <h2 className="mb-5 text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
                        Ready to supercharge your notes?
                    </h2>
                    <p className="mx-auto mb-10 max-w-md text-base text-zinc-400">
                        Join thousands of thinkers who use Zemly to capture and connect their best ideas.
                    </p>
                    <Link
                        to="/auth"
                        className="inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-10 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110"
                    >
                        Get Started — It's Free
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-zinc-800/60 py-10">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                            <span className="text-xs font-bold text-white">Z</span>
                        </div>
                        <span className="text-sm font-semibold text-zinc-400">Zemly</span>
                    </div>
                    <p className="text-sm text-zinc-500">
                        &copy; {new Date().getFullYear()} Zemly. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
