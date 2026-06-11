-- =============================================================================
-- MFA Mobile Clinic — align patient_id: MIN#### → MFA-MC#### (database source of truth)
-- =============================================================================
-- Org: MFA Mobile Clinic | organization_id below (UUID).
--
-- Rewrites legacy display IDs MIN + 4 digits → MFA-MC + same 4 digits (e.g. MIN9810 → MFA-MC9810).
-- Cascades TEXT patient_id / created_patient_id across the same tables as migration
--   supabase/migrations/20260312000000_patient_id_prefix_min_to_mfa_mc_bga5.sql
--
-- UUID columns referencing patients(id) are unchanged (still correct).
--
-- Preconditions:
--   If UNIQUE(organization_id, patient_id) fires, another row already owns the MFA-MC target —
--   resolve duplicate MRNs first (merge/delete), then re-run.
--
-- Run once in Supabase SQL Editor as a whole script (BEGIN … COMMIT).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Org settings: current + previous prefix (used by UI redirect / mapping logic)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid := '75b55411-f595-4ac4-9c5a-746702fd2792';
  v_settings jsonb;
BEGIN
  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM public.organizations WHERE id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization % not found', v_org_id;
  END IF;

  v_settings := v_settings || jsonb_build_object(
    'patient_id_prefix', 'MFA-MC',
    'patient_id_previous_prefix', 'MIN'
  );

  UPDATE public.organizations
  SET settings = v_settings, updated_at = NOW()
  WHERE id = v_org_id;

  RAISE NOTICE 'Org % settings: patient_id_prefix=MFA-MC, patient_id_previous_prefix=MIN', v_org_id;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Patients + TEXT cascades
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid := '75b55411-f595-4ac4-9c5a-746702fd2792';
  v_old_id text;
  v_new_id text;
  v_num text;
  v_updated int;
BEGIN
  FOR v_old_id, v_num IN
    SELECT patient_id, SUBSTRING(patient_id FROM 4)
    FROM public.patients
    WHERE organization_id = v_org_id
      AND patient_id ~ '^MIN[0-9]{4}$'
  LOOP
    v_new_id := 'MFA-MC' || v_num;

    UPDATE public.patients SET patient_id = v_new_id, updated_at = NOW()
    WHERE organization_id = v_org_id AND patient_id = v_old_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN
      RAISE NOTICE 'Patients: % -> %', v_old_id, v_new_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'appointments'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.appointments SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'clinical_notes'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.clinical_notes SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_encounters'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_encounters SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'lab_results'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.lab_results SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'lab_orders'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.lab_orders SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'prescriptions'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.prescriptions SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'billing_invoices'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.billing_invoices SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'payments'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.payments SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_documents'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_documents SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'referral_details'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.referral_details SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'preventive_care'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.preventive_care SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'dispensing_records'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.dispensing_records SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_intake_submissions'
        AND col.column_name = 'created_patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_intake_submissions
      SET created_patient_id = v_new_id
      WHERE organization_id = v_org_id AND created_patient_id = v_old_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_intake_approvals'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_intake_approvals SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'MIN→MFA-MC alignment finished for org %', v_org_id;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verification (optional)
-- -----------------------------------------------------------------------------
-- Expect 0 rows:
-- SELECT patient_id FROM public.patients
-- WHERE organization_id = '75b55411-f595-4ac4-9c5a-746702fd2792'::uuid
--   AND patient_id ~ '^MIN[0-9]{4}$';
