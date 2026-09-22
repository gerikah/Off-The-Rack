-- Additive migration for the existing is_active-based storefront schema.
-- Apply after 002 and 003. Never replay historical 001_storefront.sql.
begin;
do $$ begin
 if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='newsletter_subscribers' and column_name='is_active') then
  raise exception 'Expected existing newsletter_subscribers.is_active schema; inspect your project before applying 004';
 end if;
end $$;

alter table public.newsletter_subscribers add column if not exists consent_at timestamptz;
alter table public.newsletter_subscribers add column if not exists consent_source text not null default 'legacy_unverified';
alter table public.newsletter_subscribers add column if not exists consent_verified_at timestamptz;
alter table public.newsletter_subscribers add column if not exists consent_verified_by uuid references auth.users(id) on delete set null;
alter table public.newsletter_subscribers add column if not exists unsubscribed_at timestamptz;
alter table public.newsletter_subscribers enable row level security;
create index if not exists otr_newsletter_email_normalized_idx on public.newsletter_subscribers(lower(trim(email)));
create index if not exists otr_newsletter_created_idx on public.newsletter_subscribers(created_at);

-- Keep all existing subscriber rows and policies. Tighten column privileges so
-- an old permissive INSERT policy cannot let visitors choose protected fields.
revoke insert, update, delete on public.newsletter_subscribers from public, anon, authenticated;
grant insert(email, is_active) on public.newsletter_subscribers to anon, authenticated;
drop policy if exists otr_newsletter_signup on public.newsletter_subscribers;
create policy otr_newsletter_signup on public.newsletter_subscribers for insert to anon, authenticated with check (is_active=true);

create or replace function public.otr_newsletter_signup_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.email := lower(trim(new.email));
 if length(new.email)>254 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception 'Invalid email' using errcode='22023';
 end if;
 -- Serialize duplicate and quota checks across all API instances/direct clients.
 perform pg_catalog.pg_advisory_xact_lock(718044);
 if exists(select 1 from public.newsletter_subscribers where lower(trim(email))=new.email) then
  raise exception 'Duplicate subscription' using errcode='23505';
 end if;
 if (select count(*) from public.newsletter_subscribers where created_at>now()-interval '1 minute')>=30
 or (select count(*) from public.newsletter_subscribers where created_at>now()-interval '1 day')>=1000 then
  raise exception 'Signup rate limit' using errcode='P0001';
 end if;
 new.is_active := true;
 new.created_at := now();
 new.consent_at := now();
 new.consent_source := 'storefront_signup';
 new.consent_verified_at := null;
 new.consent_verified_by := null;
 new.unsubscribed_at := null;
 return new;
end; $$;
revoke all on function public.otr_newsletter_signup_guard() from public, anon, authenticated;
drop trigger if exists otr_newsletter_signup_guard on public.newsletter_subscribers;
create trigger otr_newsletter_signup_guard before insert on public.newsletter_subscribers for each row execute function public.otr_newsletter_signup_guard();

-- Disable historical public signup RPC if present: it has no current consent UI.
-- The current API uses the insert path guarded above; no old function is dropped.
do $$ begin
 if to_regprocedure('public.subscribe_to_newsletter(text)') is not null then
  revoke execute on function public.subscribe_to_newsletter(text) from public, anon, authenticated;
 end if;
end $$;

