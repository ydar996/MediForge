-- Run this in Supabase SQL Editor if you see "column prescriptions.paid_at does not exist"
-- (e.g. when opening the Ready to fill tab on Pharmacy dashboard)

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS invoice_id TEXT;

COMMENT ON COLUMN prescriptions.paid_at IS 'When accountant marked payment received';
COMMENT ON COLUMN prescriptions.invoice_id IS 'Invoice id after accountant generated invoice';
