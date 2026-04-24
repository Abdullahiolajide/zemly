import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { startRecognition, warmupSpeechRecognition } from '../lib/speechService';
import type { RecognitionHandle } from '../lib/speechService';
import { motion, AnimatePresence } from 'framer-motion';
import { BsMic, BsDownload } from 'react-icons/bs';
import {
    IoPlaySharp, IoPauseSharp,
    IoPlaySkipForwardSharp, IoPlaySkipBackSharp,
    IoVolumeHighOutline, IoVolumeMuteOutline,
} from 'react-icons/io5';
import { HiOutlineHand } from 'react-icons/hi';
import type { PodcastLine } from '../lib/aiService';
import { generatePodcast, generatePodcastAudio, generateRaiseHandResponseStreaming } from '../lib/aiService';
import { getPodcastSession, upsertPodcastScript, uploadPodcastAudio } from '../lib/podcastService';

/* ── Speaker config ── */
const SPEAKERS = {
    Anna: {
        name: 'Anna',
        color: '#E07070',
        avatarBg: 'linear-gradient(135deg, #D35F5F, #E07070)',
        align: 'left' as const,
    },
    Micheal: {
        name: 'Micheal',
        color: '#F5A623',
        avatarBg: 'linear-gradient(135deg, #D4912A, #F5A623)',
        align: 'right' as const,
    },
};

type PodcastView = 'loading' | 'generate' | 'player';
type PodcastMode = 'player' | 'raise-hand-greeting' | 'raise-hand-listening' | 'raise-hand-processing' | 'raise-hand-answering';
type RaiseHandTurn = { question: string; answer: string };



interface PodcastPanelProps {
    noteId: number;
    noteTitle?: string;
    getNoteText: () => string;
    isPremium?: boolean;
    onRequireUpgrade?: () => void;
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

    const knownHope = ['anna', 'hope', 'alex', 'host'];
    const knownCorey = ['micheal', 'michael', 'corey', 'sam', 'cohost', 'co-host'];

    let nextSpeaker: 'Anna' | 'Micheal' = 'Anna';

    return cleaned.map((line, idx) => {
        const key = line.speaker.toLowerCase();
        if (knownHope.some((token) => key.includes(token))) {
            nextSpeaker = 'Micheal';
            return { speaker: 'Anna', text: line.text };
        }
        if (knownCorey.some((token) => key.includes(token))) {
            nextSpeaker = 'Anna';
            return { speaker: 'Micheal', text: line.text };
        }

        const speaker = idx === 0 ? 'Anna' : nextSpeaker;
        nextSpeaker = speaker === 'Anna' ? 'Micheal' : 'Anna';
        return { speaker, text: line.text };
    });
}

const RAISE_HAND_GREETING_AUDIO_URL = '/greeting.mp3';

