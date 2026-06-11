-- ============================================
-- Add Medical Specialty Column to Organizations
-- ============================================
-- Purpose: Add medical_specialty column to organizations table
-- Default: 'Primary Care'
-- Safety: Uses IF NOT EXISTS, no data loss, backward compatible
-- ============================================

-- Add medical_specialty column with default
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS medical_specialty TEXT DEFAULT 'Primary Care';

-- Add flag to track if specialty was explicitly set (for first-login detection)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS first_login_specialty_set BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_organizations_medical_specialty 
ON organizations(medical_specialty);

-- Update existing organizations to 'Primary Care' if null
UPDATE organizations 
SET medical_specialty = 'Primary Care' 
WHERE medical_specialty IS NULL;

-- Verify the column was added
-- (This is just for verification, won't cause errors if run multiple times)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' 
    AND column_name = 'medical_specialty'
  ) THEN
    RAISE NOTICE 'Column medical_specialty successfully added to organizations table';
  END IF;
END $$;

