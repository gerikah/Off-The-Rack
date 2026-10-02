# Rate limiting

This project uses a layered approach to protect public-facing writes and sensitive admin actions without over-limiting normal storefront browsing.

## Current protections

### Public form writes

Public write endpoints are protected by a shared limiter in `src/lib/security/rate-limit.ts` and are wrapped by the public form helper in `src/lib/security/public-request.ts`.

- `POST /api/inquiries` — 5/minute/IP, 60-second window
- `POST /api/newsletter` — 5/minute/IP, 60-second window
- Unsubscribe requests are not globally rate-limited, but they still validate tokens and payload size to avoid abuse.

These endpoints return HTTP 429 with a standard JSON body:

```json
{
  "error": "rate_limited",
  "message": "Too many requests. Please try again shortly."
}
```

and include `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers when possible.

### Admin actions

Authenticated admin mutation actions are rate-limited by admin identity (and IP when available) to avoid brute-force or excessive mutation attempts.

- admin login: 5 failed attempts per 10 minutes per IP + email hash
- admin mutations: 60/minute/admin identity
- image upload actions: 20/minute/admin identity

This keeps normal page loads and dashboard reads unaffected while protecting sensitive writes.

### Newsletter and provider safeguards

The newsletter stack keeps its provider/database protections intact. They are stronger than the public form limiter and remain the final backstop for duplicate sends or provider abuse.

## Local development behavior

In development and local testing, requests fall back to an in-memory limiter. This is intentionally not distributed, but it is safe for local verification and keeps the app working without external infrastructure.

## Production behavior

In production, the app prefers Upstash Redis when configured.

Required environment variables:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

These values must be server-only and must not be prefixed with `NEXT_PUBLIC_`.

If the production environment is missing the Upstash variables, the app fails closed for protected write endpoints and returns a clear 429 instead of silently pretending the in-memory limiter is durable.

## Setup on Vercel

1. Create an Upstash Redis database.
2. Copy the REST URL and token from Upstash.
3. Add both values to the Vercel project environment variables.
4. Redeploy.
5. Verify the production build and test routes still respond with standard 429 behavior.

## How to tune limits

The limiter is centralized in `src/lib/security/rate-limit.ts` and accepts a `scope`, `identifier`, `limit`, and `windowSeconds`.

Examples:

- public inquiry: `scope = "public:inquiry"`, `identifier = ip`
- admin login: `scope = "admin-login"`, `identifier = ip + email hash`
- admin mutation: `scope = "admin:mutation"`, `identifier = admin user id`

This keeps rate-limits easy to audit without storing raw sensitive values.

## Files involved

- `src/lib/security/rate-limit.ts`
- `src/lib/security/public-request.ts`
- `src/app/api/inquiries/route.ts`
- `src/app/api/newsletter/route.ts`
- `src/app/admin/auth-actions.ts`
- `src/app/admin/actions.ts`
- `src/app/admin/image-actions.ts`

## Notes

Rate limiting is additive protection. It does not replace RLS, validation, storage policy enforcement, database constraints, or provider safeguards.
