import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdAutoAwesome } from 'react-icons/md';
import { BsMic, BsDownload } from 'react-icons/bs';
import {
    IoPlaySharp, IoPauseSharp,
    IoPlaySkipForwardSharp, IoPlaySkipBackSharp,
    IoVolumeHighOutline, IoVolumeMuteOutline,
} from 'react-icons/io5';
import { HiOutlineHand } from 'react-icons/hi';
import type { PodcastLine } from '../lib/aiService';
import { generatePodcast } from '../lib/aiService';

/* ── Speaker config ── */
const SPEAKERS = {
    Hope: {
        name: 'Hope',
        color: '#E07070',
        avatarBg: 'linear-gradient(135deg, #D35F5F, #E07070)',
        align: 'left' as const,
    },
    Corey: {
        name: 'Corey',
        color: '#F5A623',
        avatarBg: 'linear-gradient(135deg, #D4912A, #F5A623)',
        align: 'right' as const,
    },
};

type PodcastView = 'loading' | 'generate' | 'player';

interface PodcastPanelProps {
    noteId: number;
    noteTitle?: string;
    getNoteText: (mode: 'fast' | 'deep') => string;
}

/* ── Persistence helpers ── */
function getPersistenceKey(noteId: number) { return `podcast-${noteId}`; }

function loadSavedScript(noteId: number): PodcastLine[] | null {
    try {
        const raw = localStorage.getItem(getPersistenceKey(noteId));
        if (!raw) return null;
        return JSON.parse(raw) as PodcastLine[];
    } catch { return null; }
}

function saveScript(noteId: number, script: PodcastLine[]) {
    try { localStorage.setItem(getPersistenceKey(noteId), JSON.stringify(script)); }
    catch { /* ignore quota errors */ }
}

