-- Tighten RLS on PHI/adjacent tables that were created via SQL scripts outside migrations.
-- Depends on public.is_platform_admin() (physician_verification migration).
-- Helpers are SECURITY INVOKER so they honor the requesting auth.uid().
-- Test: registration, staff clinical + billing flows, patient portal read paths, anon security_event insert.

CREATE OR REPLACE FUNCTION public.auth_is_org_staff_or_platform_admin(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_platform_admin() THEN TRUE
      WHEN p_org IS NULL THEN FALSE
      ELSE EXISTS (
        SELECT 1 FROM public.users u
        WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
          AND u.organization_id = p_org
          AND u.role <> 'Patient'
          AND u.role <> 'patient'
      )
    END;
$$;

CREATE OR REPLACE FUNCTION public.auth_can_access_org_patient_data(p_org uuid, p_patient_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.auth_is_org_staff_or_platform_admin(p_org)
  OR (
    p_patient_id IS NOT NULL AND (
      p_patient_id IN (
        SELECT u.patient_id::text FROM public.users u
        WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
          AND (u.role = 'Patient' OR u.role = 'patient')
          AND u.patient_id IS NOT NULL
      )
      OR
      p_patient_id IN (
        SELECT p.id::text FROM public.patients p
        INNER JOIN public.users u ON u.patient_id = p.id
        WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
          AND (u.role = 'Patient' OR u.role = 'patient')
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_org_staff_or_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_can_access_org_patient_data(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_org_staff_or_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_can_access_org_patient_data(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Re-enable core tables if drift / manual scripts disabled RLS.
-- Existing policies remain; omit if your database has intentionally disabled RLS.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.patients') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.appointments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- security_events: remove permissive/global reads; preserve typed inserts (anon pre-login).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.security_events') IS NOT NULL THEN
    ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Authenticated users can view security events" ON public.security_events;
    DROP POLICY IF EXISTS "Authenticated users can view security events." ON public.security_events;
    DROP POLICY IF EXISTS "Platform admins can view all security events" ON public.security_events;

    DROP POLICY IF EXISTS security_events_staff_org_select ON public.security_events;
    CREATE POLICY security_events_staff_org_select
      ON public.security_events
      FOR SELECT
      TO authenticated
      USING (
        public.is_platform_admin()
        OR (
          organization_id IS NOT NULL
          AND public.auth_is_org_staff_or_platform_admin(organization_id)
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- clinical_notes: revoke dangerous grants; tighten policies.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.clinical_notes') IS NOT NULL THEN
    ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

    REVOKE ALL ON TABLE public.clinical_notes FROM anon;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.clinical_notes FROM anon;

    DROP POLICY IF EXISTS "Users can access clinical notes for their organization" ON public.clinical_notes;
    DROP POLICY IF EXISTS clinical_notes_organization_access ON public.clinical_notes;
    DROP POLICY IF EXISTS clinical_notes_authenticated_access ON public.clinical_notes;
    DROP POLICY IF EXISTS clinical_notes_authenticated_all ON public.clinical_notes;
    DROP POLICY IF EXISTS "clinical_notes_org_access_all" ON public.clinical_notes;
    DROP POLICY IF EXISTS "clinical_notes_staff_all_org" ON public.clinical_notes;
    DROP POLICY IF EXISTS clinical_notes_staff_all_org ON public.clinical_notes;
    DROP POLICY IF EXISTS clinical_notes_patient_select ON public.clinical_notes;
    DROP POLICY IF EXISTS clinical_notes_staff_all ON public.clinical_notes;

    CREATE POLICY clinical_notes_staff_all_org
      ON public.clinical_notes
      FOR ALL
      TO authenticated
      USING (public.auth_is_org_staff_or_platform_admin(organization_id))
      WITH CHECK (public.auth_is_org_staff_or_platform_admin(organization_id));

    CREATE POLICY clinical_notes_patient_select
      ON public.clinical_notes
      FOR SELECT
      TO authenticated
      USING (public.auth_can_access_org_patient_data(organization_id, patient_id::text));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Standard PHI tables from COMPLETE schema (organization_id + patient_id TEXT).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'patient_encounters', 'vital_signs', 'diagnoses', 'medications', 'medical_history',
    'preventive_care', 'lab_orders', 'imaging_orders', 'referrals', 'allergies',
    'immunizations', 'imaging_results', 'clinical_orders', 'patient_encounter_requests',
    'referral_details', 'billing_invoices', 'billing_payments', 'specialists'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id'
    )
       OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'patient_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS clinical_rls_staff_all_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      $f$
      CREATE POLICY clinical_rls_staff_all_%1$I ON public.%1$I
        FOR ALL
        TO authenticated
        USING (public.auth_is_org_staff_or_platform_admin(organization_id))
        WITH CHECK (public.auth_is_org_staff_or_platform_admin(organization_id))
      $f$, tbl);

    EXECUTE format('DROP POLICY IF EXISTS clinical_rls_patient_sel_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      $f$
      CREATE POLICY clinical_rls_patient_sel_%1$I ON public.%1$I
        FOR SELECT
        TO authenticated
        USING (public.auth_can_access_org_patient_data(organization_id, patient_id::text))
      $f$, tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Row types without organization_id but linked via parent tables.
-- ---------------------------------------------------------------------------

-- Patient lab/imaging/order result files (parent: clinical_orders)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_results') THEN
    ALTER TABLE public.order_results ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS clinical_rls_staff_all_order_results ON public.order_results;
    CREATE POLICY clinical_rls_staff_all_order_results ON public.order_results
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.clinical_orders co
          WHERE co.id = order_results.order_id
            AND public.auth_is_org_staff_or_platform_admin(co.organization_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.clinical_orders co
          WHERE co.id = order_results.order_id
            AND public.auth_is_org_staff_or_platform_admin(co.organization_id)
        )
      );

    DROP POLICY IF EXISTS clinical_rls_patient_sel_order_results ON public.order_results;
    CREATE POLICY clinical_rls_patient_sel_order_results ON public.order_results
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.clinical_orders co
          WHERE co.id = order_results.order_id
            AND public.auth_can_access_org_patient_data(co.organization_id, co.patient_id::text)
        )
      );
  END IF;
END $$;

-- Encounter audit fragments (parent: patient_encounters)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'soap_audit_trail') THEN
    ALTER TABLE public.soap_audit_trail ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS clinical_rls_staff_all_soap_audit_trail ON public.soap_audit_trail;
    CREATE POLICY clinical_rls_staff_all_soap_audit_trail ON public.soap_audit_trail
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.patient_encounters pe
          WHERE pe.id = soap_audit_trail.encounter_id
            AND public.auth_is_org_staff_or_platform_admin(pe.organization_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.patient_encounters pe
          WHERE pe.id = soap_audit_trail.encounter_id
            AND public.auth_is_org_staff_or_platform_admin(pe.organization_id)
        )
      );

    DROP POLICY IF EXISTS clinical_rls_patient_sel_soap_audit_trail ON public.soap_audit_trail;
    CREATE POLICY clinical_rls_patient_sel_soap_audit_trail ON public.soap_audit_trail
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.patient_encounters pe
          WHERE pe.id = soap_audit_trail.encounter_id
            AND public.auth_can_access_org_patient_data(pe.organization_id, pe.patient_id::text)
        )
      );
  END IF;
