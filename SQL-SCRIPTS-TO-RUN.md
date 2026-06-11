# SQL Scripts to Run - Step by Step

## ⚠️ CRITICAL: Run This First

**File:** `supabase/migrations/20251105000003_fix_all_staff_data_access.sql`

**What it does:**
- Fixes RLS (Row Level Security) policies that are blocking staff from seeing patient data
- Restores access to diagnoses, medical history, allergies, medications
- Fixes access to prescriptions and orders (lab/imaging)
- Allows both staff AND patients to access their data (using separate policies)

**How to run:**
1. Open Supabase Dashboard → Your Project → SQL Editor
2. Copy the ENTIRE contents of `supabase/migrations/20251105000003_fix_all_staff_data_access.sql`
3. Paste into SQL Editor
4. Click "Run" or press Ctrl+Enter
5. Wait for "Success" message

**Expected result:**
- You should see output showing:
  - Policies created for patients table
  - Policies created for appointments table
  - Policies created for prescriptions table
  - Policies created for orders table
  - A data verification query showing patient counts

---

## 📊 Optional: Check What Data Exists

**File:** `supabase/migrations/20251105000004_verify_and_recover_data.sql`

**What it does:**
- Shows you what data is actually in Supabase for Mecure Clinics
- Shows counts of allergies, diagnoses, medical history per patient
- Shows RLS policies that are active
- Helps you identify if data is missing

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy the ENTIRE contents of `supabase/migrations/20251105000004_verify_and_recover_data.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Review the results

**When to run:**
- AFTER running the fix script above
- To verify your data is still there
- To check if data was lost or just blocked by RLS

---

## ❌ DO NOT RUN

**File:** `supabase/migrations/20251105000002_fix_staff_data_access.sql`

**Why:**
- This was an earlier version that's less complete
- The `20251105000003` version above replaces it
- Running both could cause conflicts

---

## Quick Summary

**Run this ONE script:**
```
supabase/migrations/20251105000003_fix_all_staff_data_access.sql
```

**Then optionally check data:**
```
supabase/migrations/20251105000004_verify_and_recover_data.sql
```

**That's it!** After running the first script, refresh your Netlify app and the data should be visible again.