/* ── Format time helper ── */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const PodcastPanel: React.FC<PodcastPanelProps> = ({ noteId, noteTitle, getNoteText }) => {
    const [view, setView] = useState<PodcastView>('loading');
    const [script, setScript] = useState<PodcastLine[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationMode, setGenerationMode] = useState<'fast' | 'deep'>('deep');

    /* ── Player state ── */
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentLineIdx, setCurrentLineIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(0.75);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showRaiseHand, setShowRaiseHand] = useState(false);

    const transcriptRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /* Duration estimate: ~3s per line at 1x speed */
    const LINE_DURATION = 3;
    const totalDuration = script.length * LINE_DURATION;

    /* ── Load saved script ── */
    useEffect(() => {
        const saved = loadSavedScript(noteId);
        if (saved && saved.length > 0) {
            setScript(saved);
            setView('player');
        } else {
            setView('generate');
        }
    }, [noteId]);

    /* ── Auto-scroll transcript ── */
    useEffect(() => {
        if (!transcriptRef.current) return;
        const activeEl = transcriptRef.current.querySelector(`[data-line-idx="${currentLineIdx}"]`);
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLineIdx]);

    /* ── Simulated playback ── */
    useEffect(() => {
        if (isPlaying && script.length > 0) {
            const tickMs = 100 / playbackSpeed;
            intervalRef.current = setInterval(() => {
                setProgress(prev => {
                    const next = prev + (0.1 / totalDuration) * 100;
                    if (next >= 100) {
                        setIsPlaying(false);
                        return 100;
                    }
                    /* Update current line based on progress */
                    const lineIdx = Math.min(
                        Math.floor((next / 100) * script.length),
                        script.length - 1
                    );
                    setCurrentLineIdx(lineIdx);
                    return next;
                });
            }, tickMs);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, playbackSpeed, script.length, totalDuration]);

    /* ── Generate podcast ── */
    const handleGenerate = useCallback(async () => {
        const text = getNoteText(generationMode);
        if (!text.trim()) {
            setError('Your note is empty. Write some content first, then generate the podcast.');
            return;
        }
        setIsGenerating(true);
        setError(null);
        try {
            const generated: PodcastLine[] = await generatePodcast(text);
            setScript(generated);
            saveScript(noteId, generated);
            setView('player');
        } catch (err) {
            console.error('Podcast generation failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate podcast');
        } finally {
            setIsGenerating(false);
        }
    }, [generationMode, getNoteText, noteId]);

    /* ── Player controls ── */
    const togglePlay = () => {
        if (progress >= 100) {
            setProgress(0);
            setCurrentLineIdx(0);
        }
        setIsPlaying(prev => !prev);
    };

    const skipForward = () => {
        const nextLine = Math.min(currentLineIdx + 1, script.length - 1);
        setCurrentLineIdx(nextLine);
        setProgress((nextLine / script.length) * 100);
    };

    const skipBackward = () => {
        const prevLine = Math.max(currentLineIdx - 1, 0);
        setCurrentLineIdx(prevLine);
        setProgress((prevLine / script.length) * 100);
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setProgress(pct);
        const lineIdx = Math.min(Math.floor((pct / 100) * script.length), script.length - 1);
        setCurrentLineIdx(lineIdx);
    };

    const cycleSpeed = () => {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const idx = speeds.indexOf(playbackSpeed);
        setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
    };

    const currentTime = (progress / 100) * totalDuration;
    const remainingTime = totalDuration - currentTime;

    const getSpeakerConfig = (speakerName: string) => {
        if (speakerName.toLowerCase().includes('hope') || speakerName.toLowerCase().includes('female'))
            return SPEAKERS.Hope;
        return SPEAKERS.Corey;
    };

    /* ── Loading ── */
    if (view === 'loading') {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 px-8 py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2"
                    style={{ borderColor: 'var(--border-glass-strong)', borderTopColor: 'var(--brand-emerald)' }} />
                <p className="text-[14px] font-medium text-zinc-400">Loading podcast…</p>
            </div>
        );
    }

    /* ── Generate View ── */
    if (view === 'generate') {
        return (
            <div className="mx-auto w-full max-w-2xl px-8 py-12 lg:px-16">
                <div className="mb-10 text-center">
                    <h2
                        className="mb-3 text-3xl font-bold text-zinc-100"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                    >
                        🎙️ Generate Podcast
                    </h2>
                    <p className="text-[15px] text-zinc-500">
                        AI generates a conversational podcast between two hosts discussing your notes
                    </p>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl px-4 py-3 text-[14px] text-red-400"
                        style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>
                        {error}
                    </div>
                )}

                {/* Speaker Preview */}
                <div className="mb-8 flex items-center justify-center gap-8">
                    {Object.values(SPEAKERS).map(speaker => (
                        <div key={speaker.name} className="flex flex-col items-center gap-2">
                            <div
                                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg"
                                style={{ background: speaker.avatarBg, boxShadow: `0 4px 20px ${speaker.color}40` }}
                            >
                                {speaker.name[0]}
                            </div>
                            <span className="text-[13px] font-semibold" style={{ color: speaker.color }}>
                                {speaker.name}
                            </span>
                            <span className="text-[11px] text-zinc-600">
                                {speaker.name === 'Hope' ? 'Host' : 'Co-host'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Mode toggle */}
                <div className="mb-5 flex items-center justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => setGenerationMode('deep')}
                        className={`rounded-lg px-3.5 py-2 text-[12px] font-semibold transition-colors ${generationMode === 'deep' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        style={{
                            background: generationMode === 'deep' ? 'rgba(0,200,150,0.18)' : 'rgba(255,255,255,0.03)',
                            border: generationMode === 'deep' ? '1px solid rgba(0,200,150,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        Deep (full extracted text)
                    </button>
                    <button
                        type="button"
                        onClick={() => setGenerationMode('fast')}
                        className={`rounded-lg px-3.5 py-2 text-[12px] font-semibold transition-colors ${generationMode === 'fast' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        style={{
                            background: generationMode === 'fast' ? 'rgba(79,156,249,0.16)' : 'rgba(255,255,255,0.03)',
                            border: generationMode === 'fast' ? '1px solid rgba(79,156,249,0.38)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        Fast (summary note)
                    </button>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn-emerald group relative flex w-full items-center justify-center gap-2.5 py-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isGenerating ? (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2"
                                style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--text-on-brand)' }} />
                            <span>Generating Podcast...</span>
                        </>
                    ) : (
                        <>
                            <BsMic className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                            <span>Generate Podcast</span>
                        </>
                    )}
                </button>

                <p className="mt-4 text-center text-[12px] text-zinc-600">
                    Audio playback will be available when a Text-to-Speech API is connected.
                    <br />For now, enjoy the full interactive transcript experience!
                </p>
            </div>
        );
    }

    /* ── Player View ── */
    return (
        <div className="flex h-full flex-col">
            {/* ── Top: Podcast Player Header ── */}
            <div
                className="shrink-0 px-6 py-5"
                style={{
                    background: 'linear-gradient(180deg, rgba(140,60,60,0.12) 0%, transparent 100%)',
                    borderBottom: '1px solid var(--border-glass)',
                }}
            >
                {/* Cover card */}
                <div
                    className="mx-auto mb-5 flex max-w-lg items-center gap-4 rounded-2xl px-5 py-4"
                    style={{
                        background: 'linear-gradient(135deg, rgba(180,70,70,0.15), rgba(100,40,80,0.12))',
                        border: '1px solid rgba(224,112,112,0.18)',
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    {/* Avatar */}
                    <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                        style={{
                            background: 'linear-gradient(135deg, #D35F5F, #8B3A62)',
                            boxShadow: '0 4px 20px rgba(180,70,70,0.35)',
                        }}
                    >
                        <BsMic className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p
                            className="truncate text-[15px] font-bold text-zinc-100"
                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            {noteTitle || 'Study Session'}
                        </p>
                        <p className="text-[12px] text-zinc-500">
                            <span className="mr-1">⏱</span>
                            {formatTime(totalDuration)} • {script.length} exchanges
                        </p>
                    </div>
                    {/* Raise Hand */}
                    <button
                        onClick={() => setShowRaiseHand(prev => !prev)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all"
                        style={{
                            background: showRaiseHand ? 'rgba(79,156,249,0.18)' : 'rgba(255,255,255,0.06)',
                            border: showRaiseHand ? '1px solid rgba(79,156,249,0.35)' : '1px solid var(--border-glass)',
                            color: showRaiseHand ? '#4F9CF9' : '#a1a1aa',
                        }}
                    >
                        <HiOutlineHand className="h-3.5 w-3.5" />
                        Raise Hand
                    </button>
                </div>

                {/* ── Progress Bar ── */}
                <div className="mx-auto max-w-lg">
                    <div
                        className="group relative h-1.5 cursor-pointer rounded-full"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                        onClick={handleProgressClick}
                    >
                        <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
                            style={{
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, #8B3A62, #E07070)',
                                boxShadow: '0 0 8px rgba(224,112,112,0.4)',
                            }}
                        />
                        {/* Thumb */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                            style={{
                                left: `${progress}%`,
                                transform: `translateX(-50%) translateY(-50%)`,
                                background: '#E07070',
                                boxShadow: '0 0 6px rgba(224,112,112,0.6)',
                            }}
                        />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-600">
                        <span>{formatTime(currentTime)}</span>
                        <span>-{formatTime(remainingTime)}</span>
                    </div>
                </div>

                {/* ── Controls ── */}
                <div className="mx-auto flex max-w-lg items-center justify-between">
                    {/* Volume */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                            {isMuted || volume === 0
                                ? <IoVolumeMuteOutline className="h-4 w-4" />
                                : <IoVolumeHighOutline className="h-4 w-4" />
                            }
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={isMuted ? 0 : volume}
                            onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                            className="podcast-volume-slider h-1 w-16 appearance-none rounded-full"
                            style={{ background: `linear-gradient(to right, #a1a1aa ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)` }}
                        />
                    </div>

                    {/* Playback */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={skipBackward}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-200"
                        >
                            <IoPlaySkipBackSharp className="h-5 w-5" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="flex h-12 w-12 items-center justify-center rounded-full transition-all hover:scale-105"
                            style={{
                                background: '#ffffff',
                                boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
                            }}
                        >
                            {isPlaying
                                ? <IoPauseSharp className="h-6 w-6 text-zinc-900" />
                                : <IoPlaySharp className="ml-0.5 h-6 w-6 text-zinc-900" />
                            }
                        </button>
                        <button
                            onClick={skipForward}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-200"
                        >
                            <IoPlaySkipForwardSharp className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Speed + Download */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={cycleSpeed}
                            className="rounded-md px-2 py-1 text-[12px] font-bold text-zinc-500 transition-colors hover:text-zinc-300"
                            style={{ border: '1px solid var(--border-glass)' }}
                        >
                            {playbackSpeed}x
                        </button>
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                            title="Download (Coming soon)"
                        >
                            <BsDownload className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Transcript ── */}
            <div ref={transcriptRef} className="flex-1 overflow-y-auto px-6 py-4">
                {/* TTS notice */}
                <div
                    className="mb-5 flex items-center gap-2.5 rounded-xl px-4 py-3"
                    style={{
                        background: 'rgba(79,156,249,0.06)',
                        border: '1px solid rgba(79,156,249,0.15)',
                    }}
                >
                    <MdAutoAwesome className="h-4 w-4 shrink-0" style={{ color: '#4F9CF9' }} />
                    <p className="text-[12px] text-zinc-500">
                        <span className="font-semibold text-zinc-400">Transcript mode</span> — Audio will play once a Text-to-Speech API is connected. Follow along with the transcript below!
                    </p>
                </div>

                {/* Messages */}
                <div className="space-y-4">
                    <AnimatePresence initial={false}>
                        {script.map((line, idx) => {
                            const speaker = getSpeakerConfig(line.speaker);
                            const isRight = speaker.align === 'right';
                            const isActive = idx === currentLineIdx && isPlaying;
                            const isPast = idx < currentLineIdx;

                            return (
                                <motion.div
                                    key={idx}
                                    data-line-idx={idx}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.5) }}
                                    className={`flex gap-3 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}
                                    style={{
                                        opacity: isPast ? 0.5 : 1,
                                        transition: 'opacity 0.3s ease',
                                    }}
                                    onClick={() => {
                                        setCurrentLineIdx(idx);
                                        setProgress((idx / script.length) * 100);
                                    }}
                                >
                                    {/* Avatar */}
                                    <div
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                                        style={{
                                            background: speaker.avatarBg,
                                            boxShadow: isActive ? `0 0 16px ${speaker.color}50` : 'none',
                                            transition: 'box-shadow 0.3s ease',
                                        }}
                                    >
                                        {speaker.name[0]}
                                    </div>

                                    {/* Bubble */}
                                    <div className={`max-w-[85%] ${isRight ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                        <span
                                            className="text-[11px] font-semibold"
                                            style={{ color: speaker.color }}
                                        >
                                            {speaker.name}
                                        </span>
                                        <div
                                            className="cursor-pointer rounded-2xl px-4 py-3 transition-all"
                                            style={{
                                                background: isActive
                                                    ? `rgba(${isRight ? '245,166,35' : '224,112,112'},0.1)`
                                                    : 'rgba(255,255,255,0.04)',
                                                border: isActive
                                                    ? `1px solid ${speaker.color}40`
                                                    : '1px solid var(--border-glass)',
                                                borderRadius: isRight
                                                    ? '16px 4px 16px 16px'
                                                    : '4px 16px 16px 16px',
                                                boxShadow: isActive
                                                    ? `0 0 20px ${speaker.color}15`
                                                    : 'none',
                                            }}
                                        >
                                            <p className={`text-[14px] leading-relaxed ${isActive ? 'text-zinc-200' : 'text-zinc-400'}`}
                                                style={{ transition: 'color 0.3s ease' }}
                                            >
                                                {line.text}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* "Raise Hand" prompt */}
                <AnimatePresence>
                    {showRaiseHand && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                            className="mt-6 flex items-start gap-3"
                        >
                            <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                                style={{ background: 'linear-gradient(135deg, #4F9CF9, #3B82F6)', color: 'white' }}
                            >
                                👋
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-semibold text-blue-400">You</span>
                                <div
                                    className="rounded-2xl px-4 py-3"
                                    style={{
                                        background: 'rgba(79,156,249,0.08)',
                                        border: '1px solid rgba(79,156,249,0.2)',
                                        borderRadius: '4px 16px 16px 16px',
                                    }}
                                >
                                    <p className="text-[13px] italic text-zinc-400">
                                        Great question! This feature will be interactive when TTS is connected — you'll be able to ask clarifying questions mid-podcast.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Spacer */}
                <div className="h-6" />
            </div>

            {/* ── Bottom: Regenerate ── */}
            <div
                className="shrink-0 flex items-center justify-between px-6 py-3"
                style={{ borderTop: '1px solid var(--border-glass)' }}
            >
                <span className="text-[12px] text-zinc-600">
                    {script.length} exchanges • ~{formatTime(totalDuration)} listen
                </span>
                <button
                    onClick={() => {
                        localStorage.removeItem(getPersistenceKey(noteId));
                        setScript([]);
                        setView('generate');
                        setProgress(0);
                        setCurrentLineIdx(0);
                        setIsPlaying(false);
                    }}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-zinc-500 transition-all hover:text-zinc-300"
                    style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-glass-hover)' }}
                >
                    <MdAutoAwesome className="h-3.5 w-3.5" style={{ color: 'var(--brand-emerald)' }} />
                    Regenerate
                </button>
            </div>
        </div>
    );
};

export default PodcastPanel;
