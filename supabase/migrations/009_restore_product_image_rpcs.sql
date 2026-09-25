-- Restore only the image-write RPCs when an existing project has the earlier
-- cleanup helpers but PostgREST reports these functions missing (PGRST202).
-- This migration deliberately does not change grants or RLS policies on tables.
begin;

create or replace function public.otr_save_product_image(
  product_uuid uuid,
  image_uuid uuid,
  image_data jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  image_count integer;
begin
  if not public.otr_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  perform id from public.products where id = product_uuid for update;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  if octet_length(image_data::text) > 5000
    or length(trim(coalesce(image_data ->> 'alt_text', ''))) not between 1 and 300 then
    raise exception 'Invalid image details' using errcode = '23514';
  end if;

  if image_uuid is null then
    select count(*) into image_count
    from public.product_images
    where product_id = product_uuid;

    if image_count >= 12 then
      raise exception 'Maximum 12 images per product' using errcode = '23514';
    end if;

    if public.otr_managed_image_path(image_data ->> 'storage_path')
        is distinct from image_data ->> 'storage_path'
      or image_data ->> 'storage_path' is null then
      raise exception 'Invalid image path' using errcode = '23514';
    end if;

    insert into public.product_images(
      product_id,
      image_url,
      storage_path,
      alt_text,
      sort_order,
      is_primary
    ) values (
      product_uuid,
      image_data ->> 'image_url',
      image_data ->> 'storage_path',
      trim(image_data ->> 'alt_text'),
      coalesce((
        select max(sort_order) + 1
        from public.product_images
        where product_id = product_uuid
      ), 0),
      image_count = 0
    );
  else
    if not exists(
      select 1 from public.product_images
      where id = image_uuid and product_id = product_uuid
    ) then
      raise exception 'Image not found' using errcode = 'P0002';
    end if;

    if coalesce((image_data ->> 'is_primary')::boolean, false) then
      update public.product_images
      set is_primary = false
      where product_id = product_uuid and id <> image_uuid;
    end if;

    update public.product_images
    set
      alt_text = trim(image_data ->> 'alt_text'),
      image_url = coalesce(image_data ->> 'image_url', image_url),
      storage_path = coalesce(image_data ->> 'storage_path', storage_path),
      is_primary = case
        when coalesce((image_data ->> 'is_primary')::boolean, false) then true
        else is_primary
      end
    where id = image_uuid and product_id = product_uuid;
  end if;

  update public.products set updated_at = now() where id = product_uuid;
end;
$$;

revoke all on function public.otr_save_product_image(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.otr_save_product_image(uuid, uuid, jsonb)
  to authenticated;

create or replace function public.otr_remove_product_image(
  product_uuid uuid,
  image_uuid uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.otr_is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  perform id from public.products where id = product_uuid for update;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  delete from public.product_images
  where id = image_uuid and product_id = product_uuid;
  if not found then
    raise exception 'Image not found' using errcode = 'P0002';
  end if;

  if not exists(
    select 1 from public.product_images
    where product_id = product_uuid and is_primary
  ) then
    update public.product_images
    set is_primary = true
    where id = (
      select id from public.product_images
      where product_id = product_uuid
      order by sort_order, id
      limit 1
    );
  end if;

  update public.products set updated_at = now() where id = product_uuid;
end;
$$;

revoke all on function public.otr_remove_product_image(uuid, uuid)
  from public, anon;
grant execute on function public.otr_remove_product_image(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
