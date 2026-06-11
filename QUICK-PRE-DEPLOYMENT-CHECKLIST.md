# ⚡ QUICK PRE-DEPLOYMENT CHECKLIST

**Purpose:** Fast validation before deploying urgent fixes. Complete this checklist in 5-10 minutes.

**Status:** ✅ **MANDATORY** - Use this before EVERY deployment, even for urgent fixes.

---

## 🚨 CRITICAL CHECKS (2 minutes)

### Syntax & Code Quality
- [ ] Run syntax check: `node --check js/patients.js`
- [ ] Run syntax check: `node --check js/patient-id-normalizer.js`
- [ ] Check browser console for errors (open any HTML page)
- [ ] No `await` in non-async functions
- [ ] No template literal syntax errors
- [ ] No undefined variables

### Architecture Compliance
- [ ] Supabase-first pattern maintained (check modified files)
- [ ] Patient ID resolution uses `resolvePatientByIdentifier()`
- [ ] `patient.id` never returns UUID (check `getPatientIdentifier()`)
- [ ] Organization scoping preserved (check queries use `organization_id`)

---

## 🧪 QUICK SMOKE TESTS (5 minutes)

### Test 1: Patients Page Loads
1. Open `patients.html` in browser
2. Check console for errors
3. Verify patients list displays (or shows "No patients" message)
4. **Expected:** No JavaScript errors, page loads

### Test 2: Patient ID Resolution
1. Open browser console
2. Run: `await window.resolvePatientByIdentifier('MEC0001')`
3. Check result: `result.id` should be legacy ID (not UUID)
4. **Expected:** Returns patient object with legacy ID in `id` field

### Test 3: Patient Details Page
1. Navigate to `patient-details.html?id=MEC0001` (or any patient ID)
2. Check console for errors
3. Verify patient info displays
4. **Expected:** Patient details load, no "Unknown ID" or UUID in URL

### Test 4: Patient ID Normalization
1. Open browser console
2. Run: `await window.normalizePatientIdForUrl('88aaa7f4-e119-4985-96ca-cbdb9922bd5d')`
3. Check result: Should return legacy ID (not UUID)
4. **Expected:** Returns legacy ID format (MECXXXX)

---

## 🔍 CODE REVIEW (3 minutes)

### Modified Files Review
- [ ] Check all modified files for:
  - ✅ Supabase-first pattern
  - ✅ Error handling (try-catch blocks)
  - ✅ Fallback mechanisms
  - ✅ Backward compatibility

### Critical Functions Check
- [ ] `resolvePatientByIdentifier()` - Handles UUID and legacy ID
- [ ] `getPatientIdentifier()` - Never returns UUID
- [ ] `normalizePatientIdForUrl()` - Always returns legacy ID
- [ ] Data loading functions - Supabase-first, localStorage fallback

---

## ✅ FINAL VERIFICATION

- [ ] All syntax checks passed
- [ ] All smoke tests passed
- [ ] Architecture compliance verified
- [ ] No console errors
- [ ] Rollback plan ready (Git history available)

**If all checks pass:** ✅ **READY TO DEPLOY**

**If any check fails:** ❌ **FIX ISSUES BEFORE DEPLOYING**

---

## 🚀 DEPLOYMENT COMMAND

```powershell
# Log in to Netlify (opens browser)
netlify login

# Deploy with descriptive message
npx --yes netlify-cli deploy --prod --dir . --message "DESCRIPTION: What was fixed/changed"
```

---

## 📝 POST-DEPLOYMENT (First 5 minutes)

After deployment, immediately verify:

1. **Site loads:** https://mediforge.netlify.app
2. **Login works:** Can log in successfully
3. **Patients page:** Loads without errors
4. **Console check:** Open browser console, verify no errors
5. **Patient details:** Navigate to a patient, verify ID displays correctly

**If issues found:** Document and fix immediately, or rollback if critical.

---

**Last Updated:** 2025-01-09  
**Usage:** Complete this checklist before EVERY deployment

