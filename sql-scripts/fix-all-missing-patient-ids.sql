-- ============================================
-- Fix ALL Patients with Missing patient_id
-- ============================================
-- Purpose: Generate and assign legacy patient_id (MECXXXX format) for ALL patients
--          who currently have NULL patient_id in the database
--          Assigns IDs in chronological order (by created_at) to maintain consistency
--          Ensures no conflicts with existing patient_ids
-- This script should be run ONCE in the Supabase SQL Editor
-- ============================================

-- Step 1: Check how many patients are missing patient_id
SELECT 
  COUNT(*) as patients_without_id,
  COUNT(DISTINCT organization_id) as affected_organizations
FROM patients
WHERE patient_id IS NULL;

-- Step 2: Show sample of affected patients (ordered chronologically)
SELECT 
  p.id as uuid,
  p.patient_id,
  p.first_name,
  p.last_name,
  p.organization_id,
  o.name as organization_name,
  p.created_at
FROM patients p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.patient_id IS NULL
ORDER BY p.created_at ASC
LIMIT 20;

-- Step 3: Generate and assign patient_id for ALL patients missing it
-- Assigns MECXXXX format IDs in chronological order (by created_at)
-- Ensures no conflicts with existing patient_ids
DO $$
DECLARE
  org_record RECORD;
  patient_record RECORD;
  org_prefix TEXT;
  max_number INTEGER;
  next_number INTEGER;
  generated_patient_id TEXT;
  patients_updated INTEGER;
  total_updated INTEGER := 0;
  conflict_check INTEGER;
BEGIN
  -- Loop through each organization that has patients without patient_id
  FOR org_record IN 
    SELECT DISTINCT organization_id 
    FROM patients 
    WHERE patient_id IS NULL
    ORDER BY organization_id
  LOOP
    -- Get organization prefix (first 3 letters of name, uppercase)
    -- Default to 'MEC' for Mecure Clinics, or use org name
    SELECT UPPER(SUBSTRING(name FROM 1 FOR 3)) INTO org_prefix
    FROM organizations
    WHERE id = org_record.organization_id;
    
    -- Default to 'MEC' if prefix is null or empty (for Mecure Clinics)
    IF org_prefix IS NULL OR org_prefix = '' THEN
      org_prefix := 'MEC';
    END IF;
    
    -- Find the maximum existing sequential number for this organization and prefix
    -- Check ALL existing patient_ids with this prefix to avoid conflicts
    SELECT COALESCE(MAX(CAST(SUBSTRING(patient_id FROM 4) AS INTEGER)), 0) INTO max_number
    FROM patients
    WHERE organization_id = org_record.organization_id
      AND patient_id IS NOT NULL
      AND patient_id ~ ('^' || org_prefix || '[0-9]{4}$'); -- Regex to match MECXXXX format
    
    next_number := max_number;
    patients_updated := 0;
    
    -- Loop through patients in the current organization that are missing a patient_id
    -- Order by created_at to maintain chronological order (oldest first)
    FOR patient_record IN 
      SELECT id, first_name, last_name, created_at
      FROM patients 
      WHERE organization_id = org_record.organization_id 
        AND patient_id IS NULL 
      ORDER BY created_at ASC
    LOOP
      -- Find next available number (skip any that might conflict)
      LOOP
        next_number := next_number + 1;
        generated_patient_id := org_prefix || LPAD(next_number::TEXT, 4, '0');
        
        -- Check if this ID already exists (safety check to prevent conflicts)
        SELECT COUNT(*) INTO conflict_check
        FROM patients
        WHERE organization_id = org_record.organization_id
          AND patient_id = generated_patient_id;
        
        -- If no conflict, use this ID
        EXIT WHEN conflict_check = 0;
        
        -- If conflict exists, try next number (shouldn't happen, but safety check)
        RAISE NOTICE 'Conflict detected for % - trying next number', generated_patient_id;
      END LOOP;
      
      -- Update the patient record with the generated ID
      UPDATE patients
      SET patient_id = generated_patient_id,
          updated_at = NOW()
      WHERE id = patient_record.id;
      
      patients_updated := patients_updated + 1;
      
      RAISE NOTICE 'Assigned patient_id % to patient % % (Created: %)', 
        generated_patient_id, 
        patient_record.first_name, 
        patient_record.last_name,
        patient_record.created_at;
    END LOOP;
    
    total_updated := total_updated + patients_updated;
    RAISE NOTICE 'Organization % (%): Updated % patients', org_prefix, org_record.organization_id, patients_updated;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total patients updated: %', total_updated;
  RAISE NOTICE '========================================';
END $$;

-- Step 4: Verify the updates - should return no rows if successful
SELECT 
  COUNT(*) as remaining_patients_without_id
FROM patients
WHERE patient_id IS NULL;

-- Step 5: Show sample of updated patients (ordered chronologically)
SELECT 
  id,
  patient_id,
  first_name,
  last_name,
  organization_id,
  created_at,
  updated_at
FROM patients
WHERE patient_id IS NOT NULL
ORDER BY organization_id, created_at ASC
LIMIT 50;
