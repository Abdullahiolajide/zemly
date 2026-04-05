import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsMic, BsDownload } from 'react-icons/bs';
import {
    IoPlaySharp, IoPauseSharp,
    IoPlaySkipForwardSharp, IoPlaySkipBackSharp,
    IoVolumeHighOutline, IoVolumeMuteOutline,
} from 'react-icons/io5';
import { HiOutlineHand } from 'react-icons/hi';
import type { PodcastLine } from '../lib/aiService';
import { generatePodcast, generatePodcastAudio } from '../lib/aiService';
import { getPodcastSession, upsertPodcastScript, uploadPodcastAudio } from '../lib/podcastService';

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
    getNoteText: () => string;
}

async function fetchAudioBlob(audioUrl: string): Promise<Blob> {
    const res = await fetch(audioUrl);
    if (!res.ok) {
        throw new Error('Saved podcast audio could not be loaded.');
    }
    return await res.blob();
}

/* ── Format time helper ── */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function normalizePodcastScript(script: PodcastLine[]): PodcastLine[] {
    const cleaned = script
        .filter((line) => typeof line?.text === 'string' && line.text.trim().length > 0)
        .map((line) => ({
            speaker: (line.speaker || '').trim(),
            text: line.text.trim(),
        }));

    if (cleaned.length === 0) return [];

    const knownHope = ['hope', 'alex', 'host'];
    const knownCorey = ['corey', 'sam', 'cohost', 'co-host'];

    let nextSpeaker: 'Hope' | 'Corey' = 'Hope';

    return cleaned.map((line, idx) => {
        const key = line.speaker.toLowerCase();
        if (knownHope.some((token) => key.includes(token))) {
            nextSpeaker = 'Corey';
            return { speaker: 'Hope', text: line.text };
        }
        if (knownCorey.some((token) => key.includes(token))) {
            nextSpeaker = 'Hope';
            return { speaker: 'Corey', text: line.text };
        }

        const speaker = idx === 0 ? 'Hope' : nextSpeaker;
        nextSpeaker = speaker === 'Hope' ? 'Corey' : 'Hope';
        return { speaker, text: line.text };
    });
}

