# OFF THE RACK

**Wearable art. No repeats.** A responsive catalog for one-of-one hand-painted and customized clothing from the Philippines.

[Live storefront](https://offtherack.vercel.app/) · [Project documentation](docs/PROJECT_DOCUMENTATION.md) · [Audit](docs/AUDIT.md) · [Loops email setup](docs/LOOPS_SETUP.md)

Customers browse and send inquiries. Availability, payment and delivery are confirmed manually; there is no checkout or automatic reservation.

## Features

- Search, category/availability filters, sorting, removable filter selections, local saved pieces, share/copy links and accessible product galleries.
- Responsive editorial design, local fonts, optimized images, skeletons, subtle interactions and reduced-motion support.
- Product and custom inquiries with Loops confirmations; newsletter signup, reactivation, contact sync and a branded Loops welcome workflow.
- Supabase email/password admin login with a database allowlist; product CRUD, featured/sold/archive/restore actions, categories and inquiry statuses.
- Product image selection, preview, compression, upload, replacement, removal, cover selection, alt text and safe cleanup of managed files.
- Admin newsletter drafts, previews, recipient counts, confirmed sending, test email and resumable batches. **Email delivery requires manual provider configuration.**
- Server-rendered public routes, canonical and social metadata, branded social artwork, product/organization/website/breadcrumb structured data, sitemap and indexing controls.

## Stack and architecture

The existing application is **Next.js 16 App Router, React 19 and TypeScript**, with Supabase Auth/Postgres/Storage and Vercel. It is not a Vite SPA. Zod validates input; CSS supplies motion; sharp prepares image uploads. Playwright/axe cover browser behavior and PGlite checks PostgreSQL migration/RLS behavior in isolation.

Server components query catalog data using a stateless public Supabase client. Admin data/actions verify the user and database allowlist with a cookie-aware SSR client. Next server routes integrate Loops after Supabase saves; existing Resend admin campaigns are preserved as legacy tools. Provider credentials stay server-only. No Supabase service-role key or separate Edge Function is needed.

## Local development

Use Node.js 22+ and npm. On PowerShell, use `npm.cmd` when script execution policy blocks `npm`.

```sh
npm ci
```

Copy `.env.example` to ignored `.env.local` and set your existing project's public URL and publishable key. Use a separate staging project for write testing. Set `NEXT_PUBLIC_SITE_URL` to your canonical HTTPS production origin for deployment, or your local origin while developing. Never paste private keys into `NEXT_PUBLIC_*` values.

```sh
npm run dev
# http://localhost:3000
```

Required catalog variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback), `NEXT_PUBLIC_SITE_URL`. Optional public contact/social overrides are listed in `.env.example`.

Server email variables: `LOOPS_API_KEY`, `LOOPS_WELCOME_EVENT_NAME`, and `LOOPS_INQUIRY_TRANSACTIONAL_ID`. Optional settings are `LOOPS_NEWSLETTER_MAILING_LIST_ID`, `LOOPS_ADMIN_NOTIFICATION_TRANSACTIONAL_ID` and `ADMIN_NOTIFICATION_EMAIL`. Follow [Loops setup](docs/LOOPS_SETUP.md) to publish templates and activate the welcome workflow. Keep the legacy `NEWSLETTER_SEND_ENABLED=false` when using Loops for marketing. Values in documentation are placeholders only; existing local credentials have not been changed.

## Supabase and admin setup

This repository extends an existing connected schema. **Never replay `supabase/migrations/001_storefront.sql`, run a blind database reset, or treat the test fixture as a production schema.** The historical migration is incompatible with the current application.

1. Back up the existing database, inspect current columns/constraints/RLS with `supabase/verify-security.sql`, and use a staging clone first.
2. If not already installed, apply `002_admin_access.sql` following [admin setup](ADMIN_SETUP.md). Preserve the existing public policies and data.
3. Apply only the new files, in order: `003_product_images.sql`, `004_newsletter.sql`, `005_submission_security.sql`. They are transactional and idempotent against the documented current schema. Follow the preflight/rollout procedure in the project documentation.
4. Create a confirmed email/password user in Supabase Auth and enroll its UUID in `public.admin_users`; never assign access through editable user metadata. Sign in at `/admin/login`.
5. Migration 003 configures the public `product-images` bucket and admin Storage rules. Read [image operations](docs/PRODUCT_IMAGES.md), including private-bucket safeguards and cleanup limitations.
6. Apply `006_loops_subscriptions.sql` after 002–005, then configure Loops using [the manual guide](docs/LOOPS_SETUP.md). The migration adds consent-based reactivation and normalized email uniqueness while preserving RLS. It stops for manual review if normalized duplicates exist.

For a brand-new Supabase project, obtain a reviewed schema-only export from the existing project and its current policies first. The historic migration chain is deliberately not a bootstrap installer.

## Commands and verification

```sh
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test:db
npm test
npm run test:production
npm run build
npm run analyze:bundle
npm run start
npm run audit:secrets
npm audit
```

`npm run test:production` builds with isolated fixture values; run a normal `npm run build` before starting your actual configured application afterward.

Browser tests start a local Auth/PostgREST/Storage fixture on 4318 and Next on 3100. They override public connection values, clear the email API key and disable campaign sending, so tests do not use live customer records or send email. Chrome is the default; `PLAYWRIGHT_CHANNEL=msedge` selects installed Edge. Do not run parallel suites or another Next dev server in the same checkout. PGlite tests replay migrations twice and exercise allow/deny cases using a test-only schema; staging Supabase acceptance is still required.

`npm run assets` rebuilds existing optimized photography. `npm run assets:social` regenerates branded social artwork/app icons. Bundle analysis measures all emitted browser chunks and source maps; it is not a Web Vitals score.

## Deploy to Vercel

Import the repository with the **Next.js** preset, Node.js 22+ and build command `npm run build`. Set existing public variables and the server-only newsletter values in the appropriate Vercel environment, apply reviewed migrations to staging, and run the documented acceptance checks before production rollout. Server routes deploy with the app; there is no Edge Function to deploy. Security headers come from `next.config.ts`, and Vercel provides HTTPS/HSTS. Rebuild after changing public environment variables.

## Security and limitations

Public/publishable Supabase keys are intentional; RLS and column grants enforce access. Admin checks run on every server mutation, and new restrictive database policies also protect against older overly broad grants. Public forms have bounded input, validation, honeypots, timing checks, a per-instance request brake and durable database quotas. Supabase handles passwords and session verification. Image bytes are decoded/re-encoded and provider errors are kept out of public responses.

Saved pieces are local to a browser. Catalog filtering currently loads the complete catalog. Newsletter sending is a manually advanced queue of up to 25 recipients per action, not an unattended scheduler; uncertain older batches pause for provider reconciliation. Legacy subscribers remain preserved and require evidence-based consent verification before campaigns. Provider acceptance is not proof of inbox delivery. See the detailed documentation for CSP tradeoffs, bot protection, RLS verification, orphan cleanup and manual production checks.

## Screenshots

The existing design is preserved. Branded sharing artwork is in `public/social-sharing.jpg`. Local verification screenshots are generated under ignored `.work/storefront-audit/`; add approved, non-sensitive production screenshots here when ready. Do not commit screenshots containing customer/admin information.

See the [verification report](docs/VERIFICATION.md), [changed-file inventory](docs/CHANGED_FILES.md), and [measured bundle report](docs/BUNDLE_REPORT.json) for the implementation handoff.
