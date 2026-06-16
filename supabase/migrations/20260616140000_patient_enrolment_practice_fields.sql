-- Optional practice / enrolment fields requested by clinic (Dr Larry import gaps).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS enrolled_physician TEXT,
  ADD COLUMN IF NOT EXISTS enrolment_status TEXT,
  ADD COLUMN IF NOT EXISTS show_email_on_consults BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_joined_practice DATE,
  ADD COLUMN IF NOT EXISTS health_card_effective_date DATE,
  ADD COLUMN IF NOT EXISTS assigned_physician_mrp TEXT;

COMMENT ON COLUMN public.patients.enrolled_physician IS 'Enrolled physician name (optional).';
COMMENT ON COLUMN public.patients.enrolment_status IS 'Status enrolment (optional).';
COMMENT ON COLUMN public.patients.show_email_on_consults IS 'Whether patient email appears on consult documents.';
COMMENT ON COLUMN public.patients.date_joined_practice IS 'Date patient joined the practice (business date, optional).';
COMMENT ON COLUMN public.patients.health_card_effective_date IS 'Health insurance card effective date (optional).';
COMMENT ON COLUMN public.patients.assigned_physician_mrp IS 'Assigned physician MRP (optional).';

-- Existing patients: date joined = registration date (created_at).
UPDATE public.patients
SET date_joined_practice = (created_at AT TIME ZONE 'UTC')::date
WHERE date_joined_practice IS NULL
  AND created_at IS NOT NULL;

