-- Fix Patient Date of Birth Migration
-- This script addresses the missing date of birth issue in the Mecure Clinics migration
-- 
-- ISSUE: Patients were migrated but their date_of_birth field is NULL
-- SOLUTION: Update the date_of_birth field using the backup data

-- Step 1: Check current status of patient DOB data
-- This query shows patients with missing date_of_birth
SELECT 
    patient_id,
    first_name,
    last_name,
    date_of_birth,
    created_at
FROM patients 
WHERE organization_id = 'YOUR_ORG_ID_HERE'  -- Replace with your actual organization ID
    AND date_of_birth IS NULL
ORDER BY created_at;

-- Step 2: Count patients with missing DOB
SELECT 
    COUNT(*) as patients_without_dob,
    COUNT(CASE WHEN date_of_birth IS NOT NULL THEN 1 END) as patients_with_dob
FROM patients 
WHERE organization_id = 'YOUR_ORG_ID_HERE';

-- Step 3: Update patients with missing DOB
-- ACTUAL DATA FROM BACKUP FILE (mediforge-backup-2025-10-14.json)
-- These are the actual DOB values found in your backup file

-- First, let's see what patients we have and their current DOB status
SELECT 
    patient_id,
    first_name,
    last_name,
    date_of_birth,
    created_at
FROM patients 
WHERE organization_id = 'YOUR_ORG_ID_HERE'  -- Replace with actual org ID
ORDER BY patient_id;

-- Update patients with missing DOB using actual backup data
-- Note: You'll need to match the patient_id values from your backup with the ones in Supabase

-- Example updates (replace patient_id values with actual ones from your database):
UPDATE patients 
SET 
    date_of_birth = '1964-01-02',
    updated_at = NOW()
WHERE organization_id = 'YOUR_ORG_ID_HERE' 
    AND patient_id = 'ACTUAL_PATIENT_ID_1'  -- Replace with actual patient ID from backup
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1970-01-03',
    updated_at = NOW()
WHERE organization_id = 'YOUR_ORG_ID_HERE' 
    AND patient_id = 'ACTUAL_PATIENT_ID_2'  -- Replace with actual patient ID from backup
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1975-05-22',
    updated_at = NOW()
WHERE organization_id = 'YOUR_ORG_ID_HERE' 
    AND patient_id = 'ACTUAL_PATIENT_ID_3'  -- Replace with actual patient ID from backup
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1969-05-01',
    updated_at = NOW()
WHERE organization_id = 'YOUR_ORG_ID_HERE' 
    AND patient_id = 'ACTUAL_PATIENT_ID_4'  -- Replace with actual patient ID from backup
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1980-01-01',
    updated_at = NOW()
WHERE organization_id = 'YOUR_ORG_ID_HERE' 
    AND patient_id = 'ACTUAL_PATIENT_ID_5'  -- Replace with actual patient ID from backup
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1988-01-01',
    updated_at = NOW()
WHERE organization_id = 'YOUR_ORG_ID_HERE' 
    AND patient_id = 'ACTUAL_PATIENT_ID_6'  -- Replace with actual patient ID from backup
    AND date_of_birth IS NULL;

UPDATE patients 
SET 
    date_of_birth = '1987-01-01',
    updated_at = NOW()
WHERE organization_id = 'YOUR_ORG_ID_HERE' 
    AND patient_id = 'ACTUAL_PATIENT_ID_7'  -- Replace with actual patient ID from backup
    AND date_of_birth IS NULL;

-- Step 4: Verify the updates
-- Check that all patients now have date_of_birth
SELECT 
    patient_id,
    first_name,
    last_name,
    date_of_birth,
    updated_at
FROM patients 
WHERE organization_id = 'YOUR_ORG_ID_HERE'
ORDER BY patient_id;

-- Step 5: Final verification count
SELECT 
    COUNT(*) as total_patients,
    COUNT(CASE WHEN date_of_birth IS NOT NULL THEN 1 END) as patients_with_dob,
    COUNT(CASE WHEN date_of_birth IS NULL THEN 1 END) as patients_without_dob
FROM patients 
WHERE organization_id = 'YOUR_ORG_ID_HERE';

-- Alternative approach: Bulk update using a temporary table
-- This is more efficient if you have many patients to update

-- Step 1: Create a temporary table with the correct DOB data
CREATE TEMP TABLE patient_dob_fixes (
    patient_id TEXT,
    date_of_birth DATE
);

-- Step 2: Insert the correct DOB data (replace with actual data from backup)
INSERT INTO patient_dob_fixes (patient_id, date_of_birth) VALUES
('MEC0001', '1964-01-02'),
('MEC0002', '1970-01-03'),
('MEC0003', '1975-05-22'),
('MEC0004', '1969-05-01'),
('MEC0005', '1980-01-01'),
('MEC0006', '1988-01-01'),
('MEC0007', '1987-01-01');
-- Add more rows as needed

-- Step 3: Update patients table using the temporary table
UPDATE patients 
SET 
    date_of_birth = pdf.date_of_birth,
    updated_at = NOW()
FROM patient_dob_fixes pdf
WHERE patients.patient_id = pdf.patient_id
    AND patients.organization_id = 'YOUR_ORG_ID_HERE'
    AND patients.date_of_birth IS NULL;

-- Step 4: Clean up temporary table
DROP TABLE patient_dob_fixes;

-- Step 5: Verify the bulk update
SELECT 
    COUNT(*) as total_patients,
    COUNT(CASE WHEN date_of_birth IS NOT NULL THEN 1 END) as patients_with_dob,
    COUNT(CASE WHEN date_of_birth IS NULL THEN 1 END) as patients_without_dob
FROM patients 
WHERE organization_id = 'YOUR_ORG_ID_HERE';

-- Additional verification: Check for any data inconsistencies
SELECT 
    p.patient_id,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.created_at,
    p.updated_at
FROM patients p
WHERE p.organization_id = 'YOUR_ORG_ID_HERE'
    AND p.date_of_birth IS NOT NULL
ORDER BY p.patient_id;

-- Check for patients that might have been missed
SELECT 
    p.patient_id,
    p.first_name,
    p.last_name,
    p.date_of_birth
FROM patients p
WHERE p.organization_id = 'YOUR_ORG_ID_HERE'
    AND p.date_of_birth IS NULL
ORDER BY p.created_at;

-- Final summary query
SELECT 
    'Migration Status' as status,
    COUNT(*) as total_patients,
    COUNT(CASE WHEN date_of_birth IS NOT NULL THEN 1 END) as with_dob,
    COUNT(CASE WHEN date_of_birth IS NULL THEN 1 END) as without_dob,
    ROUND(
        (COUNT(CASE WHEN date_of_birth IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as completion_percentage
FROM patients 
WHERE organization_id = 'YOUR_ORG_ID_HERE';
