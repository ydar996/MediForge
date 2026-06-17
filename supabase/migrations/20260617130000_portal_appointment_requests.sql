-- Patient portal: appointment cancellation and reschedule requests

CREATE TABLE IF NOT EXISTS portal_appointment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('cancel', 'reschedule')),
  reason TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  reschedule_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'actioned', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actioned_at TIMESTAMPTZ,
  actioned_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_appt_req_org ON portal_appointment_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_appt_req_patient ON portal_appointment_requests(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_appt_req_appointment ON portal_appointment_requests(appointment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_appt_req_pending_unique
  ON portal_appointment_requests(appointment_id, request_type)
  WHERE status = 'pending';

ALTER TABLE portal_appointment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_appt_req_patient_select ON portal_appointment_requests;
CREATE POLICY portal_appt_req_patient_select ON portal_appointment_requests
  FOR SELECT USING (
    patient_id IN (
      SELECT u.patient_id FROM users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' AND u.patient_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS portal_appt_req_staff_select ON portal_appointment_requests;
CREATE POLICY portal_appt_req_staff_select ON portal_appointment_requests
  FOR SELECT USING (
    organization_id IN (
      SELECT u.organization_id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS portal_appt_req_staff_update ON portal_appointment_requests;
CREATE POLICY portal_appt_req_staff_update ON portal_appointment_requests
  FOR UPDATE USING (
    organization_id IN (
      SELECT u.organization_id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION portal_patient_request_appointment_cancel(
  p_appointment_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_org_id UUID;
  v_appt appointments%ROWTYPE;
  v_id UUID;
  v_reason TEXT := trim(coalesce(p_reason, ''));
  v_msg TEXT;
BEGIN
  SELECT u.patient_id, u.organization_id INTO v_patient_id, v_org_id FROM users u
  WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' LIMIT 1;
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient session required';
  END IF;
  IF length(v_reason) < 1 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  SELECT * INTO v_appt FROM appointments a WHERE a.id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF v_appt.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF NOT (
    v_appt.patient_id::text = v_patient_id::text
    OR v_appt.patient_id::text IN (SELECT p.patient_id::text FROM patients p WHERE p.id = v_patient_id)
  ) THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF v_appt.appointment_date < CURRENT_DATE
     OR lower(coalesce(v_appt.status, '')) IN ('cancelled', 'canceled', 'completed', 'done', 'no-show', 'noshow') THEN
    RAISE EXCEPTION 'Only upcoming appointments can be cancelled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM portal_appointment_requests r
    WHERE r.appointment_id = p_appointment_id AND r.request_type = 'cancel' AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A cancellation request is already pending for this appointment';
  END IF;

  INSERT INTO portal_appointment_requests (
    organization_id, patient_id, appointment_id, request_type, reason, status
  ) VALUES (
    v_org_id, v_patient_id, p_appointment_id, 'cancel', v_reason, 'pending'
  ) RETURNING id INTO v_id;

  v_msg := 'Appointment cancellation request for '
    || to_char(v_appt.appointment_date, 'Mon DD, YYYY')
    || coalesce(' at ' || v_appt.appointment_time::text, '')
    || '. Reason: ' || v_reason;

  INSERT INTO portal_messages (organization_id, patient_id, from_patient, body, is_read_by_staff)
  VALUES (v_org_id, v_patient_id, true, v_msg, false);

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION portal_patient_request_appointment_reschedule(
  p_appointment_id UUID,
  p_preferred_date DATE,
  p_preferred_time TEXT,
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
  v_appt appointments%ROWTYPE;
  v_id UUID;
  v_time TEXT := trim(coalesce(p_preferred_time, ''));
  v_notes TEXT := trim(coalesce(p_notes, ''));
  v_msg TEXT;
BEGIN
  SELECT u.patient_id, u.organization_id INTO v_patient_id, v_org_id FROM users u
  WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' LIMIT 1;
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

  SELECT * INTO v_appt FROM appointments a WHERE a.id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF v_appt.organization_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF NOT (
    v_appt.patient_id::text = v_patient_id::text
    OR v_appt.patient_id::text IN (SELECT p.patient_id::text FROM patients p WHERE p.id = v_patient_id)
  ) THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF v_appt.appointment_date < CURRENT_DATE
     OR lower(coalesce(v_appt.status, '')) IN ('cancelled', 'canceled', 'completed', 'done', 'no-show', 'noshow') THEN
    RAISE EXCEPTION 'Only upcoming appointments can be rescheduled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM portal_appointment_requests r
    WHERE r.appointment_id = p_appointment_id AND r.request_type = 'reschedule' AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A reschedule request is already pending for this appointment';
  END IF;

  INSERT INTO portal_appointment_requests (
    organization_id, patient_id, appointment_id, request_type,
    preferred_date, preferred_time, reschedule_notes, status
  ) VALUES (
    v_org_id, v_patient_id, p_appointment_id, 'reschedule',
    p_preferred_date, v_time, NULLIF(v_notes, ''), 'pending'
  ) RETURNING id INTO v_id;

  v_msg := 'Appointment reschedule request for '
    || to_char(v_appt.appointment_date, 'Mon DD, YYYY')
    || coalesce(' at ' || v_appt.appointment_time::text, '')
    || '. Preferred: '
    || to_char(p_preferred_date, 'Mon DD, YYYY') || ' at ' || v_time
    || CASE WHEN v_notes <> '' THEN '. Notes: ' || v_notes ELSE '' END;

  INSERT INTO portal_messages (organization_id, patient_id, from_patient, body, is_read_by_staff)
  VALUES (v_org_id, v_patient_id, true, v_msg, false);

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION portal_patient_request_appointment_cancel(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION portal_patient_request_appointment_reschedule(UUID, DATE, TEXT, TEXT) TO authenticated;
