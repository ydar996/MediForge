-- ============================================
-- Add Soft Delete Support to Admissions Table
-- ============================================
-- This script adds columns to support soft deletion of admissions
-- Run this in Supabase SQL Editor

-- Add deleted_at and deleted_by columns if they don't exist
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Add index for filtering non-deleted records
CREATE INDEX IF NOT EXISTS idx_admissions_deleted_at ON admissions(deleted_at);

-- Update status enum to include 'deleted'
-- Note: Since status is TEXT, no ALTER TYPE needed, but update any existing constraints if needed

-- Add comment
COMMENT ON COLUMN admissions.deleted_at IS 'Timestamp when admission was soft deleted (null = not deleted)';
COMMENT ON COLUMN admissions.deleted_by IS 'User ID who deleted the admission';

-- ============================================
-- SUCCESS!
-- ============================================
-- After running this, admissions can be soft-deleted by setting:
-- deleted_at = NOW(), deleted_by = current_user_id
-- 
-- To restore: deleted_at = NULL, deleted_by = NULL
-- 
-- Always filter: WHERE deleted_at IS NULL
    -- ============================================
    -- SUCCESS!
    -- ============================================
    -- After running this, admissions can be soft-deleted by setting:
    -- deleted_at = NOW(), deleted_by = current_user_id
    -- 
    -- To restore: deleted_at = NULL, deleted_by = NULL
    -- 
    -- Always filter: WHERE deleted_at IS NULL
    -- ============================================     