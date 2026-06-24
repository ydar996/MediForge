-- Patient consent records for portal, data sharing, OLIS query, and research.

CREATE TABLE IF NOT EXISTS public.patient_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'portal_access',
    'data_sharing',
    'olis_query',
    'research'
  )),
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  granted_by TEXT,
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, patient_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_patient_consents_org_patient
  ON public.patient_consents(organization_id, patient_id);

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_consents_org_select ON public.patient_consents
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()
    )
  );

CREATE POLICY patient_consents_org_insert ON public.patient_consents
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()
    )
  );

CREATE POLICY patient_consents_org_update ON public.patient_consents
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()
    )
  );

COMMENT ON TABLE public.patient_consents IS 'PHIPA-aligned consent capture for portal, sharing, OLIS, and research';
