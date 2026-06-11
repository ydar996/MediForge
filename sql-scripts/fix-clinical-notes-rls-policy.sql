-- Fix Row Level Security policy for clinical_notes table
-- Run this in Supabase SQL Editor

-- First, check if RLS is enabled and what policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'clinical_notes';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access clinical notes for their organization" ON clinical_notes;

-- Create a new policy that allows authenticated users to access clinical notes
-- for their organization
CREATE POLICY "clinical_notes_organization_access" ON clinical_notes
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations 
            WHERE id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
    );

-- Alternative: If the above doesn't work, create a more permissive policy
-- (Remove the comment markers to use this instead)
/*
DROP POLICY IF EXISTS "clinical_notes_organization_access" ON clinical_notes;

CREATE POLICY "clinical_notes_authenticated_access" ON clinical_notes
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
*/

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'clinical_notes';


