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
        files: File[];
        title: string;
        noteContent: string;
        extractedText: string;
        publicUrls: string[];
    }) => void | Promise<void>;
}

type UploadItemStage = 'queued' | 'uploading' | 'uploaded' | 'processing' | 'done' | 'error';

interface UploadItemState {
    stage: UploadItemStage;
    progress: number;
    error?: string;
}

interface UploadedFileMeta {
    publicUrl: string;
    path: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
    open,
    onClose,
    onGenerate,
}) => {
    const [docFiles, setDocFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadStates, setUploadStates] = useState<Record<string, UploadItemState>>({});
    const [uploadedMeta, setUploadedMeta] = useState<Record<string, UploadedFileMeta>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const removedFileIdsRef = useRef<Set<string>>(new Set());
    const generationCompletedRef = useRef(false);

    const getFileId = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

    const deletePathSafely = async (path: string) => {
        if (!path) return;
        try {
            const { deleteDocumentFromStorage } = await import('../lib/aiService');
            await deleteDocumentFromStorage(path);
        } catch (err) {
            console.warn('Failed to cleanup uploaded file:', err);
        }
    };

    const cleanupUploadedFiles = async () => {
        const paths = Object.values(uploadedMeta).map((meta) => meta.path).filter(Boolean);
        if (!paths.length) return;

        await Promise.allSettled(paths.map((path) => deletePathSafely(path)));
    };

    const handleClose = async () => {
        if (isLoading) return;
        if (!generationCompletedRef.current) {
            await cleanupUploadedFiles();
        }
        onClose();
    };

    const queueUploads = async (files: File[]) => {
        if (!files.length) return;

        const { uploadDocumentToStorage } = await import('../lib/aiService');

        await Promise.all(files.map(async (file) => {
            const fileId = getFileId(file);

            setUploadStates((prev) => ({
                ...prev,
                [fileId]: { stage: 'uploading', progress: 0 },
            }));

            try {
                const uploaded = await uploadDocumentToStorage(file, {
                    onUploadProgress: (progress) => {
                        if (removedFileIdsRef.current.has(fileId)) return;
                        setUploadStates((prev) => ({
                            ...prev,
                            [fileId]: {
                                ...(prev[fileId] ?? { stage: 'uploading', progress: 0 }),
                                stage: 'uploading',
                                progress,
                            },
                        }));
                    },
                });

                if (removedFileIdsRef.current.has(fileId)) {
                    await deletePathSafely(uploaded.path);
                    return;
                }

                setUploadedMeta((prev) => ({
                    ...prev,
                    [fileId]: uploaded,
                }));

                setUploadStates((prev) => ({
                    ...prev,
                    [fileId]: { stage: 'uploaded', progress: 100 },
                }));
            } catch (uploadErr) {
                const message = uploadErr instanceof Error
                    ? uploadErr.message
                    : 'Upload failed. Please try again.';

                setUploadStates((prev) => ({
                    ...prev,
                    [fileId]: { stage: 'error', progress: 0, error: message },
                }));
            }
        }));
    };

    const addFiles = (incoming: File[]) => {
        if (!incoming.length) return;

        const existingIds = new Set(docFiles.map(getFileId));
        const uniqueFiles = incoming.filter((file) => !existingIds.has(getFileId(file)));
        if (!uniqueFiles.length) return;

        for (const file of uniqueFiles) {
            removedFileIdsRef.current.delete(getFileId(file));
        }

        setDocFiles((prev) => [...prev, ...uniqueFiles]);
        setUploadStates((prev) => {
            const next = { ...prev };
            for (const file of uniqueFiles) {
                const id = getFileId(file);
                if (!next[id]) next[id] = { stage: 'queued', progress: 0 };
            }
            return next;
        });

        void queueUploads(uniqueFiles);
    };

    const removeFile = (file: File) => {
        const id = getFileId(file);
        removedFileIdsRef.current.add(id);
        const uploaded = uploadedMeta[id];

        setDocFiles((prev) => prev.filter((f) => getFileId(f) !== id));
        setUploadStates((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setUploadedMeta((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });

        if (uploaded?.path) {
            void deletePathSafely(uploaded.path);
        }
    };

    useEffect(() => {
        if (open) {
            removedFileIdsRef.current = new Set();
            generationCompletedRef.current = false;
            setDocFiles([]);
            setError(null);
            setIsLoading(false);
            setUploadStates({});
            setUploadedMeta({});
        }
    }, [open]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) {
            addFiles(files);
            setError(null);
        }
    };

    const handleGenerate = async () => {
        if (!docFiles.length) return;
        setIsLoading(true);
        setError(null);

        const incompleteFiles = docFiles.filter((file) => !uploadedMeta[getFileId(file)]);
        if (incompleteFiles.length > 0) {
            setError('Please wait until all files finish uploading, or remove failed files.');
            setIsLoading(false);
            return;
        }

        const perFileResults: {
            file: File;
            title: string;
            noteContent: string;
            extractedText: string;
            publicUrl: string;
        }[] = [];

        try {
            const { extractDocumentFromStorage } = await import('../lib/aiService');
            for (const file of docFiles) {
                const fileId = getFileId(file);
                const uploaded = uploadedMeta[fileId];

                setUploadStates((prev) => ({
                    ...prev,
                    [fileId]: {
                        ...(prev[fileId] ?? { stage: 'uploaded', progress: 100 }),
                        stage: 'processing',
                        progress: 100,
                    },
                }));

                try {
                    const result = await extractDocumentFromStorage({
                        publicUrl: uploaded.publicUrl,
                        fileName: file.name,
                        mimeType: file.type || undefined,
                    });

                    setUploadStates((prev) => ({
                        ...prev,
                        [fileId]: { stage: 'done', progress: 100 },
                    }));

                    perFileResults.push({
                        file,
                        ...result,
                        publicUrl: uploaded.publicUrl,
                    });
                } catch (fileErr) {
                    const message = fileErr instanceof Error
                        ? fileErr.message
                        : 'Something went wrong. Please try again.';

                    setUploadStates((prev) => ({
                        ...prev,
                        [fileId]: {
                            ...(prev[fileId] ?? { stage: 'error', progress: 0 }),
                            stage: 'error',
                            error: message,
                        },
                    }));
                }
            }

            if (perFileResults.length !== docFiles.length) {
                setError('Some files failed during processing. Remove failed files and try again.');
                return;
            }

            const combinedTitleBase = perFileResults[0]?.title || docFiles[0]?.name.replace(/\.[^.]+$/, '') || 'Combined Note';
            const combinedTitle = docFiles.length > 1
                ? `${combinedTitleBase} + ${docFiles.length - 1} more`
                : combinedTitleBase;

            const combinedExtractedText = perFileResults
                .map((item) => `SOURCE: ${item.file.name}\n${item.extractedText}`)
                .join('\n\n');

            const combinedNoteContent = perFileResults
                .map((item) => item.noteContent)
                .join('\n\n');

            await onGenerate?.({
                files: docFiles,
                title: combinedTitle,
                noteContent: combinedNoteContent,
                extractedText: combinedExtractedText,
                publicUrls: perFileResults.map((item) => item.publicUrl),
            });

            generationCompletedRef.current = true;
            await handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalWrapper open={open} onClose={isLoading ? () => {} : () => { void handleClose(); }}>
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
                    Upload one or more files and Zemly AI will generate one combined study note
                </p>

                {/* Document Upload Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => !isLoading && fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
                    style={{
                        borderColor: isDragging ? 'rgba(79,156,249,0.5)' : docFiles.length ? 'rgba(79,156,249,0.35)' : 'rgba(255,255,255,0.08)',
                        background: isDragging ? 'rgba(79,156,249,0.05)' : docFiles.length ? 'rgba(79,156,249,0.04)' : 'rgba(255,255,255,0.02)',
                    }}
                >
                    <FiUploadCloud
                        className="mb-2 h-6 w-6"
                        style={{ color: isDragging || docFiles.length ? '#4F9CF9' : '#52525b' }}
                    />
                    <p className="text-center text-sm text-zinc-500">
                        {docFiles.length ? (
                            <span className="font-medium" style={{ color: '#4F9CF9' }}>{docFiles.length} file{docFiles.length > 1 ? 's' : ''} selected</span>
                        ) : (
                            <>Drag files here, or <span className="text-zinc-300 underline underline-offset-2">click to browse</span></>
                        )}
                    </p>
                    {docFiles.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-600">
                            {(docFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB total
                        </p>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.md"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) {
                                addFiles(files);
                                setError(null);
                            }
                            e.currentTarget.value = '';
                        }}
                    />
                </div>

                {/* Selected files and progress */}
                {docFiles.length > 0 && (
                    <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                        {docFiles.map((file) => {
                            const fileId = getFileId(file);
                            const state = uploadStates[fileId] ?? { stage: 'queued', progress: 0 };
                            const statusText = state.stage === 'uploading'
                                ? `Uploading... ${state.progress}%`
                                : state.stage === 'uploaded'
                                    ? 'Uploaded. Ready to merge.'
                                : state.stage === 'processing'
                                    ? 'Processing content...'
                                    : state.stage === 'done'
                                        ? 'Done'
                                        : state.stage === 'error'
                                            ? (state.error || 'Upload failed')
                                            : 'Ready to upload';

                            return (
                                <div
                                    key={fileId}
                                    className="rounded-xl px-3 py-3"
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-zinc-200">{file.name}</p>
                                            <p className={`mt-0.5 text-xs ${state.stage === 'error' ? 'text-red-400' : 'text-zinc-500'}`}>
                                                {statusText}
                                            </p>
                                        </div>

                                        {!isLoading && (
                                            <button
                                                onClick={() => removeFile(file)}
                                                className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                                                style={{ background: 'rgba(255,255,255,0.04)' }}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-200"
                                            style={{
                                                width: `${state.progress}%`,
                                                background: state.stage === 'error'
                                                    ? 'rgba(239,68,68,0.9)'
                                                    : state.stage === 'done'
                                                        ? 'rgba(34,197,94,0.9)'
                                                        : '#4F9CF9',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isLoading && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 w-full rounded-xl border border-dashed py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                        style={{ borderColor: 'rgba(79,156,249,0.35)', background: 'rgba(79,156,249,0.03)' }}
                    >
                        + Add Another File
                    </button>
                )}

                {/* Error */}
                {error && (
                    <div className="mt-3 rounded-lg px-3 py-2.5 text-[13px] text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        {error}
                    </div>
                )}

                {/* Generate Notes Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !docFiles.length || !docFiles.every((file) => {
                        const state = uploadStates[getFileId(file)];
                        return state?.stage === 'uploaded' || state?.stage === 'done';
                    })}
                    className="btn-emerald mt-5 w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(13,15,18,0.3)', borderTopColor: '#0D0F12' }} />
                            Generating combined note...
                        </span>
                    ) : (
                        'Generate Combined Note'
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
