-- Fix Staff Data Access After Patient Portal Migration
-- This ensures staff users can still access their organization's data
-- even with patient portal RLS policies in place

-- ============================================
-- PRESCRIPTIONS TABLE
-- ============================================
-- Ensure staff can access prescriptions for their organization's patients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
    -- Drop existing patient-only policy if it exists
    DROP POLICY IF EXISTS "Patients can view own prescriptions" ON prescriptions;
    
    -- Create a combined policy that allows BOTH patients AND staff
    CREATE POLICY "Patients and staff can view prescriptions" ON prescriptions
      FOR SELECT USING (
        -- Staff users can view prescriptions for their organization's patients
        (
          organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() 
            AND role != 'Patient'
          )
        )
        OR
        -- Patients can view their own prescriptions
        (
          patient_id::text IN (
            SELECT patient_id::text FROM users 
            WHERE id = auth.uid() AND role = 'Patient' AND patient_id IS NOT NULL
          )
          OR
          patient_id::text IN (
            SELECT p.id::text FROM patients p
            JOIN users u ON u.patient_id = p.id
            WHERE u.id = auth.uid() AND u.role = 'Patient'
          )
        )
      );
  END IF;
END $$;

-- ============================================
-- ORDERS TABLE (Lab/Imaging)
-- ============================================
-- Ensure staff can access orders for their organization's patients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    -- Drop existing patient-only policy if it exists
    DROP POLICY IF EXISTS "Patients can view own orders" ON orders;
    
    -- Create a combined policy that allows BOTH patients AND staff
    CREATE POLICY "Patients and staff can view orders" ON orders
      FOR SELECT USING (
        -- Staff users can view orders for their organization's patients
        (
          organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() 
            AND role != 'Patient'
          )
        )
        OR
        -- Patients can view their own orders
        (
          patient_id::text IN (
            SELECT patient_id::text FROM users 
            WHERE id = auth.uid() AND role = 'Patient' AND patient_id IS NOT NULL
          )
          OR
          patient_id::text IN (
            SELECT p.id::text FROM patients p
            JOIN users u ON u.patient_id = p.id
            WHERE u.id = auth.uid() AND u.role = 'Patient'
          )
        )
      );
  END IF;
END $$;

-- ============================================
-- PATIENTS TABLE
-- ============================================
-- Ensure staff can access patients in their organization
-- (The existing "Users can view organization patients" policy should handle this,
--  but we'll make sure the patient policy doesn't conflict)
-- The patient policy only applies when role = 'Patient', so staff should still work
-- But let's verify and add explicit staff access if needed

-- Note: The existing RLS policy for patients should already allow staff access
-- via organization_id. The patient portal policy only restricts patients to their own record.
-- We don't need to change this unless there's a conflict.

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
-- Ensure staff can access appointments for their organization's patients
-- (Should already be handled by existing policies, but verify)

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON POLICY "Patients and staff can view prescriptions" ON prescriptions IS 
  'Allows both patients (own records) and staff (organization records) to view prescriptions';

COMMENT ON POLICY "Patients and staff can view orders" ON orders IS 
  'Allows both patients (own records) and staff (organization records) to view lab/imaging orders';