END $$;

-- Attachment rows (parent: preventive_care)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'preventive_care_attachments') THEN
    ALTER TABLE public.preventive_care_attachments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS clinical_rls_staff_all_preventive_care_attachments ON public.preventive_care_attachments;
    CREATE POLICY clinical_rls_staff_all_preventive_care_attachments ON public.preventive_care_attachments
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.preventive_care pc
          WHERE pc.id = preventive_care_attachments.preventive_care_id
            AND public.auth_is_org_staff_or_platform_admin(pc.organization_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.preventive_care pc
          WHERE pc.id = preventive_care_attachments.preventive_care_id
            AND public.auth_is_org_staff_or_platform_admin(pc.organization_id)
        )
      );

    DROP POLICY IF EXISTS clinical_rls_patient_sel_preventive_care_attachments ON public.preventive_care_attachments;
    CREATE POLICY clinical_rls_patient_sel_preventive_care_attachments ON public.preventive_care_attachments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.preventive_care pc
          WHERE pc.id = preventive_care_attachments.preventive_care_id
            AND public.auth_can_access_org_patient_data(pc.organization_id, pc.patient_id::text)
        )
      );
  END IF;
END $$;

-- Invoice line-items (parent: billing_invoices)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_invoice_services') THEN
    ALTER TABLE public.billing_invoice_services ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS clinical_rls_staff_all_billing_invoice_services ON public.billing_invoice_services;
    CREATE POLICY clinical_rls_staff_all_billing_invoice_services ON public.billing_invoice_services
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.billing_invoices bi
          WHERE bi.id = billing_invoice_services.invoice_id
            AND public.auth_is_org_staff_or_platform_admin(bi.organization_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.billing_invoices bi
          WHERE bi.id = billing_invoice_services.invoice_id
            AND public.auth_is_org_staff_or_platform_admin(bi.organization_id)
        )
      );

    DROP POLICY IF EXISTS clinical_rls_patient_sel_billing_invoice_services ON public.billing_invoice_services;
    CREATE POLICY clinical_rls_patient_sel_billing_invoice_services ON public.billing_invoice_services
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.billing_invoices bi
          WHERE bi.id = billing_invoice_services.invoice_id
            AND public.auth_can_access_org_patient_data(bi.organization_id, bi.patient_id::text)
        )
      );
  END IF;
END $$;

-- Subscription / org billing snapshots (typically org admins + platform admins)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_history')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'billing_history' AND column_name = 'organization_id'
     )
  THEN
    ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS clinical_rls_staff_all_billing_history ON public.billing_history;
    CREATE POLICY clinical_rls_staff_all_billing_history ON public.billing_history
      FOR ALL
      TO authenticated
      USING (public.auth_is_org_staff_or_platform_admin(organization_id))
      WITH CHECK (public.auth_is_org_staff_or_platform_admin(organization_id));
  END IF;
END $$;

-- Optional remote settings table — lock down unless platform admin row rules exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_settings'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS clinical_rls_staff_sel_platform_settings ON public.platform_settings;
  DROP POLICY IF EXISTS clinical_rls_staff_mod_platform_settings ON public.platform_settings;
  DROP POLICY IF EXISTS clinical_rls_staff_upd_platform_settings ON public.platform_settings;
  DROP POLICY IF EXISTS clinical_rls_staff_del_platform_settings ON public.platform_settings;
  DROP POLICY IF EXISTS clinical_rls_org_all_platform_settings ON public.platform_settings;
  DROP POLICY IF EXISTS clinical_rls_pfadmin_only_platform_settings ON public.platform_settings;
  DROP POLICY IF EXISTS clinical_rls_pfadmin_all_platform_settings ON public.platform_settings;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_settings' AND column_name = 'organization_id'
  ) THEN
    CREATE POLICY clinical_rls_org_all_platform_settings ON public.platform_settings
      FOR ALL TO authenticated
      USING (public.auth_is_org_staff_or_platform_admin(organization_id))
      WITH CHECK (public.auth_is_org_staff_or_platform_admin(organization_id));
  ELSE
    CREATE POLICY clinical_rls_pfadmin_all_platform_settings ON public.platform_settings
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;
