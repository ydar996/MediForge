-- Fix RLS Policies for Registration
-- This allows new organizations to be created during registration
-- and new users to be added to the users table

-- ============================================
-- ORGANIZATIONS TABLE - Allow Creation During Registration
-- ============================================

-- Drop existing insert policy if any
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation during registration" ON organizations;

-- Allow anyone to INSERT organizations (needed for registration)
-- This is safe because we validate organization uniqueness in the app
CREATE POLICY "Allow organization creation during registration"
ON organizations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Keep existing SELECT policy for authenticated users
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;

CREATE POLICY "Users can view their organization"
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

-- ============================================
-- USERS TABLE - Allow Creation During Registration
-- ============================================

-- Drop existing insert policy if any
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Allow user creation during registration" ON users;

-- Allow authenticated users to INSERT their own profile
-- (Supabase Auth creates the auth user first, then we insert the profile)
CREATE POLICY "Allow user creation during registration"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

-- Keep existing SELECT policy
-- (Already created as "Authenticated users can read all profiles")

-- ============================================
-- VERIFY POLICIES
-- ============================================

-- View all policies for organizations
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY policyname;

-- View all policies for users
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;



