-- Additive product-image workflow hardening for the existing database.
-- Apply this migration only; do not replay historical migrations.
begin;

-- The storefront uses stable public URLs. Public does not mean publicly writable.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

-- Normalize legacy galleries before enforcing one cover image at most.
with ranked as (
  select
    id,
    row_number() over (
      partition by product_id
      order by is_primary desc, sort_order asc, created_at asc, id asc
    ) as cover_rank
  from public.product_images
)
update public.product_images as image
set is_primary = ranked.cover_rank = 1
from ranked
where image.id = ranked.id
  and image.is_primary is distinct from (ranked.cover_rank = 1);

create unique index if not exists otr_product_images_one_primary_idx
  on public.product_images(product_id)
  where is_primary;

-- Restrictive guards ensure a permissive legacy policy cannot make this bucket
-- writable by anonymous or ordinary authenticated users.
drop policy if exists otr_product_storage_insert_guard on storage.objects;
create policy otr_product_storage_insert_guard on storage.objects as restrictive
  for insert to anon, authenticated with check (
    bucket_id <> 'product-images'
    or (
      (select auth.role()) = 'authenticated'
      and (select public.otr_is_admin())
      and name ~ '^products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$'
    )
  );

drop policy if exists otr_product_storage_update_guard on storage.objects;
create policy otr_product_storage_update_guard on storage.objects as restrictive
  for update to anon, authenticated
  using (
    bucket_id <> 'product-images'
    or (
      (select auth.role()) = 'authenticated'
      and (select public.otr_is_admin())
    )
  )
  with check (
    bucket_id <> 'product-images'
    or (
      (select auth.role()) = 'authenticated'
      and (select public.otr_is_admin())
      and name ~ '^products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$'
    )
  );

drop policy if exists otr_product_storage_delete_guard on storage.objects;
create policy otr_product_storage_delete_guard on storage.objects as restrictive
  for delete to anon, authenticated using (
    bucket_id <> 'product-images'
    or (
      (select auth.role()) = 'authenticated'
      and (select public.otr_is_admin())
      and public.otr_image_cleanup_claimed(name)
    )
  );

-- Explicit admin policies provide the permissive half of the restrictive guard.
drop policy if exists otr_admin_product_storage_read on storage.objects;
create policy otr_admin_product_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select public.otr_is_admin()));

drop policy if exists otr_admin_product_storage_insert on storage.objects;
create policy otr_admin_product_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.otr_is_admin()));

drop policy if exists otr_admin_product_storage_update on storage.objects;
create policy otr_admin_product_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.otr_is_admin()))
  with check (bucket_id = 'product-images' and (select public.otr_is_admin()));

drop policy if exists otr_admin_product_storage_delete on storage.objects;
create policy otr_admin_product_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.otr_is_admin())
    and public.otr_image_cleanup_claimed(name)
  );

commit;
