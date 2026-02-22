import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import 'prosemirror-view/style/prosemirror.css';

import { getNote, updateNote } from '../lib/notesService';
import type { Note } from '../types';
import FlashcardsPanel from '../components/FlashcardsPanel';

import { MdAutoAwesome } from 'react-icons/md';
import { IoDocumentTextOutline, IoEyeOutline } from 'react-icons/io5';
import { BsChatDots, BsMic, BsThreeDotsVertical } from 'react-icons/bs';
import { TbCards } from 'react-icons/tb';
import { PiExam, PiHighlighter } from 'react-icons/pi';
import { RiMoonLine, RiShareLine } from 'react-icons/ri';
import { HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight } from 'react-icons/hi';
import { useAuthStore } from '../store/useAuthStore';
import { LuClock4 } from 'react-icons/lu';
import {
    FiBold,
    FiItalic,
    FiUnderline,
    FiImage,
    FiAlignLeft,
    FiAlignCenter,
    FiAlignRight,
    FiList,
    FiMinus,
    FiPlus,
} from 'react-icons/fi';
import { RxStrikethrough } from 'react-icons/rx';
import { AiOutlineTable, AiOutlineOrderedList } from 'react-icons/ai';
import ThemeModal from '../components/ThemeModal';

/* ── Note-page sidebar nav items ── */
const noteSidebarLinks = [
    { icon: IoDocumentTextOutline, label: 'Document' },
    { icon: BsChatDots, label: 'Chat Bot' },
    { icon: BsMic, label: 'Podcast' },
    { icon: TbCards, label: 'Flashcards' },
    { icon: PiExam, label: 'Quiz' },
];

type SidebarSection = 'Document' | 'Chat Bot' | 'Podcast' | 'Flashcards' | 'Quiz';

const NotePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<SidebarSection>('Document');

    /* Force toolbar re-render on every editor state change (mark toggles, selection, etc.) */
    const [, setEditorKey] = useState(0);

    /* ── TipTap editor ── */
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder: 'Start writing your note…',
            }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            Image,
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            TextStyleKit.configure({
                fontFamily: false,
                backgroundColor: false,
                color: false,
                lineHeight: false,
            }),
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-zinc max-w-none focus:outline-none min-h-[60vh] px-0 py-4',
            },
        },
        onUpdate: ({ editor: ed }) => {
            handleAutoSave(ed.getJSON() as Record<string, unknown>);
        },
        /* Re-render toolbar on every transaction so isActive() reflects immediately */
        onTransaction: () => {
            setEditorKey(k => k + 1);
        },
    });

    /* ── Load note data ── */
    useEffect(() => {
        if (!id) return;
        const fetchNote = async () => {
            try {
                setLoading(true);
                const data = await getNote(Number(id));
                setNote(data);
                if (data.content && editor) {
                    editor.commands.setContent(data.content);
                }
            } catch (err) {
                console.error('Failed to load note:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchNote();
    }, [id, editor]);

    /* ── Auto-save with debounce ── */
    const handleAutoSave = useCallback(
        (() => {
            let timeout: ReturnType<typeof setTimeout>;
            return (content: Record<string, unknown>) => {
                clearTimeout(timeout);
                setSaveStatus('saving');
                timeout = setTimeout(async () => {
                    try {
                        if (!id) return;
                        await updateNote(Number(id), { content });
                        setSaveStatus('saved');
                    } catch (err) {
                        console.error('Auto-save failed:', err);
                        setSaveStatus('error');
                    }
                }, 1200);
            };
        })(),
        [id]
    );

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
                <p className="text-lg font-semibold">Note not found</p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="flex h-screen bg-zinc-950 text-zinc-100">
                {/* ─── SIDEBAR ─── */}
                <aside
                    className={`${sidebarOpen ? 'w-56' : 'w-0'
                        } flex shrink-0 flex-col overflow-hidden border-r border-zinc-800/50 bg-zinc-900/60 transition-all duration-300`}
                >
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between px-5 py-4">
                        <div
                            className="flex cursor-pointer items-center gap-2.5"
                            onClick={() => navigate('/dashboard')}
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                                <MdAutoAwesome className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-base font-bold tracking-tight text-zinc-100">
                                Zemly
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                            aria-label="Collapse sidebar"
                        >
                            <HiOutlineChevronDoubleLeft className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Nav Links */}
                    <nav className="flex-1 px-3 pt-2">
                        <div className="flex flex-col gap-0.5">
                            {noteSidebarLinks.map((link) => (
                                <button
                                    key={link.label}
                                    onClick={() => setActiveSection(link.label as SidebarSection)}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 ${activeSection === link.label
                                        ? 'bg-indigo-500/12 text-indigo-400'
                                        : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                                        }`}
                                >
                                    <link.icon className="h-[18px] w-[18px]" />
                                    <span>{link.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Upgrade Button */}
                        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:shadow-indigo-500/30 hover:brightness-110">
                            <MdAutoAwesome className="h-4 w-4" />
                            Upgrade to Premium
                        </button>
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="border-t border-zinc-800/50 px-3 py-3">
                        {/* Theme Toggle */}
                        <button
                            onClick={() => setThemeModalOpen(true)}
                            className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-zinc-800/70 hover:text-zinc-200"
                        >
                            <RiMoonLine className="h-[18px] w-[18px]" />
                            <span>Theme</span>
                        </button>

                        {/* User */}
                        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[11px] font-bold text-white">
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-zinc-300">
                                    {user?.email || 'user@zemly.app'}
                                </p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* ─── MAIN CONTENT ─── */}
                <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
                    {/* ── Top Bar ── */}
                    <div className="flex items-center justify-between border-b border-zinc-800/50 px-6 py-3">
                        <div className="flex items-center gap-3">
                            {!sidebarOpen && (
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100"
                                    aria-label="Expand sidebar"
                                >
                                    <HiOutlineChevronDoubleRight className="h-4 w-4" />
                                </button>
                            )}
                            <h1 className="text-base font-semibold text-zinc-100 truncate max-w-md">
                                {note.title}
                            </h1>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Save status */}
                            <span className={`text-xs font-medium ${saveStatus === 'saved' ? 'text-zinc-500' : saveStatus === 'saving' ? 'text-amber-400' : 'text-red-400'}`}>
                                {saveStatus === 'saved' ? '' : saveStatus === 'saving' ? 'Saving…' : 'Error saving'}
                            </span>

                            {/* Last edited */}
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-300">
                                <LuClock4 className="h-4 w-4" />
                            </button>

                            {/* Share */}
                            <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-[13px] font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-indigo-500/35 hover:brightness-110">
                                <RiShareLine className="h-4 w-4" />
                                Share
                            </button>

                            {/* More */}
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-300">
                                <BsThreeDotsVertical className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* ── Editor Area ── */}
                    {/* ── Section Content ── */}
                    {activeSection === 'Document' && (
                        <div className="mx-auto w-full max-w-4xl flex-1 px-8 py-6 lg:px-16">
                            {/* ── Toolbar ── */}
                            {editor && (() => {
                                const rawFontSize = editor.getAttributes('textStyle')?.fontSize as string | undefined;
                                const currentFontSize = rawFontSize ? parseInt(rawFontSize, 10) : 16;

                                const changeFontSize = (delta: number) => {
                                    const next = Math.max(10, Math.min(72, currentFontSize + delta));
                                    editor.chain().focus().setFontSize(`${next}px`).run();
                                };

                                return (
                                    <div className="mb-6 flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
                                        <button className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800">
                                            Sans Serif <span className="ml-1 text-zinc-500">▾</span>
                                        </button>

                                        <div className="mx-1 h-5 w-px bg-zinc-800" />

                                        <button
                                            onClick={() => changeFontSize(-1)}
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                                            title="Decrease font size"
                                        >
                                            <FiMinus className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="mx-1 min-w-[28px] text-center text-[13px] font-medium text-zinc-300">
                                            {currentFontSize}
                                        </span>
                                        <button
                                            onClick={() => changeFontSize(1)}
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                                            title="Increase font size"
                                        >
                                            <FiPlus className="h-3.5 w-3.5" />
                                        </button>

                                        <div className="mx-1 h-5 w-px bg-zinc-800" />

                                        <button
                                            onClick={() => editor.chain().focus().toggleBold().run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive('bold')
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Bold"
                                        >
                                            <FiBold className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => editor.chain().focus().toggleItalic().run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive('italic')
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Italic"
                                        >
                                            <FiItalic className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive('underline')
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Underline"
                                        >
                                            <FiUnderline className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => editor.chain().focus().toggleStrike().run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive('strike')
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Strikethrough"
                                        >
                                            <RxStrikethrough className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => editor.chain().focus().toggleHighlight().run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive('highlight')
                                                ? 'bg-amber-500/20 text-amber-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Highlight"
                                        >
                                            <PiHighlighter className="h-4 w-4" />
                                        </button>

                                        <div className="mx-1 h-5 w-px bg-zinc-800" />

                                        <button
                                            onClick={() => {
                                                const url = window.prompt('Image URL');
                                                if (url) editor.chain().focus().setImage({ src: url }).run();
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                                            title="Insert image"
                                        >
                                            <FiImage className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() =>
                                                editor
                                                    .chain()
                                                    .focus()
                                                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                                                    .run()
                                            }
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                                            title="Insert table"
                                        >
                                            <AiOutlineTable className="h-4 w-4" />
                                        </button>

                                        <div className="mx-1 h-5 w-px bg-zinc-800" />

                                        <button
                                            onClick={() => editor.chain().focus().setTextAlign('left').run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive({ textAlign: 'left' })
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Align left"
                                        >
                                            <FiAlignLeft className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => editor.chain().focus().setTextAlign('center').run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive({ textAlign: 'center' })
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Align center"
                                        >
                                            <FiAlignCenter className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => editor.chain().focus().setTextAlign('right').run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive({ textAlign: 'right' })
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Align right"
                                        >
                                            <FiAlignRight className="h-4 w-4" />
                                        </button>

                                        <div className="mx-1 h-5 w-px bg-zinc-800" />

                                        <button
                                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive('bulletList')
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Bullet list"
                                        >
                                            <FiList className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${editor.isActive('orderedList')
                                                ? 'bg-indigo-500/20 text-indigo-400'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                }`}
                                            title="Ordered list"
                                        >
                                            <AiOutlineOrderedList className="h-4 w-4" />
                                        </button>

                                        <button
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                                            title="Preview"
                                        >
                                            <IoEyeOutline className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* ── Editor Content ── */}
                            <EditorContent editor={editor} />
                        </div>
                    )}

                    {activeSection === 'Flashcards' && id && (
                        <div className="flex-1 overflow-y-auto">
                            <FlashcardsPanel
                                noteId={Number(id)}
                                getNoteText={() => editor?.getText() || ''}
                            />
                        </div>
                    )}

                    {/* Placeholder for other sections */}
                    {activeSection !== 'Document' && activeSection !== 'Flashcards' && (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900/60">
                                <MdAutoAwesome className="h-8 w-8 text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-100">{activeSection}</h3>
                            <p className="text-[14px] text-zinc-500">Coming soon...</p>
                        </div>
                    )}
                </div>
            </div>

            <ThemeModal
                open={themeModalOpen}
                onClose={() => setThemeModalOpen(false)}
            />
        </>
    );
};

export default NotePage;
