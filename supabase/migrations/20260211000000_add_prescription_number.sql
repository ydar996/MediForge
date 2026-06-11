-- Add prescription_number column for organization-specific chronological numbering (e.g., MEC-RX-0001)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_number_org ON prescriptions(prescription_number) WHERE prescription_number IS NOT NULL;
COMMENT ON COLUMN prescriptions.prescription_number IS 'Organization-specific display number e.g. MEC-RX-0001, flows chronologically per org';
