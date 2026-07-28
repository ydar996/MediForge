-- Allow founding members (any clinical role) to activate their new org after registration.
-- Previously UPDATE was admin-only, so a Doctor founder could not set status=active / contact email.

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

COMMENT ON FUNCTION public.finalize_new_organization(uuid, text) IS
  'Post-registration: any org member may activate a pending organization and set contact email. Does not change clinical role.';
