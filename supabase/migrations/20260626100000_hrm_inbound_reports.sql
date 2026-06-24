-- HRM inbound hospital reports desk (Phase 7)
CREATE TABLE IF NOT EXISTS public.hrm_inbound_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id TEXT,
  placer_id TEXT,
  report_title TEXT NOT NULL DEFAULT 'Hospital Report',
  report_body TEXT,
  raw_hl7 TEXT,
  fhir_bundle JSONB,
  status TEXT NOT NULL DEFAULT 'awaiting_review' CHECK (status IN ('awaiting_review', 'filed', 'rejected')),
  filed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hrm_reports_org_status ON public.hrm_inbound_reports(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_hrm_reports_patient ON public.hrm_inbound_reports(patient_id);

ALTER TABLE public.hrm_inbound_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY hrm_reports_org_select ON public.hrm_inbound_reports
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()
    )
  );

CREATE POLICY hrm_reports_org_insert ON public.hrm_inbound_reports
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()
    )
  );

CREATE POLICY hrm_reports_org_update ON public.hrm_inbound_reports
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid() OR id = auth.uid()
    )
  );

COMMENT ON TABLE public.hrm_inbound_reports IS 'HRM-ready inbound hospital report inbox (Phase 7)';
