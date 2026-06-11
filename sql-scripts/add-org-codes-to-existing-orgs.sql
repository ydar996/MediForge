-- ============================================
-- ADD ORGANIZATION CODES TO EXISTING ORGANIZATIONS
-- ============================================
-- Purpose: Generate and assign org codes to existing organizations
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Update Eko Clinics
UPDATE organizations
SET org_code = 'EKO-2025-' || substr(md5(random()::text), 1, 4)
WHERE name = 'Eko Clinics' AND (org_code IS NULL OR org_code = '');

-- Update Mecure Clinics  
UPDATE organizations
SET org_code = 'MEC-2025-' || substr(md5(random()::text), 1, 4)
WHERE name = 'Mecure Clinics' AND (org_code IS NULL OR org_code = '');

-- Verify codes were added
SELECT name, org_code, country, created_at
FROM organizations
ORDER BY created_at;

-- ============================================
-- ✅ ORGANIZATION CODES ADDED!
-- Each organization now has a unique code like:
-- - EKO-2025-a4b2
-- - MEC-2025-c8d5
-- ============================================



