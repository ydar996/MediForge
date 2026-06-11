-- Migration: Patient ID prefix MIN→MFA for organization MIN-2026-OO9A
-- Purpose: Change patient numbering from MINXXXX to MFAXXXX (retroactive + future)
-- Runs in single transaction - all or nothing

BEGIN;

-- 1. Find org and update settings (patient_id_prefix + patient_id_previous_prefix for URL redirect)
DO $$
DECLARE
  v_org_id UUID;
  v_settings JSONB;
BEGIN
  SELECT id, COALESCE(settings, '{}'::jsonb)
  INTO v_org_id, v_settings
  FROM public.organizations
  WHERE org_code = 'MIN-2026-OO9A';

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'Organization with org_code MIN-2026-OO9A not found. Skipping migration.';
    RETURN;
  END IF;

  v_settings := v_settings || jsonb_build_object(
    'patient_id_prefix', 'MFA',
    'patient_id_previous_prefix', 'MIN'
  );

  UPDATE public.organizations
  SET settings = v_settings, updated_at = NOW()
  WHERE id = v_org_id;

  RAISE NOTICE 'Updated org % with patient_id_prefix=MFA, patient_id_previous_prefix=MIN', v_org_id;
END $$;

-- 2. Create temp mapping and update ALL tables
-- Only updates tables where patient_id/created_patient_id is TEXT (display ID).
-- Tables with patient_id as UUID (reference to patients.id) are skipped - UUID does not change.
DO $$
DECLARE
  v_org_id UUID;
  v_old_id TEXT;
  v_new_id TEXT;
  v_num TEXT;
  v_updated INT;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE org_code = 'MIN-2026-OO9A';

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Update patients (source of truth)
  FOR v_old_id, v_num IN
    SELECT patient_id, SUBSTRING(patient_id FROM 4)
    FROM public.patients
    WHERE organization_id = v_org_id
      AND patient_id ~ '^MIN[0-9]{4}$'
  LOOP
    v_new_id := 'MFA' || v_num;

    UPDATE public.patients SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      RAISE NOTICE 'Patients: % -> %', v_old_id, v_new_id;
    END IF;

    -- Cascade to related tables (only where patient_id column is TEXT type)
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'appointments' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.appointments SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'clinical_notes' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.clinical_notes SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'patient_encounters' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.patient_encounters SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'lab_results' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.lab_results SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'lab_orders' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.lab_orders SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'prescriptions' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.prescriptions SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'billing_invoices' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.billing_invoices SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'payments' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.payments SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'patient_documents' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.patient_documents SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'referral_details' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.referral_details SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'preventive_care' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.preventive_care SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'dispensing_records' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.dispensing_records SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'patient_intake_submissions' AND c.column_name = 'created_patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.patient_intake_submissions SET created_patient_id = v_new_id WHERE organization_id = v_org_id AND created_patient_id = v_old_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'MIN->MFA migration completed for org %', v_org_id;
END $$;

COMMIT;
