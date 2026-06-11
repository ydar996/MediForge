-- ============================================
-- Add Prescriptions Column to Patients Table
-- ============================================
-- Purpose: Add prescriptions column to enable Supabase persistence for prescriptions
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Add prescriptions column (JSONB to store array of prescription entries)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS prescriptions JSONB DEFAULT '[]'::jsonb;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patients' 
AND column_name IN ('prescriptions', 'medications', 'allergies', 'chronic_conditions', 'diagnoses', 'immunizations', 'medical_history', 'vitals')
ORDER BY column_name;

-- ============================================
-- SUCCESS!
-- The prescriptions column has been added to the patients table.
-- Prescriptions will now persist in Supabase like all other clinical data.
-- ============================================
















