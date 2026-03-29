import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CLEANUP_CRON_SECRET = Deno.env.get('CLEANUP_CRON_SECRET') || '';
const DOCUMENTS_BUCKET = 'documents';

function parseDocumentPathFromPublicUrl(sourceUrl: string): string | null {
    try {
        const parsed = new URL(sourceUrl);
        const marker = `/storage/v1/object/public/${DOCUMENTS_BUCKET}/`;
        const idx = parsed.pathname.indexOf(marker);
        if (idx === -1) return null;

        const encodedPath = parsed.pathname.slice(idx + marker.length);
        return decodeURIComponent(encodedPath);
    } catch {
        return null;
    }
}

function isAuthorized(req: Request): boolean {
    if (!CLEANUP_CRON_SECRET) return true;
    const provided = req.headers.get('x-cleanup-secret') || '';
    return provided === CLEANUP_CRON_SECRET;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    if (!isAuthorized(req)) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(
            JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    try {
        const body = await req.json().catch(() => ({}));
        const rawMaxAge = Number(body?.maxAgeHours ?? 24);
        const maxAgeHours = Number.isFinite(rawMaxAge)
            ? Math.max(1, Math.min(24 * 30, Math.floor(rawMaxAge)))
            : 24;
        const dryRun = Boolean(body?.dryRun);

        const cutoffMs = Date.now() - (maxAgeHours * 60 * 60 * 1000);

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        // Gather document source URLs already linked to notes so we don't delete used files.
        const referencedPaths = new Set<string>();
        const notePageSize = 1000;
        let noteFrom = 0;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from('notes')
                .select('source_url')
                .eq('source_type', 'document')
                .not('source_url', 'is', null)
                .range(noteFrom, noteFrom + notePageSize - 1);

            if (error) throw new Error(`Failed to query notes: ${error.message}`);
            if (!data || data.length === 0) break;

            for (const row of data) {
                const sourceUrl = typeof row.source_url === 'string' ? row.source_url : '';
                const path = parseDocumentPathFromPublicUrl(sourceUrl);
                if (path) referencedPaths.add(path);
            }

            if (data.length < notePageSize) break;
            noteFrom += notePageSize;
        }

        // List uploaded objects and choose orphans older than threshold.
        const orphanPaths: string[] = [];
        const listPageSize = 1000;
        let offset = 0;

        while (true) {
            const { data, error } = await supabaseAdmin.storage
                .from(DOCUMENTS_BUCKET)
                .list('', {
                    limit: listPageSize,
                    offset,
                    sortBy: { column: 'created_at', order: 'asc' },
                });

            if (error) throw new Error(`Failed to list storage objects: ${error.message}`);
            if (!data || data.length === 0) break;

            for (const object of data) {
                if (!object.name) continue;

                const created = object.created_at || object.updated_at || '';
                const createdMs = created ? new Date(created).getTime() : NaN;
                if (!Number.isFinite(createdMs) || createdMs > cutoffMs) continue;

                if (referencedPaths.has(object.name)) continue;
                orphanPaths.push(object.name);
            }

            if (data.length < listPageSize) break;
            offset += listPageSize;
        }

        let deleted = 0;
        const errors: string[] = [];

        if (!dryRun && orphanPaths.length > 0) {
            const chunkSize = 100;
            for (let i = 0; i < orphanPaths.length; i += chunkSize) {
                const chunk = orphanPaths.slice(i, i + chunkSize);
                const { error } = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove(chunk);
                if (error) {
                    errors.push(error.message);
                } else {
                    deleted += chunk.length;
                }
            }
        }

        return new Response(
            JSON.stringify({
                ok: true,
                dryRun,
                maxAgeHours,
                scannedReferencedPaths: referencedPaths.size,
                orphanCandidates: orphanPaths.length,
                deleted: dryRun ? 0 : deleted,
                errors,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const error = err as Error;
        console.error('cleanup-orphan-documents error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
