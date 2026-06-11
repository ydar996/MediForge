# ⚡ REGRESSION PREVENTION - QUICK REFERENCE

**Use this as a quick checklist when making changes.**

---

## 🚦 THE 5-MINUTE CHECK

Before making ANY code change, ask:

1. **Which files am I modifying?**
   - List them: ________________

2. **What depends on these files?**
   - Other modules: ________________
   - Other pages: ________________

3. **Does this affect patient IDs?**
   - ⚠️ If YES → CRITICAL: Ensure `patient.id` is NEVER a UUID

4. **Does this affect data persistence?**
   - ⚠️ If YES → CRITICAL: Ensure Supabase-first architecture is preserved

5. **What could break?**
   - List potential issues: ________________

---

## ✅ THE 3 MUST-CHECK POINTS

Every change MUST verify:

1. ✅ **Patient ID Handling**
   - `patient.id` is legacy ID (MEC0012), NOT UUID
   - UUID is in `patient._supabaseUuid` field

2. ✅ **Data Persistence**
   - Supabase tried first
   - localStorage fallback works

3. ✅ **Critical Workflows**
   - Patient management works
   - Appointments work
   - Clinical notes work

---

## 🧪 THE 5-MINUTE TEST

After making changes, test these immediately:

1. **Create a test patient**
   - ✅ Saves to Supabase
   - ✅ `patient.id` is legacy ID (not UUID)

2. **Edit the patient**
   - ✅ Updates work
   - ✅ Data persists

3. **View patient details**
   - ✅ Loads correctly
   - ✅ Can navigate to related pages

---

## 🚨 RED FLAGS - STOP IMMEDIATELY

If you see any of these, STOP and fix before deploying:

- ❌ Tests failing
- ❌ `patient.id` is a UUID (should be legacy ID)
- ❌ Supabase-first architecture broken
- ❌ Console errors
- ❌ Critical workflow broken

---

## 📋 PRE-DEPLOYMENT MINIMUM CHECKLIST

- [ ] All automated tests pass
- [ ] Manual test: Create patient → Works
- [ ] Manual test: Edit appointment → Fields pre-populate
- [ ] Manual test: View patient summary → Medications/conditions show
- [ ] No console errors
- [ ] `patient.id` is NOT a UUID anywhere

---

## 🔍 QUICK DEBUGGING

**Issue: Patient ID is UUID instead of legacy ID**

Check:
- `resolvePatientByIdentifier` return value
- Patient object after loading from Supabase
- Ensure `patient_id` (not UUID) is used for `id` field

**Issue: Medications/Conditions not showing**

Check:
- Field names: `event`, `diagnosis`, `name`, etc.
- Status filtering: `active`, `current`, `signed`, etc.
- Case-insensitive matching

**Issue: Provider name shows "Not specified"**

Check:
- Field names: `doctor`, `doctor_name`, `provider`, `provider_name`
- Appointment data structure
- Doctor dropdown population

---

## 📚 REFERENCE DOCUMENTS

- **Full Strategy:** `REGRESSION-PREVENTION-STRATEGY.md`
- **Critical Workflows:** `CRITICAL-WORKFLOWS.md`
- **Impact Analysis:** `PRE-CHANGE-IMPACT-ANALYSIS.md`
- **Deployment Checklist:** `DEPLOYMENT-CHECKLIST.md`
- **Test Setup:** `TEST-FRAMEWORK-SETUP.md`

---

**Remember: When in doubt, test it out!**

