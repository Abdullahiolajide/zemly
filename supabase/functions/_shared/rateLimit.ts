import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from './cors.ts';

const LIMITS: Record<string, number> = {
    'chat': 25,
    'generate-flashcards': 10,
    'generate-quiz': 10,
    'generate-podcast': 10,
    'generate-podcast-audio': 10,
    'extract-link': 10,
    'extract-document': 10,
    'raise-hand-response': 50,
    'speech-token': 30,
};

export async function checkRateLimit(userId: string, functionName: string, req: Request): Promise<Response | null> {
    const limit = LIMITS[functionName];
    if (!limit) return null;

    const origin = req.headers.get('Origin');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: blocked, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: userId,
        p_function_name: functionName,
        p_limit: limit,
        p_window_seconds: 3600,
    });

    if (error) {
        console.error(`Rate limit check error for ${functionName}:`, error);
        return new Response(
            JSON.stringify({ error: 'Rate limiting is temporarily unavailable' }),
            {
                status: 503,
                headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
            }
        );
    }

    if (blocked) {
        return new Response(
            JSON.stringify({ error: 'Too many requests. Please try again later' }),
            { 
                status: 429, 
                headers: { 'Content-Type': 'application/json' } 
            }
        );
    }

    return null;
}
