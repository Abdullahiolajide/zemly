import { useState, useEffect, useCallback } from 'react';
import {
    BlankDocumentModal,
    AudioModal,
    DocumentUploadModal,
    WebsiteLinkModal,
} from '../components/CreateNoteModals';
import { IoSearch, IoDocumentTextOutline, IoMicOutline, IoLinkOutline } from 'react-icons/io5';
import { BsThreeDotsVertical, BsChevronRight, BsFolder2 } from 'react-icons/bs';
import { MdLogout, MdAutoAwesome, MdUploadFile } from 'react-icons/md';
import { BiHome, BiBookBookmark } from 'react-icons/bi';
import { IoSettingsOutline } from 'react-icons/io5';
import { HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight } from 'react-icons/hi';
import { RiMoonLine } from 'react-icons/ri';
import { FiTrash2 } from 'react-icons/fi';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { createNote, createDocumentNote, getUserNotes, deleteNote } from '../lib/notesService';
import type { Note } from '../types';
import ThemeModal from '../components/ThemeModal';

/* ── Sidebar nav items ── */
const navLinks = [
    { icon: BiHome, label: 'Dashboard', active: true },
    { icon: BiBookBookmark, label: 'Study Guides', active: false },
    { icon: IoSettingsOutline, label: 'Settings', active: false },
];

/* ── Quick-action cards ── */
const quickActions = [
    {
        icon: IoDocumentTextOutline,
        color: 'from-indigo-500 to-purple-600',
        bgTint: 'bg-indigo-500/10',
        title: 'Blank document',
        subtitle: 'Start from scratch',
    },
    {
        icon: IoMicOutline,
        color: 'from-amber-500 to-orange-500',
        bgTint: 'bg-amber-500/10',
        title: 'Record or upload audio',
        subtitle: 'Upload an audio file',
    },
    {
        icon: MdUploadFile,
        color: 'from-rose-500 to-pink-500',
        bgTint: 'bg-rose-500/10',
        title: 'Document upload',
        subtitle: 'Any PDF, DOC, PPT, etc',
    },
    {
        icon: IoLinkOutline,
        color: 'from-red-500 to-rose-500',
        bgTint: 'bg-red-500/10',
        title: 'Website link',
        subtitle: 'YouTube or website link',
    },
];

/* ── Helper: relative time ── */
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
}

/* ── Helper: get note type icon and label ── */
function getNoteTypeInfo(sourceType?: string): { icon: React.ComponentType<{ className?: string }>, label: string } {
    switch (sourceType) {
        case 'document':
            return { icon: MdUploadFile, label: 'Document' };
        case 'audio':
            return { icon: IoMicOutline, label: 'Audio' };
        case 'link':
            return { icon: IoLinkOutline, label: 'Link' };
        case 'blank':
            return { icon: IoDocumentTextOutline, label: 'Document' };
        default:
            return { icon: IoDocumentTextOutline, label: 'Document' };
    }
}

type ModalType = 'blank' | 'audio' | 'document' | 'website' | null;

const modalKeyMap: Record<string, ModalType> = {
    'Blank document': 'blank',
    'Record or upload audio': 'audio',
    'Document upload': 'document',
    'Website link': 'website',
};

