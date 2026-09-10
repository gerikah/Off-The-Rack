-- OPTIONAL: inspect and run manually in a development project only.
-- Never applied by the application. Does not update or overwrite existing rows.
-- Uses existing categories; missing categories simply skip their example rows.
begin;
insert into public.products (name, slug, short_description, description, price,
 category_id, size, condition, material, color, measurements, care_instructions,
 status, featured, bestseller)
select seed.name, seed.slug, 'TEMPORARY DEVELOPMENT PRODUCT',
 'Temporary sample for storefront integration testing. Remove before launch.',
 seed.price, category.id, 'M', 'Temporary sample', 'Denim', 'Indigo',
 'Temporary measurement: chest 54 cm', 'Temporary care: hand wash cold',
 seed.status, false, seed.bestseller
from (values
 ('TEMP OTR Available Bestseller', 'temp-otr-available-bestseller', 2400, 'jackets', 'available', true),
 ('TEMP OTR New Arrival', 'temp-otr-new-arrival', 1200, 'pants', 'available', false),
 ('TEMP OTR Sold Bestseller', 'temp-otr-sold-bestseller', 3200, 'jackets', 'sold', true),
 ('TEMP OTR Archived', 'temp-otr-archived', 1800, 'tops', 'archived', false)
) as seed(name, slug, price, category_slug, status, bestseller)
join public.categories category on category.slug = seed.category_slug
on conflict (slug) do nothing;
-- No image rows needed: these intentionally exercise the existing fallback image.
commit;
