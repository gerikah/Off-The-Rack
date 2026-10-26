# Verification and handoff — 22 September 2026

## Outcome

The existing Next.js/Supabase/Vercel application and its design were preserved. Repository-level implementation is complete. No deployment, live migration, production admin write, real Storage upload or real email send was performed.

## Commands and results

Formatting, lint, type checking, database assertions, secret scanning and the complete production browser suite were rechecked on 22 September. All 55 production checks passed together in one run (2.6 minutes). No application code changes were needed. The registry dependency audit result remains from 19 September and was not refreshed in this pass. On Windows PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`.

| Check                                     | Result                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run format` / `npm run format:check` | Passed                                                                                                                  |
| `npm run lint`                            | Passed, no warnings                                                                                                     |
| `npm run typecheck`                       | Passed                                                                                                                  |
| `npm run test:db`                         | 46 assertions passed against actual isolated PostgreSQL semantics using PGlite; migrations 002–005 replayed twice       |
| `npm run test:production`                 | All 55 checks passed in one run against an optimized production build and isolated local backend on 22 September        |
| `npm run build`                           | Optimized build with existing local configuration restored after fixture testing                                        |
| `npm run analyze:bundle`                  | No emitted public source maps; measured totals below                                                                    |
| `npm run audit:secrets`                   | Seven reachable commits and 222 current non-ignored repository files scanned; no recognized privileged credential found |
| `npm audit --json`                        | 19 September result: zero vulnerabilities after upgrading sharp to 0.35.4 and adding the isolated test runtime          |
| `git diff --check`                        | Passed                                                                                                                  |

The earlier three assertion failures had been corrected before this complete rerun: Playwright's request client did not send Secure cookies over local HTTP, so authenticated endpoint checks use browser fetch; Next canonicalizes the homepage without a trailing slash, so equivalent URLs are normalized in the test. The public SEO route sweep also asserts no browser console errors. Normal public routes produced no browser errors in the 22 September production check. An intentionally failing backend scenario emitted the expected generic server error; it is not a normal-flow console failure.

The browser runner now starts direct Node processes, clears the provider API key, disables campaigns and owns cleanup of only its child processes. This avoids the earlier Windows web-server teardown hang. `npm test` uses a dev server; `npm run test:production` builds and tests production mode. The latter builds with fixture public connection values: run a normal `npm run build` before starting/deploying your actual configured application. The workspace was rebuilt normally at handoff. Tests never use a service-role key or send real email.

## What was exercised

- Public routes at 375, 430, 768, 1024, 1440 and 1920 px; admin screens at 375/768/1440 px; axe WCAG 2 A/AA and 2.1 AA checks, image loading and no horizontal overflow.
- Search/category/status/sort and reset/removable active filters; local favorites, storage corruption/denial and cross-tab updates; native share/copy fallback; gallery arrows/Home/End; dialog Escape/focus/desktop resize and reduced motion.
- Product/custom/general inquiry association, server validation, body limits, cross-site rejection, honeypot/timing checks, pending duplicate-click protection, error retention and confirmed success.
- Admin login/logout, ordinary-user denial, membership revocation, stale forms, product/category actions, sold/archive/restore, deletion confirmation and inquiry history protection.
- Real image decoder tests for JPEG/PNG/WebP/AVIF, signature/MIME mismatch, corrupt files, size/pixel bounds, resize and metadata removal. Browser upload/preview/alt/replace/remove/shared-file retention and revoked-admin checks use the local Storage fixture.
- Newsletter escaping/header validation, explicit confirmations, draft/legacy-consent actions, disabled production-send gate, anonymous/revoked denial, token properties, GET non-mutation, confirmation unsubscribe and RFC 8058 POST.
- SQL RLS/grants with deliberately permissive legacy policies, no self-enrollment, input/timestamp tampering, inquiry quotas, duplicate signup/opt-out preservation, consent eligibility, campaign count/retry/lease behavior, shared image references, cleanup tombstones, cover promotion and gallery cap. This does not simulate true multi-connection PostgreSQL races or the hosted Storage service.
- Titles/descriptions/canonicals/social images/cards, Product/Breadcrumb JSON-LD parsing and escaping, public sitemap, deliberate robots rules, noindex headers and branded 404.

## Live read-only observations

