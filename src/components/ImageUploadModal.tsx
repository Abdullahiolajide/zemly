import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadNoteImage } from '../lib/storageService';
import { FiUploadCloud, FiX, FiImage } from 'react-icons/fi';

interface ImageUploadModalProps {
    open: boolean;
    onClose: () => void;
    onImageInserted: (url: string) => void;
    userId: string;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ open, onClose, onImageInserted, userId }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleUpload = useCallback(async (file: File) => {
        try {
            setUploading(true);
            setError(null);
            setPreview(URL.createObjectURL(file));
            const publicUrl = await uploadNoteImage(file, userId);
            onImageInserted(publicUrl);
            setPreview(null);
        } catch (err: unknown) {
            console.error('[ImageUpload] Upload error:', err);
            setError('Could not upload your image. Please try again.');
        } finally {
            setUploading(false);
        }
    }, [userId, onImageInserted]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) { handleUpload(acceptedFiles[0]); }
    }, [handleUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024,
        disabled: uploading,
    });

    if (!open) return null;

    const closeIfNotUploading = () => {
        if (!uploading) { setPreview(null); setError(null); onClose(); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 cursor-pointer bg-black/70 backdrop-blur-sm" onClick={closeIfNotUploading} />

            {/* Modal */}
            <div
                className="relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl"
                style={{
                    background: 'rgba(16, 18, 24, 0.97)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
                }}
            >
                {/* Header */}
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-lg"
                            style={{ background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.2)' }}
                        >
                            <FiImage className="h-4 w-4" style={{ color: '#00C896' }} />
                        </div>
                        <h2
                            className="text-base font-semibold text-zinc-100"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Insert Image
                        </h2>
                    </div>
                    <button
                        onClick={closeIfNotUploading}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <FiX className="h-4 w-4" />
                    </button>
                </div>

                {/* Drop zone */}
                <div
                    {...getRootProps()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200"
                    style={{
                        borderColor: isDragActive ? '#00C896' : 'rgba(255,255,255,0.08)',
                        background: isDragActive ? 'rgba(0,200,150,0.06)' : uploading ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.02)',
                    }}
                >
                    <input {...getInputProps()} />

                    {uploading ? (
                        <>
                            {preview && (
                                <img src={preview} alt="Preview" className="mb-3 h-20 w-20 rounded-lg object-cover opacity-60" />
                            )}
                            <div
                                className="mb-2 h-6 w-6 animate-spin rounded-full border-2"
                                style={{ borderColor: 'rgba(0,200,150,0.2)', borderTopColor: '#00C896' }}
                            />
                            <p className="text-sm font-medium text-zinc-400">Uploading…</p>
                        </>
                    ) : (
                        <>
                            <div
                                className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                            >
                                <FiUploadCloud
                                    className="h-6 w-6"
                                    style={{ color: isDragActive ? '#00C896' : '#52525b' }}
                                />
                            </div>
                            <p className="mb-1 text-sm font-medium text-zinc-300">
                                {isDragActive ? 'Drop your image here' : 'Drag & drop an image'}
                            </p>
                            <p className="text-xs text-zinc-500">
                                or <span style={{ color: '#00C896' }} className="underline underline-offset-2">browse files</span> · PNG, JPG, GIF, WebP · 10 MB max
                            </p>
                        </>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageUploadModal;
