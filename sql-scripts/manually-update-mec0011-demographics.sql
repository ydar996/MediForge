-- ============================================
-- Manually Update Patient MEC0011 Demographics
-- ============================================
-- Purpose: Update marital status and tribe for patient MEC0011
--          Since data was lost during registration (columns didn't exist),
--          we need to manually update with the values that were provided
-- ============================================
-- 
-- NOTE: The user provided these values during registration:
-- - Marital Status: (needs to be provided - check registration form or ask user)
-- - Tribe: (needs to be provided - check registration form or ask user)
--
-- Common values:
-- Marital Status: Single, Married, Divorced, Separated, Widowed
-- Tribe: Yoruba, Igbo, Hausa, etc.
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
  created_at
FROM patients
WHERE patient_id = 'MEC0011'
  AND organization_id = '576522cc-e769-4fb4-9487-3d150857d970';

-- Step 2: Update with values (UPDATE THE VALUES BELOW BEFORE RUNNING)
-- Replace 'Married' and 'Yoruba' with the actual values provided during registration
UPDATE patients
SET 
  marital_status = 'Married',  -- ⚠️ UPDATE THIS with actual value
  tribe = 'Yoruba',  -- ⚠️ UPDATE THIS with actual value  
  updated_at = NOW()
WHERE patient_id = 'MEC0011'
  AND organization_id = '576522cc-e769-4fb4-9487-3d150857d970';

-- Step 3: Verify update
SELECT 
  patient_id,
  first_name || ' ' || last_name as name,
  marital_status,
  tribe,
  updated_at
FROM patients
WHERE patient_id = 'MEC0011';

