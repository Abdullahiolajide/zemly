import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { AiOutlineTable } from 'react-icons/ai';

interface TableGridPickerProps {
    editor: Editor;
}

const MAX_ROWS = 8;
const MAX_COLS = 8;

const TableGridPicker: React.FC<TableGridPickerProps> = ({ editor }) => {
    const [open, setOpen] = useState(false);
    const [hover, setHover] = useState({ row: 0, col: 0 });

    const handleInsert = (rows: number, cols: number) => {
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        setOpen(false);
        setHover({ row: 0, col: 0 });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                title="Insert table"
            >
                <AiOutlineTable className="h-4 w-4" />
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[98] cursor-pointer" onClick={() => setOpen(false)} />

                    {/* Grid picker */}
                    <div className="absolute left-0 top-full z-[99] mt-2 rounded-xl border border-zinc-800/60 bg-zinc-900 p-3 shadow-xl shadow-black/40">
                        <p className="mb-2 text-center text-[11px] font-medium text-zinc-400">
                            {hover.row > 0 ? `${hover.row} × ${hover.col}` : 'Select size'}
                        </p>
                        <div
                            className="grid gap-[3px]"
                            style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)` }}
                        >
                            {Array.from({ length: MAX_ROWS * MAX_COLS }).map((_, i) => {
                                const row = Math.floor(i / MAX_COLS) + 1;
                                const col = (i % MAX_COLS) + 1;
                                const isHighlighted = row <= hover.row && col <= hover.col;

                                return (
                                    <div
                                        key={i}
                                        className={`h-[18px] w-[18px] rounded-[3px] border transition-colors cursor-pointer ${
                                            isHighlighted
                                                ? 'border-indigo-500 bg-indigo-500/30'
                                                : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600'
                                        }`}
                                        onMouseEnter={() => setHover({ row, col })}
                                        onClick={() => handleInsert(row, col)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TableGridPicker;
