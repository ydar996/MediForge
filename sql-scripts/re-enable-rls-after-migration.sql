-- ============================================
-- RE-ENABLE RLS AFTER MIGRATION
-- ============================================
-- Purpose: Re-enable RLS after migration is complete
-- Run this in: Supabase Dashboard → SQL Editor
-- IMPORTANT: Only run this AFTER migration succeeds!
-- ============================================

-- Re-enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies for authenticated users
-- Patients policies
DROP POLICY IF EXISTS "Users can read own organization patients" ON patients;
CREATE POLICY "Users can read own organization patients"
ON patients
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own organization patients" ON patients;
CREATE POLICY "Users can insert own organization patients"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own organization patients" ON patients;
CREATE POLICY "Users can update own organization patients"
ON patients
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Appointments policies
DROP POLICY IF EXISTS "Users can read own organization appointments" ON appointments;
CREATE POLICY "Users can read own organization appointments"
ON appointments
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own organization appointments" ON appointments;
CREATE POLICY "Users can insert own organization appointments"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own organization appointments" ON appointments;
CREATE POLICY "Users can update own organization appointments"
ON appointments
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Verify RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('patients', 'appointments');

-- Should show rowsecurity = true for both tables

-- ✅ RLS RE-ENABLED WITH PROPER POLICIES!



