import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { FiTrash2 } from 'react-icons/fi';
import { deleteNoteImage } from '../lib/storageService';

interface ImageToolbarProps {
    editor: Editor;
}

const sizePresets = [
    { label: 'S', width: '25%' },
    { label: 'M', width: '50%' },
    { label: 'L', width: '75%' },
    { label: 'Full', width: '100%' },
];

const ImageToolbar: React.FC<ImageToolbarProps> = ({ editor }) => {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const [currentWidth, setCurrentWidth] = useState<string | null>(null);

    const updatePosition = useCallback(() => {
        const { node, from } = editor.state.selection as any;

        // Only show when an image node is selected
        if (!node || node.type.name !== 'image') {
            setVisible(false);
            return;
        }

        setCurrentWidth(node.attrs.width || '100%');

        const domNode = editor.view.nodeDOM(from) as HTMLElement | null;
        if (!domNode) {
            setVisible(false);
            return;
        }

        const img = domNode.tagName === 'IMG' ? domNode : domNode.querySelector('img');
        if (!img) {
            setVisible(false);
            return;
        }

        const rect = img.getBoundingClientRect();
        setCoords({
            x: rect.left + rect.width / 2,
            y: rect.top,
        });
        setVisible(true);
    }, [editor]);

    useEffect(() => {
        const handler = () => requestAnimationFrame(updatePosition);
        editor.on('selectionUpdate', handler);
        editor.on('blur', () => setVisible(false));
        return () => {
            editor.off('selectionUpdate', handler);
            editor.off('blur', () => setVisible(false));
        };
    }, [editor, updatePosition]);

    const handleDelete = async () => {
        const { node } = editor.state.selection as any;
        if (node?.type.name === 'image' && node.attrs.src) {
            await deleteNoteImage(node.attrs.src);
        }
        editor.chain().focus().deleteSelection().run();
        setVisible(false);
    };

    const handleResize = (width: string) => {
        editor.chain().focus().updateAttributes('image', { width }).run();
        setCurrentWidth(width);
    };

    if (!visible) return null;

    const toolbarWidth = 220;
    const left = Math.max(8, Math.min(coords.x - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8));
    const top = coords.y - 44;

    return (
        <div
            className="fixed z-[9999] flex items-center gap-1 rounded-xl border border-zinc-700/60 bg-zinc-900 px-1.5 py-1 shadow-xl shadow-black/40"
            style={{ left: `${left}px`, top: `${top}px` }}
            onMouseDown={(e) => e.preventDefault()}
        >
            {/* Size presets */}
            {sizePresets.map((preset) => (
                <button
                    key={preset.label}
                    onClick={() => handleResize(preset.width)}
                    className={`flex h-7 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition-colors ${
                        currentWidth === preset.width
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                    title={`Resize to ${preset.width}`}
                >
                    {preset.label}
                </button>
            ))}

            {/* Divider */}
            <div className="mx-0.5 h-4 w-px bg-zinc-700" />

            {/* Delete */}
            <button
                onClick={handleDelete}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
                title="Delete image"
            >
                <FiTrash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
};

export default ImageToolbar;
