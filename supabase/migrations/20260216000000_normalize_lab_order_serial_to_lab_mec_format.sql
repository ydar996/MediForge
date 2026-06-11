-- Retroactive fix: Normalize lab/imaging order serial numbers from LAB-XXX to LAB-MEC-XXX format
-- Applies to: orders table (serial_number), billing_invoices (notes that reference lab orders)
-- Run in DEV first, then staging and prod. Does NOT disrupt existing lab orders, test results, or order status.

-- =============================================================================
-- 1. ORDERS: Update serial_number from LAB-XXX / IMG-XXX to LAB-{ORG}-XXX
-- =============================================================================
-- Get org prefix from organization name (first 3 chars), fallback to MEC
UPDATE orders o
SET serial_number = 
  CASE 
    WHEN o.serial_number ~ '^LAB-(\d+)$' THEN 
      'LAB-' || COALESCE(UPPER(LEFT(org.name, 3)), 'MEC') || '-' || LPAD(SUBSTRING(o.serial_number FROM '^LAB-(\d+)$'), 3, '0')
    WHEN o.serial_number ~ '^IMG-(\d+)$' THEN 
      'IMG-' || COALESCE(UPPER(LEFT(org.name, 3)), 'MEC') || '-' || LPAD(SUBSTRING(o.serial_number FROM '^IMG-(\d+)$'), 3, '0')
    ELSE o.serial_number
  END,
  updated_at = now()
FROM organizations org
WHERE o.organization_id = org.id
  AND o.deleted_at IS NULL
  AND (o.serial_number ~ '^LAB-(\d+)$' OR o.serial_number ~ '^IMG-(\d+)$');

-- Handle orders with no matching org (orphaned) - use MEC as fallback
UPDATE orders o
SET serial_number = 
  CASE 
    WHEN o.serial_number ~ '^LAB-(\d+)$' THEN 
      'LAB-MEC-' || LPAD(SUBSTRING(o.serial_number FROM '^LAB-(\d+)$'), 3, '0')
    WHEN o.serial_number ~ '^IMG-(\d+)$' THEN 
      'IMG-MEC-' || LPAD(SUBSTRING(o.serial_number FROM '^IMG-(\d+)$'), 3, '0')
    ELSE o.serial_number
  END,
  updated_at = now()
WHERE o.deleted_at IS NULL
  AND (o.serial_number ~ '^LAB-(\d+)$' OR o.serial_number ~ '^IMG-(\d+)$')
  AND o.organization_id IS NULL;

-- CATCH-ALL: Any order that STILL has old format (e.g. org_id didn't match, or case variation)
-- Uses case-insensitive matching (~*) in case serial was stored as 'lab-069'
UPDATE orders o
SET serial_number = 
  CASE 
    WHEN o.serial_number ~* '^LAB-(\d+)$' THEN 
      'LAB-MEC-' || LPAD((regexp_match(o.serial_number, '^LAB-(\d+)$', 'i'))[1], 3, '0')
    WHEN o.serial_number ~* '^IMG-(\d+)$' THEN 
      'IMG-MEC-' || LPAD((regexp_match(o.serial_number, '^IMG-(\d+)$', 'i'))[1], 3, '0')
    ELSE o.serial_number
  END,
  updated_at = now()
WHERE o.deleted_at IS NULL
  AND (o.serial_number ~* '^LAB-(\d+)$' OR o.serial_number ~* '^IMG-(\d+)$')
  AND o.serial_number !~ '^LAB-[A-Z]{2,4}-\d+$'  -- Exclude already-updated
  AND o.serial_number !~ '^IMG-[A-Z]{2,4}-\d+$';

-- =============================================================================
-- 2. BILLING_INVOICES: Update notes that reference old LAB-XXX / IMG-XXX format
-- =============================================================================
-- Match "Invoice for Lab Order LAB-069" or "Invoice for Lab Order IMG-012"
-- Replace with LAB-{ORG}-069 / IMG-{ORG}-012 using org from invoice's organization_id
UPDATE billing_invoices bi
SET notes = sub.new_notes
FROM (
  SELECT 
    bi2.id AS inv_id,
    REGEXP_REPLACE(
      bi2.notes,
      '(Invoice for Lab Order )(LAB|IMG)-(\d+)(\s|$)',
      '\1\2-' || COALESCE(UPPER(LEFT(org.name, 3)), 'MEC') || '-' || LPAD(COALESCE((regexp_match(bi2.notes, 'Invoice for Lab Order (LAB|IMG)-(\d+)'))[2], '0'), 3, '0') || '\4',
      'g'
    ) AS new_notes
  FROM billing_invoices bi2
  LEFT JOIN organizations org ON org.id = bi2.organization_id
  WHERE bi2.notes IS NOT NULL
    AND bi2.notes ~ 'Invoice for Lab Order (LAB|IMG)-(\d+)(\s|$)'
) sub
WHERE bi.id = sub.inv_id;