const PodcastPanel: React.FC<PodcastPanelProps> = ({ noteId, noteTitle, getNoteText }) => {
    const [view, setView] = useState<PodcastView>('loading');
    const [script, setScript] = useState<PodcastLine[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationPhase, setGenerationPhase] = useState<'script' | 'audio'>('script');

    /* ── Player state ── */
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentLineIdx, setCurrentLineIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(0.75);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showRaiseHand, setShowRaiseHand] = useState(false);
    const [hasAudio, setHasAudio] = useState(false);

    const transcriptRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);

    const normalizedScript = useMemo(() => normalizePodcastScript(script), [script]);

    /* ── Line timing estimation ── */
    const lineTimes = useMemo(() => {
        if (normalizedScript.length === 0 || duration === 0) return [];
        // Estimate each line's time proportionally by character count
        const totalChars = normalizedScript.reduce((sum, l) => sum + l.text.length, 0);
        if (totalChars === 0) return normalizedScript.map(() => ({ start: 0, end: 0 }));

        let elapsed = 0;
        return normalizedScript.map((line) => {
            const lineDuration = (line.text.length / totalChars) * duration;
            const start = elapsed;
            elapsed += lineDuration;
            return { start, end: elapsed };
        });
    }, [normalizedScript, duration]);

    /* ── Cleanup audio URL on unmount ── */
    useEffect(() => {
        return () => {
            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = null;
            }
        };
    }, []);

    /* ── Load saved script & audio ── */
    useEffect(() => {
        let cancelled = false;

        (async () => {
            setView('loading');
            setError(null);
            setHasAudio(false);
            setScript([]);

            try {
                const saved = await getPodcastSession(noteId);
                if (cancelled) return;

                if (saved && saved.script.length > 0) {
                    const normalized = normalizePodcastScript(saved.script);
                    setScript(normalized);

                    if (saved.audioUrl) {
                        try {
                            const savedAudio = await fetchAudioBlob(saved.audioUrl);
                            if (cancelled) return;
                            setupAudioElement(savedAudio);
                            setHasAudio(true);
                        } catch (audioErr) {
                            console.warn('Failed to load saved podcast audio:', audioErr);
                        }
                    }

                    setView('player');
                    return;
                }

                setView('generate');
            } catch (err) {
                console.error('Failed to load podcast session:', err);
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load podcast data');
                setView('generate');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [noteId]);

    /* ── Auto-scroll transcript ── */
    useEffect(() => {
        if (!transcriptRef.current) return;
        const activeEl = transcriptRef.current.querySelector(`[data-line-idx="${currentLineIdx}"]`);
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLineIdx]);

    /* ── Setup audio element from blob ── */
    const setupAudioElement = useCallback((blob: Blob) => {
        // Revoke previous URL
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;

        const audio = new Audio(url);
        audio.preload = 'metadata';

        audio.addEventListener('loadedmetadata', () => {
            setDuration(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
            if (audio.duration > 0) {
                setCurrentTime(audio.currentTime);
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        });

        audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setProgress(100);
        });

        audio.volume = volume;
        audioRef.current = audio;
    }, [volume]);

    /* ── Sync volume and mute with audio element ── */
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    /* ── Sync playback speed with audio element ── */
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    /* ── Update current line based on audio time ── */
    useEffect(() => {
        if (!hasAudio || lineTimes.length === 0) return;
        const lineIdx = lineTimes.findIndex((lt) => currentTime >= lt.start && currentTime < lt.end);
        if (lineIdx >= 0 && lineIdx !== currentLineIdx) {
            setCurrentLineIdx(lineIdx);
        }
    }, [currentTime, lineTimes, hasAudio, currentLineIdx]);

    /* ── Simulated playback fallback (no audio) ── */
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const LINE_DURATION = 3;
    const simulatedDuration = normalizedScript.length * LINE_DURATION;

    useEffect(() => {
        if (hasAudio) return; // Real audio handles its own playback

        if (isPlaying && normalizedScript.length > 0) {
            const tickMs = 100 / playbackSpeed;
            intervalRef.current = setInterval(() => {
                setProgress(prev => {
                    const next = prev + (0.1 / simulatedDuration) * 100;
                    if (next >= 100) {
                        setIsPlaying(false);
                        return 100;
                    }
                    const lineIdx = Math.min(
                        Math.floor((next / 100) * normalizedScript.length),
                        normalizedScript.length - 1
                    );
                    setCurrentLineIdx(lineIdx);
                    return next;
                });
            }, tickMs);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, playbackSpeed, normalizedScript.length, simulatedDuration, hasAudio]);

    /* ── Generate podcast ── */
    const handleGenerate = useCallback(async () => {
        const text = getNoteText();
        if (!text.trim()) {
            setError('Your note is empty. Write some content first, then generate the podcast.');
            return;
        }
        setIsGenerating(true);
        setGenerationPhase('script');
        setError(null);
        try {
            // Phase 1: Generate script
            const generated: PodcastLine[] = await generatePodcast(text);
            const normalized = normalizePodcastScript(generated);
            setScript(normalized);
            await upsertPodcastScript(noteId, normalized);

            // Phase 2: Generate audio
            setGenerationPhase('audio');
            try {
                const audioBlob = await generatePodcastAudio(normalized);
                setupAudioElement(audioBlob);
                await uploadPodcastAudio(noteId, audioBlob);
                setHasAudio(true);
            } catch (audioErr) {
                console.warn('Audio generation failed, falling back to transcript-only mode:', audioErr);
                // Don't block — the player still works without audio (simulated mode)
            }

            setView('player');
        } catch (err) {
            console.error('Podcast generation failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate podcast');
        } finally {
            setIsGenerating(false);
        }
    }, [getNoteText, noteId, setupAudioElement]);

    /* ── Player controls ── */
    const togglePlay = () => {
        if (hasAudio && audioRef.current) {
            if (audioRef.current.ended || progress >= 100) {
                audioRef.current.currentTime = 0;
                setProgress(0);
                setCurrentLineIdx(0);
            }
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        } else {
            // Simulated fallback
            if (progress >= 100) {
                setProgress(0);
                setCurrentLineIdx(0);
            }
            setIsPlaying(prev => !prev);
        }
    };

    const skipForward = () => {
        if (normalizedScript.length === 0) return;
        const nextLine = Math.min(currentLineIdx + 1, normalizedScript.length - 1);
        setCurrentLineIdx(nextLine);

        if (hasAudio && audioRef.current && lineTimes[nextLine]) {
            audioRef.current.currentTime = lineTimes[nextLine].start;
        } else {
            setProgress(normalizedScript.length > 0 ? (nextLine / normalizedScript.length) * 100 : 0);
        }
    };

    const skipBackward = () => {
        if (normalizedScript.length === 0) return;
        const prevLine = Math.max(currentLineIdx - 1, 0);
        setCurrentLineIdx(prevLine);

        if (hasAudio && audioRef.current && lineTimes[prevLine]) {
            audioRef.current.currentTime = lineTimes[prevLine].start;
        } else {
            setProgress(normalizedScript.length > 0 ? (prevLine / normalizedScript.length) * 100 : 0);
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (normalizedScript.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setProgress(pct);

        if (hasAudio && audioRef.current) {
            audioRef.current.currentTime = (pct / 100) * audioRef.current.duration;
        } else {
            const lineIdx = Math.min(
                Math.floor((pct / 100) * normalizedScript.length),
                normalizedScript.length - 1
            );
            setCurrentLineIdx(lineIdx);
        }
    };

    const cycleSpeed = () => {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const idx = speeds.indexOf(playbackSpeed);
        setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
    };

    const handleDownload = () => {
        if (!hasAudio || !audioUrlRef.current) return;
        const a = document.createElement('a');
        a.href = audioUrlRef.current;
        a.download = `${noteTitle || 'podcast'}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const displayCurrentTime = hasAudio ? currentTime : (progress / 100) * simulatedDuration;
    const displayDuration = hasAudio ? duration : simulatedDuration;
    const remainingTime = displayDuration - displayCurrentTime;

    const getSpeakerConfig = (speakerName: string) => {
        return speakerName.toLowerCase().includes('corey') ? SPEAKERS.Corey : SPEAKERS.Hope;
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
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn-emerald group relative flex w-full items-center justify-center gap-2.5 py-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isGenerating ? (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2"
                                style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--text-on-brand)' }} />
                            <span>
                                {generationPhase === 'script'
                                    ? 'Generating Script...'
                                    : '🔊 Generating Audio...'}
                            </span>
                        </>
                    ) : (
                        <>
                            <BsMic className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                            <span>Generate Podcast</span>
                        </>
                    )}
                </button>

                <p className="mt-4 text-center text-[12px] text-zinc-600">
                    AI will generate a script and then synthesize audio with natural voices.
                </p>
            </div>
        );
    }

    /* ── Player View ── */
    return (
        <div className="flex h-full flex-col">
            {/* ── Top: Podcast Player Header ── */}
            <div
                className="shrink-0 px-6 py-4"
                style={{
                    background: 'transparent',
                    borderBottom: 'none',
                }}
            >
                {/* Cover card */}
                <div
                    className="mx-auto max-w-5xl rounded-[26px] px-5 py-4"
                    style={{
                        background: 'radial-gradient(120% 150% at 8% 10%, rgba(16,185,129,0.14) 0%, rgba(5,150,105,0.1) 38%, rgba(17,18,25,0.94) 100%)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    <div className="flex items-start gap-4">
                        {/* Dual speaker avatar stack */}
                        <div className="relative mt-1 h-14 w-16 shrink-0">
                            <div
                                className="absolute left-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold text-white"
                                style={{
                                    background: SPEAKERS.Hope.avatarBg,
                                    border: '2px solid rgba(12,12,18,0.95)',
                                }}
                            >
                                {SPEAKERS.Hope.name[0]}
                            </div>
                            <div
                                className="absolute bottom-0 left-6 flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold text-white"
                                style={{
                                    background: SPEAKERS.Corey.avatarBg,
                                    border: '2px solid rgba(12,12,18,0.95)',
                                }}
                            >
                                {SPEAKERS.Corey.name[0]}
                            </div>
                        </div>

                        <div className="min-w-0 flex-1 pt-0.5">
                            <p
                                className="truncate text-base font-bold leading-tight text-zinc-100 md:text-base"
                                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                            >
                                {noteTitle || 'Study Session'}
                            </p>
                            <p className="mt-1 text-[13px] text-zinc-400">
                                <span className="mr-1">⏱</span>
                                {formatTime(displayDuration)} • {normalizedScript.length} exchanges
                                {hasAudio && <span className="ml-2 text-emerald-400">♫ Audio</span>}
                            </p>
                        </div>
                        {/* Raise Hand */}
                        <button
                            onClick={() => setShowRaiseHand(prev => !prev)}
                            className="mt-1 flex items-center gap-1.5 rounded-2xl px-4 py-2 text-[14px] font-semibold transition-all"
                            style={{
                                background: showRaiseHand ? 'rgba(43,119,232,0.26)' : 'rgba(33,89,170,0.2)',
                                border: '1px solid rgba(79,156,249,0.45)',
                                color: '#5EA9FF',
                            }}
                        >
                            <HiOutlineHand className="h-4 w-4" />
                            Raise Hand
                        </button>
                    </div>

                    {/* ── Progress Bar ── */}
                    <div className="mt-3">
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
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>{formatTime(displayCurrentTime)}</span>
                        <span>-{formatTime(remainingTime)}</span>
                    </div>
                    </div>

                    {/* ── Controls ── */}
                    <div className="mt-2 flex items-center justify-between">
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
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                        >
                            <IoPlaySkipBackSharp className="h-5 w-5" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="flex h-14 w-14 items-center justify-center rounded-full transition-all hover:scale-105"
                            style={{
                                background: '#ffffff',
                                boxShadow: '0 6px 22px rgba(255,255,255,0.2)',
                            }}
                        >
                            {isPlaying
                                ? <IoPauseSharp className="h-7 w-7 text-zinc-900" />
                                : <IoPlaySharp className="ml-0.5 h-7 w-7 text-zinc-900" />
                            }
                        </button>
                        <button
                            onClick={skipForward}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
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
                            onClick={handleDownload}
                            disabled={!hasAudio}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={hasAudio ? 'Download audio' : 'Audio not available'}
                        >
                            <BsDownload className="h-4 w-4" />
                        </button>
                    </div>
                    </div>
                </div>
            </div>

            {/* ── Transcript ── */}
            <div ref={transcriptRef} className="flex-1 overflow-y-auto px-6 py-4">
                {/* Messages */}
                <div
                    className="mx-auto max-w-5xl space-y-4 rounded-2xl p-4"
                    style={{
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(16,17,22,0.88), rgba(10,10,14,0.92))',
                    }}
                >
                    <AnimatePresence initial={false}>
                        {normalizedScript.map((line, idx) => {
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
                                        if (hasAudio && audioRef.current && lineTimes[idx]) {
                                            audioRef.current.currentTime = lineTimes[idx].start;
                                        } else {
                                            setProgress(normalizedScript.length > 0 ? (idx / normalizedScript.length) * 100 : 0);
                                        }
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
                                        Great question! This feature will be interactive soon — you'll be able to ask clarifying questions mid-podcast.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Spacer */}
                <div className="h-6" />
            </div>

        </div>
    );
};

export default PodcastPanel;
