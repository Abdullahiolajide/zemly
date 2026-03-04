import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
    FiBold,
    FiItalic,
    FiUnderline,
} from 'react-icons/fi';
import { RxStrikethrough } from 'react-icons/rx';
import { PiHighlighter } from 'react-icons/pi';
import { MdAutoAwesome } from 'react-icons/md';

interface BubbleToolbarProps {
    editor: Editor;
    onAskAI?: (selectedText: string) => void;
}

const BubbleToolbar: React.FC<BubbleToolbarProps> = ({ editor, onAskAI }) => {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const toolbarRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        const { from, to, empty } = editor.state.selection;

        // Hide when empty selection or when an image node is selected
        const { node } = editor.state.selection as any;
        if (empty || from === to || (node && node.type.name === 'image')) {
            setVisible(false);
            return;
        }

        // Get the bounding rect of the selection
        const view = editor.view;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);

        // Center horizontally between start and end, position above the selection
        const x = (start.left + end.right) / 2;
        const y = start.top;

        setCoords({ x, y });
        setVisible(true);
    }, [editor]);

    useEffect(() => {
        // Listen to selection changes
        const handleTransaction = () => {
            // Small delay so the DOM settles
            requestAnimationFrame(updatePosition);
        };

        editor.on('selectionUpdate', handleTransaction);
        editor.on('blur', () => setVisible(false));
        editor.on('focus', handleTransaction);

        return () => {
            editor.off('selectionUpdate', handleTransaction);
            editor.off('blur', () => setVisible(false));
            editor.off('focus', handleTransaction);
        };
    }, [editor, updatePosition]);

    if (!visible) return null;

    // Calculate position relative to viewport
    const toolbarWidth = 280;
    const left = Math.max(8, Math.min(coords.x - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8));
    const top = coords.y - 48; // 48px above selection

    return (
        <div
            ref={toolbarRef}
            className="fixed z-[9999] flex items-center gap-0.5 rounded-xl border border-zinc-700/60 bg-zinc-900 px-1.5 py-1 shadow-xl shadow-black/40 animate-in fade-in duration-150"
            style={{
                left: `${left}px`,
                top: `${top}px`,
            }}
            // Prevent toolbar clicks from blurring the editor
            onMouseDown={(e) => e.preventDefault()}
        >
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    editor.isActive('bold')
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title="Bold"
            >
                <FiBold className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    editor.isActive('italic')
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title="Italic"
            >
                <FiItalic className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    editor.isActive('underline')
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title="Underline"
            >
                <FiUnderline className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    editor.isActive('strike')
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title="Strikethrough"
            >
                <RxStrikethrough className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    editor.isActive('highlight')
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title="Highlight"
            >
                <PiHighlighter className="h-3.5 w-3.5" />
            </button>

            {/* Divider */}
            <div className="mx-0.5 h-4 w-px bg-zinc-700" />

            {/* Ask AI */}
            <button
                onClick={() => {
                    const { from, to } = editor.state.selection;
                    const selectedText = editor.state.doc.textBetween(from, to, ' ');
                    if (selectedText && onAskAI) {
                        onAskAI(selectedText);
                    }
                    setVisible(false);
                }}
                className="flex items-center gap-1.5 rounded-md bg-indigo-500/15 px-2.5 py-1 text-[12px] font-semibold text-indigo-400 transition-colors hover:bg-indigo-500/25"
                title="Ask AI about this text"
            >
                <MdAutoAwesome className="h-3.5 w-3.5" />
                Ask AI
            </button>
        </div>
    );
};

export default BubbleToolbar;
