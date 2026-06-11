-- ============================================
-- Backfill Marital Status and Tribe from localStorage
-- ============================================
-- Purpose: This is a reference script - actual backfill should be done via JavaScript
--          to read from localStorage and update Supabase
-- ============================================
-- 
-- NOTE: This SQL script cannot access localStorage directly.
-- You need to run a JavaScript function to:
-- 1. Read patients from localStorage
-- 2. For each patient that has maritalStatus/tribe but Supabase doesn't:
--    UPDATE patients SET marital_status = '...', tribe = '...' WHERE patient_id = '...'
--
-- Example update (run after migration):
-- UPDATE patients 
-- SET marital_status = 'Married', tribe = 'Yoruba'
-- WHERE patient_id = 'MEC0011';
--
-- ============================================

-- Check which patients have NULL marital_status or tribe
SELECT 
  patient_id,
  first_name || ' ' || last_name as name,
  marital_status,
  tribe,
  created_at
FROM patients
WHERE marital_status IS NULL OR tribe IS NULL OR marital_status = '' OR tribe = ''
ORDER BY created_at DESC
LIMIT 50;

