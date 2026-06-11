-- Run this in Supabase Dashboard → SQL Editor (once per project: dev, staging, prod).
-- "status" = OK means that piece is already there; MISSING means paste the matching migration file.

SELECT 'RLS tightening (helpers + clinical_notes policy)' AS what_to_check,
       CASE
         WHEN EXISTS (
           SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'auth_is_org_staff_or_platform_admin'
         )
         AND EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'clinical_notes'
             AND policyname = 'clinical_notes_staff_all_org'
         )
         THEN 'OK — already applied (skip 20260519130000)'
         ELSE 'MISSING — run supabase/migrations/20260519130000_security_rls_clinical_billing_tightening.sql'
       END AS status

UNION ALL

SELECT 'Platform dashboard read (patients/appointments/users policies)',
       CASE
         WHEN EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public' AND policyname = 'platform_admins_select_all_patients'
         )
         AND EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public' AND policyname = 'platform_admins_select_all_appointments'
         )
         THEN 'OK — already applied (skip 20260520140000)'
         ELSE 'MISSING — run supabase/migrations/20260520140000_platform_admin_dashboard_cross_org_read.sql'
       END

UNION ALL

SELECT 'Appointments loader (get_appointments_for_org function)',
       CASE
         WHEN EXISTS (
           SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'get_appointments_for_org'
         )
         THEN 'OK — already applied (skip 20260520150000)'
         ELSE 'MISSING — run supabase/migrations/20260520150000_get_appointments_for_org_rpc.sql'
       END

ORDER BY 1;
