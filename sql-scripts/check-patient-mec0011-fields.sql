-- ============================================
-- Check Patient MEC0011 Field Values
-- ============================================
-- Purpose: Verify what values are stored for marital_status and tribe
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Find patient by patient_id (display ID)
SELECT 
  id,
  patient_id,
  first_name,
  last_name,
  marital_status,
  tribe,
  email,
  phone,
  emergency_contact_phone,
  emergency_contact_email,
  emergency_contact_relationship,
  created_at,
  updated_at
FROM patients
WHERE patient_id = 'MEC0011'
ORDER BY created_at DESC;

-- Also check by name in case patient_id is different
SELECT 
  id,
  patient_id,
  first_name,
  last_name,
  marital_status,
  tribe,
  email,
  phone,
  created_at
FROM patients
WHERE LOWER(first_name) LIKE '%yebi%' 
  AND LOWER(last_name) LIKE '%olowoyeye%'
ORDER BY created_at DESC;

-- Check all columns for this patient to see what fields exist
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

