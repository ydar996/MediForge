-- ============================================
-- FIND AND FIX ORPHANED PATIENTS FOR VORTEXSHPERE GLOBAL LIMITED
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================
-- Organization Details:
-- - UUID: 9f91aa7e-cee9-414b-820b-f71cdfd2f259
-- - Name: Vortexshpere Global Limited
-- - Org Code: ORGJYA32DNP
-- ============================================

-- ============================================
-- STEP 1: Verify Organization Exists
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
   OR org_code = 'ORGJYA32DNP';

-- Expected: Should return 1 row with organization details

-- ============================================
-- STEP 2: Check Column Type
-- ============================================
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'patients'
  AND column_name = 'organization_id';

-- This will show if organization_id is UUID or TEXT type

-- ============================================
-- STEP 3: Find All Patients for Vortexshpere Global Limited
-- (Check by correct UUID - CRITICAL: This is the Vortexshpere UUID)
-- ============================================
SELECT 
  id,
  patient_id,
  first_name || ' ' || last_name as patient_name,
  organization_id,
  created_at,
  created_by
FROM patients
WHERE organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'::uuid  -- Vortexshpere Global Limited
ORDER BY created_at DESC;

-- Expected: Shows all patients for Vortexshpere Global Limited
-- If empty, NO PATIENTS EXIST for Vortexshpere yet

-- Verify you're searching the right UUID:
SELECT 
  id,
  name,
  org_code,
  created_at
FROM organizations
WHERE id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'::uuid;
-- This should return: Vortexshpere Global Limited

-- ============================================
-- STEP 4: Find Patients with NULL organization_id
-- (Orphaned patients without organization)
-- ============================================
SELECT 
  id,
  patient_id,
  first_name || ' ' || last_name as patient_name,
  organization_id,
  created_at,
  created_by
FROM patients
WHERE organization_id IS NULL
ORDER BY created_at DESC;

-- Expected: Shows patients without organization association
-- These would be truly orphaned

-- ============================================
-- STEP 5: Find ALL Patients Created After 2025-01-15 (Registration Date)
-- (Check if any belong to Vortexshpere or are orphaned)
-- ============================================
SELECT 
  p.id,
  p.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  p.organization_id,
  o.name as organization_name,  -- Join to see org name
  p.created_at,
  p.created_by
FROM patients p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.created_at >= '2025-01-15'  -- After Vortexshpere registration
ORDER BY p.created_at DESC;

-- Expected: Shows ALL recent patients with their organization names
-- Look for patients with NULL organization_id or wrong organization

-- ============================================
-- STEP 5B: Find Patients Created After Registration with NULL or Wrong Org
-- ============================================
SELECT 
  p.id,
  p.patient_id,
  p.first_name || ' ' || p.last_name as patient_name,
  p.organization_id,
  p.created_at,
  p.created_by,
  CASE 
    WHEN p.organization_id IS NULL THEN 'MISSING ORG_ID'
    WHEN p.organization_id != '9f91aa7e-cee9-414b-820b-f71cdfd2f259'::uuid THEN 'WRONG ORGANIZATION'
    ELSE 'CORRECT'
  END as status
FROM patients p
WHERE p.created_at >= '2025-01-15'
  AND (p.organization_id IS NULL 
       OR p.organization_id != '9f91aa7e-cee9-414b-820b-f71cdfd2f259'::uuid)
ORDER BY p.created_at DESC;

-- Expected: Shows patients created after Vortexshpere registration that aren't associated

-- ============================================
-- STEP 6: Count Patients by Organization (All Organizations)
-- ============================================
SELECT 
  o.name as organization_name,
  p.organization_id,
  COUNT(*) as patient_count
FROM patients p
LEFT JOIN organizations o ON p.organization_id = o.id
GROUP BY p.organization_id, o.name
ORDER BY patient_count DESC;

-- Expected: Shows count of patients per organization (including NULL)
-- Check if Vortexshpere appears in the list

-- ============================================
-- STEP 6B: Check if Vortexshpere has ANY Patients
-- ============================================
SELECT 
  COUNT(*) as vortexshpere_patient_count
FROM patients
WHERE organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'::uuid;

-- Expected: Returns 0 if no patients exist, or count if they do


