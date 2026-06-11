# Platform Admin & Multi-Tenant Monitoring Guide

**Last updated:** May 2026  
**Audience:** Platform owner only (not clinic staff).

> **Clinic staff:** use the [User Manual](docs/USER-MANUAL.md) or [user-manual.html](user-manual.html).  
> **Security:** Platform login is **not** linked from the public login page. Store credentials in a password manager only—never in this file.

## Overview

Monitor and manage all clinics on MediForge: counts, subscriptions, audit logs, and “view as clinic” support.

---

## How to access platform admin

1. Open your environment’s platform login URL, for example:
   - Production: `https://mediforge.netlify.app/platform-login`
   - Staging: `https://mediforge-staging.netlify.app/platform-login`
   - Dev: `https://mediforge-dev.netlify.app/platform-login`
2. Sign in with your **platform administrator** username and password.
3. You land on **Platform Dashboard**.

**Note:** After database security updates (2026), patient and appointment counts on the platform dashboard rely on platform-admin database policies and RPCs being applied on that Supabase project. Use `sql-scripts/check-which-security-migrations-ran.sql` if counts show zero incorrectly.

---

## 📊 Platform Admin Features

### **1. Platform Dashboard**
**URL:** `platform-dashboard.html`

**What You See:**
- **Global Statistics:**
  - Total Clinics registered
  - Active Clinics (last 30 days)
  - Total Patients (across all clinics)
  - Total Revenue (all clinics combined)
  - Active Users (all staff)
  - Total Audit Events

- **Registered Clinics List:**
  - Clinic name
  - Country
  - Status (Active/Trial/Suspended)
  - Patient count
  - User count
  - Revenue
  - Actions: View, Details

- **Recent Platform Activity:**
  - Last 20 events across ALL clinics
  - Shows: action, clinic, user, timestamp

**Actions:**
- Click "View" → Switch to clinic dashboard (see their view)
- Click "Details" → See detailed clinic information
- Click "Manage Clinics" → Full clinic management
- Click "Analytics & Charts" → Visual analytics
- Click "Global Audit Log" → All audit events
- Click "Register New Clinic" → Onboard new clinic

---

### **2. Manage Clinics**
**URL:** `manage-clinics.html`

**What You Can Do:**
- **View All Clinics:** Searchable table with all registered clinics
- **Search:** Filter clinics by name or country
- **View:** Switch to clinic dashboard
- **Details:** See detailed clinic information
- **Suspend/Activate:** Toggle clinic status
- **Export:** Download clinic data as JSON
- **Delete:** Permanently remove clinic and all data
- **Register:** Add new clinic

**Table Columns:**
- Clinic Name
- Status (Active/Trial/Suspended)
- Country
- Created Date
- Patient Count
- User Count
- Total Revenue
- Actions (5 buttons)

---

### **3. Clinic Details**
**URL:** `clinic-details.html?clinic=Mecure%20Clinics`

**What You See:**
- **Clinic Header:**
  - Clinic name
  - Country and creation date
  - Status badge

- **Statistics:**
  - Total Patients
  - Active Users (staff count)
  - Total Revenue
  - Appointments scheduled
  - Invoices generated
  - Last Activity (time ago)

- **Clinic Users Table:**
  - All staff members
  - Names, usernames, roles, emails, license numbers

- **Recent Activity:**
  - Last 50 audit events for this clinic
  - Shows: action, user, role, timestamp

**Actions:**
- View Clinic Dashboard → Switch to their view
- Export All Data → Download complete clinic data
- Suspend/Activate → Toggle status
- Delete Clinic → Permanent removal

---

### **4. Global Audit Log**
**URL:** `platform-audit-log.html`

**What You See:**
- **Combined Audit Trail:** All events from ALL clinics in one view

**Filters:**
- Organization (select specific clinic or all)
- Action (filter by event type)
- User (search by username)
- Date Range (from/to)

**Statistics:**
- Total Events (all time)
- Showing (after filters)
- Organizations (unique clinics)
- Unique Users (all staff)

**Table Columns:**
- Timestamp
- Organization (clinic name)
- User
- Role
- Action
- Details (JSON data)

**Export:** Download filtered audit log as CSV

---

