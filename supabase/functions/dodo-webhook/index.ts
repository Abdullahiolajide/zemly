// import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// import { serveWithCors } from '../_shared/server.ts';

// type RawPayload = Record<string, unknown>;

// function asObject(value: unknown): RawPayload {
//     return value && typeof value === 'object' ? value as RawPayload : {};
// }

// function extractNestedEmail(payload: RawPayload): string | null {
//     const candidates = [
//         payload.email,
//         payload.customer_email,
//         asObject(payload.customer).email,
//         asObject(payload.data).customer_email,
//         asObject(payload.data).email,
//         asObject(asObject(payload.data).customer).email,
//         asObject(payload.subscription).customer_email,
//         asObject(asObject(payload.subscription).customer).email,
//         asObject(payload.metadata).email,
//         asObject(payload.data).metadata && asObject(asObject(payload.data).metadata).email,
//     ];

//     for (const candidate of candidates) {
//         if (typeof candidate === 'string' && candidate.includes('@')) return candidate.trim().toLowerCase();
//     }

//     return null;
// }

// function extractNestedUserId(payload: RawPayload): string | null {
//     const candidates = [
//         payload.user_id,
//         asObject(payload.metadata).user_id,
//         asObject(payload.data).user_id,
//         asObject(asObject(payload.data).metadata).user_id,
//         asObject(payload.subscription).user_id,
//     ];

//     for (const candidate of candidates) {
//         if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
//     }

//     return null;
// }

// function extractNestedStatus(payload: RawPayload): string {
//     const candidates = [
//         payload.status,
//         payload.event_status,
//         asObject(payload.subscription).status,
//         asObject(payload.data).status,
//         asObject(payload.data).subscription_status,
//     ];

//     for (const candidate of candidates) {
//         if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().toLowerCase();
//     }

//     return '';
// }

// function extractCurrentPeriodEnd(payload: RawPayload): string | null {
//     const candidates = [
//         payload.current_period_end,
//         payload.current_period_end_at,
//         asObject(payload.subscription).current_period_end,
//         asObject(payload.subscription).current_period_end_at,
//         asObject(payload.data).current_period_end,
//         asObject(payload.data).current_period_end_at,
//         asObject(payload.data).period_end,
//         asObject(payload.data).next_billing_at,
//     ];

//     for (const candidate of candidates) {
//         if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
//         if (typeof candidate === 'number' && Number.isFinite(candidate)) {
//             return new Date(candidate < 10_000_000_000 ? candidate * 1000 : candidate).toISOString();
//         }
//     }

//     return null;
// }

// function normalizeEventType(payload: RawPayload): string {
//     const raw = payload.type ?? payload.event_type ?? payload.event ?? payload.action ?? '';
//     return typeof raw === 'string' ? raw.toLowerCase() : '';
// }

// function inferTier(eventType: string, status: string): 'free' | 'premium' {
//     const activeStatuses = new Set(['active', 'trialing', 'paid', 'completed', 'succeeded']);
//     const inactiveStatuses = new Set(['canceled', 'cancelled', 'expired', 'past_due', 'failed', 'refunded', 'voided', 'inactive', 'on_hold']);

//     const activeSignals = new Set([
//         'payment.succeeded',
//         'subscription.active',
//         'subscription.updated',
//         'subscription.renewed',
//         'subscription.plan_changed',
//     ]);
//     const inactiveSignals = new Set([
//         'payment.failed',
//         'payment.cancelled',
//         'subscription.cancelled',
//         'subscription.failed',
//         'subscription.expired',
//         'subscription.on_hold',
//         'payment.processing',
//     ]);

//     if (inactiveStatuses.has(status) || inactiveSignals.has(eventType)) return 'free';
//     if (activeStatuses.has(status) || activeSignals.has(eventType)) return 'premium';

//     return status ? 'premium' : 'free';
// }

// async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
//     const secret = Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY');
//     if (!secret) {
//         throw new Error('DODO_PAYMENTS_WEBHOOK_KEY is not configured');
//     }

