# Migration Instructions: Add soap_data Column to clinical_notes Table

## Problem
The `clinical_notes` table is missing the `soap_data` JSONB column, causing 400 Bad Request errors when the application tries to save/load SOAP note data.

## Solution
Run the migration script to add the missing `soap_data` column to the `clinical_notes` table.

## Steps to Fix

### Option 1: Run the dedicated migration script (Recommended)
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file: `sql-scripts/add-soap-data-column-to-clinical-notes.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Option 2: Run the comprehensive migration script
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file: `sql-scripts/add-missing-clinical-notes-columns.sql`
4. Copy the entire contents (now includes `soap_data`)
5. Paste into the SQL Editor
6. Click **Run**

## Verification

After running the migration, verify the column was added:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'clinical_notes' 
    AND column_name = 'soap_data';
```

You should see:
- `column_name`: `soap_data`
- `data_type`: `jsonb`
- `is_nullable`: `YES`

## Expected Result

After this migration:
- ✅ The `soap_data` column will exist in the `clinical_notes` table
- ✅ The application will be able to save SOAP data directly to `clinical_notes.soap_data`
- ✅ No more 400 Bad Request errors related to missing `soap_data` column
- ✅ The Supabase-first architecture will work as intended

## Rollback (if needed)

If you need to remove the column (not recommended):

```sql
ALTER TABLE clinical_notes DROP COLUMN IF EXISTS soap_data;
```

## Notes

- This migration uses `ADD COLUMN IF NOT EXISTS`, so it's safe to run multiple times
- Existing data in the table will not be affected
- The column is nullable, so existing rows will have `NULL` for `soap_data` until they're updated
- After running this migration, you may want to clear the browser cache or do a hard refresh to clear the `_soapDataColumnExists` cache flag

