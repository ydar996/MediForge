-- Persist postal code and demographics from patient intake approval payload

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'Self Pay';

create or replace function public.approve_patient_intake_submission(
  p_submission_id uuid,
  p_prefix text default 'PAT',
  p_reviewer_name text default null,
  p_reviewer_id uuid default null
)
returns table (
  submission_id uuid,
  patient_identifier text,
  patient_row_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  select *
    into v_submission
  from public.patient_intake_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission % not found', p_submission_id using errcode = 'P0001';
  end if;

  if v_submission.status = 'rejected' then
    raise exception 'Submission % has already been rejected', p_submission_id using errcode = 'P0001';
  end if;

  if v_submission.status = 'approved' and v_submission.created_patient_id is not null then
    return query
      select v_submission.id, v_submission.created_patient_id, v_submission.created_patient_record;
    return;
  end if;

  if p_prefix is null or length(trim(p_prefix)) = 0 then
    p_prefix := 'PAT';
  end if;

  select coalesce(
           max(
             nullif(
               regexp_replace(patient_id, '^' || p_prefix, ''),
               ''
             )::int
           ),
           0
         ) + 1
    into v_counter
  from public.patients
  where organization_id = v_submission.organization_id
    and patient_id like p_prefix || '%';

  v_patient_identifier := p_prefix || lpad(v_counter::text, 4, '0');

  v_emergency_line1 := nullif(v_submission.patient_payload ->> 'emergencyAddressLine1', '');
  v_emergency_line2 := nullif(v_submission.patient_payload ->> 'emergencyAddressLine2', '');
  v_emergency_city := nullif(v_submission.patient_payload ->> 'emergencyCity', '');
  v_emergency_state := nullif(v_submission.patient_payload ->> 'emergencyState', '');
  v_emergency_country := nullif(v_submission.patient_payload ->> 'emergencyCountry', '');

  if v_emergency_line1 is null
     and v_emergency_line2 is null
     and v_emergency_city is null
     and v_emergency_state is null
     and v_emergency_country is null then
    v_emergency_line1 := nullif(v_submission.patient_payload ->> 'addressLine1', '');
    v_emergency_line2 := nullif(v_submission.patient_payload ->> 'addressLine2', '');
    v_emergency_city := nullif(v_submission.patient_payload ->> 'city', '');
    v_emergency_state := nullif(v_submission.patient_payload ->> 'state', '');
    v_emergency_country := nullif(v_submission.patient_payload ->> 'country', '');
  end if;

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

  insert into public.patients (
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
    tribe,
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
    created_by,
    created_at
  )
  values (
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
    nullif(v_submission.patient_payload ->> 'tribe', ''),
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
    coalesce(p_reviewer_name, 'Intake Approval'),
    now()
  )
  returning id into v_patient_row_id;

  if p_reviewer_name is not null then
    v_reviewer_note := 'Approved by ' || p_reviewer_name;
  else
    v_reviewer_note := 'Approved via intake approvals';
  end if;

  update public.patient_intake_submissions
     set status = 'approved',
         reviewed_at = now(),
         reviewed_by = p_reviewer_id,
         decision_notes = v_reviewer_note,
         created_patient_id = v_patient_identifier,
         created_patient_record = v_patient_row_id
   where id = p_submission_id;

  return query
    select v_submission.id, v_patient_identifier, v_patient_row_id;
end;
$$;

revoke all on function public.approve_patient_intake_submission(uuid, text, text, uuid) from public;
grant execute on function public.approve_patient_intake_submission(uuid, text, text, uuid) to anon, authenticated;
