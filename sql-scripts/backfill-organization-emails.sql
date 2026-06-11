-- ============================================
-- Backfill Organization Emails from Admin Users
-- ============================================
-- Purpose: Update organizations.email with the admin user's email
--          for organizations that currently have NULL email
-- 
-- This ensures all organizations have a contact email address
-- that can be used to reach the organization administrator.
-- ============================================

-- Step 1: Update organizations with NULL email using the first Admin user's email
UPDATE organizations o
SET email = (
  SELECT u.email
  FROM users u
  WHERE u.organization_id = o.id
    AND u.role = 'Admin'
  ORDER BY u.created_at ASC
  LIMIT 1
)
WHERE o.email IS NULL OR o.email = '';

-- Step 2: Verify the update
SELECT 
  o.id,
  o.name,
  o.email,
  o.created_at,
  o.created_by,
  u.username as admin_username,
  u.email as admin_email,
  u.first_name || ' ' || u.last_name as admin_name,
  u.phone as admin_phone
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'Admin'
WHERE o.email IS NOT NULL AND o.email != ''
ORDER BY o.created_at DESC
LIMIT 20;

-- Step 3: Show organizations that still don't have email (should be 0 after fix)
SELECT 
  o.id,
  o.name,
  o.email,
  o.created_at,
  o.created_by,
  COUNT(u.id) as admin_count
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'Admin'
WHERE o.email IS NULL OR o.email = ''
GROUP BY o.id, o.name, o.email, o.created_at, o.created_by
ORDER BY o.created_at DESC;

-- ============================================
-- Notes:
-- - This script updates organizations.email with the email of the first Admin user
-- - If an organization has multiple Admin users, it uses the oldest one (first created)
-- - Organizations without Admin users will remain with NULL email (rare edge case)
-- - Run this script in Supabase SQL Editor to backfill existing organizations
-- ============================================

