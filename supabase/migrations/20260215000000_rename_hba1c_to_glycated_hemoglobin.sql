-- Rename Hemoglobin A1c (HbA1c) to Glycated Hemoglobin (HbA1c) across the entire system.
-- Same test (CPT 83036), display name change only. Applies to orders, results, and billing.

-- =============================================================================
-- 1. LAB ORDERS: Update selected_items from "Hemoglobin A1c (HbA1c)" to "Glycated Hemoglobin (HbA1c)"
-- =============================================================================
UPDATE orders o
SET selected_items = sub.new_items,
    updated_at = now()
FROM (
  SELECT
    o2.id,
    COALESCE(
      (SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(elem) = 'string' AND elem #>> '{}' = 'Hemoglobin A1c (HbA1c)' THEN to_jsonb('Glycated Hemoglobin (HbA1c)'::text)
          WHEN jsonb_typeof(elem) = 'object' AND elem->>'name' = 'Hemoglobin A1c (HbA1c)' THEN
            jsonb_build_object('name', 'Glycated Hemoglobin (HbA1c)', 'cpt', COALESCE(elem->>'cpt', '83036'))
          ELSE elem
        END
        ORDER BY ord
      ) FROM jsonb_array_elements(COALESCE(o2.selected_items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)),
      '[]'::jsonb
    ) AS new_items
  FROM orders o2
  WHERE o2.type = 'lab'
    AND o2.selected_items IS NOT NULL
    AND o2.selected_items::text ILIKE '%Hemoglobin A1c (HbA1c)%'
) sub
WHERE o.id = sub.id;

-- =============================================================================
-- 2. LAB RESULTS: Rename key from "Hemoglobin A1c (HbA1c)" to "Glycated Hemoglobin (HbA1c)"
-- =============================================================================
UPDATE orders
SET results = (
  results - 'Hemoglobin A1c (HbA1c)'
) || jsonb_build_object(
  'Glycated Hemoglobin (HbA1c)',
  COALESCE(results->'Glycated Hemoglobin (HbA1c)', results->'Hemoglobin A1c (HbA1c)')
),
updated_at = now()
WHERE type = 'lab'
  AND results IS NOT NULL
  AND results ? 'Hemoglobin A1c (HbA1c)';

-- =============================================================================
-- 3. BILLING: Update invoice line items so patient billing history shows Glycated Hemoglobin (HbA1c)
--    (service_code LAB - 83036 stays the same)
-- =============================================================================
UPDATE billing_invoice_services
SET service_name = 'Glycated Hemoglobin (HbA1c)'
WHERE service_name = 'Hemoglobin A1c (HbA1c)';
