-- ============================================
-- FIND AND DELETE ORPHANED AUTH USER
-- ============================================
-- Purpose: Find Auth users without profiles and delete them
-- This allows users to register fresh if they forgot their password
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- ==================== STEP 1: FIND ORPHANED AUTH USERS ====================
-- Replace 'user@example.com' with the actual email
SELECT 
  au.id as auth_user_id,
  au.email,
  au.created_at,
  au.last_sign_in_at,
  CASE 
    WHEN u.auth_user_id IS NOT NULL THEN 'Has Profile'
    ELSE 'ORPHANED - No Profile'
  END as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.auth_user_id
WHERE au.email = 'user@example.com'  -- REPLACE WITH ACTUAL EMAIL
ORDER BY au.created_at DESC;

-- ==================== STEP 2: VERIFY IT'S ORPHANED ====================
-- Check if profile exists
SELECT 
  id,
  username,
  email,
  auth_user_id,
  role,
  created_at
FROM public.users
WHERE email = 'user@example.com'  -- REPLACE WITH ACTUAL EMAIL
   OR auth_user_id = 'auth-user-id-from-step-1';  -- REPLACE WITH AUTH USER ID FROM STEP 1

-- ==================== STEP 3: DELETE ORPHANED AUTH USER ====================
-- ⚠️ WARNING: This permanently deletes the Auth user
-- The user will need to register again
-- Only run this if you're sure the user has no profile!

-- Option A: Delete by email (if you know the email)
-- DELETE FROM auth.users WHERE email = 'user@example.com';

-- Option B: Delete by Auth User ID (safer, use ID from Step 1)
-- DELETE FROM auth.users WHERE id = 'auth-user-id-from-step-1';

-- ==================== STEP 4: VERIFY DELETION ====================
-- After deletion, verify the user is gone
SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'user@example.com';  -- Should return no rows

-- ============================================
-- ALTERNATIVE: USE SUPABASE DASHBOARD
-- ============================================
-- Instead of SQL, you can:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Search for the email address
-- 3. Click on the user
-- 4. Click "Delete User" button
-- 5. Confirm deletion
-- ============================================






