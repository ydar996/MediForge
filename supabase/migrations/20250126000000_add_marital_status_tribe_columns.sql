-- ============================================
-- Add Marital Status and Tribe Columns to Patients Table
-- ============================================
-- Purpose: Add missing demographic columns that are collected during registration
-- but were not in the original schema
-- ============================================

-- Add marital_status column
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS marital_status TEXT;

-- Add tribe column  
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS tribe TEXT;

-- Add comment to document these fields
COMMENT ON COLUMN patients.marital_status IS 'Marital status: Single, Married, Divorced, Separated, Widowed';
COMMENT ON COLUMN patients.tribe IS 'Tribe/Ethnic group of the patient';

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'patients' 
AND column_name IN ('marital_status', 'tribe')
ORDER BY column_name;

