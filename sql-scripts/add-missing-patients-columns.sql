-- Add missing clinical data columns to patients table
-- This will enable medical_history, diagnoses, and immunizations to persist like allergies

-- Add medical_history column (JSONB to store array of medical history entries)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '[]'::jsonb;

-- Add diagnoses column (JSONB to store array of diagnosis entries)  
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS diagnoses JSONB DEFAULT '[]'::jsonb;

-- Add immunizations column (JSONB to store array of immunization entries)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS immunizations JSONB DEFAULT '[]'::jsonb;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patients' 
AND column_name IN ('medical_history', 'diagnoses', 'immunizations', 'allergies', 'chronic_conditions')
ORDER BY column_name;


