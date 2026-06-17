-- Fix patient portal RLS: patients row match by patients.id (UUID), not patients.patient_id (MRN).
-- Also broaden appointment matching for TEXT patient_id (UUID or MRN).

DROP POLICY IF EXISTS "Patients can view own patient record" ON patients;
CREATE POLICY "Patients can view own patient record" ON patients
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT patient_id FROM users
      WHERE (auth_user_id = auth.uid() OR id = auth.uid())
        AND (role = 'Patient' OR role = 'patient')
        AND patient_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
CREATE POLICY "Patients can view own appointments" ON appointments
  FOR SELECT TO authenticated
  USING (
    patient_id::text IN (
      SELECT patient_id::text FROM users
      WHERE (auth_user_id = auth.uid() OR id = auth.uid())
        AND (role = 'Patient' OR role = 'patient')
        AND patient_id IS NOT NULL
    )
    OR patient_id::text IN (
      SELECT p.id::text FROM patients p
      JOIN users u ON u.patient_id = p.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND (u.role = 'Patient' OR u.role = 'patient')
    )
    OR patient_id::text IN (
      SELECT p.patient_id::text FROM patients p
      JOIN users u ON u.patient_id = p.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND (u.role = 'Patient' OR u.role = 'patient')
        AND p.patient_id IS NOT NULL
    )
  );
