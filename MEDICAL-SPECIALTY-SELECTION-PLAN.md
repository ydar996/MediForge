# Medical Specialty Selection Feature - Implementation Plan

## Overview
Add a feature that allows users to select their medical specialty at first login, with the ability to change it later from the dashboard. The app defaults to "Primary Care" but offers all available specialties.

## Goals
1. ✅ Default to "Primary Care" for all organizations
2. ✅ Prompt specialty selection on first login
3. ✅ Allow changing specialty from dashboard
4. ✅ Use comprehensive list of medical specialties
5. ✅ **DO NOT BREAK ANY EXISTING FUNCTIONALITY**

---

## Implementation Plan

### Phase 1: Database Schema Update
**File:** `supabase/migrations/20251106000000_add_medical_specialty.sql`

**Changes:**
- Add `medical_specialty` column to `organizations` table
  - Type: `TEXT`
  - Default: `'Primary Care'`
  - Nullable: `true` (for backward compatibility)
- Add index on `medical_specialty` for faster queries
- **No breaking changes:** Existing organizations will default to 'Primary Care'

**SQL:**
```sql
-- Add medical_specialty column with default
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS medical_specialty TEXT DEFAULT 'Primary Care';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_organizations_medical_specialty 
ON organizations(medical_specialty);

-- Update existing organizations to 'Primary Care' if null
UPDATE organizations 
SET medical_specialty = 'Primary Care' 
WHERE medical_specialty IS NULL;
```

---

### Phase 2: Medical Specialties Utility
**File:** `js/medical-specialties.js` (NEW)

**Purpose:** Centralized management of medical specialties list and organization specialty operations.

**Functions:**
1. `MEDICAL_SPECIALTIES` - Array of all specialties (includes all from `js/specialists.js` + "Primary Care")
2. `getOrganizationSpecialty()` - Get current org's specialty (Supabase-first, localStorage fallback)
3. `saveOrganizationSpecialty(specialty)` - Save specialty (Supabase-first, localStorage fallback)
4. `hasOrganizationSpecialtySet()` - Check if specialty was explicitly set (for first-login detection)
5. `markSpecialtyAsSet()` - Mark specialty as set (localStorage flag)

**Key Design Decisions:**
- Follows hybrid architecture (Supabase-first, localStorage fallback)
- Backward compatible with existing organizations
- Uses localStorage flag to detect if specialty was explicitly set vs. default

---

### Phase 3: Specialty Selection Page
**File:** `select-medical-specialty.html` (NEW)

**Purpose:** Standalone page for selecting/changing medical specialty.

**Features:**
- Dropdown with all medical specialties
- Description display for selected specialty
- Different UI for first-login vs. change-later scenarios
- "Skip for Now" option (only shown when changing later)
- Nigerian heritage theme styling

**User Flow:**
1. **First Login:**
   - Shows welcome message
   - Requires selection (no skip option)
   - Redirects to dashboard after save

2. **Change Later:**
   - Shows current specialty
   - Allows skip
   - Redirects to dashboard after save

---

### Phase 4: First-Login Detection & Redirect
**File:** `dashboard.html`

**Changes:**
- Add check on page load to detect if specialty needs to be set
- If first login (specialty not explicitly set), redirect to `select-medical-specialty.html`
- **Non-blocking:** Only redirects if specialty not set, doesn't break existing functionality

**Implementation:**
```javascript
// At end of dashboard.html script section
window.addEventListener('load', async function() {
  // ... existing dashboard code ...
  
  // Check if specialty needs to be set (first login)
  try {
    const specialtySet = await window.hasOrganizationSpecialtySet();
    if (!specialtySet) {
      // First login - redirect to specialty selection
      window.location.href = 'select-medical-specialty.html';
      return;
    }
  } catch (error) {
    // If check fails, continue normally (don't block dashboard)
    console.warn('Could not check specialty status:', error);
  }
});
```

---

### Phase 5: Dashboard Button for Changing Specialty
**File:** `dashboard.html`

**Changes:**
- Add new button in dashboard grid: "Change Medical Specialty"
- Button links to `select-medical-specialty.html`
- Styled with Nigerian heritage theme colors
- Positioned logically with other settings buttons

**Button HTML:**
```html
<button onclick="window.location.href='select-medical-specialty.html'" 
        style="background: linear-gradient(135deg, #008751, #006B3F);">
  🏥 Change Medical Specialty
</button>
```

