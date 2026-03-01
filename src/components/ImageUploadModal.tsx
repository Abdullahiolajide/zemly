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
            const message = err instanceof Error ? err.message : 'Upload failed';
            setError(message);
        } finally {
            setUploading(false);
        }
    }, [userId, onImageInserted]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            handleUpload(acceptedFiles[0]);
        }
    }, [handleUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024, // 10 MB
        disabled: uploading,
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => { if (!uploading) { setPreview(null); setError(null); onClose(); } }}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800/60 bg-zinc-900 p-6 shadow-2xl">
                {/* Header */}
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15">
                            <FiImage className="h-4.5 w-4.5 text-indigo-400" />
                        </div>
                        <h2 className="text-base font-semibold text-zinc-100">Insert Image</h2>
                    </div>
                    <button
                        onClick={() => { if (!uploading) { setPreview(null); setError(null); onClose(); } }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                    >
                        <FiX className="h-4 w-4" />
                    </button>
                </div>

                {/* Drop zone */}
                <div
                    {...getRootProps()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                        isDragActive
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : uploading
                            ? 'border-zinc-700 bg-zinc-800/30'
                            : 'border-zinc-700 bg-zinc-800/20 hover:border-zinc-600 hover:bg-zinc-800/40'
                    }`}
                >
                    <input {...getInputProps()} />

                    {uploading ? (
                        <>
                            {preview && (
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="mb-3 h-20 w-20 rounded-lg object-cover opacity-60"
                                />
                            )}
                            <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                            <p className="text-sm font-medium text-zinc-400">Uploading…</p>
                        </>
                    ) : (
                        <>
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
                                <FiUploadCloud className={`h-6 w-6 ${isDragActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                            </div>
                            <p className="mb-1 text-sm font-medium text-zinc-300">
                                {isDragActive ? 'Drop your image here' : 'Drag & drop an image'}
                            </p>
                            <p className="text-xs text-zinc-500">
                                or <span className="text-indigo-400 underline">browse files</span> · PNG, JPG, GIF, WebP · 10 MB max
                            </p>
                        </>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageUploadModal;