const PodcastPanel: React.FC<PodcastPanelProps> = ({ noteId, noteTitle, getNoteText, isPremium = true, onRequireUpgrade }) => {
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
    const [hasAudio, setHasAudio] = useState(false);
    const [mode, setMode] = useState<PodcastMode>('player');
    const [raiseHandQuestion, setRaiseHandQuestion] = useState('');
    const [raiseHandError, setRaiseHandError] = useState<string | null>(null);
    const [raiseHandStatus, setRaiseHandStatus] = useState<'idle' | 'intro' | 'connecting' | 'listening' | 'processing' | 'answering'>('idle');
    const [raiseHandTurns, setRaiseHandTurns] = useState<RaiseHandTurn[]>([]);

    const transcriptRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const transientAudioRef = useRef<HTMLAudioElement | null>(null);
    const recognitionHandleRef = useRef<RecognitionHandle | null>(null);
    const questionBufferRef = useRef('');
    const raiseHandActiveRef = useRef(false);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watchdogFiredRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const submittingRef = useRef(false);
    const raiseHandChatRef = useRef<HTMLDivElement>(null);

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

    const pauseMainPlayer = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setIsPlaying(false);
    }, []);

    const clearTransientAudio = useCallback(() => {
        if (transientAudioRef.current) {
            transientAudioRef.current.pause();
            transientAudioRef.current.src = '';
            transientAudioRef.current = null;
        }
    }, []);

    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    const clearWatchdog = useCallback(() => {
        if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
        }
    }, []);

    const playTransientAudio = useCallback(async (source: string | Blob): Promise<void> => {
        clearTransientAudio();

        const isBlob = source instanceof Blob;
        const objectUrl = isBlob ? URL.createObjectURL(source) : null;
        const audio = new Audio(isBlob ? objectUrl || '' : source);
        transientAudioRef.current = audio;

        await new Promise<void>((resolve) => {
            const finish = () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                if (transientAudioRef.current === audio) transientAudioRef.current = null;
                resolve();
            };

            audio.onended = finish;
            audio.onerror = finish;
            audio.play().catch(finish);
        });
    }, [clearTransientAudio]);

    const endRaiseHandFlow = useCallback(() => {
        raiseHandActiveRef.current = false;
        submittingRef.current = false;
        recognitionHandleRef.current?.stop();
        recognitionHandleRef.current = null;
        clearSilenceTimer();
        clearWatchdog();
        clearTransientAudio();
        // Abort any in-flight streaming request
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        questionBufferRef.current = '';
        setRaiseHandQuestion('');
        setRaiseHandError(null);
        setRaiseHandStatus('idle');
        setMode('player');
    }, [clearSilenceTimer, clearWatchdog, clearTransientAudio]);

    const startListeningForQuestion = useCallback(async () => {
        if (!raiseHandActiveRef.current) return;

        questionBufferRef.current = '';
        setRaiseHandError(null);
        setRaiseHandStatus('connecting');
        setMode('raise-hand-listening');

        try {
            const handle = await startRecognition({
                onInterim: (text: string) => {
                    if (!raiseHandActiveRef.current) return;
                    clearWatchdog(); // got speech input, cancel idle watchdog
                    questionBufferRef.current = text;
                    setRaiseHandQuestion(text);

                    // Reset silence timer — auto-submit after 2.5s of silence
                    clearSilenceTimer();
                    silenceTimerRef.current = setTimeout(() => {
                        if (!raiseHandActiveRef.current || submittingRef.current) return;
                        const q = questionBufferRef.current.trim();
                        if (q) {
                            submittingRef.current = true;
                            clearSilenceTimer();
                            clearWatchdog();
                            recognitionHandleRef.current?.stop();
                            recognitionHandleRef.current = null;
                            void submitRaiseHandQuestion(q);
                        }
                    }, 2500);
                },
                onRecognized: (text: string) => {
                    if (!raiseHandActiveRef.current) return;
                    clearWatchdog(); // got speech input, cancel idle watchdog
                    questionBufferRef.current = text;
                    setRaiseHandQuestion(text);

                    // Reset silence timer on final result too
                    clearSilenceTimer();
                    silenceTimerRef.current = setTimeout(() => {
                        if (!raiseHandActiveRef.current || submittingRef.current) return;
                        const q = questionBufferRef.current.trim();
                        if (q) {
                            submittingRef.current = true;
                            clearSilenceTimer();
                            clearWatchdog();
                            recognitionHandleRef.current?.stop();
                            recognitionHandleRef.current = null;
                            void submitRaiseHandQuestion(q);
                        }
                    }, 2500);
                },
                onError: (error: string) => {
                    if (!raiseHandActiveRef.current) return;
                    clearWatchdog();
                    const msg = error.toLowerCase();
                    if (msg.includes('microphone') || msg.includes('permission') || msg.includes('denied')) {
                        setRaiseHandError('Microphone permission is blocked. Please allow mic access.');
                        return;
                    }
                    // Transient errors — retry silently
                    setRaiseHandError(null);
                    setTimeout(() => {
                        if (raiseHandActiveRef.current) void startListeningForQuestion();
                    }, 500);
                },
                onEnd: () => {
                    clearSilenceTimer();
                    clearWatchdog();
                    recognitionHandleRef.current = null;
                    // onEnd fires after we call stop() — no action needed here
                    // because we already submitted or ended the flow before calling stop()
                },
            });

            recognitionHandleRef.current = handle;

            // Mic is now live — switch from "connecting" to "listening"
            setRaiseHandStatus('listening');

            // Start a watchdog: if no speech after 15s, close raise hand entirely
            clearWatchdog();
            watchdogFiredRef.current = false;
            watchdogTimerRef.current = setTimeout(() => {
                if (!raiseHandActiveRef.current) return;
                if (questionBufferRef.current.trim()) return; // user spoke, ignore
                console.warn('Raise hand watchdog: no input for 15s, closing raise hand');
                watchdogFiredRef.current = true;
                endRaiseHandFlow();
            }, 15000);

        } catch (err) {
            console.error('Speech recognition start failed:', err);
            recognitionHandleRef.current = null;
            clearSilenceTimer();
            clearWatchdog();
            setRaiseHandError('Unable to start microphone input. Please try again.');
            setRaiseHandStatus('idle');
        }
    }, [clearSilenceTimer, clearWatchdog, setMode]);

    const submitRaiseHandQuestion = useCallback(async (question: string) => {
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion) {
            if (raiseHandActiveRef.current) startListeningForQuestion();
            return;
        }

        setRaiseHandQuestion('');
        setRaiseHandStatus('processing');
        setMode('raise-hand-processing');
        setRaiseHandTurns((prev) => [...prev, { question: trimmedQuestion, answer: '' }]);

        // Create an AbortController for this request so we can cancel on exit
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Audio queue for streamed TTS chunks — plays them sequentially
        const audioQueue: Blob[] = [];
        let isPlayingAudio = false;
        let streamFinished = false;
        let firstChunkPlayed = false;

        const playNextChunk = async (): Promise<void> => {
            if (isPlayingAudio || !raiseHandActiveRef.current) return;
            const blob = audioQueue.shift();
            if (!blob) {
                // Queue empty — if stream is done, resume listening
                if (streamFinished && raiseHandActiveRef.current) {
                    setRaiseHandQuestion('');
                    startListeningForQuestion();
                }
                return;
            }
            isPlayingAudio = true;
            if (!firstChunkPlayed) {
                firstChunkPlayed = true;
                setRaiseHandStatus('answering');
                setMode('raise-hand-answering');
            }
            try {
                await playTransientAudio(blob);
            } catch { /* ignore playback errors */ }
            isPlayingAudio = false;
            if (raiseHandActiveRef.current) {
                void playNextChunk();
            }
        };

        try {
            const noteText = getNoteText();
            await generateRaiseHandResponseStreaming(
                noteText,
                trimmedQuestion,
                {
                    onTextChunk: (text: string) => {
                        setRaiseHandTurns((prev) => {
                            const updated = [...prev];
                            for (let i = updated.length - 1; i >= 0; i -= 1) {
                                if (updated[i].question === trimmedQuestion) {
                                    const cur = updated[i].answer;
                                    updated[i] = { ...updated[i], answer: cur ? cur + ' ' + text : text };
                                    break;
                                }
                            }
                            return updated;
                        });
                    },
                    onAudioChunk: (blob: Blob) => {
                        audioQueue.push(blob);
                        void playNextChunk();
                    },
                    onDone: (fullReply: string) => {
                        // Replace accumulated text with the authoritative full reply
                        setRaiseHandTurns((prev) => {
                            const updated = [...prev];
                            for (let i = updated.length - 1; i >= 0; i -= 1) {
                                if (updated[i].question === trimmedQuestion) {
                                    updated[i] = { ...updated[i], answer: fullReply };
                                    break;
                                }
                            }
                            return updated;
                        });
                        streamFinished = true;
                        // If all audio already played, resume listening immediately
                        if (!isPlayingAudio && audioQueue.length === 0 && raiseHandActiveRef.current) {
                            setRaiseHandQuestion('');
                            startListeningForQuestion();
                        }
                    },
                },
                {
                    noteTitle,
                    podcastScript: normalizedScript,
                    currentLineIndex: currentLineIdx,
                    conversationHistory: raiseHandTurns.filter((turn) => turn.answer.trim().length > 0),
                    signal: controller.signal,
                },
            );
        } catch (err) {
            // Ignore abort errors — they're expected when user exits
            if (err instanceof DOMException && err.name === 'AbortError') return;
            console.error('Raise hand response failed:', err);
            setRaiseHandError(err instanceof Error ? err.message : 'Failed to answer your question');
            if (raiseHandActiveRef.current) {
                setRaiseHandStatus('idle');
                setMode('raise-hand-listening');
                setTimeout(() => {
                    if (raiseHandActiveRef.current) startListeningForQuestion();
                }, 550);
            }
        } finally {
            submittingRef.current = false;
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }, [currentLineIdx, getNoteText, normalizedScript, noteTitle, playTransientAudio, raiseHandTurns, startListeningForQuestion]);

    const beginRaiseHandFlow = useCallback(async () => {
        if (!isPremium) {
            onRequireUpgrade?.();
            return;
        }

        raiseHandActiveRef.current = true;
        pauseMainPlayer();
        setRaiseHandError(null);
        setRaiseHandQuestion('');
        setRaiseHandTurns([]);
        questionBufferRef.current = '';

        // Pre-load Azure Speech SDK + token
        await warmupSpeechRecognition();

        // Start mic & connect fully first
        await startListeningForQuestion();

        if (RAISE_HAND_GREETING_AUDIO_URL) {
            setRaiseHandStatus('intro');
            setMode('raise-hand-greeting');
            try {
                await playTransientAudio(RAISE_HAND_GREETING_AUDIO_URL);
            } catch (err) {
                console.warn('Greeting audio failed, falling back to mic input:', err);
            }
        }

        // Restore listening display if still active
        if (raiseHandActiveRef.current && !submittingRef.current) {
            setRaiseHandStatus('listening');
            setMode('raise-hand-listening');
        }
    }, [isPremium, onRequireUpgrade, pauseMainPlayer, playTransientAudio, startListeningForQuestion]);

    /* ── Cleanup audio URL on unmount ── */
    useEffect(() => {
        return () => {
            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = null;
            }
            recognitionHandleRef.current?.stop();
            recognitionHandleRef.current = null;
            clearSilenceTimer();
            clearWatchdog();
            clearTransientAudio();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setIsPlaying(false);
        };
    }, [clearSilenceTimer, clearWatchdog, clearTransientAudio]);

    /* ── Stop audio when tab loses focus ── */
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                audioRef.current?.pause();
                setIsPlaying(false);
                recognitionHandleRef.current?.stop();
                recognitionHandleRef.current = null;
                clearSilenceTimer();
                clearWatchdog();
                clearTransientAudio();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [clearSilenceTimer, clearWatchdog, clearTransientAudio]);

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

    /* ── Auto-scroll raise-hand chat ── */
    useEffect(() => {
        if (!raiseHandChatRef.current) return;
        requestAnimationFrame(() => {
            raiseHandChatRef.current?.scrollTo({
                top: raiseHandChatRef.current.scrollHeight,
                behavior: 'smooth',
            });
        });
    }, [raiseHandTurns, raiseHandStatus, raiseHandQuestion]);

    /* ── Setup audio element from blob ── */
    const setupAudioElement = useCallback((blob: Blob) => {
        // Stop and clean up previous audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }

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
                        // Schedule the stop outside of the state updater to avoid
                        // cascading re-renders that cause "Maximum update depth exceeded"
                        queueMicrotask(() => setIsPlaying(false));
                        return 100;
                    }
                    const lineIdx = Math.min(
                        Math.floor((next / 100) * normalizedScript.length),
                        normalizedScript.length - 1
                    );
                    queueMicrotask(() => setCurrentLineIdx(lineIdx));
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
        return speakerName.toLowerCase().includes('micheal') ? SPEAKERS.Micheal : SPEAKERS.Anna;
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
            <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-12 lg:px-16">
                <div className="mb-8 text-center sm:mb-10">
                    <h2
                        className="mb-2 text-2xl font-bold text-zinc-100 sm:mb-3 sm:text-3xl"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                    >
                        🎙️ Generate Podcast
                    </h2>
                    <p className="text-[13px] text-zinc-500 sm:text-[15px]">
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
            <AnimatePresence mode="wait" initial={false}>
                {mode === 'player' ? (
                    <motion.div
                        key="player-mode"
                        className="flex h-full flex-col"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                        <motion.div
                            className="shrink-0 px-3 py-3 sm:px-6 sm:py-4"
                            style={{
                                background: 'transparent',
                                borderBottom: 'none',
                            }}
                            initial={{ opacity: 0, y: -40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
                        >
                            <div
                                className="mx-auto max-w-5xl rounded-[26px] px-5 py-4"
                                style={{
                                    background: 'var(--podcast-card-bg)',
                                    border: '1px solid var(--podcast-card-border)',
                                    backdropFilter: 'blur(12px)',
                                }}
                            >
                                <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                                    <div className="relative mt-1 h-14 w-16 shrink-0">
                                        <div
                                            className="absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white sm:h-11 sm:w-11 sm:text-[13px]"
                                            style={{
                                                background: SPEAKERS.Anna.avatarBg,
                                                border: '2px solid var(--podcast-avatar-ring)',
                                            }}
                                        >
                                            {SPEAKERS.Anna.name[0]}
                                        </div>
                                        <div
                                            className="absolute bottom-0 left-5 flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white sm:left-6 sm:h-11 sm:w-11 sm:text-[13px]"
                                            style={{
                                                background: SPEAKERS.Micheal.avatarBg,
                                                border: '2px solid var(--podcast-avatar-ring)',
                                            }}
                                        >
                                            {SPEAKERS.Micheal.name[0]}
                                        </div>
                                    </div>

                                    <div className="min-w-0 flex-1 pt-0.5">
                                        <p
                                            className="truncate text-sm font-bold leading-tight text-zinc-100 sm:text-base"
                                            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                                        >
                                            {noteTitle || 'Study Session'}
                                        </p>
                                        <p className="mt-1 text-[12px] text-zinc-400 sm:text-[13px]">
                                            <span className="mr-1">⏱</span>
                                            {formatTime(displayDuration)} • {normalizedScript.length} exchanges
                                            {hasAudio && <span className="ml-2 text-emerald-400">♫ Audio</span>}
                                        </p>
                                    </div>

                                    <button
                                        onClick={beginRaiseHandFlow}
                                        className="flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 text-[12px] font-semibold transition-all sm:mt-1 sm:px-4 sm:py-2 sm:text-[14px]"
                                        style={{
                                            background: isPremium ? 'rgba(33,89,170,0.2)' : 'rgba(245,166,35,0.16)',
                                            border: `1px solid ${isPremium ? 'rgba(79,156,249,0.45)' : 'rgba(245,166,35,0.35)'}`,
                                            color: isPremium ? '#5EA9FF' : '#F5A623',
                                        }}
                                    >
                                        <HiOutlineHand className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        Raise Hand
                                    </button>
                                </div>

                                <div className="mt-3">
                                    <div
                                        className="group relative h-1.5 cursor-pointer rounded-full"
                                        style={{ background: 'var(--podcast-progress-track)' }}
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
                                        <div
                                            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
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

                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
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
                                            style={{ background: `linear-gradient(to right, #a1a1aa ${(isMuted ? 0 : volume) * 100}%, var(--podcast-volume-track-inactive) ${(isMuted ? 0 : volume) * 100}%)` }}
                                        />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={skipBackward}
                                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-200"
                                            style={{ background: 'transparent' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
                                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-200"
                                            style={{ background: 'transparent' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <IoPlaySkipForwardSharp className="h-5 w-5" />
                                        </button>
                                    </div>

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
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
                                            title={hasAudio ? 'Download audio' : 'Audio not available'}
                                        >
                                            <BsDownload className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            ref={transcriptRef}
                            className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4"
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
                        >
                            <div
                                className="mx-auto max-w-5xl space-y-4 rounded-2xl p-4"
                                style={{
                                    border: '1px solid var(--podcast-transcript-border)',
                                    background: 'var(--podcast-transcript-bg)',
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

                                                <div className={`max-w-[85%] ${isRight ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                                    <span className="text-[11px] font-semibold" style={{ color: speaker.color }}>
                                                        {speaker.name}
                                                    </span>
                                                    <div
                                                        className="cursor-pointer rounded-2xl px-4 py-3 transition-all"
                                                        style={{
                                                            background: isActive
                                                                ? `rgba(${isRight ? '245,166,35' : '224,112,112'},0.1)`
                                                                : 'var(--podcast-bubble-bg)',
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
                                                        <p
                                                            className={`text-[14px] leading-relaxed`}
                                                            style={{ transition: 'color 0.3s ease', color: isActive ? 'var(--podcast-bubble-text-active)' : 'var(--podcast-bubble-text)' }}
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

                            <div className="h-6" />
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="raise-hand-mode"
                        className="flex h-full flex-col px-6 py-4"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                    >
                        <div
                            className="mx-auto flex h-full w-full max-w-5xl flex-col rounded-[28px] px-5 py-5"
                            style={{
                                background: 'var(--podcast-raise-bg)',
                                border: '1px solid var(--podcast-raise-border)',
                                backdropFilter: 'blur(12px)',
                            }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[18px] font-black text-zinc-950 shadow-[0_0_24px_rgba(255,255,255,0.18)]">
                                        Z
                                    </div>
                                    <div>
                                        <p className="text-[16px] font-bold text-zinc-100" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                                            Raise Hand
                                        </p>
                                        <p className="text-[13px] text-zinc-400">
                                            {raiseHandStatus === 'intro' && 'Playing your greeting...'}
                                            {raiseHandStatus === 'connecting' && 'Starting microphone...'}
                                            {raiseHandStatus === 'listening' && 'Listening for your question...'}
                                            {raiseHandStatus === 'processing' && 'Thinking and preparing an answer...'}
                                            {raiseHandStatus === 'answering' && 'Speaking the answer now...'}
                                            {raiseHandStatus === 'idle' && 'Ready when you are.'}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={endRaiseHandFlow}
                                    className="rounded-full px-4 py-2 text-[13px] font-semibold text-zinc-200 transition-colors"
                                    style={{ border: '1px solid var(--border-glass)', background: 'var(--podcast-bubble-bg)' }}
                                >
                                    Back to podcast
                                </button>
                            </div>

                            <div ref={raiseHandChatRef} className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto rounded-[24px] p-4" style={{ border: '1px solid var(--podcast-transcript-border)', background: 'var(--podcast-bubble-bg)' }}>
                                {raiseHandError && (
                                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
                                        {raiseHandError}
                                    </div>
                                )}

                                {raiseHandTurns.length > 0 && (
                                    <div className="space-y-3">
                                        {raiseHandTurns.map((turn, idx) => (
                                            <div key={`${turn.question}-${idx}`} className="space-y-2">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4F9CF9] text-[12px] font-bold text-white">
                                                        You
                                                    </div>
                                                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#4F9CF9]/20 bg-[#4F9CF9]/10 px-4 py-3">
                                                        <p className="text-[11px] font-semibold text-blue-300">Your question</p>
                                                        <p className="mt-1 text-[14px] leading-relaxed text-zinc-200">
                                                            {turn.question}
                                                        </p>
                                                    </div>
                                                </div>

                                                {turn.answer && (
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-zinc-950">
                                                            Z
                                                        </div>
                                                        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/6 px-4 py-3">
                                                            <p className="text-[11px] font-semibold text-zinc-300">Zemly AI</p>
                                                            <p className="mt-1 text-[14px] leading-relaxed text-zinc-200">
                                                                {turn.answer}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(raiseHandStatus === 'listening' || raiseHandStatus === 'connecting') && raiseHandQuestion && raiseHandQuestion !== (raiseHandTurns[raiseHandTurns.length - 1]?.question || '') && (
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4F9CF9] text-[12px] font-bold text-white">
                                            You
                                        </div>
                                        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#4F9CF9]/20 bg-[#4F9CF9]/10 px-4 py-3">
                                            <p className="text-[11px] font-semibold text-blue-300">Listening...</p>
                                            <p className="mt-1 text-[14px] leading-relaxed text-zinc-200">
                                                {raiseHandQuestion}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {raiseHandTurns.length === 0 && !raiseHandQuestion && (
                                    <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center text-center">
                                        {raiseHandStatus === 'connecting' ? (
                                            <>
                                                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full" style={{ border: '1px solid var(--border-glass)', background: 'rgba(79,156,249,0.08)' }}>
                                                    <div className="h-8 w-8 animate-spin rounded-full border-[3px]" style={{ borderColor: 'rgba(79,156,249,0.15)', borderTopColor: '#4F9CF9' }} />
                                                </div>
                                                <p className="text-[16px] font-bold text-zinc-100">Starting microphone…</p>
                                                <p className="mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500">
                                                    Connecting to speech service. Hold on a moment.
                                                </p>
                                            </>
                                        ) : raiseHandStatus === 'listening' ? (
                                            <>
                                                <div className="mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-[#4F9CF9]/20" style={{ border: '1px solid rgba(79,156,249,0.3)' }}>
                                                    <span className="text-[22px]">🎤</span>
                                                </div>
                                                <p className="text-[15px] font-semibold text-zinc-100">Listening for your question…</p>
                                                <p className="mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500">
                                                    Speak clearly. The mic will auto-submit after a short pause.
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ border: '1px solid var(--border-glass)', background: 'var(--podcast-bubble-bg)' }}>
                                                    <span className="text-[22px]">🎤</span>
                                                </div>
                                                <p className="text-[15px] font-semibold text-zinc-100">{raiseHandStatus === 'intro' ? 'Please wait...' : 'Tap back to cancel or wait for the greeting.'}</p>
                                                <p className="mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500">
                                                    The player will switch into question mode, then return here once the answer is finished.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {raiseHandStatus === 'processing' && (
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-zinc-950">
                                            Z
                                        </div>
                                        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/6 px-4 py-3">
                                            <p className="text-[11px] font-semibold text-zinc-300">Zemly AI</p>
                                            <div className="mt-2 flex items-center gap-[5px]">
                                                <div className="typing-dot" />
                                                <div className="typing-dot" />
                                                <div className="typing-dot" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Listening wave animation ── */}
                                <div className="mt-auto flex flex-col items-center gap-2 pt-4 pb-1">
                                    <div className="flex items-end justify-center gap-[3px]">
                                        {[0, 1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className={`raise-hand-wave-bar ${
                                                    raiseHandStatus !== 'listening'
                                                        ? 'raise-hand-wave-bar--paused'
                                                        : ''
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[11px] font-medium text-zinc-500">
                                        {raiseHandStatus === 'connecting' && 'Starting microphone…'}
                                        {raiseHandStatus === 'listening' && 'Listening…'}
                                        {raiseHandStatus === 'processing' && 'Processing…'}
                                        {raiseHandStatus === 'answering' && 'Speaking…'}
                                        {raiseHandStatus === 'intro' && 'Starting…'}
                                        {raiseHandStatus === 'idle' && 'Waiting…'}
                                    </p>
                                </div>

                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PodcastPanel;
