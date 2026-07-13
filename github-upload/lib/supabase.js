import { createClient } from '@supabase/supabase-js';

// Server-side client using the SECRET service_role key.
// This bypasses Row Level Security, so it is ONLY ever imported
// inside API routes that run on the server — never in the browser.
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init = {}) => fetch(input, { ...init, cache: 'no-store' }) } });
}
