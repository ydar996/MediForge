# Migration Instructions: Add Encounters Column to Patients Table

## Problem
The `encounters` column does not exist in the `patients` table in Supabase, causing 400 Bad Request errors when trying to save patient encounters.

## Solution
Run the SQL migration script to add the `encounters` column to the `patients` table.

## Steps

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Click "New Query"

2. **Run the Migration Script**
   - Open the file: `sql-scripts/add-encounters-column-to-patients.sql`
   - Copy the entire contents
   - Paste into the Supabase SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify the Migration**
   - After running, execute this verification query:
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'patients' 
   AND column_name IN ('encounters', 'non_visit_encounters');
   ```
   - You should see both columns listed with `data_type = 'jsonb'`

## What This Does
- Adds `encounters` JSONB column to store non-visit patient encounters
- Adds `non_visit_encounters` JSONB column for backward compatibility
- Both columns are nullable and can store JSON arrays

## After Migration
Once the migration is complete:
- Encounters will be saved to Supabase automatically
- Encounters will persist when navigating between pages
- The 400 Bad Request errors will stop

## Fallback Behavior
Until the migration is run:
- Encounters are saved to localStorage as a fallback
- The app will continue to function, but encounters won't sync across devices
- Console warnings will indicate that encounters are being saved to localStorage only

