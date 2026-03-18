import { useState, useRef, useEffect } from 'react';
import { IoClose, IoMicOutline, IoLinkOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { MdUploadFile } from 'react-icons/md';
import { FiUploadCloud } from 'react-icons/fi';

/* ─────────────────────────────────────────────
   Shared Modal Wrapper
   ───────────────────────────────────────────── */
interface ModalWrapperProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ open, onClose, children }) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" />

            {/* Card */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-lg mx-4 rounded-2xl shadow-2xl animate-[modalSlideUp_250ms_ease-out]"
                style={{
                    background: 'rgba(16, 18, 24, 0.97)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:text-zinc-300"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    aria-label="Close modal"
                >
                    <IoClose className="h-5 w-5" />
                </button>

                {children}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   Shared input style helper (applied via onFocus/onBlur)
   ───────────────────────────────────────────── */
const inputBaseClass =
    'w-full rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-200';
const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontFamily: "'DM Sans', sans-serif",
};
const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#00C896';
    e.target.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.12)';
};
const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
    e.target.style.boxShadow = '';
};

/* ─────────────────────────────────────────────
   1. Blank Document Modal
   ───────────────────────────────────────────── */
interface BlankDocumentModalProps {
    open: boolean;
    onClose: () => void;
    onCreate?: (title: string) => void;
}

export const BlankDocumentModal: React.FC<BlankDocumentModalProps> = ({
    open,
    onClose,
    onCreate,
}) => {
    const [title, setTitle] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setTitle('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const handleCreate = () => {
        if (title.trim()) {
            onCreate?.(title.trim());
            onClose();
        }
    };

    return (
        <ModalWrapper open={open} onClose={onClose}>
            <div className="px-8 pt-10 pb-8">
                {/* Icon */}
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.2)' }}
                >
                    <IoDocumentTextOutline className="h-7 w-7" style={{ color: '#00C896' }} />
                </div>

                <h2
                    className="mb-2 text-center text-xl font-bold text-zinc-100"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                >
                    Create blank document
                </h2>
                <p className="mb-7 text-center text-sm text-zinc-500">
                    Give your new note a title to get started
                </p>

                {/* Title Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="Enter note title..."
                    className={inputBaseClass}
                    style={inputStyle}
                />

                {/* Create Button */}
                <button
                    onClick={handleCreate}
                    disabled={!title.trim()}
                    className="btn-emerald mt-5 w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Create Note
                </button>
            </div>
        </ModalWrapper>
    );
};

/* ─────────────────────────────────────────────
   2. Record / Upload Audio Modal
   ───────────────────────────────────────────── */
interface AudioModalProps {
    open: boolean;
    onClose: () => void;
    onGenerate?: (file?: File) => void;
}

export const AudioModal: React.FC<AudioModalProps> = ({
    open,
    onClose,
    onGenerate,
}) => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) setAudioFile(null);
    }, [open]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) setAudioFile(file);
    };

    return (
        <ModalWrapper open={open} onClose={onClose}>
            <div className="px-8 pt-10 pb-8">
                {/* Icon */}
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}
                >
                    <IoMicOutline className="h-7 w-7" style={{ color: '#F5A623' }} />
                </div>

                <h2
                    className="mb-6 text-center text-xl font-bold text-zinc-100"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                >
                    Create note from audio
                </h2>

                {/* Make a recording */}
                <div className="mb-4">
                    <p className="mb-2.5 text-[13px] font-medium text-zinc-400">
                        Make a recording
                    </p>
                    <div className="flex items-center gap-3">
                        {/* Mic button */}
                        <button
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-all duration-200 hover:scale-105"
                            style={{ background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.25)' }}
                        >
                            <IoMicOutline className="h-5 w-5" style={{ color: '#F5A623' }} />
                        </button>
                        {/* Progress bar / Waveform placeholder */}
                        <div
                            className="flex-1 rounded-full p-0.5"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                            <div className="h-2 w-full rounded-full" style={{ background: 'linear-gradient(90deg, rgba(245,166,35,0.2), rgba(245,166,35,0.4), rgba(245,166,35,0.2))' }} />
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="my-5 flex items-center gap-4">
                    <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <span className="text-xs font-medium text-zinc-600">Or</span>
                    <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>

                {/* Audio Upload Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-all duration-200"
                    style={{
                        borderColor: isDragging ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.08)',
                        background: isDragging ? 'rgba(245,166,35,0.05)' : 'rgba(255,255,255,0.02)',
                    }}
                >
                    <FiUploadCloud
                        className="mb-2 h-6 w-6"
                        style={{ color: isDragging ? '#F5A623' : '#52525b' }}
                    />
                    <p className="text-sm text-zinc-500">
                        {audioFile ? (
                            <span className="font-medium" style={{ color: '#F5A623' }}>{audioFile.name}</span>
                        ) : (
                            <>Drag audio here, or click to upload (MP3, WAV…)</>
                        )}
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setAudioFile(file);
                        }}
                    />
                </div>

                {/* Generate Notes Button */}
                <button
                    onClick={() => { onGenerate?.(audioFile ?? undefined); onClose(); }}
                    className="btn-emerald mt-5 w-full py-3 text-sm"
                >
                    Generate Notes
                </button>
            </div>
        </ModalWrapper>
    );
};

