-- ============================================
-- Update Shak Medical Consult Contact Information
-- ============================================
-- Purpose: Ensure all contact information is properly saved
-- ============================================

-- Step 1: Verify current data
SELECT 
  id,
  name,
  phone,
  after_hours_phone,
  email,
  country,
  state,
  city,
  address_line1,
  address_line2,
  created_at,
  created_by
FROM organizations
WHERE id = 'a4e73ea3-08c3-4696-9276-403032e1564c';

-- Step 2: Update to ensure all fields are properly set
-- (This is idempotent - safe to run multiple times)
UPDATE organizations
SET 
  phone = COALESCE(phone, '+234 7031815652'),
  country = COALESCE(country, 'Nigeria'),
  state = COALESCE(state, 'Kaduna'),
  city = COALESCE(city, 'Kaduna'),
  address_line1 = COALESCE(address_line1, 'Kaduna'),
  updated_at = NOW()
WHERE id = 'a4e73ea3-08c3-4696-9276-403032e1564c'
  AND (
    phone IS NULL 
    OR country IS NULL 
    OR state IS NULL 
    OR city IS NULL 
    OR address_line1 IS NULL
  );

-- Step 3: Verify update
SELECT 
  id,
  name,
  phone,
  after_hours_phone,
  email,
  country,
  state,
  city,
  address_line1,
  address_line2,
  created_at,
  updated_at,
  created_by,
  CASE 
    WHEN phone IS NOT NULL AND phone != '' THEN '✅ Phone'
    ELSE '❌ No Phone'
  END as phone_status,
  CASE 
    WHEN email IS NOT NULL AND email != '' THEN '✅ Email'
    ELSE '❌ No Email'
  END as email_status,
  CASE 
    WHEN address_line1 IS NOT NULL AND address_line1 != '' THEN '✅ Address'
    ELSE '❌ No Address'
  END as address_status
FROM organizations
WHERE id = 'a4e73ea3-08c3-4696-9276-403032e1564c';

-- ============================================
-- Note: Email will remain NULL until admin user is created
-- Once admin user is created, run:
-- UPDATE organizations SET email = (SELECT email FROM users WHERE organization_id = 'a4e73ea3-08c3-4696-9276-403032e1564c' AND role = 'Admin' LIMIT 1) WHERE id = 'a4e73ea3-08c3-4696-9276-403032e1564c';
-- ============================================

