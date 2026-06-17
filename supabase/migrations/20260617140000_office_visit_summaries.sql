-- Office visit summaries (patient portal) + nullable admission on discharge_summaries

ALTER TABLE discharge_summaries ALTER COLUMN admission_id DROP NOT NULL;

ALTER TABLE discharge_summaries ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE discharge_summaries ADD COLUMN IF NOT EXISTS visit_date DATE;
ALTER TABLE discharge_summaries ADD COLUMN IF NOT EXISTS summary_type TEXT DEFAULT 'inpatient';
ALTER TABLE discharge_summaries ADD COLUMN IF NOT EXISTS visit_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE discharge_summaries ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN DEFAULT false;

COMMENT ON COLUMN discharge_summaries.summary_type IS 'inpatient | office_visit';
COMMENT ON COLUMN discharge_summaries.visit_snapshot IS 'High-level visit summary for patient portal (vitals, orders, etc.)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_discharge_summaries_office_visit_unique
  ON discharge_summaries(organization_id, patient_id, visit_date)
  WHERE summary_type = 'office_visit' AND patient_id IS NOT NULL AND visit_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discharge_summaries_portal_patient
  ON discharge_summaries(patient_id, visit_date DESC)
  WHERE portal_visible = true AND summary_type = 'office_visit';

DROP POLICY IF EXISTS discharge_summaries_patient_portal_select ON discharge_summaries;
CREATE POLICY discharge_summaries_patient_portal_select ON discharge_summaries
  FOR SELECT USING (
    portal_visible = true
    AND summary_type = 'office_visit'
    AND (
      patient_id IN (
        SELECT p.patient_id::text FROM patients p
        INNER JOIN users u ON u.patient_id = p.id
        WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient'
      )
      OR patient_id IN (
        SELECT p.id::text FROM patients p
        INNER JOIN users u ON u.patient_id = p.id
        WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient'
      )
    )
  );
