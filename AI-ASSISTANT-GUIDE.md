# 🤖 AI ASSISTANT GUIDE - Production Stability Protocol

**Purpose:** This guide ensures I (the AI assistant) follow proper procedures to prevent breaking production functionality.

---

## 🚨 **MANDATORY PROTOCOL - BEFORE EVERY CHANGE**

### **Step 1: Impact Analysis** ✅

**Before making ANY code change, I MUST:**

1. **Identify Affected Files**
   - List all files that will be modified
   - Use `codebase_search` to find dependencies
   - Check what uses the files I'm modifying

2. **Check Critical Patterns**
   - ✅ Patient ID resolution (`resolvePatientByIdentifier`)
   - ✅ Supabase-first architecture
   - ✅ Organization scoping
   - ✅ UUID vs legacy ID handling

3. **Review Critical Workflows**
   - Check `CRITICAL-WORKFLOWS.md` for affected workflows
   - Identify which workflows will be impacted
   - Plan testing approach

---

### **Step 2: Code Change Strategy** ✅

**When making changes:**

1. **Make Incremental Changes**
   - Small, focused changes are safer
   - One feature/fix at a time
   - Test after each change

2. **Preserve Existing Patterns**
   - Follow existing code patterns
   - Use existing utility functions
   - Don't reinvent the wheel

3. **Maintain Architecture**
   - ✅ Supabase-first: Always try Supabase first
   - ✅ localStorage fallback: Only as cache/fallback
   - ✅ Patient ID: Always use `resolvePatientByIdentifier`
   - ✅ Organization scoping: Always filter by `organization_id`

---

### **Step 3: Testing Before Deployment** ✅

**Before deploying, I MUST:**

1. **Run Pre-Deployment Checks**
   ```powershell
   .\scripts\pre-deployment-check.ps1 "Deployment message"
   ```

2. **Test Critical Workflows**
   - Patient creation
   - Patient editing
   - Appointment scheduling
   - Clinical notes
   - Registration

3. **Verify Architecture Compliance**
   - Check Supabase-first pattern
   - Verify patient ID resolution
   - Confirm organization scoping

---

### **Step 4: Deployment Process** ✅

**When deploying:**

1. **Use Descriptive Messages**
   ```bash
   npx netlify-cli deploy --prod --dir . --message "FIX: [What] - [Why] - [Impact]"
   ```

2. **Include Architecture Notes**
   - Mention if Supabase-first maintained
   - Note any breaking changes
   - Document migration steps (if needed)

3. **Deploy During Business Hours**
   - Avoid Friday deployments
   - Deploy when support is available
   - Monitor immediately after deployment

---

## 🎯 **CRITICAL PATTERNS TO NEVER BREAK**

### **Pattern 1: Patient ID Resolution**

**NEVER DO THIS:**
```javascript
// ❌ WRONG: Assigning UUID to patient.id
patient.id = supabasePatient.id; // UUID - BREAKS EVERYTHING!
```

**ALWAYS DO THIS:**
```javascript
// ✅ CORRECT: Use resolvePatientByIdentifier
const patient = await window.resolvePatientByIdentifier(patientId);
// patient.id is ALWAYS legacy ID (MEC0011)
// patient._supabaseUuid contains UUID
```

**What Breaks:** All patient pages, clinical notes, appointments, billing

---

### **Pattern 2: Supabase-First Architecture**

**NEVER DO THIS:**
```javascript
// ❌ WRONG: localStorage before Supabase
localStorage.setItem('patients', JSON.stringify(patients));
await supabaseClient.from('patients').insert(data);
```

**ALWAYS DO THIS:**
```javascript
// ✅ CORRECT: Supabase first, localStorage as cache
const result = await supabaseClient.from('patients').insert(data);
if (result.success) {
  localStorage.setItem('patients', JSON.stringify(patients)); // Cache
} else {
  localStorage.setItem('patients', JSON.stringify(patients)); // Fallback
}
```

**What Breaks:** Data sync, multi-device access, data integrity

---

### **Pattern 3: Organization Scoping**

**NEVER DO THIS:**
```javascript
// ❌ WRONG: No organization filter
const patients = await supabaseClient.from('patients').select('*');
```

**ALWAYS DO THIS:**
```javascript
// ✅ CORRECT: Always filter by organization_id
const user = JSON.parse(localStorage.getItem("user") || "{}");
const orgId = user.organizationId || user.organization_id;
const patients = await supabaseClient
  .from('patients')
  .select('*')
  .eq('organization_id', orgId);
```

**What Breaks:** Data isolation, security, multi-tenant functionality

---

## 📋 **QUICK REFERENCE CHECKLIST**

**Before EVERY change, verify:**

- [ ] Impact analysis completed
- [ ] Critical workflows identified
- [ ] Architecture compliance maintained
- [ ] Patient ID resolution correct
- [ ] Supabase-first pattern preserved
- [ ] Organization scoping maintained
- [ ] Tested locally
- [ ] Pre-deployment checks passed
- [ ] Rollback plan prepared

---

## 🚨 **RED FLAGS - STOP AND ASK**

**If I encounter any of these, I MUST stop and clarify:**

1. **Breaking Changes**
   - Changing data structure
   - Modifying patient ID format
   - Changing Supabase schema
   - Removing existing functionality

2. **High-Risk Changes**
   - Modifying `resolvePatientByIdentifier`
   - Changing Supabase adapter logic
   - Modifying authentication flow
   - Changing organization scoping

3. **Unclear Requirements**
   - User request is ambiguous
   - Multiple ways to implement
   - Potential side effects unknown

---

## ✅ **SUCCESS CRITERIA**

**A change is successful if:**

1. ✅ No existing functionality broken
2. ✅ Critical workflows still work
3. ✅ Architecture compliance maintained
4. ✅ No user complaints
5. ✅ No rollback required
6. ✅ Data integrity preserved

---

## 📚 **REFERENCE DOCUMENTS**

**Always consult these before making changes:**

1. `PRODUCTION-STABILITY-FRAMEWORK.md` - Full framework
2. `CRITICAL-WORKFLOWS.md` - Critical workflows to test
3. `DEPLOYMENT-CHECKLIST.md` - Pre-deployment checklist
4. `PRE-CHANGE-IMPACT-ANALYSIS.md` - Impact analysis template
5. `HANDOVER-NOTE-HYBRID-ARCHITECTURE.md` - Architecture details

---

**Last Updated:** Current Session  
**Status:** ✅ **ACTIVE** - Must follow for all changes


