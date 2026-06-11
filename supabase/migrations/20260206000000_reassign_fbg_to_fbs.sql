-- Reassign Fasting Blood Glucose (FBG) to Fasting Blood Sugar (FBS)
-- FBG is archived; all orders, results, and references use FBS (same test, CPT 82947).
-- Run in DEV first.

-- 1. Update selected_items: replace "Fasting Blood Glucose (FBG)" with "Fasting Blood Sugar (FBS)"
--    (handles both string elements and object elements with .name)
UPDATE orders o
SET selected_items = sub.new_items
FROM (
  SELECT
    o2.id,
    COALESCE(
      (SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(elem) = 'string' AND elem #>> '{}' = 'Fasting Blood Glucose (FBG)' THEN to_jsonb('Fasting Blood Sugar (FBS)'::text)
          WHEN jsonb_typeof(elem) = 'object' AND elem->>'name' = 'Fasting Blood Glucose (FBG)' THEN
            jsonb_build_object('name', 'Fasting Blood Sugar (FBS)', 'cpt', COALESCE(elem->>'cpt', '82947'))
          ELSE elem
        END
        ORDER BY ord
      ) FROM jsonb_array_elements(COALESCE(o2.selected_items, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)),
      '[]'::jsonb
    ) AS new_items
  FROM orders o2
  WHERE o2.type = 'lab'
    AND o2.selected_items IS NOT NULL
    AND o2.selected_items::text ILIKE '%Fasting Blood Glucose (FBG)%'
) sub
WHERE o.id = sub.id;

-- 2. Update results: move "Fasting Blood Glucose (FBG)" data to "Fasting Blood Sugar (FBS)" and remove FBG key
UPDATE orders
SET results = (
  results - 'Fasting Blood Glucose (FBG)'
) || jsonb_build_object(
  'Fasting Blood Sugar (FBS)',
  COALESCE(results->'Fasting Blood Sugar (FBS)', results->'Fasting Blood Glucose (FBG)')
)
WHERE type = 'lab'
  AND results IS NOT NULL
  AND results ? 'Fasting Blood Glucose (FBG)';
