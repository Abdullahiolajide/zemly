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

const ChatPanel: React.FC<ChatPanelProps> = ({ getNoteText, highlightedText, onClearHighlight, onHasMessages }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
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
        const noteText = isFirstMessage ? getNoteText() : '';

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
            const reply = await chatWithNote(noteText, newMessages);
            setMessages((prev) => [...prev, { role: 'model', content: reply }]);
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
        <div className="flex h-full flex-col">
            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
                {messages.length === 0 && !isLoading && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <div
                            className="flex h-16 w-16 items-center justify-center rounded-2xl"
                            style={{ background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.15)' }}
                        >
                            <MdAutoAwesome className="h-8 w-8" style={{ color: '#00C896' }} />
                        </div>
                        <h3
                            className="text-lg font-bold text-zinc-100"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Hey, I'm Zemly AI
                        </h3>
                        <p className="max-w-[240px] text-[13px] leading-relaxed text-zinc-500">
                            I can work with you on your notes. Try highlighting text and clicking "Ask AI"!
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className="max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
                                style={msg.role === 'user'
                                    ? { background: '#00C896', color: '#0D0F12' }
                                    : {
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                        color: '#d4d4d8',
                                        backdropFilter: 'blur(8px)',
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
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                }}
                            >
                                <div className="flex gap-1">
                                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: '#00C896', animationDelay: '0ms' }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: '#00C896', animationDelay: '150ms' }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: '#00C896', animationDelay: '300ms' }} />
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
                    style={{ border: '1px solid rgba(0,200,150,0.25)', background: 'rgba(0,200,150,0.08)' }}
                >
                    <MdAutoAwesome className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#00C896' }} />
                    <p className="flex-1 text-[12px] leading-relaxed line-clamp-3" style={{ color: 'rgba(0,200,150,0.85)' }}>
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
            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div
                    className="flex items-end gap-2 rounded-xl px-3 py-2"
                    style={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={highlightedText ? 'Ask about this text…' : 'Ask about your notes…'}
                        rows={1}
                        className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent text-[13px] text-zinc-200 placeholder-zinc-600 outline-none"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !highlightedText)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#0D0F12] transition-all disabled:opacity-30"
                        style={{ background: '#00C896' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#00A87A'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#00C896'; }}
                    >
                        <FiSend className="h-3.5 w-3.5" />
                    </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-600">
                    AI responses are based on your note content
                </p>
            </div>
        </div>
    );
};

export default ChatPanel;
