-- Ensure patients table has prescriptions column (for pharmacy to show legacy prescriptions from patient records)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS prescriptions JSONB DEFAULT '[]'::jsonb;

-- Create prescriptions table (used by prescription form and Pharmacy dashboard)
-- If your project never had this table, the pharmacy dashboard and createPrescription() inserts will fail without it.
-- This migration creates the table with the schema expected by js/prescriptions-supabase.js and pharmacy-manager.js

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  prescriber_id TEXT,
  diagnosis TEXT,
  medications JSONB DEFAULT '[]'::jsonb,
  signature TEXT,
  signature_date TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  admission_id UUID,
  -- Pharmacy fulfilment (pharmacy dashboard)
  pharmacy_status TEXT DEFAULT 'pending' CHECK (pharmacy_status IN ('pending', 'in-process', 'filled', 'cancelled', 'external')),
  sent_to_pharmacy_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,
  filled_by_user_id UUID REFERENCES users(id),
  pharmacy_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_organization ON prescriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy_status ON prescriptions(pharmacy_status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_sent_to_pharmacy ON prescriptions(sent_to_pharmacy_at);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at);

-- RLS: allow organization staff to manage prescriptions
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view organization prescriptions" ON prescriptions;
CREATE POLICY "Staff can view organization prescriptions" ON prescriptions
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can insert organization prescriptions" ON prescriptions;
CREATE POLICY "Staff can insert organization prescriptions" ON prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can update organization prescriptions" ON prescriptions;
CREATE POLICY "Staff can update organization prescriptions" ON prescriptions
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE prescriptions IS 'Prescriptions created by doctors; pending ones appear on Pharmacy dashboard when in-house pharmacy is enabled.';

-- Ensure pharmacy columns exist if table was created from an older schema
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_status TEXT DEFAULT 'pending';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS sent_to_pharmacy_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS filled_by_user_id UUID REFERENCES users(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescriber_id TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS signature_date TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS admission_id UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS source_prescription_id TEXT;
-- Accountant/Ready-to-fill: paid_at and invoice_id (required for Ready to fill tab)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS invoice_id TEXT;

-- Allow 'external' in pharmacy_status (used when in-house pharmacy is disabled)
DO $$
BEGIN
  ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_pharmacy_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_pharmacy_status_check
  CHECK (pharmacy_status IN ('pending', 'in-process', 'filled', 'cancelled', 'external'));
