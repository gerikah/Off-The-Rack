-- Run this file only in the existing storefront project, using the SQL editor.
-- Do NOT replay the incompatible historical 001_storefront.sql file.
begin;
create table if not exists public.admin_users (
 id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
-- Reuse the old reserved allowlist if it was created with user_id.
do $$ begin
 if exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='user_id')
 and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='id') then
  alter table public.admin_users rename column user_id to id;
 end if;
end $$;
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
-- No public/admin self-enrollment policy. Membership is managed in the SQL editor.
create or replace function public.otr_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.admin_users where id = (select auth.uid())); $$;
alter function public.otr_is_admin() owner to postgres;
revoke all on function public.otr_is_admin() from public, anon;
grant execute on function public.otr_is_admin() to authenticated;

-- Add only named admin policies; existing public policies remain untouched.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inquiries enable row level security;
alter table public.newsletter_subscribers enable row level security;
grant select, insert, update, delete on public.categories, public.products, public.product_images to authenticated;
grant select, update on public.inquiries to authenticated;
grant select on public.newsletter_subscribers to authenticated;

drop policy if exists otr_admin_categories on public.categories;
create policy otr_admin_categories on public.categories for all to authenticated using ((select public.otr_is_admin())) with check ((select public.otr_is_admin()));
drop policy if exists otr_admin_products on public.products;
create policy otr_admin_products on public.products for all to authenticated using ((select public.otr_is_admin())) with check ((select public.otr_is_admin()));
drop policy if exists otr_admin_product_images on public.product_images;
create policy otr_admin_product_images on public.product_images for all to authenticated using ((select public.otr_is_admin())) with check ((select public.otr_is_admin()));
drop policy if exists otr_admin_inquiries_read on public.inquiries;
create policy otr_admin_inquiries_read on public.inquiries for select to authenticated using ((select public.otr_is_admin()));
drop policy if exists otr_admin_inquiries_update on public.inquiries;
create policy otr_admin_inquiries_update on public.inquiries for update to authenticated using ((select public.otr_is_admin())) with check ((select public.otr_is_admin()));
drop policy if exists otr_admin_newsletter_read on public.newsletter_subscribers;
create policy otr_admin_newsletter_read on public.newsletter_subscribers for select to authenticated using ((select public.otr_is_admin()));

-- Serialize deletion against FK inserts so inquiry history cannot be cascaded away.
-- Security invoker: the caller still needs an admin JWT and the RLS permissions above.
create or replace function public.otr_delete_product(product_uuid uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
 if not public.otr_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 perform id from public.products where id=product_uuid for update;
 if not found then raise exception 'Product not found' using errcode='P0002'; end if;
 if exists(select 1 from public.inquiries where product_id=product_uuid) then
  raise exception 'Product has inquiries' using errcode='23503';
 end if;
 delete from public.products where id=product_uuid;
end; $$;
revoke all on function public.otr_delete_product(uuid) from public, anon;
grant execute on function public.otr_delete_product(uuid) to authenticated;
commit;
