# 📋 Backup Migration Steps

## Step 1: Add Address Columns to Supabase

**Open Supabase SQL Editor** and run this SQL:

```sql
-- Add address columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND table_schema = 'public'
  AND column_name LIKE '%address%'
ORDER BY ordinal_position;
```

**Expected Result:** You should see 3 rows with columns: `address`, `address_line1`, `address_line2`

---

## Step 2: Refresh Migration Tool

1. Go back to the migration page in your browser
2. Press **F5** or **Ctrl+R** to refresh the page
3. The Supabase client will reinitialize with the new schema

---

## Step 3: Run the Migration

1. Click **"Choose File"** and select `mediforge-backup-2025-10-14.json`
2. Click **"Load Backup"** button
3. Verify you see:
   - ✅ 7 Patients
   - ✅ 13 Appointments
   - ✅ 4 Users
4. Click **"Start Migration"** button
5. Wait for completion

---

## What Will Be Migrated:

### Organizations (Mecure Clinics)
- Full name
- Org code: `MEC-2025-JB8C`
- **Address:** 1 Oregun Street, Opebi, Lagos, Nigeria
- Phone numbers

### Patients (7 total)
- Full personal details (name, DOB, gender, etc.)
- **Full address** (street, city, state, country)
- Contact information (phone, email)
- Medical information (blood group, allergies, conditions)
- Emergency contact details

### Appointments (13 total)
- Patient names
- Doctor names
- Dates and times
- Status, reason, notes

### Users (4 users, excluding platform admin)
- Usernames and roles
- Names and contact info
- Linked to Mecure Clinics organization

---

## After Migration:

Once you see "🎉 Migration completed successfully!", tell me the summary and we'll:
1. ✅ Verify data in platform dashboard
2. ✅ Test the app displays everything correctly
3. ✅ Deploy to production



