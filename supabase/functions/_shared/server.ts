import { getCorsHeaders, handleCors } from './cors.ts';

/**
 * A global wrapper for Supabase Edge Functions that handles CORS automatically.
 * Wrap your function logic in `serveWithCors`.
 */
export function serveWithCors(handler: (req: Request) => Promise<Response> | Response) {
    Deno.serve(async (req: Request) => {
        const origin = req.headers.get('Origin');

        // Automatically handle preflight requests globally
        if (req.method === 'OPTIONS') {
            return handleCors(origin);
        }

        try {
            // Execute the business logic
            const response = await handler(req);

            return new Response(response.body, {
                status: response.status,
                headers: {
                    ...Object.fromEntries(response.headers.entries()),
                    ...getCorsHeaders(origin),
                },
            });
                    } catch (err) {
            console.error('Unhandled Server Error:', err);
            return new Response(
                JSON.stringify({ error: 'An error occurred. Please try again.' }),
                { 
                    status: 500, 
                    headers: { 
                        ...getCorsHeaders(origin),
                        'Content-Type': 'application/json' 
                    } 
                }
            );
        }
    });
}
