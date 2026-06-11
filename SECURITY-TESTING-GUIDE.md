# 🧪 Security Testing Guide

## Quick Test: Verify Security Improvements

**Time required:** 10 minutes

---

## ✅ Test 1: Session Security

### **Test Session Token Generation:**

1. **Login to the system:**
   ```
   http://127.0.0.1:5500/login.html
   Username: admin
   Password: [your password]
   ```

2. **Check Console (F12):**
   ```
   Expected output:
   ✅ Session token generated
   ✅ Security enhancements initialized successfully
   ```

3. **Check localStorage:**
   ```javascript
   // Paste in console
   console.log('Session Token:', localStorage.getItem('sessionToken'));
   ```
   
   **Expected:** Should see a long base64 string

### **Test Session Manipulation Detection:**

1. **In console, run:**
   ```javascript
   // Get current user
   const user = JSON.parse(localStorage.getItem('user'));
   console.log('Original Org ID:', user.organizationId);
   
   // Try to manipulate session
   user.organizationId = 'fake-org-id';
   localStorage.setItem('user', JSON.stringify(user));
   
   // Try to validate (should fail)
   SessionSecurity.validateSession();
   ```

2. **Expected result:**
   ```
   ❌ Session manipulation detected: Organization ID mismatch
   → Redirected to login page
   ```

### **Test Session Timeout:**

1. **In console, run:**
   ```javascript
   // Simulate old session (9 hours ago)
   const sessionToken = localStorage.getItem('sessionToken');
   const sessionData = JSON.parse(atob(sessionToken));
   sessionData.timestamp = Date.now() - (9 * 60 * 60 * 1000); // 9 hours ago
   localStorage.setItem('sessionToken', btoa(JSON.stringify(sessionData)));
   
   // Try to validate
   SessionSecurity.validateSession();
   ```

2. **Expected result:**
   ```
   ⚠️ Session expired
   → Redirected to login page
   ```

**✅ PASS:** Session security working correctly

---

## ✅ Test 2: Input Validation

### **Test XSS Protection:**

1. **Go to Add Patient page:**
   ```
   http://127.0.0.1:5500/add-patient.html
   ```

2. **Try to enter malicious code in First Name:**
   ```
   <script>alert('XSS')</script>
   ```

3. **Click in another field (blur event):**
   - **Expected:** Input automatically cleaned to empty or safe text
   - **Console should show:** `⚠️ Input sanitized for field: firstName`

### **Test Length Validation:**

1. **Try to enter very long name (150 characters):**
   ```
   aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
   ```

2. **Click in another field:**
   - **Expected:** Input automatically trimmed to 100 characters

### **Test in Console:**

```javascript
// Test sanitization
InputValidation.sanitizeInput('<script>alert("xss")</script>Test Name', 100);
// Expected: "Test Name" (script removed)

// Test length limit
InputValidation.sanitizeInput('a'.repeat(200), 100);
// Expected: String with 100 'a's
```

**✅ PASS:** Input validation working correctly

---

## ✅ Test 3: Sensitive Data Protection

### **Test Sensitive Data Cleanup:**

1. **In console, add fake sensitive data:**
   ```javascript
   localStorage.setItem('password', 'secret123');
   localStorage.setItem('api_token', 'abc123xyz');
   localStorage.setItem('secret_key', 'my-secret');
   ```

2. **Refresh the page** (F5)

3. **Check if cleaned:**
   ```javascript
   console.log('Password:', localStorage.getItem('password')); // Should be null
   console.log('Token:', localStorage.getItem('api_token')); // Should be null
   console.log('Secret:', localStorage.getItem('secret_key')); // Should be null
   ```

4. **Check console:**
   ```
   Expected output:
   ⚠️ Removing sensitive data: password
   ⚠️ Removing sensitive data: api_token
   ⚠️ Removing sensitive data: secret_key
   ```

**✅ PASS:** Sensitive data protection working

---

## ✅ Test 4: Automatic Backup System

### **Test Backup Creation:**

