-- Add missing columns to clinical_notes table
ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS soap_data JSONB,              -- SOAP note data (Subjective, Objective, Assessment, Plan)
ADD COLUMN IF NOT EXISTS medical_history JSONB,        -- Past medical history entries
ADD COLUMN IF NOT EXISTS diagnoses JSONB,              -- Diagnosis information
ADD COLUMN IF NOT EXISTS immunizations JSONB,           -- Immunization records
ADD COLUMN IF NOT EXISTS allergies JSONB;              -- Allergy information

-- Add comments to document the columns
COMMENT ON COLUMN clinical_notes.soap_data IS 'SOAP note data (Subjective, Objective, Assessment, Plan) stored as JSONB';
COMMENT ON COLUMN clinical_notes.medical_history IS 'Past medical history entries stored as JSONB array';
COMMENT ON COLUMN clinical_notes.diagnoses IS 'Diagnosis information stored as JSONB array';
COMMENT ON COLUMN clinical_notes.immunizations IS 'Immunization records stored as JSONB array';
COMMENT ON COLUMN clinical_notes.allergies IS 'Allergy information stored as JSONB array';


