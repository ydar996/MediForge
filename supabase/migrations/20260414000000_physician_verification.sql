-- Physician (doctor) credential verification: MDCN / regulatory body doc + medical diploma.
-- 90-day access window by default; platform admins may extend 30 or 45 days; unapproved after deadline blocks portal.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.auth_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

CREATE TABLE IF NOT EXISTS public.physician_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clock_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_access_until TIMESTAMPTZ NOT NULL,
  regulatory_body_notes TEXT,
  mdcn_storage_path TEXT,
  diploma_storage_path TEXT,
  submitted_for_review_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (review_status IN ('not_submitted', 'pending_review', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_auth_user_id UUID,
  review_notes TEXT,
  extension_granted_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT physician_verifications_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_physician_verifications_org ON public.physician_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_physician_verifications_status ON public.physician_verifications(review_status);
CREATE INDEX IF NOT EXISTS idx_physician_verifications_access_until ON public.physician_verifications(verification_access_until);

COMMENT ON TABLE public.physician_verifications IS 'Doctor credential uploads and platform review; access blocked when now > verification_access_until and review_status != approved';

CREATE OR REPLACE FUNCTION public.physician_verifications_set_access_until()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.verification_access_until IS NULL THEN
    NEW.verification_access_until := NEW.clock_started_at + interval '90 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_physician_verifications_access_default ON public.physician_verifications;
CREATE TRIGGER trg_physician_verifications_access_default
  BEFORE INSERT ON public.physician_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.physician_verifications_set_access_until();

DROP TRIGGER IF EXISTS trg_physician_verifications_updated_at ON public.physician_verifications;
CREATE TRIGGER trg_physician_verifications_updated_at
  BEFORE UPDATE ON public.physician_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE FUNCTION public.physician_verifications_enforce_update_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
BEGIN
  SELECT public.is_platform_admin() INTO v_admin;
  IF v_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.clock_started_at IS DISTINCT FROM OLD.clock_started_at
     OR NEW.extension_granted_count IS DISTINCT FROM OLD.extension_granted_count
     OR NEW.verification_access_until IS DISTINCT FROM OLD.verification_access_until
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by_auth_user_id IS DISTINCT FROM OLD.reviewed_by_auth_user_id THEN
    RAISE EXCEPTION 'Insufficient privilege to change protected verification fields';
  END IF;

  IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    IF NOT (
      OLD.review_status IN ('not_submitted', 'rejected') AND NEW.review_status = 'pending_review'
    ) THEN
      RAISE EXCEPTION 'Invalid review_status transition for physician';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_physician_verifications_enforce_update ON public.physician_verifications;
CREATE TRIGGER trg_physician_verifications_enforce_update
  BEFORE UPDATE ON public.physician_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.physician_verifications_enforce_update_rules();

ALTER TABLE public.physician_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "physician_verifications_select" ON public.physician_verifications;
CREATE POLICY "physician_verifications_select"
  ON public.physician_verifications FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR user_id IN (SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "physician_verifications_insert" ON public.physician_verifications;
CREATE POLICY "physician_verifications_insert"
  ON public.physician_verifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND lower(trim(u.role)) IN (
          'doctor', 'physician', 'medical doctor', 'medicaldoctor', 'dr', 'dr.', 'md'
        )
    )
 AND organization_id IN (
      SELECT u.organization_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "physician_verifications_update_doctor" ON public.physician_verifications;
CREATE POLICY "physician_verifications_update_doctor"
  ON public.physician_verifications FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "physician_verifications_update_platform" ON public.physician_verifications;
CREATE POLICY "physician_verifications_update_platform"
  ON public.physician_verifications FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Storage bucket: paths {organization_id}/{user_id}/filename
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'physician-verification-docs',
  'physician-verification-docs',
  false,
  26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  public = false;

DROP POLICY IF EXISTS "physician_verif_docs_select_doctor" ON storage.objects;
DROP POLICY IF EXISTS "physician_verif_docs_insert_doctor" ON storage.objects;
DROP POLICY IF EXISTS "physician_verif_docs_update_doctor" ON storage.objects;
DROP POLICY IF EXISTS "physician_verif_docs_delete_doctor" ON storage.objects;
DROP POLICY IF EXISTS "physician_verif_docs_select_platform" ON storage.objects;

CREATE POLICY "physician_verif_docs_select_doctor"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'physician-verification-docs'
    AND split_part(name, '/', 1) = (SELECT u.organization_id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
    AND split_part(name, '/', 2) = (SELECT u.id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "physician_verif_docs_insert_doctor"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'physician-verification-docs'
    AND split_part(name, '/', 1) = (SELECT u.organization_id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
    AND split_part(name, '/', 2) = (SELECT u.id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "physician_verif_docs_update_doctor"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'physician-verification-docs'
    AND split_part(name, '/', 1) = (SELECT u.organization_id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
    AND split_part(name, '/', 2) = (SELECT u.id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "physician_verif_docs_delete_doctor"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'physician-verification-docs'
    AND split_part(name, '/', 1) = (SELECT u.organization_id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
    AND split_part(name, '/', 2) = (SELECT u.id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "physician_verif_docs_select_platform"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'physician-verification-docs'
    AND public.is_platform_admin()
  );
