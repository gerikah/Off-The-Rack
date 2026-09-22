-- Read-only inspection for the existing project. Run in Supabase SQL Editor.
-- Returns schema/policies/grants, not customer rows or credentials.
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind='r' order by 1,2;
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
order by table_name,ordinal_position;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select table_schema,table_name,grantee,privilege_type
from information_schema.table_privileges
where table_schema in ('public','storage') and grantee in ('PUBLIC','anon','authenticated')
order by table_schema,table_name,grantee,privilege_type;
select table_name,column_name,grantee,privilege_type
from information_schema.column_privileges
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated')
order by table_name,column_name,grantee;
select n.nspname as schema_name,p.proname as function_name,pg_get_userbyid(p.proowner) as owner,
p.prosecdef as security_definer,p.proconfig as settings,
has_function_privilege('anon',p.oid,'execute') as anon_execute,
has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.proname;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id;
-- Expected after setup: every exposed app table has RLS; only catalog rows are
-- public-readable; private customer tables are protected; no non-admin catalog
-- mutations; no direct admin_users or newsletter-internal-table access.
-- Inspect ALL existing bucket policies. Product-images is intentionally public;
-- other buckets are not modified by the new migrations.

select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='public'::regnamespace order by 1,2;
select schemaname,viewname,definition from pg_views where schemaname='public';
