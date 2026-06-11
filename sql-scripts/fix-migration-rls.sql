-- ============================================
-- FIX RLS AND CONSTRAINTS FOR MIGRATION
-- ============================================
-- Purpose: Allow data migration to succeed
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- ==================== FIX PATIENTS TABLE ====================

-- Temporarily allow public insert (for migration only)
DROP POLICY IF EXISTS "Allow public insert for migration" ON patients;
CREATE POLICY "Allow public insert for migration"
ON patients
FOR INSERT
TO public
WITH CHECK (true);

-- Allow authenticated users to insert patients
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON patients;
CREATE POLICY "Authenticated users can insert patients"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to read their organization's patients
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

-- ==================== FIX APPOINTMENTS TABLE ====================

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointments_org_appt_id_unique'
  ) THEN
    ALTER TABLE appointments 
    ADD CONSTRAINT appointments_org_appt_id_unique 
    UNIQUE (organization_id, appointment_id);
  END IF;
END $$;

-- Temporarily allow public insert (for migration only)
DROP POLICY IF EXISTS "Allow public insert for migration" ON appointments;
CREATE POLICY "Allow public insert for migration"
ON appointments
FOR INSERT
TO public
WITH CHECK (true);

-- Allow authenticated users to insert appointments
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON appointments;
CREATE POLICY "Authenticated users can insert appointments"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to read their organization's appointments
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

-- ==================== VERIFY CHANGES ====================
SELECT 'Checking patients policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'patients';

SELECT 'Checking appointments policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'appointments';

SELECT 'Checking appointments constraints:' as info;
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'appointments'::regclass;

-- ============================================
-- ✅ READY TO MIGRATE!
-- Go back to: https://mediforge.netlify.app/migrate-to-supabase.html
-- And try the migration again
-- ============================================



