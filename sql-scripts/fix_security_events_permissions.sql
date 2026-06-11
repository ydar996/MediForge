-- Fix security_events table permissions
-- Run this in your Supabase SQL Editor to fix the permission issues

-- Drop existing policies that are causing permission errors
DROP POLICY IF EXISTS "Platform admins can view all security events" ON security_events;
DROP POLICY IF EXISTS "Users can view their organization security events" ON security_events;
DROP POLICY IF EXISTS "Allow inserting security events" ON security_events;

-- Temporarily disable RLS for testing (can be re-enabled later)
ALTER TABLE security_events DISABLE ROW LEVEL SECURITY;

-- Alternative: Create simple policies that work
-- Uncomment these if you want to keep RLS enabled:

-- ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
-- 
-- -- Allow all authenticated users to view security events
-- CREATE POLICY "Allow authenticated users to view security events" ON security_events
--   FOR SELECT USING (auth.role() = 'authenticated');
-- 
-- -- Allow all authenticated users to insert security events
-- CREATE POLICY "Allow authenticated users to insert security events" ON security_events
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Test query to verify permissions
SELECT COUNT(*) as total_events FROM security_events;






