-- Check if RLS is enabled on tables
SELECT 
  tablename, 
  CASE WHEN rowsecurity THEN 'Enabled' ELSE 'Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('organizations', 'users', 'patients', 'appointments')
ORDER BY tablename;

-- Check existing policies
SELECT 
  tablename, 
  policyname, 
  ARRAY_TO_STRING(roles, ', ') as roles,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;



