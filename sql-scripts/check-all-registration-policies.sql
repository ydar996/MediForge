-- ============================================
-- Check All Registration-Related RLS Policies
-- ============================================
-- Run this to see ALL policies that affect registration
-- ============================================

-- Check organizations table policies
SELECT 
  'organizations' as table_name,
  policyname, 
  cmd, 
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY cmd, policyname;

-- Check users table policies
SELECT 
  'users' as table_name,
  policyname, 
  cmd, 
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- ============================================
-- Summary Check
-- ============================================
-- This shows if critical policies exist

SELECT 
  'organizations INSERT' as policy_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'organizations' 
      AND cmd = 'INSERT'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
    ) THEN '✅ EXISTS - Registration should work'
    ELSE '❌ MISSING - Registration will fail'
  END as status
UNION ALL
SELECT 
  'users INSERT' as policy_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'users' 
      AND cmd = 'INSERT'
      AND 'authenticated' = ANY(roles)
    ) THEN '✅ EXISTS - User creation should work'
    ELSE '❌ MISSING - User creation will fail'
  END as status
UNION ALL
SELECT 
  'organizations SELECT (anon)' as policy_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'organizations' 
      AND cmd = 'SELECT'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
    ) THEN '✅ EXISTS - Org code verification should work'
    ELSE '❌ MISSING - Org code verification will fail'
  END as status;

