# 🔍 Registration Diagnostic Report

## Problem Summary
Registration was working fine before, but now some users are experiencing failures. "Shak Medical Consult" registered on 12/23/2025, but contact information cannot be retrieved.

---

## 🔴 **ROOT CAUSES IDENTIFIED**

### 1. **RLS (Row Level Security) Policy Issues** ⚠️ **MOST LIKELY CAUSE**

**Problem:**
- RLS policies may have been changed, reset, or are blocking registration
- Error: `"new row violates row-level security policy for table 'organizations'"`
- This would cause registration to fail for some users but not others (depending on timing/caching)

**Evidence:**
- `REGISTRATION-FIX-INSTRUCTIONS.md` documents this exact issue
- File exists: `sql-scripts/fix-registration-rls.sql` (fix script)
- Registration requires unauthenticated users to create organizations, which RLS may block

**Impact:**
- ✅ **High** - Would completely block new organization registration
- ✅ **Intermittent** - May work sometimes if policies are inconsistent

**Fix:**
- Run `sql-scripts/fix-registration-rls.sql` in Supabase SQL Editor
- Verify RLS policies allow anonymous users to INSERT into organizations table

---

### 2. **Retry Logic Bug - Missing `created_by` Field** 🐛

**Problem:**
- When organization creation fails and retries, the retry code (line 1366-1379) omits the `created_by` field
- Original insert includes `created_by` (line 1334), but retry doesn't
- This could cause:
  - Data inconsistency
  - Tracking issues
  - Potential constraint violations if `created_by` is required

**Location:** `register.html` lines 1366-1379

**Code Comparison:**
```javascript
// Original insert (line 1321-1336) - HAS created_by
.insert([{
  name: orgData.name,
  // ... other fields ...
  created_by: document.getElementById('admin-username').value // ✅ Present
}])

// Retry insert (line 1366-1379) - MISSING created_by
.insert([{
  name: orgData.name,
  // ... other fields ...
  // ❌ created_by is MISSING
}])
```

**Impact:**
- ✅ **Medium** - Could cause partial registration failures
- ✅ **Data Quality** - Organizations created via retry won't have creator tracked

**Fix:**
- Add `created_by` field to retry insert statement

---

### 3. **Partial Registration Failures** ⚠️

**Problem:**
- Registration happens in multiple steps:
  1. Create organization ✅
  2. Create admin user ❌ (can fail here)
  3. Update organization email ❌ (new code, can fail)
  
- If step 2 or 3 fails, you end up with:
  - ✅ Organization exists in database
  - ❌ No admin user (or orphaned Auth user)
  - ❌ No organization email populated
  - ❌ Cannot retrieve contact information

**This matches "Shak Medical Consult" scenario:**
- Organization registered on 12/23/2025
- But contact info cannot be retrieved
- Likely means: Organization exists, but admin user creation failed

**Possible Failure Points:**
1. Network interruption between org creation and user creation
2. Username already taken (preflight check may have passed but actual insert failed)
3. Auth user creation succeeded but profile creation failed
4. RLS blocking user profile creation

**Impact:**
- ✅ **High** - Results in incomplete registrations
- ✅ **Data Loss** - Organizations without admin users

**Fix:**
- Add transaction/rollback logic (if possible with Supabase)
- Better error handling and cleanup
- Retry logic for user creation
- Diagnostic queries to find orphaned organizations

---

### 4. **Username Availability Race Condition** 🏃

**Problem:**
- Preflight check verifies username availability (line 1233)
- But between preflight and actual registration, another user could register with same username
- This would cause registration to fail at user creation step

**Impact:**
- ✅ **Low-Medium** - Rare but possible with concurrent registrations
- ✅ **User Experience** - User sees "username available" but registration fails

**Fix:**
- Add unique constraint handling
- Better error messages
- Retry with different username suggestion

---

### 5. **Network/Connection Issues** 📡

**Problem:**
- Registration has multiple network calls:
  - Organization insert
  - Auth user creation
  - User profile insert
  - Organization email update (new)
  
- If network fails between any steps, registration is incomplete
- Mobile/slow connections more likely to fail

**Impact:**
- ✅ **Medium** - Affects users with poor connectivity
- ✅ **Intermittent** - Works sometimes, fails other times

**Fix:**
- Better retry logic (already exists but could be improved)
- Offline queue for retry
- Better error messages

---

## 🔍 **DIAGNOSTIC QUERIES**

### Check for Orphaned Organizations (like "Shak Medical Consult")

