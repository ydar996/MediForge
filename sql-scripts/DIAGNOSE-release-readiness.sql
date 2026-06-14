-- =============================================================================
-- MediForge release diagnostics — single script, read-only, safe to re-run
-- Run in Supabase SQL Editor on MediForge Staging OR MediForge-Prod
-- Paste entire file → Run once → read the summary + detail sections
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SUMMARY (read this first): one row per requirement — OK or MISSING
-- -----------------------------------------------------------------------------
WITH expected AS (
  SELECT * FROM (VALUES
    ('table',  'patient_intake_submissions',        'Step 2 — patient self-intake'),
    ('table',  'interop_messages',                  'Step 4 — interoperability queue'),
    ('table',  'patient_payer_profiles',            'Step 5 — billing / payers'),
    ('column', 'patients.race',                     'Steps 8–10 — race demographics'),
    ('column', 'patients.tribe',                    'Should be ABSENT after Step 10'),
    ('function', 'approve_patient_intake_submission', 'Steps 3/9/10 — intake approval'),
    ('function', 'get_organization_intake_context',   'Step 6 — public intake form'),
    ('function', 'complete_registration_user_profile','Step 7 — join-org registration'),
    ('policy', 'organizations:organizations_insert_registration', 'Step 6 — clinic signup'),
    ('policy', 'organizations:Users can update own organization', 'Step 6 — org activation'),
    ('policy', 'users:Allow user creation during registration',     'Step 1/6 — profile insert'),
    ('policy', 'users:Users can view own profile',                    'Step 7 — own profile read')
  ) AS t(kind, name, notes)
),
present_tables AS (
  SELECT table_name AS name
  FROM information_schema.tables
  WHERE table_schema = 'public'
),
present_columns AS (
  SELECT table_name || '.' || column_name AS name
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
present_functions AS (
  SELECT p.proname AS name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
present_policies AS (
  SELECT tablename || ':' || policyname AS name
  FROM pg_policies
  WHERE schemaname = 'public'
)
SELECT
  e.kind,
  e.name AS requirement,
  e.notes,
  CASE
    WHEN e.kind = 'column' AND e.name = 'patients.tribe' THEN
      CASE WHEN EXISTS (
        SELECT 1 FROM present_columns WHERE name = 'patients.tribe'
      ) THEN 'SHOULD REMOVE (run Step 10)' ELSE 'OK (absent)' END
    WHEN e.kind = 'table' THEN
      CASE WHEN EXISTS (SELECT 1 FROM present_tables t WHERE t.name = e.name)
        THEN 'OK' ELSE 'MISSING'
      END
    WHEN e.kind = 'column' THEN
      CASE WHEN EXISTS (SELECT 1 FROM present_columns c WHERE c.name = e.name)
        THEN 'OK' ELSE 'MISSING'
      END
    WHEN e.kind = 'function' THEN
      CASE WHEN EXISTS (SELECT 1 FROM present_functions f WHERE f.name = e.name)
        THEN 'OK' ELSE 'MISSING'
      END
    WHEN e.kind = 'policy' THEN
      CASE WHEN EXISTS (SELECT 1 FROM present_policies p WHERE p.name = e.name)
        THEN 'OK' ELSE 'MISSING'
      END
  END AS status
FROM expected e
ORDER BY
  CASE WHEN e.kind = 'table' THEN 1
       WHEN e.kind = 'column' THEN 2
       WHEN e.kind = 'function' THEN 3
       WHEN e.kind = 'policy' THEN 4 END,
  e.name;


-- -----------------------------------------------------------------------------
-- DETAIL: registration-related policies (all matches, not just named ones)
-- -----------------------------------------------------------------------------
SELECT
  'policies_detail' AS check_type,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'users')
  AND (
    policyname ILIKE '%registration%'
    OR policyname ILIKE '%org_code%'
    OR policyname = 'Users can update own organization'
    OR policyname = 'Users can view own profile'
  )
ORDER BY tablename, policyname;


-- -----------------------------------------------------------------------------
-- DETAIL: patient address / payer columns (Steps 1, 6)
-- -----------------------------------------------------------------------------
SELECT
  'patient_columns_detail' AS check_type,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patients'
  AND column_name IN (
    'address_line1', 'address_line2', 'postal_code',
    'payment_source', 'marital_status', 'race', 'tribe'
  )
ORDER BY column_name;


-- -----------------------------------------------------------------------------
-- DETAIL: organization registration columns (Step 1, 6)
-- -----------------------------------------------------------------------------
SELECT
  'organization_columns_detail' AS check_type,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND column_name IN (
    'address_line1', 'address_line2', 'postal_code', 'after_hours_phone', 'created_by'
  )
ORDER BY column_name;


-- -----------------------------------------------------------------------------
-- DETAIL: optional interop / billing tables (Step 4, 5)
-- -----------------------------------------------------------------------------
SELECT
  'optional_tables_detail' AS check_type,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'patient_identifiers',
    'interop_endpoints',
    'insurance_claims',
    'payment_plans',
    'remittance_records'
  )
ORDER BY table_name;
