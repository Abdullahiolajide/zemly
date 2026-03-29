import { useState, useRef, useEffect } from 'react';
import { chatWithNote } from '../lib/aiService';
import type { ChatMessage } from '../lib/aiService';
import { MdAutoAwesome } from 'react-icons/md';
import { FiSend, FiX } from 'react-icons/fi';

interface ChatPanelProps {
    getNoteText: () => string;
    highlightedText: string | null;
    onClearHighlight: () => void;
    onHasMessages?: (has: boolean) => void;
}

function buildRelevantContext(fullText: string, query: string, maxChars = 1800): string {
    const text = fullText.trim();
    const q = query.trim().toLowerCase();
    if (!text || !q) return '';

    const keywords = Array.from(new Set(
        q
            .replace(/[^a-z0-9\s]/gi, ' ')
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 4),
    ));

    if (keywords.length === 0) return '';

    const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const scored = paragraphs
        .map((p) => {
            const lower = p.toLowerCase();
            let score = 0;
            for (const k of keywords) {
                if (lower.includes(k)) score += 1;
            }
            return { p, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.p.length - a.p.length)
        .map((x) => x.p);

    if (scored.length === 0) return '';

    let out = '';
    for (const p of scored) {
        const next = out ? `${out}\n\n${p}` : p;
        if (next.length > maxChars) break;
        out = next;
    }

    return out;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ getNoteText, highlightedText, onClearHighlight, onHasMessages }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatMemory, setChatMemory] = useState('');
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
    useEffect(() => { onHasMessages?.(messages.length > 0); }, [messages.length, onHasMessages]);
    useEffect(() => { if (highlightedText) { inputRef.current?.focus(); } }, [highlightedText]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed && !highlightedText) return;

        const isFirstMessage = messages.length === 0;
        const fullNoteText = getNoteText();
        const noteText = isFirstMessage
            ? fullNoteText
            : buildRelevantContext(fullNoteText, trimmed || highlightedText || '');

        if (isFirstMessage && !noteText.trim()) {
            setError('Your note is empty. Write some content first!');
            return;
        }

        let userMessage = trimmed;
        if (highlightedText) {
            userMessage = `"${highlightedText}"\n\n${trimmed || 'Explain this.'}`;
            onClearHighlight();
        }

        const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
        setMessages(newMessages);
        setInput('');
        setError(null);
        setIsLoading(true);

        try {
            const result = await chatWithNote(noteText, newMessages, chatMemory);
            if (result.memory) {
                setChatMemory(result.memory);
            }
            setMessages((prev) => [...prev, { role: 'model', content: result.reply }]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to get response';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    return (
        <div
            className="flex h-full flex-col"
            style={{
                background:
                    'radial-gradient(120% 80% at 100% 0%, rgba(0,200,150,0.05) 0%, rgba(0,0,0,0) 40%), var(--bg-main)',
            }}
        >
            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
                {messages.length === 0 && !isLoading && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <div
                            className="flex h-16 w-16 items-center justify-center rounded-2xl"
                            style={{ background: 'var(--bg-glass-hover)', border: '1px solid var(--border-glass)' }}
                        >
                            <MdAutoAwesome className="h-8 w-8" style={{ color: 'var(--brand-emerald)' }} />
                        </div>
                        <h3
                            className="text-lg font-semibold text-zinc-100"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Zemly AI
                        </h3>
                        <p className="max-w-[260px] text-[13px] leading-relaxed text-zinc-500">
                            Quiet, focused help for your notes. Ask a question or highlight text and press Ask AI.
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className="max-w-[82%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
                                style={msg.role === 'user'
                                    ? {
                                        background: 'linear-gradient(135deg, rgba(0,200,150,0.92), rgba(0,168,122,0.92))',
                                        color: 'var(--text-on-brand)',
                                        boxShadow: '0 10px 24px rgba(0,200,150,0.18)',
                                    }
                                    : {
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-glass)',
                                        color: 'inherit',
                                        backdropFilter: 'blur(10px)',
                                    }
                                }
                            >
                                <div className="space-y-1">
                                    {msg.content.split('\n').map((line, j) => (
                                        <p key={j} className={line === '' ? 'h-2' : ''}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Loading dots */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div
                                className="flex items-center gap-2 rounded-2xl px-4 py-3"
                                style={{
                                    background: 'var(--bg-glass-hover)',
                                    border: '1px solid var(--border-glass)',
                                }}
                            >
                                <div className="flex gap-1">
                                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--brand-emerald)', animationDelay: '0ms' }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--brand-emerald)', animationDelay: '150ms' }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--brand-emerald)', animationDelay: '300ms' }} />
                                </div>
                                <span className="text-[12px] text-zinc-500">Thinking…</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="mx-5 mb-2 rounded-lg px-3 py-2 text-[12px] font-medium text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    {error}
                </div>
            )}

            {/* ── Highlighted text context chip ── */}
            {highlightedText && (
                <div
                    className="mx-5 mb-2 flex items-start gap-2 rounded-xl px-3 py-2.5"
                    style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                >
                    <MdAutoAwesome className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--brand-emerald)' }} />
                    <p className="flex-1 text-[12px] leading-relaxed line-clamp-3 italic text-zinc-400">
                        "{highlightedText}"
                    </p>
                    <button
                        onClick={onClearHighlight}
                        className="mt-0.5 shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                        <FiX className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* ── Input ── */}
            <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
                <div
                    className="flex items-end gap-2 rounded-2xl px-3 py-2"
                    style={{
                        border: '1px solid var(--border-glass)',
                        background: 'rgba(255,255,255,0.03)',
                        backdropFilter: 'blur(10px)',
                    }}
                >
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={highlightedText ? 'Ask about this text…' : 'Ask about your notes…'}
                        rows={1}
                        className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent text-[13px] text-zinc-200 placeholder-zinc-500 outline-none"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !highlightedText)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-30"
                        style={{
                            background: 'linear-gradient(135deg, #00C896, #00A87A)',
                            color: 'var(--text-on-brand)',
                            boxShadow: '0 8px 20px rgba(0,200,150,0.2)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    >
                        <FiSend className="h-3.5 w-3.5" />
                    </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-600">
                    Grounded in your note content
                </p>
            </div>
        </div>
    );
};

export default ChatPanel;
