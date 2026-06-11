-- Collapse expanded Hormonal Profile (6 sub-tests including Estrogen E2) to single panel entry.
-- Complements 20260206000004 which handled the legacy 5-item format.
-- Safe to run multiple times (idempotent for already-collapsed).

UPDATE orders o
SET selected_items = '[
  {"name":"Hormonal Profile (Panel)","cpt":"84146/84403/83001/83002/82670/84144"}
]'::jsonb,
  updated_at = now()
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND jsonb_array_length(COALESCE(o.selected_items, '[]'::jsonb)) = 6
  AND (o.selected_items @> '[{"name":"Prolactin"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Testosterone (Total)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Follicle Stimulating Hormone (FSH)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Luteinizing Hormone (LH)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Estrogen (E2)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Progesterone"}]'::jsonb)
  AND (o.selected_items->0->>'name') IS NOT NULL
  AND (o.selected_items->0->>'name') <> 'Hormonal Profile (Panel)';