1. **Clear existing backup:**
   ```javascript
   localStorage.removeItem('backup_data');
   localStorage.removeItem('backup_timestamp');
   ```

2. **Refresh page** (F5)

3. **Check console:**
   ```
   Expected output:
   🔄 Creating automatic backup...
   ✅ Backup created successfully
   ```

4. **Verify backup exists:**
   ```javascript
   const backupInfo = BackupSystem.getBackupInfo();
   console.log('Backup Info:', backupInfo);
   ```
   
   **Expected:**
   ```javascript
   {
     exists: true,
     date: "10/14/2025, 2:30:00 PM",
     ageHours: 0,
     isRecent: true
   }
   ```

### **Test Backup Content:**

```javascript
// View backup data
const backup = JSON.parse(localStorage.getItem('backup_data'));
console.log('Backup timestamp:', new Date(backup.timestamp));
console.log('Patients backed up:', JSON.parse(backup.data.patients).length);
console.log('Appointments backed up:', JSON.parse(backup.data.appointments).length);
```

### **Test Restore:**

1. **Delete a patient from localStorage:**
   ```javascript
   const user = JSON.parse(localStorage.getItem('user'));
   const orgPrefix = user.org || 'Default';
   const patients = JSON.parse(localStorage.getItem(`${orgPrefix}_patients`));
   console.log('Before:', patients.length);
   
   // Remove last patient
   patients.pop();
   localStorage.setItem(`${orgPrefix}_patients`, JSON.stringify(patients));
   console.log('After delete:', patients.length);
   ```

2. **Restore from backup:**
   ```javascript
   BackupSystem.restoreBackup();
   
   // Check if restored
   const restored = JSON.parse(localStorage.getItem(`${orgPrefix}_patients`));
   console.log('After restore:', restored.length);
   ```

**✅ PASS:** Backup system working correctly

---

## ✅ Test 5: Run Full Security Audit

### **Test Security Audit Tool:**

1. **Open security audit:**
   ```
   http://127.0.0.1:5500/security-audit-simple.html
   ```

2. **Run each test category:**
   - Click **"Run Authentication Security Checks"**
   - Click **"Run Data Security Checks"**
   - Click **"Run Network Security Checks"**
   - Click **"Run Input Security Checks"**
   - Click **"Run RLS Security Checks"**

3. **Check dashboard metrics:**
   ```
   Expected improvement:
   
   Before:
   40 checks, 23 passed, 12 warnings, 5 critical
   
   After:
   40 checks, 32+ passed, 6- warnings, 2- critical
   ```

4. **Verify specific improvements:**
   - ✅ Session manipulation: FIXED
   - ✅ Input validation: WORKING
   - ✅ Sensitive data: CLEANED
   - ✅ Backup system: ACTIVE
   - ⚠️ HTTPS: Still pending (requires production deployment)

**✅ PASS:** Security audit shows improvements

---

## 📊 Expected Test Results

### **All Tests Passing:**

```
✅ Test 1: Session Security - PASS
  ├─ Session token generation ✓
  ├─ Manipulation detection ✓
  └─ Session timeout ✓

✅ Test 2: Input Validation - PASS
  ├─ XSS protection ✓
  ├─ Length validation ✓
  └─ Sanitization ✓

✅ Test 3: Sensitive Data - PASS
  ├─ Auto cleanup ✓
  └─ Detection working ✓

✅ Test 4: Backup System - PASS
  ├─ Auto backup creation ✓
  ├─ Backup content ✓
  └─ Restore function ✓

✅ Test 5: Security Audit - PASS
  ├─ Improvements verified ✓
  └─ Metrics improved ✓
```

### **Overall Security Score:**

**Before:** 57.5% (23/40 passed)  
**After:** 80%+ (32+/40 passed)  
**Improvement:** +22.5%

---

## 🔧 Troubleshooting

### **Issue: Session token not generated**

**Check:**
```javascript
// Verify security module loaded
console.log(typeof SessionSecurity);
// Should output: "object"

// Check if login.html loads security-enhancements.js
```

