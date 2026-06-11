-- Expose auth.users.email as auth_email so admin UIs can match rate_limits (keyed by actual login email)
-- when public.users.email differs (e.g. placeholder @mediforge.app vs custom domain in Supabase Auth).

-- PG cannot change RETURNS TABLE shape with CREATE OR REPLACE; drop then recreate.
DROP FUNCTION IF EXISTS public.get_organization_users(uuid);

CREATE FUNCTION public.get_organization_users(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  first_name text,
  last_name text,
  email text,
  auth_email text,
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
    NULLIF(trim(au.email::text), '') AS auth_email,
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

-- Align with 20251114090000_harden_supabase_rpcs.sql (DROP removes prior grants)
REVOKE EXECUTE ON FUNCTION public.get_organization_users(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_organization_users(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_organization_users(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_users(uuid) TO service_role;
