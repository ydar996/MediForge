-- DIRECT SQL FIX FOR DOB DATA
-- This will fix the DOB data directly in the Supabase database
-- No app code, no caching, no deployment issues

-- First, let's see what we have
SELECT patient_id, first_name, last_name, date_of_birth 
FROM patients 
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
ORDER BY patient_id;

-- Now fix the DOB data for the 7 patients from the backup
UPDATE patients 
SET 
    date_of_birth = '1964-01-02',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0001'
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1970-01-03',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0002'
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1975-05-22',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0003'
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1969-05-01',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0004'
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1980-01-01',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0005'
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1987-01-01',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0006'
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1990-01-01',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0007'
    AND date_of_birth IS NULL;

-- Verify the fix
SELECT patient_id, first_name, last_name, date_of_birth 
FROM patients 
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
    AND date_of_birth IS NOT NULL
ORDER BY patient_id;
