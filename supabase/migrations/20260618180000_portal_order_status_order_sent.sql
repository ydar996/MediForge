-- Correct portal order status: "Order Sent" until lab results return, then awaiting provider review.

ALTER TABLE orders ALTER COLUMN portal_results_status SET DEFAULT 'order_sent';

COMMENT ON COLUMN orders.portal_results_status IS
  'order_sent (sent to external lab/imaging) | awaiting_review (results back) | published (provider reviewed)';

-- Sent orders with no results back yet
UPDATE orders
SET portal_results_status = 'order_sent'
WHERE type IN ('lab', 'imaging')
  AND portal_results_published_at IS NULL
  AND provider_reviewed_at IS NULL
  AND completed_at IS NULL
  AND lower(trim(coalesce(lab_status, ''))) NOT IN ('completed', 'complete')
  AND lower(trim(coalesce(status, ''))) NOT IN ('completed', 'complete');

-- Results received, awaiting provider review
UPDATE orders
SET portal_results_status = 'awaiting_review'
WHERE type IN ('lab', 'imaging')
  AND portal_results_published_at IS NULL
  AND provider_reviewed_at IS NULL
  AND (
    completed_at IS NOT NULL
    OR lower(trim(coalesce(lab_status, ''))) IN ('completed', 'complete')
    OR lower(trim(coalesce(status, ''))) IN ('completed', 'complete')
    OR (
      results IS NOT NULL
      AND jsonb_typeof(results) = 'object'
      AND results <> '{}'::jsonb
    )
  );
