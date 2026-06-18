-- Portal lab/imaging orders: order_sent when sent; awaiting_review when results return; published after provider review.

ALTER TABLE orders ALTER COLUMN portal_results_status SET DEFAULT 'order_sent';

COMMENT ON COLUMN orders.portal_results_status IS
  'order_sent | awaiting_review (results back) | published (provider reviewed — patient may view results)';

UPDATE orders
SET portal_results_status = 'order_sent'
WHERE type IN ('lab', 'imaging')
  AND portal_results_published_at IS NULL
  AND provider_reviewed_at IS NULL
  AND completed_at IS NULL
  AND lower(trim(coalesce(lab_status, ''))) NOT IN ('completed', 'complete')
  AND lower(trim(coalesce(status, ''))) NOT IN ('completed', 'complete')
  AND COALESCE(portal_results_status, 'not_started') IN ('not_started', 'reviewed', 'awaiting_review');

UPDATE orders
SET portal_results_status = 'awaiting_review'
WHERE type IN ('lab', 'imaging')
  AND portal_results_published_at IS NULL
  AND provider_reviewed_at IS NULL
  AND (
    completed_at IS NOT NULL
    OR lower(trim(coalesce(lab_status, ''))) IN ('completed', 'complete')
    OR lower(trim(coalesce(status, ''))) IN ('completed', 'complete')
  );

UPDATE orders
SET portal_results_status = 'published',
    portal_results_published_at = COALESCE(portal_results_published_at, provider_reviewed_at, NOW())
WHERE type IN ('lab', 'imaging')
  AND provider_reviewed_at IS NOT NULL
  AND portal_results_published_at IS NULL;