-- PrescribeIT / eRx tracking columns on prescriptions (Phase 5 software)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_number TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS erx_status TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS erx_pharmacy_id TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS erx_pharmacy_name TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS erx_transmitted_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS erx_dispense_status TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS erx_meta JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_prescriptions_erx_status ON prescriptions(erx_status);

COMMENT ON COLUMN prescriptions.erx_status IS 'Provincial eRx queue: queued, transmitted, cancelled, renewal_requested, dispensed';
