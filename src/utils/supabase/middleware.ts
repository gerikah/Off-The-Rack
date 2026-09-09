import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keep the unconfigured storefront preview available.
  if (!url || !key) return supabaseResponse;

  const responseHeaders: Record<string, string> = {};
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        const previousCookies = supabaseResponse.cookies.getAll();
        supabaseResponse = NextResponse.next({ request });
        previousCookies.forEach((cookie) =>
          supabaseResponse.cookies.set(cookie),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        // Preserve no-store headers even if the SDK writes cookies again.
        Object.assign(responseHeaders, headers);
        Object.entries(responseHeaders).forEach(([name, value]) =>
          supabaseResponse.headers.set(name, value),
        );
      },
    },
  });

  // Creating a client alone does not refresh the session.
  await supabase.auth.getClaims();

  // Return this response so refreshed cookies reach the browser.
  return supabaseResponse;
}
