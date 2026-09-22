-- Run only on the existing storefront schema, after 002-004. Never replay 001.
-- Add named restrictive guards without removing existing public/admin policies.
begin;
alter table public.inquiries add column if not exists consent_at timestamptz;
alter table public.inquiries add column if not exists consent_version text;
create index if not exists otr_inquiry_normalized_email_time_idx on public.inquiries(lower(trim(email)),created_at desc);
create index if not exists otr_inquiry_created_idx on public.inquiries(created_at);

create or replace function public.otr_guard_public_inquiry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.customer_name := trim(new.customer_name);
 new.email := lower(trim(new.email));
 new.message := trim(new.message);
 if new.customer_name is null or length(new.customer_name) not between 2 and 120
 or new.email is null or length(new.email)>254 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or new.message is null or length(new.message) not between 10 and 4000
 or new.inquiry_type is null or new.inquiry_type not in ('product','custom','general')
 or length(coalesce(new.mobile,''))>40 or length(coalesce(new.garment_type,''))>80
 or length(coalesce(new.preferred_size,''))>40 or length(coalesce(new.design_idea,''))>2000
 or length(coalesce(new.reference_url,''))>1000
 or (coalesce(new.reference_url,'')<>'' and new.reference_url !~* '^https?://') then
  raise exception 'Invalid inquiry' using errcode='22023';
 end if;
 if new.inquiry_type='product' then
  if new.product_id is null or not exists(select 1 from public.products where id=new.product_id and status='available') then
   raise exception 'Piece is not available; use a general inquiry' using errcode='22023';
  end if;
 else new.product_id:=null;
 end if;
 if new.inquiry_type='custom' then
  if length(trim(coalesce(new.design_idea,'')))<10 then raise exception 'Design idea required' using errcode='22023'; end if;
 else
  new.garment_type:=null; new.preferred_size:=null; new.design_idea:=null; new.reference_url:=null;
 end if;
 -- One lock makes global/email quotas atomic even through direct PostgREST inserts.
 perform pg_catalog.pg_advisory_xact_lock(718047);
 if exists(select 1 from public.inquiries where lower(trim(email))=new.email and created_at>now()-interval '1 minute')
 or (select count(*) from public.inquiries where lower(trim(email))=new.email and created_at>now()-interval '1 day')>=10
 or (select count(*) from public.inquiries where created_at>now()-interval '1 minute')>=30
 or (select count(*) from public.inquiries where created_at>now()-interval '1 day')>=1000 then
  raise exception 'Please wait before sending another inquiry' using errcode='P0001';
 end if;
 new.status:='new'; new.created_at:=now(); new.updated_at:=now();
 new.consent_at:=now(); new.consent_version:='inquiry-contact-v1';
 return new;
end; $$;
revoke all on function public.otr_guard_public_inquiry() from public,anon,authenticated;
drop trigger if exists otr_guard_public_inquiry on public.inquiries;
create trigger otr_guard_public_inquiry before insert on public.inquiries for each row execute function public.otr_guard_public_inquiry();

-- Column grants prevent caller-supplied ids, timestamps and consent evidence.
revoke insert on public.inquiries from public,anon,authenticated;
grant insert(customer_name,email,mobile,inquiry_type,product_id,garment_type,preferred_size,design_idea,reference_url,message,status) on public.inquiries to anon,authenticated;
revoke select,update,delete on public.inquiries,public.newsletter_subscribers from public,anon;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inquiries enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public,anon,authenticated;

-- Restrictive policies AND with existing policies, so old permissive policies
-- cannot expose customer data or permit catalog mutations by ordinary accounts.
do $$ declare t text; command text; guard text := 'case when (select auth.role()) = ''authenticated'' then public.otr_is_admin() else false end';
begin
 foreach t in array array['categories','products','product_images'] loop
  foreach command in array array['insert','update','delete'] loop
   execute format('drop policy if exists %I on public.%I','otr_guard_'||t||'_'||command,t);
   execute format('create policy %I on public.%I as restrictive for %s to anon,authenticated %s',
    'otr_guard_'||t||'_'||command,t,command,
    case when command='insert' then 'with check ('||guard||')'
     when command='update' then 'using ('||guard||') with check ('||guard||')'
     else 'using ('||guard||')' end);
  end loop;
 end loop;
 foreach t in array array['inquiries','newsletter_subscribers'] loop
  foreach command in array array['select','update','delete'] loop
   execute format('drop policy if exists %I on public.%I','otr_guard_'||t||'_'||command,t);
   execute format('create policy %I on public.%I as restrictive for %s to anon,authenticated using (%s)',
    'otr_guard_'||t||'_'||command,t,command,guard);
  end loop;
 end loop;
end $$;
commit;
