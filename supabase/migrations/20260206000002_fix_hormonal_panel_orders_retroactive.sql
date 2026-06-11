-- Retroactive fix: Hormonal Profile panel orders with empty/wrong selected_items or partial in-process
-- Run in DEV first, then staging and prod. Fixes LAB-MEC-678 and similar orders.

-- Hormonal panel test names (must match LAB_PANEL_TEST_NAMES in app)
-- Panel: Hormonal Profile (Panel); subtests: Prolactin, Testosterone (Total), FSH, LH, Progesterone

-- 1. Backfill selected_items for lab orders that have hormonal results but empty or single-panel selected_items
UPDATE orders o
SET selected_items = '[
  {"name":"Prolactin"},
  {"name":"Testosterone (Total)"},
  {"name":"Follicle Stimulating Hormone (FSH)"},
  {"name":"Luteinizing Hormone (LH)"},
  {"name":"Progesterone"}
]'::jsonb
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND (
    o.results ? 'Prolactin'
    OR o.results ? 'Hormonal Profile (Panel)'
    OR o.results ? 'Testosterone (Total)'
    OR o.results ? 'Follicle Stimulating Hormone (FSH)'
    OR o.results ? 'Luteinizing Hormone (LH)'
    OR o.results ? 'Progesterone'
  )
  AND (
    o.selected_items IS NULL
    OR o.selected_items = '[]'::jsonb
    OR jsonb_array_length(COALESCE(o.selected_items, '[]'::jsonb)) = 0
    OR (
      jsonb_array_length(o.selected_items) = 1
      AND (
        (o.selected_items->0->>'name') = 'Hormonal Profile (Panel)'
        OR jsonb_typeof(o.selected_items->0) = 'string' AND (o.selected_items->>0) = 'Hormonal Profile (Panel)'
      )
    )
  );

-- 2. Where any hormonal key is in-process, set ALL panel keys to in-process (so order appears in In Process tab with full list)
UPDATE orders o
SET results = o.results
  || jsonb_build_object(
    'Hormonal Profile (Panel)', (COALESCE(o.results->'Hormonal Profile (Panel)', '{}'::jsonb) || '{"status":"in-process"}'::jsonb),
    'Prolactin', (COALESCE(o.results->'Prolactin', '{}'::jsonb) || '{"status":"in-process"}'::jsonb),
    'Testosterone (Total)', (COALESCE(o.results->'Testosterone (Total)', '{}'::jsonb) || '{"status":"in-process"}'::jsonb),
    'Follicle Stimulating Hormone (FSH)', (COALESCE(o.results->'Follicle Stimulating Hormone (FSH)', '{}'::jsonb) || '{"status":"in-process"}'::jsonb),
    'Luteinizing Hormone (LH)', (COALESCE(o.results->'Luteinizing Hormone (LH)', '{}'::jsonb) || '{"status":"in-process"}'::jsonb),
    'Progesterone', (COALESCE(o.results->'Progesterone', '{}'::jsonb) || '{"status":"in-process"}'::jsonb)
  ),
  status = 'in-process',
  lab_status = 'in-process',
  in_process_at = COALESCE(o.in_process_at, now()),
  updated_at = now()
WHERE o.type = 'lab'
  AND o.deleted_at IS NULL
  AND o.results IS NOT NULL
  AND (
    (o.results->'Prolactin'->>'status') IN ('in-process', 'in process', 'in_progress')
    OR (o.results->'Hormonal Profile (Panel)'->>'status') IN ('in-process', 'in process', 'in_progress')
    OR (o.results->'Testosterone (Total)'->>'status') IN ('in-process', 'in process', 'in_progress')
    OR (o.results->'Follicle Stimulating Hormone (FSH)'->>'status') IN ('in-process', 'in process', 'in_progress')
    OR (o.results->'Luteinizing Hormone (LH)'->>'status') IN ('in-process', 'in process', 'in_progress')
    OR (o.results->'Progesterone'->>'status') IN ('in-process', 'in process', 'in_progress')
  );