-- Intake approval: persist new fields and auto-set date joined on approval.
CREATE OR REPLACE FUNCTION public.approve_patient_intake_submission(
  p_submission_id uuid,
  p_prefix text DEFAULT 'PAT',
  p_reviewer_name text DEFAULT NULL,
  p_reviewer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  submission_id uuid,
  patient_identifier text,
  patient_row_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission patient_intake_submissions%rowtype;
  v_patient_identifier text;
  v_patient_row_id uuid;
  v_counter integer;
  v_reviewer_note text;
  v_emergency_line1 text;
  v_emergency_line2 text;
  v_emergency_city text;
  v_emergency_state text;
  v_emergency_country text;
  v_emergency_address text;
  v_emergency_email text;
  v_race text;
  v_show_email boolean;
  v_date_joined date;
  v_health_card_effective date;
BEGIN
  SELECT *
    INTO v_submission
  FROM public.patient_intake_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission % not found', p_submission_id USING ERRCODE = 'P0001';
  END IF;

  IF v_submission.status = 'rejected' THEN
    RAISE EXCEPTION 'Submission % has already been rejected', p_submission_id USING ERRCODE = 'P0001';
  END IF;

  IF v_submission.status = 'approved' AND v_submission.created_patient_id IS NOT NULL THEN
    RETURN QUERY
      SELECT v_submission.id, v_submission.created_patient_id, v_submission.created_patient_record;
    RETURN;
  END IF;

  IF p_prefix IS NULL OR length(trim(p_prefix)) = 0 THEN
    p_prefix := 'PAT';
  END IF;

  SELECT coalesce(
           max(
             nullif(
               regexp_replace(patient_id, '^' || p_prefix, ''),
               ''
             )::int
           ),
           0
         ) + 1
    INTO v_counter
  FROM public.patients
  WHERE organization_id = v_submission.organization_id
    AND patient_id LIKE p_prefix || '%';

  v_patient_identifier := p_prefix || lpad(v_counter::text, 4, '0');

  v_emergency_line1 := nullif(v_submission.patient_payload ->> 'emergencyAddressLine1', '');
  v_emergency_line2 := nullif(v_submission.patient_payload ->> 'emergencyAddressLine2', '');
  v_emergency_city := nullif(v_submission.patient_payload ->> 'emergencyCity', '');
  v_emergency_state := nullif(v_submission.patient_payload ->> 'emergencyState', '');
  v_emergency_country := nullif(v_submission.patient_payload ->> 'emergencyCountry', '');

  IF v_emergency_line1 IS NULL
     AND v_emergency_line2 IS NULL
     AND v_emergency_city IS NULL
     AND v_emergency_state IS NULL
     AND v_emergency_country IS NULL THEN
    v_emergency_line1 := nullif(v_submission.patient_payload ->> 'addressLine1', '');
    v_emergency_line2 := nullif(v_submission.patient_payload ->> 'addressLine2', '');
    v_emergency_city := nullif(v_submission.patient_payload ->> 'city', '');
    v_emergency_state := nullif(v_submission.patient_payload ->> 'state', '');
    v_emergency_country := nullif(v_submission.patient_payload ->> 'country', '');
  END IF;

  v_emergency_address := array_to_string(
    array_remove(ARRAY[
      v_emergency_line1,
      v_emergency_line2,
      v_emergency_city,
      v_emergency_state,
      v_emergency_country
    ], null),
    ', '
  );

  v_emergency_email := nullif(v_submission.patient_payload ->> 'emergencyEmail', '');

  v_race := nullif(
    coalesce(
      v_submission.patient_payload ->> 'race',
      v_submission.patient_payload ->> 'tribe'
    ),
    ''
  );

  v_show_email := coalesce(
    (v_submission.patient_payload ->> 'showEmailOnConsults')::boolean,
    false
  );

  v_date_joined := coalesce(
    nullif(v_submission.patient_payload ->> 'dateJoinedPractice', '')::date,
    current_date
  );

  v_health_card_effective := nullif(v_submission.patient_payload ->> 'healthCardEffectiveDate', '')::date;

  INSERT INTO public.patients (
    patient_id,
    organization_id,
    first_name,
    last_name,
    middle_name,
    date_of_birth,
    gender,
    phone,
    email,
    address_line1,
    address_line2,
    city,
    state,
    country,
    postal_code,
    marital_status,
    race,
    payment_source,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    emergency_contact_email,
    emergency_contact_address,
    medical_history,
    allergies,
    medications,
    immunizations,
    enrolled_physician,
    enrolment_status,
    show_email_on_consults,
    date_joined_practice,
    health_card_effective_date,
    assigned_physician_mrp,
    created_by,
    created_at
  )
  VALUES (
    v_patient_identifier,
    v_submission.organization_id,
    nullif(v_submission.patient_payload ->> 'firstName', ''),
    nullif(v_submission.patient_payload ->> 'lastName', ''),
    nullif(v_submission.patient_payload ->> 'middleName', ''),
    nullif(v_submission.patient_payload ->> 'dob', '')::date,
    nullif(v_submission.patient_payload ->> 'gender', ''),
    nullif(v_submission.patient_payload ->> 'phone', ''),
    nullif(v_submission.patient_payload ->> 'email', ''),
    nullif(v_submission.patient_payload ->> 'addressLine1', ''),
    nullif(v_submission.patient_payload ->> 'addressLine2', ''),
    nullif(v_submission.patient_payload ->> 'city', ''),
    nullif(v_submission.patient_payload ->> 'state', ''),
    nullif(v_submission.patient_payload ->> 'country', ''),
    nullif(v_submission.patient_payload ->> 'postalCode', ''),
    nullif(v_submission.patient_payload ->> 'maritalStatus', ''),
    v_race,
    coalesce(nullif(v_submission.patient_payload ->> 'paymentSource', ''), 'Self Pay'),
    nullif(
      trim(
        coalesce(v_submission.patient_payload ->> 'emergencyFirstName', '') || ' ' ||
        coalesce(v_submission.patient_payload ->> 'emergencyLastName', '')
      ),
      ''
    ),
    nullif(v_submission.patient_payload ->> 'emergencyPhone', ''),
    nullif(v_submission.patient_payload ->> 'emergencyRelationship', ''),
    v_emergency_email,
    nullif(v_emergency_address, ''),
    coalesce(v_submission.patient_payload -> 'medicalHistory', '[]'::jsonb),
    coalesce(v_submission.patient_payload -> 'allergies', '[]'::jsonb),
    coalesce(v_submission.patient_payload -> 'medications', '[]'::jsonb),
    coalesce(v_submission.patient_payload -> 'immunizations', '[]'::jsonb),
    nullif(v_submission.patient_payload ->> 'enrolledPhysician', ''),
    nullif(v_submission.patient_payload ->> 'enrolmentStatus', ''),
    v_show_email,
    v_date_joined,
    v_health_card_effective,
    nullif(v_submission.patient_payload ->> 'assignedPhysicianMrp', ''),
    coalesce(p_reviewer_name, 'Intake Approval'),
    now()
  )
  RETURNING id INTO v_patient_row_id;

  IF p_reviewer_name IS NOT NULL THEN
    v_reviewer_note := 'Approved by ' || p_reviewer_name;
  ELSE
    v_reviewer_note := 'Approved via intake approvals';
  END IF;

  UPDATE public.patient_intake_submissions
     SET status = 'approved',
         reviewed_at = now(),
         reviewed_by = p_reviewer_id,
         decision_notes = v_reviewer_note,
         created_patient_id = v_patient_identifier,
         created_patient_record = v_patient_row_id
   WHERE id = p_submission_id;

  RETURN QUERY
    SELECT v_submission.id, v_patient_identifier, v_patient_row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_patient_intake_submission(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_patient_intake_submission(uuid, text, text, uuid) TO service_role;
