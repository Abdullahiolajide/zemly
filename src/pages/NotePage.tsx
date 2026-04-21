import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { motion } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Markdown } from 'tiptap-markdown';
import 'prosemirror-view/style/prosemirror.css';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';

import { getNote, updateNote } from '../lib/notesService';
import type { Note } from '../types';
import FlashcardsPanel from '../components/FlashcardsPanel';
import QuizPanel from '../components/QuizPanel';
import ChatPanel from '../components/ChatPanel';
import PodcastPanel from '../components/PodcastPanel';
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
    { icon: PiExam,               label: 'Quiz',       slug: 'quiz' },
    { icon: TbCards,              label: 'Flashcards', slug: 'flashcards' },
    { icon: BsMic,                label: 'Podcast',    slug: 'podcast' },
    { icon: BsChatDots,           label: 'Chat Bot',   slug: 'chat' },
];

type SidebarSection = 'Document' | 'Chat Bot' | 'Podcast' | 'Flashcards' | 'Quiz';
const slugToSection: Record<string, SidebarSection> = {
    '': 'Document', chat: 'Chat Bot', podcast: 'Podcast', flashcards: 'Flashcards', quiz: 'Quiz',
};

/* ── Shared glass border ── */
const glassBorder = '1px solid var(--border-glass)';

let markdownRendererConfigured = false;
if (!markdownRendererConfigured) {
    marked.use(markedKatex({ throwOnError: false }));
    markdownRendererConfigured = true;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toEditorContent(content: Note['content']): Note['content'] {
    if (!content || typeof content !== 'string') return content;

    const trimmed = content.trim();
    if (!trimmed) return '';

    const hasHtmlTags = /<\s*[a-z][\s\S]*>/i.test(trimmed);
    if (hasHtmlTags) return content;

    const hasMarkdownSyntax = /(^\s{0,3}#{1,6}\s)|(^\s*[-*+]\s)|(^\s*\d+\.\s)|(\*\*[^*]+\*\*)|(```[\s\S]*```)|(\[[^\]]+\]\([^)]+\))|(\$\$[\s\S]*\$\$)|(\$[^$\n]+\$)/m.test(trimmed);

    if (hasMarkdownSyntax) {
        try {
            return marked.parse(content, { async: false });
        } catch {
            return `<p>${escapeHtml(content).replace(/\n/g, '<br/>')}</p>`;
        }
    }

    return `<p>${escapeHtml(content).replace(/\n/g, '<br/>')}</p>`;
}

function getYouTubeVideoId(url?: string | null): string | null {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');

        if (host === 'youtu.be') {
            const id = parsed.pathname.split('/').filter(Boolean)[0];
            return id || null;
        }

        if (host.endsWith('youtube.com')) {
            const watchId = parsed.searchParams.get('v');
            if (watchId) return watchId;

            const parts = parsed.pathname.split('/').filter(Boolean);
            const shortsIdx = parts.findIndex((part) => part === 'shorts');
            if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];

            const embedIdx = parts.findIndex((part) => part === 'embed');
            if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
        }
    } catch {
        return null;
    }

    return null;
}

function getNoteIdFromRoute(noteKey?: string, legacyId?: string): number | null {
    if (legacyId) {
        const parsedLegacy = Number(legacyId);
        return Number.isFinite(parsedLegacy) ? parsedLegacy : null;
    }

    if (!noteKey) return null;

    const parsedDirect = Number(noteKey);
    if (Number.isFinite(parsedDirect)) return parsedDirect;

    const match = noteKey.match(/-(\d+)$/);
    if (!match) return null;

    const parsedTail = Number(match[1]);
    return Number.isFinite(parsedTail) ? parsedTail : null;
}

