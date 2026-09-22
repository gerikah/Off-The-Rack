import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { hashToken, validUnsubscribeToken } from "@/lib/newsletter/tokens";
import {
  PublicRequestError,
  readPublicJson,
} from "@/lib/security/public-request";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
// GET never mutates: mail scanners and link previews must not unsubscribe people.
export function GET() {
  return NextResponse.json(
    {
      message:
        "Use the unsubscribe confirmation page or an email client's one-click action.",
    },
    { headers },
  );
}
export async function POST(request: Request) {
  try {
    let token: unknown;
    if (
      request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    ) {
      // RFC 8058 mail-provider POST has no browser origin. Bound chunked input too.
      const reader = request.body?.getReader();
      if (!reader) throw new PublicRequestError("Invalid unsubscribe request.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 256) {
            await reader.cancel();
            throw new PublicRequestError("Invalid unsubscribe request.", 413);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      if (
        new URLSearchParams(Buffer.concat(chunks).toString("utf8")).get(
          "List-Unsubscribe",
        ) !== "One-Click"
      )
        throw new PublicRequestError("Invalid unsubscribe request.");
      token = new URL(request.url).searchParams.get("token");
    } else {
      const input = await readPublicJson(request, 256);
      token =
        typeof input === "object" && input !== null && "token" in input
          ? input.token
          : null;
    }
    if (!validUnsubscribeToken(token))
      throw new PublicRequestError(
        "This unsubscribe link is invalid. Use the link in your newsletter.",
      );
    const { error } = await getSupabase().rpc("otr_newsletter_unsubscribe", {
      token_hash_value: hashToken(token),
    });
    if (error) throw new Error("storage");
    return NextResponse.json(
      {
        message:
          "Your unsubscribe request has been processed. This address will not receive future drop-list campaigns.",
      },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PublicRequestError
            ? error.message
            : "We couldn't process your request. Please try again shortly.",
      },
      {
        status: error instanceof PublicRequestError ? error.status : 503,
        headers,
      },
    );
  }
}
