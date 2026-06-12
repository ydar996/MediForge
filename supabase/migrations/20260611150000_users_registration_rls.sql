-- Allow new staff to create their own row in public.users after Supabase Auth sign-up.
-- Required for clinic registration (Register New Organization flow).
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Allow user creation during registration" ON public.users;

CREATE POLICY "Allow user creation during registration"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

COMMENT ON POLICY "Allow user creation during registration" ON public.users IS
  'Registration: authenticated user may insert only their own profile row';
