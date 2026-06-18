-- Fix patient portal prescription pickup: accept legacy RX ids and prescription numbers.

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_pickup_at TIMESTAMPTZ;

COMMENT ON COLUMN prescriptions.patient_pickup_at IS 'When the patient reported picking up the prescription in the portal';

DROP FUNCTION IF EXISTS portal_patient_mark_pickup(UUID, TEXT);

CREATE OR REPLACE FUNCTION portal_patient_mark_pickup(p_prescription_ref TEXT, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_org_id UUID;
  v_ref TEXT := trim(coalesce(p_prescription_ref, ''));
  v_status TEXT := lower(trim(coalesce(p_status, '')));
  v_rx_id UUID;
  v_rx_number TEXT;
  v_updated INT := 0;
BEGIN
  SELECT u.patient_id, u.organization_id INTO v_patient_id, v_org_id FROM users u
  WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    AND lower(coalesce(u.role, '')) = 'patient'
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Patient session required';
  END IF;

  IF v_ref = '' THEN
    RAISE EXCEPTION 'Prescription reference required';
  END IF;

  IF v_status NOT IN ('due_for_pickup', 'picked_up') THEN
    RAISE EXCEPTION 'Invalid pickup status';
  END IF;

  SELECT p.id, p.prescription_number
  INTO v_rx_id, v_rx_number
  FROM prescriptions p
  WHERE (
      p.id::text = v_ref
      OR p.prescription_number = v_ref
      OR p.source_prescription_id = v_ref
    )
    AND (
      p.patient_id = v_patient_id::text
      OR p.patient_id IN (SELECT pt.patient_id FROM patients pt WHERE pt.id = v_patient_id)
      OR p.patient_id IN (SELECT pt.id::text FROM patients pt WHERE pt.id = v_patient_id)
    )
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_rx_id IS NOT NULL THEN
    UPDATE prescriptions
    SET patient_pickup_status = v_status,
        patient_pickup_at = CASE WHEN v_status = 'picked_up' THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = v_rx_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  IF v_updated = 0 THEN
  UPDATE patients pat
  SET prescriptions = COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'id' = v_ref
          OR elem->>'prescription_number' = v_ref
          OR elem->>'prescriptionNumber' = v_ref
        THEN elem
          || jsonb_build_object('patient_pickup_status', v_status)
          || CASE
            WHEN v_status = 'picked_up' THEN jsonb_build_object('patient_pickup_at', to_jsonb(NOW()::timestamptz))
            ELSE jsonb_build_object('patient_pickup_at', 'null'::jsonb)
          END
        ELSE elem
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(pat.prescriptions) = 'array' THEN pat.prescriptions
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS t(elem, ord)
  ), '[]'::jsonb)
  WHERE pat.id = v_patient_id
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(pat.prescriptions) = 'array' THEN pat.prescriptions
          ELSE '[]'::jsonb
        END
      ) elem
      WHERE elem->>'id' = v_ref
         OR elem->>'prescription_number' = v_ref
         OR elem->>'prescriptionNumber' = v_ref
    );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Prescription not found for this patient';
  END IF;

  IF v_status = 'picked_up' AND v_org_id IS NOT NULL THEN
    INSERT INTO portal_messages (organization_id, patient_id, from_patient, body, is_read_by_staff)
    VALUES (
      v_org_id,
      v_patient_id,
      true,
      'I picked up my prescription'
        || CASE WHEN coalesce(v_rx_number, v_ref) <> '' THEN ' (#' || coalesce(v_rx_number, v_ref) || ').' ELSE '.' END,
      false
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION portal_patient_mark_pickup(TEXT, TEXT) TO authenticated;
