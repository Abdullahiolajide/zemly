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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" />

            {/* Card */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-zinc-800/70 bg-zinc-900 shadow-2xl shadow-black/50 animate-[modalSlideUp_250ms_ease-out]"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
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
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                    <IoDocumentTextOutline className="h-8 w-8 text-white" />
                </div>

                <h2 className="mb-2 text-center text-lg font-bold text-zinc-100">
                    Create blank document
                </h2>
                <p className="mb-6 text-center text-sm text-zinc-500">
                    Give your new note a title to get started
                </p>

                {/* Title Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="Enter note title..."
                    className="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all duration-200 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                />

                {/* Create Button */}
                <button
                    onClick={handleCreate}
                    disabled={!title.trim()}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-indigo-500/25 disabled:hover:brightness-100"
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
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                    <IoMicOutline className="h-8 w-8 text-white" />
                </div>

                <h2 className="mb-6 text-center text-lg font-bold text-zinc-100">
                    Create note from source
                </h2>

                {/* Make a recording */}
                <div className="mb-4">
                    <p className="mb-2.5 text-[13px] font-medium text-zinc-300">
                        Make a recording
                    </p>
                    <div className="flex items-center gap-3">
                        {/* Mic button */}
                        <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 transition-all duration-200 hover:shadow-amber-500/35 hover:brightness-110">
                            <IoMicOutline className="h-5 w-5" />
                        </button>
                        {/* Progress bar / Waveform placeholder */}
                        <div className="flex-1 rounded-full bg-zinc-800/50 p-0.5">
                            <div className="h-2 w-full rounded-full bg-gradient-to-r from-amber-500/30 via-orange-500/50 to-amber-500/30" />
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="my-5 flex items-center gap-4">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-xs font-medium text-zinc-500">Or</span>
                    <div className="h-px flex-1 bg-zinc-800" />
                </div>

                {/* Audio Upload Drop Zone */}
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-all duration-200 ${isDragging
                            ? 'border-amber-500/50 bg-amber-500/5'
                            : 'border-zinc-700/50 bg-zinc-800/20 hover:border-zinc-600 hover:bg-zinc-800/40'
                        }`}
                >
                    <FiUploadCloud className={`mb-2 h-6 w-6 ${isDragging ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <p className="text-sm text-zinc-400">
                        {audioFile ? (
                            <span className="text-amber-400 font-medium">{audioFile.name}</span>
                        ) : (
                            <>Drag audio here, or click to upload (MP3, WAV, etc.)</>
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
                    onClick={() => {
                        onGenerate?.(audioFile ?? undefined);
                        onClose();
                    }}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110"
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
    onGenerate?: (file?: File) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
    open,
    onClose,
    onGenerate,
}) => {
    const [docFile, setDocFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) setDocFile(null);
    }, [open]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) setDocFile(file);
    };

    return (
        <ModalWrapper open={open} onClose={onClose}>
            <div className="px-8 pt-10 pb-8">
                {/* Icon */}
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg shadow-rose-500/25">
                    <MdUploadFile className="h-8 w-8 text-white" />
                </div>

                <h2 className="mb-6 text-center text-lg font-bold text-zinc-100">
                    Create note from source
                </h2>

                {/* Document Upload Drop Zone */}
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 transition-all duration-200 ${isDragging
                            ? 'border-rose-500/50 bg-rose-500/5'
                            : 'border-zinc-700/50 bg-zinc-800/20 hover:border-zinc-600 hover:bg-zinc-800/40'
                        }`}
                >
                    <FiUploadCloud className={`mb-2 h-6 w-6 ${isDragging ? 'text-rose-400' : 'text-zinc-500'}`} />
                    <p className="text-sm text-zinc-400">
                        {docFile ? (
                            <span className="text-rose-400 font-medium">{docFile.name}</span>
                        ) : (
                            <>Drag documents here, or click to upload</>
                        )}
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.odt,.xls,.xlsx"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setDocFile(file);
                        }}
                    />
                </div>

                {/* Generate Notes Button */}
                <button
                    onClick={() => {
                        onGenerate?.(docFile ?? undefined);
                        onClose();
                    }}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110"
                >
                    Generate Notes
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
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 shadow-lg shadow-red-500/25">
                    <IoLinkOutline className="h-8 w-8 text-white" />
                </div>

                <h2 className="mb-6 text-center text-lg font-bold text-zinc-100">
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
                    placeholder="Paste a website or YouTube link..."
                    className="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all duration-200 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
                />

                {/* Generate Notes Button */}
                <button
                    onClick={() => {
                        if (url.trim()) {
                            onGenerate?.(url.trim());
                            onClose();
                        }
                    }}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110"
                >
                    Generate Notes
                </button>
            </div>
        </ModalWrapper>
    );
};
