-- Verify Medical Specialty Migration
-- Run this to confirm the columns were added successfully

-- Check if medical_specialty column exists
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND column_name IN ('medical_specialty', 'first_login_specialty_set')
ORDER BY column_name;

-- Check current specialty values for all organizations
SELECT 
    id,
    name,
    medical_specialty,
    first_login_specialty_set
FROM organizations
ORDER BY name;