### **5. Platform Analytics**
**URL:** `platform-analytics.html`

**What You See:**

#### **Top Clinics by Patient Count**
- Ranked list of clinics
- Shows: clinic name, country, patient count, user count, status
- Top 3 clinics highlighted with gold rank

#### **Top Clinics by Revenue**
- Ranked list by revenue
- Shows: clinic name, total revenue, invoice count, collection rate
- Top 3 highlighted

#### **Geographic Distribution**
- Breakdown by country
- Shows: country, clinic count, total patients, total revenue
- Helps identify market penetration

#### **Activity Summary (Last 30 Days)**
- Per-clinic activity metrics
- Shows: total events, active users, last activity, most common action
- Identifies active vs inactive clinics

---

### **6. Register New Clinic**
**URL:** `register-clinic.html`

**Onboarding Form:**

**Clinic Information:**
- Clinic Name (required)
- Country (required - dropdown of 20 African countries)
- City
- State/Province
- Address (Line 1 & 2)
- Phone
- Email

**Clinic Administrator:**
- First Name (required)
- Last Name (required)
- Username (required - must be unique)
- Password (required - can be changed later)
- Medical License Number (if doctor)

**Subscription:**
- Plan: Free Trial / Basic / Premium
- Status: Trial / Active / Suspended

**Process:**
1. Fill form
2. Click "Register Clinic"
3. System creates:
   - Organization entry
   - Admin user account
   - Empty data storage (patients, invoices, etc.)
4. Clinic admin can now login at regular login page
5. Clinic appears in all platform views

---

## 🔄 Viewing a Clinic's Dashboard (Impersonation)

### **How It Works:**

**From Platform Dashboard:**
1. Click "View" button next to any clinic
2. You're switched to that clinic's context
3. **Purple banner appears at top:** "Platform Admin View - Currently viewing: Mecure Clinics"
4. All pages now show that clinic's data
5. You can navigate: patients, billing, reports, etc.
6. Click "Exit to Platform Dashboard" → Return to platform view

**What You Can See:**
- All patients for that clinic
- All appointments
- All billing data
- All reports
- All audit logs
- Exactly what their admin sees

**Restrictions:**
- ✅ You can VIEW everything
- ✅ You can create/edit/delete (full access)
- ✅ All actions are logged as YOU (platform owner)
- ⚠️ Use carefully - you're operating as that clinic

---

## 📋 Common Tasks

### **Task 1: Monitor All Clinic Activity**
```
1. Login to Platform Admin (platform-login.html)
2. View Platform Dashboard
3. Check "Recent Platform Activity"
4. Or go to "Global Audit Log" for full details
```

### **Task 2: Check Specific Clinic Performance**
```
1. Platform Dashboard
2. Click "Details" next to clinic name
3. Review statistics and recent activity
4. Or click "View" to see their actual dashboard
```

### **Task 3: Register a New Clinic**
```
1. Platform Dashboard → "Register New Clinic"
2. Fill in clinic information
3. Create admin account for them
4. Submit
5. Notify clinic admin of their credentials
6. They can login at regular login page
```

### **Task 4: Suspend Misbehaving Clinic**
```
1. Manage Clinics → Find clinic
2. Click "Suspend" button
3. Confirm
4. Clinic status → "Suspended"
5. (Future: This will block their access when backend is ready)
```

### **Task 5: Export Clinic Data (Backup)**
```
1. Manage Clinics → Find clinic
2. Click "Export" button
3. Downloads JSON file with ALL clinic data
4. Contains: patients, invoices, payments, appointments, audit log, users
5. Can be re-imported later (when backend ready)
```

### **Task 6: View Cross-Clinic Revenue**
```
1. Platform Analytics
2. See "Top Clinics by Revenue" table
3. Compare clinic performance
4. Export to CSV if needed
```

---

## 🔒 Security Notes

### **Current Implementation (LocalStorage):**

**⚠️ Important Limitations:**
- Platform admin credentials are in browser localStorage
- Can be viewed/edited in browser dev tools
- Not suitable for production (security risk)
- Use ONLY for testing and development

**When Moving to Production:**
- Backend will secure platform admin auth
- Database will enforce permissions
- JWT tokens will control access
- No client-side credential storage

