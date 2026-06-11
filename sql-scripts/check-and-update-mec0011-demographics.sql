-- ============================================
-- Check and Update Patient MEC0011 Demographics
-- ============================================
-- Purpose: Check what's stored in Supabase and provide update statement
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Step 1: Check current values
SELECT 
  id,
  patient_id,
  first_name || ' ' || last_name as name,
  marital_status,
  tribe,
  email,
  phone,
  created_at,
  updated_at
FROM patients
WHERE patient_id = 'MEC0011';

-- Step 2: Update with provided values (uncomment to run)
-- UPDATE patients
-- SET 
--   marital_status = 'Married',  -- Update with actual value from registration
--   tribe = 'Yoruba',  -- Update with actual value from registration
--   updated_at = NOW()
-- WHERE patient_id = 'MEC0011'
--   AND organization_id = '576522cc-e769-4fb4-9487-3d150857d970';  -- Mecure Clinics org ID

-- Step 3: Verify update
-- SELECT 
--   patient_id,
--   first_name || ' ' || last_name as name,
--   marital_status,
--   tribe
-- FROM patients
-- WHERE patient_id = 'MEC0011';

