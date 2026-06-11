-- ============================================
-- DIRECT DATA MIGRATION (NO RLS)
-- ============================================
-- Purpose: Migrate data directly via SQL, bypassing RLS
-- Run this in: Supabase Dashboard → SQL Editor
-- This script will prompt you to paste your localStorage data
-- ============================================

-- First, let's prepare the tables by temporarily disabling RLS
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

-- Add unique constraint for appointments if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointments_org_appt_id_unique'
  ) THEN
    ALTER TABLE appointments 
    ADD CONSTRAINT appointments_org_appt_id_unique 
    UNIQUE (organization_id, appointment_id);
  END IF;
END $$;

-- ============================================
-- NOW PASTE YOUR DATA BELOW
-- ============================================

-- Get your organization ID first
SELECT id, name FROM organizations;

-- Copy the ID for "Mecure Clinics" and use it below
-- Replace 'YOUR_ORG_ID_HERE' with the actual UUID

-- Example patient insert:
-- INSERT INTO patients (organization_id, patient_id, first_name, last_name, date_of_birth, gender, phone, created_at, updated_at)
-- VALUES 
-- ('YOUR_ORG_ID_HERE', 'MEC0001', 'John', 'Doe', '1990-01-01', 'Male', '08012345678', NOW(), NOW());

-- ============================================
-- AFTER MIGRATION, RE-ENABLE RLS
-- ============================================
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;




