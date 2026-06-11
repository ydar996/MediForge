# 🛡️ PRODUCTION STABILITY FRAMEWORK

**Purpose:** Prevent breaking production functionality when making changes, upgrades, or adding features.

**Status:** ✅ **MANDATORY** - All changes must follow this framework before deployment.

---

## 🎯 **CORE PRINCIPLES**

1. **Never Break Production** - Production stability is the #1 priority
2. **Test Before Deploy** - All changes must be tested before production
3. **Incremental Changes** - Small, focused changes are safer than large refactors
4. **Rollback Ready** - Always have a rollback plan
5. **Monitor & Verify** - Post-deployment verification is mandatory

---

## 🔒 **LAYER 1: PRE-CHANGE SAFEGUARDS**

### **1.1 Mandatory Impact Analysis**

**Before making ANY change, you MUST:**

- [ ] **Identify Affected Files**
  - List all files that will be modified
  - Identify dependencies (what uses these files)
  - Check for shared utilities or common functions

- [ ] **Map Data Flow**
  - Trace how data flows through the system
  - Identify Supabase-first vs localStorage operations
  - Check for UUID vs legacy ID handling

- [ ] **Risk Assessment**
  - **High Risk:** Core data operations, authentication, patient ID resolution
  - **Medium Risk:** UI changes, non-critical features
  - **Low Risk:** Documentation, styling (no logic changes)

- [ ] **Critical Workflow Check**
  - Review `CRITICAL-WORKFLOWS.md` - which workflows are affected?
  - Test affected workflows BEFORE making changes
  - Document expected behavior (baseline)

---

### **1.2 Code Review Checklist**

**Before committing changes:**

- [ ] **Architecture Compliance**
  - ✅ Supabase-first hybrid architecture maintained
  - ✅ localStorage only used as cache/fallback
  - ✅ No direct localStorage writes before Supabase success
  - ✅ Patient ID resolution uses `resolvePatientByIdentifier()`
  - ✅ `patient.id` is NEVER a UUID after resolution

- [ ] **Data Integrity**
  - ✅ UUID vs legacy ID handling correct
  - ✅ Organization-scoped data isolation maintained
  - ✅ No data loss scenarios possible
  - ✅ Error handling doesn't break dependent modules

- [ ] **Backward Compatibility**
  - ✅ Changes don't break existing data structures
  - ✅ Old data formats still supported
  - ✅ Migration path exists (if breaking change)

---

## 🧪 **LAYER 2: TESTING SAFEGUARDS**

### **2.1 Critical Workflow Testing (MANDATORY)**

**These workflows MUST be tested before EVERY deployment:**

#### **Workflow 1: Patient Management** ✅
- [ ] Create new patient → Saves to Supabase, localStorage updated
- [ ] Edit existing patient → Updates in Supabase, localStorage updated
- [ ] View patient details → Loads correctly from Supabase/localStorage
- [ ] Patient ID resolution → Works for both UUID and legacy ID (MEC0011)
- [ ] **CRITICAL:** `patient.id` is NEVER a UUID after resolution

#### **Workflow 2: Appointment Scheduling** ✅
- [ ] Create new appointment → Saves correctly, conflict detection works
- [ ] Edit existing appointment → All fields pre-populate correctly
- [ ] View appointments → Provider names display correctly
- [ ] Past appointments → Can schedule past dates/times

#### **Workflow 3: Clinical Documentation** ✅
- [ ] Create clinical note → Saves to Supabase with correct patient_id
- [ ] View patient summary → Loads without login requirement
- [ ] Patient summary shows all data correctly

#### **Workflow 4: Registration** ✅
- [ ] New organization registration → Creates org + admin user atomically
- [ ] Organization activation → Only activates after user creation succeeds
- [ ] Failed registration cleanup → Orphaned orgs are cleaned up

#### **Workflow 5: Data Display** ✅
- [ ] Patient demographics → All fields display correctly (no N/A for provided data)
- [ ] Field name mapping → Handles camelCase and snake_case correctly

---

### **2.2 Automated Testing (To Be Implemented)**

**Current Status:** ⚠️ **Not Yet Implemented** - Manual testing required

