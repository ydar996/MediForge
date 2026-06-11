-- ============================================
-- DELETE ORPHANED AUTH USER: LizzyD
-- ============================================
-- Purpose: Delete the orphaned Auth user so they can register fresh
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Step 1: First, check if the user exists
SELECT 
  id, 
  email, 
  created_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'LizzyD@mediforge.app'
   OR email = 'lizzyd@mediforge.app';  -- Try lowercase too

-- Step 2: If user is found above, delete them
-- IMPORTANT: Only run this AFTER confirming the user exists in Step 1
DELETE FROM auth.users 
WHERE email = 'LizzyD@mediforge.app'
   OR email = 'lizzyd@mediforge.app';

-- Step 3: Verify deletion (should return 0 rows)
SELECT COUNT(*) as remaining_users
FROM auth.users 
WHERE email = 'LizzyD@mediforge.app'
   OR email = 'lizzyd@mediforge.app';






