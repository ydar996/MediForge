-- ============================================
-- DIAGNOSE PLATFORM ADMIN LEGAL AGREEMENTS ACCESS
-- ============================================
-- Purpose: Check why platform admins can't see legal agreements
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check all platform admin users and their exact roles
SELECT 
    id,
    username,
    role,
    auth_user_id,
    email,
    CASE 
        WHEN role IN ('PlatformAdmin', 'PlatformOwner', 'Platform Admin', 'Platform Owner', 'Platform administrator', 'Platform owner') 
        THEN '✅ Role matches RLS policy'
        ELSE '❌ Role does NOT match RLS policy'
    END as role_status
FROM users 
WHERE role ILIKE '%platform%' OR role ILIKE '%Platform%'
ORDER BY role, username;

-- Step 2: Check if legal agreements exist
SELECT COUNT(*) as total_agreements FROM legal_agreements;

-- Step 3: Check RLS policy definition
SELECT 
    pol.polname AS policy_name,
    pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
WHERE pc.relname = 'legal_agreements'
AND pol.polname = 'Platform admins can view all legal agreements';

-- Step 4: Test the RLS policy logic manually
-- Replace 'YOUR_AUTH_USER_ID' with the actual auth.uid() from the logged-in user
-- This simulates what the RLS policy checks
SELECT 
    u.id,
    u.username,
    u.role,
    u.auth_user_id,
    CASE 
        WHEN u.auth_user_id = 'YOUR_AUTH_USER_ID'::uuid 
        AND u.role IN ('PlatformAdmin', 'PlatformOwner', 'Platform Admin', 'Platform Owner', 'Platform administrator', 'Platform owner')
        THEN '✅ Would match RLS policy'
        ELSE '❌ Would NOT match RLS policy'
    END as rls_match_status
FROM users u
WHERE u.role ILIKE '%platform%' OR u.role ILIKE '%Platform%';

-- Step 5: Check if there are any agreements that should be visible
SELECT 
    la.id,
    la.agreement_type,
    la.user_name,
    la.organization_id,
    o.name as organization_name,
    la.signed_at
FROM legal_agreements la
LEFT JOIN organizations o ON la.organization_id = o.id
ORDER BY la.signed_at DESC
LIMIT 10;

-- ============================================
-- COMMON FIXES
-- ============================================

-- Fix 1: Update user role to match RLS policy exactly
-- Replace 'YOUR_USERNAME' with the actual platform admin username
-- UPDATE users 
-- SET role = 'PlatformOwner' 
-- WHERE username = 'YOUR_USERNAME'
-- AND role NOT IN ('PlatformAdmin', 'PlatformOwner');

-- Fix 2: Verify auth_user_id is set correctly
-- The auth_user_id must match the Supabase auth.uid() for RLS to work
-- SELECT id, username, auth_user_id, role FROM users WHERE username = 'YOUR_USERNAME';

-- ============================================


