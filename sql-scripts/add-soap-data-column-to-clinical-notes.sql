-- ============================================
-- ADD soap_data COLUMN TO clinical_notes TABLE
-- ============================================
-- This migration adds the missing soap_data JSONB column to the clinical_notes table
-- Run this in Supabase SQL Editor to fix the root cause of 400 Bad Request errors

-- Add the soap_data column if it doesn't exist
ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS soap_data JSONB;

-- Add a comment to document the column
COMMENT ON COLUMN clinical_notes.soap_data IS 'SOAP note data (Subjective, Objective, Assessment, Plan) stored as JSONB';

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clinical_notes' 
    AND column_name = 'soap_data';

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this migration, verify by running:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'clinical_notes' ORDER BY ordinal_position;
-- 
-- You should see 'soap_data' with data_type 'jsonb'

