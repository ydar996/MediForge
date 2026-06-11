-- ============================================
-- Add checked_out_at column to appointments table
-- ============================================
-- Purpose: Support check-out functionality for appointments
-- ============================================

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_appointments_checked_out_at ON appointments(checked_out_at);

