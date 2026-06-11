-- Direct SQL fix for patient DOB data
-- This will update the 7 patients with their correct dates of birth

-- Update patients with their correct DOB from backup data
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
    date_of_birth = '1988-01-01',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0006'
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1987-01-01',
    updated_at = NOW()
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970' 
    AND patient_id = 'MEC0007'
    AND date_of_birth IS NULL;

-- Verify the updates
SELECT 
    patient_id,
    first_name,
    last_name,
    date_of_birth,
    updated_at
FROM patients 
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
    AND patient_id IN ('MEC0001', 'MEC0002', 'MEC0003', 'MEC0004', 'MEC0005', 'MEC0006', 'MEC0007')
ORDER BY patient_id;