**Future Implementation:**
- Unit tests for critical functions
- Integration tests for data flow
- E2E tests for critical workflows
- Regression test suite

**Action Required:** Set up Jest testing framework (see `TEST-FRAMEWORK-SETUP.md`)

---

## 🚦 **LAYER 3: PRE-DEPLOYMENT GATES**

### **3.1 Mandatory Pre-Deployment Checklist**

**Before deploying ANY change, verify:**

#### **Quick Validation (5 minutes)**
- [ ] Run syntax check: `.\scripts\quick-syntax-check.ps1`
- [ ] Run full validation: `.\scripts\pre-deployment-validation.ps1`
- [ ] Complete quick checklist: See `QUICK-PRE-DEPLOYMENT-CHECKLIST.md`

#### **Code Quality**
- [ ] No syntax errors (run `.\scripts\quick-syntax-check.ps1`)
- [ ] No console errors in browser
- [ ] No TypeScript errors (if applicable)
- [ ] Code follows existing patterns

#### **Architecture Compliance**
- [ ] Supabase-first pattern maintained
- [ ] localStorage only as cache/fallback
- [ ] Patient ID resolution correct
- [ ] Organization-scoped data isolation

#### **Manual Testing**
- [ ] Critical workflows tested (see Layer 2.1)
- [ ] Tested on local server (`python -m http.server 5500`) - See `LOCAL-TESTING-GUIDE.md`
- [ ] Tested with real Supabase connection
- [ ] Tested with localStorage fallback scenario
- [ ] Quick smoke tests completed (see `QUICK-PRE-DEPLOYMENT-CHECKLIST.md`)

#### **Documentation**
- [ ] Changes documented in code comments
- [ ] Breaking changes documented
- [ ] Migration steps documented (if needed)

---

### **3.2 Deployment Safety Checks**

**Before running `netlify-cli deploy --prod`:**

- [ ] All pre-deployment checklist items completed
- [ ] Rollback plan prepared
- [ ] Deployment message describes changes clearly
- [ ] No breaking changes without migration plan

---

## 🔄 **LAYER 4: POST-DEPLOYMENT VERIFICATION**

### **4.1 Immediate Smoke Tests (First 5 Minutes)**

**After deployment, immediately test:**

- [ ] Site loads: https://mediforge.netlify.app
- [ ] Login works
- [ ] Dashboard loads
- [ ] Can create test patient
- [ ] Can create test appointment
- [ ] No console errors (check browser console)

### **4.2 Critical Path Verification (Within 30 Minutes)**

- [ ] All critical workflows tested on production
- [ ] Data persistence verified (check Supabase dashboard)
- [ ] No user-reported errors
- [ ] Performance acceptable

### **4.3 Monitoring (Within 24 Hours)**

- [ ] Monitor user reports
- [ ] Check error logs (if available)
- [ ] Verify no regressions reported
- [ ] Check analytics (if available)

---

## 🚨 **LAYER 5: ROLLBACK PROCEDURE**

### **5.1 When to Rollback**

**Immediately rollback if:**
- Critical workflow broken
- Data loss detected
- Authentication broken
- Multiple users reporting issues
- Console errors in production

### **5.2 Rollback Steps**

```bash
# Step 1: Identify last working commit
git log --oneline -10

# Step 2: Revert to previous commit
git revert HEAD
git push origin main
# Netlify will auto-deploy previous version

# OR deploy specific previous version
git checkout <previous-commit-hash>
npx netlify-cli deploy --prod --dir . --message "ROLLBACK: Reverting to previous version"
```

### **5.3 Post-Rollback**

- [ ] Verify site functions correctly
- [ ] No data loss occurred
- [ ] Document what broke and why
- [ ] Fix issue in development
- [ ] Re-test before re-deploying

---

## 📋 **LAYER 6: CHANGE MANAGEMENT PROCESS**

### **6.1 Change Request Template**

**For every change request, document:**

1. **What:** What is being changed?
2. **Why:** Why is this change needed?
3. **Impact:** What could break?
4. **Testing:** How will it be tested?
5. **Rollback:** How to rollback if it breaks?

### **6.2 Change Categories**

**Category 1: Critical Changes** (Requires extra caution)
- Data model changes
- Authentication changes
- Patient ID resolution changes
- Supabase schema changes

