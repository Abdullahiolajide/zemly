// supabase/functions/_shared/cors.ts

const allowedOrigins = new Set([
  'https://zemly.me',
  'http://localhost:5173',
]);

export function getCorsHeaders(origin?: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : 'https://zemly.me';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function handleCors(origin?: string | null): Response {
  return new Response('ok', { headers: getCorsHeaders(origin) });
}

