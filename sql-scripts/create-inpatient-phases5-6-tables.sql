-- ============================================
-- CREATE INPATIENT MANAGEMENT TABLES - PHASES 5 & 6
-- ============================================
-- This migration creates tables for:
-- 1. procedure_records - Procedures, surgeries, pre-op/post-op workflows
-- 2. discharge_planning - Discharge planning progress and checklists
-- 3. discharge_summaries - Final discharge documentation
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. PROCEDURE RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS procedure_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    procedure_type TEXT NOT NULL, -- 'surgery', 'procedure', 'diagnostic', 'therapeutic'
    procedure_name TEXT NOT NULL,
    scheduled_date TIMESTAMPTZ,
    actual_date TIMESTAMPTZ,
    pre_op_checklist JSONB DEFAULT '[]', -- Array of checklist items
    consents JSONB DEFAULT '[]', -- Array of consent forms
    pre_op_orders JSONB DEFAULT '{}', -- Pre-operative orders
    intra_op_notes TEXT,
    post_op_orders JSONB DEFAULT '{}', -- Post-operative orders
    recovery_status TEXT DEFAULT 'pending', -- 'pending', 'in-recovery', 'stable', 'critical', 'discharged'
    surgeon TEXT,
    surgeon_id UUID REFERENCES users(id),
    anesthesiologist TEXT,
    anesthesiologist_id UUID REFERENCES users(id),
    procedure_duration_minutes INTEGER,
    complications TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_procedure_records_admission_id ON procedure_records(admission_id);
CREATE INDEX IF NOT EXISTS idx_procedure_records_organization_id ON procedure_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_procedure_records_scheduled_date ON procedure_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_procedure_records_procedure_type ON procedure_records(procedure_type);
CREATE INDEX IF NOT EXISTS idx_procedure_records_recovery_status ON procedure_records(recovery_status);

-- ============================================
-- 2. DISCHARGE PLANNING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS discharge_planning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    planning_started_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_discharge_date DATE,
    actual_discharge_date DATE,
    readiness_checklist JSONB DEFAULT '{}', -- {medical_clearance, medications_ready, follow_up_scheduled, etc.}
    barriers JSONB DEFAULT '[]', -- Array of {type, description, resolved}
    home_care_needs JSONB DEFAULT '[]', -- Array of care needs
    medication_reconciliation JSONB DEFAULT '{}', -- {pre_admission_meds, current_meds, discharge_meds, changes}
    follow_up_appointments JSONB DEFAULT '[]', -- Array of appointments
    education_provided JSONB DEFAULT '[]', -- Array of {topic, provided_by, date}
    discharge_location TEXT, -- 'home', 'skilled_nursing', 'rehab', 'other'
    discharge_location_details TEXT,
    case_manager TEXT,
    case_manager_id UUID REFERENCES users(id),
    notes TEXT,
    status TEXT DEFAULT 'in-progress', -- 'in-progress', 'ready', 'completed', 'delayed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one discharge planning record per admission
    UNIQUE(admission_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_discharge_planning_admission_id ON discharge_planning(admission_id);
CREATE INDEX IF NOT EXISTS idx_discharge_planning_organization_id ON discharge_planning(organization_id);
CREATE INDEX IF NOT EXISTS idx_discharge_planning_status ON discharge_planning(status);
CREATE INDEX IF NOT EXISTS idx_discharge_planning_target_date ON discharge_planning(target_discharge_date);

-- ============================================
-- 3. DISCHARGE SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS discharge_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    discharge_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    hospital_course TEXT,
    procedures_performed JSONB DEFAULT '[]', -- Array of procedures
    final_diagnoses JSONB DEFAULT '[]', -- Array of diagnoses
    discharge_medications JSONB DEFAULT '[]', -- Array of medications
    discharge_instructions TEXT,
    activity_restrictions TEXT,
    diet_instructions TEXT,
    follow_up_plan TEXT,
    follow_up_appointments JSONB DEFAULT '[]', -- Array of appointments
    patient_education_provided JSONB DEFAULT '[]', -- Array of education topics
    discharging_physician TEXT,
    discharging_physician_id UUID REFERENCES users(id),
    summary_generated_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one discharge summary per admission
    UNIQUE(admission_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_discharge_summaries_admission_id ON discharge_summaries(admission_id);
CREATE INDEX IF NOT EXISTS idx_discharge_summaries_organization_id ON discharge_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_discharge_summaries_discharge_date ON discharge_summaries(discharge_date);

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE procedure_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- Procedure Records Policies
DROP POLICY IF EXISTS "Users can view procedure records from their organization" ON procedure_records;
CREATE POLICY "Users can view procedure records from their organization"
    ON procedure_records FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert procedure records for their organization" ON procedure_records;
CREATE POLICY "Users can insert procedure records for their organization"
    ON procedure_records FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update procedure records from their organization" ON procedure_records;
CREATE POLICY "Users can update procedure records from their organization"
    ON procedure_records FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete procedure records from their organization" ON procedure_records;
CREATE POLICY "Users can delete procedure records from their organization"
    ON procedure_records FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Discharge Planning Policies
DROP POLICY IF EXISTS "Users can view discharge planning from their organization" ON discharge_planning;
CREATE POLICY "Users can view discharge planning from their organization"
    ON discharge_planning FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert discharge planning for their organization" ON discharge_planning;
CREATE POLICY "Users can insert discharge planning for their organization"
    ON discharge_planning FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update discharge planning from their organization" ON discharge_planning;
CREATE POLICY "Users can update discharge planning from their organization"
    ON discharge_planning FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete discharge planning from their organization" ON discharge_planning;
CREATE POLICY "Users can delete discharge planning from their organization"
    ON discharge_planning FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Discharge Summaries Policies
DROP POLICY IF EXISTS "Users can view discharge summaries from their organization" ON discharge_summaries;
CREATE POLICY "Users can view discharge summaries from their organization"
    ON discharge_summaries FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert discharge summaries for their organization" ON discharge_summaries;
CREATE POLICY "Users can insert discharge summaries for their organization"
    ON discharge_summaries FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update discharge summaries from their organization" ON discharge_summaries;
CREATE POLICY "Users can update discharge summaries from their organization"
    ON discharge_summaries FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete discharge summaries from their organization" ON discharge_summaries;
CREATE POLICY "Users can delete discharge summaries from their organization"
    ON discharge_summaries FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- ============================================
-- 6. CREATE TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function already exists from previous migration
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_procedure_records_updated_at ON procedure_records;
CREATE TRIGGER update_procedure_records_updated_at
    BEFORE UPDATE ON procedure_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_discharge_planning_updated_at ON discharge_planning;
CREATE TRIGGER update_discharge_planning_updated_at
    BEFORE UPDATE ON discharge_planning
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_discharge_summaries_updated_at ON discharge_summaries;
CREATE TRIGGER update_discharge_summaries_updated_at
    BEFORE UPDATE ON discharge_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this script, execute the following queries to verify:

-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('procedure_records', 'discharge_planning', 'discharge_summaries')
-- ORDER BY table_name, ordinal_position;

-- SELECT COUNT(*) FROM procedure_records;
-- SELECT COUNT(*) FROM discharge_planning;
-- SELECT COUNT(*) FROM discharge_summaries;

