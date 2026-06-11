# ✅ DAY 2: YOUR ACTION CHECKLIST

**Print this out or keep it open while working!**

---

## 🎯 GOAL
Get your first user authenticated via Supabase in 30 minutes.

---

## 📋 CHECKLIST

### **☐ STEP 1: Create Organization (5 minutes)**

1. ☐ Open browser
2. ☐ Go to: https://supabase.com/dashboard
3. ☐ Click your project: **mediforge-prod**
4. ☐ Click **SQL Editor** (left sidebar)
5. ☐ Click **New query**
6. ☐ Open file: `sql-scripts/create-initial-organization-FIXED.sql`
7. ☐ Copy ALL the content
8. ☐ Paste into Supabase SQL Editor
9. ☐ Click **RUN** (or press Ctrl+Enter)
10. ☐ **WRITE DOWN THE ORGANIZATION ID:**
    ```
    Organization ID: _________________________________
    ```

**✅ Success check:** You should see organization details with ID, name, org_code

---

### **☐ STEP 2: Create Your First Auth User (10 minutes)**

#### **Part A: Create Auth Account**

1. ☐ In Supabase Dashboard, click **Authentication** (left sidebar)
2. ☐ Click **Users** tab
3. ☐ Click **Add user** button
4. ☐ Select **Create new user**
5. ☐ Fill in:
   - Email: `admin@temp.ehrapp.local`
   - Password: `ChangeMe123!`
   - ☐ **CHECK** "Auto Confirm Email"
6. ☐ Click **Create user**
7. ☐ **WRITE DOWN THE USER ID:**
    ```
    Auth User ID: _________________________________
    ```

#### **Part B: Create User Profile**

1. ☐ Go back to **SQL Editor**
2. ☐ Click **New query**
3. ☐ Open file: `sql-scripts/add-user-profile.sql`
4. ☐ Copy the INSERT INTO section
5. ☐ **EDIT THE VALUES:**
   - Replace `auth_user_id` with ID from Part A
   - Replace `organization_id` with ID from Step 1
   - Update username, first_name, last_name if needed
6. ☐ Paste into SQL Editor
7. ☐ Click **RUN**

**✅ Success check:** You should see user profile data returned

---

### **☐ STEP 3: Test Login (5 minutes)**

1. ☐ Open your MediForge app
2. ☐ Navigate to `login.html`
3. ☐ Enter:
   - Username: `admin`
   - Password: `ChangeMe123!`
4. ☐ Click **Login**
5. ☐ **Should redirect to dashboard**

**✅ Success check:** You see the dashboard (not an error message)

---

### **☐ STEP 4: Verify RLS is Working (5 minutes)**

1. ☐ While logged in, open: `test-auth-system.html`
2. ☐ Check each test result:
   - ☐ Test 1 (Supabase Connection): GREEN ✅
   - ☐ Test 2 (Current Session): Shows your name ✅
   - ☐ Test 3 (Organizations): Shows 1 org ✅
   - ☐ Test 4 (Users): Shows 1 user ✅
   - ☐ Test 5 (RLS): All "ALLOWED" ✅
3. ☐ All tests passed?

**✅ Success check:** All 5 tests show success/green

---

### **☐ STEP 5: Test Creating Data (5 minutes)**

1. ☐ While logged in, navigate to `add-patient.html`
2. ☐ Fill in patient details:
   - Patient ID: `TEST001`
   - First Name: `Test`
   - Last Name: `Patient`
   - Gender: `Male`
   - Date of Birth: `2000-01-01`
3. ☐ Click **Save**
4. ☐ **Should show success message** (not an error!)

#### **Verify in Supabase:**

5. ☐ Go to Supabase Dashboard
6. ☐ Click **Table Editor** (left sidebar)
7. ☐ Click **patients** table
8. ☐ **You should see the test patient!**

**✅ Success check:** Patient appears in Supabase patients table

---

### **☐ STEP 6: Test Logout (2 minutes)**

1. ☐ Click logout in your app
2. ☐ Should redirect to login page
3. ☐ Try accessing dashboard directly
4. ☐ Should be blocked (redirect back to login)

**✅ Success check:** Cannot access dashboard when logged out

---

## 🎉 FINAL VERIFICATION

If you completed all steps successfully:

- ✅ Organization created in Supabase
- ✅ User created and linked
- ✅ Can log in via Supabase Auth
- ✅ All tests pass
- ✅ RLS allows operations
- ✅ Can create patients
- ✅ Data appears in Supabase

**CONGRATULATIONS! DAY 2 IS COMPLETE!** 🎊

---

## 📸 SCREENSHOTS (Optional but Recommended)

Take screenshots of:
1. ☐ Organization in Supabase (Table Editor → organizations)
2. ☐ User in Supabase (Authentication → Users)
3. ☐ Test results (test-auth-system.html - all green)
4. ☐ Patient in Supabase (Table Editor → patients)

Save these in a folder: `Day-2-Evidence/`

---

## 🐛 IF SOMETHING FAILS

### **Can't create organization:**
- Check you're in the right project (mediforge-prod)
- Make sure SQL query has no typos
- Check Supabase Dashboard → Logs for errors

### **Can't create auth user:**
- Email must be unique
- Must check "Auto Confirm Email"
- Password must be strong enough

### **Login fails:**
- Make sure user exists (Auth → Users)
- Make sure profile exists (run profile query again)
- Check username format: `admin` or `admin@temp.ehrapp.local`
- Check password is exactly: `ChangeMe123!`

### **RLS still blocks:**
- Make sure you're logged in first
- Check session in test-auth-system.html
- Try logging out and back in

### **Still stuck?**
1. Open browser console (F12)
2. Look for red error messages
3. Copy the error message
4. Check DAY-2-INSTRUCTIONS.md Troubleshooting section

---

## ⏱️ TIME TRACKING

Actual time taken:

- Step 1: _____ minutes
- Step 2: _____ minutes
- Step 3: _____ minutes
- Step 4: _____ minutes
- Step 5: _____ minutes
- Step 6: _____ minutes
- **Total:** _____ minutes

**Expected:** 30 minutes  
**Actual:** _____ minutes

---

## 📝 NOTES

Write any issues or observations here:

```
_______________________________________________

_______________________________________________

_______________________________________________

_______________________________________________
```

---

## 🚀 NEXT STEPS

Once Day 2 is complete:

1. **Optional:** Migrate more users (repeat Step 2 for each user)
2. **Optional:** Test with different accounts
3. **Ready for Day 3:** Data migration (organizations, patients, appointments)

**Take a break! You've done great work!** 🎉

---

**START TIME:** ___________  
**END TIME:** ___________  
**STATUS:** ☐ Complete ☐ In Progress ☐ Stuck (see notes)

