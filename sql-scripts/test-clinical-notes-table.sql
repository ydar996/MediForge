-- Test script to verify clinical_notes table works
-- Run this in Supabase SQL Editor after creating the table

-- Test insert
INSERT INTO clinical_notes (
    patient_id, 
    organization_id, 
    note_date, 
    soap_data, 
    medical_history, 
    allergies, 
    immunizations, 
    diagnoses, 
    vitals
) VALUES (
    'TEST001',
    '576522cc-e769-4fb4-9487-3d150857d970',
    '2025-10-27',
    '{"cc": "Test complaint", "hpi": "Test history"}',
    '[{"date": "2025-10-27", "event": "Test event", "notes": "Test notes"}]',
    '[{"allergen": "Test allergen", "reaction": "Test reaction"}]',
    '[]',
    '[]',
    '[]'
);

-- Test select
SELECT * FROM clinical_notes WHERE patient_id = 'TEST001';

-- Clean up test data
DELETE FROM clinical_notes WHERE patient_id = 'TEST001';


