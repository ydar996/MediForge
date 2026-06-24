-- Phase 7: HRM and DHDR consent types
ALTER TABLE public.patient_consents DROP CONSTRAINT IF EXISTS patient_consents_consent_type_check;

ALTER TABLE public.patient_consents ADD CONSTRAINT patient_consents_consent_type_check
  CHECK (consent_type IN (
    'portal_access',
    'data_sharing',
    'olis_query',
    'prescribeit_erx',
    'hrm_query',
    'dhdr_query',
    'research'
  ));