//     const webhookId = req.headers.get('webhook-id');
//     const webhookTimestamp = req.headers.get('webhook-timestamp');
//     const webhookSignature = req.headers.get('webhook-signature');

//     if (!webhookId || !webhookTimestamp || !webhookSignature) {
//         return false;
//     }

//     const signedMessage = `${webhookId}.${webhookTimestamp}.${rawBody}`;
//     const key = await crypto.subtle.importKey(
//         'raw',
//         new TextEncoder().encode(secret),
//         { name: 'HMAC', hash: 'SHA-256' },
//         false,
//         ['sign'],
//     );

//     const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedMessage));
//     const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

//     const providedSignatures = webhookSignature
//         .split(/\s+/)
//         .flatMap((value) => value.split(','))
//         .map((value) => value.trim())
//         .filter(Boolean)
//         .filter((value) => value !== 'v1' && value !== 'v1=' && value !== 'v1,')
//         .map((value) => value.startsWith('v1=') ? value.slice(3) : value)
//         .map((value) => value.startsWith('v1,') ? value.slice(3) : value);

//     return providedSignatures.includes(computedSignature);
// }

// serveWithCors(async (req: Request) => {
//     

//     const supabaseUrl = Deno.env.get('SUPABASE_URL');
//     const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

//     if (!supabaseUrl || !serviceRoleKey) {
//         return new Response(JSON.stringify({ error: 'Supabase service credentials are not configured' }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     }

//     const supabase = createClient(supabaseUrl, serviceRoleKey, {
//         auth: { persistSession: false, autoRefreshToken: false },
//     });

//     try {
//         const rawBody = await req.text();
//         if (!(await verifyWebhookSignature(req, rawBody))) {
//             return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
//                 status: 401,
//                 headers: { 'Content-Type': 'application/json' },
//             });
//         }

//         const payload = JSON.parse(rawBody) as RawPayload;
//         const eventType = normalizeEventType(payload);
//         const email = extractNestedEmail(payload);
//         const userId = extractNestedUserId(payload);
//         const status = extractNestedStatus(payload);
//         const tier = inferTier(eventType, status);
//         const currentPeriodEnd = extractCurrentPeriodEnd(payload);
//         const eventData = asObject(payload.data);

//         const resolvedEmail = email || (typeof eventData.email === 'string' ? eventData.email.trim().toLowerCase() : null);
//         const resolvedUserId = userId || (typeof eventData.user_id === 'string' ? eventData.user_id.trim() : null);
//         const resolvedStatus = status || (typeof eventData.status === 'string' ? eventData.status.trim().toLowerCase() : '');

//         if (!resolvedEmail) {
//             return new Response(JSON.stringify({ error: 'Webhook payload did not include a customer email' }), {
//                 status: 400,
//                 headers: { 'Content-Type': 'application/json' },
//             });
//         }

//         const row = {
//             email: resolvedEmail,
//             user_id: resolvedUserId,
//             tier,
//             status: resolvedStatus || eventType || (tier === 'premium' ? 'active' : 'inactive'),
//             current_period_end: currentPeriodEnd,
//             updated_at: new Date().toISOString(),
//         };

//         const { error } = await supabase
//             .from('user_subscriptions')
//             .upsert(row, { onConflict: 'email' });

//         if (error) {
//             throw error;
//         }

//         return new Response(JSON.stringify({ ok: true }), {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     } catch (err) {
//         console.error('dodo-webhook error:', err);
//         return new Response(JSON.stringify({ error: (err as Error).message || 'Internal server error' }), {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     }
// });


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { serveWithCors } from '../_shared/server.ts';

type RawPayload = Record<string, unknown>;

function asObject(value: unknown): RawPayload {
    return value && typeof value === 'object' ? value as RawPayload : {};
}

// ─── Signature Verification ───────────────────────────────────────────────────
// Dodo Payments uses svix for webhook delivery.
// Signed message format: "{webhook-id}.{webhook-timestamp}.{raw-body}"
// The secret is base64-encoded; we must decode it before using it as an HMAC key.
// The signature header may contain multiple space-separated "v1,<sig>" tokens.

