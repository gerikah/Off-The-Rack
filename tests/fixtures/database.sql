-- TEST ONLY: minimal model of the documented connected schema, not a bootstrap migration.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
grant usage on schema public,auth,storage to anon,authenticated;
grant execute on function auth.uid(),auth.role() to anon,authenticated;
create table public.categories(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,description text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.products(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,short_description text,description text,price numeric not null,category_id uuid references public.categories(id) on delete set null,size text,condition text,material text,color text,measurements text,care_instructions text,status text default 'available' check(status in ('available','sold','archived')),featured boolean default false,bestseller boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.product_images(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,image_url text not null,storage_path text,alt_text text,sort_order integer default 0,is_primary boolean default false,created_at timestamptz default now());
create table public.inquiries(id uuid primary key default gen_random_uuid(),customer_name text not null,email text not null,mobile text,inquiry_type text not null,product_id uuid references public.products(id) on delete set null,garment_type text,preferred_size text,design_idea text,reference_url text,message text not null,status text default 'new',created_at timestamptz default now(),updated_at timestamptz default now());
create table public.newsletter_subscribers(id uuid primary key default gen_random_uuid(),email text not null unique,is_active boolean not null default true,created_at timestamptz not null default now());
create table storage.buckets(id text primary key,name text not null,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
alter table storage.objects enable row level security;
grant all on all tables in schema public,storage to anon,authenticated;
-- Intentionally permissive historical policies prove that new restrictive guards work.
do $$ declare t text; begin
 foreach t in array array['categories','products','product_images','inquiries','newsletter_subscribers'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy test_legacy_policy on public.%I for all to anon,authenticated using(true) with check(true)',t);
 end loop;
end $$;
create policy test_legacy_storage_policy on storage.objects for all to anon,authenticated using(true) with check(true);
insert into auth.users values('40000000-0000-4000-8000-000000000000'),('40000000-0000-4000-8000-000000000001');
insert into public.categories(id,name,slug) values('10000000-0000-4000-8000-000000000000','Jackets','jackets');
insert into public.products(id,name,slug,price) values('20000000-0000-4000-8000-000000000000','Fixture jacket','fixture-jacket',2000),('20000000-0000-4000-8000-000000000001','Fixture second','fixture-second',2500);
insert into public.newsletter_subscribers(email,is_active,created_at) values('legacy@example.invalid',true,'2020-01-01'),('inactive@example.invalid',false,'2020-01-01');