### **Best Practices (Even in Testing):**
- Don't share platform admin credentials
- Only access from secure devices
- Log out when done
- Don't use on public computers

---

## 📁 Files Created

### **HTML Pages (6 new pages):**
1. `platform-login.html` - Platform owner login
2. `platform-dashboard.html` - Overview of all clinics
3. `manage-clinics.html` - Clinic management (CRUD)
4. `clinic-details.html` - Individual clinic view
5. `platform-analytics.html` - Charts and analytics
6. `platform-audit-log.html` - Global audit trail
7. `register-clinic.html` - Onboard new clinics

### **JavaScript Modules (1 new file):**
1. `js/platform-admin.js` - All platform functions

### **Modified Files (3 files):**
1. `dashboard.html` - Added platform view banner
2. `login.html` - Added platform admin link
3. `service-worker.js` - Cache platform pages (v261)

---

## 🎯 Testing Checklist

### **Platform Admin Login:**
- [ ] Go to platform-login.html
- [ ] Enter your platform admin username and password (from your password manager)
- [ ] Should reach platform-dashboard.html
- [ ] Should see global statistics

### **View Existing Clinic (Mecure Clinics):**
- [ ] Platform Dashboard → Mecure Clinics → "View"
- [ ] Purple banner should appear at top
- [ ] Should see Mecure Clinics dashboard
- [ ] Check patients, billing, reports
- [ ] Click "Exit" → Return to platform dashboard

### **Register New Clinic:**
- [ ] Platform Dashboard → "Register New Clinic"
- [ ] Fill form (e.g., "Lagos General Hospital")
- [ ] Create admin account
- [ ] Submit
- [ ] New clinic should appear in platform dashboard
- [ ] Logout from platform
- [ ] Login as new clinic admin
- [ ] Should see their own empty dashboard

### **Global Audit Log:**
- [ ] Platform Dashboard → "Global Audit Log"
- [ ] Should see events from ALL clinics
- [ ] Filter by organization → Should filter correctly
- [ ] Export to CSV → Should download

### **Clinic Management:**
- [ ] Manage Clinics → See all clinics
- [ ] Search for clinic → Should filter
- [ ] Suspend clinic → Status should change
- [ ] Activate clinic → Status should change back
- [ ] Export clinic → Should download JSON

### **Analytics:**
- [ ] Platform Analytics
- [ ] Should see top clinics by patients
- [ ] Should see top clinics by revenue
- [ ] Should see geographic distribution
- [ ] Should see activity summary

---

## 🔄 Workflow Example

### **Scenario: Onboard New Clinic**

**Step 1: Platform Owner (You)**
```
1. Login to platform-login (your platform admin account)
2. Platform Dashboard → "Register New Clinic"
3. Fill form:
   - Name: "Nairobi Medical Center"
   - Country: Kenya
   - Admin: "Dr. Jane Kamau"
   - Username: "jkamau"
   - Password: "Welcome123"
4. Submit
5. System creates clinic and admin account
```

**Step 2: Notify Clinic Admin**
```
Send email/SMS to Dr. Kamau:
"Your MediForge account is ready!
Login at: http://mediforge.com/login.html
Username: jkamau
Password: Welcome123
Please change your password after first login."
```

**Step 3: Clinic Admin First Login**
```
1. Dr. Kamau goes to login.html
2. Enters: jkamau / Welcome123
3. Reaches dashboard
4. Sees empty clinic (no patients yet)
5. Changes password via Edit Profile
6. Starts adding patients
```

**Step 4: Platform Owner Monitoring**
```
1. Login to platform-login.html
2. Platform Dashboard shows:
   - Total Clinics: 2 (Mecure + Nairobi)
   - Total Patients: 7 (all from Mecure)
3. Click "View" next to Nairobi Medical
4. See their empty dashboard
5. Exit back to platform view
```

---

## 📈 Data Isolation Verification

### **How It Works:**

**Organization Data Keys:**
```
Mecure Clinics:
- Mecure Clinics_patients
- Mecure Clinics_invoices
- Mecure Clinics_appointments
- Mecure Clinics_auditLog
- etc.

Nairobi Medical Center:
- Nairobi Medical Center_patients
- Nairobi Medical Center_invoices  
- Nairobi Medical Center_appointments
- Nairobi Medical Center_auditLog
- etc.
```