const NotePage: React.FC = () => {
    const { noteKey, id: legacyId, userId: routeUserId, '*': wildcardSlug } = useParams<{ noteKey?: string; id?: string; userId?: string; '*': string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const noteId = getNoteIdFromRoute(noteKey, legacyId);

    const pathSlug = (wildcardSlug || '').replace(/^\/+/, '');
    const activeSection: SidebarSection = slugToSection[pathSlug] || 'Document';

    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [askAiText, setAskAiText] = useState<string | null>(null);
    const [chatPanelOpen, setChatPanelOpen] = useState(true);
    const [chatHasMessages, setChatHasMessages] = useState(false);
    const [documentViewerUrl, setDocumentViewerUrl] = useState('');
    const [documentViewerError, setDocumentViewerError] = useState<string | null>(null);
    const editorContentRef = useRef<HTMLDivElement>(null);
    const [, setEditorKey] = useState(0);
    const youtubeVideoId = note?.source_type === 'link' ? getYouTubeVideoId(note.source_url) : null;
    const noteKeyFromNote = note ? `${note.user_id}-${note.id}` : null;
    const noteBasePath = noteKeyFromNote
        ? `/notes/${noteKeyFromNote}`
        : noteKey
            ? `/notes/${noteKey}`
            : routeUserId && legacyId
                ? `/notes/${routeUserId}-${legacyId}`
                : noteId
                    ? `/notes/${noteId}`
                    : '/notes';

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Markdown,
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
            attributes: {
                class: `prose prose-zinc max-w-none focus:outline-none min-h-[60vh] px-0 py-4 ${
                    document.documentElement.classList.contains('dark') ? 'prose-invert' : ''
                }`,
            },
        },
        onUpdate: ({ editor: ed }) => { handleAutoSave(ed.getJSON() as Record<string, unknown>); },
        onTransaction: () => { setEditorKey((k) => k + 1); },
    });

    useEffect(() => {
        if (!noteId) return;
        const fetchNote = async () => {
            try {
                setLoading(true);
                const data = await getNote(noteId);
                setNote(data);
                if (data.content && editor) { editor.commands.setContent(toEditorContent(data.content)); }
            } catch (err) { console.error('Failed to load note:', err); }
            finally { setLoading(false); }
        };
        fetchNote();
    }, [noteId, editor]);

    useEffect(() => {
        let revokedUrl: string | null = null;
        let isCancelled = false;

        const loadDocumentForViewer = async () => {
            if (note?.source_type !== 'document') {
                setDocumentViewerUrl('');
                setDocumentViewerError(null);
                return;
            }

            if (!note?.source_url) {
                setDocumentViewerUrl('');
                setDocumentViewerError(null);
                return;
            }

            try {
                setDocumentViewerError(null);
                const res = await fetch(note.source_url);
                if (!res.ok) throw new Error(`Failed to fetch document (${res.status})`);

                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                revokedUrl = objectUrl;

                if (!isCancelled) {
                    setDocumentViewerUrl(objectUrl);
                }
            } catch {
                if (!isCancelled) {
                    // Fallback to direct URL if blob-based loading fails.
                    setDocumentViewerUrl(note.source_url);
                    setDocumentViewerError('Could not preload the document. Showing direct link mode.');
                }
            }
        };

        void loadDocumentForViewer();

        return () => {
            isCancelled = true;
            if (revokedUrl) URL.revokeObjectURL(revokedUrl);
        };
    }, [note?.source_url]);

    const handleAutoSave = useCallback(
        (() => {
            let timeout: ReturnType<typeof setTimeout>;
            return (content: Record<string, unknown>) => {
                clearTimeout(timeout);
                setSaveStatus('saving');
                timeout = setTimeout(async () => {
                    try {
                        if (!noteId) return;
                        await updateNote(noteId, { content });
                        setSaveStatus('saved');
                    } catch (err) { console.error('Auto-save failed:', err); setSaveStatus('error'); }
                }, 1200);
            };
        })(),
        [noteId],
    );

    const getStudyText = useCallback(() => {
        const editorText = editor?.getText() || '';
        const extractedText = note?.extracted_text || '';

        // Study generators should use stored extracted summary/context by default.
        // Fallback to editor text only when extracted text is missing.
        if (extractedText.trim()) return extractedText;
        return editorText;
    }, [editor, note?.extracted_text]);

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
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)';
    };
    const toolbarLeave = (e: React.MouseEvent, active: boolean) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = '';
    };

    /* ──────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-main)' }}>
                <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,200,150,0.2)', borderTopColor: '#00C896' }} />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-zinc-100" style={{ background: 'var(--bg-main)' }}>
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
            <div className="flex h-screen flex-col text-zinc-100 lg:flex-row" style={{ background: 'var(--bg-main)' }}>
                {/* Desktop backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* ─── SIDEBAR (desktop only) ─── */}
                <aside
                    className={`${sidebarOpen ? 'w-56 translate-x-0' : 'w-0 -translate-x-full'} fixed inset-y-0 left-0 z-50 hidden shrink-0 flex-col overflow-hidden transition-all duration-300 lg:flex lg:relative lg:z-auto ${!sidebarOpen ? 'lg:w-0' : ''}`}
                    style={{ borderRight: glassBorder, background: 'var(--bg-sidebar)', backdropFilter: 'blur(16px)' }}
                >
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: glassBorder }}>
                        <div
                            className="flex cursor-pointer items-center group"
                            onClick={() => navigate('/dashboard')}
                        >
                            <Logo className="h-8 transition-transform duration-200 group-hover:scale-[1.02]" />
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:text-zinc-300"
                            style={{ background: 'transparent' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
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
                                        onClick={() => navigate(`${noteBasePath}${link.slug ? `/${link.slug}` : ''}`)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150"
                                        style={{
                                            background: isActive ? 'rgba(0,200,150,0.1)' : 'transparent',
                                            color: isActive ? 'var(--brand-emerald)' : 'var(--text-sidebar)',
                                            border: isActive ? '1px solid rgba(0,200,150,0.18)' : '1px solid transparent',
                                        }}
                                        onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar-hover)'; } }}
                                        onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar)'; } }}
                                    >
                                        <link.icon className="h-[18px] w-[18px] shrink-0" />
                                        <span>{link.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Upgrade Button */}
                        <button className="btn-emerald mt-6 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold">
                            <MdAutoAwesome className="h-4 w-4" />
                            Upgrade to Premium
                        </button>
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="px-3 py-3" style={{ borderTop: glassBorder }}>
                        <button
                            onClick={() => setThemeModalOpen(true)}
                            className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-zinc-400 transition-colors"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar-hover)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar)'; }}
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
                                <p className="truncate text-[12px] font-semibold text-zinc-300">
                                    {user?.email || 'user@zemly.me'}
                                </p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* ─── MAIN CONTENT ─── */}
                <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3" style={{ borderBottom: glassBorder }}>
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                            {/* Sidebar toggle – desktop only */}
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className={`hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-100 ${sidebarOpen ? 'lg:hidden' : ''}`}
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                aria-label="Expand sidebar"
                            >
                                <HiOutlineChevronDoubleRight className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-100"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                aria-label="Back to dashboard"
                                title="Back to dashboard"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <h1
                                className="min-w-0 flex-1 truncate text-[14px] font-bold text-zinc-100 sm:text-base lg:max-w-md lg:flex-none lg:text-lg"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                            >
                                {note.title}
                            </h1>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                            <span className={`hidden text-xs font-medium sm:block ${saveStatus === 'saved' ? 'text-zinc-600' : saveStatus === 'saving' ? 'text-amber-400' : 'text-red-400'}`}>
                                {saveStatus === 'saved' ? '' : saveStatus === 'saving' ? 'Saving…' : 'Error saving'}
                            </span>
                            {[
                                { icon: LuClock4, title: 'Last edited', onClick: undefined },
                            ].map(({ icon: Icon, title, onClick }, i) => (
                                <button
                                    key={i} onClick={onClick} title={title}
                                    className="hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300 sm:flex"
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
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
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
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
                                onClick={() => setThemeModalOpen(true)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300 lg:hidden"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                title="Theme"
                            >
                                <RiMoonLine className="h-4 w-4" />
                            </button>
                            <button
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                <BsThreeDotsVertical className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* ─── MOBILE / TABLET HORIZONTAL TAB SCROLL BAR ─── */}
                    <div
                        className="note-tab-scroll flex shrink-0 items-center gap-1 overflow-x-auto px-3 py-2 lg:hidden"
                        style={{ borderBottom: glassBorder }}
                    >
                        {noteSidebarLinks.map((link) => {
                            const isActive = activeSection === link.label;
                            return (
                                <button
                                    key={link.label}
                                    onClick={() => navigate(`${noteBasePath}${link.slug ? `/${link.slug}` : ''}`)}
                                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150"
                                    style={{
                                        background: isActive ? 'rgba(0,200,150,0.1)' : 'transparent',
                                        color: isActive ? 'var(--brand-emerald)' : 'var(--text-sidebar)',
                                        border: isActive ? '1px solid rgba(0,200,150,0.18)' : '1px solid transparent',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <link.icon className="h-[14px] w-[14px] shrink-0" />
                                    <span>{link.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Document Section ── */}
                    {activeSection === 'Document' && (
                        <div className="relative flex flex-1 overflow-hidden">
                            {/* Editor Column */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 lg:px-16">
                                {youtubeVideoId && (
                                    <div className="mb-6 overflow-hidden rounded-xl" style={{ border: glassBorder, background: 'var(--bg-glass-hover)' }}>
                                        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: glassBorder }}>
                                            <span className="text-[12px] font-medium text-zinc-400">Video Source</span>
                                            {note.source_url && (
                                                <a
                                                    href={note.source_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[12px] font-medium transition-opacity hover:opacity-80"
                                                    style={{ color: '#00C896' }}
                                                >
                                                    Open on YouTube ↗
                                                </a>
                                            )}
                                        </div>
                                        <div className="aspect-video w-full">
                                            <iframe
                                                src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                                                title="YouTube video"
                                                className="h-full w-full border-0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                allowFullScreen
                                            />
                                        </div>
                                    </div>
                                )}

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
                                            style={{ border: glassBorder, background: 'var(--bg-glass-hover)', backdropFilter: 'blur(8px)' }}
                                        >
                                            {/* Font size */}
                                            <div className="mx-1 h-5 w-px" style={{ background: 'var(--border-glass)' }} />
                                            <button onClick={() => changeFontSize(-1)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-200" onMouseEnter={e => toolbarHover(e, false)} onMouseLeave={e => toolbarLeave(e, false)} title="Decrease font size">
                                                <FiMinus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="mx-1 min-w-[28px] text-center text-[13px] font-medium text-zinc-300">{currentFontSize}</span>
                                            <button onClick={() => changeFontSize(1)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-200" onMouseEnter={e => toolbarHover(e, false)} onMouseLeave={e => toolbarLeave(e, false)} title="Increase font size">
                                                <FiPlus className="h-3.5 w-3.5" />
                                            </button>
                                            <div className="mx-1 h-5 w-px" style={{ background: 'var(--border-glass)' }} />

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

                                            <div className="mx-1 h-5 w-px" style={{ background: 'var(--border-glass)' }} />

                                            {/* Image */}
                                            <button onClick={() => setImageModalOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200" onMouseEnter={e => toolbarHover(e, false)} onMouseLeave={e => toolbarLeave(e, false)} title="Insert image"><FiImage className="h-4 w-4" /></button>
                                            <TableGridPicker editor={editor} />

                                            <div className="mx-1 h-5 w-px" style={{ background: 'var(--border-glass)' }} />

                                            {/* Align */}
                                            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={toolbarBtn(editor.isActive({ textAlign: 'left' }))} style={editor.isActive({ textAlign: 'left' }) ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive({ textAlign: 'left' }))} onMouseLeave={e => toolbarLeave(e, editor.isActive({ textAlign: 'left' }))} title="Align left"><FiAlignLeft className="h-4 w-4" /></button>
                                            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={toolbarBtn(editor.isActive({ textAlign: 'center' }))} style={editor.isActive({ textAlign: 'center' }) ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive({ textAlign: 'center' }))} onMouseLeave={e => toolbarLeave(e, editor.isActive({ textAlign: 'center' }))} title="Align center"><FiAlignCenter className="h-4 w-4" /></button>
                                            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={toolbarBtn(editor.isActive({ textAlign: 'right' }))} style={editor.isActive({ textAlign: 'right' }) ? toolbarActive : {}} onMouseEnter={e => toolbarHover(e, editor.isActive({ textAlign: 'right' }))} onMouseLeave={e => toolbarLeave(e, editor.isActive({ textAlign: 'right' }))} title="Align right"><FiAlignRight className="h-4 w-4" /></button>

                                            <div className="mx-1 h-5 w-px" style={{ background: 'var(--border-glass)' }} />

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
                            <div
                                className={`chat-side-panel hidden shrink-0 overflow-hidden lg:flex lg:flex-col ${chatPanelOpen ? 'w-[340px] xl:w-[380px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                                style={{
                                    borderLeft: glassBorder,
                                    transition: 'width 280ms ease, opacity 220ms ease',
                                }}
                            >
                                <div className="flex h-full min-w-[380px] flex-col">
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
                                                onClick={() => navigate(`${noteBasePath}/quiz`)}
                                                className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
                                                style={{ border: glassBorder, background: 'var(--bg-glass-hover)' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,200,150,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.04)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
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
                                                onClick={() => navigate(`${noteBasePath}/flashcards`)}
                                                className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
                                                style={{ border: glassBorder, background: 'var(--bg-glass-hover)' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,200,150,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.04)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
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
                                            persistenceKey={noteId ? `chat-state-${noteId}` : undefined}
                                        />
                                    </div>
                                </div>
                            </div>

                            {!chatPanelOpen && (
                                <button
                                    onClick={() => setChatPanelOpen(true)}
                                    className="absolute right-0 top-1/2 z-30 hidden h-12 w-28 -translate-y-1/2 items-center justify-center gap-2 rounded-l-full rounded-r-none text-[12px] font-semibold text-zinc-200 transition-colors lg:flex"
                                    style={{
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid var(--border-glass)',
                                        borderRight: 'none',
                                    }}
                                    onMouseEnter={e => {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = 'rgba(255,255,255,0.1)';
                                    }}
                                    onMouseLeave={e => {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = 'rgba(255,255,255,0.06)';
                                    }}
                                    title="Open AI Chat"
                                    aria-label="Open AI Chat"
                                >
                                    <BsChatDots className="h-3.5 w-3.5" />
                                    <span>AI Chat</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Chat Bot Section ── */}
                    {activeSection === 'Chat Bot' && (
                        note?.source_type === 'document' && note.source_url ? (
                            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
                                {/* PDF Viewer – hidden on mobile, shown on lg+ */}
                                <div className="hidden flex-1 flex-col overflow-hidden lg:flex" style={{ borderRight: glassBorder }}>
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
                                    <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-main)' }}>
                                        <iframe src={documentViewerUrl || note.source_url} title="Document viewer" className="h-full w-full border-0" />
                                    </div>
                                    {documentViewerError && (
                                        <div className="px-4 py-2 text-[11px] text-zinc-500" style={{ borderTop: glassBorder }}>
                                            {documentViewerError}
                                        </div>
                                    )}
                                </div>
                                {/* Chat panel */}
                                <div className="flex flex-1 flex-col lg:w-[380px] lg:flex-none lg:shrink-0">
                                    <div
                                        className="flex items-center justify-between px-4 py-3"
                                        style={{ borderBottom: glassBorder, background: 'rgba(255,255,255,0.02)' }}
                                    >
                                        <span className="text-[13px] font-semibold text-zinc-200" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Zemly AI</span>
                                        <span
                                            className="rounded-full px-2.5 py-1 text-[10px] font-medium text-zinc-400"
                                            style={{ border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.03)' }}
                                        >
                                            Note-grounded
                                        </span>
                                    </div>
                                    <div className="flex min-h-0 flex-1 flex-col">
                                        <ChatPanel
                                            getNoteText={() => note.extracted_text || ''}
                                            highlightedText={askAiText}
                                            onClearHighlight={() => setAskAiText(null)}
                                            persistenceKey={noteId ? `chat-state-${noteId}` : undefined}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden">
                                <ChatPanel
                                    getNoteText={() => editor?.getText() || ''}
                                    highlightedText={askAiText}
                                    onClearHighlight={() => setAskAiText(null)}
                                    persistenceKey={noteId ? `chat-state-${noteId}` : undefined}
                                />
                            </div>
                        )
                    )}

                    {/* ── Flashcards Section ── */}
                    {noteId && (
                        <motion.div
                            className="flex-1 overflow-y-auto"
                            style={{ display: activeSection === 'Flashcards' ? 'flex' : 'none', flexDirection: 'column' }}
                            initial={activeSection === 'Flashcards' ? { opacity: 0 } : false}
                            animate={activeSection === 'Flashcards' ? { opacity: 1 } : { opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                        >
                            <FlashcardsPanel
                                noteId={noteId}
                                getNoteText={getStudyText}
                            />
                        </motion.div>
                    )}

                    {/* ── Quiz Section ── */}
                    {noteId && (
                        <motion.div
                            className="flex-1 overflow-y-auto"
                            style={{ display: activeSection === 'Quiz' ? 'flex' : 'none', flexDirection: 'column' }}
                            initial={activeSection === 'Quiz' ? { opacity: 0, x: 40 } : false}
                            animate={activeSection === 'Quiz' ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                        >
                            <QuizPanel
                                noteId={noteId}
                                getNoteText={getStudyText}
                            />
                        </motion.div>
                    )}

                    {/* ── Podcast Section ── */}
                    {noteId && (
                        <div
                            className="flex-1 overflow-hidden flex flex-col"
                            style={{ display: activeSection === 'Podcast' ? 'flex' : 'none' }}
                        >
                            {/* Top section - slides down */}
                            <motion.div
                                className="h-full w-full flex flex-col"
                                initial={activeSection === 'Podcast' ? { opacity: 0, y: -40 } : false}
                                animate={activeSection === 'Podcast' ? { opacity: 1, y: 0 } : { opacity: 0, y: -40 }}
                                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
                            >
                                <PodcastPanel
                                    noteId={noteId}
                                    noteTitle={note.title}
                                    getNoteText={getStudyText}
                                />
                            </motion.div>
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
