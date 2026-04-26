import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

const DODO_API_URL = 'https://api.dodopayments.com';
const DODO_TEST_API_URL = 'https://test.dodopayments.com';

type UserSubscriptionRow = {
    customer_id?: string | null;
    email?: string | null;
};

async function lookupSubscription(supabase: ReturnType<typeof createClient>, userId: string, email: string | null) {
    const byUserId = await supabase
        .from('user_subscriptions')
        .select('customer_id,email')
        .eq('user_id', userId)
        .maybeSingle<UserSubscriptionRow>();

    if (byUserId.error) {
        throw byUserId.error;
    }

    if (byUserId.data?.customer_id) {
        return byUserId.data;
    }

    if (!email) {
        return byUserId.data ?? null;
    }

    const byEmail = await supabase
        .from('user_subscriptions')
        .select('customer_id,email')
        .eq('email', email)
        .maybeSingle<UserSubscriptionRow>();

    if (byEmail.error) {
        throw byEmail.error;
    }

    return byEmail.data ?? byUserId.data ?? null;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return handleCors();

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { user, unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const dodoApiKey = Deno.env.get('DODO_PAYMENTS_API_KEY');
        const mode = Deno.env.get('DODO_PAYMENTS_MODE') || 'test';

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase service credentials are not configured');
        }

        if (!dodoApiKey) {
            throw new Error('DODO_PAYMENTS_API_KEY is not configured');
        }

        const authHeader = req.headers.get('Authorization') || '';
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: authHeader } },
        });

        const userId = user!.id;
        const email = user!.email?.trim().toLowerCase() || null;

        const subscription = await lookupSubscription(supabase, userId, email);

        const customerId = subscription?.customer_id?.trim();
        if (!customerId) {
            return new Response(JSON.stringify({ error: 'No Dodo customer id is available for this account.' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const baseUrl = mode === 'live' ? DODO_API_URL : DODO_TEST_API_URL;
        const response = await fetch(`${baseUrl}/customers/${encodeURIComponent(customerId)}/customer-portal/session`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${dodoApiKey}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        const rawText = await response.text();
        let payload: unknown = null;
        try {
            payload = rawText ? JSON.parse(rawText) : null;
        } catch {
            payload = rawText;
        }

        console.log('DODO PORTAL RESPONSE:', JSON.stringify(payload));

        if (!response.ok) {
            return new Response(JSON.stringify({
                error: 'Failed to create billing portal session',
                details: typeof payload === 'string' ? payload : JSON.stringify(payload),
                dodo_status: response.status,
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const portalUrl = typeof payload === 'object' && payload !== null
            ? String((payload as Record<string, unknown>).link || '')
            : '';

        if (!portalUrl) {
            return new Response(JSON.stringify({ error: 'Dodo portal session did not include a URL' }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ portal_url: portalUrl, link: portalUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('create-billing-portal error:', err);
        return new Response(JSON.stringify({ error: (err as Error).message || 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});