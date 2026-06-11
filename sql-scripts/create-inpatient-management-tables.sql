-- ============================================
-- CREATE INPATIENT MANAGEMENT TABLES
-- ============================================
-- This migration creates tables for comprehensive inpatient management:
-- 1. inpatient_assessments - Initial and ongoing assessments
-- 2. care_plans - Patient care plans with goals/interventions
-- 3. inpatient_vitals - Vitals flowsheet (separate from outpatient)
-- 4. medication_administration - Medication administration records
-- 5. rounds_notes - Multidisciplinary rounds documentation
-- 6. handoff_notes - Shift change handoffs
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. EXTEND ADMISSIONS TABLE
-- ============================================
-- Add new fields to existing admissions table
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS admission_type TEXT DEFAULT 'elective', -- 'emergency', 'elective', 'transfer'
ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consents_signed JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS pre_admission_testing JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS initial_orders JSONB DEFAULT '[]';

-- Add comments
COMMENT ON COLUMN admissions.admission_type IS 'Type of admission: emergency, elective, or transfer';
COMMENT ON COLUMN admissions.insurance_verified IS 'Whether insurance has been verified';
COMMENT ON COLUMN admissions.consents_signed IS 'Array of consent forms signed';
COMMENT ON COLUMN admissions.pre_admission_testing IS 'Pre-admission test results';
COMMENT ON COLUMN admissions.initial_orders IS 'Initial orders placed on admission';

