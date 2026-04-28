import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { chatWithNoteStream } from '../lib/aiService';
import type { ChatMessage } from '../lib/aiService';
import { MdAutoAwesome } from 'react-icons/md';
import { FiSend, FiX } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

interface ChatPanelProps {
    getNoteText: () => string;
    highlightedText: string | null;
    onClearHighlight: () => void;
    onHasMessages?: (has: boolean) => void;
    persistenceKey?: string;
    maxUserMessages?: number;
    onRequireUpgrade?: () => void;
}

interface PersistedChatState {
    messages: ChatMessage[];
    memory: string;
    expiresAt: number;
}

const CHAT_STATE_TTL_MS = 24 * 60 * 60 * 1000;

function readPersistedChatState(key?: string): PersistedChatState | null {
    if (!key || typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<PersistedChatState>;
        if (!Array.isArray(parsed.messages) || typeof parsed.memory !== 'string' || typeof parsed.expiresAt !== 'number') {
            return null;
        }

        if (Date.now() > parsed.expiresAt) {
            window.localStorage.removeItem(key);
            return null;
        }

        return {
            messages: parsed.messages,
            memory: parsed.memory,
            expiresAt: parsed.expiresAt,
        };
    } catch {
        return null;
    }
}

function writePersistedChatState(key: string | undefined, state: Omit<PersistedChatState, 'expiresAt'>): void {
    if (!key || typeof window === 'undefined') return;

    try {
        const payload: PersistedChatState = {
            ...state,
            expiresAt: Date.now() + CHAT_STATE_TTL_MS,
        };
        window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
        // Ignore storage failures.
    }
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

const ChatPanel: React.FC<ChatPanelProps> = ({ getNoteText, highlightedText, onClearHighlight, onHasMessages, persistenceKey, maxUserMessages, onRequireUpgrade }) => {
    const [messages, setMessages] = useState<ChatMessage[]>(() => readPersistedChatState(persistenceKey)?.messages ?? []);
    const [chatMemory, setChatMemory] = useState(() => readPersistedChatState(persistenceKey)?.memory ?? '');
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const streamTextRef = useRef('');

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading, isStreaming]);
    useEffect(() => { onHasMessages?.(messages.length > 0); }, [messages.length, onHasMessages]);
    useEffect(() => { if (highlightedText) { inputRef.current?.focus(); } }, [highlightedText]);
    useEffect(() => {
        writePersistedChatState(persistenceKey, { messages, memory: chatMemory });
    }, [messages, chatMemory, persistenceKey]);

    const userMessageCount = messages.filter((message) => message.role === 'user').length;
    const reachedMessageLimit = typeof maxUserMessages === 'number' && userMessageCount >= maxUserMessages;

    const handleSend = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed && !highlightedText) return;

        if (typeof maxUserMessages === 'number' && messages.filter((message) => message.role === 'user').length >= maxUserMessages) {
            setError('Your free plan includes 3 AI messages. Upgrade to keep chatting.');
            onRequireUpgrade?.();
            return;
        }

        const isFirstMessage = messages.length === 0;
        const fullNoteText = getNoteText();
        // First message: send full note. Follow-ups: if memory exists, skip the snippet
        // (memory already captures the note). Only use snippet as fallback before memory is ready.
        const noteText = isFirstMessage
            ? fullNoteText
            : chatMemory
                ? ''
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
        setIsStreaming(false);
        streamTextRef.current = '';

        // Add an empty model message that we'll fill incrementally
        const withPlaceholder: ChatMessage[] = [...newMessages, { role: 'model', content: '' }];
        setMessages(withPlaceholder);

        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await chatWithNoteStream(
                noteText,
                newMessages,
                {
                    onChunk: (text) => {
                        setIsLoading(false);
                        setIsStreaming(true);
                        streamTextRef.current += text;
                        const accumulated = streamTextRef.current;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = { role: 'model', content: accumulated };
                            return updated;
                        });
                    },
                    onMemory: (mem) => {
                        if (mem) setChatMemory(mem);
                    },
                    signal: abort.signal,
                },
                chatMemory,
            );
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            const msg = err instanceof Error ? err.message : 'Failed to get response';
            if (!streamTextRef.current) {
                setMessages(newMessages);
            }
            setError(msg);
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            abortRef.current = null;
        }
    }, [input, highlightedText, messages, getNoteText, onClearHighlight, chatMemory, maxUserMessages, onRequireUpgrade]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    return (
        <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
                background:
                    'radial-gradient(120% 80% at 100% 0%, rgba(0,200,150,0.05) 0%, rgba(0,0,0,0) 40%), var(--bg-main)',
            }}
        >
            {/* ── Messages ── */}
            <div
                className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-4 pb-4 touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
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
                                className={msg.role === 'user'
                                    ? 'max-w-[82%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed'
                                    : 'w-full max-w-none px-1 py-1 text-[14px] leading-relaxed'
                                }
                                style={msg.role === 'user'
                                    ? {
                                        background: 'linear-gradient(135deg, rgba(0,200,150,0.92), rgba(0,168,122,0.92))',
                                        color: 'var(--text-on-brand)',
                                        boxShadow: '0 10px 24px rgba(0,200,150,0.18)',
                                    }
                                    : {
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                        color: 'inherit',
                                    }
                                }
                            >
                                {msg.role === 'user' ? (
                                    <div className="space-y-1">
                                        {msg.content.split('\n').map((line, j) => (
                                            <p key={j} className={line === '' ? 'h-2' : ''}>{line}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={`prose prose-invert max-w-none text-[14px]${isStreaming && i === messages.length - 1 ? ' chat-streaming-fade' : ''}`}>
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => <p className="mb-3 leading-7">{children}</p>,
                                                ul: ({ children }) => <ul className="mb-3 ml-4 list-inside list-disc space-y-1 leading-7">{children}</ul>,
                                                ol: ({ children }) => <ol className="mb-3 ml-4 list-inside list-decimal space-y-1 leading-7">{children}</ol>,
                                                li: ({ children }) => <li className="ml-0">{children}</li>,
                                                h1: ({ children }) => <h1 className="mb-3 text-[1.05rem] font-bold">{children}</h1>,
                                                h2: ({ children }) => <h2 className="mb-2 text-[0.98rem] font-bold">{children}</h2>,
                                                h3: ({ children }) => <h3 className="mb-2 text-[0.95rem] font-semibold">{children}</h3>,
                                                strong: ({ children }) => <strong className="font-semibold text-emerald-300">{children}</strong>,
                                                em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
                                                code: ({ children, className }: { children?: ReactNode; className?: string }) => {
                                                    const isInline = !className?.includes('language-');
                                                    return isInline ? (
                                                        <code className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[0.82rem] font-mono text-emerald-300">{children}</code>
                                                    ) : (
                                                        <code className="mb-3 block rounded bg-zinc-800 p-2 text-[0.82rem] font-mono text-emerald-300">{children}</code>
                                                    );
                                                },
                                                blockquote: ({ children }) => <blockquote className="mb-2 border-l-2 border-emerald-400/50 pl-3 italic text-zinc-400">{children}</blockquote>,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Loading dots — only shown before first chunk arrives */}
                    {isLoading && !isStreaming && (
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
                <div className="mx-5 mb-2 rounded-lg px-3 py-2 text-[13px] font-medium text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
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
                    <p className="flex-1 text-[13px] leading-relaxed line-clamp-3 italic text-zinc-400">
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
                        className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent text-[14px] text-zinc-200 placeholder-zinc-500 outline-none"
                        disabled={isLoading || isStreaming}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || isStreaming || (!input.trim() && !highlightedText)}
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
                <p className="mt-2 text-center text-[12px] text-zinc-600">
                    {reachedMessageLimit ? 'Free plan limit reached. Upgrade to continue.' : 'Grounded in your note content'}
                </p>
            </div>
        </div>
    );
};

export default ChatPanel;
