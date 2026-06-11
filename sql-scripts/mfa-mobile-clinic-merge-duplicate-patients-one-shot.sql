-- =============================================================================
-- MFA Mobile Clinic — merge duplicate patients (one shot)
-- =============================================================================
-- Run once in Supabase SQL Editor as a single transaction (entire script).
--
-- Fixes the case where loser MRNs were stored as MFA-MC001…005 (not MFA-MC0001…)
-- so prior DELETE/cascade missed them.
--
-- Losers → winners (display IDs / patient_id TEXT):
--   MFA-MC001 → MFA-MC0196   MFA-MC002 → MFA-MC0151   MFA-MC003 → MFA-MC0089
--   MFA-MC004 → MFA-MC0037   MFA-MC005 → MFA-MC0078
-- Optional (idempotent if already removed): MFA-MC0107 → MFA-MC0108
--
-- Organization: MFA Mobile Clinic
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_org CONSTANT uuid := '75b55411-f595-4ac4-9c5a-746702fd2792';
  rec RECORD;
  r_pair RECORD;
  v_old text;
  v_new text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1) TEXT cascades (display MRN on child tables)
  -- ---------------------------------------------------------------------------
  FOR rec IN
    SELECT * FROM (
      VALUES
        ('MFA-MC001'::text, 'MFA-MC0196'::text),
        ('MFA-MC002', 'MFA-MC0151'),
        ('MFA-MC003', 'MFA-MC0089'),
        ('MFA-MC004', 'MFA-MC0037'),
        ('MFA-MC005', 'MFA-MC0078'),
        ('MFA-MC0107', 'MFA-MC0108')
    ) AS t(old_mrn, new_mrn)
  LOOP
    v_old := rec.old_mrn;
    v_new := rec.new_mrn;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'appointments'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.appointments SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'clinical_notes'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.clinical_notes SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_encounters'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_encounters SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'lab_results'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.lab_results SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'lab_orders'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.lab_orders SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'prescriptions'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.prescriptions SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'billing_invoices'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.billing_invoices SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'payments'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.payments SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_documents'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_documents SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'referral_details'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.referral_details SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'preventive_care'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.preventive_care SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'dispensing_records'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.dispensing_records SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_intake_submissions'
        AND col.column_name = 'created_patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_intake_submissions
      SET created_patient_id = v_new
      WHERE organization_id = v_org AND created_patient_id = v_old;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables tbl
      JOIN information_schema.columns col ON col.table_name = tbl.table_name AND col.table_schema = tbl.table_schema
      WHERE tbl.table_schema = 'public' AND tbl.table_name = 'patient_intake_approvals'
        AND col.column_name = 'patient_id' AND col.data_type IN ('text', 'character varying')
    ) THEN
      UPDATE public.patient_intake_approvals SET patient_id = v_new WHERE organization_id = v_org AND patient_id = v_old;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 2) UUID FK cascades (portal / intake row pointer → patients.id)
  -- ---------------------------------------------------------------------------
  FOR r_pair IN
    SELECT l.id AS loser_uuid, w.id AS winner_uuid
    FROM (
      VALUES
        ('MFA-MC001'::text, 'MFA-MC0196'::text),
        ('MFA-MC002', 'MFA-MC0151'),
        ('MFA-MC003', 'MFA-MC0089'),
        ('MFA-MC004', 'MFA-MC0037'),
        ('MFA-MC005', 'MFA-MC0078'),
        ('MFA-MC0107', 'MFA-MC0108')
    ) AS m(lo_mrn, win_mrn)
    JOIN public.patients l ON l.organization_id = v_org AND l.patient_id = m.lo_mrn
    JOIN public.patients w ON w.organization_id = v_org AND w.patient_id = m.win_mrn
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name = 'patient_id' AND data_type = 'uuid'
    ) THEN
      UPDATE public.users
      SET patient_id = r_pair.winner_uuid, updated_at = NOW()
      WHERE organization_id = v_org AND patient_id = r_pair.loser_uuid;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'patient_intake_submissions'
        AND column_name = 'created_patient_record' AND data_type = 'uuid'
    ) THEN
      UPDATE public.patient_intake_submissions
      SET created_patient_record = r_pair.winner_uuid
      WHERE organization_id = v_org AND created_patient_record = r_pair.loser_uuid;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 3) Remove loser patient rows (winners unchanged)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.patients
  WHERE organization_id = v_org
    AND patient_id IN (
      'MFA-MC001', 'MFA-MC002', 'MFA-MC003', 'MFA-MC004', 'MFA-MC005', 'MFA-MC0107'
    );
END $$;

COMMIT;

-- Optional sanity check (run after):
-- SELECT patient_id, first_name, last_name FROM public.patients
-- WHERE organization_id = '75b55411-f595-4ac4-9c5a-746702fd2792'::uuid
--   AND patient_id IN ('MFA-MC001','MFA-MC002','MFA-MC003','MFA-MC004','MFA-MC005','MFA-MC0107');
-- Expect: 0 rows.
