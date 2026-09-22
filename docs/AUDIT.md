# Off The Rack audit — 14 September 2026

## Completion checkpoint — 22 September 2026

The repository implementation is complete. The full production suite passed all 55 checks in one run; formatting, lint, type checking, 46 isolated database assertions and the credential-pattern scan also passed. See [Verification and handoff](VERIFICATION.md) for evidence and limitations, and [Project documentation](PROJECT_DOCUMENTATION.md#migrations-and-rollout) for the staging rollout sequence. Live migrations, Storage acceptance, email-provider setup and deployment remain outstanding.

The findings below preserve the original audit baseline and describe the treatments now implemented locally.

## Architecture inspected before changes

The clean starting tree was commit `9a3c261`. This is already **Next.js App Router 16, React 19, TypeScript, Supabase and Vercel**, not a Vite SPA. The implementation preserves this architecture. Public pages use server components and a stateless publishable-key Supabase client; interactive islands handle forms, filters and galleries. Admin pages/actions use a cookie-aware Supabase SSR client, verified Auth users and the database `otr_is_admin()` allowlist. Supabase Auth owns passwords. Local fonts and optimized WebP photography establish the existing design.

The current model is documented in `src/lib/types.ts`: categories, products, product_images, inquiries, newsletter_subscribers, and admin_users. Products use category_id; images already have image_url, storage_path, alt_text, sort_order and is_primary. Newsletter records use is_active. The historical 001 migration represents a different schema and must never be replayed. Migration 002 adds the admin allowlist and admin RLS while preserving deployed public policies. The actual original deployed schema/policies are not fully represented by a replayable migration chain.

## Verified priorities

| Priority | Finding before implementation                                        | Evidence / treatment                                                                                                                                                        |
| -------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | No working image upload                                              | Admin renders image placeholders; existing model can support uploads without replacement. Add validated uploads and guarded cleanup.                                        |
| High     | Newsletter only stores signups                                       | No provider, campaigns, consent history or unsubscribe. Add server-only delivery and migration; external setup remains required.                                            |
| High     | Vulnerable image dependency                                          | Initial successful `npm audit` reported high-severity sharp/libvips/libheif advisories; upgrade patched sharp before accepting uploads.                                     |
| High     | Public forms have a honeypot but no timing or current DB abuse guard | Current data layer uses direct inserts; historical RPC rate limiting is not used. Add bounded requests and database triggers so direct public API calls remain constrained. |
| Medium   | Missing canonical URLs and incomplete per-page/social metadata       | Live homepage HTTPS 200, 41,527-byte HTML with H1 and Next scripts but no canonical. Add shared metadata and product JSON-LD.                                               |
| Medium   | Headers incomplete                                                   | Live already has HSTS, nosniff, Referrer-Policy and framing denial; lacks CSP and Permissions-Policy. Extend Next headers used by Vercel.                                   |
| Medium   | README no longer matches application                                 | References concept/placeholder inventory and future features now implemented. Replace and document setup limits.                                                            |
| Low      | Useful interactions incomplete                                       | Search/filter/sort, product inquiry selection and mobile Escape already work; improve gallery controls, saved pieces, share, feedback and active filters.                   |

## Scanner claims adjudicated

| Reported issue                          | Initial result                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty HTML / framework migration needed | False for this repository and live homepage: Next renders content server-side. Preserve server rendering; no migration/prerender add-on required. |
| Missing custom 404                      | False: existing branded not-found.tsx. Verify unknown URL UI and noindex. Streaming product misses may have HTTP 200 after headers commit.        |
| Vite branding, default favicon          | False: branded title/logo favicon already exist. Improve sharing artwork separately.                                                              |
| Identical titles                        | False: public routes have distinct titles; several inherit a generic description.                                                                 |
| Missing descriptions / OG               | Partial: root description and OG photo exist; route-specific descriptions, Twitter and accurate OG artwork need improvement.                      |
| Missing JSON-LD / canonicals            | Genuine gap.                                                                                                                                      |
| Poor headings / missing language        | Not observed: public page H1s and html lang=en are present.                                                                                       |
| Missing image alt                       | Existing helper supplies alt fallback; decorative backgrounds correctly use empty alt. Admin authoring needs alt input.                           |
| Missing robots / sitemap                | False: both metadata routes exist. Fix localhost fallback and complete private-route exclusions.                                                  |
| AI crawlers blocked                     | False in checked source: wildcard public allow. Keep a deliberate public indexing policy; robots is not authorization.                            |
| Missing llms.txt                        | True but optional, not an established SEO requirement. Add a concise factual public guide.                                                        |
| Exposed source maps                     | No productionBrowserSourceMaps enabled; explicitly disable and check build output. Next server maps are not browser assets.                       |
| Console errors                          | Four baseline frontend tests passed without page errors; verify final production separately.                                                      |
| Oversized JS                            | Requires measurement; no unsupported performance score claims. Next already splits routes.                                                        |

## Verification boundaries

Initial frontend baseline passed four tests covering 375px public routes, filters/sort, gallery/inquiry association, mobile Escape and reduced motion. Local tests use a PostgREST/Auth fixture, never live customer data. They do not prove deployed RLS. Read-only production checks and source/history secret scan are recorded in the final project documentation. SQL migrations, Storage writes, real email delivery and authenticated production admin actions require a staging project and owner credentials. No historical migration, live data modification, deployment, real newsletter send or Git history rewrite is part of repository verification.
