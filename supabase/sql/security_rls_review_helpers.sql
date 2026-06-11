-- MediForge — optional RLS review helpers (run in Supabase SQL Editor as admin).
-- Does not change schema; use for periodic audits alongside Dashboard → Authentication → Policies.

-- Tables in public schema with RLS enabled/disabled
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- Policy names per table (PostgreSQL 15+)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
