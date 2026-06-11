-- Create your MediForge platform admin (the account for platform-login.html)
--
-- STEP 1 (do this first, in the Supabase Dashboard):
--   Authentication -> Users -> Add user -> "Create new user"
--   Enter your email + a strong password, tick "Auto Confirm User", create it.
--
-- STEP 2: edit the two values below, then run this whole file in the SQL Editor.

DO $$
DECLARE
  v_email TEXT := 'you@example.com';   -- <- the email you used in Step 1
  v_username TEXT := 'admin';          -- <- the username you want to log in with
  v_auth_id UUID;
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE email = v_email;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for %. Do Step 1 first.', v_email;
  END IF;

  INSERT INTO public.platform_admins (auth_user_id, username, email)
  VALUES (v_auth_id, v_username, v_email)
  ON CONFLICT (auth_user_id) DO UPDATE
    SET username = EXCLUDED.username, email = EXCLUDED.email, updated_at = NOW();

  RAISE NOTICE 'Platform admin % created for %', v_username, v_email;
END $$;
