import "server-only";
import { createHash, randomBytes } from "node:crypto";

export class PublicRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// A small extra per-instance brake. Durable limits live in database triggers;
// this map is deliberately not advertised as a distributed rate limiter.
const salt = randomBytes(32);
const attempts = new Map<string, { count: number; expires: number }>();
export function limitPublicRequest(request: Request, scope: string) {
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    : undefined;
  if (!ip) return;
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.expires <= now) attempts.delete(key);
  const key = createHash("sha256")
    .update(salt)
    .update(scope + ip)
    .digest("hex");
  const entry = attempts.get(key) || { count: 0, expires: now + 60_000 };
  if (entry.count >= 20 || (!attempts.has(key) && attempts.size >= 10_000))
    throw new PublicRequestError(
      "Please wait a minute before trying again.",
      429,
    );
  entry.count++;
  attempts.set(key, entry);
}

export function validateFormTiming(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < 1_200 || elapsed > 86_400_000)
    throw new PublicRequestError(
      "Please take a moment to review the form, or refresh it if it has been open all day.",
    );
}

export async function readPublicJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const expected = requestUrl.origin;
  // Next can normalize request.url to localhost behind its HTTP server. The
  // actual Host is the browser request target, not an arbitrary forwarded host.
  const host = request.headers.get("host");
  const hostOrigin =
    host && /^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d+)?$/i.test(host)
      ? `${requestUrl.protocol}//${host}`
      : undefined;
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const allowed = new Set([
    expected,
    ...(hostOrigin ? [hostOrigin] : []),
    ...(configured ? [new URL(configured).origin] : []),
  ]);
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && !allowed.has(origin))
  )
    throw new PublicRequestError(
      "Please submit this form from the storefront.",
      403,
    );
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new PublicRequestError("Please submit valid form data.", 415);
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new PublicRequestError("Please shorten your submission.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PublicRequestError("Please submit valid form data.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new PublicRequestError("Please shorten your submission.", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof PublicRequestError) throw error;
    throw new PublicRequestError("Please submit valid form data.");
  } finally {
    reader.releaseLock();
  }
}
