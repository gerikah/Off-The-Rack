-- Apply once in a new Supabase project. Catalog details must be reviewed before launch.
begin;
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);
insert into public.categories (name, slug) values
  ('Jackets','jackets'), ('Pants','pants'), ('Tops','tops'), ('Accessories','accessories'), ('Custom','custom');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  category text not null references public.categories(name),
  size text not null,
  condition text not null default '',
  material text not null default '',
  color text not null default '',
  status text not null default 'available' check (status in ('available','sold','archived')),
  featured boolean not null default false,
  bestseller boolean not null default false,
  image_alt text not null default '',
  measurements jsonb not null default '[]' check (jsonb_typeof(measurements) = 'array'),
  care text not null default '',
  "drop" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null check (url like '/images/%' or url like 'https://%'),
  sort_order integer not null default 0
);
create index product_images_product_idx on public.product_images(product_id);
create index products_status_idx on public.products(status, created_at desc);
create function public.touch_product_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger products_updated_at before update on public.products
for each row execute function public.touch_product_updated_at();

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (length(customer_name) between 2 and 120),
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  mobile text not null default '' check (length(mobile) <= 40),
  type text not null check (type in ('product','custom','general')),
  product_id uuid references public.products(id) on delete set null,
  message text not null check (length(message) between 10 and 4000),
  garment_type text not null default '' check (length(garment_type) <= 80),
  preferred_size text not null default '' check (length(preferred_size) <= 40),
  design_idea text not null default '' check (length(design_idea) <= 2000),
  reference_url text not null default '' check (length(reference_url) <= 1000 and (reference_url = '' or reference_url ~ '^https?://')),
  consent boolean not null check (consent = true),
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  created_at timestamptz not null default now()
);
create index inquiries_email_created_idx on public.inquiries(email, created_at desc);
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed')),
  created_at timestamptz not null default now()
);
-- Reserved for future admin authentication; no anonymous access or admin UI.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inquiries enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.admin_users enable row level security;
revoke all on public.categories, public.products, public.product_images, public.inquiries,
  public.newsletter_subscribers, public.admin_users from anon, authenticated;
grant select on public.categories, public.products, public.product_images to anon, authenticated;
create policy "Public category browsing" on public.categories for select to anon, authenticated using (true);
create policy "Public catalog browsing" on public.products for select to anon, authenticated using (true);
create policy "Public product images" on public.product_images for select to anon, authenticated using (true);

-- Only bounded submission functions can write. No public read, update, delete,
-- or direct insert privilege on customer data. Status and timestamps stay server-owned.
create function public.submit_inquiry(payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(payload->>'email'));
  requested_type text := payload->>'type';
begin
  if octet_length(payload::text) > 16000 then raise exception 'Inquiry too large'; end if;
  if coalesce((payload->>'consent')::boolean, false) is not true then raise exception 'Consent required'; end if;
  if requested_type = 'custom' and length(trim(coalesce(payload->>'design_idea',''))) < 10 then
    raise exception 'Design idea required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized_email, 1));
  if exists (select 1 from public.inquiries where email = normalized_email and created_at > now() - interval '1 minute') then
    raise exception 'Please wait before sending another inquiry';
  end if;
  insert into public.inquiries(customer_name,email,mobile,type,product_id,message,garment_type,preferred_size,design_idea,reference_url,consent)
  values (
    trim(payload->>'customer_name'), normalized_email, coalesce(payload->>'mobile',''),
    requested_type,
    case when requested_type = 'product' then nullif(payload->>'product_id','')::uuid else null end,
    trim(payload->>'message'),
    case when requested_type = 'custom' then coalesce(payload->>'garment_type','') else '' end,
    case when requested_type = 'custom' then coalesce(payload->>'preferred_size','') else '' end,
    case when requested_type = 'custom' then coalesce(payload->>'design_idea','') else '' end,
    case when requested_type = 'custom' then coalesce(payload->>'reference_url','') else '' end, true
  );
end;
$$;
create function public.subscribe_to_newsletter(subscriber_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Idempotent; no response reveals whether an address already exists.
  -- Do not silently resubscribe a previously unsubscribed address.
  insert into public.newsletter_subscribers(email) values (lower(trim(subscriber_email)))
  on conflict (email) do nothing;
end;
$$;
revoke all on function public.submit_inquiry(jsonb) from public;
revoke all on function public.subscribe_to_newsletter(text) from public;
revoke all on function public.touch_product_updated_at() from public;
grant execute on function public.submit_inquiry(jsonb) to anon, authenticated;
grant execute on function public.subscribe_to_newsletter(text) to anon, authenticated;
commit;
