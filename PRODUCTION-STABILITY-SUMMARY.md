# 🛡️ PRODUCTION STABILITY - WHAT'S IN PLACE

**Status:** ✅ **ACTIVE** - All changes must follow these safeguards

---

## ✅ **WHAT'S CURRENTLY IN PLACE**

### **1. Documentation Framework** ✅

- ✅ `PRODUCTION-STABILITY-FRAMEWORK.md` - Complete framework
- ✅ `CRITICAL-WORKFLOWS.md` - Critical workflows to test
- ✅ `DEPLOYMENT-CHECKLIST.md` - Pre-deployment checklist
- ✅ `PRE-CHANGE-IMPACT-ANALYSIS.md` - Impact analysis template
- ✅ `AI-ASSISTANT-GUIDE.md` - Guide for AI assistant (me)

### **2. Automated Validation Scripts** ✅

- ✅ `scripts/pre-deployment-check.ps1` - Pre-deployment validation
- ✅ `scripts/quick-test-critical-workflows.ps1` - Quick workflow tests

### **3. Critical Pattern Protection** ✅

**Protected Patterns:**
- ✅ Patient ID resolution (`resolvePatientByIdentifier`)
- ✅ Supabase-first architecture
- ✅ Organization scoping
- ✅ UUID vs legacy ID handling

---

## 🔒 **MANDATORY PROCESS - BEFORE EVERY CHANGE**

### **Step 1: Impact Analysis** (I will do this)

1. Identify affected files
2. Map dependencies
3. Check critical workflows
4. Assess risk level

### **Step 2: Code Changes** (I will do this)

1. Follow existing patterns
2. Maintain architecture compliance
3. Preserve critical patterns
4. Make incremental changes

### **Step 3: Pre-Deployment Validation** (I will do this)

1. Run validation script
2. Test critical workflows
3. Verify architecture compliance
4. Check for common errors

### **Step 4: Deployment** (I will do this)

1. Use descriptive deployment message
2. Include architecture notes
3. Deploy during business hours
4. Monitor immediately after

### **Step 5: Post-Deployment Verification** (You should do this)

1. Test critical workflows
2. Check browser console
3. Monitor user reports
4. Verify no regressions

---

## 🎯 **WHAT I WILL DO FOR EVERY CHANGE**

### **Before Making Changes:**

1. ✅ **Impact Analysis**
   - Search codebase for dependencies
   - Identify affected workflows
   - Assess risk level

2. ✅ **Architecture Check**
   - Verify Supabase-first pattern
   - Check patient ID resolution
   - Confirm organization scoping

3. ✅ **Pattern Preservation**
   - Use existing utility functions
   - Follow existing code patterns
   - Maintain backward compatibility

### **During Code Changes:**

1. ✅ **Incremental Changes**
   - Small, focused changes
   - One feature at a time
   - Test after each change

2. ✅ **Code Quality**
   - No syntax errors
   - Follow existing patterns
   - Add helpful comments

3. ✅ **Error Handling**
   - Graceful degradation
   - Clear error messages
   - Fallback mechanisms

### **Before Deployment:**

1. ✅ **Validation**
   - Run pre-deployment checks
   - Test critical workflows
   - Verify architecture compliance

2. ✅ **Documentation**
   - Clear deployment message
   - Note architecture compliance
   - Document breaking changes (if any)

### **After Deployment:**

1. ✅ **Monitoring**
   - Check deployment status
   - Verify no errors
   - Provide rollback instructions (if needed)

---

## 🚨 **RED FLAGS - I WILL STOP AND ASK**

**If I encounter:**

1. **Breaking Changes**
   - Data structure changes
   - Patient ID format changes
   - Supabase schema changes

2. **High-Risk Changes**
   - Modifying `resolvePatientByIdentifier`
   - Changing Supabase adapter
   - Modifying authentication

3. **Unclear Requirements**
   - Ambiguous user request
   - Multiple implementation options
   - Unknown side effects

---

## 📋 **QUICK REFERENCE FOR YOU**

### **Before Requesting Changes:**

1. **Be Specific**
   - What exactly needs to change?
   - Why is this change needed?
   - What could break?

2. **Provide Context**
   - Which page/feature?
   - What's the current behavior?
   - What's the desired behavior?

3. **Set Expectations**
   - Is this urgent?
   - Can it wait for testing?
   - What's the rollback plan?

### **After I Make Changes:**

1. **Test Locally** (if possible)
   - Run local server
   - Test affected workflows
   - Check browser console

2. **Review Changes**
   - Check what files were modified
   - Review deployment message
   - Verify architecture compliance

3. **Monitor Production**
   - Test critical workflows
   - Check for user complaints
   - Monitor error logs

---

## 🔧 **TOOLS AVAILABLE**

### **For You:**

1. **Pre-Deployment Validation**
   ```powershell
   .\scripts\pre-deployment-check.ps1 "Your deployment message"
   ```

2. **Quick Workflow Tests**
   ```powershell
   .\scripts\quick-test-critical-workflows.ps1
   ```

3. **Manual Checklist**
   - See `DEPLOYMENT-CHECKLIST.md`
   - Complete before every deployment

### **For Me (AI Assistant):**

1. **Codebase Search**
   - Find dependencies
   - Identify affected workflows
   - Check existing patterns

2. **Impact Analysis**
   - Map data flow
   - Identify risks
   - Plan testing approach

3. **Architecture Verification**
   - Check Supabase-first pattern
   - Verify patient ID resolution
   - Confirm organization scoping

---

## 📊 **SUCCESS METRICS**

**We'll track:**

- **Regression Rate:** Number of broken features per deployment
- **Rollback Rate:** Number of rollbacks per month
- **User Complaints:** Number of user-reported issues
- **Deployment Confidence:** Checklist completion rate

**Target:** Zero regressions, zero rollbacks, zero user complaints

---

## 🎓 **BEST PRACTICES**

### **DO:**

✅ Make small, incremental changes  
✅ Test locally before deploying  
✅ Follow Supabase-first architecture  
✅ Use existing patterns  
✅ Document breaking changes  
✅ Have a rollback plan  

### **DON'T:**

❌ Make large refactors without testing  
❌ Deploy without testing critical workflows  
❌ Break Supabase-first architecture  
❌ Change patient ID resolution logic  
❌ Deploy on Friday  
❌ Skip the pre-deployment checklist  

---

## 📞 **WHEN TO ESCALATE**

**If you're unsure:**

1. Review this framework
2. Check `CRITICAL-WORKFLOWS.md`
3. Test locally thoroughly
4. Ask for review before deploying
5. When in doubt, don't deploy

---

**Last Updated:** Current Session  
**Status:** ✅ **ACTIVE** - All changes must follow this framework


