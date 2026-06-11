-- Quick verification query to check the username constraint
-- Run this in Supabase SQL Editor to verify the migration worked

SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND (conname = 'users_username_key' OR conname = 'users_username_organization_unique')
ORDER BY conname;

-- Also check for any remaining duplicate usernames (should be 0)
SELECT 
  username,
  COUNT(*) as count
FROM users
GROUP BY username
HAVING COUNT(*) > 1;

