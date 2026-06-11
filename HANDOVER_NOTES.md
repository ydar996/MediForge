# Handover Notes - Appointment Scheduling Fix

## Date: January 18, 2025

## Summary
Fixed appointment scheduling issues for Medical Lab Scientists and other roles. The system now properly loads doctors from Supabase and resolves patient IDs (serial numbers like MEC0014) to UUIDs when creating appointments.

---

## Issues Fixed

### 1. Doctor Dropdown Not Populating
**Problem:** Medical Lab Scientists couldn't see doctors in the dropdown when scheduling appointments.

**Root Cause:** `loadDoctors()` function only checked localStorage, which might be empty for users who haven't synced users data.

**Fix:** 
- Updated `loadDoctors()` in `add-appointment.html` to fetch doctors from Supabase first
- Falls back to localStorage if Supabase is unavailable
- Made function async and properly awaited on page load

**Files Changed:**
- `add-appointment.html` (lines 536-630)

### 2. Patient Resolution Error
**Problem:** Error "Could not resolve patient to a valid record" when scheduling appointments.

**Root Cause:** 
- Patients in localStorage use serial numbers (e.g., "MEC0014")
- Supabase appointments table requires UUIDs
- Resolution logic didn't handle serial number → UUID conversion

**Fix:**
- Updated `resolveSupabasePatientIdByName()` in `js/appointments.js` to select both `id` (UUID) and `patient_id` (serial number)
- Added lookup by `patient_id` field first when patientId is a serial number
- Falls back to name-based resolution if serial lookup fails
- Improved organization ID resolution for all roles

**Files Changed:**
- `js/appointments.js` (lines 728-780, 1415-1495)

### 3. Organization ID Resolution
**Problem:** Organization ID not properly resolved for Medical Lab Scientists.

**Root Cause:** Code only checked `user.organizationId`, didn't check `user.organization_id` or handle UUID format in `user.org`.

**Fix:**
- Checks both `organizationId` and `organization_id`
- Handles case where `user.org` is already a UUID
- Properly resolves from organizations localStorage object

---

## Deployment Instructions

### Prerequisites
- Node.js installed
- Netlify CLI installed (`npm install -g netlify-cli`)
- Netlify account access
- Git access to repository

### Deployment Steps

1. **Verify Changes**
   ```bash
   git status
   git diff
   ```

2. **Test Locally (Optional)**
   ```bash
   # Serve locally to test
   npx http-server . -p 8080
   ```

3. **Deploy to Production**
   ```bash
   npx netlify-cli deploy --prod --dir . --message "Your deployment message here"
   ```

4. **Verify Deployment**
   - Check Netlify dashboard: https://app.netlify.com/projects/mediforge/deploys
   - Test on production: https://mediforge.netlify.app
   - Check browser console for errors

### Quick Deploy Command
```bash
npx netlify-cli deploy --prod --dir . --message "Fix appointment scheduling for all roles"
```

---

## Testing Instructions

### Test Case 1: Doctor Dropdown
1. Login as Medical Lab Scientist
2. Navigate to "Add Appointment" page
3. **Expected:** Doctor dropdown should populate with doctors from organization
4. **If empty:** Check browser console for Supabase errors

### Test Case 2: Patient Selection
1. Login as any role (Doctor, Medical Lab Scientist, etc.)
2. Navigate to "Add Appointment" page
3. Search for an existing patient
4. Select patient from results
5. Fill in date, time, doctor
6. Submit appointment
7. **Expected:** Appointment created successfully without "Could not resolve patient" error

### Test Case 3: Organization ID Resolution
1. Login as Medical Lab Scientist
2. Open browser console
3. Navigate to "Add Appointment" page
4. **Expected:** Console should show organization ID resolved successfully
5. **Check:** No "Cannot determine organization" errors

---

## Code Locations

### Key Files Modified
- `add-appointment.html` - Doctor loading and patient selection UI
- `js/appointments.js` - Patient resolution and appointment creation logic

