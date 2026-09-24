# Off The Rack project documentation

Email update: [Loops setup](LOOPS_SETUP.md) documents the primary contact platform, marketing welcome workflow, transactional inquiry confirmations, migration 006, and subscriber reactivation. Existing Resend admin campaigns remain as legacy tools and should stay disabled while Loops owns marketing. The campaign/batch details below describe those legacy tools.

## Application and route map

This extends the existing Next.js App Router application. Supabase is the sole catalog source. There is no checkout, payment gateway, shopping bag, reservation or customer account requirement. The implementation preserves the dark editorial design, typography, colors, photography and responsive layout.

| Route                                                                 | Purpose / authorization                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/`                                                                   | Server-rendered brand, new arrivals and selected work                        |
| `/shop`                                                               | Search, category/status filters, price/date sorting and locally saved pieces |
| `/archive`                                                            | Public sold/archived work; archival status is not a privacy control          |
| `/product/[slug]`                                                     | Gallery, details, availability, share/save and linked inquiry                |
| `/about`, `/contact`                                                  | Brand story and public contact channels                                      |
| `/inquiry?product=[slug]`, `/inquiry?type=custom`                     | Product/custom/general inquiry; noindex                                      |
| `/unsubscribe`                                                        | Token confirmation; noindex, no GET mutation                                 |
| `/admin/login`                                                        | Supabase email/password sign-in                                              |
| `/admin`                                                              | Authenticated allowlisted dashboard                                          |
| `/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit` | Inventory, status, featured flag and images                                  |
| `/admin/categories`                                                   | Category create/edit/delete with reference warning                           |
| `/admin/inquiries`, `/admin/inquiries/[id]`                           | Review/search inquiries and update status                                    |
| `/admin/newsletter`                                                   | Drafts, counts, previews, test, confirmed send and resume                    |
| `/api/inquiries`, `/api/newsletter`                                   | Bounded public JSON submissions                                              |
| `/api/admin/newsletter`                                               | Verified admin dashboard and newsletter actions                              |
| `/api/newsletter/unsubscribe`                                         | Token-based POST; supports RFC 8058 one-click POST                           |
| `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/llms.txt`   | Public discovery/app metadata                                                |
| Unknown routes                                                        | Existing branded 404 with noindex                                            |

Public server components call `src/lib/data/*`; the stateless server-only client uses a publishable key under public RLS. Cookie-aware clients in `src/utils/supabase` serve admin authentication. Server Actions and newsletter API calls independently recheck `auth.getUser()` and `otr_is_admin()`. The session proxy refreshes Supabase cookies. React caching only deduplicates within a request; catalog fetches are no-store so inventory changes appear on the next request. Next already performs route splitting; no framework migration or animation library was added.

## Customer inquiry flow

An available product links to `/inquiry?product=slug`. URL slugs are validated before lookup. A resolved product controls the submitted UUID; custom and general inquiries clear unrelated fields. The form validates length/email/URL/consent, includes a honeypot and start time, prevents duplicate clicks, and focuses its success heading. The server validates again, checks available product references, bounds the actual streamed body and allowlists inserted fields. It never returns inquiry rows.

Migration 005 independently validates direct database inserts, resets status and timestamps, clears irrelevant fields, records current contact-consent evidence and atomically enforces quotas. Limits are one per normalized email per minute, ten per email per day, thirty inquiries globally per minute and one thousand per day. Existing records are not rewritten; newly added consent fields remain null for historical inquiries. These are abuse safeguards, not proof of a visitor's identity. The UI confirmation means the inquiry was stored, not that a purchase or reservation exists. Staff review and reply manually.

## Product lifecycle and admin workflows

Statuses are `available`, `sold`, `archived`. Available products accept product inquiries. Sold and archived pieces remain publicly visible as previous work. Staff can mark available pieces sold/archive, restore sold pieces to available or archive, and restore archived pieces to available. Featured and bestseller are independent booleans; the existing homepage selected-work query uses bestseller. Featured can be toggled in the list without reinterpreting the existing homepage.

New products save their details first and redirect to the edit page for images. Subsequent detail edits return to the product list. Image changes save independently and say when they are pending/saved. Deletion is confirmed and the database prevents deleting products with inquiry history; archive them instead. Category deletion warns that products may become uncategorized under the existing relationship. Inquiry states are `new`, `read`, `replied`, `resolved`; viewing a record alone does not change state. Status actions do not send replies automatically.

## Tables and relationships

| Table                           | Important fields and relationships                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `categories`                    | UUID, name/unique slug, description, created/updated timestamps                                                                  |
| `products`                      | UUID/slug, content, PHP price, category_id FK, size/material/care fields, status, featured/bestseller, timestamps                |
| `product_images`                | Product FK, image_url, storage_path, alt_text, sort_order, is_primary; product deletion cascades image rows                      |
| `inquiries`                     | Customer contact, inquiry_type, optional product FK, custom fields, message, status, timestamps; new nullable consent_at/version |
| `newsletter_subscribers`        | Email, is_active, created_at; consent_at/source/verification and unsubscribe timestamps added                                    |
| `admin_users`                   | Auth user UUID allowlist; no client self-enrollment                                                                              |
| `product_image_cleanup`         | Managed storage path, queued/completed timestamps; permanent tombstone prevents stale reattachment                               |
| `newsletter_campaigns`          | Validated plain-text subject/body, draft/sending/sent/paused state, counts and timestamps, creator                               |
| `newsletter_batches`            | Bounded claimed batch, request fingerprint, lease/retry times and state                                                          |
| `newsletter_deliveries`         | Campaign/subscriber unique pair, queue state, batch, provider ID and accepted timestamp                                          |
| `newsletter_unsubscribe_tokens` | SHA-256 token hash and subscriber FK; no raw bearer tokens                                                                       |
| `newsletter_rate_limits`        | Small server-owned shared send/test quota records                                                                                |

The TypeScript schema is maintained in `src/lib/types.ts` and `src/lib/database.types.ts`. The original connected SQL schema is not fully reproducible from this repository. Confirm actual production constraints with the read-only security inspection and a schema export; replace hand-maintained types with reviewed generated types when connecting a CLI workflow. `tests/fixtures/database.sql` is only for isolated tests and deliberately includes permissive policies to verify the new restrictive guards.

## Migrations and rollout

1. Back up the existing project, export schema/policies and record current table counts. Run `supabase/verify-security.sql` in the Dashboard SQL Editor. Do not copy subscriber lists into logs or tickets.
2. Use a staging clone of the actual current schema. Do not run historical `001_storefront.sql`, `supabase db reset`, or blindly push this entire historical directory. If 002 is already installed, preserve it; otherwise follow `ADMIN_SETUP.md` first.
3. Run complete new transactional files in order: **003_product_images**, **004_newsletter**, **005_submission_security**. Replay each once in staging to verify idempotence. Existing products, categories, subscribers, inquiry history, admin memberships and historical policy definitions are retained.
4. 003 reuses image columns, configures only product-images, adds storage policies, image RPCs and a cleanup queue. Stop and inspect if it detects a nonempty private bucket; never publish private files as a workaround.
5. 004 requires the current `is_active` subscriber schema, adds nullable consent history and campaign/queue/token records. Case-normalized duplicate guards preserve existing rows and deduplicate recipients; inactive records never silently resubscribe. Legacy signup RPC access, if present, is retired because current code uses guarded inserts.
6. 005 adds inquiry validation/quotas and consent fields, narrows insertion columns, enables RLS and adds restrictive policies that AND with existing policies. Public catalog reads remain; ordinary accounts cannot change catalog data or read customer records. Known old policies are not blindly dropped.
7. Deploy to staging with the correct public configuration; run admin/product/image/newsletter acceptance below. Only then apply the reviewed new files to production and deploy the app. No migration has been applied to live Supabase by this work.

A code rollback can leave additive database objects in place. Do not drop new tables or erase consent/unsubscribe records to roll back. Keep email campaigns disabled during a rollback and preserve cleanup tombstones. Old public forms must be updated alongside the new consent/timing contract. A new Supabase project needs a reviewed export of the existing baseline, not 001 or the test fixture.

## RLS, grants and authorization

The publishable key is designed for public client use. It has no privileged service-role capabilities. Public users read catalog rows, submit bounded inquiries/signups, and invoke token-based unsubscribe. A public Storage URL can be fetched by anyone who knows it; product photos including sold/archived photos are intentional public assets. Authenticated non-admins acquire no catalog-write or subscriber-read privilege. Both authenticated admin checks and database enforcement are necessary.

The allowlist helper has an empty search_path, postgres owner and no caller-supplied identity. New internal email tables have RLS enabled and no direct browser table grants; narrow security-definer RPCs check current admin membership. Cleanup claims and image mutation RPCs check admin membership. Client fields cannot set inquiry timestamps or consent evidence; products/categories use explicit parsed field maps. Existing public policies are preserved, supplemented by named restrictive guards to prevent old permissive policies from overriding the intended authorization.

Run `npm run test:db` for isolated PostgreSQL checks, then inspect/run staging tests with actual Supabase. Live read-only probes observed zero visible anonymous inquiry/subscriber rows and allowlist denial, but an empty result alone cannot prove every deployed policy is correct. Other existing Storage buckets must be reviewed individually; migration 003 intentionally leaves them untouched.

## Product images

See [Product image operations](PRODUCT_IMAGES.md) for complete setup, workflow and recovery. Source files may be JPEG, PNG, WebP or AVIF up to 5 MB. The client checks signatures, decodes and prepares a WebP below 3 MB and at most 2400px; the server independently validates MIME/signature, bounds decoding to 40 megapixels and re-encodes. Original names are discarded in favor of `products/{product-uuid}/{random-uuid}.webp`; EXIF/GPS metadata is stripped. Alt text is required. Up to twelve images are supported.

Replacement never overwrites the old URL. Database reference guards and a cleanup queue preserve shared objects and prevent reattaching claimed objects. Failed removals retry from the admin list, in bounded groups. Legacy local/external/unrecognized files are deliberately kept. An interrupted upload before database attachment may leave an object outside the queue; periodically review older unreferenced generated objects and remove them through the Storage API only after checking all references. Authorized admins are trusted; a deliberately modified admin Storage client can bypass this app's decoder, although bucket size/MIME/RLS restrictions remain.

## Newsletter architecture and manual setup

[NEWSLETTER_SETUP.md](NEWSLETTER_SETUP.md) contains the exact provider account, sender/domain verification, API-key creation, Vercel secret configuration, testing, unsubscribe and production rollout instructions. This implementation uses **Next server routes on Vercel**, so it needs no Supabase Edge Function deployment or Supabase service-role key. Resend was chosen because the repository had no existing mail provider. Provider-specific delivery code is contained in `src/lib/newsletter/server.ts`.

New signups explicitly consent. Migration 006 returns a distinct already-subscribed status and reactivates inactive recipients on fresh form consent, preserving their IDs and creation timestamps. Existing legacy records remain intact and require verified signup evidence before inclusion in legacy campaigns. See the Loops guide for the current subscription lifecycle and limitations.

Campaigns are saved immutable drafts, previewed, optionally tested to the verified admin email and confirmed with the current eligible count. Each send action claims at most 25 recipients under a database lease. Every message has exactly one `to` address, escaped plain-text content, a postal footer and unsubscribe links. Database unique campaign/subscriber pairs and provider idempotency keys prevent ordinary duplicate requests. A stored payload fingerprint protects retries from content/config changes. Provider idempotency lasts only 24 hours; the app pauses uncertain batches after 23 hours for manual reconciliation, rather than guessing whether to resend. A provider accepted count is not an inbox delivery count.

Tokens use a strong server-secret HMAC and only hashes are persisted. The normal footer uses a URL fragment, removed from browser history before submission; GET does not unsubscribe. RFC 8058 one-click uses a POST bearer URL, so review hosting/proxy log retention/redaction and keep URLs out of analytics. App logs never contain keys, tokens or recipient lists. Do not rotate the unsubscribe secret during in-flight batches without reconciliation; back it up securely. Bounces/complaints and suppression are managed in the provider; automated delivery webhook tracking/double opt-in are possible future improvements.

## Environment and secrets

`.env.local` is ignored, unchanged and currently contains only the existing public Supabase connection. `.env.example` contains names/placeholders, never credentials. Configure per-environment values in Vercel. Public build variables are embedded at build time. Provider API key and unsubscribe secret must have no `NEXT_PUBLIC_` prefix. The unsubscribe secret should be at least 32 random bytes encoded as base64url; generate it locally and paste it directly into Vercel, not a commit or chat log.

The tracked-file and seven-commit pattern scan found no recognized privileged secret. Public Supabase keys are not secret exposures. This is a bounded pattern scan, not a guarantee against every possible credential format. No credential rotation was identified as required. If a real credential is later discovered, revoke/rotate it with its issuer first, remove it from current files, inspect deployments/logs, and separately plan a `git filter-repo` cleanup in a fresh clone with owner approval. Never force-push or rewrite shared history as an automatic cleanup.

## SEO, accessibility and performance

The live site already rendered substantial HTML and branded headings; scanner claims about an empty Vite shell and missing 404/title/favicon/sitemap were inaccurate. New shared metadata supplies canonical URLs, unique descriptions, Open Graph and Twitter cards. The production origin fallback is the real storefront rather than localhost. A 1200×630 branded social image and app icons are included. Product metadata uses current database content and selected imagery; JSON-LD describes actual products and public breadcrumbs, with no fabricated reviews. Archived pieces omit offers. Organization and WebSite data appear on Home only, not admin routes. JSON serialization escapes HTML-significant characters without rich HTML insertion.

`robots.txt` allows ordinary public indexing and deliberately gives public AI crawlers the same wildcard policy. Admin, API, inquiry and unsubscribe paths are excluded; private pages also have noindex/HTTP headers. Robots rules are hints, not access control. Sitemap contains canonical public pages and current public product URLs. `llms.txt` is optional factual guidance, not an established ranking requirement. Update it if the canonical domain changes. A streamed missing-product response can already have HTTP 200 before notFound renders; noindex and the branded page still apply. Unknown static paths return 404.

Local fonts and existing Next responsive image optimization remain. Catalog skeletons, button/feedback/gallery transitions and mobile dialogs respect reduced motion. Gallery keyboard controls, native dialog focus behavior, active filter removal/reset and stable local favorites improve navigation. Production browser source maps are explicitly disabled. Bundle analysis measures emitted chunks; no unmeasured speedup percentage or Lighthouse claim is made. For substantially larger catalogs, replace all-catalog client filtering with paginated server queries before it becomes a bottleneck.

## Security controls and residual limits

- Supabase Auth stores/hashes passwords; server code verifies users and allowlist membership. Production cookies use Secure and SameSite=Lax. Vercel supplies HTTPS/HSTS; Supabase endpoints use HTTPS in production. Platform encryption at rest/in transit is retained; no custom encryption/key database was introduced.
- Zod validates browser/server boundaries. Body readers bound chunked requests by bytes. Explicit field maps avoid mass assignment, SDK queries are parameterized, and React escapes text. No administrator HTML editor or unsanitized HTML rendering was added.
- Public forms combine honeypot/start-time checks, origin checks, bounded per-instance hashed-IP throttling and durable database/email quotas. Client timing can be forged; quotas can be exhausted by abuse. Consider Vercel firewall limits and Supabase Auth CAPTCHA/rate settings, or add a server-verified Turnstile integration if real abuse warrants it. CAPTCHA would require owner-issued keys; none is represented as configured.
- Headers include CSP, nosniff, Referrer-Policy, Permissions-Policy and framing denial. CSP allowlists this Supabase origin, local fonts/images, and required image previews. It retains unsafe-inline for Next hydration/styles to preserve current static rendering; this is a baseline policy, not a strict nonce CSP. Production does not allow unsafe-eval. Strict nonces require deliberately changing caching/rendering behavior and further testing.
- Server logs use error codes/statuses and batch IDs/counts, not passwords, token values, mail addresses or inquiry messages. Restrict access to hosting/provider logs and configure retention/redaction for one-click bearer URLs.
- sharp was updated to patched 0.35.4 after an initial high-severity npm advisory; audit reported zero vulnerabilities after installation. Repeat dependency audits as advisories evolve.

## Deployment acceptance checklist

1. Confirm current schema and all exposed table/storage RLS; back up and apply only 003-005 in staging after existing 002.
2. Run formatter/check, lint, typecheck, database tests, `npm run test:production` and a normal production build afterward. Inspect source maps and measured chunks. Inspect routes at 375, 768 and 1440px, keyboard focus/dialogs and reduced motion.
3. Confirm anonymous and ordinary signed-in users cannot edit inventory/list subscriber data. Enroll a confirmed staging admin; verify sign-in/out and membership revocation.
4. Create an identifiable staging product. Upload valid/invalid/oversized files; change alt/cover; replace/remove; share one image across products; confirm safe retention; test cleanup retry and guarded product deletion. Remove only disposable staging records afterward.
5. Submit product/custom/general inquiries; verify field association, status, validation and duplicate throttling. Confirm no checkout/reservation behavior.
6. Complete email provider/domain/secrets setup, test to the admin address, test owned staging subscriber duplicate/consent/unsubscribe/one-click behavior, enable campaigns only for the verified list and confirm a bounded campaign. Reconcile any uncertain batch in the provider before retry.
7. Apply reviewed changes to production and deploy through Vercel. Verify HTML metadata, public sitemap/robots, branded 404, CSP connections/images and no ordinary-flow console errors. Monitor coarse error counts and provider suppression; do not publish customer data in diagnostics.

## Troubleshooting and maintenance

| Symptom                                 | Check / recovery                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty collection                        | Empty inventory is valid; verify Supabase URL/public key, deployed rows/RLS and console-free error state. No fake inventory is injected.                        |
| Store unavailable                       | Check public configuration and database connectivity. Raw SQL details are intentionally hidden.                                                                 |
| Admin denied                            | Confirm Auth user, email/password and admin_users UUID. User metadata is not an access grant.                                                                   |
| Upload policy/migration failure         | Apply 003 to the actual current schema; inspect bucket privacy/limits. Stay under prepared 3 MB, use supported format and supply alt text.                      |
| Image removal saved but cleanup pending | Retry bounded cleanup from Products; preserve tombstones. Review unrecognized legacy paths separately.                                                          |
| Inquiry fails after repeated attempts   | Wait for durable quotas. Confirm selected product is still available and 005 fields/grants match the schema.                                                    |
| Newsletter unavailable                  | Apply 004, verify account/session, provider/domain/secret configuration and HTTPS origin. Follow the provider setup guide; no raw provider error body is shown. |
| Recipient count unexpectedly low        | Inactive/unverified legacy rows are excluded; verify consent evidence rather than blanket resubscribing.                                                        |
| Paused campaign                         | Reconcile the exact batch with Resend; never create a replacement to bypass an uncertain-send warning.                                                          |
| Old metadata or images                  | Rebuild after public env changes; replacement uses new URLs. Verify canonical origin and relevant CSP/remotePatterns allowlist.                                 |
| Tests collide or hang                   | Only one suite/server uses 3100/4318. Stop only test processes you started; do not kill unrelated user processes.                                               |

Keep original photography/assets and design tokens. Periodically audit dependencies, test RLS after schema changes, review provider suppression and cleanup backlog, and retain subscriber opt-out evidence while applying your retention policy. No live migration, authenticated production write, real upload, external email, domain verification or deployment was performed as part of these repository changes. See `docs/VERIFICATION.md` for final command results and boundaries.
