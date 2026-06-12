-- Billing payers, claims, payment plans, remittance
-- Canadian provincial + private payer support

CREATE TABLE IF NOT EXISTS patient_payer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  province TEXT,
  phn TEXT,
  health_card_version TEXT,
  payment_source TEXT NOT NULL DEFAULT 'provincial',
  primary_payer_code TEXT,
  private_insurer_id TEXT,
  insurance_member_number TEXT,
  insurance_policy_number TEXT,
  insurance_group_number TEXT,
  preferred_payment_method TEXT DEFAULT 'cash',
  copay_amount NUMERIC(10,2) DEFAULT 0,
  deductible_remaining NUMERIC(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, organization_id)
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  invoice_id TEXT,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('provincial', 'private', 'wcb')),
  payer_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'paid', 'void')),
  claim_payload JSONB NOT NULL DEFAULT '{}',
  external_claim_id TEXT,
  submitted_at TIMESTAMPTZ,
  paid_amount NUMERIC(10,2),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_org_status ON insurance_claims(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_invoice ON insurance_claims(invoice_id);

CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  total_due NUMERIC(10,2) NOT NULL,
  installments INT NOT NULL DEFAULT 3,
  schedule JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remittance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payer_code TEXT NOT NULL,
  remittance_date DATE,
  total_paid NUMERIC(10,2),
  payload JSONB NOT NULL DEFAULT '{}',
  reconciled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE patient_payer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_payer_profiles_org ON patient_payer_profiles
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY insurance_claims_org ON insurance_claims
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY payment_plans_org ON payment_plans
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY remittance_records_org ON remittance_records
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()));

COMMENT ON TABLE patient_payer_profiles IS 'Canadian PHN, provincial/private payer, payment preferences';
COMMENT ON TABLE insurance_claims IS 'Provincial (OHIP/RAMQ/MSP) and private insurance claim drafts/submissions';
COMMENT ON TABLE payment_plans IS 'Installment payment plans for patient balances';
COMMENT ON TABLE remittance_records IS 'Remittance advice / ERA from payers';
