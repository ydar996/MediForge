# 🔍 PRE-CHANGE IMPACT ANALYSIS TEMPLATE

**Purpose:** Complete this analysis BEFORE making any code changes to identify potential impacts and prevent regressions.

---

## 📋 CHANGE REQUEST INFORMATION

**Date:** ________________  
**Requested By:** ________________  
**Change Description:**  
```
[Describe the change/improvement being requested]
```

**Priority:** ⬜ Critical ⬜ High ⬜ Medium ⬜ Low

---

## 🔎 IMPACT ANALYSIS

### 1. FILES TO BE MODIFIED

List all files that will be changed:

- [ ] `________________`
- [ ] `________________`
- [ ] `________________`

### 2. DEPENDENCIES & INTEGRATIONS

**Which modules/functions depend on the files being modified?**

- [ ] `________________` uses `________________`
- [ ] `________________` imports from `________________`
- [ ] `________________` calls `________________`

**Which pages use the affected functionality?**

- [ ] `/________________`
- [ ] `/________________`
- [ ] `/________________`

### 3. DATA FLOW ANALYSIS

**Where does the data come from?**

⬜ Supabase  
⬜ localStorage  
⬜ IndexedDB  
⬜ User input  
⬜ Other: ________________

**Where does the data go?**

⬜ Supabase  
⬜ localStorage  
⬜ IndexedDB  
⬜ Display/UI  
⬜ Other: ________________

**Data Format Concerns:**

- [ ] Does this change affect UUID vs. legacy ID handling?
- [ ] Does this change affect data structure/schema?
- [ ] Does this change affect data migration?
- [ ] Does this change affect backward compatibility?

### 4. ARCHITECTURE COMPLIANCE

**Does this change maintain the Supabase-first architecture?**

- [ ] ✅ Yes - Supabase is tried first
- [ ] ✅ Yes - localStorage fallback is preserved
- [ ] ⚠️ No - Explain: ________________

**Does this change affect patient ID resolution?**

- [ ] ⚠️ Yes - Risk: patient.id might become UUID
- [ ] ✅ No - patient.id remains legacy ID format
- [ ] ✅ N/A - Not related to patient IDs

### 5. AUTHENTICATION & AUTHORIZATION

**Does this change affect access control?**

- [ ] ⚠️ Yes - Staff vs. patient portal access
- [ ] ⚠️ Yes - Organization isolation
- [ ] ✅ No - No auth changes

### 6. ERROR HANDLING

**What happens if this change fails?**

- [ ] ✅ Graceful degradation (fallback to localStorage)
- [ ] ✅ User sees error message
- [ ] ⚠️ Undefined behavior
- [ ] ⚠️ Data loss possible

---

## 🧪 TEST SCENARIOS

### Critical Workflows to Test (See CRITICAL-WORKFLOWS.md)

- [ ] **Workflow 1:** Patient Management
  - [ ] Create patient
  - [ ] Edit patient
  - [ ] View patient details
  - [ ] Patient ID resolution

- [ ] **Workflow 2:** Appointment Scheduling
  - [ ] Create appointment
  - [ ] Edit appointment
  - [ ] View appointments
  - [ ] Provider name display

- [ ] **Workflow 3:** Clinical Documentation
  - [ ] Create clinical note
  - [ ] View patient summary
  - [ ] Load medications
  - [ ] Load medical conditions

- [ ] **Workflow 4:** Billing & Payments
  - [ ] Create invoice
  - [ ] Record payment

- [ ] **Workflow 5:** Authentication & Authorization
  - [ ] Staff login
  - [ ] Patient portal access
  - [ ] Staff access to patient summary

- [ ] **Workflow 6:** Data Persistence & Sync
  - [ ] Supabase-first architecture
  - [ ] Offline mode
  - [ ] UUID vs. legacy ID handling

### Edge Cases to Test

- [ ] Invalid input data
- [ ] Network failures (Supabase offline)
- [ ] Missing data fields
- [ ] Concurrent operations
- [ ] Large data sets
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile devices (iOS Safari, Chrome Mobile)

---

## ⚠️ RISK ASSESSMENT

### Risk Level

⬜ **Critical Risk** - Core functionality, data persistence, authentication  
⬜ **High Risk** - Important features, data integrity  
⬜ **Medium Risk** - UI changes, non-critical features  
⬜ **Low Risk** - Documentation, styling (no logic changes)

### Potential Issues

List potential problems this change might cause:

1. **Issue:** ________________  
   **Impact:** ________________  
   **Mitigation:** ________________

2. **Issue:** ________________  
   **Impact:** ________________  
   **Mitigation:** ________________

3. **Issue:** ________________  
   **Impact:** ________________  
   **Mitigation:** ________________

### Breaking Changes

**Does this change break any existing functionality?**

- [ ] ✅ No breaking changes
- [ ] ⚠️ Yes - Breaking change: ________________
  - [ ] Migration plan created
  - [ ] Backward compatibility maintained
  - [ ] Users notified

---

## 📝 TEST PLAN

### Automated Tests

- [ ] Unit tests written/updated
- [ ] Integration tests written/updated
- [ ] Regression tests written/updated
- [ ] All tests pass locally

### Manual Testing

- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Tested in Safari
- [ ] Tested in Edge
- [ ] Tested on mobile (iOS)
- [ ] Tested on mobile (Android)
- [ ] Tested offline mode
- [ ] Tested error scenarios

### Test Data

**Test patient IDs to use:**
- Legacy ID: `MEC0012`
- UUID: `550e8400-e29b-41d4-a716-446655440000` (if applicable)

**Test organizations:**
- Mecure Clinics
- Eko Clinics

---

## ✅ PRE-DEPLOYMENT CHECKLIST

Before deploying, verify:

- [ ] Impact analysis completed
- [ ] All dependencies identified
- [ ] Test plan created
- [ ] Automated tests written and passing
- [ ] Manual testing completed
- [ ] Risk assessment completed
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Rollback plan prepared

---

## 🚨 STOP SIGNS

**DO NOT PROCEED if:**

- [ ] Impact analysis incomplete
- [ ] High/Critical risk without mitigation plan
- [ ] Tests are failing
- [ ] Breaking changes without migration plan
- [ ] Patient ID handling might be affected (UUID vs. legacy ID)

---

## 📊 POST-CHANGE VERIFICATION

After implementing the change:

- [ ] All automated tests still pass
- [ ] Manual testing confirms no regressions
- [ ] Critical workflows still work
- [ ] Data persistence verified
- [ ] Performance acceptable
- [ ] No console errors
- [ ] User feedback positive (if applicable)

---

## 📝 NOTES

```
[Additional notes, observations, or concerns]
```

---

## ✍️ SIGN-OFF

**Analyzed By:** ________________  
**Date:** ________________  
**Approved By:** ________________  
**Date:** ________________

---

**This analysis MUST be completed before making any code changes.**

