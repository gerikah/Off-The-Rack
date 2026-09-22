-- Apply after 002 to the existing schema. Never replay historical 001.
-- Additive and idempotent. All objects in this public catalog bucket are public.
begin;

-- Never expose an existing private bucket containing files without review.
do $$ begin
 if exists(select 1 from storage.buckets where id='product-images' and not public)
 and exists(select 1 from storage.objects where bucket_id='product-images') then
  raise exception 'Review private product-images contents before deliberately making this catalog bucket public';
 end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
 array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
 public = true,
 file_size_limit = least(coalesce(storage.buckets.file_size_limit, 5242880), 5242880),
 allowed_mime_types = excluded.allowed_mime_types;

-- Existing ProductImage columns are reused; no inventory rows are rewritten.
create index if not exists otr_product_images_storage_path_idx
 on public.product_images(storage_path) where storage_path is not null;
create table if not exists public.product_image_cleanup (
 storage_path text primary key,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table public.product_image_cleanup enable row level security;
revoke all on public.product_image_cleanup from public, anon, authenticated;
grant select on public.product_image_cleanup to authenticated;
drop policy if exists otr_image_cleanup_admin_read on public.product_image_cleanup;
create policy otr_image_cleanup_admin_read on public.product_image_cleanup
 for select to authenticated using ((select public.otr_is_admin()));

-- Extract only our generated ASCII object paths, including percent-encoded URLs.
-- This also recognizes references that have an image_url but no storage_path.
create or replace function public.otr_managed_image_path(value text) returns text
language plpgsql immutable set search_path = '' as $$
declare decoded text := split_part(split_part(coalesce(value, ''), '?', 1), '#', 1);
 match text; octet integer;
begin
 for octet in 32..126 loop
  decoded := regexp_replace(decoded, '%' || lpad(to_hex(octet), 2, '0'), replace(chr(octet), chr(92), chr(92) || chr(92)), 'gi');
 end loop;
 match := substring(decoded from '(products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp)$');
 return match;
end; $$;
revoke all on function public.otr_managed_image_path(text) from public;
grant execute on function public.otr_managed_image_path(text) to authenticated;

-- Permanent tombstones make cleanup safe even when another admin concurrently
-- edits a different product. Claim and attachment serialize on the same path.
create or replace function public.otr_guard_image_reference() returns trigger
language plpgsql security definer set search_path = '' as $$
declare object_path text;
begin
 for object_path in
  select distinct path from unnest(array[
   public.otr_managed_image_path(new.storage_path),
   public.otr_managed_image_path(new.image_url)
  ]) as paths(path) where path is not null order by path
 loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(object_path, 37));
  if exists(select 1 from public.product_image_cleanup where storage_path = object_path) then
   raise exception 'This image was removed; upload a new image' using errcode='23514';
  end if;
 end loop;
 return new;
end; $$;
revoke all on function public.otr_guard_image_reference() from public, anon, authenticated;
drop trigger if exists otr_guard_image_reference on public.product_images;
create trigger otr_guard_image_reference before insert or update of storage_path, image_url
 on public.product_images for each row execute function public.otr_guard_image_reference();

create or replace function public.otr_claim_image_cleanup(object_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if not public.otr_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if public.otr_managed_image_path(object_path) is distinct from object_path then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(object_path, 37));
 if exists(select 1 from public.product_images
  where storage_path = object_path
   or public.otr_managed_image_path(storage_path) = object_path
   or public.otr_managed_image_path(image_url) = object_path) then return false; end if;
 insert into public.product_image_cleanup(storage_path) values (object_path)
 on conflict (storage_path) do nothing;
 return true;
end; $$;
revoke all on function public.otr_claim_image_cleanup(text) from public, anon;
grant execute on function public.otr_claim_image_cleanup(text) to authenticated;

create or replace function public.otr_complete_image_cleanup(object_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.otr_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 update public.product_image_cleanup set completed_at = now() where storage_path = object_path;
end; $$;
revoke all on function public.otr_complete_image_cleanup(text) from public, anon;
grant execute on function public.otr_complete_image_cleanup(text) to authenticated;

-- Queue removed references in the same database transaction. This covers a
-- concurrent replacement, cascade deletion, or an interrupted server response.
create or replace function public.otr_queue_retired_image() returns trigger
language plpgsql security definer set search_path = '' as $$
declare object_path text;
begin
 for object_path in select distinct path from unnest(array[
  public.otr_managed_image_path(old.storage_path),
  public.otr_managed_image_path(old.image_url)
 ]) as paths(path) where path is not null order by path loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(object_path, 37));
  if not exists(select 1 from public.product_images
   where storage_path=object_path or public.otr_managed_image_path(storage_path)=object_path
    or public.otr_managed_image_path(image_url)=object_path) then
   insert into public.product_image_cleanup(storage_path) values (object_path)
   on conflict (storage_path) do nothing;
  end if;
 end loop;
 return null;
end; $$;
revoke all on function public.otr_queue_retired_image() from public, anon, authenticated;
drop trigger if exists otr_queue_retired_image on public.product_images;
create trigger otr_queue_retired_image after delete or update of storage_path, image_url
 on public.product_images for each row execute function public.otr_queue_retired_image();

