-- MediForge interoperability: message queue, patient identifiers, endpoint config
-- Run in Supabase SQL Editor or via supabase db push

CREATE TABLE IF NOT EXISTS interop_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  standard TEXT NOT NULL CHECK (standard IN ('hl7', 'fhir', 'dicom')),
  message_type TEXT NOT NULL,
  correlation_id TEXT,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  order_id UUID,
  prescription_id UUID,
  payload JSONB,
  raw_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'processed', 'failed', 'acknowledged')),
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_interop_messages_org_status ON interop_messages(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_interop_messages_correlation ON interop_messages(correlation_id);
CREATE INDEX IF NOT EXISTS idx_interop_messages_patient ON interop_messages(patient_id);

CREATE TABLE IF NOT EXISTS patient_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  system TEXT NOT NULL,
  value TEXT NOT NULL,
  province TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, system, value)
);

CREATE INDEX IF NOT EXISTS idx_patient_identifiers_patient ON patient_identifiers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_identifiers_value ON patient_identifiers(organization_id, value);

CREATE TABLE IF NOT EXISTS interop_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  adapter_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interop_endpoints_org ON interop_endpoints(organization_id, adapter_type);

-- RLS: organization-scoped access
ALTER TABLE interop_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE interop_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY interop_messages_org_access ON interop_messages
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY patient_identifiers_org_access ON patient_identifiers
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY interop_endpoints_org_access ON interop_endpoints
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE interop_messages IS 'Audit and retry queue for HL7/FHIR/DICOM interoperability messages';
COMMENT ON TABLE patient_identifiers IS 'Provincial health numbers (PHN) and other cross-system patient IDs';
COMMENT ON TABLE interop_endpoints IS 'Per-organization adapter endpoint configuration';
