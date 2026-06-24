-- Append-only audit_logs: block UPDATE and DELETE by application roles.
-- Platform/service operations may still use service_role for compliance tooling.

CREATE OR REPLACE FUNCTION public.audit_logs_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: UPDATE and DELETE are not permitted';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_deny_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_deny_mutation();

COMMENT ON FUNCTION public.audit_logs_deny_mutation() IS 'Enforces append-only audit_logs for PHIPA/OntarioMD evidence';

-- Broader patient chart access logging helper (call from RPC or app)
CREATE OR REPLACE FUNCTION public.log_patient_chart_access(
  p_organization_id UUID,
  p_username TEXT,
  p_patient_id TEXT,
  p_action TEXT DEFAULT 'patient_chart_viewed',
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id BIGINT;
BEGIN
  INSERT INTO public.audit_logs (
    organization_id,
    username,
    action,
    event_type,
    details
  ) VALUES (
    p_organization_id,
    COALESCE(NULLIF(trim(p_username), ''), 'unknown'),
    COALESCE(NULLIF(trim(p_action), ''), 'patient_chart_viewed'),
    'patient_data',
    COALESCE(p_details, '{}'::jsonb) || jsonb_build_object('patient_id', p_patient_id)
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_patient_chart_access(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_patient_chart_access(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_patient_chart_access(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.log_patient_chart_access IS 'Append patient chart access events to audit_logs';
