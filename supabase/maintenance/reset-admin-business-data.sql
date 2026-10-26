-- ONE-TIME MANUAL RESET for Off The Rack project hjujwgfqaxrbcdlcymst.
-- Run as the database owner in that project's SQL editor, not as a migration.
-- Removes products, images' database references, categories, inquiries, and
-- newsletter records. Auth users, admin access, schema, and Storage files remain.
-- A private backup is created before deletion; any error rolls everything back.
-- The fixed backup schema makes an accidental second run fail without deleting.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $reset$
declare
  backup_schema constant text := 'otr_reset_backup_20261026';
  -- Child rows precede parents. Deliberately no CASCADE or schema-wide TRUNCATE.
  reset_tables constant text[] := array[
    'newsletter_deliveries',
    'newsletter_batches',
    'newsletter_unsubscribe_tokens',
    'newsletter_campaigns',
    'newsletter_subscribers',
    'newsletter_rate_limits',
    'inquiries',
    'product_images',
    'products',
    'categories'
  ];
  table_name text;
  relation_ids oid[] := array[]::oid[];
  dependency text;
  rows_before bigint;
  rows_after bigint;
  admins_before bigint;
  auth_users_before bigint;
begin
  -- Refuse projects without the application's core tables.
  if to_regclass('public.products') is null
     or to_regclass('public.product_images') is null
     or to_regclass('public.categories') is null
     or to_regclass('public.inquiries') is null
     or to_regclass('public.admin_users') is null
     or to_regclass('auth.users') is null then
    raise exception 'This is not the expected Off The Rack database. Reset cancelled.';
  end if;
  if to_regnamespace(backup_schema) is not null then
    raise exception 'Backup schema % already exists. Reset cancelled.', backup_schema;
  end if;

  foreach table_name in array reset_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      relation_ids := array_append(relation_ids, to_regclass(format('public.%I', table_name))::oid);
    end if;
  end loop;

  -- Refuse to cascade into an unrelated table, including custom extensions.
  select string_agg(c.conrelid::regclass::text || ' (' || c.conname || ')', ', ')
  into dependency
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid = any(relation_ids)
    and not (c.conrelid = any(relation_ids));
  if dependency is not null then
    raise exception 'Unexpected dependent tables: %. Reset cancelled.', dependency;
  end if;

  -- Prevent writes between the backup and deletion while allowing ordinary reads.
  foreach table_name in array reset_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('lock table public.%I in share row exclusive mode', table_name);
    end if;
  end loop;
  lock table public.admin_users, auth.users in share mode;
  select count(*) into admins_before from public.admin_users;
  select count(*) into auth_users_before from auth.users;

  execute format('create schema %I', backup_schema);
  execute format('revoke all on schema %I from public, anon, authenticated', backup_schema);
  foreach table_name in array reset_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('create table %I.%I as table public.%I', backup_schema, table_name, table_name);
      execute format('revoke all on table %I.%I from public, anon, authenticated', backup_schema, table_name);
      execute format('alter table %I.%I enable row level security', backup_schema, table_name);
    end if;
  end loop;

  foreach table_name in array reset_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*) from public.%I', table_name) into rows_before;
      execute format('delete from public.%I', table_name);
      execute format('select count(*) from public.%I', table_name) into rows_after;
      if rows_after <> 0 then
        raise exception 'Table % is not empty. Reset cancelled.', table_name;
      end if;
      raise notice 'Cleared %: % records. Backup: %.%', table_name, rows_before, backup_schema, table_name;
    end if;
  end loop;

  if (select count(*) from public.admin_users) <> admins_before
     or (select count(*) from auth.users) <> auth_users_before then
    raise exception 'Account counts changed. Reset cancelled.';
  end if;
end;
$reset$;

commit;

-- Image cleanup tombstones are retained to preserve deletion/attachment safety.
-- Backup records are readable only by the database owner unless access is granted.
