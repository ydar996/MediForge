-- Reassign standalone Hepatitis B Surface Antigen (HBsAg) lab orders to Hepatitis B Profile panel.
-- Applies across: lab orders (selected_items + results), billing invoice line items, and result key mapping.
-- The standalone test "Hepatitis B Surface Antigen (HBsAg)" (CPT 87340) has been replaced by
-- a single orderable test "Hepatitis B Profile" with 5 sub-tests (HBsAg, HBsAb, HBeAg, HBeAb, HBcAb).

-- =============================================================================
-- 1. LAB ORDERS: Update selected_items from old HBsAg to Hepatitis B Profile
-- =============================================================================
UPDATE orders o
SET selected_items = '[{"name":"Hepatitis B Profile","cpt":"87340/86706/87350/86707/86704"}]'::jsonb,
    updated_at = now()
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND (
    o.selected_items::text ILIKE '%Hepatitis B Surface Antigen (HBsAg)%'
    OR (jsonb_array_length(COALESCE(o.selected_items, '[]'::jsonb)) = 1
        AND (o.selected_items->0->>'name') = 'Hepatitis B Surface Antigen (HBsAg)')
  );

-- =============================================================================
-- 2. LAB RESULTS: Copy existing HBsAg results into Hepatitis B Profile key
--    (App maps legacy hbsag_result -> hbsag and Reactive/Non-Reactive -> Positive/Negative for display)
-- =============================================================================
UPDATE orders o
SET results = jsonb_set(
  COALESCE(o.results, '{}'::jsonb),
  '{Hepatitis B Profile}',
  COALESCE(o.results->'Hepatitis B Surface Antigen (HBsAg)', '{}'::jsonb)
),
updated_at = now()
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND o.results ? 'Hepatitis B Surface Antigen (HBsAg)'
  AND NOT (o.results ? 'Hepatitis B Profile');

-- =============================================================================
-- 3. BILLING: Update invoice line items so patient billing history shows Hepatitis B Profile
--    (Existing invoices that had "Hepatitis B Surface Antigen (HBsAg)" / LAB - 87340 become Hepatitis B Profile)
-- =============================================================================
UPDATE billing_invoice_services bis
SET service_code = 'LAB - 87340/86706/87350/86707/86704',
    service_name = 'Hepatitis B Profile'
WHERE bis.service_code = 'LAB - 87340'
   OR bis.service_name = 'Hepatitis B Surface Antigen (HBsAg)';
