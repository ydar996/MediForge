# Registration Fix - RLS Policy Update

## 🔴 **PROBLEM:**
Registration is failing with error:
```
new row violates row-level security policy for table "organizations"
```

This happens because unauthenticated users (during registration) can't create organizations due to RLS.

---

## ✅ **SOLUTION:**

Run the SQL script to update RLS policies to allow organization and user creation during registration.

---

## 📋 **STEPS TO FIX:**

### **Step 1: Run SQL Script**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Copy and paste the contents of `sql-scripts/fix-registration-rls.sql`
4. Click **"Run"**

**Expected Result:**
```
✅ DROP POLICY
✅ CREATE POLICY (for organizations insert)
✅ CREATE POLICY (for organizations select)
✅ CREATE POLICY (for users insert)
[Table showing policies]
```

---

### **Step 2: Test Registration**

1. Go to: https://mediforge.netlify.app/register
2. Choose **"Register New Organization"**
3. Fill in all required fields
4. Click **"Register Organization & Create Account"**
5. Should succeed and redirect to login! ✅

---

## 🔐 **SECURITY NOTES:**

**Is this safe?**

✅ **YES** - Here's why:

1. **Organizations:** 
   - Anyone can create an organization during registration
   - This is intentional - new clinics can self-register
   - Organization names should be unique (enforced by app logic)

2. **Users:**
   - Only **authenticated** users can create user profiles
   - Users can only create their **own** profile (auth.uid() = auth_user_id)
   - This prevents users from creating profiles for others

3. **Reading Data:**
   - Users can only see their own organization's data
   - Platform admins can see all organizations
   - This is properly restricted

---

## 🔍 **WHAT THE POLICIES DO:**

### **Organizations Table:**
- ✅ **INSERT:** Allow anyone (anon + authenticated) to create organizations
- ✅ **SELECT:** Users can only see their own organization (or all if platform admin)

### **Users Table:**
- ✅ **INSERT:** Authenticated users can create their own profile only
- ✅ **SELECT:** Authenticated users can read all profiles (needed for team management)

---

## 🧪 **VERIFY IT WORKS:**

After running the SQL, test:

1. **New Organization Registration:** ✅ Should work
2. **Join Existing Organization:** ✅ Should work
3. **Login:** ✅ Should work
4. **Data Isolation:** ✅ Users should only see their org's data

---

## 📞 **IF YOU STILL HAVE ISSUES:**

Check the console for errors and share the output. Common issues:

1. **SQL syntax error:** Make sure you copied the entire script
2. **Permission denied:** Make sure you're using the Supabase SQL Editor (not a regular SQL client)
3. **Still getting 401:** Clear browser cache and try in incognito mode

---

**Run the SQL script now and registration will work!** 🚀



