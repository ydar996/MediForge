# Organization Access Control - Manual Suspend/Reactivate

## Overview
Platform administrators can now manually toggle organization access on/off on demand. When an organization is suspended, all users from that organization are blocked from accessing the application.

---

## ✅ What Has Been Implemented

### 1. **Manual Suspend Function** (`js/platform-admin.js`)

**Function: `suspendOrganizationAccess(orgName, reason)`**
- Immediately suspends an organization
- Updates organization status to 'suspended' in localStorage and Supabase
- Updates subscription status to 'suspended'
- Records suspension reason and date
- Logs audit event

**Usage:**
```javascript
await window.suspendOrganizationAccess('Organization Name', 'Reason for suspension');
```

### 2. **Manual Reactivate Function** (`js/platform-admin.js`)

**Function: `reactivateOrganizationAccess(orgName)`**
- Immediately reactivates a suspended organization
- Updates organization status to 'active' in localStorage and Supabase
- Updates subscription status to 'active' (if it was suspended)
- Removes suspension flags
- Logs audit event

**Usage:**
```javascript
await window.reactivateOrganizationAccess('Organization Name');
```

### 3. **Access Check Function** (`js/platform-admin.js`)

**Function: `checkOrganizationAccess(orgName)`**
- Checks if organization has access
- Returns `{ hasAccess: false, reason: '...', suspendedDate: '...' }` if suspended
- Returns `{ hasAccess: true }` if active
- Used by dashboard to block access

**Usage:**
```javascript
const accessCheck = await window.checkOrganizationAccess('Organization Name');
if (!accessCheck.hasAccess) {
  // Block access
}
```

### 4. **Platform Dashboard UI** (`platform-dashboard.html`)

**Added Features:**
- **Suspend Button**: Appears for active organizations
  - Red "🚫 Suspend" button in Actions column
  - Prompts for confirmation and reason
  - Immediately suspends organization

- **Reactivate Button**: Appears for suspended organizations
  - Green "✅ Reactivate" button in Actions column
  - Prompts for confirmation
  - Immediately reactivates organization

- **Status Badge**: Shows organization status with color coding
  - Green badge for "Active"
  - Red badge for "Suspended"

### 5. **Access Blocking** (`dashboard.html`)

**What Happens When Suspended:**
- Dashboard checks organization access on page load
- If suspended, shows full-screen suspension message:
  - 🚫 "Access Suspended" header
  - Suspension reason
  - Suspension date
  - Contact information
  - Logout button

**Access Check:**
- Runs automatically when dashboard loads
- Skips check for Platform Owners (they can always access)
- Blocks all other users from suspended organizations

---

## 🎯 How to Use

### **For Platform Administrators:**

1. **Go to Platform Dashboard** (`platform-dashboard.html`)
2. **Find the organization** in the organizations table
3. **Click "🚫 Suspend"** to suspend access
   - Confirm the action
   - Optionally provide a reason
4. **Click "✅ Reactivate"** to restore access
   - Confirm the action

### **What Happens:**

**When Suspended:**
- Organization status → 'suspended'
- Subscription status → 'suspended'
- All users from that organization → **BLOCKED** from accessing dashboard
- Users see suspension message instead of dashboard

**When Reactivated:**
- Organization status → 'active'
- Subscription status → 'active' (if it was suspended)
- All users from that organization → **CAN ACCESS** dashboard again

---

## 🔒 Security Features

1. **Immediate Effect**: Changes take effect immediately (no cache delay)
2. **Audit Logging**: All suspend/reactivate actions are logged
3. **Reason Tracking**: Suspension reasons are stored for record-keeping
4. **Platform Admin Bypass**: Platform owners can always access (for management)
5. **Graceful Degradation**: If check fails, allows access (prevents false blocks)

---

## 📋 Database Updates

### **Organizations Table:**
- `status` → 'suspended' or 'active'
- `subscription_status` → 'suspended' or 'active'
- `settings.suspended_date` → Timestamp
- `settings.suspension_reason` → Reason text
- `settings.suspended_by` → Platform admin username

### **Subscriptions Table (if exists):**
- `status` → 'suspended' or 'active'

---

## 🧪 Testing

### **Test Suspension:**

1. Login as platform admin
2. Go to Platform Dashboard
3. Find an organization
4. Click "🚫 Suspend"
5. Provide reason: "Testing suspension"
6. Confirm

**Expected Result:**
- Organization status shows "SUSPENDED" (red badge)
- Button changes to "✅ Reactivate"

### **Test Access Block:**

1. Suspend an organization (as above)
2. Logout from platform admin
3. Login as a user from that organization
4. Try to access dashboard

**Expected Result:**
- User sees "Access Suspended" screen
- Cannot access dashboard
- Can only logout

### **Test Reactivation:**

1. Login as platform admin
2. Go to Platform Dashboard
3. Find suspended organization
4. Click "✅ Reactivate"
5. Confirm

**Expected Result:**
- Organization status shows "ACTIVE" (green badge)
- Button changes to "🚫 Suspend"
- Users from that organization can now access dashboard

---

## 📝 Notes

- **Platform Admins**: Can always access (bypasses suspension check)
- **Manual Override**: Platform admins can suspend/reactivate regardless of subscription status
- **Integration**: Works with automatic subscription enforcement (15-day overdue suspension)
- **Audit Trail**: All actions are logged for compliance

---

## 🎯 Summary

**✅ Implemented:**
- Manual suspend/reactivate functions
- Platform dashboard UI with buttons
- Access blocking for suspended organizations
- Audit logging
- Status badges and visual indicators

**Status:** ✅ **FULLY FUNCTIONAL**

Platform administrators can now toggle organization access on/off on demand, and suspended organizations are immediately blocked from accessing the application.


