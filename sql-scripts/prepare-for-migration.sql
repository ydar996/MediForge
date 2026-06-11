-- ============================================
-- PREPARE SUPABASE FOR DATA MIGRATION
-- ============================================
-- Purpose: Add all missing columns needed for localStorage → Supabase migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- ==================== PATIENTS TABLE ====================
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Nigeria',
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
ADD COLUMN IF NOT EXISTS genotype VARCHAR(10),
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS chronic_conditions TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50) DEFAULT 'Self Pay',
ADD COLUMN IF NOT EXISTS insurance_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS insurance_member_number VARCHAR(100);

-- ==================== APPOINTMENTS TABLE ====================
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS appointment_time VARCHAR(10),
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ==================== VERIFY CHANGES ====================
-- Check patients table
SELECT 'PATIENTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- Check appointments table
SELECT 'APPOINTMENTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments'
ORDER BY ordinal_position;

-- ============================================
-- ✅ READY FOR MIGRATION!
-- Go to: https://mediforge.netlify.app/migrate-to-supabase.html
-- ============================================



