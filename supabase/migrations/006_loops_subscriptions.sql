-- Apply after 002-005 to the existing schema. No rows are deleted or recreated.
begin;

-- Stop safely if legacy case/whitespace variants exist. Review/merge them with
-- their consent and delivery history before retrying; never silently discard rows.
do $$ begin
 if exists(select 1 from public.newsletter_subscribers group by lower(trim(email)) having count(*)>1) then
  raise exception 'Duplicate normalized subscriber emails exist; review existing records before applying 006';
 end if;
end $$;
do $$ begin
 if not exists (
  select 1 from pg_catalog.pg_constraint c
  join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attname='email'
  where c.conrelid='public.newsletter_subscribers'::regclass
  and c.contype='u' and c.conkey=array[a.attnum]
 ) then
  alter table public.newsletter_subscribers add constraint otr_newsletter_email_key unique(email);
 end if;
end $$;
create unique index if not exists otr_newsletter_normalized_unique on public.newsletter_subscribers(lower(trim(email)));

create table if not exists public.newsletter_signup_attempts (
 id uuid primary key default gen_random_uuid(),
 email_hash text not null,
 created_at timestamptz not null default now()
);
create index if not exists otr_signup_attempt_email_time on public.newsletter_signup_attempts(email_hash,created_at);
create index if not exists otr_signup_attempt_time on public.newsletter_signup_attempts(created_at);
alter table public.newsletter_signup_attempts enable row level security;
revoke all on public.newsletter_signup_attempts from public,anon,authenticated;

-- This narrow write RPC needs no service-role key and returns no subscriber IDs
-- or customer rows. Existing restrictive table policies and column grants stay.
create or replace function public.otr_subscribe_newsletter(email_value text,consent_value boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 normalized text := lower(trim(email_value));
 subscriber public.newsletter_subscribers%rowtype;
 email_fingerprint text;
 outcome text;
begin
 if consent_value is distinct from true or normalized is null
 or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
  raise exception 'Valid email and consent required' using errcode='22023';
 end if;
 -- Same lock as 004's insert trigger: serialize upserts and direct inserts.
 perform pg_catalog.pg_advisory_xact_lock(718044);
 email_fingerprint := pg_catalog.md5(normalized);
 delete from public.newsletter_signup_attempts where created_at<now()-interval '1 day';
 select * into subscriber from public.newsletter_subscribers where lower(trim(email))=normalized for update;
 if exists(select 1 from public.newsletter_signup_attempts where email_hash=email_fingerprint and created_at>now()-interval '1 minute') then
  -- An immediate repeat cannot trigger another provider request or email.
  if subscriber.is_active then
   return jsonb_build_object('status','already_subscribed','sync',false);
  end if;
  raise exception 'Please wait before subscribing again' using errcode='P0001';
 end if;
 if (select count(*) from public.newsletter_signup_attempts where email_hash=email_fingerprint)>=10
 or (select count(*) from public.newsletter_signup_attempts where created_at>now()-interval '1 minute')>=30
 or (select count(*) from public.newsletter_signup_attempts)>=1000 then
  raise exception 'Please wait before subscribing again' using errcode='P0001';
 end if;
 insert into public.newsletter_signup_attempts(email_hash) values(email_fingerprint);
 if subscriber.id is null then
  insert into public.newsletter_subscribers(email,is_active) values(normalized,true);
  outcome := 'subscribed';
 else
  outcome := case when subscriber.is_active then 'already_subscribed' else 'reactivated' end;
  update public.newsletter_subscribers set
   email=normalized,is_active=true,unsubscribed_at=null,
   consent_at=now(),consent_source='storefront_signup',
   consent_verified_at=null,consent_verified_by=null
  where id=subscriber.id;
 end if;
 return jsonb_build_object('status',outcome,'sync',true);
end; $$;
revoke all on function public.otr_subscribe_newsletter(text,boolean) from public,anon,authenticated;
grant execute on function public.otr_subscribe_newsletter(text,boolean) to anon,authenticated;
commit;
