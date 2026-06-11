-- Purpose: Platform admins table for Supabase Auth-based platform admin login
-- Platform admins authenticate via Supabase Auth; this table maps username to email

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_username ON public.platform_admins(username);
CREATE INDEX IF NOT EXISTS idx_platform_admins_auth_user_id ON public.platform_admins(auth_user_id);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (accessed via secure proxy)
CREATE POLICY "Service role only" ON public.platform_admins
  FOR ALL USING (auth.role() = 'service_role');

-- RPC: Get platform admin email by username (for login)
CREATE OR REPLACE FUNCTION public.get_platform_admin_by_username(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT id, auth_user_id, username, email INTO v_admin
  FROM public.platform_admins
  WHERE LOWER(TRIM(username)) = LOWER(TRIM(p_username))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_admin.id,
    'auth_user_id', v_admin.auth_user_id,
    'username', v_admin.username,
    'email', v_admin.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_admin_by_username(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.get_platform_admin_by_username(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_platform_admin_by_username(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_admin_by_username(TEXT) TO service_role;

COMMENT ON TABLE public.platform_admins IS 'Platform administrators - authenticate via Supabase Auth';
COMMENT ON FUNCTION public.get_platform_admin_by_username(TEXT) IS 'Returns platform admin email for username (used at login)';
