-- ============================================
-- Create Initial Organization for Migration
-- ============================================
-- Purpose: Create the first organization so we can migrate users to it
-- Run this in: Supabase Dashboard → SQL Editor
-- 
-- NOTE: This bypasses RLS (which is currently blocking us)
-- ============================================

-- Step 1: Check if organization already exists
SELECT id, name, org_code, country 
FROM organizations 
WHERE name = 'Mecure Clinics';

-- If the above returns no rows, proceed with Step 2:

-- Step 2: Create the organization
INSERT INTO organizations (
  name,
  country,
  currency,
  org_code,
  status,
  subscription_plan,
  subscription_status,
  trial_ends_at,
  max_users,
  max_patients
) VALUES (
  'Mecure Clinics',                           -- Organization name
  'Nigeria',                                   -- Country
  'NGN',                                       -- Currency
  'MEC-' || TO_CHAR(NOW(), 'YYYYMMDD'),      -- Auto-generate org code: MEC-20251014
  'active',                                    -- Status
  'free_trial',                                -- Subscription plan
  'active',                                    -- Subscription status
  NOW() + INTERVAL '30 days',                  -- Trial ends in 30 days
  10,                                          -- Max users allowed
  100                                          -- Max patients allowed
)
RETURNING id, name, org_code, country, currency;

-- Step 3: Verify the organization was created
SELECT 
  id,
  name,
  org_code,
  country,
  currency,
  status,
  subscription_plan,
  created_at
FROM organizations
WHERE name = 'Mecure Clinics';

-- ============================================
-- SUCCESS!
-- Copy the organization ID from the result above
-- You'll need it for user migration
-- ============================================



