-- ============================================
-- CREATE CLINICAL NOTES TABLE
-- ============================================

-- Clinical Notes table for storing comprehensive clinical note data
CREATE TABLE IF NOT EXISTS clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    note_date DATE NOT NULL,
    soap_data JSONB,                    -- SOAP note data (Subjective, Objective, Assessment, Plan)
    medical_history JSONB,              -- Past medical history entries
    allergies JSONB,                    -- Allergy information
    immunizations JSONB,                -- Immunization records
    diagnoses JSONB,                    -- Diagnosis information
    vitals JSONB,                       -- Vital signs data
    prescriptions JSONB,                -- Prescription data
    lab_results JSONB,                  -- Lab test results
    imaging_results JSONB,              -- Imaging test results
    referrals JSONB,                    -- Referral information
    notes TEXT,                          -- Additional notes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_organization ON clinical_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_date ON clinical_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient_date ON clinical_notes(patient_id, note_date);

-- Row Level Security (RLS) policies
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access clinical notes for their organization
CREATE POLICY "Users can access clinical notes for their organization" ON clinical_notes
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations 
            WHERE id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );

-- Grant permissions
GRANT ALL ON clinical_notes TO authenticated;
GRANT ALL ON clinical_notes TO service_role;

-- ============================================
-- VERIFY TABLE CREATION
-- ============================================

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'clinical_notes' 
ORDER BY ordinal_position;


