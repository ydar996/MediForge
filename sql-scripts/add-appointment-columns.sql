-- ============================================
-- Add Missing Appointment Columns
-- ============================================
-- Purpose: Add appointment_id column for migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Add appointment_id column if it doesn't exist
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_id VARCHAR(100);

-- Add other useful appointment fields
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS appointment_time VARCHAR(10),
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'appointments'
ORDER BY ordinal_position;

-- ============================================
-- SUCCESS!
-- Now re-run the migration tool
-- ============================================



