// supabase/functions/_shared/cors.ts
// Shared CORS headers for all Edge Functions

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Handle CORS preflight request.
 * Call at the top of every function:
 *   if (req.method === 'OPTIONS') return handleCors();
 */
export function handleCors(): Response {
    return new Response('ok', { headers: corsHeaders });
}
