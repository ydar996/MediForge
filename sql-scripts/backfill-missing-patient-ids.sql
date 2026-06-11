-- ============================================
-- Backfill Missing Patient IDs
-- ============================================
-- Purpose: Generate legacy IDs (MECXXXX format) for all patients that don't have patient_id set
-- This fixes patients created before the patient_id field was properly implemented
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- Step 1: Create a function to generate patient ID for an organization
CREATE OR REPLACE FUNCTION generate_patient_id_for_org(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  org_prefix TEXT;
  max_number INTEGER;
  next_id TEXT;
BEGIN
  -- Get organization prefix (first 3 letters of name)
  SELECT UPPER(SUBSTRING(name FROM 1 FOR 3))
  INTO org_prefix
  FROM organizations
  WHERE id = org_id;
  
  -- Default prefix if organization not found
  IF org_prefix IS NULL OR org_prefix = '' THEN
    org_prefix := 'ORG';
  END IF;
  
  -- Get highest patient number for this organization
  SELECT COALESCE(MAX(CAST(SUBSTRING(patient_id FROM 4) AS INTEGER)), 0)
  INTO max_number
  FROM patients
  WHERE organization_id = org_id
    AND patient_id IS NOT NULL
    AND patient_id ~ ('^' || org_prefix || '[0-9]{4}$');
  
  -- Generate next ID
  next_id := org_prefix || LPAD((max_number + 1)::TEXT, 4, '0');
  
  RETURN next_id;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update all patients without patient_id
-- This will generate legacy IDs for each organization
DO $$
DECLARE
  patient_record RECORD;
  new_patient_id TEXT;
BEGIN
  -- Loop through all patients without patient_id
  FOR patient_record IN 
    SELECT id, organization_id
    FROM patients
    WHERE patient_id IS NULL
    ORDER BY created_at ASC  -- Process oldest first
  LOOP
    -- Generate patient ID for this organization
    new_patient_id := generate_patient_id_for_org(patient_record.organization_id);
    
    -- Check if generated ID already exists (shouldn't happen, but safety check)
    WHILE EXISTS (
      SELECT 1 FROM patients 
      WHERE organization_id = patient_record.organization_id 
        AND patient_id = new_patient_id
    ) LOOP
      -- If exists, increment and try again
      new_patient_id := SUBSTRING(new_patient_id FROM 1 FOR 3) || 
                        LPAD((CAST(SUBSTRING(new_patient_id FROM 4) AS INTEGER) + 1)::TEXT, 4, '0');
    END LOOP;
    
    -- Update patient with generated ID
    UPDATE patients
    SET patient_id = new_patient_id,
        updated_at = NOW()
    WHERE id = patient_record.id;
    
    RAISE NOTICE 'Assigned patient_id % to patient %', new_patient_id, patient_record.id;
  END LOOP;
END $$;

-- Step 3: Verify the update
SELECT 
  organization_id,
  COUNT(*) as total_patients,
  COUNT(patient_id) as patients_with_id,
  COUNT(*) - COUNT(patient_id) as patients_without_id
FROM patients
GROUP BY organization_id
ORDER BY patients_without_id DESC;

-- Step 4: Show sample of updated patients
SELECT 
  id,
  patient_id,
  first_name || ' ' || last_name as name,
  organization_id,
  created_at
FROM patients
WHERE patient_id IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Step 5: Clean up - Drop the helper function (optional)
-- DROP FUNCTION IF EXISTS generate_patient_id_for_org(UUID);


