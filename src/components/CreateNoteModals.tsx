import { useState, useRef, useEffect } from 'react';
import { IoClose, IoMicOutline, IoLinkOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { MdUploadFile } from 'react-icons/md';
import { FiUploadCloud } from 'react-icons/fi';
import { AUDIO_UPLOAD_ACCEPT, isLikelyAudioFile } from '../lib/aiService';
import GenerationProgressBar, { NOTE_GENERATION_PHASES } from './GenerationProgressBar';

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
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center cursor-pointer"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" />

            {/* Card */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl cursor-default animate-[modalSlideUp_250ms_ease-out]"
                style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-glass-strong)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                    maxHeight: 'min(92vh, 920px)',
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:text-zinc-300"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    aria-label="Close modal"
                >
                    <IoClose className="h-5 w-5" />
                </button>

                <div className="max-h-[inherit] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   Shared input style helper (applied via onFocus/onBlur)
   ───────────────────────────────────────────── */
const inputBaseClass =
    'w-full rounded-xl px-4 py-3 text-sm  placeholder-zinc-600 outline-none transition-all duration-200';
const inputStyle: React.CSSProperties = {
    background: 'var(--bg-glass-hover)',
    border: '1px solid var(--border-glass)',
    fontFamily: "'DM Sans', sans-serif",
};
const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#00C896';
    e.target.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.12)';
};
const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border-glass)';
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
                    className="mb-2 text-center text-xl font-bold "
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
    onGenerate?: (files: File[]) => void | Promise<void>;
}

interface AudioItemState {
    file: File;
    previewUrl: string;
}

