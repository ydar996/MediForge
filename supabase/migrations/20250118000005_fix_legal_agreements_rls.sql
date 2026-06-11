-- ============================================
-- FIX LEGAL AGREEMENTS RLS FOR PLATFORM ADMINS
-- ============================================
-- Purpose: Ensure platform admins can view ALL legal agreements
-- ============================================

-- Drop existing platform admin policy if it exists
DROP POLICY IF EXISTS "Platform admins can view all legal agreements" ON legal_agreements;

-- Create policy: Platform admins can view ALL legal agreements (for compliance)
-- Note: This requires auth.uid() to be set (user must have Supabase auth session)
-- Supports multiple role format variations found in the database
CREATE POLICY "Platform admins can view all legal agreements" ON legal_agreements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_user_id = auth.uid() 
            AND role IN (
                'PlatformAdmin', 
                'PlatformOwner', 
                'Platform Admin', 
                'Platform Owner',
                'Platform administrator',
                'Platform owner'
            )
        )
    );

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'legal_agreements'
ORDER BY policyname;

