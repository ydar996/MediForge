-- ============================================
-- VERIFY RLS POLICY INCLUDES ALL ROLE VARIATIONS
-- ============================================
-- Purpose: Check if the policy includes "Platform administrator"
-- ============================================

-- Check the actual policy definition
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'legal_agreements'
AND policyname = 'Platform admins can view all legal agreements';

-- Also check the policy definition from pg_policy table
SELECT 
    pol.polname AS policy_name,
    pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
WHERE pc.relname = 'legal_agreements'
AND pol.polname = 'Platform admins can view all legal agreements';






