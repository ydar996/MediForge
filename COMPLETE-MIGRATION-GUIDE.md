# 🏥 Complete Clinical Data Migration Guide

## Overview
This guide will walk you through migrating **ALL** clinical data from your backup to Supabase, including:

✅ 11 Patient Encounters (Visits with full SOAP notes)  
✅ 4 Vital Signs Records  
✅ 12 Diagnoses  
✅ 5 Medications  
✅ 2 Prescriptions  
✅ 9 Medical History Events  
✅ 16 Preventive Care Items  
✅ 5 Lab Orders  
✅ Plus all associated billing data

---

## Step 1: Create Clinical Schema in Supabase

Open your **Supabase SQL Editor** and run this file:
- `sql-scripts/create-complete-clinical-schema.sql`

This will create **13 new tables**:
1. `patient_encounters` - Visits with SOAP notes
2. `vital_signs` - BP, temp, HR, etc.
3. `diagnoses` - Patient diagnoses
4. `medications` - Active medications
5. `prescriptions` - Prescription history
6. `medical_history` - Past medical events
7. `preventive_care` - Preventive care gaps
8. `lab_orders` - Laboratory test orders
9. `imaging_orders` - Imaging study orders
10. `referrals` - Specialist referrals
11. `invoices` - Billing invoices
12. `invoice_items` - Invoice line items
13. `payments` - Payment records

**Expected Result:** You should see all 13 tables created with their column counts.

---

## Step 2: Run the Complete Migration

1. Open the migration tool in your browser:
   - Navigate to `migrate-all-clinical-data.html`
   - Or use: `http://localhost:5500/migrate-all-clinical-data.html`

2. **Load your backup file:**
   - Click "Choose File"
   - Select `mediforge-backup-2025-10-14.json`
   - Click "Load Backup"

3. **Verify the statistics:**
   You should see:
   - 7 Patients
   - 11 Visits
   - 4 Vitals
   - 12 Diagnoses
   - 5 Medications
   - 2 Prescriptions
   - 9 Medical History
   - 16 Preventive Care
   - 5 Lab Orders

4. **Start the migration:**
   - Click "Start Full Migration"
   - Wait for completion (this may take 2-3 minutes)
   - Watch the logs for any errors

---

## Step 3: Verify the Migration

After migration completes, verify in Supabase:

```sql
-- Check each table
SELECT 'patient_encounters' as table_name, COUNT(*) as count FROM patient_encounters
UNION ALL
SELECT 'vital_signs', COUNT(*) FROM vital_signs
UNION ALL
SELECT 'diagnoses', COUNT(*) FROM diagnoses
UNION ALL
SELECT 'medications', COUNT(*) FROM medications
UNION ALL
SELECT 'prescriptions', COUNT(*) FROM prescriptions
UNION ALL
SELECT 'medical_history', COUNT(*) FROM medical_history
UNION ALL
SELECT 'preventive_care', COUNT(*) FROM preventive_care
UNION ALL
SELECT 'lab_orders', COUNT(*) FROM lab_orders
UNION ALL
SELECT 'imaging_orders', COUNT(*) FROM imaging_orders;
```

**Expected Results:**
- patient_encounters: 11
- vital_signs: 4
- diagnoses: 12
- medications: 5
- prescriptions: 2
- medical_history: 9
- preventive_care: 16
- lab_orders: 5
- imaging_orders: 0

---

## Step 4: Configure RLS Policies

After migration, secure the tables with RLS:

```sql
-- Enable RLS on all new tables
ALTER TABLE patient_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventive_care ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE imaging_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create basic SELECT policy for authenticated users
-- (You can refine these policies later based on your security requirements)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'patient_encounters', 'vital_signs', 'diagnoses', 'medications',
            'prescriptions', 'medical_history', 'preventive_care', 'lab_orders',
            'imaging_orders', 'referrals', 'invoices', 'invoice_items', 'payments'
        ])
    LOOP
        EXECUTE format('
            CREATE POLICY "Allow authenticated users to read %I"
            ON %I FOR SELECT
            TO authenticated
            USING (true)
        ', tbl, tbl);
    END LOOP;
END $$;
```

---

## What This Migrates

### For Each Patient:
1. **Personal Information** ✅ (Already migrated)
   - Demographics, contact info, insurance

2. **Clinical Encounters** ✅ (NEW)
   - Visit dates
   - Full SOAP notes:
     - **S**ubjective: Chief complaint, HPI, family/social history
     - **O**bjective: Vitals, physical exam, lab results
     - **A**ssessment: Diagnoses, differential diagnoses
     - **P**lan: Treatments, testing, referrals, education

3. **Vital Signs** ✅ (NEW)
   - Temperature, BP, HR, RR
   - Height, weight, BMI
   - O2 saturation, pain score

4. **Diagnoses** ✅ (NEW)
   - ICD codes and descriptions
   - Diagnosis dates
   - Status (active/resolved)

5. **Medications** ✅ (NEW)
   - Current medications list
   - Dosage, frequency, route
   - Start/end dates

6. **Prescriptions** ✅ (NEW)
   - Historical prescriptions
   - Refills, pharmacy notes

7. **Medical History** ✅ (NEW)
   - Past surgeries, hospitalizations
   - Chronic conditions

8. **Preventive Care** ✅ (NEW)
   - Screenings, vaccinations
   - Care gaps and completion status

9. **Lab Orders** ✅ (NEW)
   - Test orders and results
   - Status tracking

10. **Imaging Orders** ✅ (NEW)
    - X-rays, CT scans, MRIs
    - Status and results

---

## Troubleshooting

### Error: "Table does not exist"
- Make sure you ran the schema SQL first
- Refresh the migration page

### Error: "Column does not exist"
- Check that all columns were created
- Run the verification query from Step 1

### Migration takes too long
- This is normal for complete clinical data
- Don't close the browser window
- Watch the progress bar

### Some data missing
- Check the logs for specific errors
- Verify the backup file loaded correctly
- Re-run the migration (it will skip existing records)

---

## Next Steps

After successful migration:
1. ✅ Test patient details pages show all clinical data
2. ✅ Test encounter history displays correctly
3. ✅ Test prescriptions and medications lists
4. ✅ Verify vitals and lab orders appear
5. ✅ Deploy to production

---

**Estimated Time:** 5-10 minutes (including schema creation)



