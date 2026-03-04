import { useState, useRef, useEffect } from 'react';
import { chatWithNote } from '../lib/aiService';
import type { ChatMessage } from '../lib/aiService';
import { MdAutoAwesome } from 'react-icons/md';
import { FiSend, FiX } from 'react-icons/fi';

interface ChatPanelProps {
    getNoteText: () => string;
    /** Pre-filled highlighted text from "Ask AI" bubble toolbar action */
    highlightedText: string | null;
    onClearHighlight: () => void;
    /** Called when messages change — true if there are messages */
    onHasMessages?: (has: boolean) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ getNoteText, highlightedText, onClearHighlight, onHasMessages }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    /* Auto-scroll to bottom when new messages arrive */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    /* Notify parent when messages exist */
    useEffect(() => {
        onHasMessages?.(messages.length > 0);
    }, [messages.length, onHasMessages]);

    /* Focus input when highlighted text is set */
    useEffect(() => {
        if (highlightedText) {
            inputRef.current?.focus();
        }
    }, [highlightedText]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed && !highlightedText) return;

        // Only send the full note on the first message to save tokens.
        // After that, the AI already has context from conversation history.
        const isFirstMessage = messages.length === 0;
        const noteText = isFirstMessage ? getNoteText() : '';

        if (isFirstMessage && !noteText.trim()) {
            setError('Your note is empty. Write some content first!');
            return;
        }

        // Build the user message — prepend highlighted context if present
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
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex h-full flex-col">
            {/* ── Header ── */}


            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {messages.length === 0 && !isLoading && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15">
                            <MdAutoAwesome className="h-8 w-8 text-indigo-400" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-100">Hey, I'm Zemly AI</h3>
                        <p className="max-w-sm text-[13px] leading-relaxed text-zinc-500">
                            I can work with you on your notes and answer any questions. Try highlighting text and clicking "Ask AI"!
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${msg.role === 'user'
                                    ? 'bg-indigo-500 text-white'
                                    : 'border border-zinc-800/60 bg-zinc-900/60 text-zinc-200'
                                    }`}
                            >
                                {msg.role === 'model' ? (
                                    <div className="space-y-2">
                                        {msg.content.split('\n').map((line, j) => (
                                            <p key={j} className={line === '' ? 'h-2' : ''}>
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {msg.content.split('\n').map((line, j) => (
                                            <p key={j} className={line === '' ? 'h-2' : ''}>
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="flex items-center gap-2 rounded-2xl border border-zinc-800/60 bg-zinc-900/60 px-4 py-3">
                                <div className="flex gap-1">
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0ms' }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '150ms' }} />
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '300ms' }} />
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
                <div className="mx-6 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-400">
                    {error}
                </div>
            )}

            {/* ── Highlighted text context chip ── */}
            {highlightedText && (
                <div className="mx-6 mb-2 flex items-start gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5">
                    <MdAutoAwesome className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <p className="flex-1 text-[12px] leading-relaxed text-indigo-300 line-clamp-3">
                        "{highlightedText}"
                    </p>
                    <button
                        onClick={onClearHighlight}
                        className="mt-0.5 shrink-0 text-indigo-400/60 transition-colors hover:text-indigo-300"
                    >
                        <FiX className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* ── Input ── */}
            <div className="border-t border-zinc-800/50 px-6 py-4">
                <div className="flex items-end gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={highlightedText ? 'Ask about this text…' : 'Type a question about your notes…'}
                        rows={1}
                        className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent text-[13px] text-zinc-200 placeholder-zinc-600 outline-none"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !highlightedText)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition-all hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-indigo-500"
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
