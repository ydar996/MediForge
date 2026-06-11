-- Check what clinical data exists for patient MEC0005
-- This will show us where your previous entries are stored

-- Check patients table for MEC0005
SELECT 
    patient_id,
    allergies,
    chronic_conditions,
    medical_history,
    diagnoses,
    immunizations,
    updated_at
FROM patients 
WHERE patient_id = 'MEC0005';

-- Check clinical_notes table for MEC0005  
SELECT 
    patient_id,
    note_date,
    medical_history,
    diagnoses,
    immunizations,
    allergies,
    updated_at
FROM clinical_notes 
WHERE patient_id = 'MEC0005'
ORDER BY note_date DESC;

