> Historical implementation checkpoint. For current upload/newsletter features, new migrations003?005, rollout and verification, use [the project documentation](docs/PROJECT_DOCUMENTATION.md). The original admin allowlist setup below remains applicable when002 is not already installed.

# Off The Rack admin setup

The admin app uses the existing Supabase public URL/key and email/password Auth. No new environment variables or privileged server keys are needed. This implementation does not apply SQL or create accounts automatically.

## Apply the admin SQL

1. Open the connected project in the Supabase Dashboard.
2. Open SQL Editor, create a new query, paste the **entire contents** of [002_admin_access.sql](supabase/migrations/002_admin_access.sql), and run it as the project owner.
3. Run only this new file. Do not replay the historical, incompatible 001_storefront.sql file.

The SQL is transactional and can be rerun. It creates public.admin_users if missing. If the old reserved table uses user_id, it renames that column to id, preserving the memberships. No storefront product/category/inquiry columns are changed. It enables RLS, removes direct anon/authenticated access to the allowlist, and adds only its own named admin policies without modifying the existing public policies.

The zero-argument otr_is_admin() function returns whether auth.uid() is in the allowlist. It uses a fixed empty search_path, fully qualified objects, and a postgres owner. Only authenticated callers can execute it; callers cannot supply another user's ID. RLS on the application tables calls this function. Table grants to the authenticated role are constrained by those admin predicates; an ordinary signed-in user does not acquire admin access.

Admin permissions added:

| Table                  | Admin operations                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------- |
| categories             | Read, create, update, delete                                                           |
| products               | Read, create, update, delete                                                           |
| product_images         | Read, create, update, delete at the policy layer only; no image-management UI or calls |
| inquiries              | Read, update                                                                           |
| newsletter_subscribers | Read at the policy layer only; no management UI                                        |
| admin_users            | No direct client access or self-enrollment                                             |

The security-invoker otr_delete_product(uuid) function checks membership and locks the product before checking related inquiries. Products with inquiries cannot be deleted through the app; archive them instead. Existing foreign-key restrictions also remain enforced. No Storage objects are uploaded, deleted or changed. Deleting a product still follows the database's existing product_images foreign-key behavior.

## Create the first admin

1. In Supabase, open **Authentication > Users**.
2. Choose **Add user > Create new user**, enter the admin email and password, and confirm the email for this manually created account. Do not share the password in repository files.
3. Copy the new user's UUID from its Auth record.
4. In SQL Editor, replace the UUID placeholder below and run:

```sql
insert into public.admin_users (id)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid)
on conflict (id) do nothing;
```

5. Open /admin/login in the app and sign in with that email/password.

There is no signup page or Create Account control. You can also disable new user signups in Supabase Auth settings if this project should only have manually created accounts. Do not use a frontend email list or editable user metadata to assign admin access.

To revoke an admin, remove only that user's allowlist row in SQL Editor:

```sql
delete from public.admin_users
where id = 'REPLACE_WITH_AUTH_USER_UUID'::uuid;
```

The app rechecks membership on each server data request/action, so a page that was already open cannot perform a new mutation after access is revoked. An ordinary authenticated user is denied. An anonymous user is redirected to /admin/login. Admins visiting the login page are redirected to /admin. Logout ends the local session and refreshes protected routes. Session cookies use SameSite=Lax and Secure in production; the deployed app should use HTTPS.

## Features and implementation

- Routes: /admin/login, /admin, /admin/products, /admin/products/new, /admin/products/[id]/edit, /admin/categories, /admin/inquiries, /admin/inquiries/[id].
- src/lib/admin/auth.ts uses the existing cookie-aware server client, validates the current user with Supabase Auth getUser(), and calls the membership RPC. Every data operation calls requireAdmin(); layouts and middleware are not the only guard. React memoization is request-scoped.
- src/lib/admin/data.ts contains catalog/category/inquiry reads, live dashboard counts and guarded mutations. All inputs are validated server-side. No presentation component contains raw database queries.
- src/lib/admin/validation.ts provides reusable product/category validation, slug generation and allowed quick-status transitions. Price is a nonnegative decimal, with at most two fractional digits. Duplicate slugs produce a clean error, with database constraints retaining final race protection.
- src/app/admin/actions.ts exports guarded Server Actions. Next.js performs its standard action Origin/Host check. Successful writes revalidate admin and affected storefront routes.
- src/app/admin/auth-actions.ts provides email/password login and logout. Passwords, tokens and customer payloads are never logged. Development logs contain operation/error codes only.
- The admin shell has a desktop sidebar and keyboard-accessible mobile dialog. Its CSS is scoped to admin classes. SiteChrome switches presentation only; public routes retain their existing header, footer and newsletter. The footer includes an Admin link to /admin/login.
- Products support search, category/status filters, create, edit, mark sold, archive, restore and confirmed deletion in the More menu. Product/category saves set updated_at explicitly, so they do not depend on an existing timestamp trigger.
- Categories support creation, editing, product counts and confirmed deletion with an uncategorized-products warning. Existing category_id ON DELETE SET NULL behavior is preserved.
- Inquiry search covers customer name, email and linked product. Details include custom fields, product links, customer contact information and copy email. Status changes are explicit; opening a record does not mark it read or resolved. No emails are sent.
- Product imagery in every admin view is a reusable icon placeholder. Forms have four placeholder boxes with no upload/drop/reorder/delete controls. Existing storefront image support and product_images types are preserved.

## Testing and limits

npm test uses the local Auth/PostgREST fixture on port 4318 and the isolated Next.js app on 3100. It exercises real Supabase SDK cookie/session handling and Next.js Server Actions against that fixture. It covers anonymous/non-admin denial, membership revocation, stale forms, logout, product/category operations, status changes, inquiry management, responsive layouts and accessibility.

These tests do not prove the live database policies or admin writes. The SQL must be applied and the first admin enrolled before the live admin is usable. No live customer records or admin accounts are created by the test suite. No live admin credentials are needed for automated checks.

After manual setup, verify login, dashboard, product create/edit/status actions, categories and inquiry status changes in your project using identifiable records you control. The migration has not been automatically applied, and live admin writes have not been tested.

References: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). Next.js version-specific Server Actions, cookies and authentication guides were read from node_modules/next/dist/docs/.
