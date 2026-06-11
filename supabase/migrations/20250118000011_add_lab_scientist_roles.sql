-- ============================================
-- ADD LAB SCIENTIST ROLES TO ALLOWED ROLES
-- ============================================
-- Purpose: Add Medical Lab Scientist and related roles to the users table CHECK constraint
-- Issue: Users cannot register or update profile with lab scientist roles
-- ============================================

-- First, drop the existing CHECK constraint if it exists
DO $$
BEGIN
  -- Drop the constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'users_role_check' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
    RAISE NOTICE 'Dropped existing users_role_check constraint';
  END IF;
END $$;

-- Create a new CHECK constraint that includes all roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
  -- Core roles
  'Doctor', 
  'Nurse', 
  'Admin', 
  'Staff', 
  'Reception', 
  'PlatformOwner', 
  'PlatformAdmin', 
  'Patient', 
  'user',
  -- Pharmacy roles
  'Pharmacist',
  'pharmacist',
  -- Lab Scientist roles
  'Medical Lab Scientist',
  'Lab Scientist',
  'Medical Laboratory Scientist',
  'Laboratory Scientist',
  'Lab Tech',
  'Laboratory Technician',
  -- Other medical roles
  'Physician Assistant',
  'Optometrist',
  -- Additional variations (case-insensitive support)
  'doctor',
  'nurse',
  'admin',
  'staff',
  'reception'
));

-- Verify the constraint was created
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND conname = 'users_role_check';

-- ============================================
-- ✅ LAB SCIENTIST ROLES ADDED!
-- ============================================
-- Users can now register and update profiles with:
-- - Medical Lab Scientist
-- - Lab Scientist
-- - Medical Laboratory Scientist
-- - Laboratory Scientist
-- - Lab Tech
-- - Laboratory Technician
-- ============================================

