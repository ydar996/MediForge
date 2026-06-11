-- Add Biller/Accountant and other edit-profile roles to users_role_check constraint
-- Fixes: "Role 'Biller/Accountant' is not allowed in the database" when updating user profile

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN (
  -- Core roles
  'Doctor', 'Nurse', 'Admin', 'Staff', 'Reception',
  'PlatformOwner', 'PlatformAdmin', 'Patient', 'user',
  -- Pharmacy
  'Pharmacist', 'pharmacist',
  -- Lab
  'Medical Lab Scientist', 'Lab Scientist', 'Medical Laboratory Scientist',
  'Laboratory Scientist', 'Lab Tech', 'Laboratory Technician',
  -- Other medical
  'Physician Assistant', 'Optometrist',
  -- Billing/Admin (EDIT-PROFILE FIX)
  'Biller/Accountant', 'Accountant',
  'Office Manager', 'Medical Receptionist', 'Referrals Coordinator',
  'Medical Assistant', 'Other',
  -- Case variations
  'doctor', 'nurse', 'admin', 'staff', 'reception'
));
