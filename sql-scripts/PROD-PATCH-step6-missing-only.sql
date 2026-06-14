-- Prod patch: Step 6 items only (safe after Step 10 — does NOT re-add tribe column)
-- Run once on MediForge-Prod, then re-run DIAGNOSE-release-readiness-SUMMARY-only.sql

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