async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
    const secret = Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY');
    if (!secret) throw new Error('DODO_PAYMENTS_WEBHOOK_KEY is not configured');

    const webhookId        = req.headers.get('webhook-id');
    const webhookTimestamp = req.headers.get('webhook-timestamp');
    const webhookSignature = req.headers.get('webhook-signature');

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
        console.error('Missing required webhook headers');
        return false;
    }

    // Reject timestamps older than 5 minutes to prevent replay attacks
    const ts = parseInt(webhookTimestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
        console.error('Webhook timestamp out of acceptable range');
        return false;
    }

    // The secret from Dodo dashboard may be prefixed with "whsec_"
    const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;

    // Decode the base64 secret into raw bytes
    const secretBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));

    const signedMessage = `${webhookId}.${webhookTimestamp}.${rawBody}`;

    const key = await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );

    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(signedMessage),
    );

    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Header format: "v1,<base64sig> v1,<base64sig2>" (space-separated, each prefixed with "v1,")
    const providedSignatures = webhookSignature
        .split(' ')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('v1,'))
        .map((s) => s.slice(3)); // strip "v1,"

    if (providedSignatures.length === 0) {
        console.error('No valid v1 signatures found in webhook-signature header');
        return false;
    }

    const isValid = providedSignatures.includes(computedSignature);
    if (!isValid) {
        console.error('Signature mismatch', { computedSignature, providedSignatures });
    }
    return isValid;
}

// ─── Payload Extractors ───────────────────────────────────────────────────────

function extractNestedEmail(payload: RawPayload): string | null {
    const candidates = [
        payload.email,
        payload.customer_email,
        asObject(payload.customer).email,
        asObject(payload.data).customer_email,
        asObject(payload.data).email,
        asObject(asObject(payload.data).customer).email,
        asObject(payload.subscription).customer_email,
        asObject(asObject(payload.subscription).customer).email,
        asObject(payload.metadata).email,
        asObject(asObject(payload.data).metadata).email,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.includes('@')) return c.trim().toLowerCase();
    }
    return null;
}

