-- Restore the storefront image relationship if a deployed project's original
-- public grant or policy has drifted. Product-image writes remain admin-only.
begin;

grant select on public.product_images to anon, authenticated;

drop policy if exists otr_public_product_images_read on public.product_images;
create policy otr_public_product_images_read on public.product_images
  for select to anon, authenticated using (true);

commit;