/* ─────────────────────────────────────────────
   3. Document Upload Modal
   ───────────────────────────────────────────── */
interface DocumentUploadModalProps {
    open: boolean;
    onClose: () => void;
    onGenerate?: (result: {
        file: File;
        title: string;
        noteContent: string;
        extractedText: string;
        publicUrl: string;
    }) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
    open,
    onClose,
    onGenerate,
}) => {
    const [docFile, setDocFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setDocFile(null);
            setError(null);
            setIsLoading(false);
        }
    }, [open]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) { setDocFile(file); setError(null); }
    };

    const handleGenerate = async () => {
        if (!docFile) return;
        setIsLoading(true);
        setError(null);

        try {
            const { uploadAndExtractDocument } = await import('../lib/aiService');
            const result = await uploadAndExtractDocument(docFile);
            onGenerate?.({ file: docFile, ...result });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalWrapper open={open} onClose={isLoading ? () => {} : onClose}>
            <div className="px-8 pt-10 pb-8">
                {/* Icon */}
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(79,156,249,0.1)', border: '1px solid rgba(79,156,249,0.2)' }}
                >
                    <MdUploadFile className="h-7 w-7" style={{ color: '#4F9CF9' }} />
                </div>

                <h2
                    className="mb-2 text-center text-xl font-bold text-zinc-100"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                >
                    Upload a document
                </h2>
                <p className="mb-6 text-center text-sm text-zinc-500">
                    Upload a PDF and Zemly AI will generate study notes for you
                </p>

                {/* Document Upload Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => !isLoading && fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
                    style={{
                        borderColor: isDragging ? 'rgba(79,156,249,0.5)' : docFile ? 'rgba(79,156,249,0.35)' : 'rgba(255,255,255,0.08)',
                        background: isDragging ? 'rgba(79,156,249,0.05)' : docFile ? 'rgba(79,156,249,0.04)' : 'rgba(255,255,255,0.02)',
                    }}
                >
                    <FiUploadCloud
                        className="mb-2 h-6 w-6"
                        style={{ color: isDragging || docFile ? '#4F9CF9' : '#52525b' }}
                    />
                    <p className="text-center text-sm text-zinc-500">
                        {docFile ? (
                            <span className="font-medium" style={{ color: '#4F9CF9' }}>{docFile.name}</span>
                        ) : (
                            <>Drag a PDF here, or <span className="text-zinc-300 underline underline-offset-2">click to browse</span></>
                        )}
                    </p>
                    {docFile && (
                        <p className="mt-1 text-xs text-zinc-600">
                            {(docFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.md"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setDocFile(file); setError(null); }
                        }}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-3 rounded-lg px-3 py-2.5 text-[13px] text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        {error}
                    </div>
                )}

                {/* Generate Notes Button */}
                <button
                    onClick={handleGenerate}
                    disabled={!docFile || isLoading}
                    className="btn-emerald mt-5 w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(13,15,18,0.3)', borderTopColor: '#0D0F12' }} />
                            Generating notes…
                        </span>
                    ) : (
                        'Generate Notes'
                    )}
                </button>
            </div>
        </ModalWrapper>
    );
};



/* ─────────────────────────────────────────────
   4. Website Link Modal
   ───────────────────────────────────────────── */
interface WebsiteLinkModalProps {
    open: boolean;
    onClose: () => void;
    onGenerate?: (url: string) => void;
}

export const WebsiteLinkModal: React.FC<WebsiteLinkModalProps> = ({
    open,
    onClose,
    onGenerate,
}) => {
    const [url, setUrl] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setUrl('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    return (
        <ModalWrapper open={open} onClose={onClose}>
            <div className="px-8 pt-10 pb-8">
                {/* Icon */}
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(224,112,112,0.1)', border: '1px solid rgba(224,112,112,0.2)' }}
                >
                    <IoLinkOutline className="h-7 w-7" style={{ color: '#E07070' }} />
                </div>

                <h2
                    className="mb-6 text-center text-xl font-bold text-zinc-100"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                >
                    Create note from source
                </h2>

                {/* URL Input */}
                <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && url.trim()) {
                            onGenerate?.(url.trim());
                            onClose();
                        }
                    }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="Paste a website or YouTube link..."
                    className={inputBaseClass}
                    style={inputStyle}
                />

                {/* Generate Notes Button */}
                <button
                    onClick={() => {
                        if (url.trim()) {
                            onGenerate?.(url.trim());
                            onClose();
                        }
                    }}
                    className="btn-emerald mt-5 w-full py-3 text-sm"
                >
                    Generate Notes
                </button>
            </div>
        </ModalWrapper>
    );
};
