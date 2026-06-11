-- RLS security hardening: remove permissive policies; use SECURITY DEFINER RPCs for anon login/org lookup.
-- Apply on dev first; test registration + login + patient portal before production.

-- ---------------------------------------------------------------------------
-- 1) RPC: organization by code (replaces anon SELECT * FROM organizations)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_organization_code(p_org_code text)
RETURNS TABLE (
  id uuid,
  name text,
  org_code text,
  country text,
  state text,
  city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.org_code, o.country, o.state, o.city
  FROM public.organizations o
  WHERE lower(trim(o.org_code)) = lower(trim(p_org_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_organization_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_organization_code(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) RPC: single user lookup for login / username check (replaces broad users SELECT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_user_public_login(
  p_identifier text,
  p_type text DEFAULT 'username',
  p_role text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  auth_user_id uuid,
  organization_id uuid,
  first_name text,
  last_name text,
  role text,
  patient_id uuid,
  temp_password text,
  password_reset_required boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.username,
    u.email,
    u.auth_user_id,
    u.organization_id,
    u.first_name,
    u.last_name,
    u.role,
    u.patient_id,
    u.temp_password,
    u.password_reset_required
  FROM public.users u
  WHERE (
    (lower(trim(COALESCE(p_type, 'username'))) = 'username'
      AND lower(trim(u.username)) = lower(trim(p_identifier)))
    OR
    (lower(trim(COALESCE(p_type, 'username'))) = 'email'
      AND lower(trim(u.email)) = lower(trim(p_identifier)))
  )
  AND (
    p_role IS NULL
    OR trim(p_role) = ''
    OR u.role = p_role
    OR lower(u.role) = lower(trim(p_role))
  )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_user_public_login(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_user_public_login(text, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) RPC: username availability (registration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE lower(trim(u.username)) = lower(trim(p_username))
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Drop / replace dangerous policies (names must match production)
-- ---------------------------------------------------------------------------

-- users: remove global read for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.users;

-- organizations
DROP POLICY IF EXISTS "Allow org_code verification for registration" ON public.organizations;
DROP POLICY IF EXISTS "Allow platform admin deletions" ON public.organizations;
DROP POLICY IF EXISTS "org_insert_public" ON public.organizations;

-- Anon cannot enumerate organizations; use verify_organization_code() only.
-- Authenticated users keep existing policies (own org, platform admin selects, etc.)

-- Registration: allow anon + authenticated to insert org with required fields (new clinic signup)
DROP POLICY IF EXISTS "organizations_insert_registration" ON public.organizations;
CREATE POLICY "organizations_insert_registration"
  ON public.organizations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    trim(COALESCE(name, '')) <> ''
    AND trim(COALESCE(org_code, '')) <> ''
  );

-- Platform admins only can delete organizations
DROP POLICY IF EXISTS "organizations_delete_platform_admin_only" ON public.organizations;
CREATE POLICY "organizations_delete_platform_admin_only"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());

-- appointments / patients: migration-era open inserts
DROP POLICY IF EXISTS "Allow public insert for migration" ON public.appointments;
DROP POLICY IF EXISTS "Allow public insert for migration" ON public.patients;

-- audit_logs: remove unrestricted insert
DROP POLICY IF EXISTS "Allow inserting audit logs" ON public.audit_logs;

-- payment_receipts: remove global authenticated read
DROP POLICY IF EXISTS "Allow viewing payment receipts" ON public.payment_receipts;

-- security_events: pre-login events may use anon key — require typed events (not wide open true)
DROP POLICY IF EXISTS "Allow inserting security events" ON public.security_events;
DROP POLICY IF EXISTS "security_events_insert_typed" ON public.security_events;

CREATE POLICY "security_events_insert_typed"
  ON public.security_events
  FOR INSERT
  TO public
  WITH CHECK (
    event_type IS NOT NULL
    AND trim(event_type) <> ''
    AND length(trim(event_type)) <= 200
  );

-- rate_limits: remove open insert; service_role policy remains for backend RPC
DROP POLICY IF EXISTS "Allow rate limit inserts" ON public.rate_limits;
