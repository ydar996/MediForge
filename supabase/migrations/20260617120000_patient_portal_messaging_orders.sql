-- Patient portal: messaging, result visibility workflow, prescription pickup status

ALTER TABLE orders ADD COLUMN IF NOT EXISTS portal_results_status TEXT DEFAULT 'not_started';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS portal_results_published_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS portal_results_request_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_reviewed_at TIMESTAMPTZ;

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_pickup_status TEXT;

COMMENT ON COLUMN orders.portal_results_status IS 'not_started | awaiting_review | reviewed | published';
COMMENT ON COLUMN prescriptions.patient_pickup_status IS 'due_for_pickup | picked_up — patient-reported pickup';

CREATE TABLE IF NOT EXISTS portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  from_patient BOOLEAN NOT NULL DEFAULT true,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_read_by_patient BOOLEAN NOT NULL DEFAULT false,
  is_read_by_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_messages_patient ON portal_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_messages_org ON portal_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_messages_staff_unread ON portal_messages(organization_id, is_read_by_staff)
  WHERE is_read_by_staff = false AND from_patient = true;

ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_messages_patient_select ON portal_messages;
CREATE POLICY portal_messages_patient_select ON portal_messages
  FOR SELECT USING (
    patient_id IN (
      SELECT u.patient_id FROM users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' AND u.patient_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS portal_messages_patient_insert ON portal_messages;
CREATE POLICY portal_messages_patient_insert ON portal_messages
  FOR INSERT WITH CHECK (
    from_patient = true
    AND patient_id IN (
      SELECT u.patient_id FROM users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' AND u.patient_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS portal_messages_staff_select ON portal_messages;
DROP POLICY IF EXISTS portal_messages_patient_staff_select ON portal_messages;
CREATE POLICY portal_messages_staff_select ON portal_messages
  FOR SELECT USING (
    organization_id IN (
      SELECT u.organization_id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS portal_messages_staff_insert ON portal_messages;
CREATE POLICY portal_messages_staff_insert ON portal_messages
  FOR INSERT WITH CHECK (
    from_patient = false
    AND organization_id IN (
      SELECT u.organization_id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS portal_messages_patient_mark_read ON portal_messages;
CREATE POLICY portal_messages_patient_mark_read ON portal_messages
  FOR UPDATE USING (
    patient_id IN (
      SELECT u.patient_id FROM users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient'
    )
  );

DROP POLICY IF EXISTS portal_messages_staff_mark_read ON portal_messages;
CREATE POLICY portal_messages_staff_mark_read ON portal_messages
  FOR UPDATE USING (
    organization_id IN (
      SELECT u.organization_id FROM users u WHERE u.auth_user_id = auth.uid()
    )
  );

-- Patient-safe RPCs
CREATE OR REPLACE FUNCTION portal_patient_send_message(p_body TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_user FROM users u
  WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' AND u.patient_id IS NOT NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient session required';
  END IF;
  IF length(trim(coalesce(p_body, ''))) < 1 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  INSERT INTO portal_messages (organization_id, patient_id, from_patient, body, is_read_by_staff)
  VALUES (v_user.organization_id, v_user.patient_id, true, trim(p_body), false)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION portal_patient_request_results(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_org_id UUID;
  v_already TIMESTAMPTZ;
BEGIN
  SELECT u.patient_id, u.organization_id INTO v_patient_id, v_org_id FROM users u
  WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' LIMIT 1;
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient session required';
  END IF;
  SELECT portal_results_request_at INTO v_already FROM orders WHERE id = p_order_id;
  UPDATE orders
  SET portal_results_request_at = NOW(),
      portal_results_status = CASE
        WHEN portal_results_status = 'published' THEN 'published'
        ELSE 'reviewed'
      END
  WHERE id = p_order_id
    AND (
      patient_id::text = v_patient_id::text
      OR patient_id::text IN (SELECT p.patient_id::text FROM patients p WHERE p.id = v_patient_id)
    );
  IF v_already IS NULL AND v_org_id IS NOT NULL THEN
    INSERT INTO portal_messages (organization_id, patient_id, from_patient, body, is_read_by_staff)
    VALUES (v_org_id, v_patient_id, true, 'I would like to view my lab/imaging results in the patient portal.', false);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION portal_patient_mark_pickup(p_prescription_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_status TEXT := lower(trim(coalesce(p_status, '')));
BEGIN
  SELECT u.patient_id INTO v_patient_id FROM users u
  WHERE u.auth_user_id = auth.uid() AND u.role = 'Patient' LIMIT 1;
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient session required';
  END IF;
  IF v_status NOT IN ('due_for_pickup', 'picked_up') THEN
    RAISE EXCEPTION 'Invalid pickup status';
  END IF;
  UPDATE prescriptions
  SET patient_pickup_status = v_status,
      updated_at = NOW()
  WHERE id = p_prescription_id
    AND (patient_id = v_patient_id::text OR patient_id IN (
      SELECT p.patient_id FROM patients p WHERE p.id = v_patient_id
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION portal_patient_send_message(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION portal_patient_request_results(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION portal_patient_mark_pickup(UUID, TEXT) TO authenticated;
