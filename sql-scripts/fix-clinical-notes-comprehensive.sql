-- Comprehensive fix for clinical_notes table access issues
-- Run this in Supabase SQL Editor

-- Step 1: Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'clinical_notes';

-- Step 2: Check existing policies
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

-- Step 3: Drop all existing policies
DROP POLICY IF EXISTS "clinical_notes_organization_access" ON clinical_notes;
DROP POLICY IF EXISTS "clinical_notes_authenticated_access" ON clinical_notes;
DROP POLICY IF EXISTS "Users can access clinical notes for their organization" ON clinical_notes;

-- Step 4: Temporarily disable RLS to test
ALTER TABLE clinical_notes DISABLE ROW LEVEL SECURITY;

-- Step 5: Grant explicit permissions
GRANT ALL ON clinical_notes TO authenticated;
GRANT ALL ON clinical_notes TO service_role;

-- Step 6: Re-enable RLS with a simple policy
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;

-- Step 7: Create a simple policy that allows all authenticated users
CREATE POLICY "clinical_notes_authenticated_all" ON clinical_notes
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Step 8: Verify the setup
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'clinical_notes';

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'clinical_notes';


