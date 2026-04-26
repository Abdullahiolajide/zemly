import { useState, useEffect, useCallback, useRef } from 'react';
import posthog from 'posthog-js';
import {
    BlankDocumentModal,
    AudioModal,
    DocumentUploadModal,
    WebsiteLinkModal,
} from '../components/CreateNoteModals';
import { IoDocumentTextOutline, IoMicOutline, IoLinkOutline } from 'react-icons/io5';
import { BsThreeDotsVertical, BsChevronRight, BsFolder2, BsFolderPlus, BsArrowLeft, BsList } from 'react-icons/bs';
import { MdUploadFile, MdDriveFileMoveOutline } from 'react-icons/md';
import { BiHome } from 'react-icons/bi';
import { IoSettingsOutline } from 'react-icons/io5';
import { HiOutlineChevronDoubleLeft } from 'react-icons/hi';
import { RiMoonLine } from 'react-icons/ri';
import { FiTrash2, FiEdit3 } from 'react-icons/fi';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { createNote, createDocumentNote, createAudioNote, createLinkNote, getUserNotes, deleteNote, updateNote } from '../lib/notesService';
import { uploadDocumentToStorage, extractDocumentFromStorage, extractFromLink, inferAudioMimeType } from '../lib/aiService';
import {
    getFolders, createFolder, renameFolder, deleteFolder,
    addNoteToFolder, removeNoteFromFolder, moveNoteToFolder, getNoteFolder,
} from '../lib/foldersService';
import type { Note } from '../types';
import type { Folder } from '../lib/foldersService';
import ThemeModal from '../components/ThemeModal';
import UpgradeModal from '../components/UpgradeModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import { getUserSubscription, getSubscriptionPlanLabel, isPremiumSubscription, type UserSubscriptionRecord } from '../lib/subscriptionService';
import { supabase } from '../lib/supabaseClient';
import { getEdgeFunctionAuthHeaders } from '../lib/edgeFunctionAuth';

/* ── Sidebar nav items ── */
const navLinks = [
    { icon: BiHome, label: 'Dashboard', active: true },
    { icon: IoSettingsOutline, label: 'Settings', active: false },
];

