-- Replace tribe with race for North American patient demographics (idempotent).

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS race TEXT;

COMMENT ON COLUMN public.patients.race IS 'Patient race (OMB-style categories; Declined to Disclose allowed)';

-- Backfill from legacy tribe column where race is empty
UPDATE public.patients
SET race = tribe
WHERE (race IS NULL OR trim(race) = '')
  AND tribe IS NOT NULL
  AND trim(tribe) <> '';
