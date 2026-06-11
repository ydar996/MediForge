-- ============================================
-- Find Organization Contact Information
-- ============================================
-- Purpose: Retrieve contact details for a specific organization
--          including admin user information
-- 
-- Usage: Replace 'Shak Medical Consult' with the organization name
-- ============================================

-- Find organization and admin contact information
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  o.org_code,
  o.email as organization_email,
  o.phone as organization_phone,
  o.after_hours_phone,
  o.country,
  o.state,
  o.city,
  o.address_line1,
  o.address_line2,
  o.created_at as organization_created_at,
  o.created_by as created_by_username,
  -- Admin user information
  u.id as admin_user_id,
  u.username as admin_username,
  u.email as admin_email,
  u.first_name || ' ' || u.last_name as admin_full_name,
  u.phone as admin_phone,
  u.role as admin_role,
  u.created_at as admin_created_at
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'Admin'
WHERE o.name ILIKE '%Shak Medical Consult%'
ORDER BY u.created_at ASC
LIMIT 5;

-- Alternative: Find by registration date (December 23, 2025)
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  o.org_code,
  o.email as organization_email,
  o.phone as organization_phone,
  o.created_at as organization_created_at,
  o.created_by as created_by_username,
  u.username as admin_username,
  u.email as admin_email,
  u.first_name || ' ' || u.last_name as admin_full_name,
  u.phone as admin_phone
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'Admin'
WHERE DATE(o.created_at) = '2025-12-23'
ORDER BY o.created_at DESC;

-- ============================================
-- Notes:
-- - First query searches by organization name (case-insensitive)
-- - Second query finds all organizations registered on Dec 23, 2025
-- - Admin email is the contact email (generated as username-{shortOrgId}@mediforge.app)
-- - If organization.email is NULL, run backfill-organization-emails.sql first
-- ============================================

