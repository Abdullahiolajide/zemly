import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Logo from '../components/Logo';

const PrivacyPage: React.FC = () => {
    return (
        <div className="relative min-h-screen bg-zinc-950 text-zinc-400">
            <Navbar />

            {/* Background effects */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div
                    className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-10 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #4F9CF9 0%, transparent 70%)' }}
                />
            </div>

            <main className="relative z-10 mx-auto max-w-4xl px-6 py-24 lg:px-8">
                <div className="mb-12 text-center animate-fade-up">
                    <h1
                        className="mb-4 font-extrabold tracking-tight text-zinc-100"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        Privacy Policy
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
                            1. Introduction
                        </h2>
                        <p className="leading-relaxed">
                            At Zemly AI, we are dedicated to protecting your privacy and ensuring your personal information is kept secure. This Privacy Policy outlines what information we collect when you use our website, platform, and related services, and how we utilize, share, and safeguard that data. By using Zemly AI, you agree to the collection and use of information in accordance with this policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            2. Information We Collect
                        </h2>
                        <p className="leading-relaxed mb-4">
                            We gather information to provide and improve our educational tools. This falls into a few categories:
                        </p>
                        <ul className="list-inside list-disc space-y-2 text-zinc-300">
                            <li><strong>Information You Provide:</strong> When you register, we collect account details like your name and email address. If you purchase the unlimited plan, payment details are collected securely via our third-party payment processors.</li>
                            <li><strong>Study Materials & Content:</strong> To generate smart notes, quizzes, and podcasts, we securely collect the documents, text, and media you voluntarily upload or input into the platform. We ask that you avoid uploading sensitive personal documentation (like health records or financial info).</li>
                            <li><strong>Automated Usage Data:</strong> Like most websites, we automatically log technical data such as your IP address, browser type, device details, and how you interact with our features via cookies and similar tracking technologies.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            3. How We Use Your Data
                        </h2>
                        <p className="leading-relaxed mb-4">
                            We use the information we collect to operate, manage, and continuously upgrade Zemly AI. Specific uses include:
                        </p>
                        <ul className="list-inside list-disc space-y-2 text-zinc-300">
                            <li><strong>Service Delivery:</strong> Processing your uploaded content to generate AI notes, chat responses, and personalized flashcards.</li>
                            <li><strong>Enhancement & Analytics:</strong> Understanding usage patterns to debug errors, optimize performance, and develop new features tailored to your study habits.</li>
                            <li><strong>Communication:</strong> Sending you important administrative notices, security updates, and (only with your permission) promotional emails.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            4. AI Processing & Third-Party Vendors
                        </h2>
                        <p className="leading-relaxed">
                            Because Zemly AI's core features are heavily AI-driven, your uploaded study materials and chatbot interactions are transmitted to our enterprise AI partners (such as OpenAI, Anthropic, or Azure) strictly for processing and generating requested output. We choose vendors who adhere to strict data protection regulations. We do not sell your personal information to third parties, though we may share necessary data with hosting platforms, analytics providers, and payment gateways strictly to facilitate our service operations.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            5. Data Security and Storage
                        </h2>
                        <p className="leading-relaxed">
                            We enforce robust technical, physical, and administrative security measures—such as TLS encryption—to shield your information from unauthorized access or alteration. While we aim for military-grade protection, no internet platform can guarantee 100% invulnerability. We retain your data only for as long as your account is active or as legally required, after which it is securely deleted or fully anonymized.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            6. Tracking Technologies Options
                        </h2>
                        <p className="leading-relaxed">
                            We utilize cookies to keep you logged in, analyze site traffic, and personalize your experience. You can adjust your browser settings to refuse or alert you about cookies; however, doing so might break critical functionality within the Zemly AI app. 
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            7. Children's Privacy
                        </h2>
                        <p className="leading-relaxed">
                            Zemly AI is engineered for adult and college-level learners. We do not knowingly collect or solicit personal information from individuals under the age of 16. If we become aware that we have inadvertently collected data from an underage user without parental consent, we will actively erase that data and close the associated account.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            8. Your Rights & Privacy Options
                        </h2>
                        <p className="leading-relaxed">
                            Depending on your region (including places with specific privacy frameworks like California or Europe), you hold certain rights over your data. These may include the right to access the data we have on file, request corrections to inaccurate info, demand deletion of your account and personal details, and opt-out of data usage for analytics. You can manage many of these directly in your account settings or by contacting our support team.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            9. Policy Changes
                        </h2>
                        <p className="leading-relaxed">
                            We may occasionally refresh this Privacy Policy to reflect changing legal requirements or platform updates. We will post any major changes on our website to ensure you're always informed about how your data is handled. Continued use past an update implies continued consent.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            10. Contact Us
                        </h2>
                        <p className="leading-relaxed">
                            If you have concerns, inquiries, or would like to exercise any of your privacy rights, please reach out to our privacy team at privacy@zemly.me.
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

export default PrivacyPage;
