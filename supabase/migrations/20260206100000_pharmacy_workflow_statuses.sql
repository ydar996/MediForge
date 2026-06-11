-- Pharmacy workflow: approved by pharmacist, paid, per-medication status, reject/sent out
-- Run after 20260206000005_create_prescriptions_table.sql

-- 1. Extend pharmacy_status (add approved_by_pharmacist, rejected, sent_out)
DO $$
BEGIN
  ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_pharmacy_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_pharmacy_status_check
  CHECK (pharmacy_status IN (
    'pending',
    'approved_by_pharmacist',
    'in-process',
    'filled',
    'completed',
    'cancelled',
    'rejected',
    'sent_out',
    'external'
  ));

-- 2. Columns for approval and payment
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES users(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID REFERENCES users(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS sent_out_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS sent_out_notes TEXT;

-- 3. medication_inventory: ensure selling_price_per_unit has default 50 for billing
UPDATE medication_inventory SET selling_price_per_unit = 50 WHERE selling_price_per_unit IS NULL;
ALTER TABLE medication_inventory ALTER COLUMN selling_price_per_unit SET DEFAULT 50;

COMMENT ON COLUMN prescriptions.approved_at IS 'When pharmacist approved after allergy check';
COMMENT ON COLUMN prescriptions.paid_at IS 'When accountant marked payment received';
COMMENT ON COLUMN prescriptions.invoice_id IS 'Invoice id after accountant generated invoice';
