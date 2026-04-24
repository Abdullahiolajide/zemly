import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Logo from '../components/Logo';

const TermsPage: React.FC = () => {
    return (
        <div className="relative min-h-screen bg-zinc-950 text-zinc-400">
            <Navbar />

            {/* Background effects */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div
                    className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-10 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #00C896 0%, transparent 70%)' }}
                />
            </div>

            <main className="relative z-10 mx-auto max-w-4xl px-6 py-24 lg:px-8">
                <div className="mb-12 text-center animate-fade-up">
                    <h1
                        className="mb-4 font-extrabold tracking-tight text-zinc-100"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        Terms of Service
                    </h1>
                    <p className="text-sm text-zinc-500">
                        Effective Date: April 10, 2026 | Last Updated: April 10, 2026
                    </p>
                </div>

                <div 
                    className="animate-fade-up animate-delay-1 space-y-10 rounded-2xl p-8 sm:p-12"
                    style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(16px)',
                    }}
                >
                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            1. Welcome to Zemly AI
                        </h2>
                        <p className="leading-relaxed">
                            These Terms of Service govern your access to and use of Zemly AI's website, platform, and any affiliated tools (our "Platform"). By signing up, browsing, or utilizing any of our tools, you agree to follow these rules. If you do not agree with them, please refrain from using Zemly AI. We may update these terms occasionally, and continued use implies acceptance.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            2. Who Can Use Zemly AI
                        </h2>
                        <p className="leading-relaxed">
                            You must be legally treated as an adult in your location to use our Platform independently. If you are a minor, you can only create an account and use the Platform if supervised by a parent or legal guardian who accepts these Terms on your behalf.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            3. What We Offer
                        </h2>
                        <p className="leading-relaxed mb-4">
                            Zemly AI provides AI-driven study tools designed to streamline your learning process. While our features may evolve, they generally include:
                        </p>
                        <ul className="list-inside list-disc space-y-2 text-zinc-300">
                            <li><strong>AI Note Generation:</strong> Analyzing your uploaded study materials to create comprehensive notes.</li>
                            <li><strong>Interactive Assistant:</strong> An embedded chat feature allowing you to converse directly with your documents.</li>
                            <li><strong>Learning Tools:</strong> Automated generation of study aids such as flashcards, quizzes, and audio podcasts based on your content.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            4. Your Content & Responsibilities
                        </h2>
                        <p className="leading-relaxed mb-4">
                            You retain ownership of any materials you upload. However, you must respect the intellectual property of others. You agree not to:
                        </p>
                        <ul className="list-inside list-disc space-y-2 text-zinc-300">
                            <li>Upload copyrighted materials (like textbooks or restricted syllabus content) unless you hold the rights or have explicit permission.</li>
                            <li>Share notes, lectures, or slides originally created by your instructors if doing so violates their copyright or institutional policy.</li>
                            <li>Upload files containing sensitive personal information, confidential communications, or anything illegal.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            5. Keeping Learning Honest
                        </h2>
                        <p className="leading-relaxed">
                            Zemly AI is built to help you learn, not to do the work for you. Using our Platform to cheat on exams, plagiarize academic submissions, or compromise your school's honor code is strictly forbidden. If an account is found engaging in academic dishonesty, we reserve the right to suspend or terminate it immediately.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            6. Understanding AI Limitations
                        </h2>
                        <p className="leading-relaxed">
                            Artificial intelligence isn't perfect. While our models strive for accuracy, the flashcards, podcast scripts, and chat responses generated by Zemly AI might occasionally omit context or include errors. Our Platform is an educational aid, meaning you should always review and fact-check AI outputs against your original materials before relying on them entirely.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            7. Billing and Account Management
                        </h2>
                        <ul className="list-inside list-disc space-y-2 text-zinc-300 mb-4">
                            <li><strong>Subscription Plans:</strong> We may offer unlimited features on a recurring billing cycle. Your payment method will be charged automatically at the beginning of each cycle.</li>
                            <li><strong>Stopping Subscription:</strong> You can cancel your unlimited access at any time through the dashboard. After canceling, your unlimited benefits will remain active until the current billing period expires.</li>
                            <li><strong>Refund Requests:</strong> Given that Zemly AI is a digital service, payments are primarily non-refundable. However, if a severe technical malfunction prevents you from using the service, reach out to support within 30 days of the charge.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            8. Intellectual Property & Takedowns
                        </h2>
                        <p className="leading-relaxed">
                            If you are a content creator or educator and believe your materials have been wrongly uploaded to Zemly AI by a user, please contact us immediately. We strictly adhere to DMCA guidelines and will gladly review, remove, and disable access to infringing material upon receiving a valid takedown notice.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            9. Legal Disclaimers
                        </h2>
                        <p className="leading-relaxed">
                            Zemly AI is provided on an "as is" and "as available" basis without any warranties. We don't promise that the service will be flawless or entirely uninterrupted. In no event will Zemly AI be held liable for incidental, consequential, or indirect damages resulting from your use of the Platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            10. Get in Touch
                        </h2>
                        <p className="leading-relaxed">
                            If you need help understanding these rules or want to get in touch regarding policy matters, drop us a line at support@zemly.me.
                        </p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-zinc-800/40 mt-10 py-10">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
                    <Link to="/" className="flex items-center">
                        <Logo className="h-6 opacity-80 transition-opacity hover:opacity-100" />
                    </Link>
                    <div className="flex gap-6 text-sm text-zinc-500">
                        <Link to="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
                        {/* Privacy policy link for future */}
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

export default TermsPage;
