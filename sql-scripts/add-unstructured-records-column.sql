-- ============================================
-- Add Unstructured Records Column to Patients Table
-- ============================================
-- Purpose: Add unstructured_records column to enable Supabase persistence for pre-EMR medical records
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Add unstructured_records column (JSONB to store array of unstructured medical record entries)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS unstructured_records JSONB DEFAULT '[]'::jsonb;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patients' 
AND column_name IN ('unstructured_records', 'unstructuredRecords')
ORDER BY column_name;

-- ============================================
-- SUCCESS!
-- The unstructured_records column has been added to the patients table.
-- Unstructured medical records will now persist in Supabase.
-- ============================================
    e       ED