**Result:**
- ✅ Complete isolation
- ✅ No data leakage
- ✅ Each clinic sees ONLY their data
- ✅ Platform owner sees ALL data

**Verification:**
1. F12 → Application → Local Storage
2. See all the "{ClinicName}_" prefixed keys
3. Each clinic has separate data

---

## ⚠️ Important Notes

### **Current Limitations (LocalStorage Version):**
1. ❌ Platform admin credentials not encrypted
2. ❌ No server-side enforcement
3. ❌ Clinic status changes don't block access (yet)
4. ❌ Single browser only (no sync)
5. ❌ Data can be lost if cache cleared

### **When Moving to Production (Backend):**
1. ✅ Encrypted credentials in database
2. ✅ Server-side role enforcement
3. ✅ Suspended clinics blocked at API level
4. ✅ Multi-device access
5. ✅ Persistent, backed-up data

**Use current version for:** Testing, validation, proof of concept  
**Use production version for:** Real commercial deployment

---

## 🎯 Next Steps

### **After Testing Platform Admin:**
1. Test all features (login, dashboard, manage, analytics, audit log)
2. Register a test clinic
3. Switch between clinic views
4. Verify data isolation
5. When satisfied → Say **"MOVE-TO-PROD"**

### **What Happens When You Say "MOVE-TO-PROD":**
1. I migrate all platform admin features to backend (Supabase)
2. Secure authentication with JWT tokens
3. Database-enforced permissions
4. Production-ready security
5. Deploy to Netlify
6. 7-day implementation timeline
7. $0-25/month cost

---

## 📞 Support

### **Common Issues:**

**Q: Can't login to platform admin**
- A: Confirm you are on `/platform-login` (not the regular clinic login). Use the platform admin credentials from your password manager. Clear browser cache (Ctrl+F5) and try again.

**Q: Don't see any clinics in platform dashboard**
- A: Only "Mecure Clinics" exists by default
- Register a new clinic to see multiple clinics
- Or check localStorage for "organizations" key

**Q: Platform view banner not showing when viewing clinic**
- A: Make sure you clicked "View" from platform dashboard
- Check localStorage "user" key has `_isPlatformView: true`
- Hard refresh the page (Ctrl+F5)

**Q: Clinic data mixing between organizations**
- A: This shouldn't happen - data is isolated
- Check localStorage keys - each has clinic name prefix
- Report this issue if it occurs

---

## 📊 System Architecture

### **User Types:**

**1. Platform Owner (You)**
- Login: platform-login.html
- Role: PlatformOwner
- Access: ALL clinics
- Features: Platform dashboard, manage clinics, analytics, global audit log

**2. Clinic Admin**
- Login: login.html
- Role: Admin
- Access: ONLY their clinic
- Features: All EHR features (patients, billing, etc.)

**3. Clinic Staff (Doctor, Nurse, etc.)**
- Login: login.html
- Role: Doctor/Nurse/Receptionist/etc.
- Access: ONLY their clinic
- Features: Based on role permissions

### **Data Storage:**

**Global (Shared):**
- `users` - All users across all clinics
- `organizations` - All clinic metadata
- `platformAdmins` - Platform owner accounts

**Per-Clinic (Isolated):**
- `{Clinic}_patients` - Clinic's patients
- `{Clinic}_invoices` - Clinic's invoices
- `{Clinic}_payments` - Clinic's payments
- `{Clinic}_appointments` - Clinic's appointments
- `{Clinic}_auditLog` - Clinic's audit trail

---

## ✅ Summary

**You can now:**
- ✅ Monitor all registered clinics
- ✅ View global statistics
- ✅ Register new clinics
- ✅ View any clinic's dashboard
- ✅ Track all activity across platform
- ✅ Suspend/activate clinics
- ✅ Export clinic data
- ✅ Delete clinics
- ✅ Analyze performance and trends

**Files created:** 7 HTML pages, 1 JS module  
**Service worker:** v261  
**Ready to test!** 🚀

**When satisfied, say:** `MOVE-TO-PROD` to deploy to production!


