-- Allow platform administrators to read all users and organizations (for physician verification dashboard).
-- Allow platform admins to create physician_verifications rows for doctors who have not yet triggered lazy insert.

DROP POLICY IF EXISTS "platform_admins_select_all_users" ON public.users;
CREATE POLICY "platform_admins_select_all_users"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admins_select_all_organizations" ON public.organizations;
CREATE POLICY "platform_admins_select_all_organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "physician_verifications_insert_platform_admin" ON public.physician_verifications;
CREATE POLICY "physician_verifications_insert_platform_admin"
  ON public.physician_verifications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    AND organization_id = (SELECT u.organization_id FROM public.users u WHERE u.id = user_id)
  );
