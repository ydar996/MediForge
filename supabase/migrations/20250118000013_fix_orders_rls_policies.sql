-- ============================================
-- FIX ORDERS TABLE RLS POLICIES
-- ============================================
-- Purpose: Fix RLS policies to use auth_user_id instead of id
-- Issue: Policies are checking users.id = auth.uid() but should check users.auth_user_id = auth.uid()
-- ============================================

-- Drop all existing policies on orders table
DROP POLICY IF EXISTS "Users can view orders from their organization" ON orders;
DROP POLICY IF EXISTS "Users can insert orders for their organization" ON orders;
DROP POLICY IF EXISTS "Users can update orders from their organization" ON orders;
DROP POLICY IF EXISTS "Users can delete orders from their organization" ON orders;
DROP POLICY IF EXISTS "Staff can view organization orders" ON orders;
DROP POLICY IF EXISTS "Patients can view own orders" ON orders;
DROP POLICY IF EXISTS "Patients and staff can view orders" ON orders;

-- Create correct SELECT policy (users can view orders from their organization)
CREATE POLICY "Users can view orders from their organization"
ON orders
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
  OR
  -- Patients can view their own orders
  (
    patient_id IN (
      SELECT patient_id::text
      FROM users
      WHERE auth_user_id = auth.uid()
      AND patient_id IS NOT NULL
    )
  )
);

-- Create correct INSERT policy (users can insert orders for their organization)
CREATE POLICY "Users can insert orders for their organization"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Create correct UPDATE policy (users can update orders from their organization)
CREATE POLICY "Users can update orders from their organization"
ON orders
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Create correct DELETE policy (users can delete orders from their organization)
CREATE POLICY "Users can delete orders from their organization"
ON orders
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
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
WHERE tablename = 'orders'
ORDER BY cmd, policyname;

-- ============================================
-- ✅ ORDERS RLS POLICIES FIXED!
-- ============================================
-- Policies now correctly use auth_user_id = auth.uid()
-- Users can now insert, update, and delete orders for their organization
-- ============================================


