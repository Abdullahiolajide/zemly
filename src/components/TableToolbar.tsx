import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
    AiOutlineInsertRowAbove,
    AiOutlineInsertRowBelow,
    AiOutlineInsertRowLeft,
    AiOutlineInsertRowRight,
    AiOutlineDeleteRow,
    AiOutlineDeleteColumn,
} from 'react-icons/ai';
import { FiTrash2 } from 'react-icons/fi';

interface TableToolbarProps {
    editor: Editor;
}

const TableToolbar: React.FC<TableToolbarProps> = ({ editor }) => {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });

    const updatePosition = useCallback(() => {
        // Check if cursor is inside a table
        if (!editor.isActive('table')) {
            setVisible(false);
            return;
        }

        const { from } = editor.state.selection;
        const domAtPos = editor.view.domAtPos(from);
        const node = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
        if (!node) {
            setVisible(false);
            return;
        }

        // Find the closest table element
        const tableEl = node.closest('table');
        if (!tableEl) {
            setVisible(false);
            return;
        }

        const rect = tableEl.getBoundingClientRect();
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

    if (!visible) return null;

    const toolbarWidth = 310;
    const left = Math.max(8, Math.min(coords.x - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8));
    const top = coords.y - 44;

    const btn = (
        onClick: () => void,
        title: string,
        Icon: React.ComponentType<{ className?: string }>,
        danger = false
    ) => (
        <button
            onClick={onClick}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                danger
                    ? 'text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title={title}
        >
            <Icon className="h-3.5 w-3.5" />
        </button>
    );

    return (
        <div
            className="fixed z-[9999] flex items-center gap-0.5 rounded-xl border border-zinc-700/60 bg-zinc-900 px-1.5 py-1 shadow-xl shadow-black/40"
            style={{ left: `${left}px`, top: `${top}px` }}
            onMouseDown={(e) => e.preventDefault()}
        >
            {btn(() => editor.chain().focus().addRowBefore().run(), 'Add row above', AiOutlineInsertRowAbove)}
            {btn(() => editor.chain().focus().addRowAfter().run(), 'Add row below', AiOutlineInsertRowBelow)}

            <div className="mx-0.5 h-4 w-px bg-zinc-700" />

            {btn(() => editor.chain().focus().addColumnBefore().run(), 'Add column left', AiOutlineInsertRowLeft)}
            {btn(() => editor.chain().focus().addColumnAfter().run(), 'Add column right', AiOutlineInsertRowRight)}

            <div className="mx-0.5 h-4 w-px bg-zinc-700" />

            {btn(() => editor.chain().focus().deleteRow().run(), 'Delete row', AiOutlineDeleteRow, true)}
            {btn(() => editor.chain().focus().deleteColumn().run(), 'Delete column', AiOutlineDeleteColumn, true)}

            <div className="mx-0.5 h-4 w-px bg-zinc-700" />

            {btn(() => { editor.chain().focus().deleteTable().run(); setVisible(false); }, 'Delete table', FiTrash2, true)}
        </div>
    );
};

export default TableToolbar;
