-- Nuclear option: Completely disable RLS for clinical_notes table
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "clinical_notes_organization_access" ON clinical_notes;
DROP POLICY IF EXISTS "clinical_notes_authenticated_access" ON clinical_notes;
DROP POLICY IF EXISTS "clinical_notes_authenticated_all" ON clinical_notes;
DROP POLICY IF EXISTS "Users can access clinical notes for their organization" ON clinical_notes;

-- Step 2: Completely disable RLS
ALTER TABLE clinical_notes DISABLE ROW LEVEL SECURITY;

-- Step 3: Grant ALL permissions to authenticated users
GRANT ALL ON clinical_notes TO authenticated;
GRANT ALL ON clinical_notes TO service_role;
GRANT ALL ON clinical_notes TO anon;

-- Step 4: Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'clinical_notes';

-- Step 5: Verify no policies exist
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE tablename = 'clinical_notes';


