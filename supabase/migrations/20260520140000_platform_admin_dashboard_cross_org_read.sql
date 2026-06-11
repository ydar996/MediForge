-- Platform dashboard: allow platform admins to aggregate patients/appointments across orgs
-- and update users when linking orphaned accounts (existing SELECT policies from 20260415120000).

DROP POLICY IF EXISTS platform_admins_select_all_patients ON public.patients;
CREATE POLICY platform_admins_select_all_patients
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admins_select_all_appointments ON public.appointments;
CREATE POLICY platform_admins_select_all_appointments
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS platform_admins_update_all_users ON public.users;
CREATE POLICY platform_admins_update_all_users
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
