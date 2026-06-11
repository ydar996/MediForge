-- Purpose: Approve and reject patient intake submissions without requiring client-side elevated privileges.
-- These SECURITY DEFINER functions encapsulate the approval workflow so the browser can
-- call them using the anon key while respecting RLS policies.

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
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
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
    nullif(
      trim(
        coalesce(v_submission.patient_payload ->> 'emergencyFirstName', '') || ' ' ||
        coalesce(v_submission.patient_payload ->> 'emergencyLastName', '')
      ),
      ''
    ),
    nullif(v_submission.patient_payload ->> 'emergencyPhone', ''),
    nullif(v_submission.patient_payload ->> 'emergencyRelationship', ''),
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


create or replace function public.reject_patient_intake_submission(
  p_submission_id uuid,
  p_reason text default null,
  p_reviewer_name text default null,
  p_reviewer_id uuid default null
)
returns table (
  submission_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission patient_intake_submissions%rowtype;
  v_note text;
begin
  select *
    into v_submission
  from public.patient_intake_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission % not found', p_submission_id using errcode = 'P0001';
  end if;

  if v_submission.status = 'approved' then
    raise exception 'Submission % has already been approved', p_submission_id using errcode = 'P0001';
  end if;

  if p_reviewer_name is not null then
    if p_reason is not null then
      v_note := p_reason || ' (by ' || p_reviewer_name || ')';
    else
      v_note := 'Rejected by ' || p_reviewer_name;
    end if;
  else
    v_note := coalesce(p_reason, 'Rejected via intake approvals');
  end if;

  update public.patient_intake_submissions
     set status = 'rejected',
         reviewed_at = now(),
         reviewed_by = p_reviewer_id,
         decision_notes = v_note
   where id = p_submission_id;

  return query select v_submission.id, 'rejected';
end;
$$;

revoke all on function public.reject_patient_intake_submission(uuid, text, text, uuid) from public;
grant execute on function public.reject_patient_intake_submission(uuid, text, text, uuid) to anon, authenticated;

