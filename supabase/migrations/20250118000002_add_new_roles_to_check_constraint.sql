-- Add new roles (Pharmacist, Optometrist, Medical Lab Scientist) to users_role_check constraint
-- This migration fixes the CHECK constraint to allow the new healthcare roles

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
  END IF;
END $$;

-- Create a new CHECK constraint that includes all roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
  'Doctor', 
  'Nurse', 
  'Admin', 
  'Staff', 
  'Reception', 
  'PlatformOwner', 
  'PlatformAdmin', 
  'Patient', 
  'user',
  'Pharmacist',
  'Optometrist',
  'Medical Lab Scientist'
));

-- Verify the constraint was created
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND conname = 'users_role_check';






