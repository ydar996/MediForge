-- ============================================
-- Add admission_id column to admissions table
-- ============================================
-- Purpose: Add short admission ID column (ADM-001, ADM-002, etc.) for display
-- Run this in Supabase SQL Editor

ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS admission_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admissions_admission_id ON admissions(admission_id);

-- Add comment
COMMENT ON COLUMN admissions.admission_id IS 'Short admission ID for display (e.g., ADM-001, ADM-002)';

-- ============================================
-- VERIFICATION
-- ============================================
-- Verify the column was added:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'admissions' AND column_name = 'admission_id';

