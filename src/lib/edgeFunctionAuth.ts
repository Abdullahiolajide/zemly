import { supabase } from './supabaseClient';

async function resolveAccessToken(forceRefresh = false): Promise<string | null> {
    const authResult = forceRefresh
        ? await supabase.auth.refreshSession()
        : await supabase.auth.getSession();

    return authResult.data.session?.access_token ?? null;
}

export async function getEdgeFunctionAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
    const token = await resolveAccessToken(forceRefresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
}