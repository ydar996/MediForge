-- patient-documents RLS: stale first path segment (org UUID) vs canonical users.organization_id
--
-- Uploads sometimes embedded localStorage organization_id while the row in public.users
-- uses a different organization_id. RLS that only checks split_part(name, '/', 1) then
-- denies read/sign/download on the real object key (first segment "wrong"), while retrying
-- with the "correct" org prefix points at a key that was never written → 400 on all variants.
--
-- Fix: allow SELECT / UPDATE / DELETE when split_part(name, '/', 2) is the patients.id of
-- a row whose organization_id matches the caller's organization (same auth link as other
-- policies). INSERT stays strict: first segment must equal the user's organization_id.

DROP POLICY IF EXISTS "patient_documents_select_org" ON storage.objects;
DROP POLICY IF EXISTS "patient_documents_insert_org" ON storage.objects;
DROP POLICY IF EXISTS "patient_documents_update_org" ON storage.objects;
DROP POLICY IF EXISTS "patient_documents_delete_org" ON storage.objects;

CREATE POLICY "patient_documents_select_org"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    split_part(name, '/', 1) = (
      SELECT u.organization_id::text
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
         OR u.id = auth.uid()
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      INNER JOIN public.patients p ON p.organization_id = u.organization_id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND p.id::text = split_part(name, '/', 2)
        AND NOT COALESCE(p.deleted, false)
    )
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
  AND (
    split_part(name, '/', 1) = (
      SELECT u.organization_id::text
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
         OR u.id = auth.uid()
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      INNER JOIN public.patients p ON p.organization_id = u.organization_id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND p.id::text = split_part(name, '/', 2)
        AND NOT COALESCE(p.deleted, false)
    )
  )
);

CREATE POLICY "patient_documents_delete_org"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    split_part(name, '/', 1) = (
      SELECT u.organization_id::text
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
         OR u.id = auth.uid()
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      INNER JOIN public.patients p ON p.organization_id = u.organization_id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND p.id::text = split_part(name, '/', 2)
        AND NOT COALESCE(p.deleted, false)
    )
  )
);
