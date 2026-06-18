-- Complete patient portal RLS: orders, prescriptions, portal_messages, portal_appointment_requests.
-- Extends 20260617150000 (patients + appointments) to all portal data paths.
-- Uses auth_user_id = auth.uid() OR legacy users.id = auth.uid().

-- ── Orders ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DROP POLICY IF EXISTS "Patients can view own orders" ON orders;
    CREATE POLICY "Patients can view own orders" ON orders
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
  END IF;
END $$;

-- ── Prescriptions ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prescriptions') THEN
    DROP POLICY IF EXISTS "Patients can view own prescriptions" ON prescriptions;
    CREATE POLICY "Patients can view own prescriptions" ON prescriptions
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
  END IF;
END $$;

-- ── portal_messages (fix misnamed staff policy + broaden patient match) ─────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_messages') THEN
    DROP POLICY IF EXISTS portal_messages_patient_select ON portal_messages;
    DROP POLICY IF EXISTS portal_messages_patient_insert ON portal_messages;
    DROP POLICY IF EXISTS portal_messages_staff_select ON portal_messages;
    DROP POLICY IF EXISTS portal_messages_patient_staff_select ON portal_messages;
    DROP POLICY IF EXISTS portal_messages_staff_insert ON portal_messages;
    DROP POLICY IF EXISTS portal_messages_patient_mark_read ON portal_messages;
    DROP POLICY IF EXISTS portal_messages_staff_mark_read ON portal_messages;

    CREATE POLICY portal_messages_patient_select ON portal_messages
      FOR SELECT TO authenticated
      USING (
        patient_id IN (
          SELECT u.patient_id FROM users u
          WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
            AND (u.role = 'Patient' OR u.role = 'patient')
            AND u.patient_id IS NOT NULL
        )
      );

    CREATE POLICY portal_messages_patient_insert ON portal_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        from_patient = true
        AND patient_id IN (
          SELECT u.patient_id FROM users u
          WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
            AND (u.role = 'Patient' OR u.role = 'patient')
            AND u.patient_id IS NOT NULL
        )
      );

    CREATE POLICY portal_messages_staff_select ON portal_messages
      FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT u.organization_id FROM users u
          WHERE u.auth_user_id = auth.uid() OR u.id = auth.uid()
        )
      );

    CREATE POLICY portal_messages_staff_insert ON portal_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        from_patient = false
        AND organization_id IN (
          SELECT u.organization_id FROM users u
          WHERE u.auth_user_id = auth.uid() OR u.id = auth.uid()
        )
      );

    CREATE POLICY portal_messages_patient_mark_read ON portal_messages
      FOR UPDATE TO authenticated
      USING (
        patient_id IN (
          SELECT u.patient_id FROM users u
          WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
            AND (u.role = 'Patient' OR u.role = 'patient')
        )
      );

    CREATE POLICY portal_messages_staff_mark_read ON portal_messages
      FOR UPDATE TO authenticated
      USING (
        organization_id IN (
          SELECT u.organization_id FROM users u
          WHERE u.auth_user_id = auth.uid() OR u.id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── portal_appointment_requests ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_appointment_requests') THEN
    DROP POLICY IF EXISTS portal_appt_req_patient_select ON portal_appointment_requests;
    DROP POLICY IF EXISTS portal_appt_req_staff_select ON portal_appointment_requests;
    DROP POLICY IF EXISTS portal_appt_req_staff_update ON portal_appointment_requests;

    CREATE POLICY portal_appt_req_patient_select ON portal_appointment_requests
      FOR SELECT TO authenticated
      USING (
        patient_id IN (
          SELECT u.patient_id FROM users u
          WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
            AND (u.role = 'Patient' OR u.role = 'patient')
            AND u.patient_id IS NOT NULL
        )
      );

    CREATE POLICY portal_appt_req_staff_select ON portal_appointment_requests
      FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT u.organization_id FROM users u
          WHERE u.auth_user_id = auth.uid() OR u.id = auth.uid()
        )
      );

    CREATE POLICY portal_appt_req_staff_update ON portal_appointment_requests
      FOR UPDATE TO authenticated
      USING (
        organization_id IN (
          SELECT u.organization_id FROM users u
          WHERE u.auth_user_id = auth.uid() OR u.id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── discharge_summaries (office visit portal) ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'discharge_summaries') THEN
    DROP POLICY IF EXISTS discharge_summaries_patient_portal_select ON discharge_summaries;
    CREATE POLICY discharge_summaries_patient_portal_select ON discharge_summaries
      FOR SELECT TO authenticated
      USING (
        portal_visible = true
        AND summary_type = 'office_visit'
        AND (
          patient_id IN (
            SELECT p.patient_id::text FROM patients p
            INNER JOIN users u ON u.patient_id = p.id
            WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
              AND (u.role = 'Patient' OR u.role = 'patient')
          )
          OR patient_id IN (
            SELECT p.id::text FROM patients p
            INNER JOIN users u ON u.patient_id = p.id
            WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
              AND (u.role = 'Patient' OR u.role = 'patient')
          )
        )
      );
  END IF;
END $$;

-- ── Broaden patient portal RPCs to accept legacy auth linkage ───────────────
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
  WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    AND (u.role = 'Patient' OR u.role = 'patient')
    AND u.patient_id IS NOT NULL
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

-- Broaden remaining portal RPCs for legacy users.id = auth.uid() linkage
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
  WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    AND (u.role = 'Patient' OR u.role = 'patient')
  LIMIT 1;
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
  WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    AND (u.role = 'Patient' OR u.role = 'patient')
  LIMIT 1;
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
  WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    AND (u.role = 'Patient' OR u.role = 'patient')
  LIMIT 1;
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
