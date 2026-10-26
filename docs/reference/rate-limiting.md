# Public form protection

This guide describes the protections called by the current application. The former Upstash limiter was not imported by any application entrypoint and has been removed with its unused dependencies.

## Request checks

`src/lib/security/public-request.ts` is used by the inquiry and newsletter API routes. It validates request origin, content type, payload size, and form timing. Form schemas validate fields and honeypots before persistence.

On Vercel, `limitPublicRequest` uses the platform's `x-vercel-forwarded-for` header to apply an additional per-instance limit of 20 requests per minute for each IP and form scope. The in-memory map hashes identifiers and removes expired entries. When the map reaches its capacity, new entries are rejected. Without the trusted Vercel header, this extra check is skipped.

This map is not a distributed limiter. The app does not require Upstash environment variables and does not use the old module's advertised login, mutation, or image-upload limits.

## Database safeguards

The existing SQL migrations enforce durable email and global submission quotas, validation, normalized email uniqueness, consent, and newsletter campaign/provider safeguards. They apply across server instances and direct database API calls.

- `supabase/migrations/004_newsletter.sql`: newsletter and legacy campaign quotas.
- `supabase/migrations/005_submission_security.sql`: inquiry validation and submission quotas.
- `supabase/migrations/006_loops_subscriptions.sql`: normalized subscription and reactivation behavior.

Read the current migrations and [architecture guide](architecture.md) before changing limits. Follow the documented staging rollout procedure rather than replaying the historical schema.

## Responses and verification

Public request limits and database quota errors return HTTP 429 with a user-facing `error` message. Authentication and database permissions remain enforced separately by the admin data layer and Supabase RLS.

Use `npm run test:db` for isolated database checks and `npm test` for public form/browser behavior. These tests use local fixtures; live deployment acceptance is a separate step.
