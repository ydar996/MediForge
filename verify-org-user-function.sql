-- Verify the get_organization_users function was created correctly
-- Run this in Supabase SQL Editor to check

-- 1. Check if function exists and see its definition
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_organization_users';

-- 2. Test the function with a sample organization ID
-- Replace 'YOUR_ORG_ID_HERE' with an actual organization ID from your database
-- First, get an organization ID:
SELECT id, name FROM organizations LIMIT 5;

-- Then test the function (replace with actual org ID):
-- SELECT * FROM get_organization_users('YOUR_ORG_ID_HERE');

-- 3. Check if there are users in organizations
SELECT 
    o.name as organization_name,
    COUNT(u.id) as user_count
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY user_count DESC;




















