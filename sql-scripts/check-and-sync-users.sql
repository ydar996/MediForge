-- ============================================
-- CHECK AND SYNC USER PROFILES
-- ============================================
-- Purpose: Check what auth users exist and create missing profiles
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- ==================== STEP 1: CHECK AUTH USERS ====================
SELECT 
  'AUTH USERS (from auth.users table):' as info;

SELECT 
  id as auth_user_id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at;

-- ==================== STEP 2: CHECK USER PROFILES ====================
SELECT 
  'USER PROFILES (from public.users table):' as info;

SELECT 
  auth_user_id,
  username,
  role,
  organization_id,
  created_at
FROM users
ORDER BY created_at;

-- ==================== STEP 3: FIND MISSING PROFILES ====================
SELECT 
  'AUTH USERS WITHOUT PROFILES:' as info;

SELECT 
  au.id as auth_user_id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN users u ON au.id = u.auth_user_id
WHERE u.auth_user_id IS NULL
ORDER BY au.created_at;

-- ============================================
-- STEP 4: CREATE MISSING PROFILES (MANUAL)
-- ============================================
-- After running the above queries, you'll see which auth users
-- don't have profiles. For each one, run something like:
--
-- INSERT INTO users (
--   auth_user_id,
--   organization_id,
--   username,
--   role,
--   gender,
--   created_at,
--   updated_at
-- ) VALUES (
--   'auth-user-id-from-above',
--   '576522cc-e769-4fb4-9487-3d150857d970',  -- Mecure Clinics ID
--   'admin',  -- or the username from email
--   'Admin',  -- or Doctor, Nurse, etc.
--   'Male',
--   NOW(),
--   NOW()
-- );
-- ============================================



