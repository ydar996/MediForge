-- ============================================
-- COMPLETE MEDIFORGE SCHEMA - ALL TABLES
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================

-- 1. PATIENT ENCOUNTERS (Visits with SOAP notes)
CREATE TABLE IF NOT EXISTS patient_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_date DATE NOT NULL,
    symptoms TEXT,
    diagnosis TEXT,
    prescription TEXT,
    -- SOAP Note: Subjective
    soap_subjective_cc TEXT,
    soap_subjective_hpi TEXT,
    soap_subjective_fh TEXT,
    soap_subjective_sh TEXT,
    soap_subjective_ros TEXT,
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
    -- Locking
    locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
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
    temperature DECIMAL(5,2),
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    oxygen_saturation INTEGER,
    height DECIMAL(6,2),
    weight DECIMAL(6,2),
    bmi DECIMAL(5,2),
    pain_score INTEGER,
    notes TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DIAGNOSES
CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    diagnosis_date DATE NOT NULL,
    diagnosis_code TEXT,
    diagnosis_description TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MEDICATIONS
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    route TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active',
    prescribing_doctor TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRESCRIPTIONS
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
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEDICAL HISTORY
CREATE TABLE IF NOT EXISTS medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_date DATE NOT NULL,
    event_type TEXT,
    event_description TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PREVENTIVE CARE
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
    priority TEXT,
    status TEXT DEFAULT 'pending',
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
    imaging_type TEXT NOT NULL,
    body_part TEXT,
    priority TEXT,
    status TEXT DEFAULT 'pending',
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
    priority TEXT,
    status TEXT DEFAULT 'pending',
    appointment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ALLERGIES
CREATE TABLE IF NOT EXISTS allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. IMMUNIZATIONS
CREATE TABLE IF NOT EXISTS immunizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    vaccine TEXT NOT NULL,
    administration_date DATE NOT NULL,
    lot_number TEXT,
    expiration_date DATE,
    site TEXT,
    route TEXT,
    dose TEXT,
    manufacturer TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. IMAGING RESULTS (Files)
CREATE TABLE IF NOT EXISTS imaging_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    study_type TEXT NOT NULL,
    study_date DATE,
    file_name TEXT,
    file_size BIGINT,
    file_type TEXT,
    attachment TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. CLINICAL ORDERS
CREATE TABLE IF NOT EXISTS clinical_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_id UUID REFERENCES patient_encounters(id),
    order_type TEXT NOT NULL,
    order_date DATE NOT NULL,
    visit_date DATE,
    html_content TEXT,
    selected_items JSONB,
    status TEXT DEFAULT 'pending',
    deleted BOOLEAN DEFAULT false,
    no_items_checked BOOLEAN DEFAULT false,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. ORDER RESULTS
CREATE TABLE IF NOT EXISTS order_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES clinical_orders(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_data TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. PATIENT ENCOUNTER REQUESTS
CREATE TABLE IF NOT EXISTS patient_encounter_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    encounter_date DATE,
    reason TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    assigned_doctor TEXT,
    responses JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. REFERRAL DETAILS
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
    urgency TEXT,
    status TEXT DEFAULT 'pending',
    note TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. SOAP AUDIT TRAIL
CREATE TABLE IF NOT EXISTS soap_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES patient_encounters(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    user_name TEXT NOT NULL,
    reason TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. PREVENTIVE CARE ATTACHMENTS
CREATE TABLE IF NOT EXISTS preventive_care_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preventive_care_id UUID NOT NULL REFERENCES preventive_care(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_data TEXT,
    uploaded_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. BILLING INVOICES
CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id TEXT UNIQUE NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    appointment_id TEXT,
    encounter_id TEXT,
    invoice_date DATE NOT NULL,
    due_date DATE,
    currency TEXT DEFAULT 'NGN',
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    discount_reason TEXT,
    total DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    amount_due DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified TIMESTAMPTZ DEFAULT NOW()
);

-- 21. BILLING INVOICE SERVICES
CREATE TABLE IF NOT EXISTS billing_invoice_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
    service_id TEXT,
    service_code TEXT,
    service_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. BILLING PAYMENTS
CREATE TABLE IF NOT EXISTS billing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id TEXT UNIQUE NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    invoice_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    method TEXT NOT NULL,
    method_details TEXT,
    payment_date DATE NOT NULL,
    status TEXT DEFAULT 'completed',
    notes TEXT,
    received_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. SPECIALISTS (Referral Network)
CREATE TABLE IF NOT EXISTS specialists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialist_id TEXT UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    specialty TEXT NOT NULL,
    business_name TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT,
    medical_license TEXT,
    business_type TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    telephone TEXT,
    fax TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_immunizations_patient ON immunizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_imaging_results_patient ON imaging_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_orders_patient ON clinical_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounter_requests_patient ON patient_encounter_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_referral_details_patient ON referral_details(patient_id);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_patient ON billing_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_patient ON billing_payments(patient_id);

CREATE INDEX IF NOT EXISTS idx_specialists_org ON specialists(organization_id);

-- ============================================
-- VERIFY ALL TABLES CREATED
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
        'imaging_orders', 'referrals', 'allergies', 'immunizations',
        'imaging_results', 'clinical_orders', 'order_results',
        'patient_encounter_requests', 'referral_details', 'soap_audit_trail',
        'preventive_care_attachments', 'billing_invoices', 'billing_invoice_services',
        'billing_payments', 'specialists'
    )
ORDER BY table_name;

-- Expected: 23 tables created



