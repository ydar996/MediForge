-- ============================================
-- Recover Pending Organizations
-- ============================================
-- Purpose: Find organizations stuck in 'pending' status
--          and either activate them (if user exists) or clean them up
-- ============================================

-- Step 1: Find pending organizations with admin users (should be activated)
SELECT 
  o.id,
  o.name,
  o.created_at,
  o.created_by,
  o.status,
  COUNT(u.id) FILTER (WHERE u.role = 'Admin') as admin_count,
  COUNT(u.id) as total_users,
  'Should be activated' as action
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
WHERE o.status = 'pending'
GROUP BY o.id, o.name, o.created_at, o.created_by, o.status
HAVING COUNT(u.id) FILTER (WHERE u.role = 'Admin') > 0;

-- Step 2: Activate pending organizations that have admin users
UPDATE organizations o
SET 
  status = 'active',
  updated_at = NOW()
WHERE o.status = 'pending'
  AND EXISTS (
    SELECT 1 
    FROM users u 
    WHERE u.organization_id = o.id 
    AND u.role = 'Admin'
  );

-- Step 3: Find pending organizations without admin users (should be cleaned up)
SELECT 
  o.id,
  o.name,
  o.created_at,
  o.created_by,
  o.status,
  COUNT(u.id) as total_users,
  CASE 
    WHEN o.created_at < NOW() - INTERVAL '24 hours' THEN 'Delete (older than 24 hours)'
    ELSE 'Keep for recovery (recent)'
  END as action
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
WHERE o.status = 'pending'
GROUP BY o.id, o.name, o.created_at, o.created_by, o.status
HAVING COUNT(u.id) FILTER (WHERE u.role = 'Admin') = 0
ORDER BY o.created_at DESC;

-- Step 4: Delete pending organizations older than 24 hours without users
-- (Uncomment to run - be careful!)
-- DELETE FROM organizations
-- WHERE status = 'pending'
--   AND created_at < NOW() - INTERVAL '24 hours'
--   AND NOT EXISTS (
--     SELECT 1 
--     FROM users u 
--     WHERE u.organization_id = organizations.id
--   );

-- ============================================
-- Verification: Check final status
-- ============================================
SELECT 
  status,
  COUNT(*) as count
FROM organizations
GROUP BY status
ORDER BY status;

