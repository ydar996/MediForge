-- Admin UI: list email that matches login/rate_limit (public.users), falling back to auth.users.
-- Fixes lock/unlock display when Auth email differs (e.g. custom domain vs org-scoped).

CREATE OR REPLACE FUNCTION public.get_organization_users(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  first_name text,
  last_name text,
  email text,
  role text,
  license_number text,
  phone text,
  gender text,
  organization_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.username,
    u.first_name,
    u.last_name,
    COALESCE(NULLIF(trim(u.email), ''), au.email::text, '') AS email,
    u.role,
    u.license_number,
    u.phone,
    u.gender,
    u.organization_id,
    u.created_at,
    u.updated_at
  FROM public.users u
  LEFT JOIN auth.users au ON au.id = u.auth_user_id
  WHERE u.organization_id = p_org_id
  ORDER BY u.created_at;
$$;