**Category 2: Feature Additions** (Standard process)
- New features
- UI improvements
- New pages

**Category 3: Bug Fixes** (Standard process)
- Fixing broken functionality
- Performance improvements

---

## 🎯 **LAYER 7: CRITICAL PATTERNS TO NEVER BREAK**

### **7.1 Patient ID Resolution**

**NEVER BREAK THIS:**
```javascript
// CORRECT: Always use resolvePatientByIdentifier
const patient = await window.resolvePatientByIdentifier(patientId);
// patient.id is ALWAYS legacy ID (MEC0011), NEVER UUID
// patient._supabaseUuid contains the UUID
```

**What breaks if this breaks:**
- All patient detail pages
- All patient-related operations
- Clinical notes
- Appointments
- Billing

### **7.2 Supabase-First Architecture**

**NEVER BREAK THIS:**
```javascript
// CORRECT: Supabase-first pattern
const result = await supabaseClient.from('table').insert(data);
if (result.success) {
  localStorage.setItem(key, JSON.stringify(data)); // Cache only
} else {
  localStorage.setItem(key, JSON.stringify(data)); // Fallback
}
```

**What breaks if this breaks:**
- Data persistence
- Multi-device sync
- Data integrity

### **7.3 Organization Scoping**

**NEVER BREAK THIS:**
```javascript
// CORRECT: Always scope by organization_id
const orgId = user.organizationId || user.organization_id;
const data = await supabaseClient
  .from('table')
  .select('*')
  .eq('organization_id', orgId);
```

**What breaks if this breaks:**
- Data isolation
- Multi-tenant security
- Organization data access

---

## 🔧 **IMPLEMENTATION CHECKLIST**

### **Immediate Actions (This Week)**

- [x] Create this framework document
- [x] Create quick pre-deployment checklist (`QUICK-PRE-DEPLOYMENT-CHECKLIST.md`)
- [x] Create local testing guide (`LOCAL-TESTING-GUIDE.md`)
- [x] Create syntax validation script (`scripts/quick-syntax-check.ps1`)
- [x] Create pre-deployment validation script (`scripts/pre-deployment-validation.ps1`)
- [ ] Set up automated testing framework (Jest)
- [ ] Create critical workflow test suite
- [ ] Set up pre-commit hooks (if using Git)

### **Short Term (This Month)**

- [ ] Implement unit tests for critical functions
- [ ] Create integration test suite
- [ ] Set up staging environment (if possible)
- [ ] Create automated regression tests
- [ ] Set up error monitoring (if available)

### **Long Term (Next Quarter)**

- [ ] Full test coverage for critical paths
- [ ] Automated deployment pipeline with tests
- [ ] Performance monitoring
- [ ] User feedback integration
- [ ] Automated rollback triggers

---

## 📊 **SUCCESS METRICS**

**Track these metrics to measure framework effectiveness:**

- **Regression Rate:** Number of broken features per deployment
- **Rollback Rate:** Number of rollbacks per month
- **User Complaints:** Number of user-reported issues post-deployment
- **Test Coverage:** Percentage of critical code covered by tests
- **Deployment Confidence:** Pre-deployment checklist completion rate

**Target:** Zero regressions, zero rollbacks, zero user complaints

---

## 🎓 **BEST PRACTICES**

### **DO:**
✅ Make small, incremental changes
✅ Test locally before deploying
✅ Follow Supabase-first architecture
✅ Use existing patterns and utilities
✅ Document breaking changes
✅ Have a rollback plan

### **DON'T:**
❌ Make large refactors without testing
❌ Deploy without testing critical workflows
❌ Break Supabase-first architecture
❌ Change patient ID resolution logic
❌ Deploy on Friday (no weekend support)
❌ Skip the pre-deployment checklist

---

## 📞 **ESCALATION**

**If you're unsure about a change:**
1. Review this framework
2. Check `CRITICAL-WORKFLOWS.md`
3. Test locally thoroughly
4. Ask for review before deploying
5. When in doubt, don't deploy

---

**Last Updated:** Current Session  
**Status:** ✅ **ACTIVE** - All deployments must follow this framework


