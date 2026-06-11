# ✅ DEPLOYMENT CHECKLIST

**Purpose:** Use this checklist before EVERY deployment to ensure no regressions reach production.

---

## 📋 PRE-DEPLOYMENT VERIFICATION

### 1. Change Impact Analysis

- [ ] Pre-change impact analysis completed (see PRE-CHANGE-IMPACT-ANALYSIS.md)
- [ ] All affected files identified
- [ ] Dependencies mapped
- [ ] Risk assessment completed
- [ ] Mitigation plan in place (if needed)

### 2. Automated Tests

- [ ] All unit tests pass: `npm test`
- [ ] All integration tests pass
- [ ] All regression tests pass
- [ ] Code coverage meets threshold (70%+)
- [ ] No test failures or warnings

### 3. Manual Testing - Critical Workflows

**Workflow 1: Patient Management**
- [ ] Create new patient → Saves to Supabase, localStorage updated
- [ ] Edit existing patient → Updates in Supabase, localStorage updated
- [ ] View patient details → Loads correctly from Supabase/localStorage
- [ ] Patient ID resolution → Works for both UUID and legacy ID
- [ ] **CRITICAL:** `patient.id` is NEVER a UUID after resolution

**Workflow 2: Appointment Scheduling**
- [ ] Create new appointment → Saves correctly, conflict detection works
- [ ] Edit existing appointment → All fields pre-populate correctly
  - [ ] Date selected
  - [ ] Time selected (HH:MM format)
  - [ ] Doctor selected (handles "Dr." prefix)
  - [ ] Appointment type selected (by ID or name)
  - [ ] Notes populated
- [ ] View appointments → Provider names display correctly (not "Not specified")

**Workflow 3: Clinical Documentation**
- [ ] Create clinical note → Saves to Supabase with correct patient_id (legacy ID)
- [ ] View patient summary (staff) → Loads without login requirement
- [ ] Patient summary shows:
  - [ ] Demographics
  - [ ] Recent appointments with provider names
  - [ ] Current medications
  - [ ] Medical conditions (not "Unknown")
  - [ ] Recent lab orders

**Workflow 4: Billing & Payments**
- [ ] Create invoice → Saves correctly
- [ ] Record payment → Updates invoice status

**Workflow 5: Authentication & Authorization**
- [ ] Staff login → Works correctly
- [ ] Patient portal access → Requires login
- [ ] Staff access to patient summary → No login required (with source parameter)

**Workflow 6: Data Persistence & Sync**
- [ ] Supabase-first architecture → Supabase tried first, localStorage fallback works
- [ ] Offline mode → Data saves to localStorage, syncs when online
- [ ] UUID vs. legacy ID → Correct handling throughout

### 4. Browser Compatibility

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Edge (desktop)
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)

### 5. Data Integrity Checks

**Patient ID Handling:**
- [ ] `patient.id` is ALWAYS legacy ID format (MEC0012/H1Z7C)
- [ ] UUID is stored in `patient._supabaseUuid` field
- [ ] `resolvePatientByIdentifier` returns patient with legacy ID in `id` field
- [ ] Clinical notes use legacy ID in `patient_id` field
- [ ] Appointments/prescriptions/orders queries use UUID from `_supabaseUuid`

**Data Persistence:**
- [ ] Supabase saves succeed
- [ ] localStorage fallback works
- [ ] No data loss in offline mode
- [ ] Sync queue processes correctly

### 6. Error Handling

- [ ] Network failures handled gracefully
- [ ] Invalid input shows appropriate errors
- [ ] Missing data doesn't break the application
- [ ] Error messages are user-friendly

### 7. Performance

- [ ] Page load times acceptable (< 3 seconds)
- [ ] No unnecessary API calls
- [ ] No memory leaks
- [ ] No console warnings/errors

### 8. Security

- [ ] No credentials exposed in code
- [ ] Input validation in place
- [ ] XSS protection maintained
- [ ] Organization isolation verified

### 9. Code Quality

- [ ] Code review completed
- [ ] No linter errors
- [ ] No console.log statements in production code
- [ ] Documentation updated (if API/functionality changed)

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Pre-Deployment Verification

- [ ] All checklist items above completed
- [ ] No blocking issues identified
- [ ] Rollback plan prepared

### Step 2: Git Commit

```bash
# Commit changes with descriptive message
git add .
git commit -m "Descriptive commit message"
git push origin main
```

### Step 3: Deploy to Production

```bash
# Set Netlify auth token (if needed)
$env:NETLIFY_AUTH_TOKEN = "your-token"

# Deploy to production
npx netlify-cli deploy --prod --dir . --message "Deployment message"
```

### Step 4: Immediate Smoke Tests (First 5 Minutes)

**Critical Path Tests:**
- [ ] Site loads: https://mediforge.netlify.app
- [ ] Login works
- [ ] Dashboard loads
- [ ] Can create test patient
- [ ] Can create test appointment
- [ ] No console errors

**Browser Console Check:**
- [ ] No JavaScript errors
- [ ] No failed API calls
- [ ] No warning messages

### Step 5: Post-Deployment Verification

**Within 30 Minutes:**
- [ ] Critical workflows tested on production
- [ ] Data persistence verified (check Supabase dashboard)
- [ ] User feedback monitored
- [ ] Error tracking checked (if available)

**Within 24 Hours:**
- [ ] Monitor user reports
- [ ] Check analytics (if available)
- [ ] Verify no regressions reported

---

## 🚨 ROLLBACK PROCEDURE

If regression is detected:

### Step 1: Immediate Actions

- [ ] Stop deployment process (if in progress)
- [ ] Identify severity of regression
- [ ] Notify stakeholders (if critical)

### Step 2: Rollback Deployment

```bash
# Option 1: Revert to previous commit
git revert HEAD
git push origin main
# Netlify will auto-deploy

# Option 2: Deploy specific previous version
git checkout <previous-commit-hash>
npx netlify-cli deploy --prod --dir .
```

### Step 3: Verify Rollback

- [ ] Previous version deployed
- [ ] Site functions correctly
- [ ] No data loss
- [ ] Users can access application

### Step 4: Investigation

- [ ] Identify root cause
- [ ] Create fix
- [ ] Test fix thoroughly
- [ ] Redeploy fix (follow full checklist again)

---

## 📊 DEPLOYMENT LOG

**Date:** ________________  
**Deployed By:** ________________  
**Version/Commit:** ________________  
**Changes Summary:**  
```
[Brief description of changes]
```

**Pre-Deployment Status:**
- ✅ All checks passed
- ⚠️ Warnings (list): ________________
- ❌ Issues (if any): ________________

**Post-Deployment Status:**
- ✅ All smoke tests passed
- ⚠️ Issues found: ________________
- ❌ Rollback required: ⬜ Yes ⬜ No

**Notes:**
```
[Any observations, issues, or notes]
```

---

## ✅ SIGN-OFF

**Pre-Deployment Verification:**
- Verified By: ________________  
- Date: ________________

**Deployment:**
- Deployed By: ________________  
- Date: ________________

**Post-Deployment Verification:**
- Verified By: ________________  
- Date: ________________

---

**This checklist MUST be completed before EVERY deployment.**