/* ── Quick-action cards ── */
const quickActions = [
    {
        icon: MdUploadFile,
        iconBg: 'rgba(79, 156, 249, 0.12)',
        iconColor: '#4F9CF9',
        title: 'Document upload',
        subtitle: 'Any PDF, DOC, PPT, etc',
    },
    {
        icon: IoDocumentTextOutline,
        iconBg: 'rgba(0, 200, 150, 0.12)',
        iconColor: '#00C896',
        title: 'Blank document',
        subtitle: 'Start from scratch',
    },
    {
        icon: IoMicOutline,
        iconBg: 'rgba(245, 166, 35, 0.12)',
        iconColor: '#F5A623',
        title: 'Record or upload audio',
        subtitle: 'Upload an audio file',
    },
    {
        icon: IoLinkOutline,
        iconBg: 'rgba(200, 100, 100, 0.12)',
        iconColor: '#E07070',
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

function fallbackLinkTitle(sourceUrl: string): string {
    try {
        const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
        if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube Video Note';
        return `${host} Note`;
    } catch {
        return 'Web Link Note';
    }
}

function isYouTubeUrl(sourceUrl: string): boolean {
    try {
        const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
        return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'music.youtube.com';
    } catch {
        return false;
    }
}

async function fetchYouTubeOEmbedTitle(sourceUrl: string): Promise<string | null> {
    if (!isYouTubeUrl(sourceUrl)) return null;

    try {
        const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`;
        const res = await fetch(endpoint);
        if (!res.ok) return null;
        const data = await res.json();
        const title = typeof data?.title === 'string' ? data.title.trim() : '';
        return title || null;
    } catch {
        return null;
    }
}

function stripMarkdownTitleNoise(input: string): string {
    return input
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/#{1,6}\s*/g, '')
        .replace(/\*\*/g, '')
        .replace(/`{1,3}/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeLinkNoteTitle(rawTitle: string, sourceUrl: string, noteContent: string, preferredTitle?: string | null): string {
    const preferred = stripMarkdownTitleNoise(preferredTitle || '');
    if (preferred) return preferred.slice(0, 120);

    const candidateFromTitle = stripMarkdownTitleNoise(rawTitle);
    const trimmedContent = noteContent.trim();
    const contentFirstLine = trimmedContent.split('\n').find((line) => line.trim().length > 0) || '';
    const candidateFromContent = stripMarkdownTitleNoise(contentFirstLine);

    const pickCandidate = (value: string): string => {
        let title = value;
        if (/\s+##\s+NOTES\s+/i.test(title)) {
            title = title.split(/\s+##\s+NOTES\s+/i)[0].trim();
        }

        if (title.includes('###')) {
            title = title.split('###')[0].trim();
        }

        return title;
    };

    const picked = pickCandidate(candidateFromTitle) || pickCandidate(candidateFromContent);

    const looksNoisy =
        !picked ||
        picked.length < 3 ||
        picked.length > 180 ||
        /(^|\s)(overview|detailed notes|solution approach|implementation details|summary)(\s|$)/i.test(picked) ||
        picked.split(' ').length > 28;

    if (looksNoisy) return fallbackLinkTitle(sourceUrl);

    return picked.length > 120 ? `${picked.slice(0, 117).trimEnd()}...` : picked;
}

/* ── Helper: get note type icon and label ── */
function getNoteTypeInfo(sourceType?: string): { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; color?: string }>, label: string, bg: string, color: string } {
    switch (sourceType) {
        case 'document':
            return { icon: MdUploadFile, label: 'Document', bg: 'rgba(79, 156, 249, 0.12)', color: '#4F9CF9' };
        case 'audio':
            return { icon: IoMicOutline, label: 'Audio', bg: 'rgba(245, 166, 35, 0.12)', color: '#F5A623' };
        case 'link':
            return { icon: IoLinkOutline, label: 'Link', bg: 'rgba(200, 100, 100, 0.12)', color: '#E07070' };
        case 'blank':
            return { icon: IoDocumentTextOutline, label: 'Document', bg: 'rgba(0, 200, 150, 0.12)', color: '#00C896' };
        default:
            return { icon: IoDocumentTextOutline, label: 'Document', bg: 'rgba(0, 200, 150, 0.12)', color: '#00C896' };
    }
}

type ModalType = 'blank' | 'audio' | 'document' | 'website' | null;
type DashboardTab = 'notes' | 'folders';

const modalKeyMap: Record<string, ModalType> = {
    'Blank document': 'blank',
    'Record or upload audio': 'audio',
    'Document upload': 'document',
    'Website link': 'website',
};

const DashboardPage: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
    const [openModal, setOpenModal] = useState<ModalType>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [subscription, setSubscription] = useState<UserSubscriptionRecord | null>(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [billingPortalLoading, setBillingPortalLoading] = useState(false);
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    /* ── Payment result banner ── */
    const [paymentBanner, setPaymentBanner] = useState<'success' | 'failed' | null>(null);

    useEffect(() => {
        const paymentResult = searchParams.get('payment');
        if (paymentResult === 'success' || paymentResult === 'failed') {
            setPaymentBanner(paymentResult);
            // Clean up the URL
            searchParams.delete('payment');
            setSearchParams(searchParams, { replace: true });
            // Auto-dismiss after 6 seconds
            const timer = setTimeout(() => setPaymentBanner(null), 6000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (paymentBanner !== 'success' || !user?.id) return;

        posthog.capture('subscription_started', { user_id: user.id, user_email: user.email });

        let cancelled = false;
        const refreshSubscription = async () => {
            try {
                const record = await getUserSubscription(user.id, user.email);
                if (!cancelled) setSubscription(record);
            } catch (err) {
                console.error('Failed to refresh subscription:', err);
            }
        };

        void refreshSubscription();

        return () => {
            cancelled = true;
        };
    }, [paymentBanner, user?.id]);

    /* ── Tab state ── */
    const [activeTab, setActiveTab] = useState<DashboardTab>('notes');

    /* ── Folder state ── */
    const [folders, setFolders] = useState<Folder[]>([]);
    const [openFolderName, setOpenFolderName] = useState<string | null>(null);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
    const [moveNoteId, setMoveNoteId] = useState<number | null>(null);
    const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<string | null>(null);
    const [renamingNoteId, setRenamingNoteId] = useState<number | null>(null);
    const [renameNoteValue, setRenameNoteValue] = useState('');
    const newFolderInputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const renameNoteInputRef = useRef<HTMLInputElement>(null);

    /* ── Reload folders ── */
    const reloadFolders = useCallback(() => {
        if (user?.id) setFolders(getFolders(user.id));
    }, [user?.id]);

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

    useEffect(() => {
        let cancelled = false;

        const loadSubscription = async () => {
            if (!user?.id) {
                setSubscription(null);
                setSubscriptionLoading(false);
                return;
            }

            setSubscriptionLoading(true);
            try {
                const record = await getUserSubscription(user.id, user.email);
                if (!cancelled) setSubscription(record);
            } catch (err) {
                console.error('Failed to load subscription:', err);
                if (!cancelled) setSubscription(null);
            } finally {
                if (!cancelled) setSubscriptionLoading(false);
            }
        };

        void loadSubscription();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    useEffect(() => {
        reloadFolders();
    }, [reloadFolders]);

    const buildNotePath = useCallback((noteId: number) => {
        return user?.id ? `/notes/${user.id}-${noteId}` : `/notes/${noteId}`;
    }, [user?.id]);

    const isPremium = isPremiumSubscription(subscription);
    const freeNoteLimitReached = !isPremium && notes.length >= 1;

    const handleNoteCreationBlocked = useCallback(() => {
        setOpenModal(null);
        setUpgradeModalOpen(true);
    }, []);

    const handleManageBilling = useCallback(async () => {
        try {
            setBillingPortalLoading(true);

            const authHeaders = await getEdgeFunctionAuthHeaders();

            const { data, error } = await supabase.functions.invoke('create-billing-portal', {
                headers: authHeaders,
            });

            if (error) throw error;

            const portalUrl = typeof data?.portal_url === 'string'
                ? data.portal_url
                : typeof data?.url === 'string'
                    ? data.url
                    : typeof data?.link === 'string'
                        ? data.link
                        : '';

            if (!portalUrl) {
                throw new Error('Billing portal URL was not returned.');
            }

            window.open(portalUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
            console.error('Failed to open billing portal:', err);
        } finally {
            setBillingPortalLoading(false);
        }
    }, []);

    const openNoteCreationModal = useCallback((modalType: ModalType) => {
        if (!modalType) return;
        if (freeNoteLimitReached) {
            handleNoteCreationBlocked();
            return;
        }
        setOpenModal(modalType);
    }, [freeNoteLimitReached, handleNoteCreationBlocked]);

    /* ── Focus new folder input ── */
    useEffect(() => {
        if (showNewFolderInput && newFolderInputRef.current) {
            newFolderInputRef.current.focus();
        }
    }, [showNewFolderInput]);

    /* ── Focus rename input ── */
    useEffect(() => {
        if (renamingFolder && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingFolder]);

    /* ── Close menu on click outside ── */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-menu-trigger]') && !target.closest('[data-menu-dropdown]')) {
                setMenuOpenId(null);
                setFolderMenuOpen(null);
                setMoveNoteId(null);
            }
        };
        if (menuOpenId !== null || folderMenuOpen !== null || moveNoteId !== null) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [menuOpenId, folderMenuOpen, moveNoteId]);

    /* ── Create blank note → navigate ── */
    const handleCreateBlankNote = async (title: string) => {
        try {
            if (freeNoteLimitReached) {
                handleNoteCreationBlocked();
                return;
            }
            const note = await createNote(title);
            posthog.capture('note_created', { note_type: 'blank', note_id: note.id });
            navigate(buildNotePath(note.id));
        } catch (err) {
            console.error('Failed to create note:', err);
        }
    };

    /* ── Create document note → navigate ── */
    const handleCreateDocumentNote = async (result: {
        files: File[];
        title: string;
        noteContent: string;
        extractedText: string;
        publicUrls: string[];
        paths?: string[];
    }) => {
        try {
            if (freeNoteLimitReached) {
                handleNoteCreationBlocked();
                return;
            }
            const content = result.noteContent
                .split('\n')
                .filter((line) => !/^SOURCE\s*:/i.test(line.trim()))
                .join('\n')
                .trim();

            const sourceUrl = result.paths?.[0] || result.publicUrls[0] || '';
            const fileName = result.files.map((file) => file.name).join(' | ');

            const note = await createDocumentNote(
                result.title,
                sourceUrl,
                result.extractedText,
                fileName,
                content,
            );

            navigate(buildNotePath(note.id));
        } catch (err) {
            console.error('Failed to create document note:', err);
        }
    };

    const handleCreateAudioNote = async (files: File[]) => {
        if (!files.length) return;
        if (freeNoteLimitReached) {
            handleNoteCreationBlocked();
            return;
        }

        const perFileResults: {
            file: File;
            title: string;
            noteContent: string;
            extractedText: string;
            publicUrl: string;
        }[] = [];

        try {
            for (const file of files) {
                const upload = await uploadDocumentToStorage(file);
                const extracted = await extractDocumentFromStorage({
                    publicUrl: upload.publicUrl,
                    fileName: file.name,
                    mimeType: inferAudioMimeType(file) || 'audio/webm',
                });

                perFileResults.push({
                    file,
                    ...extracted,
                    publicUrl: upload.publicUrl,
                });
            }

            const combinedTitleBase = perFileResults[0]?.title || files[0]?.name.replace(/\.[^.]+$/, '') || 'Audio Note';
            const combinedTitle = files.length > 1
                ? `${combinedTitleBase} + ${files.length - 1} more`
                : combinedTitleBase;

            const combinedExtractedText = perFileResults
                .map((item) => `SOURCE: ${item.file.name}\n${item.extractedText}`)
                .join('\n\n');

            const combinedNoteContent = perFileResults
                .map((item) => item.noteContent)
                .join('\n\n');

            const sourceUrl = perFileResults[0]?.publicUrl || '';
            const fileName = files.map((f) => f.name).join(' | ');

            const note = await createAudioNote(
                combinedTitle,
                sourceUrl,
                combinedExtractedText,
                fileName,
                combinedNoteContent,
            );

            navigate(buildNotePath(note.id));
        } catch (err) {
            console.error('Failed to create audio note:', err);
        }
    };

    const handleCreateWebsiteLinkNote = async (url: string) => {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) return;

        if (freeNoteLimitReached) {
            handleNoteCreationBlocked();
            return;
        }

        try {
            const result = await extractFromLink(trimmedUrl);
            const fileName = new URL(result.sourceUrl).hostname;
            const oEmbedTitle = await fetchYouTubeOEmbedTitle(result.sourceUrl);
            const normalizedTitle = normalizeLinkNoteTitle(result.title || '', result.sourceUrl, result.noteContent || '', oEmbedTitle);

            const note = await createLinkNote(
                normalizedTitle,
                result.sourceUrl,
                result.extractedText,
                fileName,
                result.noteContent,
            );
            posthog.capture('youtube_note_generated', { note_id: note.id, source_url: result.sourceUrl });
            navigate(buildNotePath(note.id));
        } catch (err) {
            console.error('Failed to create link note:', err);
            throw err;
        }
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;

        try {
            setIsLoggingOut(true);
            await logout();
            navigate('/');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        if (deletingNoteId === noteId) return;

        try {
            setDeletingNoteId(noteId);
            await deleteNote(noteId);
            // Also remove from any folder
            if (user?.id) {
                const folder = getNoteFolder(user.id, noteId);
                if (folder) removeNoteFromFolder(user.id, folder, noteId);
                reloadFolders();
            }
            setNotes((prev) => prev.filter((n) => n.id !== noteId));
            setDeleteConfirmId(null);
            setMenuOpenId(null);
        } catch (err) {
            console.error('Failed to delete note:', err);
        } finally {
            setDeletingNoteId(null);
        }
    };

    /* ── Folder handlers ── */
    const handleCreateFolder = () => {
        if (!user?.id || !newFolderName.trim()) return;
        try {
            createFolder(user.id, newFolderName.trim());
            reloadFolders();
            setNewFolderName('');
            setShowNewFolderInput(false);
        } catch (err) {
            console.error('Failed to create folder:', err);
        }
    };

    const handleRenameFolder = () => {
        if (!user?.id || !renamingFolder || !renameValue.trim()) return;
        try {
            renameFolder(user.id, renamingFolder, renameValue.trim());
            if (openFolderName === renamingFolder) setOpenFolderName(renameValue.trim());
            reloadFolders();
            setRenamingFolder(null);
            setRenameValue('');
        } catch (err) {
            console.error('Failed to rename folder:', err);
        }
    };

    const handleDeleteFolder = (folderName: string) => {
        if (!user?.id) return;
        deleteFolder(user.id, folderName);
        if (openFolderName === folderName) setOpenFolderName(null);
        reloadFolders();
        setDeleteFolderConfirm(null);
        setFolderMenuOpen(null);
    };

    const handleMoveNote = (noteId: number, targetFolder: string | null) => {
        if (!user?.id) return;
        moveNoteToFolder(user.id, noteId, targetFolder);
        reloadFolders();
        setMoveNoteId(null);
        setMenuOpenId(null);
    };

    const handleAddToFolder = (noteId: number, folderName: string) => {
        if (!user?.id) return;
        addNoteToFolder(user.id, folderName, noteId);
        reloadFolders();
        setMoveNoteId(null);
        setMenuOpenId(null);
    };

    /* ── Derived data ── */
    const userId = user?.id || '';

    // Notes in the currently-open folder
    const openFolder = folders.find((f) => f.name === openFolderName) || null;
    const folderNoteIds = new Set(openFolder?.noteIds || []);
    const folderNotes = openFolder ? notes.filter((n) => folderNoteIds.has(n.id)) : [];



    /* ── Note row renderer ── */
    const renderNoteRow = (note: Note, inFolder: boolean) => {
        const { icon: TypeIcon, label: typeLabel, bg: typeBg, color: typeColor } = getNoteTypeInfo(note.source_type);
        const lastUpdated = note.updated_at || note.created_at;
        const currentFolder = userId ? getNoteFolder(userId, note.id) : null;

        return (
            <div key={note.id}>
                <div
                    onClick={() => navigate(buildNotePath(note.id))}
                    className="group flex cursor-pointer items-center gap-4 rounded-xl px-4 py-3.5 transition-all duration-150"
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)';
                        (e.currentTarget as HTMLElement).style.borderRadius = '12px';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = '';
                    }}
                >
                    {/* Note Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: typeBg }}>
                        <TypeIcon className="h-5 w-5" style={{ color: typeColor }} />
                    </div>

                    {/* Note Title (or inline rename input) */}
                    <div className="min-w-0 flex-1">
                        {renamingNoteId === note.id ? (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex flex-col gap-2"
                            >
                                <input
                                    ref={renameNoteInputRef}
                                    type="text"
                                    value={renameNoteValue}
                                    onChange={(e) => setRenameNoteValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') setRenamingNoteId(null);
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const trimmed = renameNoteValue.trim();
                                            if (trimmed && trimmed !== note.title) {
                                                updateNote(note.id, { title: trimmed })
                                                    .then(() => setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, title: trimmed } : n)))
                                                    .catch((err) => console.error('Failed to rename note:', err));
                                            }
                                            setRenamingNoteId(null);
                                        }
                                    }}
                                    className="w-full rounded-md border px-2 py-1 text-sm font-semibold outline-none"
                                    style={{
                                        background: 'var(--bg-glass-hover)',
                                        borderColor: 'var(--brand-emerald)',
                                        color: 'var(--text-sidebar)',
                                    }}
                                    autoFocus
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            const trimmed = renameNoteValue.trim();
                                            if (trimmed && trimmed !== note.title) {
                                                try {
                                                    await updateNote(note.id, { title: trimmed });
                                                    setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, title: trimmed } : n));
                                                } catch (err) {
                                                    console.error('Failed to rename note:', err);
                                                }
                                            }
                                            setRenamingNoteId(null);
                                        }}
                                        className="rounded-md px-3 py-1 text-[12px] font-semibold text-white transition-colors"
                                        style={{ background: 'var(--brand-emerald)' }}
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setRenamingNoteId(null)}
                                        className="rounded-md px-3 py-1 text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                                        style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm font-semibold text-zinc-200 break-words">
                                {note.title}
                            </p>
                        )}
                        <div className="mt-0.5 flex items-center gap-3 text-[12px] text-zinc-500">
                            <div className="flex items-center gap-1">
                                <TypeIcon className="h-3.5 w-3.5" />
                                <span>{typeLabel}</span>
                            </div>
                            <span>•</span>
                            <span>Updated {timeAgo(lastUpdated)}</span>
                            {currentFolder && !inFolder && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <BsFolder2 className="h-3 w-3" />
                                        {currentFolder}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Options Menu */}
                    <div className="relative">
                        <button
                            data-menu-trigger
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === note.id ? null : note.id);
                                setMoveNoteId(null);
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-600 opacity-100 md:opacity-0 transition-all duration-150 hover:text-zinc-300 md:group-hover:opacity-100"
                            style={{ background: 'transparent' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            aria-label="Note options"
                        >
                            <BsThreeDotsVertical className="h-4 w-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {menuOpenId === note.id && (
                            <div
                                data-menu-dropdown
                                className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl shadow-xl overflow-hidden"
                                style={{
                                    background: 'var(--bg-main)',
                                    border: '1px solid var(--border-glass-strong)',
                                    backdropFilter: 'blur(16px)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                                }}
                            >
                                {/* Move to folder */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); setMoveNoteId(moveNoteId === note.id ? null : note.id); }}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-zinc-300 transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <MdDriveFileMoveOutline className="h-4 w-4" />
                                    {inFolder ? 'Move / Remove' : 'Move to Folder'}
                                </button>

                                {/* Folder picker sub-menu */}
                                {moveNoteId === note.id && (
                                    <div
                                        className="border-t px-2 py-2"
                                        style={{ borderColor: 'var(--border-glass)' }}
                                    >
                                        {folders.map((f) => (
                                            <button
                                                key={f.name}
                                                onClick={(e) => { e.stopPropagation(); handleAddToFolder(note.id, f.name); }}
                                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-zinc-400 transition-colors"
                                                style={{ background: currentFolder === f.name ? 'rgba(0,200,150,0.08)' : 'transparent' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = currentFolder === f.name ? 'rgba(0,200,150,0.08)' : 'transparent'; }}
                                            >
                                                <BsFolder2 className="h-3.5 w-3.5" />
                                                {f.name}
                                                {currentFolder === f.name && <span className="ml-auto text-[10px]" style={{ color: 'var(--brand-emerald)' }}>✓</span>}
                                            </button>
                                        ))}
                                        {inFolder && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMoveNote(note.id, null); }}
                                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-amber-400 transition-colors"
                                                style={{ background: 'transparent' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.06)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                            >
                                                <BsArrowLeft className="h-3.5 w-3.5" />
                                                Remove from folder
                                            </button>
                                        )}
                                        {folders.length === 0 && (
                                            <p className="px-3 py-2 text-[11px] text-zinc-600">No folders yet</p>
                                        )}
                                    </div>
                                )}

                                {/* Rename */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRenamingNoteId(note.id);
                                        setRenameNoteValue(note.title);
                                        setMenuOpenId(null);
                                        setTimeout(() => renameNoteInputRef.current?.focus(), 50);
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-zinc-300 transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <FiEdit3 className="h-4 w-4" />
                                    Rename
                                </button>

                                {/* Delete */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(note.id);
                                        setMenuOpenId(null);
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-red-400 transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]">
                        <div
                            className="mx-4 w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl p-6 animate-[modalSlideUp_200ms_ease-out]"
                            style={{
                                background: 'var(--bg-main)',
                                border: '1px solid var(--border-glass-strong)',
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                            }}
                        >
                            <h3
                                className="text-lg font-bold text-zinc-100"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                            >
                                Delete note?
                            </h3>
                            <p className="mt-2 max-h-44 overflow-y-auto break-words pr-1 text-sm text-zinc-500">
                                This will permanently delete &ldquo;{note.title}&rdquo; and all its related data. This action cannot be undone.
                            </p>
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={deletingNoteId === note.id}
                                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass-strong)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)'; }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={deletingNoteId === note.id}
                                    className="flex-1 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {deletingNoteId === note.id ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-100" style={{ background: 'var(--bg-main)' }}>
            {/* ─── MOBILE BACKDROP ─── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 cursor-pointer bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ─── SIDEBAR ─── */}
            <aside
                className={`${
                    sidebarOpen ? 'w-60 translate-x-0' : 'w-0 -translate-x-full'
                } fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col overflow-hidden transition-all duration-300 lg:relative lg:z-auto ${!sidebarOpen ? 'lg:w-0' : ''}`}
                style={{
                    borderRight: '1px solid var(--border-glass)',
                    background: 'var(--bg-sidebar)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {/* Sidebar Header */}
                <div className="flex items-center justify-between px-5 py-4">
                    <Link to="/" className="flex items-center group">
                        <Logo className="h-8 transition-transform duration-200 group-hover:scale-[1.02]" />
                    </Link>
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
                                onClick={() => {
                                    if (link.label === 'Settings') {
                                        setAccountModalOpen(true);
                                    }
                                }}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 ${link.active
                                    ? 'text-zinc-100'
                                    : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                                    }`}
                                style={link.active ? {
                                    background: 'rgba(0, 200, 150, 0.1)',
                                    color: '#00C896',
                                } : {}}
                            >
                                <link.icon className="h-[18px] w-[18px]" />
                                <span>{link.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Upgrade Button */}
                    {!isPremium && (
                        <button
                            onClick={() => setUpgradeModalOpen(true)}
                            className="btn-emerald mt-6 flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-[13px]"
                        >
                            Upgrade to Unlimited
                        </button>
                    )}
                </nav>

                {/* Sidebar Footer */}
                <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border-glass)' }}>
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
                        <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                            style={{ background: '#00C896', color: '#0D0F12' }}
                        >
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-zinc-300">
                                {user?.email || 'user@zemly.me'}
                            </p>
                        </div>
                        <button
                            onClick={() => setAccountModalOpen(true)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-zinc-800/70 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Open settings"
                        >
                            <IoSettingsOutline className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ─── MAIN CONTENT ─── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
                {/* Main scrollable area */}
                <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
                    {/* Payment result banner */}
                    {paymentBanner && (
                        <div
                            className="mb-4 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium animate-[fadeIn_200ms_ease-out]"
                            style={{
                                background: paymentBanner === 'success' ? 'rgba(0,200,150,0.08)' : 'rgba(239,68,68,0.08)',
                                border: `1px solid ${paymentBanner === 'success' ? 'rgba(0,200,150,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                color: paymentBanner === 'success' ? '#00C896' : '#ef4444',
                            }}
                        >
                            <span>
                                {paymentBanner === 'success'
                                    ? '🎉 Payment successful! Welcome to Zemly Unlimited.'
                                    : '❌ Payment was not completed. Please try again.'}
                            </span>
                            <button
                                onClick={() => setPaymentBanner(null)}
                                className="ml-3 text-zinc-500 transition-colors hover:text-zinc-300"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Top row */}
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200 ${sidebarOpen ? 'lg:hidden' : ''}`}
                                aria-label="Expand sidebar"
                            >
                                <BsList className="h-5 w-5" />
                            </button>
                            <div>
                                <h1
                                    className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl"
                                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                                >
                                    Dashboard
                                </h1>
                                <p className="mt-0.5 text-xs text-zinc-500 sm:mt-1 sm:text-sm">
                                    Create new notes
                                </p>
                            </div>
                        </div>

                        {/* Search */}
                        {/* <button
                            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-zinc-500 transition-all hover:text-zinc-400 sm:px-4 sm:text-sm"
                            style={{
                                borderColor: 'var(--border-glass)',
                                background: 'var(--bg-glass-hover)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            <IoSearch className="h-4 w-4" />
                            <span>Search</span>
                            <kbd className="ml-2 hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:inline sm:ml-3">
                                ⌘K
                            </kbd>
                        </button> */}
                    </div>

                    {/* ── Quick Action Cards ── */}
                    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {quickActions.map((action, i) => (
                            <button
                                key={action.title}
                                onClick={() => openNoteCreationModal(modalKeyMap[action.title] ?? null)}
                                className="animate-fade-up group flex items-center gap-4 rounded-xl px-4 py-4 text-left transition-all duration-200"
                                style={{
                                    animationDelay: `${i * 60}ms`,
                                    background: 'var(--bg-glass-hover)',
                                    border: '1px solid var(--border-glass)',
                                    backdropFilter: 'blur(8px)',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass-strong)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                                }}
                            >
                                {/* Icon */}
                                <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                                    style={{ background: action.iconBg, border: `1px solid ${action.iconColor}25` }}
                                >
                                    <action.icon className="h-5 w-5" style={{ color: action.iconColor }} />
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

                    {/* ── Tabs: My Notes / Folders ── */}
                    <div className="mb-6 flex items-center justify-between">
                        <div
                            className="flex items-center gap-1 rounded-lg border p-1"
                            style={{
                                borderColor: 'var(--border-glass)',
                                background: 'var(--bg-glass-hover)',
                            }}
                        >
                            <button
                                onClick={() => { setActiveTab('notes'); setOpenFolderName(null); }}
                                className="rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors"
                                style={{
                                    background: activeTab === 'notes' ? 'var(--border-glass-strong)' : 'transparent',
                                    color: activeTab === 'notes' ? 'var(--podcast-bubble-text-active, #e4e4e7)' : 'var(--text-sidebar)',
                                }}
                            >
                                My Notes
                            </button>
                            <button
                                onClick={() => { setActiveTab('folders'); setOpenFolderName(null); }}
                                className="rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors"
                                style={{
                                    background: activeTab === 'folders' ? 'var(--border-glass-strong)' : 'transparent',
                                    color: activeTab === 'folders' ? 'var(--podcast-bubble-text-active, #e4e4e7)' : 'var(--text-sidebar)',
                                }}
                            >
                                Folders
                            </button>
                        </div>

                        <button
                            onClick={() => { setActiveTab('folders'); setShowNewFolderInput(true); }}
                            className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all duration-150"
                            style={{
                                border: '1px solid rgba(0,200,150,0.25)',
                                background: 'rgba(0,200,150,0.06)',
                                color: 'var(--brand-emerald)',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.12)';
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,200,150,0.4)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(0,200,150,0.06)';
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,200,150,0.25)';
                            }}
                        >
                            <BsFolderPlus className="h-4 w-4" />
                            New Folder
                        </button>
                    </div>

                    {/* ══════════ MY NOTES TAB ══════════ */}
                    {activeTab === 'notes' && (
                        <div>
                            <p className="mb-3 text-[12px] font-medium tracking-wide" style={{ color: '#00C896' }}>
                                {notes.length > 0 ? 'Your Notes' : 'Earlier'}
                            </p>

                            {notesLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,200,150,0.2)', borderTopColor: '#00C896' }} />
                                </div>
                            ) : notes.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {notes.map((note) => renderNoteRow(note, false))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24">
                                    <div
                                        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                                        style={{
                                            background: 'rgba(0,200,150,0.06)',
                                            border: '1px solid rgba(0,200,150,0.15)',
                                        }}
                                    >
                                        <IoDocumentTextOutline className="h-7 w-7" style={{ color: '#00C896', opacity: 0.7 }} />
                                    </div>
                                    <p className="text-sm font-semibold text-zinc-400">
                                        No notes yet
                                    </p>
                                    <p className="mt-1.5 text-[12px] text-zinc-600">
                                        Create your first note using the cards above
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════ FOLDERS TAB ══════════ */}
                    {activeTab === 'folders' && !openFolderName && (
                        <div>
                            {/* New folder input */}
                            {showNewFolderInput && (
                                <div
                                    className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3"
                                    style={{ border: '1px solid var(--border-glass-strong)', background: 'var(--bg-glass-hover)' }}
                                >
                                    <BsFolder2 className="h-5 w-5 shrink-0" style={{ color: 'var(--brand-emerald)' }} />
                                    <input
                                        ref={newFolderInputRef}
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }}
                                        placeholder="Folder name…"
                                        className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-zinc-200 outline-none placeholder:text-zinc-600"
                                    />
                                    <button
                                        onClick={handleCreateFolder}
                                        disabled={!newFolderName.trim()}
                                        className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40"
                                        style={{ background: 'var(--brand-emerald)', color: 'var(--text-on-brand)' }}
                                    >
                                        Create
                                    </button>
                                    <button
                                        onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                                        className="text-[12px] font-medium text-zinc-500 hover:text-zinc-300"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

                            {/* Folder list */}
                            {folders.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {folders.map((folder) => {
                                        const noteCount = folder.noteIds.filter((id) => notes.some((n) => n.id === id)).length;

                                        return (
                                            <div key={folder.name} className="relative">
                                                {renamingFolder === folder.name ? (
                                                    <div
                                                        className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                                                        style={{ border: '1px solid var(--border-glass-strong)', background: 'var(--bg-glass-hover)' }}
                                                    >
                                                        <BsFolder2 className="h-5 w-5 shrink-0 text-amber-500" />
                                                        <input
                                                            ref={renameInputRef}
                                                            type="text"
                                                            value={renameValue}
                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setRenamingFolder(null); }}
                                                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-200 outline-none"
                                                        />
                                                        <button onClick={handleRenameFolder} className="text-[12px] font-semibold" style={{ color: 'var(--brand-emerald)' }}>Save</button>
                                                        <button onClick={() => setRenamingFolder(null)} className="text-[12px] font-medium text-zinc-500">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="group flex cursor-pointer items-center gap-4 rounded-xl px-4 py-3.5 transition-all duration-150"
                                                        onClick={() => setOpenFolderName(folder.name)}
                                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                                                    >
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                                            <BsFolder2 className="h-5 w-5 text-amber-500" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-zinc-200">{folder.name}</p>
                                                            <p className="mt-0.5 text-[12px] text-zinc-500">
                                                                {noteCount} note{noteCount !== 1 ? 's' : ''} • Created {timeAgo(folder.createdAt)}
                                                            </p>
                                                        </div>

                                                        {/* Folder options */}
                                                        <div className="relative">
                                                            <button
                                                                data-menu-trigger
                                                                onClick={(e) => { e.stopPropagation(); setFolderMenuOpen(folderMenuOpen === folder.name ? null : folder.name); }}
                                                                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 opacity-100 md:opacity-0 transition-all hover:text-zinc-300 md:group-hover:opacity-100"
                                                                style={{ background: 'transparent' }}
                                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                            >
                                                                <BsThreeDotsVertical className="h-4 w-4" />
                                                            </button>

                                                            {folderMenuOpen === folder.name && (
                                                                <div
                                                                    data-menu-dropdown
                                                                    className="absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-xl shadow-xl"
                                                                    style={{
                                                                        background: 'var(--bg-main)',
                                                                        border: '1px solid var(--border-glass-strong)',
                                                                        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                                                                    }}
                                                                >
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setRenameValue(folder.name);
                                                                            setRenamingFolder(folder.name);
                                                                            setFolderMenuOpen(null);
                                                                        }}
                                                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-zinc-300 transition-colors"
                                                                        style={{ background: 'transparent' }}
                                                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                    >
                                                                        <FiEdit3 className="h-4 w-4" />
                                                                        Rename
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeleteFolderConfirm(folder.name);
                                                                            setFolderMenuOpen(null);
                                                                        }}
                                                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-red-400 transition-colors"
                                                                        style={{ background: 'transparent' }}
                                                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
                                                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                    >
                                                                        <FiTrash2 className="h-4 w-4" />
                                                                        Delete Folder
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <BsChevronRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : !showNewFolderInput && (
                                <div className="flex flex-col items-center justify-center py-24">
                                    <div
                                        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                                        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                                    >
                                        <BsFolder2 className="h-7 w-7" style={{ color: '#F5A623', opacity: 0.7 }} />
                                    </div>
                                    <p className="text-sm font-semibold text-zinc-400">No folders yet</p>
                                    <p className="mt-1.5 text-[12px] text-zinc-600">
                                        Create a folder to organize your notes
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════ FOLDER DETAIL VIEW ══════════ */}
                    {activeTab === 'folders' && openFolderName && (
                        <div>
                            {/* Back button + folder name */}
                            <div className="mb-4 flex items-center gap-3">
                                <button
                                    onClick={() => setOpenFolderName(null)}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200"
                                    style={{ background: 'var(--bg-glass-hover)', border: '1px solid var(--border-glass)' }}
                                >
                                    <BsArrowLeft className="h-4 w-4" />
                                </button>
                                <div className="flex items-center gap-2">
                                    <BsFolder2 className="h-5 w-5 text-amber-500" />
                                    <h2
                                        className="text-lg font-bold text-zinc-100"
                                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                                    >
                                        {openFolderName}
                                    </h2>
                                    <span className="ml-2 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-zinc-500" style={{ background: 'var(--bg-glass-hover)', border: '1px solid var(--border-glass)' }}>
                                        {folderNotes.length} note{folderNotes.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            {folderNotes.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {folderNotes.map((note) => renderNoteRow(note, true))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24">
                                    <div
                                        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                                        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                                    >
                                        <BsFolder2 className="h-7 w-7" style={{ color: '#F5A623', opacity: 0.7 }} />
                                    </div>
                                    <p className="text-sm font-semibold text-zinc-400">This folder is empty</p>
                                    <p className="mt-1.5 text-[12px] text-zinc-600">
                                        Move notes here from the "My Notes" tab
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Delete Folder Confirmation Modal ─── */}
            {deleteFolderConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]">
                    <div
                        className="w-full max-w-sm rounded-2xl p-6 animate-[modalSlideUp_200ms_ease-out]"
                        style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border-glass-strong)',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                        }}
                    >
                        <h3
                            className="text-lg font-bold text-zinc-100"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Delete folder?
                        </h3>
                        <p className="mt-2 text-sm text-zinc-500">
                            This will delete the folder &ldquo;{deleteFolderConfirm}&rdquo;. Your notes will not be deleted — they'll just become unfiled.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setDeleteFolderConfirm(null)}
                                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:text-zinc-200"
                                style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteFolder(deleteFolderConfirm)}
                                className="flex-1 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
                            >
                                Delete Folder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODALS ─── */}
            <BlankDocumentModal
                open={openModal === 'blank'}
                onClose={() => setOpenModal(null)}
                onCreate={handleCreateBlankNote}
            />
            <AudioModal
                open={openModal === 'audio'}
                onClose={() => setOpenModal(null)}
                onGenerate={handleCreateAudioNote}
            />
            <DocumentUploadModal
                open={openModal === 'document'}
                onClose={() => setOpenModal(null)}
                onGenerate={handleCreateDocumentNote}
            />
            <WebsiteLinkModal
                open={openModal === 'website'}
                onClose={() => setOpenModal(null)}
                onGenerate={handleCreateWebsiteLinkNote}
            />
            <ThemeModal
                open={themeModalOpen}
                onClose={() => setThemeModalOpen(false)}
            />
            <AccountSettingsModal
                open={accountModalOpen}
                onClose={() => setAccountModalOpen(false)}
                userName={user?.email?.split('@')[0] || user?.email || null}
                userEmail={user?.email || null}
                planLabel={subscriptionLoading ? 'Loading…' : getSubscriptionPlanLabel(subscription)}
                isSubscribed={isPremium}
                onUpgrade={() => {
                    setAccountModalOpen(false);
                    setUpgradeModalOpen(true);
                }}
                onManageBilling={handleManageBilling}
                isManageBillingLoading={billingPortalLoading}
                isLogoutLoading={isLoggingOut}
                onLogout={handleLogout}
            />
            <UpgradeModal
                isOpen={upgradeModalOpen}
                onClose={() => setUpgradeModalOpen(false)}
                userEmail={user?.email}
                userId={user?.id}
            />
        </div>
    );
};

export default DashboardPage;
