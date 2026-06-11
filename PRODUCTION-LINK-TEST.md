# Production Link Testing Checklist

**Date:** October 15, 2025  
**Production URL:** https://mediforge.netlify.app  
**Status:** Testing navigation and redirects

---

## ✅ **PUBLIC PAGES (No Login Required)**

### 1. Homepage
- **URL:** https://mediforge.netlify.app/
- **Expected:** Homepage loads
- **Test:** ⬜ PASS / ⬜ FAIL

### 2. Login Page (with .html)
- **URL:** https://mediforge.netlify.app/login.html
- **Expected:** Login page loads
- **Test:** ⬜ PASS / ⬜ FAIL

### 3. Login Page (clean URL)
- **URL:** https://mediforge.netlify.app/login
- **Expected:** Login page loads
- **Test:** ⬜ PASS / ⬜ FAIL

### 4. Register Page (with .html)
- **URL:** https://mediforge.netlify.app/register.html
- **Expected:** Registration page loads
- **Test:** ⬜ PASS / ⬜ FAIL

### 5. Register Page (clean URL)
- **URL:** https://mediforge.netlify.app/register
- **Expected:** Registration page loads
- **Test:** ⬜ PASS / ⬜ FAIL

### 6. Platform Admin Login (with .html)
- **URL:** https://mediforge.netlify.app/platform-login.html
- **Expected:** Platform login page loads
- **Test:** ⬜ PASS / ⬜ FAIL

### 7. Platform Admin Login (clean URL)
- **URL:** https://mediforge.netlify.app/platform-login
- **Expected:** Platform login page loads
- **Test:** ⬜ PASS / ⬜ FAIL

---

## 🔐 **PROTECTED PAGES (Login Required - Test After Login)**

### Organization User Pages

#### 8. Dashboard
- **URL:** https://mediforge.netlify.app/dashboard.html
- **Expected:** Dashboard loads if logged in, else redirects to login
- **Test:** ⬜ PASS / ⬜ FAIL

#### 9. Patients List
- **URL:** https://mediforge.netlify.app/patients.html
- **Expected:** Patients page loads if logged in
- **Test:** ⬜ PASS / ⬜ FAIL

#### 10. Add Patient
- **URL:** https://mediforge.netlify.app/add-patient.html
- **Expected:** Add patient form loads if logged in
- **Test:** ⬜ PASS / ⬜ FAIL

#### 11. Appointments
- **URL:** https://mediforge.netlify.app/appointments.html
- **Expected:** Appointments page loads if logged in
- **Test:** ⬜ PASS / ⬜ FAIL

#### 12. Add Appointment
- **URL:** https://mediforge.netlify.app/add-appointment.html
- **Expected:** Add appointment form loads if logged in
- **Test:** ⬜ PASS / ⬜ FAIL

#### 13. Billing Dashboard
- **URL:** https://mediforge.netlify.app/billing-dashboard.html
- **Expected:** Billing dashboard loads if logged in
- **Test:** ⬜ PASS / ⬜ FAIL

#### 14. Invoices
- **URL:** https://mediforge.netlify.app/invoices.html
- **Expected:** Invoices page loads if logged in
- **Test:** ⬜ PASS / ⬜ FAIL

---

## 🏢 **PLATFORM ADMIN PAGES (Platform Admin Login Required)**

#### 15. Platform Dashboard
- **URL:** https://mediforge.netlify.app/platform-dashboard.html
- **Expected:** Platform dashboard loads if logged in as platform admin
- **Test:** ⬜ PASS / ⬜ FAIL

#### 16. Manage Clinics
- **URL:** https://mediforge.netlify.app/manage-clinics.html
- **Expected:** Clinic management page loads
- **Test:** ⬜ PASS / ⬜ FAIL

---

## 🔄 **NAVIGATION LINKS**

### From Login Page:

#### 17. "Register here" link
- **Location:** Login page bottom
- **Expected:** Goes to register.html
- **Test:** ⬜ PASS / ⬜ FAIL

#### 18. "Platform Admin" link
- **Location:** Login page bottom
- **Expected:** Goes to platform-login.html
- **Test:** ⬜ PASS / ⬜ FAIL

### From Register Page:

#### 19. "Login here" link
- **Location:** Register page bottom
- **Expected:** Goes to login.html
- **Test:** ⬜ PASS / ⬜ FAIL

### From Platform Login:

#### 20. "Back to Clinic Login" link
- **Location:** Platform login page bottom
- **Expected:** Goes to login.html
- **Test:** ⬜ PASS / ⬜ FAIL

---

## 🧪 **FUNCTIONAL TESTS**

### Login Flow:

#### 21. Organization User Login
- **Steps:** 
  1. Go to login page
  2. Enter username: `admin`
  3. Enter password
  4. Click Login
- **Expected:** Redirects to dashboard.html
- **Test:** ⬜ PASS / ⬜ FAIL

#### 22. Platform Admin Login
- **Steps:**
  1. Go to platform-login page
  2. Enter username: `yinka@eworkchop.com`
  3. Enter password
  4. Click Login
- **Expected:** Redirects to platform-dashboard.html
- **Test:** ⬜ PASS / ⬜ FAIL

### Registration Flow:

#### 23. New User Registration
- **Steps:**
  1. Go to register page
  2. Fill registration form
  3. Submit
- **Expected:** Success message, then redirect to login
- **Test:** ⬜ PASS / ⬜ FAIL

---

## ⚠️ **UNWANTED REDIRECTS CHECK**

#### 24. Register page does NOT redirect to login on load
- **Test:** Go to register page, wait 3 seconds
- **Expected:** Stays on register page
- **Test:** ⬜ PASS / ⬜ FAIL

#### 25. Platform login does NOT redirect to regular login
- **Test:** Go to platform-login, wait 3 seconds
- **Expected:** Stays on platform-login
- **Test:** ⬜ PASS / ⬜ FAIL

#### 26. Login page does NOT auto-redirect
- **Test:** Go to login page, wait 3 seconds
- **Expected:** Stays on login page
- **Test:** ⬜ PASS / ⬜ FAIL

---

## 📝 **TEST RESULTS SUMMARY**

**Total Tests:** 26  
**Passed:** ___  
**Failed:** ___  
**Pass Rate:** ___%

**Critical Issues Found:**
- [ ] None
- [ ] List any issues here

**Notes:**
_Add any additional observations here_

---

## 🔧 **TROUBLESHOOTING**

If any test fails:

1. **Hard Refresh:** Press `Ctrl + Shift + R` or `Ctrl + F5`
2. **Clear Cache:** Go to DevTools → Application → Clear site data
3. **Try Incognito:** Open new incognito window `Ctrl + Shift + N`
4. **Check Console:** Press F12 and look for errors in Console tab
5. **Report:** Note the exact URL, what you expected, and what happened

---

**Tested By:** _______________  
**Date:** _______________  
**Browser:** _______________  
**Notes:** _______________



