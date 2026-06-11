-- URGENT: Verify patient data exists and check for data loss
-- Run this to see what data is actually in Supabase for Mecure Clinics

-- Check patient data for Mecure Clinics
SELECT 
  'PATIENT DATA VERIFICATION' as section,
  patient_id,
  first_name || ' ' || last_name as name,
  CASE 
    WHEN allergies IS NULL OR allergies::text = 'null' OR allergies::text = '[]' THEN 0 
    ELSE jsonb_array_length(allergies::jsonb) 
  END as allergies_count,
  CASE 
    WHEN medical_history IS NULL OR medical_history::text = 'null' OR medical_history::text = '[]' THEN 0 
    ELSE jsonb_array_length(medical_history::jsonb) 
  END as medical_history_count,
  CASE 
    WHEN diagnoses IS NULL OR diagnoses::text = 'null' OR diagnoses::text = '[]' THEN 0 
    ELSE jsonb_array_length(diagnoses::jsonb) 
  END as diagnoses_count,
  CASE 
    WHEN medications IS NULL OR medications::text = 'null' OR medications::text = '[]' THEN 0 
    ELSE jsonb_array_length(medications::jsonb) 
  END as medications_count,
  CASE 
    WHEN immunizations IS NULL OR immunizations::text = 'null' OR immunizations::text = '[]' THEN 0 
    ELSE jsonb_array_length(immunizations::jsonb) 
  END as immunizations_count,
  updated_at
FROM patients
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
ORDER BY patient_id;

-- Check for Toke Makinwa specifically
SELECT 
  'TOKE MAKINWA DATA' as section,
  patient_id,
  first_name || ' ' || last_name as name,
  allergies::text as allergies_raw,
  medical_history::text as medical_history_raw,
  diagnoses::text as diagnoses_raw,
  medications::text as medications_raw,
  updated_at
FROM patients
WHERE organization_id = '576522cc-e769-4fb4-9487-3d150857d970'
  AND patient_id = 'MEC0006';

-- Check RLS policies to ensure staff can read
SELECT 
  'RLS POLICIES CHECK' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as condition
FROM pg_policies
WHERE tablename = 'patients'
ORDER BY policyname;

-- Check if there are any backup/audit tables with old data
SELECT 
  'BACKUP TABLES CHECK' as section,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%backup%' OR table_name LIKE '%audit%' OR table_name LIKE '%log%')
ORDER BY table_name;

