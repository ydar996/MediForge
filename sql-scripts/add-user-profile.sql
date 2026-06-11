-- ============================================
-- Add User Profile to Supabase
-- ============================================
-- Purpose: Links a Supabase Auth user to a profile in public.users table
-- 
-- BEFORE RUNNING THIS:
-- 1. Create the auth user in Supabase Dashboard → Authentication → Users
-- 2. Copy the auth user's UUID
-- 3. Get your organization ID from organizations table
-- 
-- THEN:
-- 4. Replace the placeholder values below
-- 5. Run this query in SQL Editor
-- ============================================

-- STEP 1: Check if organization exists (Optional - for verification)
SELECT id, name, org_code 
FROM organizations 
WHERE name = 'Mecure Clinics';
-- Copy the 'id' from the result - you'll need it below!

-- STEP 2: Create user profile
-- ⚠️ REPLACE THESE VALUES:

INSERT INTO users (
  auth_user_id,                              -- UUID from Supabase Auth user
  username,                                   -- User's username (e.g., 'admin')
  first_name,                                 -- User's first name
  last_name,                                  -- User's last name
  gender,                                     -- 'Male' or 'Female'
  role,                                       -- 'Doctor', 'Nurse', 'Admin', etc.
  organization_id,                            -- UUID from Step 1
  medical_license_number                      -- License number or NULL
) VALUES (
  '12345678-1234-1234-1234-123456789abc',    -- ← REPLACE: Auth user ID
  'admin',                                    -- ← REPLACE: Username
  'Admin',                                    -- ← REPLACE: First name
  'User',                                     -- ← REPLACE: Last name
  'Male',                                     -- ← REPLACE: Gender
  'Doctor',                                   -- ← REPLACE: Role
  '87654321-4321-4321-4321-cba987654321',    -- ← REPLACE: Organization ID
  ''                                          -- ← REPLACE: License or leave empty
)
RETURNING *;

-- STEP 3: Verify user was created
SELECT 
  u.id,
  u.username,
  u.first_name,
  u.last_name,
  u.role,
  u.gender,
  o.name as organization_name
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.username = 'admin';  -- ← REPLACE with your username

-- ============================================
-- SUCCESS!
-- Now you can login with:
--   Email: admin@temp.ehrapp.local
--   Password: (whatever you set in Supabase Auth)
-- ============================================

-- ============================================
-- MULTIPLE USERS EXAMPLE
-- ============================================
-- To add multiple users at once, use this format:

/*
INSERT INTO users (
  auth_user_id,
  username,
  first_name,
  last_name,
  gender,
  role,
  organization_id,
  medical_license_number
) VALUES 
  ('uuid-1', 'doctor1', 'John', 'Doe', 'Male', 'Doctor', 'org-uuid', 'MD12345'),
  ('uuid-2', 'nurse1', 'Jane', 'Smith', 'Female', 'Nurse', 'org-uuid', ''),
  ('uuid-3', 'admin1', 'Alice', 'Johnson', 'Female', 'Admin', 'org-uuid', '')
RETURNING *;
*/

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If you get error: "duplicate key value violates unique constraint"
-- The username already exists. Check existing users:
SELECT username, first_name, last_name FROM users;

-- If you get error: "violates foreign key constraint"
-- The organization_id or auth_user_id doesn't exist. Verify:
SELECT id FROM organizations;  -- Check org IDs
-- And check auth users in: Supabase Dashboard → Authentication → Users

-- If you get error: "new row violates row-level security policy"
-- This shouldn't happen in SQL Editor (bypasses RLS)
-- But if it does, check that RLS policies are correctly set up

-- ============================================



