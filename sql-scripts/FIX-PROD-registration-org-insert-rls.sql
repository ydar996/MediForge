-- =============================================================================
-- REQUIRED on MediForge-Prod (and Dev/Staging if registration insert fails)
-- Restores anonymous clinic signup INSERT policy + founder finalize RPC.
--
-- How to run:
--   1. Supabase Dashboard -> MediForge-Prod -> SQL Editor -> New query
--   2. Paste this entire file -> Run
--   3. Retry https://mediforge.netlify.app/register
-- =============================================================================

-- 1) Allow new clinics to register (anon inserts before the founder has an account)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.organizations TO anon, authenticated;
GRANT SELECT ON TABLE public.organizations TO authenticated;

DROP POLICY IF EXISTS "organizations_insert_registration" ON public.organizations;
DROP POLICY IF EXISTS "Allow organization creation during registration" ON public.organizations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.organizations;
DROP POLICY IF EXISTS "org_insert_public" ON public.organizations;

CREATE POLICY "organizations_insert_registration"
  ON public.organizations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    trim(COALESCE(name, '')) <> ''
    AND trim(COALESCE(org_code, '')) <> ''
  );

-- 2) Founding member (any clinical role) can activate pending org + set contact email
CREATE OR REPLACE FUNCTION public.finalize_new_organization(
  p_organization_id uuid,
  p_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  UPDATE public.organizations
  SET
    status = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
    email = COALESCE(NULLIF(trim(p_email), ''), email)
  WHERE id = p_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_new_organization(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_new_organization(uuid, text) TO authenticated;

-- 3) Quick verify (should show organizations_insert_registration / INSERT)
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'organizations'
  AND policyname = 'organizations_insert_registration';
