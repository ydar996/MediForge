-- ============================================
-- Create Initial Organization (FIXED VERSION)
-- ============================================
-- Purpose: Create the first organization so we can migrate users to it
-- Run this in: Supabase Dashboard → SQL Editor
-- 
-- This version only uses columns that exist in the basic schema
-- ============================================

-- Step 1: Check what columns exist (for verification)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations'
ORDER BY ordinal_position;

-- You should see the actual columns available

-- Step 2: Check if organization already exists
SELECT id, name, org_code, country 
FROM organizations 
WHERE name = 'Mecure Clinics';

-- If the above returns no rows, proceed with Step 3:

-- Step 3: Create the organization (using only basic columns)
INSERT INTO organizations (
  name,
  country,
  currency,
  org_code,
  status
) VALUES (
  'Mecure Clinics',                           -- Organization name
  'Nigeria',                                   -- Country
  'NGN',                                       -- Currency (Nigerian Naira)
  'MEC-' || TO_CHAR(NOW(), 'YYYYMMDD'),       -- Auto-generate org code: MEC-20251014
  'active'                                     -- Status
)
RETURNING id, name, org_code, country, currency, status, created_at;

-- Step 4: Verify the organization was created
SELECT 
  id,
  name,
  org_code,
  country,
  currency,
  status,
  created_at
FROM organizations
WHERE name = 'Mecure Clinics';

-- ============================================
-- SUCCESS!
-- Copy the organization ID from the result above
-- 
-- Organization ID: _____________________________
-- 
-- You'll need this for user migration in Step 2
-- ============================================