create table if not exists public.newsletter_campaigns (
 id uuid primary key default gen_random_uuid(),
 subject text not null check(length(subject) between 3 and 150),
 body text not null check(length(body) between 20 and 20000),
 status text not null default 'draft' check(status in ('draft','sending','sent','paused')),
 recipient_count integer not null default 0,
 sent_count integer not null default 0,
 skipped_count integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 started_at timestamptz,
 completed_at timestamptz,
 last_test_at timestamptz
);
create table if not exists public.newsletter_batches (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.newsletter_campaigns(id),
 status text not null default 'sending' check(status in ('sending','sent','uncertain')),
 payload_hash text check(payload_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 last_attempt_at timestamptz not null default now(),
 completed_at timestamptz
);
create unique index if not exists otr_one_open_newsletter_batch on public.newsletter_batches(campaign_id) where status<>'sent';
create table if not exists public.newsletter_deliveries (
 campaign_id uuid not null references public.newsletter_campaigns(id),
 subscriber_id uuid not null references public.newsletter_subscribers(id),
 batch_id uuid references public.newsletter_batches(id),
 status text not null default 'queued' check(status in ('queued','sent','skipped')),
 provider_id text,
 sent_at timestamptz,
 primary key(campaign_id,subscriber_id)
);
create index if not exists otr_newsletter_queue_idx on public.newsletter_deliveries(campaign_id,status,batch_id);
create table if not exists public.newsletter_unsubscribe_tokens (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 subscriber_id uuid not null references public.newsletter_subscribers(id),
 created_at timestamptz not null default now()
);
create table if not exists public.newsletter_rate_limits (
 scope text primary key,
 touched_at timestamptz not null default now()
);
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_batches enable row level security;
alter table public.newsletter_deliveries enable row level security;
alter table public.newsletter_unsubscribe_tokens enable row level security;
alter table public.newsletter_rate_limits enable row level security;
-- These internal tables have no browser grants/policies; narrow checked RPCs only.
revoke all on public.newsletter_campaigns,public.newsletter_batches,public.newsletter_deliveries,public.newsletter_unsubscribe_tokens,public.newsletter_rate_limits from public,anon,authenticated;

create or replace function public.otr_newsletter_admin(action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 campaign public.newsletter_campaigns%rowtype;
 batch public.newsletter_batches%rowtype;
 campaign_id_value uuid;
 eligible_count integer;
 legacy_count integer;
 items jsonb;
 token_item jsonb;
 provider_index integer := 0;
 delivery_record record;
begin
 if not public.otr_is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if octet_length(payload::text)>40000 then raise exception 'Payload too large' using errcode='22023'; end if;
 -- The confirmed count and audience snapshot must describe the same rows.
 -- Self-conflicting mode also serializes simultaneous legacy verifications.
 if action in ('start','verify_legacy') then
  lock table public.newsletter_subscribers in share row exclusive mode;
 end if;
 select count(distinct lower(trim(email))) into eligible_count from public.newsletter_subscribers
 where is_active and consent_source in ('storefront_signup','legacy_verified');
 select count(*) into legacy_count from public.newsletter_subscribers where is_active and consent_source='legacy_unverified';
 if action='dashboard' then
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc),'[]'::jsonb) into items from
   (select * from public.newsletter_campaigns order by created_at desc limit 30) c;
  return jsonb_build_object('eligible',eligible_count,'legacy',legacy_count,'campaigns',items);
 end if;
 if action='verify_legacy' then
  if coalesce((payload->>'confirmed')::boolean,false) is not true or (payload->>'expected_count')::integer is distinct from legacy_count then
   return jsonb_build_object('error','count_changed');
  end if;
  update public.newsletter_subscribers set consent_source='legacy_verified',consent_verified_at=now(),consent_verified_by=auth.uid()
   where is_active and consent_source='legacy_unverified';
  return jsonb_build_object('ok',true);
 end if;
 campaign_id_value := (payload->>'id')::uuid;
 if campaign_id_value is null then return jsonb_build_object('error','invalid_state'); end if;
 if action='create' then
  if length(trim(coalesce(payload->>'subject',''))) not between 3 and 150 or (payload->>'subject') ~ '[[:cntrl:]]'
  or length(trim(coalesce(payload->>'body',''))) not between 20 and 20000 then return jsonb_build_object('error','invalid_content'); end if;
  -- Client-generated ID makes a repeated save idempotent.
  perform pg_catalog.pg_advisory_xact_lock(718045);
  if exists(select 1 from public.newsletter_campaigns where id=campaign_id_value) then
   if not exists(select 1 from public.newsletter_campaigns where id=campaign_id_value and subject=trim(payload->>'subject') and body=trim(payload->>'body')) then
    return jsonb_build_object('error','invalid_state');
   end if;
   return jsonb_build_object('id',campaign_id_value);
  end if;
  if (select count(*) from public.newsletter_campaigns where created_at>now()-interval '1 day')>=20 then return jsonb_build_object('error','rate_limited'); end if;
  insert into public.newsletter_campaigns(id,subject,body,created_by) values(campaign_id_value,trim(payload->>'subject'),trim(payload->>'body'),auth.uid());
  return jsonb_build_object('id',campaign_id_value);
 end if;
 select * into campaign from public.newsletter_campaigns where id=campaign_id_value for update;
 if not found then return jsonb_build_object('error','invalid_state'); end if;
 if action='test' then
  if campaign.status<>'draft' then return jsonb_build_object('error','invalid_state'); end if;
  perform pg_catalog.pg_advisory_xact_lock(718046);
  if exists(select 1 from public.newsletter_rate_limits where scope='test' and touched_at>now()-interval '1 minute') then return jsonb_build_object('error','rate_limited'); end if;
  if exists(select 1 from public.newsletter_rate_limits where scope='provider' and touched_at>now()-interval '2 seconds') then return jsonb_build_object('error','rate_limited'); end if;
  insert into public.newsletter_rate_limits(scope) values('test') on conflict(scope) do update set touched_at=now();
  insert into public.newsletter_rate_limits(scope) values('provider') on conflict(scope) do update set touched_at=now();
  update public.newsletter_campaigns set last_test_at=now() where id=campaign_id_value;
  return jsonb_build_object('campaign',to_jsonb(campaign));
 elsif action='start' then
  if campaign.status in ('sending','sent') then return jsonb_build_object('ok',true); end if;
  if campaign.status<>'draft' or coalesce((payload->>'confirmed')::boolean,false) is not true then return jsonb_build_object('error','invalid_state'); end if;
  if eligible_count=0 then return jsonb_build_object('error','no_recipients'); end if;
  if (payload->>'expected_count')::integer is distinct from eligible_count then return jsonb_build_object('error','count_changed'); end if;
  insert into public.newsletter_deliveries(campaign_id,subscriber_id)
   select campaign_id_value,id from (select distinct on(lower(trim(email))) id,email from public.newsletter_subscribers
    where is_active and consent_source in ('storefront_signup','legacy_verified') order by lower(trim(email)),created_at,id) s;
  update public.newsletter_campaigns set status='sending',started_at=now(),recipient_count=eligible_count where id=campaign_id_value;
  return jsonb_build_object('ok',true);
 elsif action='claim' then
  if campaign.status='sent' then return jsonb_build_object('done',true); end if;
  if campaign.status='paused' then return jsonb_build_object('error','paused'); end if;
  if campaign.status<>'sending' then return jsonb_build_object('error','invalid_state'); end if;
  select * into batch from public.newsletter_batches where campaign_id=campaign_id_value and status<>'sent' for update;
  if found then
   -- Resend keeps idempotency keys 24h. Never retry an uncertain older request.
   if batch.status='uncertain' or batch.created_at<now()-interval '23 hours'
   or exists(select 1 from public.newsletter_deliveries d join public.newsletter_subscribers s on s.id=d.subscriber_id where d.batch_id=batch.id and not s.is_active) then
    update public.newsletter_batches set status='uncertain' where id=batch.id;
    update public.newsletter_campaigns set status='paused' where id=campaign_id_value;
    return jsonb_build_object('error','paused');
   end if;
   if batch.last_attempt_at>now()-interval '60 seconds' then return jsonb_build_object('error','busy'); end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(718046);
  if exists(select 1 from public.newsletter_rate_limits where scope='provider' and touched_at>now()-interval '2 seconds') then return jsonb_build_object('error','rate_limited'); end if;
  insert into public.newsletter_rate_limits(scope) values('provider') on conflict(scope) do update set touched_at=now();
  if batch.id is null then
   update public.newsletter_deliveries d set status='skipped' where d.campaign_id=campaign_id_value and d.status='queued' and d.batch_id is null
    and not exists(select 1 from public.newsletter_subscribers s where s.id=d.subscriber_id and s.is_active and s.consent_source in ('storefront_signup','legacy_verified'));
   update public.newsletter_campaigns set skipped_count=(select count(*) from public.newsletter_deliveries where campaign_id=campaign_id_value and status='skipped') where id=campaign_id_value;
   if not exists(select 1 from public.newsletter_deliveries where campaign_id=campaign_id_value and status='queued') then
    update public.newsletter_campaigns set status='sent',completed_at=now() where id=campaign_id_value;
    return jsonb_build_object('done',true);
   end if;
   insert into public.newsletter_batches(campaign_id) values(campaign_id_value) returning * into batch;
   update public.newsletter_deliveries set batch_id=batch.id where campaign_id=campaign_id_value and subscriber_id in
    (select subscriber_id from public.newsletter_deliveries where campaign_id=campaign_id_value and status='queued' and batch_id is null order by subscriber_id limit 25);
  else
   update public.newsletter_batches set last_attempt_at=now() where id=batch.id;
  end if;
  select jsonb_agg(jsonb_build_object('id',s.id,'email',s.email) order by s.id) into items
   from public.newsletter_deliveries d join public.newsletter_subscribers s on s.id=d.subscriber_id where d.batch_id=batch.id;
  return jsonb_build_object('batch_id',batch.id,'campaign',to_jsonb(campaign),'recipients',items);
 elsif action in ('prepare','complete') then
  select * into batch from public.newsletter_batches where id=(payload->>'batch_id')::uuid and campaign_id=campaign_id_value for update;
  if not found or campaign.status<>'sending' or batch.status<>'sending' then return jsonb_build_object('error','invalid_state'); end if;
  if action='prepare' then
   if (payload->>'payload_hash') !~ '^[a-f0-9]{64}$' or payload->>'payload_hash' is null then return jsonb_build_object('error','invalid_state'); end if;
   if (batch.payload_hash is not null and batch.payload_hash<>payload->>'payload_hash') or batch.created_at<now()-interval '23 hours'
   or exists(select 1 from public.newsletter_deliveries d join public.newsletter_subscribers s on s.id=d.subscriber_id
    where d.batch_id=batch.id and (not s.is_active or s.consent_source not in ('storefront_signup','legacy_verified'))) then
    update public.newsletter_batches set status='uncertain' where id=batch.id;
    update public.newsletter_campaigns set status='paused' where id=campaign_id_value;
    return jsonb_build_object('error','paused');
   end if;
   if jsonb_typeof(payload->'tokens') is distinct from 'array' then return jsonb_build_object('error','invalid_state'); end if;
   if jsonb_array_length(payload->'tokens')<>(select count(*) from public.newsletter_deliveries where batch_id=batch.id)
   or (select count(distinct value->>'id') from jsonb_array_elements(payload->'tokens'))<>jsonb_array_length(payload->'tokens') then return jsonb_build_object('error','invalid_state'); end if;
   for token_item in select value from jsonb_array_elements(payload->'tokens') loop
    if not exists(select 1 from public.newsletter_deliveries where batch_id=batch.id and subscriber_id=(token_item->>'id')::uuid) then raise exception 'Invalid token recipient'; end if;
    insert into public.newsletter_unsubscribe_tokens(token_hash,subscriber_id) values(token_item->>'hash',(token_item->>'id')::uuid) on conflict(token_hash) do nothing;
   end loop;
   update public.newsletter_batches set payload_hash=payload->>'payload_hash' where id=batch.id;
  else
   if batch.payload_hash is null or jsonb_typeof(payload->'provider_ids') is distinct from 'array' then return jsonb_build_object('error','invalid_state'); end if;
   if jsonb_array_length(payload->'provider_ids')<>(select count(*) from public.newsletter_deliveries where batch_id=batch.id)
   or exists(select 1 from jsonb_array_elements(payload->'provider_ids') v where jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}') not between 1 and 200) then return jsonb_build_object('error','invalid_state'); end if;
   for delivery_record in select subscriber_id from public.newsletter_deliveries where batch_id=batch.id order by subscriber_id loop
    update public.newsletter_deliveries set status='sent',sent_at=now(),provider_id=payload->'provider_ids'->>provider_index where campaign_id=campaign_id_value and subscriber_id=delivery_record.subscriber_id;
    provider_index := provider_index+1;
   end loop;
   update public.newsletter_batches set status='sent',completed_at=now() where id=batch.id;
   update public.newsletter_campaigns set sent_count=(select count(*) from public.newsletter_deliveries where campaign_id=campaign_id_value and status='sent'),
    status=case when exists(select 1 from public.newsletter_deliveries where campaign_id=campaign_id_value and status='queued') then 'sending' else 'sent' end,
    completed_at=case when not exists(select 1 from public.newsletter_deliveries where campaign_id=campaign_id_value and status='queued') then now() else null end where id=campaign_id_value;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 return jsonb_build_object('error','invalid_state');
end; $$;
alter function public.otr_newsletter_admin(text,jsonb) owner to postgres;
revoke all on function public.otr_newsletter_admin(text,jsonb) from public,anon;
grant execute on function public.otr_newsletter_admin(text,jsonb) to authenticated;

create or replace function public.otr_newsletter_unsubscribe(token_hash_value text) returns void
language plpgsql security definer set search_path='' as $$
declare target_email text;
begin
 if token_hash_value !~ '^[a-f0-9]{64}$' then return; end if;
 select lower(trim(s.email)) into target_email from public.newsletter_unsubscribe_tokens t
 join public.newsletter_subscribers s on s.id=t.subscriber_id where t.token_hash=token_hash_value;
 -- Unsubscribe every historical spelling/duplicate of this address, retaining rows.
 update public.newsletter_subscribers set is_active=false,unsubscribed_at=coalesce(unsubscribed_at,now())
 where lower(trim(email))=target_email and is_active;
end; $$;
alter function public.otr_newsletter_unsubscribe(text) owner to postgres;
revoke all on function public.otr_newsletter_unsubscribe(text) from public;
grant execute on function public.otr_newsletter_unsubscribe(text) to anon,authenticated;
commit;
