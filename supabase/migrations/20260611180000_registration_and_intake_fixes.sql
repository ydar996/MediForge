-- Registration + patient intake fixes (idempotent). Run on Dev and Staging.

-- -----------------------------------------------------------------------------
-- 1. Columns required by clinic registration and intake approval
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS after_hours_phone TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'Self Pay',
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS tribe TEXT;

-- -----------------------------------------------------------------------------
-- 2. Clinic registration RLS (orgs + users)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.organizations;
DROP POLICY IF EXISTS "Allow organization creation during registration" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_registration" ON public.organizations;

CREATE POLICY "organizations_insert_registration"
  ON public.organizations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    trim(COALESCE(name, '')) <> ''
    AND trim(COALESCE(org_code, '')) <> ''
  );

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Allow user creation during registration" ON public.users;

CREATE POLICY "Allow user creation during registration"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- -----------------------------------------------------------------------------
-- 3. Org UPDATE — allow Admin role to activate org after registration
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own organization" ON public.organizations;

CREATE POLICY "Users can update own organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE auth_user_id = auth.uid()
        AND lower(trim(role)) IN ('admin', 'administrator')
    )
  );

-- -----------------------------------------------------------------------------
-- 4. RPC: org intake context for public patient form (anon cannot SELECT orgs)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_organization_intake_context(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  country text,
  state text,
  city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.country, o.state, o.city
  FROM public.organizations o
  WHERE o.id = p_org_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_organization_intake_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_intake_context(uuid) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Intake approval RPC — service_role only (Netlify proxy)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.approve_patient_intake_submission(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_patient_intake_submission(uuid, text, text, uuid) TO service_role;
