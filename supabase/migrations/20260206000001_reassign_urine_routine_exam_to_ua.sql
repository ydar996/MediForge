-- Reassign Urinalysis (Urine Routine Examination) to Urinalysis (UA)
-- Urine Routine Examination is archived; all orders and results use UA (same test, CPT 81001).
-- Run in DEV first, then staging and prod.

-- 1. Update selected_items: replace "Urinalysis (Urine Routine Examination)" with "Urinalysis (UA)"
UPDATE orders o
SET selected_items = sub.new_items
FROM (
  SELECT
    o2.id,
    COALESCE(
      (SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(elem) = 'string' AND elem #>> '{}' = 'Urinalysis (Urine Routine Examination)' THEN to_jsonb('Urinalysis (UA)'::text)
          WHEN jsonb_typeof(elem) = 'object' AND elem->>'name' = 'Urinalysis (Urine Routine Examination)' THEN
            jsonb_build_object('name', 'Urinalysis (UA)', 'cpt', COALESCE(elem->>'cpt', '81001'))
          ELSE elem
        END
        ORDER BY ord
      ) FROM jsonb_array_elements(COALESCE(o2.selected_items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)),
      '[]'::jsonb
    ) AS new_items
  FROM orders o2
  WHERE o2.type = 'lab'
    AND o2.selected_items IS NOT NULL
    AND o2.selected_items::text ILIKE '%Urinalysis (Urine Routine Examination)%'
) sub
WHERE o.id = sub.id;

-- 2. Update results: move "Urinalysis (Urine Routine Examination)" data to "Urinalysis (UA)" and remove URE key
UPDATE orders
SET results = (
  results - 'Urinalysis (Urine Routine Examination)'
) || jsonb_build_object(
  'Urinalysis (UA)',
  COALESCE(results->'Urinalysis (UA)', results->'Urinalysis (Urine Routine Examination)')
)
WHERE type = 'lab'
  AND results IS NOT NULL
  AND results ? 'Urinalysis (Urine Routine Examination)';
