-- MFA Staff Clinic — canonical auto patient number: MFA-SC + 4 digits (MIN/MFA legacy retained in DB until migrated).
-- App reads settings.patient_id_prefix for generation + UI mapping (see js/supabase-patients.js, js/patients.js).
UPDATE public.organizations
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{patient_id_prefix}',
    '"MFA-SC"',
    true
  ),
  updated_at = NOW()
WHERE id = '94534e80-06a8-468f-b8a2-ece3f07697c4'::uuid;
