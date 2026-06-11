-- ============================================
-- COMPLETE CLINICAL DATA SCHEMA FOR MEDIFORGE
-- ============================================

-- 1. PATIENT ENCOUNTERS (Visits)
CREATE TABLE IF NOT EXISTS patient_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_date DATE NOT NULL,
    symptoms TEXT,
    diagnosis TEXT,
    prescription TEXT,
    -- SOAP Note: Subjective
    soap_subjective_cc TEXT,  -- Chief Complaint
    soap_subjective_hpi TEXT, -- History of Present Illness
    soap_subjective_fh TEXT,  -- Family History
    soap_subjective_sh TEXT,  -- Social History
    soap_subjective_ros TEXT, -- Review of Systems
    -- SOAP Note: Objective
    soap_objective_physical TEXT,
    soap_objective_labs TEXT,
    soap_objective_no_labs BOOLEAN DEFAULT false,
    soap_objective_no_imaging BOOLEAN DEFAULT false,
    -- SOAP Note: Assessment
    soap_assessment_differential TEXT,
    soap_assessment_status TEXT,
    -- SOAP Note: Plan
    soap_plan_treatments TEXT,
    soap_plan_testing TEXT,
    soap_plan_referrals TEXT,
    soap_plan_education TEXT,
    soap_plan_followup TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VITAL SIGNS
CREATE TABLE IF NOT EXISTS vital_signs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES patient_encounters(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    recorded_date TIMESTAMPTZ DEFAULT NOW(),
    temperature DECIMAL(5,2),     -- Fahrenheit
    heart_rate INTEGER,           -- bpm
    respiratory_rate INTEGER,     -- breaths per minute
    systolic_bp INTEGER,          -- mmHg
    diastolic_bp INTEGER,         -- mmHg
    oxygen_saturation INTEGER,    -- %
    height DECIMAL(6,2),          -- cm
    weight DECIMAL(6,2),          -- kg
    bmi DECIMAL(5,2),
    pain_score INTEGER,           -- 0-10
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DIAGNOSES
CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    diagnosis_date DATE NOT NULL,
    diagnosis_code TEXT,          -- ICD code
    diagnosis_description TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active', -- active, resolved, chronic
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MEDICATIONS (Active Medications List)
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    route TEXT,                   -- oral, IV, topical, etc.
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active', -- active, discontinued, completed
    prescribing_doctor TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRESCRIPTIONS (Historical Prescriptions)
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_id UUID REFERENCES patient_encounters(id),
    prescription_date DATE NOT NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    quantity INTEGER,
    refills INTEGER,
    prescribing_doctor TEXT,
    pharmacy_notes TEXT,
    status TEXT DEFAULT 'active', -- active, filled, expired, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEDICAL HISTORY
CREATE TABLE IF NOT EXISTS medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_date DATE NOT NULL,
    event_type TEXT,              -- diagnosis, surgery, hospitalization, etc.
    event_description TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PREVENTIVE CARE GAPS
CREATE TABLE IF NOT EXISTS preventive_care (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    intervention_name TEXT NOT NULL,
    due_date DATE,
    addressed BOOLEAN DEFAULT false,
    addressed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. LAB ORDERS
CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_id UUID REFERENCES patient_encounters(id),
    order_date DATE NOT NULL,
    test_name TEXT NOT NULL,
    test_code TEXT,
    priority TEXT,                -- routine, urgent, stat
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    ordering_doctor TEXT,
    lab_facility TEXT,
    notes TEXT,
    results TEXT,
    result_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. IMAGING ORDERS
CREATE TABLE IF NOT EXISTS imaging_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_id UUID REFERENCES patient_encounters(id),
    order_date DATE NOT NULL,
    imaging_type TEXT NOT NULL,   -- X-Ray, CT, MRI, Ultrasound, etc.
    body_part TEXT,
    priority TEXT,                -- routine, urgent, stat
    status TEXT DEFAULT 'pending', -- pending, scheduled, completed, cancelled
    ordering_doctor TEXT,
    imaging_facility TEXT,
    notes TEXT,
    results TEXT,
    result_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_id UUID REFERENCES patient_encounters(id),
    referral_date DATE NOT NULL,
    referring_doctor TEXT,
    specialist_type TEXT NOT NULL,
    specialist_name TEXT,
    reason TEXT NOT NULL,
    priority TEXT,                -- routine, urgent
    status TEXT DEFAULT 'pending', -- pending, scheduled, completed, cancelled
    appointment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    appointment_id TEXT REFERENCES appointments(appointment_id),
    invoice_date DATE NOT NULL,
    due_date DATE,
    total_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    amount_outstanding DECIMAL(10,2),
    currency TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'pending', -- pending, partial, paid, overdue, cancelled
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    service_code TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT,          -- cash, card, transfer, insurance
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON patient_encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_org ON patient_encounters(organization_id);
CREATE INDEX IF NOT EXISTS idx_encounters_date ON patient_encounters(encounter_date);

CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vital_signs(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_encounter ON vital_signs(encounter_id);

CREATE INDEX IF NOT EXISTS idx_diagnoses_patient ON diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_org ON diagnoses(organization_id);

CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(status);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON medical_history(patient_id);

CREATE INDEX IF NOT EXISTS idx_preventive_care_patient ON preventive_care(patient_id);

CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);

CREATE INDEX IF NOT EXISTS idx_imaging_orders_patient ON imaging_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_orders_status ON imaging_orders(status);

CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_appointment ON invoices(appointment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ============================================
-- VERIFY SCHEMA
-- ============================================

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'patient_encounters', 'vital_signs', 'diagnoses', 'medications', 
        'prescriptions', 'medical_history', 'preventive_care', 'lab_orders',
        'imaging_orders', 'referrals', 'invoices', 'invoice_items', 'payments'
    )
ORDER BY table_name;



