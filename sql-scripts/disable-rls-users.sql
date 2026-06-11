-- ============================================
-- DISABLE RLS ON USERS TABLE
-- ============================================
-- Purpose: Allow platform admin to see user counts
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';

-- Should show rowsecurity = false

-- ============================================
-- ✅ RLS DISABLED ON USERS TABLE
-- Now refresh the platform dashboard
-- You should see user counts appear!
-- ============================================

-- ============================================
-- AFTER VERIFICATION: RE-ENABLE RLS (OPTIONAL)
-- ============================================
-- If you want to re-enable RLS later for security:
--
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Users can read all profiles"
-- ON users FOR SELECT TO authenticated
-- USING (true);
--
-- CREATE POLICY "Users can update own profile"
-- ON users FOR UPDATE TO authenticated
-- USING (auth_user_id = auth.uid());
-- ============================================



