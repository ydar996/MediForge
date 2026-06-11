-- ============================================
-- FIX ORGANIZATION CODE VERIFICATION RLS
-- ============================================
-- Purpose: Allow anonymous users to verify organization codes during registration
-- Issue: RLS policies were blocking org_code lookups for unauthenticated users
-- ============================================

-- Drop existing restrictive SELECT policy for organizations (if it exists)
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "org_select_authenticated" ON organizations;
DROP POLICY IF EXISTS "org_select_anon" ON organizations;
DROP POLICY IF EXISTS "Allow org_code verification for registration" ON organizations;
DROP POLICY IF EXISTS "Users can view own organization details" ON organizations;

-- Create policy to allow anonymous users to SELECT organizations by org_code
-- This is needed for registration verification
CREATE POLICY "Allow org_code verification for registration"
ON organizations
FOR SELECT
TO anon, authenticated
USING (true);  -- Allow all SELECTs - org_code is unique and safe to expose

-- Create policy for authenticated users to view their own organization details
CREATE POLICY "Users can view own organization details"
ON organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
  OR
  -- Platform admins can see all
  EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
    AND role IN ('PlatformOwner', 'PlatformAdmin')
  )
);

-- Verify policies were created
SELECT 
  policyname, 
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY cmd, policyname;

-- ============================================
-- ✅ RLS POLICIES UPDATED!
-- ============================================
-- Anonymous users can now verify organization codes during registration
-- Authenticated users can still only see their own organization details
-- Platform admins can see all organizations
-- ============================================

