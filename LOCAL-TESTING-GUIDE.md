# 🧪 LOCAL TESTING GUIDE

**Purpose:** Test changes locally before deploying to production.

**Status:** ✅ **MANDATORY** - Test locally before EVERY deployment.

---

## 🚀 QUICK START (2 minutes)

### Step 1: Start Local Server

```powershell
# Navigate to project directory
cd C:\Users\yinka\Documents\MediForge

# Start local HTTP server (Python)
python -m http.server 5500

# OR use Node.js (if available)
npx http-server -p 5500
```

### Step 2: Open in Browser

1. Open browser: `http://localhost:5500`
2. Open browser console (F12)
3. Navigate to pages you modified

### Step 3: Check Console

- ✅ No red errors
- ✅ No failed API calls
- ✅ No syntax errors

---

## 🧪 CRITICAL WORKFLOW TESTS

### Test 1: Patients Page

**URL:** `http://localhost:5500/patients.html`

**Steps:**
1. Open page
2. Check console for errors
3. Verify patients list displays
4. Click "View" on a patient
5. Verify patient details page loads

**Expected:**
- ✅ No console errors
- ✅ Patients list displays
- ✅ Patient ID is legacy format (MECXXXX), not UUID
- ✅ Patient details page loads correctly

**If fails:** Check `js/patients.js` for syntax errors

---

### Test 2: Patient Details Page

**URL:** `http://localhost:5500/patient-details.html?id=MEC0001`

**Steps:**
1. Open page with patient ID
2. Check console for errors
3. Verify patient information displays
4. Check URL: Should show legacy ID, not UUID
5. Verify patient ID field shows legacy ID (not "Unknown ID")

**Expected:**
- ✅ No console errors
- ✅ Patient details load
- ✅ Patient ID displays correctly (MECXXXX format)
- ✅ URL contains legacy ID, not UUID

**If fails:** Check `loadPatientDetails()` in `js/patients.js`

---

### Test 3: Patient ID Resolution

**Open Browser Console:**

```javascript
// Test 1: Resolve by legacy ID
await window.resolvePatientByIdentifier('MEC0001')
// Expected: Returns patient object with legacy ID in id field

// Test 2: Resolve by UUID (if you have one)
await window.resolvePatientByIdentifier('88aaa7f4-e119-4985-96ca-cbdb9922bd5d')
// Expected: Returns patient object with legacy ID in id field

// Test 3: Normalize for URL
await window.normalizePatientIdForUrl('88aaa7f4-e119-4985-96ca-cbdb9922bd5d')
// Expected: Returns legacy ID (MECXXXX), not UUID

// Test 4: Get legacy ID
const patient = await window.resolvePatientByIdentifier('MEC0001')
window.getLegacyPatientId(patient)
// Expected: Returns legacy ID, never UUID
```

**Expected:**
- ✅ All functions return legacy IDs (not UUIDs)
- ✅ No errors thrown
- ✅ Functions handle both UUID and legacy ID inputs

**If fails:** Check `js/patient-id-normalizer.js` and `js/patients.js`

---

### Test 4: Patient Encounters Page

**URL:** `http://localhost:5500/patient-encounters.html?patientId=MEC0001`

**Steps:**
1. Open page with patient ID
2. Check console for errors
3. Verify patient encounters load
4. Verify medications table displays
5. Check that existing medications appear

**Expected:**
- ✅ No console errors
- ✅ Patient encounters load
- ✅ Medications table displays
- ✅ Existing medications appear (if any)

**If fails:** Check `loadPatientEncounters()` and `displayAllPrescriptions()` in `patient-encounters.html`

---

### Test 5: Appointments Page

**URL:** `http://localhost:5500/appointments.html`

**Steps:**
1. Open page
2. Check console for errors
3. Verify appointments list displays
4. Click on patient link in appointment
5. Verify patient link uses legacy ID (not UUID)

**Expected:**
- ✅ No console errors
- ✅ Appointments list displays
- ✅ Patient links use legacy ID format

**If fails:** Check `js/appointments.js` for patient ID resolution

---

## 🔍 COMMON ISSUES & FIXES

### Issue 1: "await is only valid in async functions"

**Symptom:** Console error: `Uncaught SyntaxError: await is only valid in async functions`

**Fix:**
```javascript
// WRONG:
function myFunction() {
  await someAsyncFunction();
}

// CORRECT:
async function myFunction() {
  await someAsyncFunction();
}
```

**Check:** Search for `await` in modified files, verify function is `async`

---

### Issue 2: Template Literal Syntax Error

**Symptom:** Console error: `Uncaught SyntaxError: Unexpected identifier`

**Fix:**
```javascript
// WRONG:
const html = `Template ${someFunction()} ${await asyncFunction()}`;

// CORRECT:
const result = await asyncFunction();
const html = `Template ${someFunction()} ${result}`;
```

**Check:** Template literals should not contain `await` directly

---

### Issue 3: Patient ID Shows UUID

**Symptom:** Patient ID displays as UUID instead of legacy ID

**Fix:**
- Verify `getPatientIdentifier()` filters UUIDs
- Verify `resolvePatientByIdentifier()` returns legacy ID
- Check URL normalization uses `normalizePatientIdForUrl()`

---

### Issue 4: "Patient not found"

**Symptom:** Patient not found error when ID exists

**Fix:**
- Verify `resolvePatientByIdentifier()` handles temporary IDs (MEC0BF6)
- Check patient lookup includes `_supabaseUuid` field
- Verify Supabase query uses correct organization_id

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Before deploying, verify:

- [ ] Local server runs without errors
- [ ] All critical workflow tests pass
- [ ] No console errors in browser
- [ ] Patient IDs display correctly (legacy format)
- [ ] URLs use legacy IDs (not UUIDs)
- [ ] Syntax check passes: `.\scripts\quick-syntax-check.ps1`

---

## 🚀 DEPLOYMENT READINESS

**Ready to deploy if:**
- ✅ All local tests pass
- ✅ No console errors
- ✅ Syntax check passes
- ✅ Critical workflows verified

**NOT ready if:**
- ❌ Any console errors
- ❌ Syntax errors found
- ❌ Patient IDs showing UUIDs
- ❌ Critical workflows broken

---

## 📝 TESTING LOG TEMPLATE

**Date:** _______________  
**Changes:** _______________  
**Tester:** _______________

**Test Results:**
- [ ] Patients page: ✅ / ❌
- [ ] Patient details: ✅ / ❌
- [ ] Patient ID resolution: ✅ / ❌
- [ ] Patient encounters: ✅ / ❌
- [ ] Appointments: ✅ / ❌
- [ ] Syntax check: ✅ / ❌

**Issues Found:**
```
[List any issues found]
```

**Ready to Deploy:** ✅ Yes / ❌ No

---

**Last Updated:** 2025-01-09  
**Usage:** Follow this guide before EVERY deployment

