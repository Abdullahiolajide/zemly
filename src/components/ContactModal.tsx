import React, { useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { FiMail, FiMessageSquare, FiCopy, FiCheck } from 'react-icons/fi';

interface ContactModalProps {
    open: boolean;
    onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ open, onClose }) => {
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const handleCopy = (email: string) => {
        navigator.clipboard.writeText(email);
        setCopiedEmail(email);
        setTimeout(() => setCopiedEmail(null), 2000);
    };

    const contacts = [
        { title: 'Support', description: 'Need help or have a question?', email: 'support@zemly.me', icon: FiMail },
        { title: 'Feedback', description: 'Have an idea to improve Zemly?', email: 'feedback@zemly.me', icon: FiMessageSquare },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" />

            <div
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-md mx-4 rounded-2xl shadow-2xl shadow-black/50 cursor-default animate-[modalSlideUp_250ms_ease-out]"
                style={{
                    background: 'rgba(18, 21, 27, 0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                >
                    <IoClose className="h-5 w-5" />
                </button>

                <div className="px-8 pt-8 pb-8">
                    <h2
                        className="text-xl font-bold text-zinc-100"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                    >
                        Contact Us
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                        We'd love to hear from you. Copy our email or open it directly in Gmail.
                    </p>

                    <div className="mt-6 flex flex-col gap-4">
                        {contacts.map((contact) => (
                            <div key={contact.title} className="flex flex-col gap-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/50 text-zinc-300 border border-zinc-700/50">
                                        <contact.icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-zinc-200">{contact.title}</h3>
                                        <p className="text-[12px] text-zinc-500">{contact.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 truncate rounded-lg bg-zinc-900/50 px-3 py-2.5 text-[13px] font-medium text-zinc-300 border border-zinc-800">
                                        {contact.email}
                                    </div>
                                    <button
                                        onClick={() => handleCopy(contact.email)}
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800/50 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50"
                                        title="Copy to clipboard"
                                    >
                                        {copiedEmail === contact.email ? <FiCheck className="h-4 w-4 text-emerald-500" /> : <FiCopy className="h-4 w-4" />}
                                    </button>
                                    <a
                                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${contact.email}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex h-10 px-4 shrink-0 items-center justify-center gap-2 rounded-lg transition-colors hover:opacity-80"
                                        style={{ background: 'rgba(0, 200, 150, 0.1)', color: '#00C896', border: '1px solid rgba(0,200,150,0.2)' }}
                                    >
                                        <span className="text-[13px] font-semibold">Gmail</span>
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactModal;
