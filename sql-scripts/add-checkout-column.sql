-- ============================================
-- Add checked_out_at column to appointments table
-- ============================================
-- Purpose: Support check-out functionality for appointments
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_appointments_checked_out_at ON appointments(checked_out_at);

-- Verify column was added
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'appointments' 
  AND column_name IN ('checked_in_at', 'checked_out_at', 'checked_in')
ORDER BY column_name;

