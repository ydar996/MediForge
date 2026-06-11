-- Optional: Collapse expanded panel selected_items to single panel entry for consistency.
-- Run after 20260206000002 and 20260206000003. Safe to run multiple times (idempotent for already-collapsed).
-- App already displays correctly via collapsePanelNamesForDisplay (lab intervention note) and
-- getDisplayItemsForOrder collapse (lab scientist dashboard); this migration normalizes stored data.

-- 1. Hormonal Profile: where selected_items is exactly the 5 sub-tests, set to single panel
UPDATE orders o
SET selected_items = '[
  {"name":"Hormonal Profile (Panel)","cpt":"84146/84403/83001/83002/84144"}
]'::jsonb,
  updated_at = now()
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND jsonb_array_length(COALESCE(o.selected_items, '[]'::jsonb)) = 5
  AND (o.selected_items @> '[{"name":"Prolactin"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Testosterone (Total)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Follicle Stimulating Hormone (FSH)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Luteinizing Hormone (LH)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Progesterone"}]'::jsonb)
  AND (o.selected_items->0->>'name') IS NOT NULL
  AND (o.selected_items->0->>'name') <> 'Hormonal Profile (Panel)';

-- 2. Hepatitis B Profile: where selected_items is exactly the 5 sub-tests, set to single panel
UPDATE orders o
SET selected_items = '[
  {"name":"Hepatitis B Profile","cpt":"87340/86706/87350/86707/86704"}
]'::jsonb,
  updated_at = now()
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND jsonb_array_length(COALESCE(o.selected_items, '[]'::jsonb)) = 5
  AND (o.selected_items @> '[{"name":"HBsAg (Hepatitis B Surface Antigen)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBsAb (Hepatitis B Surface Antibody)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBeAg (Hepatitis B e Antigen)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBeAb (Hepatitis B e Antibody)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBcAb (Hepatitis B Core Antibody)"}]'::jsonb)
  AND (o.selected_items->0->>'name') IS NOT NULL
  AND (o.selected_items->0->>'name') <> 'Hepatitis B Profile';

-- 3. Both panels expanded (10 items): set to [Hepatitis B Profile, Hormonal Profile (Panel)]
UPDATE orders o
SET selected_items = '[
  {"name":"Hepatitis B Profile","cpt":"87340/86706/87350/86707/86704"},
  {"name":"Hormonal Profile (Panel)","cpt":"84146/84403/83001/83002/84144"}
]'::jsonb,
  updated_at = now()
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND jsonb_array_length(COALESCE(o.selected_items, '[]'::jsonb)) = 10
  AND (o.selected_items @> '[{"name":"Prolactin"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Testosterone (Total)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Follicle Stimulating Hormone (FSH)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Luteinizing Hormone (LH)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"Progesterone"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBsAg (Hepatitis B Surface Antigen)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBsAb (Hepatitis B Surface Antibody)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBeAg (Hepatitis B e Antigen)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBeAb (Hepatitis B e Antibody)"}]'::jsonb)
  AND (o.selected_items @> '[{"name":"HBcAb (Hepatitis B Core Antibody)"}]'::jsonb);
