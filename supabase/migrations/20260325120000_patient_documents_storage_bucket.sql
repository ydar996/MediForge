-- Private bucket for patient document files (Pre-EMR scans, images, PDFs).
-- Path layout: {organization_id}/{patient_row_uuid}/pre-emr-medical-records/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-documents',
  'patient-documents',
  false,
  52428800,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  public = false;

-- Policies: staff (authenticated) may only access objects whose first path segment matches their organization_id.

DROP POLICY IF EXISTS "patient_documents_select_org" ON storage.objects;
DROP POLICY IF EXISTS "patient_documents_insert_org" ON storage.objects;
DROP POLICY IF EXISTS "patient_documents_update_org" ON storage.objects;
DROP POLICY IF EXISTS "patient_documents_delete_org" ON storage.objects;

CREATE POLICY "patient_documents_select_org"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND split_part(name, '/', 1) = (
    SELECT u.organization_id::text
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "patient_documents_insert_org"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND split_part(name, '/', 1) = (
    SELECT u.organization_id::text
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "patient_documents_update_org"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND split_part(name, '/', 1) = (
    SELECT u.organization_id::text
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "patient_documents_delete_org"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND split_part(name, '/', 1) = (
    SELECT u.organization_id::text
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  )
);
