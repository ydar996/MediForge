-- =============================================================================
-- MediForge Dev & Staging — idempotent SQL packet (Step 1 of SQL-RUN-PACKET-DEV-STAGING.md)
-- Safe to re-run. Run in Supabase SQL Editor on MediForge Dev, then MediForge Staging.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Organization address columns (clinic registration)
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS after_hours_phone TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- postal_code already exists on organizations in core schema; no-op if present

-- -----------------------------------------------------------------------------
-- 2. Patient address + demographics columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS tribe TEXT,
  ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'Self Pay';

-- postal_code, city, state, country already in core schema

-- -----------------------------------------------------------------------------
-- 3. Clinic registration — organizations RLS
--     Allows new clinic signup + org-code lookup when joining a clinic
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.organizations;
DROP POLICY IF EXISTS "Allow organization creation during registration" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "org_select_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "org_select_anon" ON public.organizations;
DROP POLICY IF EXISTS "Allow org_code verification for registration" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organization details" ON public.organizations;

CREATE POLICY "Allow organization creation during registration"
  ON public.organizations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow org_code verification for registration"
  ON public.organizations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can view own organization details"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid()
        AND role IN ('PlatformOwner', 'PlatformAdmin')
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Clinic registration — users RLS
--     Allows profile row insert after Supabase Auth signup
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Allow user creation during registration" ON public.users;

CREATE POLICY "Allow user creation during registration"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

COMMENT ON POLICY "Allow user creation during registration" ON public.users IS
  'Registration: authenticated user may insert only their own profile row';

-- -----------------------------------------------------------------------------
-- 5. Verification (read-only — safe to re-run)
-- -----------------------------------------------------------------------------
SELECT 'organizations columns' AS check_type,
       column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND column_name IN ('address_line1', 'address_line2', 'postal_code', 'after_hours_phone')
ORDER BY column_name;

SELECT 'patients columns' AS check_type,
       column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patients'
  AND column_name IN ('address_line1', 'postal_code', 'marital_status', 'tribe', 'payment_source')
ORDER BY column_name;

SELECT 'registration policies' AS check_type,
       tablename,
       policyname,
       cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'users')
  AND (
    policyname ILIKE '%registration%'
    OR policyname ILIKE '%org_code%'
  )
ORDER BY tablename, policyname;

-- =============================================================================
-- Next: run Steps 2–5 from SQL-RUN-PACKET-DEV-STAGING.md
-- =============================================================================
