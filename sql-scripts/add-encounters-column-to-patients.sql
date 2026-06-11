-- ============================================
-- ADD encounters COLUMN TO patients TABLE
-- ============================================
-- This migration adds the encounters JSONB column to the patients table
-- Run this in Supabase SQL Editor to fix the root cause of 400 Bad Request errors

-- Add the encounters column if it doesn't exist
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS encounters JSONB;

-- Add the non_visit_encounters column if it doesn't exist (for backward compatibility)
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS non_visit_encounters JSONB;

-- Add a comment to document the column
COMMENT ON COLUMN patients.encounters IS 'Non-visit patient encounters stored as JSONB array';
COMMENT ON COLUMN patients.non_visit_encounters IS 'Non-visit patient encounters stored as JSONB array (legacy column name)';

-- Verify the columns were added
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'patients'
    AND column_name IN ('encounters', 'non_visit_encounters');

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this script, execute the following query to confirm the columns:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'patients' AND column_name IN ('encounters', 'non_visit_encounters');

