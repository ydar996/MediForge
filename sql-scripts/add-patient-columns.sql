-- ============================================
-- Add Missing Patient Columns
-- ============================================
-- Purpose: Add all the detailed patient fields needed for migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Add address fields
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Nigeria',
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS chronic_conditions TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT;

-- Add emergency contact fields
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100);

-- Add insurance fields
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50) DEFAULT 'Self Pay',
ADD COLUMN IF NOT EXISTS insurance_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS insurance_member_number VARCHAR(100);

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- ============================================
-- SUCCESS!
-- Now go back to migrate-data-day3.html and try Step 2 again
-- ============================================



