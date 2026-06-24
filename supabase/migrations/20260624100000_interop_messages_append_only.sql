-- Append-only interop_messages for integration audit trail (Phase 1).
-- Application roles cannot UPDATE or DELETE; service_role retains access for compliance tooling.

CREATE OR REPLACE FUNCTION public.interop_messages_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'interop_messages is append-only: UPDATE and DELETE are not permitted';
END;
$$;

DROP TRIGGER IF EXISTS interop_messages_no_update ON public.interop_messages;
CREATE TRIGGER interop_messages_no_update
  BEFORE UPDATE ON public.interop_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.interop_messages_deny_mutation();

DROP TRIGGER IF EXISTS interop_messages_no_delete ON public.interop_messages;
CREATE TRIGGER interop_messages_no_delete
  BEFORE DELETE ON public.interop_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.interop_messages_deny_mutation();

COMMENT ON FUNCTION public.interop_messages_deny_mutation() IS 'Enforces append-only interop_messages for HL7/FHIR/DICOM audit evidence';