-- ============================================
-- STEP 7: Check for Patients with NULL organization_id (Created After Vortexshpere Registration)
-- (These are the most likely orphaned patients)
-- ============================================
SELECT 
  id,
  patient_id,
  first_name || ' ' || last_name as patient_name,
  organization_id,
  created_at,
  created_by,
  phone,
  email
FROM patients
WHERE organization_id IS NULL
  AND created_at >= '2025-01-15'  -- After Vortexshpere registration
ORDER BY created_at DESC;

-- Expected: Shows patients without organization_id created after Vortexshpere registered
-- If you see a patient here that belongs to Vortexshpere, that's the missing one!

-- ============================================
-- STEP 7B: Check for Patients Created by Vsgcare User
-- (The owner username from Vortexshpere)
-- ============================================
SELECT 
  id,
  patient_id,
  first_name || ' ' || last_name as patient_name,
  organization_id,
  o.name as organization_name,
  created_at,
  created_by
FROM patients p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.created_by = 'Vsgcare'
   OR p.created_by LIKE '%Vsgcare%'
   OR p.created_by LIKE '%Vsg%'
ORDER BY p.created_at DESC;

-- Expected: Shows any patients created by the Vortexshpere owner

-- ============================================
-- STEP 7C: Find ALL Patients with NULL organization_id (Any Date)
-- ============================================
SELECT 
  COUNT(*) as null_org_id_count
FROM patients
WHERE organization_id IS NULL;

-- Then if count > 0, run:
-- SELECT 
--   id,
--   patient_id,
--   first_name || ' ' || last_name as patient_name,
--   organization_id,
--   created_at,
--   created_by
-- FROM patients
-- WHERE organization_id IS NULL
-- ORDER BY created_at DESC;

-- ============================================
-- STEP 8: DIAGNOSIS - No Vortexshpere Patients Found
-- ============================================
-- Based on the results, NO patients exist for Vortexshpere Global Limited.
-- This means the patient was likely:
-- 1. Created but only saved to localStorage (not synced to Supabase)
-- 2. Created but with NULL organization_id (check Step 7 above)
-- 3. Patient creation failed silently

-- SOLUTION: The fix I implemented in js/patients.js should prevent this going forward.
-- For the existing missing patient, check Step 7 for NULL organization_id patients.

-- ============================================
-- STEP 8B: FIX PATIENTS with NULL organization_id (If Step 7 found them)
-- ONLY run this if you found patients in Step 7 that belong to Vortexshpere
-- Replace 'PATIENT-ID-HERE' with actual patient ID from Step 7 results
-- ============================================
-- UPDATE patients
-- SET organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'::uuid
-- WHERE id = 'PATIENT-ID-HERE'::uuid;

-- OR if you found multiple NULL patients that belong to Vortexshpere:
-- UPDATE patients
-- SET organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259'::uuid
-- WHERE id IN (
--   'patient-id-1'::uuid,
--   'patient-id-2'::uuid,
--   'patient-id-3'::uuid
-- )
-- AND organization_id IS NULL;

-- ============================================
-- STEP 8: Verify Fix (Run AFTER Step 7)
-- ============================================
-- SELECT 
--   COUNT(*) as total_patients
-- FROM patients
-- WHERE organization_id = '9f91aa7e-cee9-414b-820b-f71cdfd2f259';

-- Expected: Should show count of all patients for Vortexshpere

-- ============================================
-- STEP 9: Double-check No Orphaned Patients Remain
-- ============================================
-- SELECT 
--   COUNT(*) as remaining_orphaned
-- FROM patients
-- WHERE organization_id IS NULL
--   AND created_by = 'Vsgcare';

-- Expected: Should return 0 after fix

-- ============================================
-- ALTERNATIVE: If organization_id is TEXT (not UUID)
-- Check if this query works (should return 0 if column is UUID):
-- ============================================
-- SELECT 
--   id,
--   patient_id,
--   first_name || ' ' || last_name as patient_name,
--   organization_id,
--   pg_typeof(organization_id) as column_type,
--   created_at
-- FROM patients
-- WHERE organization_id::text = 'Vortexshpere Global Limited'
--    OR organization_id::text LIKE '%Vortexshpere%'
-- LIMIT 10;

