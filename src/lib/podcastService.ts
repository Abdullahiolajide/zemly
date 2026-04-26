import { supabase } from './supabaseClient';
import type { PodcastLine } from './aiService';

const PODCAST_AUDIO_BUCKET = 'documents';

export interface PodcastSessionRecord {
    note_id: number;
    script: PodcastLine[] | null;
    audio_path: string | null;
    audio_mime_type: string | null;
    updated_at?: string;
}

export interface PodcastSessionData {
    script: PodcastLine[];
    audioUrl: string | null;
}

export async function getPodcastSession(noteId: number): Promise<PodcastSessionData | null> {
    const { data, error } = await supabase
        .from('podcast_sessions')
        .select('note_id, script, audio_path, audio_mime_type, updated_at')
        .eq('note_id', noteId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as PodcastSessionRecord;
    const script = Array.isArray(row.script) ? row.script : [];

    let audioUrl: string | null = null;
    if (row.audio_path) {
    const { data: signedData } = await supabase.storage
        .from(PODCAST_AUDIO_BUCKET)
        .createSignedUrl(row.audio_path, 604800);
    audioUrl = signedData?.signedUrl ?? null;
}

    return {
        script,
        audioUrl,
    };
}

export async function upsertPodcastScript(noteId: number, script: PodcastLine[]): Promise<void> {
    const { error } = await supabase
        .from('podcast_sessions')
        .upsert(
            {
                note_id: noteId,
                script,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'note_id' },
        );

    if (error) throw error;
}

export async function uploadPodcastAudio(noteId: number, blob: Blob): Promise<string> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const userId = userData.user?.id;
    if (!userId) throw new Error('You must be logged in to save podcast audio.');

    const ext = blob.type.includes('wav') ? 'wav' : 'mp3';
    const path = `podcasts/${userId}/note-${noteId}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(PODCAST_AUDIO_BUCKET)
        .upload(path, blob, {
            cacheControl: '3600',
            contentType: blob.type || 'audio/mpeg',
            upsert: true,
        });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
        .from('podcast_sessions')
        .upsert(
            {
                note_id: noteId,
                audio_path: path,
                audio_mime_type: blob.type || 'audio/mpeg',
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'note_id' },
        );

    if (updateError) throw updateError;

    const { data: publicUrlData } = supabase.storage.from(PODCAST_AUDIO_BUCKET).getPublicUrl(path);
    return publicUrlData.publicUrl;
}
