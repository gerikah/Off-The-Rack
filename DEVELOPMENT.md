# OFF THE RACK — development & handoff

The storefront is a Next.js App Router application with React, TypeScript, plain CSS design tokens, self-hosted Inter and Barlow Condensed fonts, and a prepared Supabase data layer. All photographs and chrome branding come from the supplied assets.

## Run locally

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. In PowerShell environments with restricted script execution, use `npm.cmd` instead of `npm`.

```sh
npm run typecheck
npm run lint
npm run build
npm run start
npm test
```

Playwright uses installed Chrome by default. For another environment, run `npx playwright install chromium` and change the channel setting in `playwright.config.ts`, or set `PLAYWRIGHT_CHANNEL=msedge` for installed Edge. Tests intentionally run against the unconnected preview catalog. Do not point them at a live customer database.

## What is implemented

- Home: campaign hero, two reduced-motion-aware marquees, swipeable arrivals on mobile, photography-led brand story, editorial featured-works grid, custom-order tile, newsletter.
- Shop: availability and category filters, name/color/category search, price/date sorting, empty state and reset.
- Product: gallery controls, availability, price, sizing, condition, material, details, measurements, care, delivery and customization accordions, related pieces.
- Inquiry: product preselection via URL, conditional custom fields, browser and server validation, consent, pending/error/success states.
- About, Contact, custom 404 and error pages, loading state, metadata, sitemap and robots.
- Sticky navigation, native modal mobile menu with focus containment and Escape support, skip link, keyboard focus styles, responsive layouts.
- All `/admin/*` routes are reserved and return the branded not-found page. No admin dashboard or authentication UI has been built.

## Placeholder content

Prices, names, sizes, condition, material, drop dates and availability in `src/lib/catalog.ts` are demonstration content, authorized by the project owner. Product photography is supplied brand imagery. Measurements deliberately say “Confirm on inquiry” instead of inventing measurements.

The confirmed brand email, Instagram and Facebook are configured in src/lib/brand.ts and can be overridden with environment variables. Do not use the sample catalog as actual inventory without reviewing every item.

Without Supabase credentials, forms validate and return a **preview** response. They explicitly say that nothing was sent, subscribed or saved. No personal information is persisted in browser storage. Only a successful live database submission shows “INQUIRY SENT.”

## Supabase setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the project's public URL and publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` remains supported as a legacy fallback. Never use a service-role or secret key in these variables.
3. Apply `supabase/migrations/001_storefront.sql` to a fresh Supabase project.
4. Add verified categories, products and product_images. `npm run catalog:export` creates **sample-only** import SQL in `.work/seed.sample.sql` if you want to inspect the placeholder data shape. Do not import that data into a real storefront without approval.
5. Keep local public image paths, or upload photos to Supabase Storage and use public HTTPS URLs from your configured project's storage endpoint. The Next.js config allows only that project's public storage path.
6. Set `NEXT_PUBLIC_CATALOG_SOURCE=supabase` and restart/redeploy. Until this flag is set, the local catalog remains the source. Once enabled, database errors show an error state instead of silently presenting sample inventory.
7. Set verified contact variables and the production `NEXT_PUBLIC_SITE_URL`.

Cookie-aware clients live in `src/utils/supabase/client.ts` (browser) and `src/utils/supabase/server.ts` (server). Pass `await cookies()` from `next/headers` to the server helper. Next.js 16 uses `src/proxy.ts` to call the session-refresh helper in `src/utils/supabase/middleware.ts`; it validates claims and propagates refreshed cookies to both the request and response. This does not add login screens or protect routes.

The `/todos` example reads `id` and `name` from an existing `todos` table using the server client. Create that table and configure its RLS policies in Supabase before expecting results; the storefront migration does not create it. Query failures display an unavailable state. The home page continues to show the storefront.

The data service maps the products/product_images relationship to the same typed Product model used by every page. Public products include available, sold and archived pieces. Home and sitemap revalidate after 60 seconds; shop and individual product views render on request.

The schema includes categories, products, product_images, inquiries, newsletter_subscribers and a private admin_users table linked to Supabase Auth. Product updates automatically refresh updated_at.

Public visitors can only read catalog data. Customer tables have RLS enabled and no anonymous read or direct-write grants. Two narrowly scoped security-definer functions accept validated submissions. Inquiry writes are throttled to one per email per minute with a transaction lock. Client-provided inquiry status/timestamps are ignored. Newsletter submissions are idempotent and do not disclose existing addresses or silently re-subscribe unsubscribed records.

Server-side routes add schema validation, input-size limits and a honeypot. These measures are not a full anti-abuse service: add an appropriate production CAPTCHA/rate-limiting provider before opening public submissions at scale. The migration is prepared for a fresh Supabase instance; verify its permissions in a staging project before launch.

## Email and operations

Successful live inquiries are stored in Supabase. This project does not yet send notification emails, reserve inventory, collect payments or deliver newsletter campaigns. Handle inquiries through the database until the future admin is implemented. Connect a mailing provider with consent/unsubscribe handling before sending campaigns; newsletter success confirms receipt of a request, not delivery of an email.

Before launch, confirm actual inventory and pricing, measurement/care details, contact channels, delivery/payment arrangements, customer-data retention and privacy copy.

## Assets and styling

- Original assets are preserved in `assets/`.
- Optimized web assets are checked in under `public/images/`.
- `npm run assets` regenerates WebP derivatives and the favicon using Sharp.
- Fonts are bundled locally; the browser does not request Google Fonts.
- Shared components live in `src/components/`, catalog and services in `src/lib/`, routes in `src/app/`.
- Tokens and responsive styling live in `src/app/globals.css`.
- `npm run format` formats the maintained source files.

## Vercel

Import the repository into Vercel, choose the Next.js preset, and use `npm run build`. No custom output directory or SPA rewrites are needed. Configure the public environment variables in Vercel and redeploy. With no database configuration, the deployed site remains a preview with non-sending forms.

## Reference documentation

Implementation references: [Next.js App Router](https://nextjs.org/docs), [Supabase Next.js setup](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), and [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security). Current Next.js guides are also bundled in `node_modules/next/dist/docs/`.
