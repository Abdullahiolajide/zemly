import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { FiBold, FiItalic, FiUnderline } from 'react-icons/fi';
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
        const { node } = editor.state.selection as any;
        if (empty || from === to || (node && node.type.name === 'image')) {
            setVisible(false);
            return;
        }
        const view = editor.view;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        const x = (start.left + end.right) / 2;
        const y = start.top;
        setCoords({ x, y });
        setVisible(true);
    }, [editor]);

    useEffect(() => {
        const handleTransaction = () => { requestAnimationFrame(updatePosition); };
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

    const toolbarWidth = 290;
    const left = Math.max(8, Math.min(coords.x - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8));
    const top = coords.y - 52;

    /* Active button style helpers */
    const activeStyle = { background: 'rgba(0,200,150,0.15)', color: '#00C896' };
    const inactiveClass = 'text-zinc-400 hover:text-zinc-200';

    return (
        <div
            ref={toolbarRef}
            className="fixed z-[9999] flex items-center gap-0.5 rounded-xl px-1.5 py-1 shadow-xl animate-in fade-in duration-150"
            style={{
                left: `${left}px`,
                top: `${top}px`,
                background: 'rgba(14, 17, 23, 0.97)',
                border: '1px solid rgba(255,255,255,0.09)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onMouseDown={(e) => e.preventDefault()}
        >
            {/* Bold */}
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${editor.isActive('bold') ? '' : inactiveClass}`}
                style={editor.isActive('bold') ? activeStyle : {}}
                title="Bold"
            >
                <FiBold className="h-3.5 w-3.5" />
            </button>

            {/* Italic */}
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${editor.isActive('italic') ? '' : inactiveClass}`}
                style={editor.isActive('italic') ? activeStyle : {}}
                title="Italic"
            >
                <FiItalic className="h-3.5 w-3.5" />
            </button>

            {/* Underline */}
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${editor.isActive('underline') ? '' : inactiveClass}`}
                style={editor.isActive('underline') ? activeStyle : {}}
                title="Underline"
            >
                <FiUnderline className="h-3.5 w-3.5" />
            </button>

            {/* Strike */}
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${editor.isActive('strike') ? '' : inactiveClass}`}
                style={editor.isActive('strike') ? activeStyle : {}}
                title="Strikethrough"
            >
                <RxStrikethrough className="h-3.5 w-3.5" />
            </button>

            {/* Highlight */}
            <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${editor.isActive('highlight') ? '' : inactiveClass}`}
                style={editor.isActive('highlight') ? { background: 'rgba(245,166,35,0.15)', color: '#F5A623' } : {}}
                title="Highlight"
            >
                <PiHighlighter className="h-3.5 w-3.5" />
            </button>

            {/* Divider */}
            <div className="mx-0.5 h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

            {/* Ask AI */}
            <button
                onClick={() => {
                    const { from, to } = editor.state.selection;
                    const selectedText = editor.state.doc.textBetween(from, to, ' ');
                    if (selectedText && onAskAI) { onAskAI(selectedText); }
                    setVisible(false);
                }}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors"
                style={{ background: 'rgba(0,200,150,0.12)', color: '#00C896' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.12)'; }}
                title="Ask AI about this text"
            >
                <MdAutoAwesome className="h-3.5 w-3.5" />
                Ask AI
            </button>
        </div>
    );
};

export default BubbleToolbar;
