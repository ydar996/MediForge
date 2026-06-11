-- Purpose: add array/jsonb columns for patient medical history data

alter table public.patients
  add column if not exists medical_history jsonb default '[]'::jsonb,
  add column if not exists allergies jsonb default '[]'::jsonb,
  add column if not exists medications jsonb default '[]'::jsonb,
  add column if not exists immunizations jsonb default '[]'::jsonb,
  add column if not exists emergency_contact_address text,
  add column if not exists emergency_contact_email text;

