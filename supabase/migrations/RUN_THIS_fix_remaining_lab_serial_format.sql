-- Run this if LAB-069 etc. still appear after the main migration.
-- Catches any orders that were missed (org_id mismatch, case variations, etc.)

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
  AND o.serial_number !~ '^LAB-[A-Z]{2,4}-\d+$'
  AND o.serial_number !~ '^IMG-[A-Z]{2,4}-\d+$';
