-- Backfill prescription_number for existing prescriptions (run after 20260211000000_add_prescription_number.sql)
-- SAFETY: This script ONLY updates public.prescriptions.prescription_number. It does NOT read or write
-- patients, clinical_notes, patient_encounters, or any other table. It cannot delete clinical note text.
--
-- Prefix matches js/prescriptions.js generatePrescriptionNumber (effectiveRxPrefix):
--   1) organizations.settings.patient_id_prefix — first segment (split on - _ whitespace), A–Z/0–9, max 8 chars
--   2) else org_code — first segment split on - or _
--   3) else first 3 letters of organization name
-- Format: {PREFIX}-RX-{N} per organization, ordered by COALESCE(sent_to_pharmacy_at, created_at).
-- Duplicate prefixes across orgs: first org keeps MFA, next MFA1, MFA2, ... (by organization id order).
--
-- If rows already have prescription_number, they are skipped (only NULL is filled).
--
-- Run in Supabase SQL Editor on the project that backs production.

WITH orgs_touched AS (
  SELECT DISTINCT p.organization_id
  FROM prescriptions p
  WHERE p.prescription_number IS NULL
),
org_effective AS (
  SELECT
    o.id AS org_id,
    LEFT(
      COALESCE(
        NULLIF(
          regexp_replace(
            COALESCE(
              (regexp_split_to_array(trim(upper(COALESCE(o.settings ->> 'patient_id_prefix', ''))), '[-_\s]+'))[1],
              ''
            ),
            '[^A-Z0-9]',
            '',
            'g'
          ),
          ''
        ),
        NULLIF(
          regexp_replace(
            COALESCE(
              (regexp_split_to_array(trim(upper(COALESCE(o.org_code::text, ''))), '[-_]+'))[1],
              ''
            ),
            '[^A-Z0-9]',
            '',
            'g'
          ),
          ''
        ),
        upper(substring(COALESCE(o.name, 'ORG') FROM 1 FOR 3))
      ),
      8
    ) AS base_prefix
  FROM organizations o
  INNER JOIN orgs_touched t ON t.organization_id = o.id
),
org_ranked AS (
  SELECT
    org_id,
    base_prefix,
    row_number() OVER (
      PARTITION BY base_prefix
      ORDER BY org_id
    ) - 1 AS rank
  FROM org_effective
),
org_display_prefix AS (
  SELECT
    org_id,
    base_prefix || CASE WHEN rank = 0 THEN '' ELSE rank::text END AS display_prefix
  FROM org_ranked
),
ordered AS (
  SELECT
    p.id,
    p.organization_id,
    row_number() OVER (
      PARTITION BY p.organization_id
      ORDER BY COALESCE(p.sent_to_pharmacy_at, p.created_at) ASC
    ) AS rn
  FROM prescriptions p
  WHERE p.prescription_number IS NULL
),
with_prefix AS (
  SELECT
    o.id AS prescription_id,
    COALESCE(odp.display_prefix, 'ORG') || '-RX-' || lpad(o.rn::text, 4, '0') AS num
  FROM ordered o
  JOIN org_display_prefix odp ON odp.org_id = o.organization_id
)
UPDATE prescriptions p
SET prescription_number = wp.num
FROM with_prefix wp
WHERE p.id = wp.prescription_id;
