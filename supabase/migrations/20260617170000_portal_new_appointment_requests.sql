-- Patient portal: request a NEW appointment (not tied to an existing appointment row).

ALTER TABLE portal_appointment_requests
  ALTER COLUMN appointment_id DROP NOT NULL;

ALTER TABLE portal_appointment_requests DROP CONSTRAINT IF EXISTS portal_appointment_requests_request_type_check;
ALTER TABLE portal_appointment_requests ADD CONSTRAINT portal_appointment_requests_request_type_check
  CHECK (request_type IN ('cancel', 'reschedule', 'new'));

-- Only one pending new-appointment request per patient at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_appt_req_pending_new_unique
  ON portal_appointment_requests(patient_id)
  WHERE status = 'pending' AND request_type = 'new';

CREATE OR REPLACE FUNCTION portal_patient_request_new_appointment(
  p_preferred_date DATE,
  p_preferred_time TEXT,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_org_id UUID;
  v_id UUID;
  v_time TEXT := trim(coalesce(p_preferred_time, ''));
  v_reason TEXT := trim(coalesce(p_reason, ''));
  v_notes TEXT := trim(coalesce(p_notes, ''));
  v_msg TEXT;
BEGIN
  SELECT u.patient_id, u.organization_id INTO v_patient_id, v_org_id FROM users u
  WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    AND (u.role = 'Patient' OR u.role = 'patient')
  LIMIT 1;
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient session required';
  END IF;
  IF p_preferred_date IS NULL THEN
    RAISE EXCEPTION 'Preferred date is required';
  END IF;
  IF p_preferred_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Preferred date must be today or in the future';
  END IF;
  IF length(v_time) < 1 THEN
    RAISE EXCEPTION 'Preferred time is required';
  END IF;
  IF length(v_reason) < 1 THEN
    RAISE EXCEPTION 'Reason for visit is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM portal_appointment_requests r
    WHERE r.patient_id = v_patient_id AND r.request_type = 'new' AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending appointment request';
  END IF;

  INSERT INTO portal_appointment_requests (
    organization_id, patient_id, appointment_id, request_type,
    reason, preferred_date, preferred_time, reschedule_notes, status
  ) VALUES (
    v_org_id, v_patient_id, NULL, 'new',
    v_reason, p_preferred_date, v_time, NULLIF(v_notes, ''), 'pending'
  ) RETURNING id INTO v_id;

  v_msg := 'New appointment request. Reason: ' || v_reason
    || '. Preferred: ' || to_char(p_preferred_date, 'Mon DD, YYYY') || ' at ' || v_time
    || CASE WHEN v_notes <> '' THEN '. Notes: ' || v_notes ELSE '' END;

  INSERT INTO portal_messages (organization_id, patient_id, from_patient, body, is_read_by_staff)
  VALUES (v_org_id, v_patient_id, true, v_msg, false);

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION portal_patient_request_new_appointment(DATE, TEXT, TEXT, TEXT) TO authenticated;
