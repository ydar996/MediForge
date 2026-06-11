# 🚀 DAY 2 QUICK START GUIDE

**Goal:** Get Supabase Authentication working in 1-2 hours

---

## 📋 WHAT YOU NEED

- ✅ Supabase account (from Day 1)
- ✅ Project: mediforge-prod
- ✅ At least 1 user in localStorage (check with F12 → Console → `JSON.parse(localStorage.getItem('users'))`)

---

## 🎯 3 SIMPLE STEPS

### **STEP 1: Create Organization (5 minutes)**

1. Go to: https://supabase.com/dashboard
2. Open your project: **mediforge-prod**
3. Click **SQL Editor** (left menu)
4. Click **New Query**
5. Copy **ALL** content from: `sql-scripts/create-initial-organization.sql`
6. Paste into SQL Editor
7. Click **RUN** (or Ctrl+Enter)
8. **COPY THE ORGANIZATION ID** from the result (you'll need it!)

**Expected result:**
```
id: 123e4567-e89b-12d3-a456-426614174000  ← COPY THIS!
name: Mecure Clinics
org_code: MEC-20251014
country: Nigeria
```

---

### **STEP 2: Migrate Your First User (10-15 minutes)**

Let's migrate just **ONE user** to start (you can migrate others later).

#### **2A: Create Auth User**

1. Still in Supabase Dashboard → Click **Authentication** (left menu)
2. Click **Users** tab
3. Click **Add user** → **Create new user**
4. Fill in:
   - Email: `admin@temp.ehrapp.local`
   - Password: `ChangeMe123!`
   - Auto Confirm Email: ✅ **CHECK THIS BOX!**
5. Click **Create user**
6. **COPY THE USER ID** (UUID that appears)

#### **2B: Create User Profile**

1. Go back to **SQL Editor**
2. Run this query (**REPLACE THE VALUES!**):

```sql
-- Replace these 3 values:
-- 1. '123e4567...' = User ID from Step 2A
-- 2. 'org-uuid...' = Organization ID from Step 1
-- 3. Update username/name to match your actual user

INSERT INTO users (
  auth_user_id,
  username,
  first_name,
  last_name,
  gender,
  role,
  organization_id,
  medical_license_number
) VALUES (
  '123e4567-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- ← User ID from Step 2A
  'admin',                                   -- ← Your username
  'Admin',                                   -- ← First name
  'User',                                    -- ← Last name
  'Male',
  'Doctor',
  'org-uuid-from-step-1',                    -- ← Org ID from Step 1
  ''
)
RETURNING *;
```

3. Click **RUN**

**Expected result:** You should see the user profile data returned.

---

### **STEP 3: Test Login (5 minutes)**

1. Open your MediForge app
2. Go to `login.html`
3. Enter:
   - **Username:** `admin` (or `admin@temp.ehrapp.local`)
   - **Password:** `ChangeMe123!`
4. Click **Login**
5. Should redirect to dashboard! 🎉

---

## ✅ VERIFY IT WORKED

### **Quick Verification:**

1. Open `test-auth-system.html` in your browser
2. It will automatically run tests
3. You should see:
   - ✅ Supabase connection: SUCCESS
   - ✅ Current session: LOGGED IN
   - ✅ Organizations: Found 1
   - ✅ Users: Found 1
   - ✅ RLS tests: ALLOWED

### **Test Creating a Patient:**

1. Go to `add-patient.html`
2. Fill in patient details
3. Click **Save**
4. Should work! (Previously blocked by RLS)
5. Verify in Supabase Dashboard → **Table Editor** → **patients**

---

## 🐛 TROUBLESHOOTING

### **Problem: "Invalid login credentials"**

- Make sure email is: `admin@temp.ehrapp.local`
- Make sure password is exactly: `ChangeMe123!`
- Check Supabase Dashboard → Authentication → Users (user should exist)

### **Problem: "User profile not found"**

- You forgot Step 2B (creating user profile)
- Go back and run the INSERT query

### **Problem: "Organization not found"**

- You forgot Step 1 (creating organization)
- Go back and run the SQL script

### **Problem: "new row violates row-level security policy"**

- You're not logged in
- Go to `login.html` and log in first
- Check `test-auth-system.html` to verify session

---

## 📊 WHAT WE BUILT TODAY

### **Before Day 2:**
```
Login → Check localStorage → Dashboard
Create patient → Supabase blocks (no auth) → ❌ FAILS
```

### **After Day 2:**
```
Login → Check Supabase Auth → Get JWT token → Dashboard
Create patient → Send token → RLS checks token → ✅ WORKS!
```

---

## 🎯 WHAT'S NEXT?

**Day 3:** Migrate ALL your data (organizations, patients, appointments, etc.)

For now, you have:
- ✅ Authentication working
- ✅ Can create data in Supabase
- ✅ RLS allowing authenticated operations
- ✅ One user migrated (others can be added later)

---

## 💡 TIPS

1. **Migrate users one at a time** - Don't rush, verify each works
2. **Keep localStorage users** - They're your backup!
3. **Test frequently** - Use `test-auth-system.html` after each change
4. **Check browser console** - Press F12 to see detailed logs

---

## 🆘 NEED HELP?

If stuck, check:
1. Browser console (F12) for error messages
2. Supabase Dashboard → Logs
3. `test-auth-system.html` for diagnostic info
4. `DAY-2-INSTRUCTIONS.md` for detailed explanation

---

**Ready? START WITH STEP 1! 🚀**

Total time: 20-30 minutes for basic setup + testing



