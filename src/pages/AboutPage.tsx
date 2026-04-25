import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Logo from '../components/Logo';

const AboutPage: React.FC = () => {
    return (
        <div className="relative min-h-screen bg-zinc-950 text-zinc-400">
            <Navbar />

            <div className="pointer-events-none fixed inset-0 z-0">
                <div
                    className="absolute -left-20 top-1/4 h-[420px] w-[420px] rounded-full opacity-15 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #00C896 0%, transparent 70%)' }}
                />
                <div
                    className="absolute right-0 top-1/2 h-[360px] w-[360px] -translate-y-1/2 rounded-full opacity-10 blur-[110px]"
                    style={{ background: 'radial-gradient(circle, #4F9CF9 0%, transparent 70%)' }}
                />
            </div>

            <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 pb-20 pt-28 lg:px-8 lg:pt-32">
                <section
                    className="w-full animate-fade-up rounded-2xl p-8 sm:p-12"
                    style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        backdropFilter: 'blur(16px)',
                    }}
                >
                    <div
                        className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                        style={{
                            borderColor: 'rgba(0,200,150,0.25)',
                            background: 'rgba(0,200,150,0.06)',
                            color: '#00C896',
                        }}
                    >
                        About Zemly
                    </div>

                    <h1
                        className="mb-6 font-extrabold tracking-tight text-zinc-100"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        Built for students who actually want to learn
                    </h1>

                    <div className="space-y-5 text-base leading-relaxed text-zinc-400 sm:text-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        <p>
                            Zemly is an AI-powered study tool that transforms your notes, YouTube videos, and documents into flashcards, quizzes, podcasts, and more — so you can study smarter, not harder.
                        </p>
                        <p>
                            We built Zemly because studying shouldn't mean hours of manual summarizing and re-reading. Let AI handle the heavy lifting while you focus on understanding.
                        </p>
                    </div>

                    <div className="mt-10">
                        <Link to="/auth" className="btn-emerald inline-flex items-center px-8 py-4 text-base">
                            Get started free →
                        </Link>
                    </div>
                </section>
            </main>

            <footer className="relative z-10 border-t border-zinc-800/40 py-10">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
                    <Link to="/" className="flex items-center">
                        <Logo className="h-6 opacity-80 transition-opacity hover:opacity-100" />
                    </Link>
                    <div className="flex gap-6 text-sm text-zinc-500">
                        <Link to="/terms" className="transition-colors hover:text-zinc-300">Terms of Service</Link>
                        <Link to="/privacy" className="transition-colors hover:text-zinc-300">Privacy Policy</Link>
                    </div>
                    <p className="text-sm text-zinc-600">
                        &copy; {new Date().getFullYear()} Zemly AI. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default AboutPage;