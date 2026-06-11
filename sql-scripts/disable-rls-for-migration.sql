-- ============================================
-- DISABLE RLS FOR MIGRATION
-- ============================================
-- Purpose: Temporarily disable RLS to allow migration
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- IMPORTANT: Re-enable RLS after migration is complete!
-- ============================================

-- Disable RLS on patients table
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- Disable RLS on appointments table  
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

-- Add unique constraint for appointments if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointments_org_appt_id_unique'
  ) THEN
    ALTER TABLE appointments 
    ADD CONSTRAINT appointments_org_appt_id_unique 
    UNIQUE (organization_id, appointment_id);
  END IF;
END $$;

-- Verify RLS is disabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('patients', 'appointments');

-- Should show rowsecurity = false for both tables

-- ============================================
-- ✅ RLS DISABLED - NOW RUN MIGRATION
-- Go to: https://mediforge.netlify.app/migrate-to-supabase.html
-- ============================================

-- ============================================
-- AFTER MIGRATION: RUN THIS TO RE-ENABLE RLS
-- ============================================
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- ============================================



