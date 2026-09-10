# OFF THE RACK - development and handoff

Next.js App Router, React, TypeScript, the existing chrome theme, local fonts, photography, animations and responsive components are preserved. Supabase is now the only inventory source.

## Run and validate

Use Node.js 22+ and npm (npm.cmd in PowerShell if needed).

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
npm test
```

Playwright starts an isolated Next.js development server on port 3100 and a local PostgREST test double on 4318. It overrides Supabase credentials only for that test process. Tests never insert into the live project. Installed Chrome is the default; set PLAYWRIGHT_CHANNEL=msedge for Edge. Do not run a second Next.js development server in this checkout while running the suite.

## Data access and future admin

- src/lib/types.ts represents Category, ProductRow, Product with joined category/images, ProductImage, Inquiry and NewsletterSubscriber. Optional descriptive database fields are nullable.
- src/lib/database.types.ts defines typed rows/inserts/updates and foreign keys for all five existing tables. There was no linked CLI type-generation workflow, so these are maintained locally. Confirm actual constraints/defaults when extending the admin; replace this file with Supabase CLI-generated types once that workflow exists.
- src/lib/data/products.ts provides getProducts, getAvailableProducts, getNewArrivals, getBestsellers, getArchivedProducts, getProductBySlug and getRelatedProducts. Queries join categories and product_images, paginate the product catalog, and order by creation date descending. React cache deduplicates reads within a render; requests use no-store so later inventory edits appear on the next request.
- src/lib/data/categories.ts loads database categories for Shop filters.
- src/lib/data/inquiries.ts validates and inserts product/custom/general inquiries. It verifies referenced products, explicitly maps inquiry_type, clears irrelevant custom/product fields, sets status=new, and never requests customer rows back.
- src/lib/data/newsletter.ts inserts email/is_active=true. A unique-email conflict produces the inline already-on-the-list message, with no customer-list query or upsert. Existing inactive subscriptions are not reactivated.
- src/lib/validation.ts is shared browser/server validation; consent and honeypot values are validated but are not nonexistent database columns.
- src/lib/product-utils.ts holds PHP formatting and image helpers; src/components/product-image.tsx falls back after a failed image load.
- src/lib/supabase.ts is the typed, stateless, server-only public client used for storefront queries and inserts under public RLS. Cookie-aware browser/server clients remain in src/utils/supabase for future Auth features. src/proxy.ts retains session refresh. The admin workspace now uses these cookie-aware clients. See ADMIN_SETUP.md for the allowlist, policies and first-account setup.

Database errors are logged in development as an operation and error code only. Customers receive branded errors without raw SQL, credentials, stack traces or internal messages. Empty results are normal, distinct from connection errors. Missing credentials do not produce fake success or sample products.

## Connected routes

- /: three newest available pieces; up to five bestsellers with status available or sold, using the existing editorial featured-works layout and custom tile.
- /shop: joined catalog and dynamic categories; immediate client-side status/category/search filters and date/price sorting. Sold and archived products remain visible.
- /archive: sold/archived products, newest first, with an editorial staggered composition using existing cards and typography.
- /product/[slug]: slug lookup, primary-first gallery, populated metadata only, related available pieces preferring the same category, status-aware inquiry CTA, Next.js notFound for missing slugs.
- /inquiry?product=[slug]: selected product and product_id association. /inquiry?type=custom: custom fields. Otherwise general inquiry. A valid selected product takes precedence if both URL parameters are supplied.
- /api/inquiries and /api/newsletter: validated inserts; size limits, honeypot checks, generic failure messages. Form controls lock during submission to prevent repeated-click duplicates.
- /sitemap.xml: database product links plus public routes including Archive.

The /todos route, static product/category arrays, catalog-source flag, mock catalog export script and RPC demo submission paths were removed. Permanent public/images assets stay local. The admin workspace is implemented separately, with product image placeholders only.

## Environment

Keep existing credentials in .env.local (ignored by Git) and configure the same values in the deployment environment:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- NEXT_PUBLIC_SUPABASE_ANON_KEY: legacy fallback only
- NEXT_PUBLIC_SITE_URL: canonical deployment URL for metadata/sitemap
- Existing optional NEXT_PUBLIC_CONTACT_EMAIL, NEXT_PUBLIC_INSTAGRAM_URL, NEXT_PUBLIC_FACEBOOK_URL and NEXT_PUBLIC_TIKTOK_URL overrides

NEXT_PUBLIC_CATALOG_SOURCE is obsolete and ignored. Supabase is always the catalog source. No service-role or secret key is used or needed.

## Existing Supabase project: manual setup

The five application tables and RLS already exist; no schema or policy changes are applied by this work. Do not rerun supabase/migrations/001_storefront.sql: it is a historical, incompatible schema retained only for reference.

1. Add verified inventory through Supabase until the future admin is built. Categories already exist. Empty inventory intentionally shows branded empty states.
2. Ensure newsletter_subscribers.email has a unique constraint/index for duplicate handling. Do not grant public SELECT on customer tables. Keep public catalog reads and inquiry/newsletter inserts as currently configured.
3. In Supabase Storage, create the product-images bucket manually if absent. For this public storefront, product photos need public read URLs. Do not grant public uploads, updates or deletes; future admin access requires separate authorization and policies. The application does not create buckets or alter storage policies.
4. Store public URLs in product_images.image_url, object paths in storage_path, descriptions in alt_text, image order in sort_order, and the preferred cover in is_primary. Images are sorted ascending; the first marked primary is promoted to the gallery cover, preserving the remaining order. With no primary, the first sorted image is used.
5. Images may use existing /images/ assets or HTTPS public URLs from this project's product-images bucket. Unrecognized/missing URLs and failed loads use the existing background image. External image providers would require explicitly extending both the helper and Next.js remotePatterns allowlist.
6. Optional supabase/seed.development.sql creates four clearly temporary development examples using existing categories, with no overwrites. It has NOT been applied to the live project. It assumes the documented text status columns; inspect against the development schema first.

No live customer submissions are made by the automated suite. Successful tests of the local double prove application mapping and interaction, not live RLS writes. A live end-to-end submission can be performed manually with an identifiable test record if desired.

## Operations and assets

Inquiries are stored only; there are no email notifications, newsletter campaigns, payments or reservations yet. Existing logos, hero/background images, textures and editorial photography remain in the repository. Original assets are in assets/ and optimized images in public/images/; npm run assets regenerates them. Typography, layout and responsive rules remain in src/app/globals.css.

Vercel uses the Next.js preset and npm run build. Configure public environment variables and redeploy; missing credentials show an unavailable state rather than mock inventory.

References: [Supabase typed clients](https://supabase.com/docs/reference/javascript/typescript-support), [joined queries](https://supabase.com/docs/guides/database/joins-and-nesting), [inserts](https://supabase.com/docs/reference/javascript/insert). Version-specific Next.js guides are bundled in node_modules/next/dist/docs/.

## Admin workspace

The admin routes now implement email/password sign-in, server-verified allowlist authorization, dashboard counts, product CRUD/status actions, category management and inquiry details/status updates. Apply only supabase/migrations/002_admin_access.sql and create the first Auth user manually using the exact instructions in [ADMIN_SETUP.md](ADMIN_SETUP.md). Admin writes have been tested against an isolated local fixture, not the live project. Image uploads, Storage writes, email sending and newsletter management are intentionally absent.

The cookie-aware clients use SameSite=Lax cookies with Secure enabled in production; deploy over HTTPS. The stateless storefront client remains public and does not inherit admin sessions.
