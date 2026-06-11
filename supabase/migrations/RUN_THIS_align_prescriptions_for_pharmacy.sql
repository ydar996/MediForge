-- Run this in Supabase SQL Editor if you get errors when using "Add to pharmacy queue"
-- or when the Pharmacy/Accountant workflow expects columns that don't exist.
--
-- Your prescriptions table may have been created from an older schema (e.g. one row per
-- medication with medication_name NOT NULL). The pharmacy workflow expects one row per
-- prescription with a medications JSONB array. This script aligns the table so both work.

-- 1. Make medication_name nullable (pharmacy inserts use medications JSONB, not medication_name)
ALTER TABLE prescriptions ALTER COLUMN medication_name DROP NOT NULL;

-- 2. Add pharmacy columns if missing (one row per prescription, with medications array)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_date DATE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_status TEXT DEFAULT 'pending';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS sent_to_pharmacy_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS signature_date TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS source_prescription_id TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES users(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID REFERENCES users(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS sent_out_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS sent_out_notes TEXT;

-- 3. Allow extended pharmacy_status values (drop old check if exists, add new)
DO $$
BEGIN
  ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_pharmacy_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_pharmacy_status_check
  CHECK (pharmacy_status IN (
    'pending', 'approved_by_pharmacist', 'in-process', 'filled', 'completed',
    'cancelled', 'rejected', 'sent_out', 'external'
  ));
