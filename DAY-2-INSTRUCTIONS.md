# 📅 DAY 2: AUTHENTICATION MIGRATION - STEP BY STEP

**Date:** October 14, 2025  
**Duration:** 4-6 hours  
**Goal:** Migrate users from localStorage to Supabase Auth

---

## 🎯 WHAT WE'RE DOING TODAY

Moving your authentication from **localStorage** (browser only) to **Supabase Auth** (cloud-based).

**Before:** Users stored in browser → Can't access from other devices  
**After:** Users stored in Supabase → Can access from anywhere + RLS works!

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### **STEP 1: Create Initial Organization (15 minutes)**

Organizations must exist before we can create users (users link to organizations).

#### **1.1: Open Supabase Dashboard**
1. Go to: https://supabase.com/dashboard
2. Click on your project: **mediforge-prod**
3. Click **SQL Editor** in the left menu

#### **1.2: Run SQL Script**
1. Click **New Query**
2. Copy the entire content from: `sql-scripts/create-initial-organization.sql`
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl+Enter)

#### **1.3: Verify Success**
You should see output like:
```
id: 123e4567-e89b-12d3-a456-426614174000
name: Mecure Clinics
org_code: MEC-20251014
country: Nigeria
currency: NGN
```

**✅ CHECKPOINT:** Copy the `id` (UUID) - you'll need it!

---

### **STEP 2: Understand Supabase Auth (10 minutes - READ ONLY)**

Before we migrate, let's understand how Supabase Auth works:

#### **Two Tables for Authentication:**

**1. `auth.users` (Managed by Supabase)**
- Handles login/logout
- Stores email & hashed password
- Generates JWT tokens
- You DON'T directly manage this

**2. `public.users` (Your custom table)**
- Stores firstName, lastName, role, gender
- Links to organization
- Links to auth.users via `auth_user_id`

#### **How Login Works:**

```
OLD WAY (localStorage):
1. Enter username/password
2. Check localStorage.users array
3. If match → store session in localStorage
4. Redirect to dashboard

NEW WAY (Supabase):
1. Enter email/password
2. Supabase Auth checks auth.users
3. If valid → Supabase gives JWT token
4. Store token in localStorage
5. Use token for all API calls (RLS allows it!)
6. Redirect to dashboard
```

**Why JWT token is important:**
- RLS policies check this token
- If token exists → RLS allows operations
- If no token → RLS blocks everything

**✅ CHECKPOINT:** Do you understand the two tables? (Just nod to yourself 😊)

---

### **STEP 3: Migrate Users (30-60 minutes)**

Now we'll migrate your users from localStorage to Supabase.

#### **OPTION A: Manual Migration (RECOMMENDED for beginners)**

For each user in localStorage, we'll create them in Supabase:

**3.1: See Current Users**
1. Open your browser Console (F12)
2. Type: `JSON.parse(localStorage.getItem('users'))`
3. Press Enter
4. You'll see your users list

**3.2: Create Each User Manually**

