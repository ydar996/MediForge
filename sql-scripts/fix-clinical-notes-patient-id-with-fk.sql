-- Fix clinical_notes table schema with proper foreign key handling
-- Run this in Supabase SQL Editor

-- Step 1: Drop the foreign key constraint
ALTER TABLE clinical_notes 
DROP CONSTRAINT IF EXISTS clinical_notes_patient_id_fkey;

-- Step 2: Change patient_id from UUID to TEXT
ALTER TABLE clinical_notes 
ALTER COLUMN patient_id TYPE TEXT;

-- Step 3: Verify the change
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'clinical_notes' 
  AND column_name = 'patient_id';

-- Note: We're not recreating the foreign key constraint because:
-- 1. Patient IDs are TEXT strings (MEC0006, etc.) not UUIDs
-- 2. There's no UUID table that these TEXT patient IDs reference
-- 3. The constraint was incorrectly set up originally