**Fix:** Add to login.html:
```html
<script src="js/security-enhancements.js"></script>
```

### **Issue: Input validation not working**

**Check:**
```javascript
// Verify module loaded
console.log(typeof InputValidation);
// Should output: "object"

// Check if page has forms
console.log(document.querySelectorAll('form').length);
```

**Fix:** Ensure security-enhancements.js loads before form submission

### **Issue: Backup not creating**

**Check:**
```javascript
// Check localStorage space
let total = 0;
for (let key in localStorage) {
  if (localStorage.hasOwnProperty(key)) {
    total += localStorage[key].length;
  }
}
console.log('localStorage used:', (total / 1024).toFixed(2), 'KB');
// Should be < 5000 KB (5MB is safe limit)
```

**Fix:** Clear old backups if localStorage full

---

## 🎯 Quick Verification Commands

**Copy-paste into console for instant verification:**

```javascript
// 1. Check all security modules loaded
console.log('Security Modules:',
  typeof SessionSecurity !== 'undefined' ? '✅ SessionSecurity' : '❌ SessionSecurity',
  typeof InputValidation !== 'undefined' ? '✅ InputValidation' : '❌ InputValidation',
  typeof DataProtection !== 'undefined' ? '✅ DataProtection' : '❌ DataProtection',
  typeof BackupSystem !== 'undefined' ? '✅ BackupSystem' : '❌ BackupSystem'
);

// 2. Check session status
if (typeof SessionSecurity !== 'undefined') {
  const valid = SessionSecurity.validateSession();
  console.log('Session Status:', valid ? '✅ Valid' : '❌ Invalid');
}

// 3. Check backup status
if (typeof BackupSystem !== 'undefined') {
  const info = BackupSystem.getBackupInfo();
  console.log('Backup Status:', 
    info.exists ? `✅ Exists (${info.ageHours}h old)` : '❌ No backup'
  );
}

// 4. Run sensitive data scan
if (typeof DataProtection !== 'undefined') {
  const removed = DataProtection.cleanSensitiveData();
  console.log('Sensitive Data:', removed > 0 ? `⚠️ Removed ${removed} items` : '✅ Clean');
}

// 5. Test input validation
if (typeof InputValidation !== 'undefined') {
  const test = InputValidation.sanitizeInput('<script>alert("test")</script>Hello', 10);
  console.log('Input Validation:', test === 'Hello' ? '✅ Working' : '❌ Not working');
}
```

**Expected output:**
```
Security Modules: ✅ SessionSecurity ✅ InputValidation ✅ DataProtection ✅ BackupSystem
Session Status: ✅ Valid
Backup Status: ✅ Exists (0h old)
Sensitive Data: ✅ Clean
Input Validation: ✅ Working
```

---

## 📝 Testing Checklist

Print this and check off as you test:

- [ ] Session token generation works
- [ ] Session manipulation detection works
- [ ] Session timeout works
- [ ] XSS protection works
- [ ] Input length validation works
- [ ] Sensitive data cleanup works
- [ ] Automatic backup works
- [ ] Backup restore works
- [ ] Security audit shows improvements
- [ ] No console errors
- [ ] All modules loaded
- [ ] Performance not impacted

---

## 🎓 What Good Security Looks Like

**In Console (F12):**
```
✅ Supabase client initialized successfully
✅ Security enhancements module loaded
🔒 Initializing security enhancements...
✅ Security enhancements initialized successfully
✅ Backup created successfully
```

**No errors about:**
- ❌ Session invalid
- ❌ Security module not found
- ❌ Backup failed

**In Security Audit:**
- 32+ checks passed ✅
- < 6 warnings ⚠️
- < 3 critical issues ❌

---

## 🚀 Next: Production Testing

**After deploying to production with HTTPS:**

1. Run all tests again on production URL
2. Verify HTTPS-specific security features
3. Check SSL certificate validity
4. Test from multiple browsers/devices
5. Verify no mixed content warnings

---

*Happy testing! Your MediForge is now much more secure.* 🛡️



