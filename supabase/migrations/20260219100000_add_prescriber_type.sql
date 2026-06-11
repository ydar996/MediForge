-- Add prescriber_type for audit trail (doctor vs pharmacist prescriptions)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescriber_type TEXT DEFAULT 'doctor';
COMMENT ON COLUMN prescriptions.prescriber_type IS 'doctor | pharmacist - who prescribed; pharmacist can prescribe OTC/non-addictive only';