const DashboardPage: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
    const [openModal, setOpenModal] = useState<ModalType>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    /* ── Fetch user notes ── */
    const fetchNotes = useCallback(async () => {
        try {
            setNotesLoading(true);
            const data = await getUserNotes();
            setNotes(data);
        } catch (err) {
            console.error('Failed to fetch notes:', err);
        } finally {
            setNotesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    /* ── Close menu on click outside ── */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[aria-label="Note options"]') && !target.closest('.relative')) {
                setMenuOpenId(null);
            }
        };
        if (menuOpenId !== null) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [menuOpenId]);

    /* ── Create blank note → navigate ── */
    const handleCreateBlankNote = async (title: string) => {
        try {
            const note = await createNote(title);
            navigate(`/notes/${note.id}`);
        } catch (err) {
            console.error('Failed to create note:', err);
        }
    };

    /* ── Create document note → navigate ── */
    const handleCreateDocumentNote = async (result: {
        file: File;
        title: string;
        noteContent: string;
        extractedText: string;
        publicUrl: string;
    }) => {
        try {
            // Convert AI plain-text notes into TipTap JSON nodes
            const lines = result.noteContent.split('\n');
            const nodes: Record<string, unknown>[] = [];

            for (const raw of lines) {
                const line = raw.trim();
                if (!line) continue;

                // ALL CAPS headings ending with colon, e.g. "INTRODUCTION:" or "KEY TAKEAWAYS:"
                const isHeading =
                    /^[A-Z][A-Z\s\d\-/()]{2,}:?$/.test(line) ||
                    line.startsWith('===') ||
                    line.startsWith('---') ||
                    line.startsWith('# ') ||
                    line.startsWith('## ');

                // Bullet points
                const isBullet = line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ');

                if (isHeading) {
                    const text = line.replace(/^[#=\-]+\s*/, '').replace(/:$/, '').trim();
                    if (text) {
                        nodes.push({
                            type: 'heading',
                            attrs: { level: 2 },
                            content: [{ type: 'text', text }],
                        });
                    }
                } else if (isBullet) {
                    const text = line.replace(/^[-•*]\s+/, '');
                    nodes.push({
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text }],
                                    },
                                ],
                            },
                        ],
                    });
                } else {
                    nodes.push({
                        type: 'paragraph',
                        content: [{ type: 'text', text: line }],
                    });
                }
            }

            const content = {
                type: 'doc',
                content: nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [{ type: 'text', text: result.noteContent }] }],
            };

            const note = await createDocumentNote(
                result.title,
                result.publicUrl,
                result.extractedText,
                result.file.name,
                content,
            );
            navigate(`/notes/${note.id}`);
        } catch (err) {
            console.error('Failed to create document note:', err);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleDeleteNote = async (noteId: number) => {
        try {
            await deleteNote(noteId);
            setNotes((prev) => prev.filter((n) => n.id !== noteId));
            setDeleteConfirmId(null);
            setMenuOpenId(null);
        } catch (err) {
            console.error('Failed to delete note:', err);
        }
    };

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-100">
            {/* ─── MOBILE BACKDROP ─── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ─── SIDEBAR ─── */}
            <aside
                className={`${
                    sidebarOpen ? 'w-60 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'
                } fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col overflow-hidden border-r border-zinc-800/50 bg-zinc-900/60 transition-all duration-300 md:relative md:z-auto ${!sidebarOpen ? 'md:w-0' : ''}`}
            >
                {/* Sidebar Header */}
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-2.5">
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
                        {navLinks.map((link) => (
                            <button
                                key={link.label}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 ${link.active
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
                        <button
                            onClick={handleLogout}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-zinc-800/70 hover:text-red-400"
                            aria-label="Log out"
                        >
                            <MdLogout className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ─── MAIN CONTENT ─── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
                {/* Main scrollable area */}
                <div className="mx-auto w-full max-w-7xl px-8 py-8 lg:px-12">
                    {/* Top row: Collapse toggle (when sidebar hidden) + Title + Search */}
                    <div className="mb-8 flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 ${sidebarOpen ? 'md:hidden' : ''}`}
                                aria-label="Expand sidebar"
                            >
                                <HiOutlineChevronDoubleRight className="h-4 w-4" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                                    Dashboard
                                </h1>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Create new notes
                                </p>
                            </div>
                        </div>

                        {/* Search */}
                        <button className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-400">
                            <IoSearch className="h-4 w-4" />
                            <span>Search</span>
                            <kbd className="ml-3 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                ⌘K
                            </kbd>
                        </button>
                    </div>

                    {/* ── Quick Action Cards ── */}
                    <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {quickActions.map((action) => (
                            <button
                                key={action.title}
                                onClick={() => setOpenModal(modalKeyMap[action.title] ?? null)}
                                className="group flex items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-4 text-left transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/70"
                            >
                                {/* Icon */}
                                <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${action.color}`}
                                >
                                    <action.icon className="h-5 w-5 text-white" />
                                </div>

                                {/* Text */}
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold text-zinc-200">
                                        {action.title}
                                    </p>
                                    <p className="mt-0.5 text-[12px] text-zinc-500">
                                        {action.subtitle}
                                    </p>
                                </div>

                                {/* Arrow */}
                                <BsChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                            </button>
                        ))}
                    </div>

                    {/* ── Tabs + New Folder ── */}
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-1">
                            <button
                                className="rounded-md px-4 py-1.5 text-[13px] font-medium bg-zinc-800 text-zinc-100 shadow-sm"
                            >
                                My Notes
                            </button>
                        </div>

                        <button className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-2 text-[13px] font-medium text-zinc-300 transition-colors duration-150 hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-100">
                            <BsFolder2 className="h-4 w-4" />
                            New Folder
                        </button>
                    </div>

                    {/* ── Notes List ── */}
                    <div>
                        {/* Section Header */}
                        <p className="mb-3 text-[12px] font-medium text-indigo-400">
                            {notes.length > 0 ? 'Your Notes' : 'Earlier'}
                        </p>

                        {/* Notes */}
                        {notesLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                            </div>
                        ) : notes.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                {notes.map((note) => {
                                    const { icon: TypeIcon, label: typeLabel } = getNoteTypeInfo(note.source_type);
                                    const lastUpdated = note.updated_at || note.created_at;
                                    return (
                                        <div key={note.id}>
                                            <div
                                                onClick={() => navigate(`/notes/${note.id}`)}
                                                className="group flex cursor-pointer items-center gap-4 rounded-xl px-4 py-3.5 transition-colors duration-150 hover:bg-zinc-900/60"
                                            >
                                                {/* Folder Icon */}
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                                    <BsFolder2 className="h-5 w-5 text-amber-500" />
                                                </div>

                                                {/* Note Info */}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-zinc-200">
                                                        {note.title}
                                                    </p>
                                                    <div className="mt-0.5 flex items-center gap-3 text-[12px] text-zinc-500">
                                                        <div className="flex items-center gap-1">
                                                            <TypeIcon className="h-3.5 w-3.5" />
                                                            <span>{typeLabel}</span>
                                                        </div>
                                                        <span>•</span>
                                                        <span>Updated {timeAgo(lastUpdated)}</span>
                                                    </div>
                                                </div>

                                                {/* Options Menu */}
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMenuOpenId(menuOpenId === note.id ? null : note.id);
                                                        }}
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all duration-150 hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
                                                        aria-label="Note options"
                                                    >
                                                        <BsThreeDotsVertical className="h-4 w-4" />
                                                    </button>

                                                    {/* Dropdown Menu */}
                                                    {menuOpenId === note.id && (
                                                        <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeleteConfirmId(note.id);
                                                                    setMenuOpenId(null);
                                                                }}
                                                                className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                                                            >
                                                                <FiTrash2 className="h-4 w-4" />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Delete Confirmation Modal */}
                                            {deleteConfirmId === note.id && (
                                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                                    <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
                                                        <h3 className="text-lg font-bold text-zinc-100">
                                                            Delete note?
                                                        </h3>
                                                        <p className="mt-2 text-sm text-zinc-400">
                                                            This will permanently delete "{note.title}" and all its related data (flashcards, quizzes, etc.). This action cannot be undone.
                                                        </p>
                                                        <div className="mt-6 flex gap-3">
                                                            <button
                                                                onClick={() => setDeleteConfirmId(null)}
                                                                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteNote(note.id)}
                                                                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-900/40">
                                    <IoDocumentTextOutline className="h-7 w-7 text-zinc-600" />
                                </div>
                                <p className="text-sm font-medium text-zinc-400">
                                    No notes yet
                                </p>
                                <p className="mt-1 text-[12px] text-zinc-600">
                                    Create your first note to get started
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── MODALS ─── */}
            <BlankDocumentModal
                open={openModal === 'blank'}
                onClose={() => setOpenModal(null)}
                onCreate={handleCreateBlankNote}
            />
            <AudioModal
                open={openModal === 'audio'}
                onClose={() => setOpenModal(null)}
                onGenerate={(file) => console.log('Audio file:', file)}
            />
            <DocumentUploadModal
                open={openModal === 'document'}
                onClose={() => setOpenModal(null)}
                onGenerate={handleCreateDocumentNote}
            />
            <WebsiteLinkModal
                open={openModal === 'website'}
                onClose={() => setOpenModal(null)}
                onGenerate={(url) => console.log('Website URL:', url)}
            />
            <ThemeModal
                open={themeModalOpen}
                onClose={() => setThemeModalOpen(false)}
            />
        </div>
    );
};

export default DashboardPage;
