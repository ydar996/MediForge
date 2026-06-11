-- RUN THIS: Add platform admins after creating them in Supabase Auth
-- 
-- BEFORE RUNNING:
-- 1. Create each platform admin in Supabase Dashboard → Authentication → Users
--    Use their email and set a strong password
-- 2. Copy the auth_user_id (UUID) for each user
-- 3. Replace the UUIDs and emails below with your actual values
--
-- Example: If ydar101 has auth_user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
--   INSERT INTO public.platform_admins (auth_user_id, username, email)
--   VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'ydar101', 'ydar101@mediforge.com');
--
-- To get auth_user_id from Supabase Dashboard: Authentication → Users → click user → copy "User UID"

-- Uncomment and run for each platform admin (replace UUIDs and emails):
/*
INSERT INTO public.platform_admins (auth_user_id, username, email)
VALUES 
  ('REPLACE_WITH_AUTH_USER_ID_1', 'ydar101', 'platform@mediforge.com'),
  ('REPLACE_WITH_AUTH_USER_ID_2', 'ydar202', 'ydar202@mediforge.com'),
  ('REPLACE_WITH_AUTH_USER_ID_3', 'yinka@eworkchop.com', 'yinka@eworkchop.com')
ON CONFLICT (username) DO NOTHING;
*/

-- Until platform admins are added, login falls back to legacy (localStorage) credentials.
