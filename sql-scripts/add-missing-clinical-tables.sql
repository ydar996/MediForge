-- ============================================
-- ADDITIONAL CLINICAL TABLES (MISSING DATA)
-- ============================================

-- 1. ALLERGIES
CREATE TABLE IF NOT EXISTS allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT,                -- mild, moderate, severe
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. IMMUNIZATIONS
CREATE TABLE IF NOT EXISTS immunizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    vaccine TEXT NOT NULL,
    administration_date DATE NOT NULL,
    lot_number TEXT,
    expiration_date DATE,
    site TEXT,                    -- injection site
    route TEXT,                   -- IM, SC, oral, etc.
    dose TEXT,
    manufacturer TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. IMAGING RESULTS (Uploaded Files)
CREATE TABLE IF NOT EXISTS imaging_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    study_type TEXT NOT NULL,
    study_date DATE,
    file_name TEXT,
    file_size BIGINT,
    file_type TEXT,               -- MIME type
    attachment TEXT,              -- base64 or file path
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS (Combined Lab/Imaging with Results)
CREATE TABLE IF NOT EXISTS clinical_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_id UUID REFERENCES patient_encounters(id),
    order_type TEXT NOT NULL,     -- lab, imaging, procedure
    order_date DATE NOT NULL,
    visit_date DATE,
    html_content TEXT,            -- formatted order details
    selected_items JSONB,         -- array of selected tests/studies
    status TEXT DEFAULT 'pending', -- pending, completed, cancelled
    deleted BOOLEAN DEFAULT false,
    no_items_checked BOOLEAN DEFAULT false,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDER RESULTS (Attached Files)
CREATE TABLE IF NOT EXISTS order_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_data TEXT,               -- base64 encoded
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PATIENT ENCOUNTERS (Messages/Requests)
CREATE TABLE IF NOT EXISTS patient_encounter_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_date DATE,
    reason TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending', -- pending, in-progress, completed, cancelled
    assigned_doctor TEXT,
    responses JSONB,              -- array of responses
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DETAILED PRESCRIPTIONS (Enhanced)
CREATE TABLE IF NOT EXISTS prescription_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Prescriber details
    prescriber_name TEXT,
    prescriber_license TEXT,
    prescriber_specialty TEXT,
    prescriber_address TEXT,
    prescriber_phone TEXT,
    prescriber_email TEXT,
    prescriber_org TEXT,
    
    -- Prescription metadata
    diagnosis TEXT,
    status TEXT DEFAULT 'active', -- active, filled, cancelled
    signature TEXT,               -- base64 or reference
    signature_date TIMESTAMPTZ,
    saved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PRESCRIPTION MEDICATIONS (Detailed)
CREATE TABLE IF NOT EXISTS prescription_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_detail_id UUID REFERENCES prescription_details(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    strength TEXT,
    form TEXT,                    -- tablet, capsule, syrup, etc.
    route TEXT,                   -- oral, topical, IV, etc.
    quantity INTEGER,
    refills INTEGER,
    directions TEXT,
    duration TEXT,
    warnings TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. REFERRAL DETAILS (Structured)
CREATE TABLE IF NOT EXISTS referral_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_id UUID REFERENCES patient_encounters(id),
    referral_date DATE NOT NULL,
    referral_type TEXT,
    specialist_id TEXT,
    specialist_name TEXT NOT NULL,
    diagnoses TEXT,
    urgency TEXT,                 -- routine, urgent, emergency
    status TEXT DEFAULT 'pending', -- pending, scheduled, completed, cancelled
    note TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. SOAP NOTE AUDIT TRAIL
CREATE TABLE IF NOT EXISTS soap_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES patient_encounters(id) ON DELETE CASCADE,
    action TEXT NOT NULL,         -- created, edited, locked, unlocked
    user_name TEXT NOT NULL,
    reason TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PROOF ATTACHMENTS (for preventive care)
CREATE TABLE IF NOT EXISTS preventive_care_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preventive_care_id UUID NOT NULL REFERENCES preventive_care(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_data TEXT,               -- base64 encoded
    uploaded_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPDATE EXISTING TABLES
-- ============================================

-- Add locked fields to patient_encounters
ALTER TABLE patient_encounters 
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- Add timestamp to vitals
ALTER TABLE vital_signs
ADD COLUMN IF NOT EXISTS timestamp BIGINT;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_immunizations_patient ON immunizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_results_patient ON imaging_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_orders_patient ON clinical_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_orders_status ON clinical_orders(status);
CREATE INDEX IF NOT EXISTS idx_encounter_requests_patient ON patient_encounter_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounter_requests_status ON patient_encounter_requests(status);
CREATE INDEX IF NOT EXISTS idx_prescription_details_patient ON prescription_details(patient_id);
CREATE INDEX IF NOT EXISTS idx_referral_details_patient ON referral_details(patient_id);
CREATE INDEX IF NOT EXISTS idx_soap_audit_encounter ON soap_audit_trail(encounter_id);

-- ============================================
-- VERIFY
-- ============================================

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'allergies', 'immunizations', 'imaging_results', 'clinical_orders',
        'order_results', 'patient_encounter_requests', 'prescription_details',
        'prescription_medications', 'referral_details', 'soap_audit_trail',
        'preventive_care_attachments'
    )
ORDER BY table_name;



