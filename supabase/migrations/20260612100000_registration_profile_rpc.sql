-- Registration profile completion (idempotent). Run on Dev / Staging / Prod when promoting.
-- Fixes join-org and new-org flows where direct INSERT into users hits RLS edge cases.

-- Allow users to read their own profile row (needed for INSERT ... RETURNING and login lookup)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- SECURITY DEFINER RPC: authenticated user inserts only their own profile row
CREATE OR REPLACE FUNCTION public.complete_registration_user_profile(
  p_auth_user_id uuid,
  p_username text,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_gender text,
  p_role text,
  p_organization_id uuid,
  p_phone text DEFAULT NULL,
  p_license_number text DEFAULT NULL,
  p_specialization text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> p_auth_user_id THEN
    RAISE EXCEPTION 'Cannot create profile for another user';
  END IF;

  IF trim(COALESCE(p_username, '')) = '' OR trim(COALESCE(p_role, '')) = '' THEN
    RAISE EXCEPTION 'Username and role are required';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization is required';
  END IF;

  INSERT INTO public.users (
    auth_user_id,
    username,
    email,
    first_name,
    last_name,
    gender,
    role,
    organization_id,
    phone,
    license_number,
    specialization
  ) VALUES (
    p_auth_user_id,
    trim(p_username),
    trim(p_email),
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    COALESCE(nullif(trim(p_gender), ''), 'Male'),
    trim(p_role),
    p_organization_id,
    nullif(trim(p_phone), ''),
    nullif(trim(p_license_number), ''),
    nullif(trim(p_specialization), '')
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_registration_user_profile(
  uuid, text, text, text, text, text, text, uuid, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_registration_user_profile(
  uuid, text, text, text, text, text, text, uuid, text, text, text
) TO authenticated, service_role;
