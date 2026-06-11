-- ============================================
-- CREATE IN-PATIENT SERVICES TABLES
-- ============================================
-- This migration creates tables for in-patient services:
-- 1. rooms - Hospital/clinic rooms
-- 2. admissions - Patient admission records (created before beds to avoid forward reference)
-- 3. beds - Beds within rooms
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ROOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'icu', 'private', 'semi-private', 'ward'
    floor_number INTEGER,
    capacity INTEGER DEFAULT 1, -- Number of beds this room can hold
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique room names per organization
    UNIQUE(organization_id, room_name)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_rooms_organization_id ON rooms(organization_id);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active);

-- ============================================
-- 2. ADMISSIONS TABLE (Created before beds to avoid forward reference)
-- ============================================
CREATE TABLE IF NOT EXISTS admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL, -- References patients.patient_id
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    visit_date DATE, -- Original visit date that led to admission
    encounter_id UUID, -- Optional: Link to patient_encounters or clinical_notes
    admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admission_reason TEXT,
    admitting_doctor TEXT, -- Doctor who admitted the patient
    admitting_doctor_id UUID, -- Optional: References users.id
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    bed_id UUID, -- Will reference beds(id) after beds table is created
    status TEXT NOT NULL DEFAULT 'admitted', -- 'admitted', 'assigned', 'discharged', 'transferred', 'cancelled'
    discharge_date TIMESTAMPTZ,
    discharge_reason TEXT,
    discharge_notes TEXT,
    estimated_discharge_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_organization_id ON admissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_room_id ON admissions(room_id);
CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_admissions_date ON admissions(admission_date);
CREATE INDEX IF NOT EXISTS idx_admissions_visit_date ON admissions(visit_date);

-- ============================================
-- 3. BEDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bed_number TEXT NOT NULL, -- e.g., "1", "A", "ICU-1"
    bed_name TEXT, -- Optional friendly name
    bed_type TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'icu', 'isolation', 'bariatric'
    is_occupied BOOLEAN DEFAULT false,
    current_patient_id TEXT, -- References patients.patient_id
    current_admission_id UUID REFERENCES admissions(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique bed numbers per room
    UNIQUE(room_id, bed_number)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_organization_id ON beds(organization_id);
CREATE INDEX IF NOT EXISTS idx_beds_occupied ON beds(is_occupied);
CREATE INDEX IF NOT EXISTS idx_beds_patient_id ON beds(current_patient_id);
CREATE INDEX IF NOT EXISTS idx_beds_admission_id ON beds(current_admission_id);
CREATE INDEX IF NOT EXISTS idx_beds_active ON beds(is_active);

-- Now add the foreign key constraint to admissions.bed_id (after beds table is created)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admissions_bed_id_fkey'
    ) THEN
        ALTER TABLE admissions 
        ADD CONSTRAINT admissions_bed_id_fkey 
        FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on rooms table
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Enable RLS on beds table
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;

-- Enable RLS on admissions table
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- Rooms: Users can only see rooms from their organization
CREATE POLICY "Users can view rooms from their organization"
    ON rooms FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Rooms: Users can insert rooms for their organization
CREATE POLICY "Users can insert rooms for their organization"
    ON rooms FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Rooms: Users can update rooms from their organization
CREATE POLICY "Users can update rooms from their organization"
    ON rooms FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Rooms: Users can delete rooms from their organization
CREATE POLICY "Users can delete rooms from their organization"
    ON rooms FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Beds: Users can only see beds from their organization
CREATE POLICY "Users can view beds from their organization"
    ON beds FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Beds: Users can insert beds for their organization
CREATE POLICY "Users can insert beds for their organization"
    ON beds FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Beds: Users can update beds from their organization
CREATE POLICY "Users can update beds from their organization"
    ON beds FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Beds: Users can delete beds from their organization
CREATE POLICY "Users can delete beds from their organization"
    ON beds FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Admissions: Users can only see admissions from their organization
CREATE POLICY "Users can view admissions from their organization"
    ON admissions FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Admissions: Users can insert admissions for their organization
CREATE POLICY "Users can insert admissions for their organization"
    ON admissions FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Admissions: Users can update admissions from their organization
CREATE POLICY "Users can update admissions from their organization"
    ON admissions FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            UNION
            SELECT id FROM organizations WHERE id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()::text::uuid
            )
        )
    );

-- Admissions: Users can delete admissions from their organization
CREATE POLICY "Users can delete admissions from their organization"
    ON admissions FOR DELETE
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to rooms table
CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to beds table
CREATE TRIGGER update_beds_updated_at
    BEFORE UPDATE ON beds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to admissions table
CREATE TRIGGER update_admissions_updated_at
    BEFORE UPDATE ON admissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this script, execute the following queries to verify:

-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('rooms', 'beds', 'admissions')
-- ORDER BY table_name, ordinal_position;

-- SELECT COUNT(*) as room_count FROM rooms;
-- SELECT COUNT(*) as bed_count FROM beds;
-- SELECT COUNT(*) as admission_count FROM admissions;