On 22 September the normal-config production build was also started locally at `http://127.0.0.1:3000`. Home, Shop, About, Contact, Archive, admin login, robots and sitemap returned HTTP 200 without the application error fallback. The protected products page emitted the expected streamed login redirect, and an unknown route returned 404. The restricted runtime could not reach the configured backend; the same checks passed after restarting with network access. These were read-only checks, with no form submissions or authenticated writes. Interactive coverage is provided by the 55 passing isolated production checks above; a connected browser was unavailable for an additional manual pass.

On 14–15 September the deployed homepage returned substantial server-rendered HTML, branded content, lang=en, one H1 and existing security headers including HSTS. Public titles differed. Canonicals, JSON-LD, CSP and Permissions-Policy were the genuine missing pieces now implemented locally. A nonexistent route returned 404 with the branded page/noindex.

Live browser checks at 375/768/1440px showed no overflow or page errors on Home/Shop/Login. Admin products redirected to login in the browser. The public catalog exposed no products/images to exercise. Anonymous table probes returned no visible inquiry/subscriber rows and denied admin_users. These observations do not certify deployed mutation policies: an empty result could also reflect empty tables. Public schema introspection was denied, and no privileged database connection/admin credentials were available. Inspect the full deployed schema and every bucket with `supabase/verify-security.sql` before rollout.

## Git publication privacy checks — 22 September

`.env.local` is ignored and untracked. The only tracked environment file is `.env.example`, which contains placeholders and empty secret fields. The current 222 repository files and seven reachable commits passed the credential-pattern scan; neither of the two configured local environment values appeared in those files or commit history. No real environment files or private-key files were found in the inspected history. Ignore rules also exclude private keys, local credential files, authenticated browser state, local tooling state, logs, test reports, build output and database backup paths. These checks do not claim to recognize every possible secret format.

## Measurements

The final normal-config production build emitted 27 JS chunks totaling 1,082,830 bytes raw / 311,153 bytes gzip; largest chunk 374,751 bytes raw / 85,500 bytes gzip; CSS 84,255 bytes; zero public source maps. These totals include every public/admin route and shared chunk, not the initial download for one page. The final normal-config build is recorded in `docs/BUNDLE_REPORT.json`. No baseline speedup percentage or Lighthouse/Web Vitals claim is made. Existing route splitting/local fonts/Next image optimization remain; uploads add bounded resizing and metadata stripping without an animation-library dependency.

## Manual rollout still required

1. Back up and inspect the actual existing Supabase schema/RLS/buckets. Use a staging clone. Keep historical 001 untouched; apply missing 002 only if needed, then new 003/004/005 in order. Verify replay and access rules in staging.
2. Use the existing confirmed Supabase admin, or enroll a confirmed Auth user's UUID following `ADMIN_SETUP.md`. Test authorization and upload/replace/remove/shared-file/cleanup behavior against actual staging Storage. Review any nonempty private product-images bucket before making it public.
3. Create a Resend account, verify a sender domain and create a restricted sending API key. Create a random 32-byte-or-longer unsubscribe secret. Store these only as server variables in Vercel, with sender/reply-to/postal address and canonical HTTPS origin. No Supabase service-role key is required; no existing credential was identified as needing rotation.
4. Deploy the Next server routes with the app. Follow `docs/NEWSLETTER_SETUP.md`: self-test, owned-address staging campaign, duplicate/consent/unsubscribe/one-click verification, provider delivery and suppression checks. Configure log retention/redaction for one-click bearer URLs. Only then set the production campaign flag to `true`, redeploy and explicitly confirm a real campaign.
5. Deploy through the existing Vercel project after staging acceptance. Recheck actual live metadata, headers, images, browser console and ordinary customer/admin flows.

## Remaining practical limits

The historical schema is not a fresh-project installer; obtain a reviewed schema export for a new project. Other Storage buckets remain unchanged. A crash between upload and attachment can leave an unqueued orphan; review older unreferenced generated objects periodically. Public buckets make all contained photos public, including archived work. Signup identity is not verified by double opt-in; global quotas can be exhausted by abuse, so external bot protection remains a possible follow-up. CSP permits inline hydration/styles; it is not a strict nonce policy. Campaign batches advance manually and uncertain older sends require provider reconciliation; accepted does not mean delivered. Large catalogs should move filtering/pagination server-side as needed. See the complete project and operational guides for details.
