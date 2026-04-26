// supabase/functions/speech-token/index.ts
// Returns a short-lived Azure Speech auth token for client-side STT.
// The token lasts 10 minutes; the frontend caches and refreshes it.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    const { unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    const speechKey = Deno.env.get('AZURE_SPEECH_KEY');
    const speechRegion = Deno.env.get('AZURE_SPEECH_REGION') || 'southafricanorth';

    if (!speechKey) {
        return new Response(
            JSON.stringify({ error: 'Azure Speech key is not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    try {
        const tokenRes = await fetch(
            `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
            {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': speechKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            },
        );

        if (!tokenRes.ok) {
            const detail = await tokenRes.text().catch(() => '');
            console.error(`[speech-token] Azure STS error ${tokenRes.status}: ${detail}`);
            throw new Error(`Token request failed (${tokenRes.status})`);
        }

        const token = await tokenRes.text();

        return new Response(
            JSON.stringify({ token, region: speechRegion }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        console.error('[speech-token] Error:', err);
        return new Response(
            JSON.stringify({ error: 'Failed to generate speech token' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});
