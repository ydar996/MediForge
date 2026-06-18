-- Hide office visit summaries that were published before clinical content existed.
-- Patients should only see summaries with real chart data (enforced in app + this backfill).

UPDATE discharge_summaries
SET portal_visible = false
WHERE summary_type = 'office_visit'
  AND portal_visible = true
  AND coalesce(jsonb_array_length(visit_snapshot->'vitals'), 0) = 0
  AND coalesce(jsonb_array_length(visit_snapshot->'orders'), 0) = 0
  AND coalesce(jsonb_array_length(visit_snapshot->'prescriptions'), 0) = 0
  AND coalesce(jsonb_array_length(visit_snapshot->'diagnoses'), 0) = 0
  AND coalesce(jsonb_array_length(visit_snapshot->'referrals'), 0) = 0
  AND coalesce(nullif(trim(visit_snapshot->>'visitOverview'), ''), '') = ''
  AND coalesce(nullif(trim(visit_snapshot->>'followUpPlan'), ''), '') = '';
