import type { Database } from "@/lib/database.types";
import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { cookies } from "next/headers";

export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookieOptions: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      global: {
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            cache: "no-store",
            signal: options?.signal || AbortSignal.timeout(15000),
          }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies. The proxy refreshes
            // sessions and sends the updated cookies to the browser instead.
          }
        },
      },
    },
  );
}
