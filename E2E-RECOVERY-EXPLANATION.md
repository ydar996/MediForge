# 🔐 E2E Encryption Password Recovery - How It Works

## 📋 Overview

The recovery system allows organizations to recover access to encrypted data if they forget their master password. This is done through a **secure, platform-admin-controlled recovery process**.

---

## 🔑 How Recovery Works (Step-by-Step)

### **Phase 1: Setup (When Encryption is Enabled)**

1. **User enables encryption** and creates a master password
2. **System generates a recovery key:**
   - Random 256-bit key (32 bytes)
   - This key can decrypt all encrypted patient data
   - Independent of the master password

3. **Recovery key is encrypted:**
   - Encrypted with platform admin's master key
   - Platform admin key is stored securely (separate from user data)
   - Only platform admin can decrypt the recovery key

4. **Encrypted recovery key is stored:**
   - Saved in `organizations.settings.recovery_key_encrypted`
   - Also displayed ONCE to the user (they should save it)
   - User can save it offline for their own backup

5. **User receives recovery key:**
   - Displayed on screen (one-time only)
   - User should save it in a secure password manager
   - User can use this key directly if they forget password

---

### **Phase 2: Recovery (If Password is Forgotten)**

#### **Option A: User Has Recovery Key**

1. User opens recovery page
2. Enters recovery key (the one they saved during setup)
3. System decrypts data using recovery key
4. User can access encrypted data
5. User can optionally reset master password

#### **Option B: User Lost Recovery Key (Platform Admin Recovery)**

1. User contacts platform admin
2. Platform admin verifies user identity (security check)
3. Platform admin logs into platform dashboard
4. Platform admin navigates to "Encryption Recovery" page
5. Platform admin selects organization needing recovery
6. Platform admin enters platform master key
7. System decrypts organization's recovery key
8. System displays recovery key to platform admin
9. Platform admin securely shares recovery key with user
10. User uses recovery key to access encrypted data

---

## 🔒 Security Features

### **What Makes This Secure:**

1. **Recovery Key is Independent:**
   - Generated randomly, not derived from master password
   - Can decrypt data without knowing master password
   - But requires recovery key (or platform admin help)

2. **Platform Admin Protection:**
   - Recovery key encrypted with platform admin master key
   - Platform admin must authenticate to access
   - Audit log tracks all recovery operations

3. **User Backup Option:**
   - User receives recovery key during setup
   - Can save it offline (password manager, secure file)
   - Can use it directly without platform admin

4. **Audit Trail:**
   - All recovery operations logged
   - Platform admin actions tracked
   - User can see recovery history

### **What This Protects Against:**

✅ **User forgets password** → Can recover via recovery key or platform admin  
✅ **Recovery key lost** → Platform admin can help  
✅ **Unauthorized access** → Requires platform admin authentication  
✅ **Data loss** → Recovery key always available (via platform admin)

---

## 📊 Technical Details

### **Recovery Key Generation:**

```javascript
// Generate 256-bit recovery key
const recoveryKey = crypto.getRandomValues(new Uint8Array(32));

// Encrypt with platform admin master key
const encryptedRecoveryKey = await encryptWithPlatformKey(recoveryKey);

// Store in Supabase
organizations.settings.recovery_key_encrypted = encryptedRecoveryKey;
```

### **Recovery Process:**

```javascript
// Option 1: User provides recovery key directly
if (userHasRecoveryKey) {
  const decryptedData = await decryptWithRecoveryKey(encryptedData, recoveryKey);
}

// Option 2: Platform admin decrypts recovery key
if (platformAdminRecovery) {
  const recoveryKey = await decryptWithPlatformKey(encryptedRecoveryKey);
  // Share with user securely
}
```

---

## 🎯 User Experience

### **During Setup:**
1. User enables encryption
2. System generates recovery key
3. **Recovery key displayed on screen** (one-time only)
4. User saves recovery key (password manager, secure file)
5. User clicks "I've saved my recovery key"
6. Setup continues

### **During Recovery:**
1. User forgets password
2. User clicks "Forgot Master Password?"
3. User enters recovery key (if they have it)
4. OR user clicks "Contact Platform Admin"
5. Platform admin processes recovery request
6. User receives recovery key
7. User can access encrypted data

---

## ⚠️ Important Notes

### **For Users:**
- **Save your recovery key** during setup - you won't see it again!
- **Store it securely** - password manager or encrypted file
- **Recovery key = master password** - both can decrypt data
- **Contact platform admin** if you lose both

### **For Platform Admins:**
- **Verify user identity** before providing recovery key
- **Use secure communication** to share recovery key
- **Log all recovery operations** for audit
- **Platform master key** must be stored securely

---

## 🔐 Security Trade-offs

### **Pros:**
✅ Users can recover if they forget password  
✅ Platform admin can help (but requires authentication)  
✅ Recovery key provides independent access method  
✅ Audit trail for compliance  

### **Cons:**
⚠️ Platform admin has access to recovery keys (but encrypted)  
⚠️ User must trust platform admin for recovery  
⚠️ Recovery key is as powerful as master password  

### **Mitigation:**
- Platform admin access is logged and audited
- Recovery keys encrypted with platform admin key
- User can keep their own copy of recovery key
- Recovery operations require authentication

---

## 📝 Summary

**Recovery works by:**
1. Generating a recovery key during setup
2. Encrypting it with platform admin key
3. Storing it in Supabase
4. User can use recovery key directly OR
5. Platform admin can decrypt and provide recovery key

**This is secure because:**
- Recovery key is encrypted
- Platform admin must authenticate
- All operations are logged
- User can keep their own backup

**This is practical because:**
- Users won't lose access to data
- Platform admin can help if needed
- Recovery is straightforward
- Multiple recovery options available