### Key Functions
- `loadDoctors()` in `add-appointment.html` - Loads doctors from Supabase
- `resolveSupabasePatientIdByName()` in `js/appointments.js` - Resolves patient serial numbers to UUIDs
- Appointment form submit handler in `js/appointments.js` (line 632+) - Main appointment creation logic

---

## Known Issues / Edge Cases

### 1. Offline/Partial Sync Scenario
**Issue:** If a patient exists in localStorage but hasn't synced to Supabase yet, appointment creation may fail.

**Current Behavior:** 
- Code attempts to resolve patient UUID from Supabase
- If resolution fails, shows error message
- User must ensure patient is synced to Supabase first

**Future Improvement:** Could implement temporary UUID generation for offline scenarios (code partially added but commented out).

### 2. Supabase Unavailability
**Issue:** If Supabase is down, doctor dropdown will be empty (falls back to localStorage).

**Current Behavior:** 
- Falls back to localStorage if Supabase query fails
- Shows warning in console
- May result in empty dropdown if localStorage is also empty

**Future Improvement:** Could implement retry logic or better error messaging.

### 3. Patient Name Matching
**Issue:** Name-based resolution may match wrong patient if multiple patients have same first/last name.

**Current Behavior:**
- Uses DOB if available to narrow down matches
- Uses middle name if provided
- Returns first match if multiple found (user should verify)

**Future Improvement:** Could show patient selection dialog if multiple matches found.

---

## Database Schema Notes

### Patients Table
- `id` (UUID) - Primary key, used in appointments table
- `patient_id` (VARCHAR) - Serial number like "MEC0014", matches localStorage format
- `organization_id` (UUID) - Links patient to organization

### Appointments Table
- `patient_id` (UUID) - References patients.id (UUID, not serial number)
- `organization_id` (UUID) - Links appointment to organization

### Users Table
- `organization_id` (UUID) - Links user to organization
- `role` (VARCHAR) - User role (Doctor, Medical Lab Scientist, etc.)

---

## Troubleshooting

### Doctor Dropdown Empty
1. Check browser console for Supabase errors
2. Verify user has `organization_id` set in localStorage
3. Check Supabase RLS policies allow reading users table
4. Verify users exist in Supabase for the organization

### Patient Resolution Fails
1. Check browser console for detailed error messages
2. Verify patient exists in Supabase (check `patient_id` field matches serial number)
3. Verify organization_id matches between patient and user
4. Check Supabase RLS policies allow reading patients table

### Organization ID Not Resolved
1. Check localStorage for `user` object
2. Verify `user.organizationId` or `user.organization_id` is set
3. Check `organizations` localStorage object has correct mapping
4. Verify user is logged in properly

---

## Related Files (Not Modified But Relevant)
- `js/universal-data-loader.js` - Handles patient/appointment syncing
- `js/supabase-client.js` - Supabase client initialization
- `appointments.html` - Main appointments listing page
- `dashboard.html` - User dashboard

---

## Next Steps / Recommendations

1. **Monitor Production:** Watch for appointment creation errors in production
2. **Add Logging:** Consider adding more detailed logging for patient resolution failures
3. **Error Handling:** Improve error messages for users when resolution fails
4. **Testing:** Add automated tests for patient resolution logic
5. **Documentation:** Update user documentation if appointment creation workflow changed

---

## Contact / Support
- Production URL: https://mediforge.netlify.app
- Netlify Dashboard: https://app.netlify.com/projects/mediforge
- Check deployment logs in Netlify dashboard for errors

---

## Git Commands Reference

```bash
# Check current status
git status

# View recent commits
git log --oneline -10

# View changes in specific file
git diff add-appointment.html
git diff js/appointments.js

# Create new branch for fixes
git checkout -b fix/appointment-scheduling

# Commit changes
git add .
git commit -m "Fix appointment scheduling for all roles"

# Push to remote
git push origin main
```

---

**End of Handover Notes**



