-- ============================================
-- Find Information About "Shak Medical Consult" Registrant
-- ============================================

-- Query 1: Check if there's an orphaned Auth user (created but no profile)
-- Note: This queries auth.users which may require admin access
SELECT 
  au.id as auth_user_id,
  au.email as auth_email,
  au.created_at as auth_created_at,
  au.last_sign_in_at,
  au.raw_user_meta_data->>'username' as username_from_auth,
  '❌ Orphaned Auth user - no profile in users table' as status
FROM auth.users au
LEFT JOIN public.users u ON u.auth_user_id = au.id
WHERE u.id IS NULL
  AND (
    au.email ILIKE '%shak%'
    OR au.raw_user_meta_data->>'username' ILIKE '%shak%'
    OR au.created_at::date = '2025-12-24'
  )
ORDER BY au.created_at DESC
LIMIT 10;

-- Query 2: Check if username "Dr shak" exists anywhere (case variations)
SELECT 
  'users table' as source,
  id,
  username,
  email,
  first_name,
  last_name,
  phone,
  role,
  organization_id,
  created_at
FROM users
WHERE username ILIKE '%shak%'
   OR email ILIKE '%shak%'
ORDER BY created_at DESC;

-- Query 3: Check organizations created around the same time
-- (to see if there's a pattern of failures)
SELECT 
  o.id,
  o.name,
  o.created_at,
  o.created_by,
  o.email,
  COUNT(u.id) as user_count,
  CASE 
    WHEN COUNT(u.id) = 0 THEN '❌ No users'
    ELSE '✅ Has users'
  END as status
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
WHERE o.created_at BETWEEN '2025-12-23' AND '2025-12-25'
GROUP BY o.id, o.name, o.created_at, o.created_by, o.email
ORDER BY o.created_at DESC;

-- Query 4: Check for any users with similar username pattern
-- (in case username was slightly different)
SELECT 
  u.id,
  u.username,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.role,
  u.created_at,
  o.name as organization_name
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.username ILIKE '%dr%shak%'
   OR u.username ILIKE '%shak%'
   OR u.email ILIKE '%shak%'
ORDER BY u.created_at DESC;

