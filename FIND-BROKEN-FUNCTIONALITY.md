# How to Find Broken Functionality

## The Problem
You've found 2 broken features in 48 hours:
1. **Account lockout** - Users locked out incorrectly
2. **User management** - Platform admin can't view organization users

Both were working 48 hours ago. How do we find other broken functionality?

## Root Causes of Broken Functionality

### 1. **Column Name Changes** (Most Common)
- Migration renamed `medical_license_number` → `license_number`
- Code still references old column name
- **Result:** INSERT/UPDATE operations fail silently or with errors

### 2. **RPC Function Mismatches**
- Database functions reference old column names
- **Result:** Function calls fail, features don't work

### 3. **Schema Mismatches**
- Code expects columns that don't exist
- **Result:** Data doesn't save, features appear to work but don't persist

### 4. **Silent Failures**
- Code catches errors but doesn't report them
- **Result:** Feature appears to work but data isn't saved

## Tools to Find Broken Functionality

### Tool 1: Diagnostic Tool (Schema Checks)
**File:** `diagnose-broken-functionality.html`

**What it checks:**
- Database schema mismatches
- RPC function availability
- Column name mismatches
- Authentication setup

**How to use:**
1. Go to: `https://mediforge.netlify.app/diagnose-broken-functionality.html`
2. Click "Run Complete Diagnostic"
3. Review errors and warnings

### Tool 2: Functional Test Tool (Actual Functionality)
**File:** `test-functionality.html`

**What it tests:**
- Can we actually fetch users?
- Can we actually save patients?
- Do RPC functions work?
- Does data persist?

**How to use:**
1. Go to: `https://mediforge.netlify.app/test-functionality.html`
2. Click "Run All Tests"
3. Review which features actually work vs. which fail

## Issues Already Found & Fixed

### ✅ Fixed Issues:
1. **`get_organization_users` RPC** - Updated to use `license_number`
2. **`js/platform-admin.js`** - Fixed INSERT to use `license_number`
3. **`js/supabase-auth-complete.js`** - Fixed INSERT to use `license_number`
4. **`js/robust-login.js`** - Fixed to handle both column names

### ⚠️ Potential Issues (Need Testing):
1. **Registration flow** - May fail when creating users with license numbers
2. **User profile updates** - May fail when updating license numbers
3. **Platform admin user creation** - May fail when creating admin users

## How to Test Each Feature

### User Management
1. Go to platform admin dashboard
2. Try to view organization users
3. Try to unlock an account
4. **Expected:** Should work without errors

### Patient Management
1. Go to add-patient page
2. Create a test patient
3. Save and verify it appears in patient list
4. **Expected:** Patient should save and appear

### Registration
1. Try registering a new user
2. Check if user appears in database
3. **Expected:** User should be created successfully

### Data Persistence
1. Create/edit any record
2. Refresh page
3. Verify data is still there
4. **Expected:** Data should persist

## Common Failure Patterns

### Pattern 1: "Column does not exist"
- **Symptom:** Error message mentions column name
- **Cause:** Code references old column name
- **Fix:** Update code to use new column name

### Pattern 2: "Function does not exist"
- **Symptom:** RPC call fails
- **Cause:** Function references wrong columns
- **Fix:** Update function definition

### Pattern 3: Silent Failure
- **Symptom:** Feature appears to work but data doesn't save
- **Cause:** Error caught but not displayed
- **Fix:** Check browser console, add error handling

## Next Steps

1. **Deploy the diagnostic tools**
2. **Run both diagnostic tools**
3. **Fix any issues found**
4. **Test manually in the app**
5. **Monitor for user reports**

## Files to Check Manually

These files still reference `medical_license_number` but may handle it gracefully:
- `js/patients.js` - Uses `medicalLicenseNumber` from user object (should be OK)
- `js/auth.js` - Uses form field `medicalLicenseNumber` (should be OK)
- `js/supabase-auth.js` - Handles both column names (should be OK)

**Action:** Test registration and user creation flows to verify they work.




















