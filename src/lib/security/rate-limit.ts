import { createHash, randomBytes } from "node:crypto";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  reset: number;
  scope: string;
  source: "memory" | "upstash" | "blocked";
};

export type LimitRequestOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

const memorySalt = randomBytes(32);
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_PUBLIC_MESSAGE = "Too many requests. Please try again shortly.";

function hashValue(value: string) {
  return createHash("sha256").update(memorySalt).update(value).digest("hex");
}

export function getRequestIpFromHeaders(
  headers: Headers | Record<string, string | undefined>,
) {
  const source =
    headers instanceof Headers
      ? headers
      : new Headers(
          Object.entries(headers).flatMap(([key, value]) =>
            typeof value === "string"
              ? [[key, value] as [string, string]]
              : [],
          ),
        );
  const headerValue =
    source.get("x-forwarded-for") ||
    source.get("x-real-ip") ||
    source.get("cf-connecting-ip") ||
    "";
  const first = headerValue.split(",")[0]?.trim();
  if (first) return first;
  return "local-dev";
}

export function buildRateLimitHeaders({ limit, remaining, retryAfter }: Pick<RateLimitDecision, "limit" | "remaining" | "retryAfter">) {
  return {
    "Retry-After": String(Math.max(1, retryAfter)),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
  };
}

export function standardRateLimitJson() {
  return {
    error: "rate_limited",
    message: DEFAULT_PUBLIC_MESSAGE,
  } as const;
}

function applyMemoryLimit({ scope, identifier, limit, windowSeconds }: LimitRequestOptions): RateLimitDecision {
  const now = Date.now();
  const key = hashValue(`${scope}:${identifier}`);
  const bucket = memoryBuckets.get(key) ?? { count: 0, resetAt: now + windowSeconds * 1000 };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowSeconds * 1000;
  }
  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfter,
      reset: bucket.resetAt,
      scope,
      source: "memory",
    };
  }
  bucket.count += 1;
  memoryBuckets.set(key, bucket);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: 0,
    reset: bucket.resetAt,
    scope,
    source: "memory",
  };
}

async function applyUpstashLimit({ scope, identifier, limit, windowSeconds }: LimitRequestOptions): Promise<RateLimitDecision | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds}s`),
      analytics: false,
      prefix: "off-the-rack-rate-limit",
    });
    const key = hashValue(`${scope}:${identifier}`);
    const result = await limiter.limit(key);
    const retryAfter = Number.isFinite(result.reset)
      ? Math.max(1, Math.ceil((Number(result.reset) - Date.now()) / 1000))
      : 0;
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      retryAfter,
      reset: Number(result.reset) || Date.now() + windowSeconds * 1000,
      scope,
      source: "upstash",
    };
  } catch (error) {
    console.warn("ratelimit_upstash_unavailable", {
      scope,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function limitRequest({ scope, identifier, limit, windowSeconds }: LimitRequestOptions): Promise<RateLimitDecision> {
  const safeIdentifier = String(identifier || "anonymous").trim() || "anonymous";
  if (process.env.NODE_ENV === "production") {
    const distributed = await applyUpstashLimit({
      scope,
      identifier: safeIdentifier,
      limit,
      windowSeconds,
    });
    if (distributed) return distributed;
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfter: 60,
      reset: Date.now() + 60_000,
      scope,
      source: "blocked",
    };
  }
  return applyMemoryLimit({
    scope,
    identifier: safeIdentifier,
    limit,
    windowSeconds,
  });
}

export async function ensureRequestLimit(options: LimitRequestOptions) {
  const decision = await limitRequest(options);
  if (decision.allowed) return decision;
  throw new Error(
    JSON.stringify({
      error: "rate_limited",
      message: DEFAULT_PUBLIC_MESSAGE,
      retryAfter: decision.retryAfter,
    }),
  );
}

export const rateLimitMessage = DEFAULT_PUBLIC_MESSAGE;
