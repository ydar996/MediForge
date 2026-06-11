-- SQL Query to Check for Orphaned Patients for Vortexshpere Global Limited
-- Organization Details:
-- - UUID: 9f91aa7e-cee9-414b-820b-f71cdfd2f259
-- - Name: Vortexshpere Global Limited
-- - Org Code: ORGJYA32DNP
-- - Country: Nigeria
-- - Status: active

-- ============================================
-- Step 1: Verify Organization Exists
-- ============================================
SELECT 
  id,
  name,
  org_code,
  country,
  status,
  created_at
FROM organizations
WHERE id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'
   OR name = 'Vortexshpere Global Limited'
   OR name = 'Vortexsphere Global Limited'
   OR org_code = 'ORGJYA32DNP';

-- ============================================
-- Step 2: Find Orphaned Patients
-- (Patients with organization_id = org name instead of UUID)
-- ============================================
SELECT 
  id,
  patient_id,
  first_name,
  last_name,
  organization_id as wrong_org_id,
  created_at,
  '9f91aa7e-cee9-414b-820b-f71cdfd2f259' as correct_org_id
FROM patients
WHERE organization_id = 'Vortexshpere Global Limited'
   OR organization_id = 'Vortexsphere Global Limited'
ORDER BY created_at DESC;

-- ============================================
-- Step 3: Count Orphaned Patients
-- ============================================
SELECT 
  COUNT(*) as orphaned_count,
  organization_id
FROM patients
WHERE organization_id = 'Vortexshpere Global Limited'
   OR organization_id = 'Vortexsphere Global Limited'
GROUP BY organization_id;

-- ============================================
-- Step 4: Find Correctly Associated Patients
-- ============================================
SELECT 
  id,
  patient_id,
  first_name,
  last_name,
  organization_id,
  created_at
FROM patients
WHERE organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'
ORDER BY created_at DESC;

-- ============================================
-- Step 5: Fix Orphaned Patients (UNCOMMENT TO RUN)
-- ============================================
-- UPDATE patients
-- SET organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'
-- WHERE organization_id = 'Vortexshpere Global Limited'
--    OR organization_id = 'Vortexsphere Global Limited';

-- ============================================
-- Step 6: Verify Fix (After running Step 5)
-- ============================================
-- SELECT 
--   COUNT(*) as total_patients,
--   organization_id
-- FROM patients
-- WHERE organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'
-- GROUP BY organization_id;








