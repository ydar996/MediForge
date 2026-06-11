-- Purpose: Expose a secure helper for fetching intake submissions per organization
-- This bypasses RLS for anon/authenticated clients by using a SECURITY DEFINER function.

create or replace function public.get_patient_intake_submissions(
  p_org_id uuid,
  p_status text default null
)
returns setof public.patient_intake_submissions
language sql
security definer
set search_path = public
as $$
  select *
  from public.patient_intake_submissions
  where organization_id = p_org_id
    and (
      p_status is null
      or lower(status) = lower(p_status)
    )
  order by created_at desc;
$$;

revoke all on function public.get_patient_intake_submissions(uuid, text) from public;
grant execute on function public.get_patient_intake_submissions(uuid, text) to anon, authenticated;

