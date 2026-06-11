-- Final Fix for Organization RLS
-- Remove all policies and create clean, simple ones

-- ============================================
-- STEP 1: Remove ALL existing policies
-- ============================================

DROP POLICY IF EXISTS "Allow organization creation during registration" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;

-- ============================================
-- STEP 2: Create simple, permissive policies
-- ============================================

-- Allow ANYONE (anon or authenticated) to INSERT organizations
CREATE POLICY "org_insert_public"
ON organizations
FOR INSERT
TO public
WITH CHECK (true);

-- Allow authenticated users to SELECT organizations
CREATE POLICY "org_select_authenticated"
ON organizations
FOR SELECT
TO authenticated
USING (true);

-- Allow anon users to SELECT organizations (needed for verification)
CREATE POLICY "org_select_anon"
ON organizations
FOR SELECT
TO anon
USING (true);

-- Allow authenticated users to UPDATE their own organization
CREATE POLICY "org_update_own"
ON organizations
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
);

-- ============================================
-- STEP 3: Verify policies were created
-- ============================================

SELECT 
  policyname, 
  cmd,
  roles,
  with_check
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY cmd, policyname;



