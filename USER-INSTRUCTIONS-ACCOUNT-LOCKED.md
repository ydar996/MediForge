# 🔒 Account Locked During Registration - User Instructions

**Last updated:** May 2026

> **Main manual:** [User Manual](docs/USER-MANUAL.md) → section 16, or [user-manual.html](user-manual.html)

## ⚠️ IMPORTANT: Do NOT Try to Register Again Yet

**Your registration was never completed.** A temporary account was created but is now permanently locked. **You cannot register again until your administrator deletes this temporary account first.**

---

## What Happened?

1. You tried to register
2. The system started creating your account
3. The process was interrupted (network issue, page refresh, etc.)
4. A temporary account was created in the system
5. Multiple failed attempts locked this temporary account
6. **You are NOT registered** - your name does not appear in the system

**You cannot fix this yourself.** Only an administrator can delete the temporary account.

---

## 📋 Steps to Resolve This

### **Step 1: Contact Your Administrator IMMEDIATELY**

**Do NOT try to register again** - it will fail with the same error.

Contact your organization's administrator and say:

> "I tried to register but got a 'permanently locked' error. My registration never completed. I need you to delete the temporary account so I can register fresh."

### **Step 2: Provide This Information to Your Administrator**

Give your administrator:

1. ✅ **Your username:** `[the username you tried to use]` ⭐ **MOST IMPORTANT**
   - Example: `johndoe`
   - **Note:** The administrator can use your username to find your account (email will be auto-generated as `username@mediforge.app`)
   
2. ✅ **Your email address (if you remember it):** `[the email you tried to register with]@mediforge.app`
   - Example: `john.doe@mediforge.app`
   - **Note:** If you don't remember the email, the username is enough!
   
3. ✅ **Your organization name:** `[your organization]`
   - Example: `Ministry of Foreign Affairs Staff Clinic`

4. ✅ **The error message:** "Account permanently locked due to too many failed login attempts"

5. ✅ **Tell them:** "I don't appear in platform-dashboard, so registration never completed"

### **Step 3: Wait for Administrator Confirmation**

**Do NOT try to register again until your administrator tells you it's ready.**

Your administrator will:
1. Go to: `https://mediforge.netlify.app/recover-orphaned-user-admin.html`
2. Enter your email address
3. Click "Find & Delete Orphaned Auth User"
4. Follow the instructions to delete the temporary account from Supabase
5. **Confirm with you when it's done**

### **Step 4: Register Fresh (ONLY After Administrator Confirms)**

**Only after your administrator confirms the temporary account is deleted:**

1. **Go to the registration page**
2. **Fill in ALL required fields:**
   - Username (same or different - your choice)
   - Password (choose a new secure password)
   - First Name
   - Last Name
   - Gender
   - Role
   - Organization Code
   - Medical License Number (if required for your role)
   - All other required fields

3. **Make sure you have a STABLE internet connection**
   - Use Wi-Fi if possible
   - Don't refresh or close the page during registration
   - Wait for the success message

4. **Submit the registration form**
   - Wait for "Registration successful!" message
   - Don't refresh or close until you see success

5. **Verify registration:**
   - Ask your administrator to check platform-dashboard
   - Your name should now appear in the users list

---

## ⏱️ Timeline

- **Step 1-2 (Contact admin):** 2-5 minutes
- **Step 3 (Admin deletes account):** 5-10 minutes
- **Step 4 (You register fresh):** 5 minutes
- **Total:** Usually 15-20 minutes

---

## ❓ Frequently Asked Questions

### **Q: Can I just try registering again with a different email?**

**A:** No. The system will still recognize you and show the same error. The administrator MUST delete the temporary account first.

### **Q: Why can't I fix this myself?**

**A:** Only administrators have access to delete accounts. This is a security feature to prevent unauthorized account deletion.

### **Q: Will I lose any information?**

**A:** No. Since registration never completed, there's no information to lose. You'll register fresh after the temporary account is deleted.

### **Q: What if I don't know who my administrator is?**

**A:** Contact your organization's IT department or the person who manages your MediForge system. They should have administrator access.

### **Q: What if the administrator can't find my account?**

**A:** The administrator should:
1. Go to Supabase Dashboard → Authentication → Users
2. Search for your email address
3. If found, delete that Auth user
4. Then you can register fresh

### **Q: Can I use the same username and email when I register again?**

**A:** Yes, once the temporary account is deleted, you can use the same username and email.

---

## 🚫 What NOT to Do

❌ **Do NOT try to register again** until administrator confirms deletion  
❌ **Do NOT try different email addresses** - it won't help  
❌ **Do NOT refresh the registration page multiple times** - it makes things worse  
❌ **Do NOT try to log in** - you're not registered yet  

---

## ✅ What TO Do

✅ **Contact your administrator immediately**  
✅ **Provide all the information listed above**  
✅ **Wait for confirmation before trying again**  
✅ **Make sure you have stable internet** when registering  
✅ **Fill in ALL required fields** completely  

---

## 📞 Quick Reference for Administrator

**Tell your administrator to:**

1. Go to: `https://mediforge.netlify.app/recover-orphaned-user-admin.html`
2. **Enter your username** in "Username" field (email will be auto-generated as `username@mediforge.app`)
   - OR enter your email directly if you have it
3. Click "Find & Delete Orphaned Auth User"
4. Follow the SQL instructions shown (or use Supabase Dashboard)
5. Confirm deletion is complete
6. Tell you when it's safe to register again

**Alternative method (if admin has Supabase access):**
1. Go to Supabase Dashboard → Authentication → Users
2. Search for email: `[username]@mediforge.app` (constructed from username)
   - OR search for your actual email if you provided it
3. Delete the Auth user
4. Confirm with you

**Note:** Username is sufficient - the email format is always `username@mediforge.app`

---

## 📝 Summary

**Problem:** Registration never completed, temporary account is locked  
**Solution:** Administrator must delete temporary account first  
**Your action:** Contact administrator, provide email/username/org name  
**Wait for:** Administrator confirmation that account is deleted  
**Then:** Register fresh with stable internet connection  

**Remember:** You cannot register again until the temporary account is deleted. Contact your administrator now!
