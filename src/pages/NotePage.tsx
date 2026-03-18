import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import 'prosemirror-view/style/prosemirror.css';
import html2pdf from 'html2pdf.js';

import { getNote, updateNote } from '../lib/notesService';
import type { Note } from '../types';
import FlashcardsPanel from '../components/FlashcardsPanel';
import QuizPanel from '../components/QuizPanel';
import ChatPanel from '../components/ChatPanel';
import ImageUploadModal from '../components/ImageUploadModal';
import BubbleToolbar from '../components/BubbleToolbar';
import ImageToolbar from '../components/ImageToolbar';
import TableGridPicker from '../components/TableGridPicker';
import TableToolbar from '../components/TableToolbar';

import { MdAutoAwesome } from 'react-icons/md';
import { IoDocumentTextOutline } from 'react-icons/io5';
import { BsChatDots, BsMic, BsThreeDotsVertical } from 'react-icons/bs';
import { FiArrowRight } from 'react-icons/fi';
import { TbCards } from 'react-icons/tb';
import { PiExam, PiHighlighter } from 'react-icons/pi';
import { RiMoonLine } from 'react-icons/ri';
import { HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight } from 'react-icons/hi';
import { useAuthStore } from '../store/useAuthStore';
import { LuClock4 } from 'react-icons/lu';
import {
    FiBold, FiItalic, FiUnderline as FiUnderlineIcon, FiImage,
    FiAlignLeft, FiAlignCenter, FiAlignRight,
    FiList, FiMinus, FiPlus, FiDownload,
} from 'react-icons/fi';
import { RxStrikethrough } from 'react-icons/rx';
import { AiOutlineOrderedList } from 'react-icons/ai';
import ThemeModal from '../components/ThemeModal';

/* ── Note-page sidebar nav items ── */
const noteSidebarLinks = [
    { icon: IoDocumentTextOutline, label: 'Document', slug: '' },
    { icon: BsChatDots,           label: 'Chat Bot',   slug: 'chat' },
    { icon: BsMic,                label: 'Podcast',    slug: 'podcast' },
    { icon: TbCards,              label: 'Flashcards', slug: 'flashcards' },
    { icon: PiExam,               label: 'Quiz',       slug: 'quiz' },
];

type SidebarSection = 'Document' | 'Chat Bot' | 'Podcast' | 'Flashcards' | 'Quiz';
const slugToSection: Record<string, SidebarSection> = {
    '': 'Document', chat: 'Chat Bot', podcast: 'Podcast', flashcards: 'Flashcards', quiz: 'Quiz',
};

/* ── Shared glass border ── */
const glassBorder = '1px solid rgba(255,255,255,0.06)';
const glassBorderHover = '1px solid rgba(255,255,255,0.12)';

const NotePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();

    const pathSlug = location.pathname.split(`/notes/${id}/`)[1] || '';
    const activeSection: SidebarSection = slugToSection[pathSlug] || 'Document';

    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [askAiText, setAskAiText] = useState<string | null>(null);
    const [chatPanelOpen, setChatPanelOpen] = useState(true);
    const [chatHasMessages, setChatHasMessages] = useState(false);
    const editorContentRef = useRef<HTMLDivElement>(null);
    const [, setEditorKey] = useState(0);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Placeholder.configure({ placeholder: 'Start writing your note…' }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Underline,
            Highlight.configure({ multicolor: true }),
            Image.extend({
                addAttributes() {
                    return {
                        ...this.parent?.(),
                        width: {
                            default: '100%',
                            renderHTML: (attributes) => ({ style: `width: ${attributes.width}; max-width: 100%;` }),
                            parseHTML: (element) => element.style.width || '100%',
                        },
                    };
                },
            }),
            Table.configure({ resizable: true }),
            TableRow, TableCell, TableHeader,
            TextStyleKit.configure({ fontFamily: false, backgroundColor: false, color: false, lineHeight: false }),
        ],
        editorProps: {
            attributes: { class: 'prose prose-invert prose-zinc max-w-none focus:outline-none min-h-[60vh] px-0 py-4' },
        },
        onUpdate: ({ editor: ed }) => { handleAutoSave(ed.getJSON() as Record<string, unknown>); },
        onTransaction: () => { setEditorKey((k) => k + 1); },
    });

    useEffect(() => {
        if (!id) return;
        const fetchNote = async () => {
            try {
                setLoading(true);
                const data = await getNote(Number(id));
                setNote(data);
                if (data.content && editor) { editor.commands.setContent(data.content); }
            } catch (err) { console.error('Failed to load note:', err); }
            finally { setLoading(false); }
        };
        fetchNote();
    }, [id, editor]);

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
                    } catch (err) { console.error('Auto-save failed:', err); setSaveStatus('error'); }
                }, 1200);
            };
        })(),
        [id],
    );

    const handleExportPdf = useCallback(async () => {
        const el = editorContentRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
        if (!el || !note) return;
        setExporting(true);
        try {
            await html2pdf().set({
                margin: [12, 12, 12, 12],
                filename: `${note.title || 'Untitled'}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            }).from(el).save();
        } catch (err) { console.error('PDF export failed:', err); }
        finally { setExporting(false); }
    }, [note]);

    /* ── Toolbar icon button active/inactive helper (inline) ── */
    const toolbarBtn = (active: boolean) =>
        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors ' +
        (active ? '' : 'text-zinc-400 hover:text-zinc-200');
    const toolbarActive: React.CSSProperties = { background: 'rgba(0,200,150,0.12)', color: '#00C896' };
    const toolbarHighlight: React.CSSProperties = { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
    const toolbarHover = (e: React.MouseEvent, active: boolean) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
    };
    const toolbarLeave = (e: React.MouseEvent, active: boolean) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = '';
    };

    /* ──────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ background: '#0D0F12' }}>
                <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,200,150,0.2)', borderTopColor: '#00C896' }} />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-zinc-100" style={{ background: '#0D0F12' }}>
                <p className="text-lg font-semibold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Note not found</p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-emerald rounded-lg px-4 py-2 text-sm font-medium"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="flex h-screen text-zinc-100" style={{ background: '#0D0F12' }}>
                {/* Mobile backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* ─── SIDEBAR ─── */}
                <aside
                    className={`${sidebarOpen ? 'w-56 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'} fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col overflow-hidden transition-all duration-300 md:relative md:z-auto ${!sidebarOpen ? 'md:w-0' : ''}`}
                    style={{ borderRight: glassBorder, background: 'rgba(255,255,255,0.018)', backdropFilter: 'blur(16px)' }}
                >
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: glassBorder }}>
                        <div
                            className="flex cursor-pointer items-center gap-2.5"
                            onClick={() => navigate('/dashboard')}
                        >
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                style={{ background: 'linear-gradient(135deg, #00C896, #00A87A)', boxShadow: '0 4px 12px rgba(0,200,150,0.25)' }}
                            >
                                <MdAutoAwesome className="h-4 w-4 text-white" />
                            </div>
                            <span
                                className="text-base font-bold tracking-tight text-zinc-100"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                            >
                                Zemly
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:text-zinc-300"
                            style={{ background: 'transparent' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            aria-label="Collapse sidebar"
                        >
                            <HiOutlineChevronDoubleLeft className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Nav Links */}
                    <nav className="flex-1 px-3 pt-3">
                        <div className="flex flex-col gap-0.5">
                            {noteSidebarLinks.map((link) => {
                                const isActive = activeSection === link.label;
                                return (
                                    <button
                                        key={link.label}
                                        onClick={() => navigate(`/notes/${id}${link.slug ? `/${link.slug}` : ''}`)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-150"
                                        style={{
                                            background: isActive ? 'rgba(0,200,150,0.1)' : 'transparent',
                                            color: isActive ? '#00C896' : '#a1a1aa',
                                            border: isActive ? '1px solid rgba(0,200,150,0.18)' : '1px solid transparent',
                                        }}
                                        onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7'; } }}
                                        onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; } }}
                                    >
                                        <link.icon className="h-[18px] w-[18px] shrink-0" />
                                        <span>{link.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Upgrade Button */}
                        <button className="btn-emerald mt-6 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-semibold">
                            <MdAutoAwesome className="h-4 w-4" />
                            Upgrade to Premium
                        </button>
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="px-3 py-3" style={{ borderTop: glassBorder }}>
                        <button
                            onClick={() => setThemeModalOpen(true)}
                            className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#e4e4e7'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; }}
                        >
                            <RiMoonLine className="h-[18px] w-[18px]" />
                            <span>Theme</span>
                        </button>

                        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                            <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #00C896, #00A87A)' }}
                            >
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
                    {/* Top Bar */}
                    <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: glassBorder }}>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-100 ${sidebarOpen ? 'md:hidden' : ''}`}
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                aria-label="Expand sidebar"
                            >
                                <HiOutlineChevronDoubleRight className="h-4 w-4" />
                            </button>
                            <h1
                                className="max-w-md truncate text-base font-semibold text-zinc-100"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                            >
                                {note.title}
                            </h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${saveStatus === 'saved' ? 'text-zinc-600' : saveStatus === 'saving' ? 'text-amber-400' : 'text-red-400'}`}>
                                {saveStatus === 'saved' ? '' : saveStatus === 'saving' ? 'Saving…' : 'Error saving'}
                            </span>
                            {[
                                { icon: LuClock4, title: 'Last edited', onClick: undefined },
                            ].map(({ icon: Icon, title, onClick }, i) => (
                                <button
                                    key={i} onClick={onClick} title={title}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            ))}
                            <button
                                onClick={handleExportPdf}
                                disabled={exporting}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                title="Export as PDF"
                            >
                                {exporting ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
                                ) : (
                                    <FiDownload className="h-4 w-4" />
                                )}
                            </button>
                            <button
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                <BsThreeDotsVertical className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* ── Document Section ── */}
                    {activeSection === 'Document' && (
                        <div className="flex flex-1 overflow-hidden">
                            {/* Editor Column */}
                            <div className="flex-1 overflow-y-auto px-8 py-6 lg:px-16">
                                {/* Toolbar */}
                                {editor && (() => {
                                    const rawFontSize = editor.getAttributes('textStyle')?.fontSize as string | undefined;
                                    const currentFontSize = rawFontSize ? parseInt(rawFontSize, 10) : 16;
                                    const changeFontSize = (delta: number) => {
                                        const next = Math.max(10, Math.min(72, currentFontSize + delta));
                                        editor.chain().focus().setFontSize(`${next}px`).run();
                                    };
                                    return (
                                        <div
                                            className="mb-6 flex flex-wrap items-center gap-1 rounded-xl px-3 py-2"
                                            style={{ border: glassBorder, background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(8px)' }}
                                        >
                                            {/* Font size */}
                                            <div className="mx-1 h-5 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                                            <button onClick={() => changeFontSize(-1)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-200" onMouseEnter={e => toolbarHover(e, false)} onMouseLeave={e => toolbarLeave(e, false)} title="Decrease font size">
                                                <FiMinus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="mx-1 min-w-[28px] text-center text-[13px] font-medium text-zinc-300">{currentFontSize}</span>
                                            <button onClick={() => changeFontSize(1)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-200" onMouseEnter={e => toolbarHover(e, false)} onMouseLeave={e => toolbarLeave(e, false)} title="Increase font size">
                                                <FiPlus className="h-3.5 w-3.5" />
                                            </button>
                                            <div className="mx-1 h-5 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                                            {/* Bold */}
                                            <button onClick={() => editor.chain().focus().toggleBold().run()} className={toolbarBtn(editor.isActive('bold'))} style={editor.isActive('bold') ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive('bold'))} onMouseLeave={e => toolbarLeave(e, editor.isActive('bold'))} title="Bold"><FiBold className="h-4 w-4" /></button>
                                            {/* Italic */}
                                            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={toolbarBtn(editor.isActive('italic'))} style={editor.isActive('italic') ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive('italic'))} onMouseLeave={e => toolbarLeave(e, editor.isActive('italic'))} title="Italic"><FiItalic className="h-4 w-4" /></button>
                                            {/* Underline */}
                                            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={toolbarBtn(editor.isActive('underline'))} style={editor.isActive('underline') ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive('underline'))} onMouseLeave={e => toolbarLeave(e, editor.isActive('underline'))} title="Underline"><FiUnderlineIcon className="h-4 w-4" /></button>
                                            {/* Strike */}
                                            <button onClick={() => editor.chain().focus().toggleStrike().run()} className={toolbarBtn(editor.isActive('strike'))} style={editor.isActive('strike') ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive('strike'))} onMouseLeave={e => toolbarLeave(e, editor.isActive('strike'))} title="Strikethrough"><RxStrikethrough className="h-4 w-4" /></button>
                                            {/* Highlight */}
                                            <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={toolbarBtn(editor.isActive('highlight'))} style={editor.isActive('highlight') ? toolbarHighlight : {}} onMouseEnter={e => toolbarHover(e, editor.isActive('highlight'))} onMouseLeave={e => toolbarLeave(e, editor.isActive('highlight'))} title="Highlight"><PiHighlighter className="h-4 w-4" /></button>

                                            <div className="mx-1 h-5 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                                            {/* Image */}
                                            <button onClick={() => setImageModalOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200" onMouseEnter={e => toolbarHover(e, false)} onMouseLeave={e => toolbarLeave(e, false)} title="Insert image"><FiImage className="h-4 w-4" /></button>
                                            <TableGridPicker editor={editor} />

                                            <div className="mx-1 h-5 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                                            {/* Align */}
                                            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={toolbarBtn(editor.isActive({ textAlign: 'left' }))} style={editor.isActive({ textAlign: 'left' }) ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive({ textAlign: 'left' }))} onMouseLeave={e => toolbarLeave(e, editor.isActive({ textAlign: 'left' }))} title="Align left"><FiAlignLeft className="h-4 w-4" /></button>
                                            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={toolbarBtn(editor.isActive({ textAlign: 'center' }))} style={editor.isActive({ textAlign: 'center' }) ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive({ textAlign: 'center' }))} onMouseLeave={e => toolbarLeave(e, editor.isActive({ textAlign: 'center' }))} title="Align center"><FiAlignCenter className="h-4 w-4" /></button>
                                            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={toolbarBtn(editor.isActive({ textAlign: 'right' }))} style={editor.isActive({ textAlign: 'right' }) ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive({ textAlign: 'right' }))} onMouseLeave={e => toolbarLeave(e, editor.isActive({ textAlign: 'right' }))} title="Align right"><FiAlignRight className="h-4 w-4" /></button>

                                            <div className="mx-1 h-5 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                                            {/* Lists */}
                                            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={toolbarBtn(editor.isActive('bulletList'))} style={editor.isActive('bulletList') ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive('bulletList'))} onMouseLeave={e => toolbarLeave(e, editor.isActive('bulletList'))} title="Bullet list"><FiList className="h-4 w-4" /></button>
                                            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toolbarBtn(editor.isActive('orderedList'))} style={editor.isActive('orderedList') ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive('orderedList'))} onMouseLeave={e => toolbarLeave(e, editor.isActive('orderedList'))} title="Ordered list"><AiOutlineOrderedList className="h-4 w-4" /></button>
                                        </div>
                                    );
                                })()}

                                {/* Editor Content */}
                                <div ref={editorContentRef}>
                                    <EditorContent editor={editor} />
                                </div>
                                {editor && <BubbleToolbar editor={editor} onAskAI={(text) => { setAskAiText(text); setChatPanelOpen(true); }} />}
                                {editor && <ImageToolbar editor={editor} />}
                                {editor && <TableToolbar editor={editor} />}
                            </div>

                            {/* ── Right Side Panel (AI Chat) ── */}
                            {chatPanelOpen ? (
                                <div className="chat-side-panel hidden w-[380px] shrink-0 md:flex md:flex-col" style={{ borderLeft: glassBorder }}>
                                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: glassBorder }}>
                                        <span className="text-[13px] font-semibold text-zinc-300" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Zemly AI</span>
                                        <button
                                            onClick={() => setChatPanelOpen(false)}
                                            className="flex items-center gap-1 text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                                        >
                                            Hide <FiArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>

                                    {/* Quick-link cards */}
                                    {!chatHasMessages && (
                                        <div className="grid grid-cols-2 gap-2.5 px-4 py-3">
                                            <button
                                                onClick={() => navigate(`/notes/${id}/quiz`)}
                                                className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
                                                style={{ border: glassBorder, background: 'rgba(255,255,255,0.025)' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,200,150,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.04)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                                            >
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.12)' }}>
                                                    <PiExam className="h-4 w-4 text-amber-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[12px] font-semibold text-zinc-200">Quizzes</p>
                                                    <p className="text-[10px] text-zinc-600">Test your knowledge</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => navigate(`/notes/${id}/flashcards`)}
                                                className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
                                                style={{ border: glassBorder, background: 'rgba(255,255,255,0.025)' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,200,150,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.04)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                                            >
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(0,200,150,0.08)' }}>
                                                    <TbCards className="h-4 w-4" style={{ color: '#00C896' }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[12px] font-semibold text-zinc-200">Flashcards</p>
                                                    <p className="text-[10px] text-zinc-600">Active recall</p>
                                                </div>
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex min-h-0 flex-1 flex-col">
                                        <ChatPanel
                                            getNoteText={() => editor?.getText() || ''}
                                            highlightedText={askAiText}
                                            onClearHighlight={() => setAskAiText(null)}
                                            onHasMessages={setChatHasMessages}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="hidden shrink-0 md:flex md:flex-col md:items-center md:py-4" style={{ borderLeft: glassBorder }}>
                                    <button
                                        onClick={() => setChatPanelOpen(true)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                                        style={{ background: 'transparent' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        title="Open AI panel"
                                    >
                                        <MdAutoAwesome className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Chat Bot Section ── */}
                    {activeSection === 'Chat Bot' && (
                        note?.source_type === 'document' && note.source_url ? (
                            <div className="flex flex-1 overflow-hidden">
                                {/* PDF Viewer */}
                                <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: glassBorder }}>
                                    <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: glassBorder }}>
                                        <span className="text-[12px] font-medium text-zinc-500">Original Document</span>
                                        {note.file_name && <span className="text-[12px] text-zinc-600">— {note.file_name}</span>}
                                        <a
                                            href={note.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-auto text-[12px] font-medium transition-colors hover:opacity-80"
                                            style={{ color: '#00C896' }}
                                        >
                                            Open in new tab ↗
                                        </a>
                                    </div>
                                    <div className="flex-1 overflow-hidden" style={{ background: '#0D0F12' }}>
                                        <iframe src={note.source_url} title="Document viewer" className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin" />
                                    </div>
                                </div>
                                {/* Chat panel */}
                                <div className="flex w-[380px] shrink-0 flex-col">
                                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: glassBorder }}>
                                        <span className="text-[13px] font-semibold text-zinc-300" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Zemly AI</span>
                                        <span className="text-[11px] text-zinc-600">Based on your document</span>
                                    </div>
                                    <div className="flex min-h-0 flex-1 flex-col">
                                        <ChatPanel getNoteText={() => note.extracted_text || ''} highlightedText={askAiText} onClearHighlight={() => setAskAiText(null)} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden">
                                <ChatPanel getNoteText={() => editor?.getText() || ''} highlightedText={askAiText} onClearHighlight={() => setAskAiText(null)} />
                            </div>
                        )
                    )}

                    {/* ── Flashcards Section ── */}
                    {activeSection === 'Flashcards' && id && (
                        <div className="flex-1 overflow-y-auto">
                            <FlashcardsPanel
                                noteId={Number(id)}
                                getNoteText={() => note?.source_type === 'document' && note.extracted_text ? note.extracted_text : editor?.getText() || ''}
                            />
                        </div>
                    )}

                    {/* ── Quiz Section ── */}
                    {activeSection === 'Quiz' && id && (
                        <div className="flex-1 overflow-y-auto">
                            <QuizPanel
                                noteId={Number(id)}
                                getNoteText={() => note?.source_type === 'document' && note.extracted_text ? note.extracted_text : editor?.getText() || ''}
                            />
                        </div>
                    )}

                    {/* ── Placeholder (Podcast etc.) ── */}
                    {activeSection !== 'Document' && activeSection !== 'Flashcards' && activeSection !== 'Quiz' && activeSection !== 'Chat Bot' && (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4">
                            <div
                                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                                style={{ background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.15)' }}
                            >
                                <MdAutoAwesome className="h-8 w-8" style={{ color: '#00C896' }} />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{activeSection}</h3>
                            <p className="text-[14px] text-zinc-500">Coming soon...</p>
                        </div>
                    )}
                </div>
            </div>

            <ThemeModal open={themeModalOpen} onClose={() => setThemeModalOpen(false)} />
            <ImageUploadModal
                open={imageModalOpen}
                onClose={() => setImageModalOpen(false)}
                onImageInserted={(url) => { if (editor) editor.chain().focus().setImage({ src: url }).run(); setImageModalOpen(false); }}
                userId={user?.id || ''}
            />
        </>
    );
};

export default NotePage;
