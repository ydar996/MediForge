-- Patient Portal Migration
-- Adds patient authentication and access control

-- Add patient_id column to users table (links user account to patient record)
ALTER TABLE users ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password TEXT;

-- Create index for faster patient lookups
CREATE INDEX IF NOT EXISTS idx_users_patient_id ON users(patient_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Row Level Security (RLS) Policies for Patient Access

-- Patients can ONLY view their own patient record
DROP POLICY IF EXISTS "Patients can view own patient record" ON patients;
CREATE POLICY "Patients can view own patient record" ON patients
  FOR SELECT USING (
    id IN (
      SELECT patient_id FROM users 
      WHERE id = auth.uid() AND role = 'patient'
    )
  );

-- Patients can view their own appointments
DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
CREATE POLICY "Patients can view own appointments" ON appointments
  FOR SELECT USING (
    patient_id IN (
      SELECT patient_id FROM users 
      WHERE id = auth.uid() AND role = 'patient'
    )
  );

-- Patients can view their own prescriptions (if prescriptions table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
    -- Drop policy if it exists, then create it
    DROP POLICY IF EXISTS "Patients can view own prescriptions" ON prescriptions;
    CREATE POLICY "Patients can view own prescriptions" ON prescriptions
      FOR SELECT USING (
        -- Handle both TEXT and UUID patient_id columns
        (patient_id::text) IN (
          SELECT patient_id::text FROM users 
          WHERE id = auth.uid() AND role = 'patient' AND patient_id IS NOT NULL
        )
        OR
        -- Also check if patient_id matches the actual patient record ID
        (patient_id::text) IN (
          SELECT p.id::text FROM patients p
          JOIN users u ON u.patient_id = p.id
          WHERE u.id = auth.uid() AND u.role = 'patient'
        )
      );
  END IF;
END $$;

-- Patients can view their own lab/imaging orders (if orders table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    -- Drop policy if it exists, then create it
    DROP POLICY IF EXISTS "Patients can view own orders" ON orders;
    CREATE POLICY "Patients can view own orders" ON orders
      FOR SELECT USING (
        -- Handle both TEXT and UUID patient_id columns
        (patient_id::text) IN (
          SELECT patient_id::text FROM users 
          WHERE id = auth.uid() AND role = 'patient' AND patient_id IS NOT NULL
        )
        OR
        -- Also check if patient_id matches the actual patient record ID
        (patient_id::text) IN (
          SELECT p.id::text FROM patients p
          JOIN users u ON u.patient_id = p.id
          WHERE u.id = auth.uid() AND u.role = 'patient'
        )
      );
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN users.patient_id IS 'Links user account to patient record for patient portal access';
COMMENT ON COLUMN users.password_reset_required IS 'Flag to force password change on first login';
COMMENT ON COLUMN users.temp_password IS 'Temporary password for initial login (one-time use)';

