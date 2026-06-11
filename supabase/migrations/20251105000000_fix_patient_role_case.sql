-- Fix Patient Role Case
-- Updates RLS policies to use 'Patient' (capitalized) to match CHECK constraint

-- Update RLS policies to use 'Patient' instead of 'patient'
DROP POLICY IF EXISTS "Patients can view own patient record" ON patients;
CREATE POLICY "Patients can view own patient record" ON patients
  FOR SELECT USING (
    id IN (
      SELECT patient_id FROM users 
      WHERE id = auth.uid() AND role = 'Patient'
    )
  );

DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
CREATE POLICY "Patients can view own appointments" ON appointments
  FOR SELECT USING (
    patient_id IN (
      SELECT patient_id FROM users 
      WHERE id = auth.uid() AND role = 'Patient'
    )
  );

-- Update prescriptions policy if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
    DROP POLICY IF EXISTS "Patients can view own prescriptions" ON prescriptions;
    CREATE POLICY "Patients can view own prescriptions" ON prescriptions
      FOR SELECT USING (
        (patient_id::text) IN (
          SELECT patient_id::text FROM users 
          WHERE id = auth.uid() AND role = 'Patient' AND patient_id IS NOT NULL
        )
        OR
        (patient_id::text) IN (
          SELECT p.id::text FROM patients p
          JOIN users u ON u.patient_id = p.id
          WHERE u.id = auth.uid() AND u.role = 'Patient'
        )
      );
  END IF;
END $$;

-- Update orders policy if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    DROP POLICY IF EXISTS "Patients can view own orders" ON orders;
    CREATE POLICY "Patients can view own orders" ON orders
      FOR SELECT USING (
        (patient_id::text) IN (
          SELECT patient_id::text FROM users 
          WHERE id = auth.uid() AND role = 'Patient' AND patient_id IS NOT NULL
        )
        OR
        (patient_id::text) IN (
          SELECT p.id::text FROM patients p
          JOIN users u ON u.patient_id = p.id
          WHERE u.id = auth.uid() AND u.role = 'Patient'
        )
      );
  END IF;
END $$;