export const AudioModal: React.FC<AudioModalProps> = ({
    open,
    onClose,
    onGenerate,
}) => {
    const [audioItems, setAudioItems] = useState<AudioItemState[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingPaused, setIsRecordingPaused] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingStreamRef = useRef<MediaStream | null>(null);
    const recordingChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<number | null>(null);
    const previewUrlsRef = useRef<string[]>([]);

    const startTimer = () => {
        if (recordingTimerRef.current !== null) return;
        recordingTimerRef.current = window.setInterval(() => {
            setRecordingSeconds((prev) => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (recordingTimerRef.current !== null) {
            window.clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };

    const stopStream = () => {
        if (!recordingStreamRef.current) return;
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
    };

    const cleanupAllPreviews = () => {
        previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        previewUrlsRef.current = [];
    };

    const addAudioFile = (file: File) => {
        if (!isLikelyAudioFile(file)) {
            setError('Please upload a supported audio file (MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WEBM, MP4, and more).');
            return;
        }

        if (file.size > 60 * 1024 * 1024) {
            setError('Audio file is too large. Use a file under 60 MB.');
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.push(previewUrl);
        setAudioItems((prev) => [...prev, { file, previewUrl }]);
        setError(null);
    };

    const removeAudioFile = (index: number) => {
        setAudioItems((prev) => {
            const target = prev[index];
            if (target) {
                URL.revokeObjectURL(target.previewUrl);
                previewUrlsRef.current = previewUrlsRef.current.filter((url) => url !== target.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const pauseRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state !== 'recording') return;
        recorder.pause();
        setIsRecordingPaused(true);
        stopTimer();
    };

    const resumeRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state !== 'paused') return;
        recorder.resume();
        setIsRecordingPaused(false);
        startTimer();
    };

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        } else {
            stopStream();
        }
        setIsRecording(false);
        setIsRecordingPaused(false);
        stopTimer();
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Your browser does not support microphone recording.');
            return;
        }

        if (typeof MediaRecorder === 'undefined') {
            setError('Media recording is not available in this browser.');
            return;
        }

        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recordingStreamRef.current = stream;

            const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
            const supportedMime = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type));
            const recorder = supportedMime
                ? new MediaRecorder(stream, { mimeType: supportedMime })
                : new MediaRecorder(stream);

            mediaRecorderRef.current = recorder;
            recordingChunksRef.current = [];
            setRecordingSeconds(0);
            setIsRecordingPaused(false);

            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data.size > 0) recordingChunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                const mimeType = recorder.mimeType || 'audio/webm';
                const blob = new Blob(recordingChunksRef.current, { type: mimeType });

                if (blob.size === 0) {
                    setError('No audio captured. Please try recording again.');
                    stopStream();
                    return;
                }

                const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
                const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType });
                addAudioFile(file);
                stopStream();
            };

            recorder.onerror = () => {
                setError('Recording failed. Please try again.');
                setIsRecording(false);
                setIsRecordingPaused(false);
                stopTimer();
                stopStream();
            };

            recorder.start(500);
            setIsRecording(true);
            startTimer();
        } catch (err) {
            console.error('[AudioModal] Mic access error:', err);
            setError('Could not access your microphone. Please check browser permissions and try again.');
            setIsRecording(false);
            setIsRecordingPaused(false);
            stopTimer();
            stopStream();
        }
    };

    useEffect(() => {
        if (!open) return;
        setAudioItems([]);
        setError(null);
        setIsDragging(false);
        setIsGenerating(false);
        setRecordingSeconds(0);
        setIsRecording(false);
        setIsRecordingPaused(false);
        stopTimer();
        stopStream();
        cleanupAllPreviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        return () => {
            stopTimer();
            stopStream();
            cleanupAllPreviews();
        };
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        files.forEach((file) => addAudioFile(file));
    };

    const handleGenerate = async () => {
        if (!audioItems.length || isGenerating || isRecording) return;

        try {
            setIsGenerating(true);
            setError(null);
            await onGenerate?.(audioItems.map((item) => item.file));
            onClose();
        } catch (err) {
            console.error('[AudioModal] Generate note error:', err);
            setError('Could not generate your note from audio. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleClose = () => {
        if (isGenerating) return;
        if (isRecording || isRecordingPaused) stopRecording();
        onClose();
    };

    return (
        <ModalWrapper open={open} onClose={handleClose}>
            <div className="px-8 pt-10 pb-8">
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}
                >
                    <IoMicOutline className="h-7 w-7" style={{ color: '#F5A623' }} />
                </div>

                <h2
                    className="mb-6 text-center text-xl font-bold "
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                >
                    Create note from audio
                </h2>

                <div className="mb-4">
                    <p className="mb-2.5 text-[13px] font-medium text-zinc-400">Make a recording</p>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { void (isRecording ? Promise.resolve(stopRecording()) : startRecording()); }}
                            disabled={isGenerating}
                            className="flex h-10 shrink-0 items-center justify-center rounded-xl px-3 text-[12px] font-semibold text-white transition-all duration-200 hover:scale-105 disabled:opacity-60"
                            style={{ background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.25)', color: '#F5A623' }}
                        >
                            {isRecording ? 'Stop' : 'Record'}
                        </button>

                        <button
                            onClick={() => { void (isRecordingPaused ? Promise.resolve(resumeRecording()) : Promise.resolve(pauseRecording())); }}
                            disabled={!isRecording || isGenerating}
                            className="flex h-10 shrink-0 items-center justify-center rounded-xl px-3 text-[12px] font-semibold text-white transition-all duration-200 hover:scale-105 disabled:opacity-40"
                            style={{ background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.25)', color: '#F5A623' }}
                        >
                            {isRecordingPaused ? 'Resume' : 'Pause'}
                        </button>

                        <div className="flex-1 rounded-full p-0.5" style={{ background: 'var(--bg-glass-hover)' }}>
                            <div
                                className="h-2 rounded-full transition-all duration-300"
                                style={{
                                    width: isRecording ? `${Math.min(100, (recordingSeconds / 180) * 100)}%` : audioItems.length ? '100%' : '12%',
                                    background: isRecording
                                        ? 'linear-gradient(90deg, rgba(245,166,35,0.4), rgba(245,166,35,0.95))'
                                        : audioItems.length
                                            ? 'rgba(245,166,35,0.9)'
                                            : 'rgba(245,166,35,0.2)',
                                }}
                            />
                        </div>
                    </div>

                    <p className="mt-2 text-xs text-zinc-500">
                        {isRecording
                            ? `${isRecordingPaused ? 'Paused' : 'Recording'}... ${formatDuration(recordingSeconds)}`
                            : audioItems.length
                                ? `${audioItems.length} audio file${audioItems.length > 1 ? 's' : ''} ready`
                                : 'Tap record, then stop to add it. You can add multiple audio files.'}
                    </p>
                </div>

                <div className="my-5 flex items-center gap-4">
                    <div className="h-px flex-1" style={{ background: 'var(--border-glass)' }} />
                    <span className="text-xs font-medium text-zinc-600">Or</span>
                    <div className="h-px flex-1" style={{ background: 'var(--border-glass)' }} />
                </div>

                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => !isGenerating && fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-all duration-200 ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}
                    style={{
                        borderColor: isDragging ? 'rgba(245,166,35,0.5)' : audioItems.length ? 'rgba(245,166,35,0.35)' : 'var(--border-glass)',
                        background: isDragging ? 'rgba(245,166,35,0.05)' : audioItems.length ? 'rgba(245,166,35,0.04)' : 'var(--bg-glass-hover)',
                    }}
                >
                    <FiUploadCloud className="mb-2 h-6 w-6" style={{ color: isDragging || audioItems.length ? '#F5A623' : '#52525b' }} />
                    <p className="text-center text-sm text-zinc-500">
                        {audioItems.length ? (
                            <span className="font-medium" style={{ color: '#F5A623' }}>+ Add more audio files</span>
                        ) : (
                            <>Drag audio files here, or click to upload (MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WEBM, MP4...)</>
                        )}
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={AUDIO_UPLOAD_ACCEPT}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            files.forEach((file) => addAudioFile(file));
                            e.currentTarget.value = '';
                        }}
                    />
                </div>

                {audioItems.length > 0 && (
                    <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                        {audioItems.map((item, index) => (
                            <div
                                key={`${item.file.name}-${item.file.lastModified}-${index}`}
                                className="rounded-xl px-3 py-3"
                                style={{ background: 'var(--bg-glass-hover)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-zinc-200">{item.file.name}</p>
                                        <p className="mt-0.5 text-xs text-zinc-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    {!isGenerating && (
                                        <button
                                            onClick={() => removeAudioFile(index)}
                                            className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                                            style={{ background: 'var(--bg-glass-hover)' }}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <audio className="w-full" controls src={item.previewUrl} />
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="mt-3 rounded-lg px-3 py-2.5 text-[13px] text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={() => { void handleGenerate(); }}
                    disabled={isGenerating || isRecording || !audioItems.length}
                    className="btn-emerald mt-5 w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                </button>
                <GenerationProgressBar active={isGenerating} phases={NOTE_GENERATION_PHASES} />
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
        paths?: string[];
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
                console.error('[DocumentModal] File upload error:', uploadErr);
                setUploadStates((prev) => ({
                    ...prev,
                    [fileId]: { stage: 'error', progress: 0, error: 'Upload failed. Please try again.' },
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
            path: string;
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
                        path: uploaded.path,
                    });
                } catch (fileErr) {
                    console.error('[DocumentModal] File processing error:', fileErr);
                    setUploadStates((prev) => ({
                        ...prev,
                        [fileId]: {
                            ...(prev[fileId] ?? { stage: 'error', progress: 0 }),
                            stage: 'error',
                            error: 'Could not process this file. Please try again.',
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
                paths: perFileResults.map((item) => item.path),
            });

            generationCompletedRef.current = true;
            await handleClose();
        } catch (err) {
            console.error('[DocumentModal] Generate combined note error:', err);
            setError('Something went wrong generating your note. Please try again.');
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
                    className="mb-2 text-center text-xl font-bold "
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
                        borderColor: isDragging ? 'rgba(79,156,249,0.5)' : docFiles.length ? 'rgba(79,156,249,0.35)' : 'var(--border-glass)',
                        background: isDragging ? 'rgba(79,156,249,0.05)' : docFiles.length ? 'rgba(79,156,249,0.04)' : 'var(--bg-glass-hover)',
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
                                        background: 'var(--bg-glass-hover)',
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
                                                style={{ background: 'var(--bg-glass-hover)' }}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-glass)' }}>
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
                        'Generate Note'
                    )}
                </button>
                <GenerationProgressBar active={isLoading} phases={NOTE_GENERATION_PHASES} />
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
    onGenerate?: (url: string) => void | Promise<void>;
}

export const WebsiteLinkModal: React.FC<WebsiteLinkModalProps> = ({
    open,
    onClose,
    onGenerate,
}) => {
    const [url, setUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const normalizeUrl = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://${trimmed}`;
    };

    const validateUrl = (value: string): string | null => {
        if (!value.trim()) return 'Please paste a website or YouTube link.';

        const candidate = normalizeUrl(value);
        try {
            const parsed = new URL(candidate);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return 'Only HTTP and HTTPS links are supported.';
            }
            if (!parsed.hostname.includes('.')) {
                return 'Please enter a valid website URL.';
            }
            return null;
        } catch {
            return 'Please enter a valid URL.';
        }
    };

    const handleGenerate = async () => {
        if (!onGenerate || isGenerating) return;

        const validationError = validateUrl(url);
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setIsGenerating(true);
            setError(null);
            await onGenerate(normalizeUrl(url));
            onClose();
        } catch (err) {
            console.error('[LinkModal] Generate note error:', err);
            setError('Could not generate notes from this link. Please check the URL and try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (open) {
            setUrl('');
            setError(null);
            setIsGenerating(false);
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
                    className="mb-6 text-center text-xl font-bold "
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em' }}
                >
                    Create note from source
                </h2>

                {/* URL Input */}
                <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={(e) => {
                        setUrl(e.target.value);
                        if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && url.trim()) {
                            void handleGenerate();
                        }
                    }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    disabled={isGenerating}
                    placeholder="Paste a website or YouTube link..."
                    className={inputBaseClass}
                    style={inputStyle}
                />

                {error && (
                    <div className="mt-3 rounded-lg px-3 py-2.5 text-[13px] text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        {error}
                    </div>
                )}

                {/* Generate Notes Button */}
                <button
                    onClick={() => { void handleGenerate(); }}
                    disabled={isGenerating}
                    className="btn-emerald mt-5 w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                </button>
                <GenerationProgressBar active={isGenerating} phases={NOTE_GENERATION_PHASES} />
            </div>
        </ModalWrapper>
    );
};