---

### Phase 6: Update Specialist Register Page
**File:** `specialist-register.html` or `js/specialists.js`

**Changes:**
- Ensure the specialty dropdown uses the comprehensive list from `js/medical-specialties.js`
- **No breaking changes:** Only ensures consistency, doesn't change existing functionality

**Implementation:**
- Import `MEDICAL_SPECIALTIES` from `js/medical-specialties.js`
- Use it to populate the specialty dropdown (if not already using `js/specialists.js`)

---

## Files to Create
1. ✅ `js/medical-specialties.js` - Specialty management utilities
2. ✅ `select-medical-specialty.html` - Specialty selection page
3. `supabase/migrations/20251106000000_add_medical_specialty.sql` - Database migration

## Files to Modify
1. `dashboard.html` - Add first-login check and "Change Specialty" button
2. `specialist-register.html` - Ensure it uses comprehensive specialty list (if needed)

## Files NOT Modified (Preserved)
- ❌ `js/patients.js` - No changes
- ❌ `js/appointments.js` - No changes
- ❌ `js/auth.js` - No changes
- ❌ Any clinical note or prescription files - No changes
- ❌ Any existing functionality - All preserved

---

## Testing Checklist

### Before Implementation:
- [ ] Verify all existing dashboard functionality works
- [ ] Verify all existing patient/appointment features work
- [ ] Verify specialist register page works

### After Implementation:
- [ ] New organizations default to "Primary Care"
- [ ] First login redirects to specialty selection
- [ ] Specialty selection page works correctly
- [ ] Changing specialty from dashboard works
- [ ] Existing organizations still work (backward compatible)
- [ ] All existing functionality still works
- [ ] Database migration runs successfully
- [ ] No console errors
- [ ] Mobile responsive

---

## Backward Compatibility Guarantees

1. **Database:**
   - New column is nullable with default
   - Existing organizations automatically get "Primary Care"
   - No data loss or breaking changes

2. **JavaScript:**
   - All functions have try-catch error handling
   - Falls back gracefully if Supabase unavailable
   - Uses localStorage as backup

3. **User Experience:**
   - Existing users won't be forced to select (only new/first-time)
   - Can skip selection if changing later
   - No breaking changes to existing workflows

4. **Code:**
   - New files only (no modifications to core functionality)
   - Dashboard check is non-blocking (fails gracefully)
   - All new code is isolated

---

## Rollout Strategy

1. **Step 1:** Run database migration (adds column, sets defaults)
2. **Step 2:** Deploy new files (`js/medical-specialties.js`, `select-medical-specialty.html`)
3. **Step 3:** Update `dashboard.html` (add button and first-login check)
4. **Step 4:** Test on local machine
5. **Step 5:** Deploy to Netlify
6. **Step 6:** Monitor for any issues

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Only add new code, minimal modifications, extensive testing |
| Database migration fails | Use `IF NOT EXISTS`, test migration on dev first |
| First-login check blocks dashboard | Wrap in try-catch, fail gracefully |
| Specialty not saving | Hybrid architecture (Supabase + localStorage fallback) |
| Users can't access dashboard | First-login check is non-blocking, can skip |

---

## Success Criteria

✅ Users can select specialty on first login  
✅ Users can change specialty from dashboard  
✅ All existing functionality works unchanged  
✅ No data loss or breaking changes  
✅ Backward compatible with existing organizations  
✅ Mobile responsive  
✅ Follows Nigerian heritage theme  

---

## Questions for Review

1. Should we force specialty selection on first login, or allow skip?
   - **Current Plan:** Force on first login, allow skip when changing later

2. Should we show specialty anywhere else in the UI (e.g., patient records, clinical notes)?
   - **Current Plan:** No, just selection and dashboard button

3. Should we track specialty change history?
   - **Current Plan:** No, just current specialty

4. Should platform admins be able to see/change clinic specialties?
   - **Current Plan:** No, only clinic staff can change their own

---

## Next Steps (After Approval)

1. Review and approve this plan
2. Implement Phase 1 (Database migration)
3. Implement Phase 2 (Utility functions)
4. Implement Phase 3 (Selection page)
5. Implement Phase 4 (First-login detection)
6. Implement Phase 5 (Dashboard button)
7. Test thoroughly
8. Deploy to Netlify

