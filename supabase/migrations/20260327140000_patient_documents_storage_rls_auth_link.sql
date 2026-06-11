-- Align patient-documents storage RLS with other org-scoped policies (e.g. general ledger):
-- resolve organization_id using auth_user_id OR public.users.id = auth.uid().
-- Some environments link auth users to public.users inconsistently; auth-only lookup hid all objects.

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
       OR u.id = auth.uid()
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
       OR u.id = auth.uid()
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
       OR u.id = auth.uid()
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
       OR u.id = auth.uid()
    LIMIT 1
  )
);
