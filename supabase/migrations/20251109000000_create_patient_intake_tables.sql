-- ============================================
-- Patient Intake Self-Registration Tables
-- ============================================
-- Purpose:
--   * Allow prospective patients to submit intake forms online.
--   * Queue submissions for clinic administrators to review and approve.
--   * Support organization-defined custom fields rendered on the public form.
-- Security:
--   * RLS enabled on both tables.
--   * Anonymous inserts permitted for intake submissions (pending status only).
--   * Organization staff (authenticated) restricted to their own organization data.
--   * Custom fields are publicly readable but only staff can manage them.
-- ============================================

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------
-- Helper function to stamp updated_at fields
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------
-- Table: patient_intake_submissions
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_intake_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, archived
  patient_payload JSONB NOT NULL,
  custom_field_values JSONB,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  submitted_from TEXT, -- e.g., sms / whatsapp / email
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID, -- links to auth.users.id when available
  decision_notes TEXT,
  created_patient_id TEXT,
  created_patient_record UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_patient_intake_submissions_org_status
  ON public.patient_intake_submissions (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_patient_intake_submissions_created_at
  ON public.patient_intake_submissions (created_at DESC);

DROP TRIGGER IF EXISTS trg_patient_intake_submissions_updated_at ON public.patient_intake_submissions;
CREATE TRIGGER trg_patient_intake_submissions_updated_at
  BEFORE UPDATE ON public.patient_intake_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.patient_intake_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous intake submissions (pending only) so patients can submit without an account.
DROP POLICY IF EXISTS "Anon can submit patient intake forms" ON public.patient_intake_submissions;
CREATE POLICY "Anon can submit patient intake forms"
  ON public.patient_intake_submissions
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'pending'
    AND organization_id IS NOT NULL
  );

-- Allow organization staff to view their own intake submissions.
DROP POLICY IF EXISTS "Staff can view org intake submissions" ON public.patient_intake_submissions;
CREATE POLICY "Staff can view org intake submissions"
  ON public.patient_intake_submissions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND (role IS NULL OR lower(role) != 'patient')
        AND organization_id IS NOT NULL
    )
  );

-- Allow staff to manage (insert via back-office tooling), update, and delete their organization's submissions.
DROP POLICY IF EXISTS "Staff can manage org intake submissions" ON public.patient_intake_submissions;
CREATE POLICY "Staff can manage org intake submissions"
  ON public.patient_intake_submissions
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND (role IS NULL OR lower(role) != 'patient')
        AND organization_id IS NOT NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND (role IS NULL OR lower(role) != 'patient')
        AND organization_id IS NOT NULL
    )
  );

-- --------------------------------------------
-- Table: patient_intake_custom_fields
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_intake_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, textarea, select, multiselect, number, date, checkbox
  helper_text TEXT,
  options JSONB, -- e.g., [{ "value": "cash", "label": "Cash" }]
  required BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_patient_intake_custom_fields_org_key
  ON public.patient_intake_custom_fields (organization_id, field_key);

DROP TRIGGER IF EXISTS trg_patient_intake_custom_fields_updated_at ON public.patient_intake_custom_fields;
CREATE TRIGGER trg_patient_intake_custom_fields_updated_at
  BEFORE UPDATE ON public.patient_intake_custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.patient_intake_custom_fields ENABLE ROW LEVEL SECURITY;

-- Patients (anon) need to read active custom fields to render the form.
DROP POLICY IF EXISTS "Anon can read custom intake fields" ON public.patient_intake_custom_fields;
CREATE POLICY "Anon can read custom intake fields"
  ON public.patient_intake_custom_fields
  FOR SELECT
  TO anon
  USING (active = TRUE);

-- Organization staff can manage their custom fields.
DROP POLICY IF EXISTS "Staff can manage custom intake fields" ON public.patient_intake_custom_fields;
CREATE POLICY "Staff can manage custom intake fields"
  ON public.patient_intake_custom_fields
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND (role IS NULL OR lower(role) != 'patient')
        AND organization_id IS NOT NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE (id = auth.uid() OR auth_user_id = auth.uid())
        AND (role IS NULL OR lower(role) != 'patient')
        AND organization_id IS NOT NULL
    )
  );

-- --------------------------------------------
-- Seed helper rows (optional)
-- --------------------------------------------
COMMENT ON TABLE public.patient_intake_submissions IS 'Self-service patient intake submissions awaiting staff review.';
COMMENT ON TABLE public.patient_intake_custom_fields IS 'Custom fields rendered on the patient intake form per organization.';


