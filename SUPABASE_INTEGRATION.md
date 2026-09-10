# Supabase integration report

Implemented the existing database schema as the sole storefront inventory source. The existing theme, photography, typography, animations, navigation and product/editorial components are preserved. No admin UI, live seed data, schema changes or RLS changes were applied.

## Files created

- src/components/product-image.tsx
- src/lib/data/categories.ts
- src/lib/data/errors.ts
- src/lib/data/inquiries.ts
- src/lib/data/newsletter.ts
- src/lib/data/products.ts
- src/lib/database.types.ts
- src/lib/product-utils.ts
- supabase/seed.development.sql
- tests/fixtures/backend.mjs
- tests/product-utils.spec.ts
- SUPABASE_INTEGRATION.md (this report)

## Files modified

- .env.example
- DEVELOPMENT.md
- package.json
- playwright.config.ts
- src/app/api/inquiries/route.ts
- src/app/api/newsletter/route.ts
- src/app/archive/page.tsx
- src/app/globals.css
- src/app/inquiry/page.tsx
- src/app/page.tsx
- src/app/product/[slug]/page.tsx
- src/app/shop/page.tsx
- src/app/sitemap.ts
- src/components/inquiry-form.tsx
- src/components/newsletter-form.tsx
- src/components/product-card.tsx
- src/components/product-gallery.tsx
- src/components/shop-catalog.tsx
- src/lib/supabase.ts
- src/lib/types.ts
- src/lib/validation.ts
- src/utils/supabase/client.ts
- src/utils/supabase/middleware.ts
- src/utils/supabase/server.ts
- supabase/migrations/001_storefront.sql
- tests/accessibility.spec.ts
- tests/storefront.spec.ts

The old migration was only labeled historical/incompatible; its SQL and policies were not executed or changed.

## Mock/demo code removed

- scripts/export-catalog.mjs
- src/app/todos/page.tsx
- src/lib/catalog.ts
- src/lib/products.ts

The old products service was replaced by src/lib/data/products.ts. Static product/category arrays, mock catalog export, the /todos demo, RPC-based form submissions, preview-success responses and catalog-source switch were removed.

## Queries and connected routes

- Product/category/image joins; full catalog, available products, newest arrivals, available/sold bestsellers, sold/archived products, slug lookup and related products.
- Dynamic category query for Shop filters.
- Validated inquiries INSERT with inquiry_type, product_id and conditional custom fields.
- Newsletter INSERT with is_active=true and graceful unique-conflict handling.
- Routes: /, /shop, /archive, /product/[slug], /inquiry, /api/inquiries, /api/newsletter and /sitemap.xml.

## Environment and manual Supabase setup

Uses existing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with NEXT_PUBLIC_SUPABASE_ANON_KEY as a legacy fallback. Existing site/contact variables remain supported. NEXT_PUBLIC_CATALOG_SOURCE is obsolete. No private credentials were added; .env.local was not changed.

The live catalog is empty and five categories are accessible. Add verified inventory when ready. Create the product-images Storage bucket manually if absent, with public image reads and no public upload/edit/delete grants. Populate image_url/storage_path and image ordering fields. Ensure newsletter email uniqueness for duplicate handling. Keep existing RLS. Do not apply the historical migration. The optional development seed is separate and was not run.

See DEVELOPMENT.md for types, storage conventions and future-admin reuse details.

## Validation

- TypeScript/typecheck: passed.
- ESLint: passed.
- Production build: passed, including a rebuild after the final empty-state CSS adjustment.
- Playwright: 19 passed. Tests use a local PostgREST double, covering responsive layouts (375-1920px), accessibility, empty catalogs, product predicates, filters/sorting, galleries, optional metadata, product/custom/general inquiry payloads, repeated-click protection, newsletter duplicates, errors and removed/reserved routes.
- Live read-only checks: product/category/image join succeeded; zero products and five categories. Production Home, Shop and Archive rendered their intended empty states. Final Home screenshots checked at 375px and 1440px with no overflow.
- Unknown product slugs render Next.js notFound and noindex. With the preserved root loading/streaming boundary, the response may already be HTTP 200 when the not-found UI streams; no claim of an HTTP 404 status is made.
- Live inquiry/newsletter writes: NOT tested. Submission tests exercised the local double only; they do not establish live write/RLS success. No customer records were read, and no live test records were inserted.