For **each user**, follow these steps:

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Fill in:
   - **Email:** `{username}@temp.ehrapp.local` (e.g., `admin@temp.ehrapp.local`)
   - **Password:** `ChangeMe123!` (they'll change it later)
   - **Auto Confirm Email:** ✅ (check this!)
4. Click **Create User**
5. **COPY THE USER ID** that appears (UUID format)

**3.3: Link User to Profile Table**

Now we need to create their profile in `public.users`:

1. Go to **SQL Editor**
2. Run this query **for each user** (replace the values):

```sql
-- Replace these with actual values:
INSERT INTO users (
  auth_user_id,        -- The UUID you copied from step 3.2
  username,
  first_name,
  last_name,
  gender,
  role,
  organization_id,     -- The organization UUID from Step 1.3
  medical_license_number
) VALUES (
  '123e4567-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- auth_user_id from Step 3.2
  'admin',                                   -- username from localStorage
  'Admin',                                   -- firstName from localStorage
  'User',                                    -- lastName from localStorage
  'Male',                                    -- gender (default to Male for existing users)
  'Doctor',                                  -- role from localStorage
  'org-uuid-from-step-1.3',                  -- organization_id from Step 1
  ''                                         -- medicalLicenseNumber or empty
)
RETURNING *;
```

**3.4: Repeat for All Users**

Do steps 3.2 and 3.3 for each user.

**Example for 3 users:**
```
User 1: admin@temp.ehrapp.local → Create in Auth → Link to profile
User 2: doctor1@temp.ehrapp.local → Create in Auth → Link to profile  
User 3: nurse1@temp.ehrapp.local → Create in Auth → Link to profile
```

**✅ CHECKPOINT:** All your users should now be in Supabase!

**Verify:**
```sql
-- Run this in SQL Editor to see all users:
SELECT 
  u.username,
  u.first_name,
  u.last_name,
  u.role,
  o.name as organization
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id;
```

---

### **OPTION B: Automated Migration (Advanced - Optional)**

If you want to automate this (only if comfortable with SQL):

1. Open `migrate-users.html` in your browser
2. Click **Analyze Users**
3. Review the list
4. Click **Migrate to Supabase**
5. Wait for completion

**Note:** This uses JavaScript to call Supabase Auth API. May require additional setup.

---

### **STEP 4: Update Login System (1-2 hours)**

Now we need to update `login.html` to use Supabase Auth instead of localStorage.

#### **4.1: Create New Auth Helper**

I'll create a new file `js/supabase-auth.js` that handles Supabase authentication.

**This file will:**
- Handle login via Supabase
- Handle logout
- Check if user is authenticated
- Get current user info

#### **4.2: Update login.html**

Modify the login form to:
- Call Supabase Auth instead of localStorage
- Store JWT token instead of user object
- Handle session management

#### **4.3: Update register.html**

New users should register via Supabase Auth.

**✅ CHECKPOINT:** Login system will use Supabase

---

### **STEP 5: Test Everything (30-60 minutes)**

#### **5.1: Test Login**
1. Go to `login.html`
2. Try logging in with:
   - Email: `admin@temp.ehrapp.local`
   - Password: `ChangeMe123!`
3. Should redirect to dashboard

#### **5.2: Check Authentication**
Open browser console and run:
```javascript
supabaseClient.auth.getSession().then(console.log)
```

You should see a session object with `access_token`.

#### **5.3: Test RLS (The Big Moment!)**

Now that you're authenticated, RLS should allow operations!

Try creating a patient:
1. Go to `add-patient.html`
2. Fill in patient details
3. Click Save
4. **Should work now!** (Previously blocked by RLS)

#### **5.4: Verify in Supabase**
1. Go to Supabase Dashboard → **Table Editor**
2. Click **patients** table
3. You should see the patient you just created!

**✅ CHECKPOINT:** If you can create a patient and see it in Supabase, **DAY 2 IS COMPLETE!** 🎉

---

## 🐛 TROUBLESHOOTING

### **Problem: "new row violates row-level security policy"**
- **Cause:** You're not authenticated
- **Fix:** Make sure you're logged in and have a valid session token

### **Problem: "User already registered"**
- **Cause:** User already exists in Supabase Auth
- **Fix:** Skip that user or use a different email

### **Problem: "permission denied for table users"**
- **Cause:** RLS policy blocking you
- **Fix:** Check that you're logged in with the correct user

### **Problem: "Invalid login credentials"**
- **Cause:** Email/password don't match
- **Fix:** Verify email is in format: `username@temp.ehrapp.local` and password is `ChangeMe123!`

---

## 📊 BEFORE vs AFTER

### **BEFORE (Day 1):**
```
User clicks login
  ↓
Check localStorage
  ↓
If match → save session in localStorage
  ↓
Dashboard
  ↓
Try to create patient
  ↓
Supabase blocks (RLS: no auth token)
  ❌ FAILS
```

### **AFTER (Day 2):**
```
User clicks login
  ↓
Check Supabase Auth
  ↓
If valid → get JWT token from Supabase
  ↓
Save token in localStorage
  ↓
Dashboard
  ↓
Try to create patient (sends JWT token)
  ↓
Supabase checks token → RLS allows
  ✅ WORKS!
```

---

## ✅ DAY 2 COMPLETE CHECKLIST

Before moving to Day 3, verify:

- [ ] Organization created in Supabase
- [ ] All users migrated to Supabase Auth
- [ ] All users have profiles in `public.users` table
- [ ] Login system uses Supabase Auth
- [ ] Can log in successfully
- [ ] Session token is stored
- [ ] Can create a patient (RLS allows it)
- [ ] Patient appears in Supabase `patients` table

**If all checked ✅ → DAY 2 COMPLETE! 🎉**

---

## 🎯 NEXT UP: DAY 3

Tomorrow we'll migrate:
- All organizations (full data)
- All patients
- Link them properly

For now, you have:
- ✅ Authentication working
- ✅ RLS allowing authenticated operations
- ✅ Cloud-based user management

**Great progress!** 🚀

---

## 💬 NEED HELP?

If you get stuck:
1. Check the Troubleshooting section above
2. Look at browser console for errors (F12)
3. Check Supabase Dashboard → Logs
4. Ask for help with the specific error message

---

**Ready to start? Begin with STEP 1! 🚀**



