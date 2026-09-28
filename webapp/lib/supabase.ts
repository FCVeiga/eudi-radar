import { createClient } from '@supabase/supabase-js';

// Server-side client using the service role key — internal dashboard,
// not a public site. NEVER expose SUPABASE_SERVICE_KEY in client-side
// code, only in server components / API routes.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set as environment ' +
      'variables (in Vercel: Project Settings -> Environment Variables).'
    );
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
