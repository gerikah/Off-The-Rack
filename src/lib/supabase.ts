import "server-only";
import type { Database } from "./database.types";
import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("The store is temporarily unavailable.");
  // Public/anon key only. All access is constrained by database permissions.
  return createClient<Database>(url, key, {
    global: {
      fetch: (url, options) =>
        fetch(url, {
          ...options,
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