-- ============================================
-- 2. INPATIENT ASSESSMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inpatient_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assessment_type TEXT NOT NULL DEFAULT 'initial', -- 'initial', 'ongoing', 'reassessment'
    history_physical JSONB DEFAULT '{}',
    risk_scores JSONB DEFAULT '{}', -- {fall_risk, infection_risk, pressure_ulcer_risk, dvt_risk, etc.}
    functional_status JSONB DEFAULT '{}',
    social_assessment TEXT,
    nutritional_assessment JSONB DEFAULT '{}',
    pain_assessment JSONB DEFAULT '{}',
    assessed_by UUID REFERENCES users(id),
    assessment_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_inpatient_assessments_admission_id ON inpatient_assessments(admission_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_assessments_organization_id ON inpatient_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_assessments_type ON inpatient_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_inpatient_assessments_date ON inpatient_assessments(assessment_date);

-- ============================================
-- 3. CARE PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS care_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    problem_list JSONB DEFAULT '[]', -- Array of problems/diagnoses
    goals JSONB DEFAULT '[]', -- Array of {goal, target_date, status, progress}
    interventions JSONB DEFAULT '[]', -- Array of {type, description, frequency, assigned_to, status}
    expected_los INTEGER, -- Expected length of stay in days
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_care_plans_admission_id ON care_plans(admission_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_organization_id ON care_plans(organization_id);

-- ============================================
-- 4. INPATIENT VITALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inpatient_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vital_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    temperature DECIMAL(5,2), -- Celsius
    heart_rate INTEGER, -- bpm
    respiratory_rate INTEGER, -- breaths/min
    systolic_bp INTEGER, -- mmHg
    diastolic_bp INTEGER, -- mmHg
    o2_saturation DECIMAL(5,2), -- percentage
    pain_score INTEGER, -- 0-10
    height DECIMAL(5,2), -- cm
    weight DECIMAL(5,2), -- kg
    bmi DECIMAL(5,2), -- kg/m²
    glucose DECIMAL(5,2), -- mg/dL (if applicable)
    recorded_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_inpatient_vitals_admission_id ON inpatient_vitals(admission_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_vitals_organization_id ON inpatient_vitals(organization_id);
CREATE INDEX IF NOT EXISTS idx_inpatient_vitals_time ON inpatient_vitals(vital_time);

-- ============================================
-- 5. MEDICATION ADMINISTRATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS medication_administration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    administered_time TIMESTAMPTZ,
    administered_by UUID REFERENCES users(id),
    dose_given TEXT,
    route TEXT, -- oral, IV, IM, etc.
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'given', 'held', 'refused', 'missed'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_med_admin_admission_id ON medication_administration(admission_id);
CREATE INDEX IF NOT EXISTS idx_med_admin_prescription_id ON medication_administration(prescription_id);
CREATE INDEX IF NOT EXISTS idx_med_admin_organization_id ON medication_administration(organization_id);
CREATE INDEX IF NOT EXISTS idx_med_admin_status ON medication_administration(status);
CREATE INDEX IF NOT EXISTS idx_med_admin_scheduled_time ON medication_administration(scheduled_time);

-- ============================================
-- 6. ROUNDS NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rounds_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rounds_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rounds_type TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'multidisciplinary', 'specialty'
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    team_members JSONB DEFAULT '[]', -- Array of {role, user_id, input}
    action_items JSONB DEFAULT '[]', -- Array of {task, assigned_to, due_date, status}
    documented_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_rounds_notes_admission_id ON rounds_notes(admission_id);
CREATE INDEX IF NOT EXISTS idx_rounds_notes_organization_id ON rounds_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_rounds_notes_date ON rounds_notes(rounds_date);
CREATE INDEX IF NOT EXISTS idx_rounds_notes_type ON rounds_notes(rounds_type);

-- ============================================
-- 7. HANDOFF NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS handoff_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift_type TEXT NOT NULL, -- 'day', 'night', 'evening'
    handoff_from UUID REFERENCES users(id),
    handoff_to UUID REFERENCES users(id),
    summary TEXT,
    active_issues JSONB DEFAULT '[]',
    pending_tasks JSONB DEFAULT '[]', -- Array of {task, priority, assigned_to, due_time}
    alerts JSONB DEFAULT '[]', -- Array of {alert_type, message, priority}
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_handoff_notes_admission_id ON handoff_notes(admission_id);
CREATE INDEX IF NOT EXISTS idx_handoff_notes_organization_id ON handoff_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_handoff_notes_shift_date ON handoff_notes(shift_date);
CREATE INDEX IF NOT EXISTS idx_handoff_notes_shift_type ON handoff_notes(shift_type);

-- ============================================
-- 8. EXTEND EXISTING TABLES
-- ============================================

-- Extend prescriptions table to link to admissions
ALTER TABLE prescriptions
ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES admissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_admission_id ON prescriptions(admission_id);

-- Extend orders table to link to admissions and add order types
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES admissions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'test', -- 'medication', 'test', 'procedure', 'diet', 'activity'
ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS administered_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_orders_admission_id ON orders(admission_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);

-- ============================================
-- 9. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE inpatient_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inpatient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_administration ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_notes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. CREATE RLS POLICIES
-- ============================================

-- Inpatient Assessments Policies
DROP POLICY IF EXISTS "Users can view assessments from their organization" ON inpatient_assessments;
CREATE POLICY "Users can view assessments from their organization"
    ON inpatient_assessments FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert assessments for their organization" ON inpatient_assessments;
CREATE POLICY "Users can insert assessments for their organization"
    ON inpatient_assessments FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update assessments from their organization" ON inpatient_assessments;
CREATE POLICY "Users can update assessments from their organization"
    ON inpatient_assessments FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete assessments from their organization" ON inpatient_assessments;
CREATE POLICY "Users can delete assessments from their organization"
    ON inpatient_assessments FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Care Plans Policies
DROP POLICY IF EXISTS "Users can view care plans from their organization" ON care_plans;
CREATE POLICY "Users can view care plans from their organization"
    ON care_plans FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert care plans for their organization" ON care_plans;
CREATE POLICY "Users can insert care plans for their organization"
    ON care_plans FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update care plans from their organization" ON care_plans;
CREATE POLICY "Users can update care plans from their organization"
    ON care_plans FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete care plans from their organization" ON care_plans;
CREATE POLICY "Users can delete care plans from their organization"
    ON care_plans FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Inpatient Vitals Policies
DROP POLICY IF EXISTS "Users can view inpatient vitals from their organization" ON inpatient_vitals;
CREATE POLICY "Users can view inpatient vitals from their organization"
    ON inpatient_vitals FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert inpatient vitals for their organization" ON inpatient_vitals;
CREATE POLICY "Users can insert inpatient vitals for their organization"
    ON inpatient_vitals FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update inpatient vitals from their organization" ON inpatient_vitals;
CREATE POLICY "Users can update inpatient vitals from their organization"
    ON inpatient_vitals FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete inpatient vitals from their organization" ON inpatient_vitals;
CREATE POLICY "Users can delete inpatient vitals from their organization"
    ON inpatient_vitals FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Medication Administration Policies
DROP POLICY IF EXISTS "Users can view medication administration from their organization" ON medication_administration;
CREATE POLICY "Users can view medication administration from their organization"
    ON medication_administration FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert medication administration for their organization" ON medication_administration;
CREATE POLICY "Users can insert medication administration for their organization"
    ON medication_administration FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update medication administration from their organization" ON medication_administration;
CREATE POLICY "Users can update medication administration from their organization"
    ON medication_administration FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete medication administration from their organization" ON medication_administration;
CREATE POLICY "Users can delete medication administration from their organization"
    ON medication_administration FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Rounds Notes Policies
DROP POLICY IF EXISTS "Users can view rounds notes from their organization" ON rounds_notes;
CREATE POLICY "Users can view rounds notes from their organization"
    ON rounds_notes FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert rounds notes for their organization" ON rounds_notes;
CREATE POLICY "Users can insert rounds notes for their organization"
    ON rounds_notes FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update rounds notes from their organization" ON rounds_notes;
CREATE POLICY "Users can update rounds notes from their organization"
    ON rounds_notes FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete rounds notes from their organization" ON rounds_notes;
CREATE POLICY "Users can delete rounds notes from their organization"
    ON rounds_notes FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Handoff Notes Policies
DROP POLICY IF EXISTS "Users can view handoff notes from their organization" ON handoff_notes;
CREATE POLICY "Users can view handoff notes from their organization"
    ON handoff_notes FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert handoff notes for their organization" ON handoff_notes;
CREATE POLICY "Users can insert handoff notes for their organization"
    ON handoff_notes FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can update handoff notes from their organization" ON handoff_notes;
CREATE POLICY "Users can update handoff notes from their organization"
    ON handoff_notes FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete handoff notes from their organization" ON handoff_notes;
CREATE POLICY "Users can delete handoff notes from their organization"
    ON handoff_notes FOR DELETE
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
-- 11. CREATE TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function already exists from previous migration, but ensure it's available
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_inpatient_assessments_updated_at ON inpatient_assessments;
CREATE TRIGGER update_inpatient_assessments_updated_at
    BEFORE UPDATE ON inpatient_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_care_plans_updated_at ON care_plans;
CREATE TRIGGER update_care_plans_updated_at
    BEFORE UPDATE ON care_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inpatient_vitals_updated_at ON inpatient_vitals;
CREATE TRIGGER update_inpatient_vitals_updated_at
    BEFORE UPDATE ON inpatient_vitals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medication_administration_updated_at ON medication_administration;
CREATE TRIGGER update_medication_administration_updated_at
    BEFORE UPDATE ON medication_administration
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rounds_notes_updated_at ON rounds_notes;
CREATE TRIGGER update_rounds_notes_updated_at
    BEFORE UPDATE ON rounds_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_handoff_notes_updated_at ON handoff_notes;
CREATE TRIGGER update_handoff_notes_updated_at
    BEFORE UPDATE ON handoff_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this script, execute the following queries to verify:

-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('inpatient_assessments', 'care_plans', 'inpatient_vitals', 'medication_administration', 'rounds_notes', 'handoff_notes')
-- ORDER BY table_name, ordinal_position;

-- SELECT COUNT(*) FROM inpatient_assessments;
-- SELECT COUNT(*) FROM care_plans;
-- SELECT COUNT(*) FROM inpatient_vitals;
-- SELECT COUNT(*) FROM medication_administration;
-- SELECT COUNT(*) FROM rounds_notes;
-- SELECT COUNT(*) FROM handoff_notes;