function extractNestedUserId(payload: RawPayload): string | null {
    const candidates = [
        payload.user_id,
        asObject(payload.metadata).user_id,
        asObject(payload.data).user_id,
        asObject(asObject(payload.data).metadata).user_id,
        asObject(payload.subscription).user_id,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return null;
}

function extractNestedCustomerId(payload: RawPayload): string | null {
    const candidates = [
        payload.customer_id,
        asObject(payload.customer).id,
        asObject(payload.customer).customer_id,
        asObject(payload.data).customer_id,
        asObject(asObject(payload.data).customer).id,
        asObject(asObject(payload.data).customer).customer_id,
        asObject(payload.subscription).customer_id,
        asObject(asObject(payload.subscription).customer).id,
        asObject(asObject(payload.subscription).customer).customer_id,
        asObject(payload.metadata).customer_id,
        asObject(asObject(payload.data).metadata).customer_id,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return null;
}

function extractNestedStatus(payload: RawPayload): string {
    const candidates = [
        payload.status,
        payload.event_status,
        asObject(payload.subscription).status,
        asObject(payload.data).status,
        asObject(payload.data).subscription_status,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim().toLowerCase();
    }
    return '';
}

function extractCurrentPeriodEnd(payload: RawPayload): string | null {
    const candidates = [
        payload.current_period_end,
        payload.current_period_end_at,
        payload.next_billing_date,
        payload.expires_at,
        asObject(payload.subscription).current_period_end,
        asObject(payload.subscription).current_period_end_at,
        asObject(payload.subscription).next_billing_date,
        asObject(payload.subscription).expires_at,
        asObject(payload.data).current_period_end,
        asObject(payload.data).current_period_end_at,
        asObject(payload.data).next_billing_date,
        asObject(payload.data).expires_at,
        asObject(payload.data).period_end,
        asObject(payload.data).next_billing_at,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
        if (typeof c === 'number' && Number.isFinite(c)) {
            return new Date(c < 10_000_000_000 ? c * 1000 : c).toISOString();
        }
    }
    return null;
}

function normalizeEventType(payload: RawPayload): string {
    const raw = payload.type ?? payload.event_type ?? payload.event ?? payload.action ?? '';
    return typeof raw === 'string' ? raw.toLowerCase() : '';
}

function inferTier(eventType: string, status: string): 'free' | 'premium' {
    const inactiveStatuses = new Set(['canceled', 'cancelled', 'expired', 'past_due', 'failed', 'refunded', 'voided', 'inactive', 'on_hold']);
    const activeStatuses   = new Set(['active', 'trialing', 'paid', 'completed', 'succeeded']);

    const inactiveSignals = new Set(['payment.failed', 'payment.cancelled', 'subscription.cancelled', 'subscription.failed', 'subscription.expired', 'subscription.on_hold', 'payment.processing']);
    const activeSignals   = new Set(['payment.succeeded', 'subscription.active', 'subscription.updated', 'subscription.renewed', 'subscription.plan_changed']);

    if (inactiveStatuses.has(status) || inactiveSignals.has(eventType)) return 'free';
    if (activeStatuses.has(status)   || activeSignals.has(eventType))   return 'premium';

    return status ? 'premium' : 'free';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serveWithCors(async (req: Request) => {
    

    const supabaseUrl    = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Supabase credentials not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
        const rawBody = await req.text();

        if (!(await verifyWebhookSignature(req, rawBody))) {
            return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const payload   = JSON.parse(rawBody) as RawPayload;        
        // 1. Webhook replay prevention check
        const webhookId = req.headers.get('webhook-id');
        if (webhookId) {
            const { data: existingWebhook } = await supabase
                .from('processed_webhooks')
                .select('webhook_id')
                .eq('webhook_id', webhookId)
                .maybeSingle();
                
            if (existingWebhook) {
                console.log(`Webhook ${webhookId} already processed, skipping.`);
                return new Response(JSON.stringify({ ok: true, message: 'Already processed' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }
                const eventType = normalizeEventType(payload);
        const status    = extractNestedStatus(payload);
        let tier      = inferTier(eventType, status);
        const eventData = asObject(payload.data);
        
        const currentPeriodEnd = extractCurrentPeriodEnd(payload);

        // If the subscription is canceled but the current period end is in the future,
        // they should remain on the premium tier until that date.
        if (currentPeriodEnd && new Date(currentPeriodEnd).getTime() > Date.now() && tier === 'free') {
            tier = 'premium';
        }

        const email  = extractNestedEmail(payload) ?? (typeof eventData.email === 'string' ? eventData.email.trim().toLowerCase() : null);
        const userId = extractNestedUserId(payload) ?? (typeof eventData.user_id === 'string' ? eventData.user_id.trim() : null);
        const customerId = extractNestedCustomerId(payload) ?? (typeof eventData.customer_id === 'string' ? eventData.customer_id.trim() : null);
        const resolvedStatus = status || (typeof eventData.status === 'string' ? eventData.status.trim().toLowerCase() : '');

        if (!email) {
            console.error('No email found in webhook payload', JSON.stringify(payload));
            return new Response(JSON.stringify({ error: 'Webhook payload did not include a customer email' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const row = {
            email,
            user_id: userId,
            customer_id: customerId,
            tier,
            status: resolvedStatus || eventType || (tier === 'premium' ? 'active' : 'inactive'),
            current_period_end: extractCurrentPeriodEnd(payload),
            updated_at: new Date().toISOString(),
        };

        console.log('Upserting subscription row:', JSON.stringify(row));

        const { error } = await supabase
            .from('user_subscriptions')
            .upsert(row, { onConflict: 'email' });

        if (error) throw error;
        
        // 2. Mark webhook as processed to prevent replay
        if (webhookId) {
            await supabase.from('processed_webhooks').insert({ webhook_id: webhookId });
        }

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('dodo-webhook error:', err);
        return new Response(JSON.stringify({ error: 'An error occurred. Please try again.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});