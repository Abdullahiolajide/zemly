// supabase/functions/create-checkout/index.ts
// Creates a Dodo Payments checkout session for the Zemly Unlimited plan.

import { serveWithCors } from '../_shared/server.ts';
import { requireAuth } from '../_shared/auth.ts';

const DODO_API_URL = 'https://live.dodopayments.com';       // live
const DODO_TEST_API_URL = 'https://test.dodopayments.com'; // test

serveWithCors(async (req: Request) => {
    // Handle CORS pre-flight

    const { unauthorized } = await requireAuth(req);
    if (unauthorized) return unauthorized;

    try {
        const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY');
        if (!DODO_API_KEY) {
            throw new Error('DODO_PAYMENTS_API_KEY is not configured');
        }

        // Determine mode from env (default to test for safety)
        const mode = Deno.env.get('DODO_PAYMENTS_MODE') || 'test';
        const baseUrl = mode === 'live' ? DODO_API_URL : DODO_TEST_API_URL;

        const body = await req.json();
        const { product_id, customer_email, customer_name, customer_id, success_url, failure_url } = body;

        if (!product_id) {
            return new Response(
                JSON.stringify({ error: 'product_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        // Build the checkout session request
        const checkoutPayload: Record<string, unknown> = {
            product_cart: [
                {
                    product_id,
                    quantity: 1,
                },
            ],
        };

        // Attach customer info if provided
        if (customer_email) {
            checkoutPayload.customer = {
                email: customer_email,
                ...(customer_name ? { name: customer_name } : {}),
            };
        }

        if (customer_id || customer_email || customer_name) {
            checkoutPayload.metadata = {
                ...(customer_id ? { user_id: customer_id } : {}),
                ...(customer_email ? { email: customer_email } : {}),
                ...(customer_name ? { name: customer_name } : {}),
            };
        }

        // Attach redirect URLs if provided
        if (success_url) checkoutPayload.return_url = success_url; // Dodo uses return_url

        const response = await fetch(`${baseUrl}/checkouts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${DODO_API_KEY}`,
            },
            body: JSON.stringify(checkoutPayload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Dodo Payments API error:', response.status, errorText);
            return new Response(
                JSON.stringify({ error: 'Failed to create checkout session', details: errorText, dodo_status: response.status }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const data = await response.json();

        return new Response(
            JSON.stringify({
                session_id: data.session_id,
                checkout_url: data.checkout_url,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        console.error('create-checkout error:', err);
        return new Response(
            JSON.stringify({ error: 'An error occurred. Please try again.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