-- Only a successfully claimed path is eligible for automated Storage API removal.
create or replace function public.otr_image_cleanup_claimed(object_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.otr_is_admin() and exists(
  select 1 from public.product_image_cleanup where storage_path = object_path
 ) and not exists(select 1 from public.product_images
  where storage_path = object_path or public.otr_managed_image_path(image_url) = object_path);
$$;
revoke all on function public.otr_image_cleanup_claimed(text) from public, anon;
grant execute on function public.otr_image_cleanup_claimed(text) to authenticated;

-- Restrictive policies prevent older broad policies from granting access to
-- this bucket. Other buckets and their policies are preserved.
drop policy if exists otr_product_storage_select_guard on storage.objects;
create policy otr_product_storage_select_guard on storage.objects as restrictive
 for select to anon, authenticated using (
  bucket_id <> 'product-images' or
  case when (select auth.role()) = 'authenticated' then (select public.otr_is_admin()) else false end
 );
drop policy if exists otr_product_storage_insert_guard on storage.objects;
create policy otr_product_storage_insert_guard on storage.objects as restrictive
 for insert to anon, authenticated with check (
  bucket_id <> 'product-images' or
  case when (select auth.role()) = 'authenticated' then
   (select public.otr_is_admin()) and name = public.otr_managed_image_path(name)
  else false end
 );
drop policy if exists otr_product_storage_update_guard on storage.objects;
create policy otr_product_storage_update_guard on storage.objects as restrictive
 for update to anon, authenticated using (bucket_id <> 'product-images')
 with check (bucket_id <> 'product-images');
drop policy if exists otr_product_storage_delete_guard on storage.objects;
create policy otr_product_storage_delete_guard on storage.objects as restrictive
 for delete to anon, authenticated using (
  bucket_id <> 'product-images' or
  case when (select auth.role()) = 'authenticated' then public.otr_image_cleanup_claimed(name) else false end
 );

drop policy if exists otr_admin_product_storage_read on storage.objects;
create policy otr_admin_product_storage_read on storage.objects for select to authenticated
 using (bucket_id = 'product-images' and (select public.otr_is_admin()));
drop policy if exists otr_admin_product_storage_insert on storage.objects;
create policy otr_admin_product_storage_insert on storage.objects for insert to authenticated
 with check (bucket_id = 'product-images' and (select public.otr_is_admin()));
drop policy if exists otr_admin_product_storage_delete on storage.objects;
create policy otr_admin_product_storage_delete on storage.objects for delete to authenticated
 using (bucket_id = 'product-images' and public.otr_image_cleanup_claimed(name));

-- Cover changes and bounded gallery writes serialize on the product row.
create or replace function public.otr_save_product_image(
 product_uuid uuid, image_uuid uuid, image_data jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare image_count integer;
begin
 if not public.otr_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 perform id from public.products where id = product_uuid for update;
 if not found then raise exception 'Product not found' using errcode='P0002'; end if;
 if octet_length(image_data::text) > 5000 or length(trim(coalesce(image_data->>'alt_text', ''))) not between 1 and 300 then
  raise exception 'Invalid image details' using errcode='23514';
 end if;
 if image_uuid is null then
  select count(*) into image_count from public.product_images where product_id = product_uuid;
  if image_count >= 12 then raise exception 'Maximum 12 images per product' using errcode='23514'; end if;
  if public.otr_managed_image_path(image_data->>'storage_path') is distinct from image_data->>'storage_path'
   or image_data->>'storage_path' is null then raise exception 'Invalid image path' using errcode='23514'; end if;
  insert into public.product_images(product_id,image_url,storage_path,alt_text,sort_order,is_primary)
  values(product_uuid,image_data->>'image_url',image_data->>'storage_path',trim(image_data->>'alt_text'),
   coalesce((select max(sort_order) + 1 from public.product_images where product_id=product_uuid),0), image_count=0);
 else
  if not exists(select 1 from public.product_images where id=image_uuid and product_id=product_uuid) then
   raise exception 'Image not found' using errcode='P0002';
  end if;
  if coalesce((image_data->>'is_primary')::boolean,false) then
   update public.product_images set is_primary=false where product_id=product_uuid and id<>image_uuid;
  end if;
  update public.product_images set
   alt_text=trim(image_data->>'alt_text'),
   image_url=coalesce(image_data->>'image_url',image_url),
   storage_path=coalesce(image_data->>'storage_path',storage_path),
   is_primary=case when coalesce((image_data->>'is_primary')::boolean,false) then true else is_primary end
  where id=image_uuid and product_id=product_uuid;
 end if;
 update public.products set updated_at=now() where id=product_uuid;
end; $$;
revoke all on function public.otr_save_product_image(uuid,uuid,jsonb) from public, anon;
grant execute on function public.otr_save_product_image(uuid,uuid,jsonb) to authenticated;

create or replace function public.otr_remove_product_image(product_uuid uuid, image_uuid uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
 if not public.otr_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 perform id from public.products where id=product_uuid for update;
 if not found then raise exception 'Product not found' using errcode='P0002'; end if;
 delete from public.product_images where id=image_uuid and product_id=product_uuid;
 if not found then raise exception 'Image not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.product_images where product_id=product_uuid and is_primary) then
  update public.product_images set is_primary=true where id=(
   select id from public.product_images where product_id=product_uuid order by sort_order,id limit 1
  );
 end if;
 update public.products set updated_at=now() where id=product_uuid;
end; $$;
revoke all on function public.otr_remove_product_image(uuid,uuid) from public, anon;
grant execute on function public.otr_remove_product_image(uuid,uuid) to authenticated;
commit;