```sql
-- Find organizations without admin users
SELECT 
  o.id,
  o.name,
  o.created_at,
  o.created_by,
  o.email,
  COUNT(u.id) as user_count
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'Admin'
WHERE o.created_at >= '2025-12-23'
GROUP BY o.id, o.name, o.created_at, o.created_by, o.email
HAVING COUNT(u.id) = 0
ORDER BY o.created_at DESC;
```

### Check RLS Policies

```sql
-- Verify RLS policies for organizations table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY policyname;
```

### Check for Failed Registrations

```sql
-- Find organizations created but with no users at all
SELECT 
  o.id,
  o.name,
  o.created_at,
  o.created_by,
  o.email,
  COUNT(u.id) as total_users
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
WHERE o.created_at >= '2025-12-20'
GROUP BY o.id, o.name, o.created_at, o.created_by, o.email
HAVING COUNT(u.id) = 0
ORDER BY o.created_at DESC;
```

---

## ✅ **RECOMMENDED FIXES (Priority Order)**

### **Priority 1: Fix RLS Policies** 🔴 **CRITICAL**

1. Run `sql-scripts/fix-registration-rls.sql` in Supabase SQL Editor
2. Verify policies allow anonymous INSERT into organizations
3. Test registration immediately after

**Why First:**
- Most likely cause of sudden failures
- Would affect all new registrations
- Quick fix (5 minutes)

---

### **Priority 2: Fix Retry Logic Bug** 🟡 **HIGH**

1. Add `created_by` field to retry insert (line 1378)
2. Ensure retry logic matches original insert exactly

**Code Fix:**
```javascript
// Line 1366-1379: Add created_by to retry
const { data: retryOrgResult, error: retryOrgError } = await window.supabaseClient
  .from('organizations')
  .insert([{
    name: orgData.name,
    country: orgData.country,
    state: orgData.state,
    city: orgData.city,
    address_line1: orgData.addressLine1,
    address_line2: orgData.addressLine2,
    phone: orgData.phone,
    after_hours_phone: orgData.afterHoursPhone,
    org_code: generatedOrgCode,
    created_at: orgData.createdAt,
    created_by: document.getElementById('admin-username').value // ✅ ADD THIS
  }])
  .select('id');
```

---

### **Priority 3: Add Diagnostic Queries** 🟢 **MEDIUM**

1. Create script to find orphaned organizations
2. Create script to find organizations without admin users
3. Run periodically to catch partial registrations

---

### **Priority 4: Improve Error Handling** 🟢 **LOW**

1. Add transaction-like cleanup (delete org if user creation fails)
2. Better error messages
3. Retry logic improvements

---

## 🧪 **TESTING CHECKLIST**

After applying fixes:

- [ ] Test new organization registration (should succeed)
- [ ] Test join existing organization (should succeed)
- [ ] Test with slow network connection (should retry)
- [ ] Test with duplicate username (should show clear error)
- [ ] Run diagnostic queries to find orphaned orgs
- [ ] Verify "Shak Medical Consult" can be found with contact info

---

## 📊 **FOR "SHAK MEDICAL CONSULT" SPECIFICALLY**

Run these queries to diagnose:

```sql
-- 1. Find the organization
SELECT * FROM organizations 
WHERE name ILIKE '%Shak Medical Consult%' 
   OR created_at::date = '2025-12-23';

-- 2. Check if admin user exists
SELECT u.* 
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE o.name ILIKE '%Shak Medical Consult%'
  AND u.role = 'Admin';

-- 3. Check for any users in this org
SELECT COUNT(*) as user_count
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE o.name ILIKE '%Shak Medical Consult%';
```

**Expected Results:**
- If organization exists but no users: **Partial registration failure**
- If organization doesn't exist: **Complete registration failure**
- If users exist but no admin: **Role assignment issue**

---

## 🎯 **IMMEDIATE ACTION ITEMS**

1. ✅ **Check RLS Policies** - Run diagnostic query above
2. ✅ **Fix RLS if needed** - Run `fix-registration-rls.sql`
3. ✅ **Fix retry logic bug** - Add `created_by` field
4. ✅ **Run diagnostic queries** - Find orphaned organizations
5. ✅ **Test registration** - Verify fix works
6. ✅ **Deploy fixes** - Update production code

---

## 📝 **SUMMARY**

**Most Likely Cause:** RLS policies blocking registration

**Secondary Issues:**
- Retry logic bug (missing `created_by`)
- Partial registration failures (org created, user not)
- Network issues causing incomplete registrations

**Quick Fix:** Run RLS fix script + fix retry logic bug

**Long-term:** Add better error handling and diagnostic tools

---

**Last Updated:** Current Session  
**Status:** Awaiting Fix Implementation

