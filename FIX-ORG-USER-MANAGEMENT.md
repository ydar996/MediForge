# Fix: org-user-management Error

## Problem
The `org-user-management` page was failing with error:
```
column u.medical_license_number does not exist
```

## Root Cause
The RPC function `get_organization_users` was referencing `medical_license_number`, but this column was renamed to `license_number` in an earlier migration.

## Solution

### Step 1: Apply the Migration

1. Open **Supabase Dashboard** → Your Project → **SQL Editor**
2. Copy the **ENTIRE** contents of:
   ```
   supabase/migrations/20250120000002_fix_get_organization_users_license_column.sql
   ```
3. Paste into SQL Editor
4. Click **"Run"** or press `Ctrl+Enter`
5. Wait for **"Success"** message

### Step 2: Verify the Fix

1. Go to: `https://mediforge.netlify.app/org-user-management?org=Ministry%20of%20Foreign%20Affairs%20Staff%20Clinic`
2. The page should now load users without errors
3. You should see the user list with status badges and action buttons

## What Was Fixed

- Updated `get_organization_users` RPC function to use `license_number` instead of `medical_license_number`
- Both the return type and SELECT statement were corrected
- The function now matches the actual database schema

## Files Changed

1. `supabase/migrations/20251112040500_add_platform_admin_rpcs.sql` - Updated original migration
2. `supabase/migrations/20250120000002_fix_get_organization_users_license_column.sql` - New migration to apply

## After Applying Migration

The org-user-management page will work correctly for platform admins viewing organization users.




















