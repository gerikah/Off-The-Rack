import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Public/anon key only. All access is constrained by database permissions.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
