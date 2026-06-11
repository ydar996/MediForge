-- Purpose: tighten execution privileges for sensitive RPCs now proxied via Netlify functions

revoke execute on function public.get_patient_intake_submissions(uuid, text) from public;
revoke execute on function public.get_patient_intake_submissions(uuid, text) from anon;
revoke execute on function public.get_patient_intake_submissions(uuid, text) from authenticated;
grant execute on function public.get_patient_intake_submissions(uuid, text) to service_role;

revoke execute on function public.approve_patient_intake_submission(uuid, text, text, uuid) from public;
revoke execute on function public.approve_patient_intake_submission(uuid, text, text, uuid) from anon;
revoke execute on function public.approve_patient_intake_submission(uuid, text, text, uuid) from authenticated;
grant execute on function public.approve_patient_intake_submission(uuid, text, text, uuid) to service_role;

revoke execute on function public.reject_patient_intake_submission(uuid, text, text, uuid) from public;
revoke execute on function public.reject_patient_intake_submission(uuid, text, text, uuid) from anon;
revoke execute on function public.reject_patient_intake_submission(uuid, text, text, uuid) from authenticated;
grant execute on function public.reject_patient_intake_submission(uuid, text, text, uuid) to service_role;

revoke execute on function public.get_patients_for_org(uuid) from public;
revoke execute on function public.get_patients_for_org(uuid) from anon;
revoke execute on function public.get_patients_for_org(uuid) from authenticated;
grant execute on function public.get_patients_for_org(uuid) to service_role;

revoke execute on function public.get_organizations_with_owner() from public;
revoke execute on function public.get_organizations_with_owner() from anon;
revoke execute on function public.get_organizations_with_owner() from authenticated;
grant execute on function public.get_organizations_with_owner() to service_role;

revoke execute on function public.get_organization_users(uuid) from public;
revoke execute on function public.get_organization_users(uuid) from anon;
revoke execute on function public.get_organization_users(uuid) from authenticated;
grant execute on function public.get_organization_users(uuid) to service_role;


