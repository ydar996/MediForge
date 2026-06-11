-- URGENT FIX: Restore Staff Access to All Patient Data
-- This fixes the patient portal migration that accidentally blocked staff access
-- Run this immediately in Supabase SQL Editor

-- ============================================
-- PATIENTS TABLE - CRITICAL FIX
-- ============================================
-- The patient portal policy might be blocking staff. We need to ensure BOTH policies work.

-- Drop the restrictive patient-only policy
DROP POLICY IF EXISTS "Patients can view own patient record" ON patients;

-- Re-create the staff policy FIRST (this allows staff to access all org patients)
DROP POLICY IF EXISTS "Users can view organization patients" ON patients;
CREATE POLICY "Users can view organization patients" ON patients
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
      AND role != 'Patient'
      AND role != 'patient'
    )
  );

-- Create a SEPARATE policy for patients (they can only see their own record)
-- This uses OR logic with the staff policy above
CREATE POLICY "Patients can view own patient record" ON patients
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT patient_id::text FROM users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
      AND (role = 'Patient' OR role = 'patient')
      AND patient_id IS NOT NULL
    )
  );

-- Ensure staff can still INSERT, UPDATE, DELETE patients in their organization
DROP POLICY IF EXISTS "Users can create organization patients" ON patients;
CREATE POLICY "Users can create organization patients" ON patients
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
      AND role != 'Patient'
      AND role != 'patient'
    )
  );

DROP POLICY IF EXISTS "Users can update organization patients" ON patients;
CREATE POLICY "Users can update organization patients" ON patients
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
      AND role != 'Patient'
      AND role != 'patient'
    )
  );

DROP POLICY IF EXISTS "Users can delete organization patients" ON patients;
CREATE POLICY "Users can delete organization patients" ON patients
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
      AND role != 'Patient'
      AND role != 'patient'
    )
  );

-- ============================================
-- APPOINTMENTS TABLE - CRITICAL FIX
-- ============================================
-- Re-create staff policy first
DROP POLICY IF EXISTS "Users can view organization appointments" ON appointments;
CREATE POLICY "Users can view organization appointments" ON appointments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
      AND role != 'Patient'
      AND role != 'patient'
    )
  );

-- Then add patient policy (separate, uses OR logic)
DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
CREATE POLICY "Patients can view own appointments" ON appointments
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT patient_id FROM users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
      AND (role = 'Patient' OR role = 'patient')
      AND patient_id IS NOT NULL
    )
  );

-- ============================================
-- PRESCRIPTIONS TABLE - ENSURE FIX APPLIED
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
    -- Drop any existing restrictive policies
    DROP POLICY IF EXISTS "Patients can view own prescriptions" ON prescriptions;
    DROP POLICY IF EXISTS "Patients and staff can view prescriptions" ON prescriptions;
    DROP POLICY IF EXISTS "Staff can view organization prescriptions" ON prescriptions;
    
    -- Create staff policy first
    CREATE POLICY "Staff can view organization prescriptions" ON prescriptions
      FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users 
          WHERE (id = auth.uid() OR auth_user_id = auth.uid())
          AND role != 'Patient'
          AND role != 'patient'
        )
      );
    
    -- Create patient policy separately
    CREATE POLICY "Patients can view own prescriptions" ON prescriptions
      FOR SELECT TO authenticated
      USING (
        patient_id::text IN (
          SELECT patient_id::text FROM users 
          WHERE (id = auth.uid() OR auth_user_id = auth.uid())
          AND (role = 'Patient' OR role = 'patient')
          AND patient_id IS NOT NULL
        )
        OR
        patient_id::text IN (
          SELECT p.id::text FROM patients p
          JOIN users u ON u.patient_id = p.id
          WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
          AND (u.role = 'Patient' OR u.role = 'patient')
        )
      );
  END IF;
END $$;

-- ============================================
-- ORDERS TABLE - ENSURE FIX APPLIED
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    -- Drop any existing restrictive policies
    DROP POLICY IF EXISTS "Patients can view own orders" ON orders;
    DROP POLICY IF EXISTS "Patients and staff can view orders" ON orders;
    DROP POLICY IF EXISTS "Staff and patients can view orders" ON orders;
    DROP POLICY IF EXISTS "Staff can view organization orders" ON orders;
    
    -- Create staff policy first
    CREATE POLICY "Staff can view organization orders" ON orders
      FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users 
          WHERE (id = auth.uid() OR auth_user_id = auth.uid())
          AND role != 'Patient'
          AND role != 'patient'
        )
      );
    
    -- Create patient policy separately
    CREATE POLICY "Patients can view own orders" ON orders
      FOR SELECT TO authenticated
      USING (
        patient_id::text IN (
          SELECT patient_id::text FROM users 
          WHERE (id = auth.uid() OR auth_user_id = auth.uid())
          AND (role = 'Patient' OR role = 'patient')
          AND patient_id IS NOT NULL
        )
        OR
        patient_id::text IN (
          SELECT p.id::text FROM patients p
          JOIN users u ON u.patient_id = p.id
          WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
          AND (u.role = 'Patient' OR u.role = 'patient')
        )
      );
  END IF;
END $$;

-- ============================================
-- VERIFY POLICIES AND DATA
-- ============================================
-- Check what policies exist now
SELECT 'Patients table policies:' as info;
SELECT policyname, cmd, qual::text as condition
FROM pg_policies
WHERE tablename = 'patients'
ORDER BY policyname;

SELECT 'Appointments table policies:' as info;
SELECT policyname, cmd, qual::text as condition
FROM pg_policies
WHERE tablename = 'appointments'
ORDER BY policyname;

-- Check if data exists for Mecure Clinics
SELECT 'Checking patient data for Mecure Clinics:' as info;
SELECT 
  patient_id,
  first_name,
  last_name,
  CASE 
    WHEN medical_history IS NULL OR medical_history::text = 'null' OR medical_history::text = '' THEN 0 
    WHEN jsonb_typeof(medical_history::jsonb) = 'array' THEN jsonb_array_length(medical_history::jsonb)
    ELSE 0 
  END as medical_history_count,
  CASE 
    WHEN diagnoses IS NULL OR diagnoses::text = 'null' OR diagnoses::text = '' THEN 0 
    WHEN jsonb_typeof(diagnoses::jsonb) = 'array' THEN jsonb_array_length(diagnoses::jsonb)
    ELSE 0 
  END as diagnoses_count,
  CASE 
    WHEN allergies IS NULL OR allergies::text = 'null' OR allergies::text = '' THEN 0 
    WHEN jsonb_typeof(allergies::jsonb) = 'array' THEN jsonb_array_length(allergies::jsonb)
    ELSE 0 
  END as allergies_count
FROM patients
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
ORDER BY patient_id;
