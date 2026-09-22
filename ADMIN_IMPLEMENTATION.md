> Historical implementation checkpoint. For current upload/newsletter features, new migrations003?005, rollout and verification, use [the project documentation](docs/PROJECT_DOCUMENTATION.md). The original admin allowlist setup below remains applicable when002 is not already installed.

# Admin implementation report

The existing Off The Rack project now includes an internal admin CMS. The public storefront design and navigation are preserved. Live admin access requires the SQL and account setup below.

## Routes and features

- /admin/login: email/password login, pending/errors, no signup.
- /admin: live Supabase product/status/open-inquiry counts, five recent inquiries, quick actions.
- /admin/products: search, category/status filters, edit, confirmed sold/archive/restore actions and deletion through More.
- /admin/products/new and /admin/products/[id]/edit: shared validated form, automatic editable slug, duplicate-slug checks, nonnegative PHP price, category/details/flags/status and feedback.
- /admin/categories: add/edit, automatic editable slug, product counts, confirmed deletion with an uncategorized-products warning.
- /admin/inquiries and /admin/inquiries/[id]: customer/email/product search, status filter, contact/custom fields, copy email, product links and explicit manual read/replied/resolved actions.
- Logout ends the local session. Protected unknown routes are guarded too.

Every admin product image is a reusable icon placeholder; the form has four boxes. No uploads, image management, Storage writes, newsletter management or email sending were added. Existing product_images/storage_path/image_url/sort_order/is_primary support remains intact.

## Authentication, authorization and SQL

Existing Supabase clients handle email/password Auth and cookie session refresh. Server-side getUser() validates the session; requireAdmin() verifies allowlist membership through otr_is_admin() before data reads or mutations. Request-scoped memoization avoids repeated verification within a request. Server Actions validate browser input and revalidate affected routes. Authenticated non-admins are denied; admin identities are not hardcoded.

[002_admin_access.sql](supabase/migrations/002_admin_access.sql) creates/reuses the admin_users allowlist, normalizes its historical user_id column to id when needed, enables RLS and adds admin-only table policies. Existing public policies are preserved. Admins receive categories/products/product_images CRUD, inquiries read/update and newsletter_subscribers read. Direct allowlist access and self-enrollment are unavailable to clients. The membership function has a fixed search_path and accepts no user ID. The product-deletion RPC preserves related inquiry history and retains caller RLS checks.

## Manual Supabase setup

Follow [ADMIN_SETUP.md](ADMIN_SETUP.md) for exact SQL and account instructions:

1. Run the entire new 002_admin_access.sql in the existing project's SQL Editor. Do not replay historical 001_storefront.sql.
2. Create a confirmed email/password user under Authentication > Users > Add user > Create new user.
3. Copy its Auth UUID and enroll it with:

```sql
insert into public.admin_users (id)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid)
on conflict (id) do nothing;
```

4. Open /admin/login and sign in. Use HTTPS for production secure cookies.

No new environment variables are required, and .env.local was not changed. The migration has **not** been applied and **live admin writes have not been tested**. Automated checks use isolated local records and do not touch live customer data.

## Validation

- Typecheck: passed.
- Lint: passed with no warnings.
- Full automated suite: 34 passed, including storefront regressions and 15 admin checks.
- Final inquiry-button and responsive/accessibility regression: 4 passed.
- Production build: passed (Next.js 16.3.4).
- Production browser smoke: login fields rendered; anonymous dashboard/products/categories/inquiries redirected to login. No credentials submitted or database mutations performed.
- Visual review: desktop dashboard/form and mobile product cards checked; admin layouts and axe accessibility tested at 375, 768 and 1440px.
- Coverage includes anonymous redirects, non-admin denial, admin dashboard, slug/category/product validation, create/edit/status/delete, inquiry history protection, filters, category changes, inquiry updates, membership revocation, stale forms, logout, empty states and responsive navigation.

Local Auth/PostgREST fixtures exercise the actual Supabase SDK and Next.js Server Actions. They cannot verify the live SQL policies; apply the migration and perform a final authenticated smoke check using records you control.

## Files created

- `ADMIN_SETUP.md`
- `src/app/admin/(protected)/[...path]/page.tsx`
- `src/app/admin/(protected)/categories/page.tsx`
- `src/app/admin/(protected)/inquiries/[id]/page.tsx`
- `src/app/admin/(protected)/inquiries/page.tsx`
- `src/app/admin/(protected)/layout.tsx`
- `src/app/admin/(protected)/page.tsx`
- `src/app/admin/(protected)/products/[id]/edit/page.tsx`
- `src/app/admin/(protected)/products/new/page.tsx`
- `src/app/admin/(protected)/products/page.tsx`
- `src/app/admin/actions.ts`
- `src/app/admin/admin.css`
- `src/app/admin/auth-actions.ts`
- `src/app/admin/error.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/loading.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/admin/not-found.tsx`
- `src/components/admin/auth-form.tsx`
- `src/components/admin/categories.tsx`
- `src/components/admin/confirm-action.tsx`
- `src/components/admin/inquiries.tsx`
- `src/components/admin/notice.tsx`
- `src/components/admin/product-form.tsx`
- `src/components/admin/products-table.tsx`
- `src/components/admin/shell.tsx`
- `src/components/admin/ui.tsx`
- `src/components/site-chrome.tsx`
- `src/lib/admin/auth.ts`
- `src/lib/admin/data.ts`
- `src/lib/admin/errors.ts`
- `src/lib/admin/validation.ts`
- `supabase/migrations/002_admin_access.sql`
- `tests/admin.spec.ts`
- ADMIN_IMPLEMENTATION.md (this report)

## Existing files modified

- `DEVELOPMENT.md`
- `SUPABASE_INTEGRATION.md`
- `src/app/layout.tsx`
- `src/lib/database.types.ts`
- `src/utils/supabase/client.ts`
- `src/utils/supabase/middleware.ts`
- `src/utils/supabase/server.ts`
- `tests/fixtures/backend.mjs`
- `tests/storefront.spec.ts`

## Replaced route

- Removed the previous src/app/admin/[[...path]]/page.tsx not-found stub; guarded admin routes replace it.
