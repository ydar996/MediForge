-- Fix clinical_notes table schema to match actual patient ID format
-- Run this in Supabase SQL Editor

-- Change patient_id from UUID to TEXT to match actual patient IDs (MEC0006, etc.)
ALTER TABLE clinical_notes 
ALTER COLUMN patient_id TYPE TEXT;

-- Verify the change
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clinical_notes' 
  AND column_name = 'patient_id';


