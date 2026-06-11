-- Cleanup Duplicate Data Script
-- This script removes duplicate entries from the patients table

-- First, let's see what we're dealing with
SELECT 
    patient_id,
    first_name,
    last_name,
    jsonb_array_length(allergies::jsonb) as allergy_count,
    jsonb_array_length(diagnoses::jsonb) as diagnosis_count,
    jsonb_array_length(immunizations::jsonb) as immunization_count,
    jsonb_array_length(medical_history::jsonb) as history_count
FROM patients 
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
ORDER BY patient_id;

-- Function to deduplicate JSONB arrays
CREATE OR REPLACE FUNCTION deduplicate_jsonb_array(input_array jsonb)
RETURNS jsonb AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    item jsonb;
    seen_items jsonb := '[]'::jsonb;
BEGIN
    -- Loop through each item in the input array
    FOR item IN SELECT * FROM jsonb_array_elements(input_array)
    LOOP
        -- Check if we've seen this item before
        IF NOT (item <@ seen_items) THEN
            -- Add to result and mark as seen
            result := result || item;
            seen_items := seen_items || item;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Clean up duplicates for MEC0006 (the patient with issues)
UPDATE patients 
SET 
    allergies = deduplicate_jsonb_array(allergies::jsonb)::text,
    diagnoses = deduplicate_jsonb_array(diagnoses::jsonb)::text,
    immunizations = deduplicate_jsonb_array(immunizations::jsonb)::text,
    medical_history = deduplicate_jsonb_array(medical_history::jsonb)::text
WHERE patient_id = 'MEC0006' 
AND organization_id = '576522cc-e769-4fb4-9487-3d150857d970';

-- Clean up duplicates for all patients
UPDATE patients 
SET 
    allergies = deduplicate_jsonb_array(allergies::jsonb)::text,
    diagnoses = deduplicate_jsonb_array(diagnoses::jsonb)::text,
    immunizations = deduplicate_jsonb_array(immunizations::jsonb)::text,
    medical_history = deduplicate_jsonb_array(medical_history::jsonb)::text
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970';

-- Verify the cleanup worked
SELECT 
    patient_id,
    first_name,
    last_name,
    jsonb_array_length(allergies::jsonb) as allergy_count,
    jsonb_array_length(diagnoses::jsonb) as diagnosis_count,
    jsonb_array_length(immunizations::jsonb) as immunization_count,
    jsonb_array_length(medical_history::jsonb) as history_count
FROM patients 
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
ORDER BY patient_id;

-- Clean up the function
DROP FUNCTION IF EXISTS deduplicate_jsonb_array(jsonb);
