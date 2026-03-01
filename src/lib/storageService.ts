import { supabase } from './supabaseClient';

const BUCKET = 'note-images';

/**
 * Upload an image file to Supabase Storage and return its public URL.
 */
export async function uploadNoteImage(file: File, userId: string): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
    });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Delete an image from Supabase Storage by its public URL.
 */
export async function deleteNoteImage(publicUrl: string): Promise<void> {
    // Extract the storage path from the public URL
    // URL format: https://<project>.supabase.co/storage/v1/object/public/note-images/<path>
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) {
        console.warn('Not a Supabase storage URL, skipping delete:', publicUrl);
        return;
    }

    const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
    console.log('Deleting storage file:', path);

    const { data, error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
        console.error('Failed to delete image from storage:', error);
    } else {
        console.log('Deleted from storage:', data);
    }
}
