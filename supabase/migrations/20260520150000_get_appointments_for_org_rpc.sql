-- Platform dashboard / secure-supabase: load appointments by org without relying on
-- per-session RLS (same pattern as get_patients_for_org).

CREATE OR REPLACE FUNCTION public.get_appointments_for_org(p_org_id uuid)
RETURNS SETOF public.appointments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.appointments
  WHERE organization_id = p_org_id
  ORDER BY appointment_date DESC NULLS LAST, appointment_time DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_appointments_for_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_appointments_for_org(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_appointments_for_org(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointments_for_org(uuid) TO service_role;
