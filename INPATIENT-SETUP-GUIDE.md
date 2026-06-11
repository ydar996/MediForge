# In-Patient Services Setup Guide

**Last updated:** May 2026  
**Audience:** Clinic administrators and nurses (with admin enabling the module).

> **Overview for all staff:** [User Manual](docs/USER-MANUAL.md) → section 11, or [user-manual.html](user-manual.html).

## Prerequisites

Your organization’s database must have in-patient tables (`rooms`, `beds`, `admissions`). If beds/wards are missing, contact technical support to run the inpatient migration on your Supabase project.

## 📋 Steps to use in-patient services

### Step 2: Enable In-Patient Services
1. Open your **Dashboard** (after login)
2. Find the button: **"🏥 In-Patient Services: False"**
3. Click it to toggle to **"True"**
4. The **"🏨 Configure In-Patient Facilities"** button will now appear

### Step 3: Configure Rooms and Beds
1. Click **"🏨 Configure In-Patient Facilities"** on the dashboard
2. **Add Rooms:**
   - Enter room name (e.g., "Room 101", "Ward A", "ICU-1")
   - Select room type (General, Private, Semi-Private, Ward, ICU, Isolation)
   - Enter floor number (optional)
   - Enter capacity (number of beds)
   - Add notes (optional)
   - Click **"Add Room"**

3. **Add Beds to Rooms:**
   - Click **"Add Bed"** next to a room
   - Enter bed number/identifier (e.g., "1", "A", "ICU-1")
   - Select bed type (Standard, ICU, Isolation, Bariatric)
   - Add bed name (optional)
   - Add notes (optional)
   - Click **"Add Bed"**

### Step 4: Admit a Patient
1. Open a patient's **Clinical Note** from their chart
2. You should now see the **"🏥 Admit Patient"** button (only visible when in-patient services are enabled)
3. Click **"Admit Patient"**
4. Enter the reason for admission
5. The admission will be created and appear in the Admissions Dashboard

### Step 5: Assign Room and Bed (Nurses/Admins)
1. Navigate to **Admissions Dashboard** (visible to Nurses and Administrators on the dashboard)
2. You'll see **"Pending Admissions"** that need room/bed assignment
3. Click **"Assign Room/Bed"** for an admission
4. Select a room from the dropdown
5. Select an available bed from that room
6. Click **"Assign Room/Bed"**
7. The patient is now assigned and the bed is marked as occupied

### Step 6: Discharge a Patient
1. In the **Admissions Dashboard**, find the assigned admission
2. Click **"Discharge"**
3. Enter discharge reason (optional)
4. The bed will be automatically freed up and marked as available

## 🔄 Services Auto-Sync (Optional - Not Yet Implemented)

Currently, bed services are NOT automatically added to the pricing configuration. You can manually add them:

1. Go to **Configure Services** page
2. Manually add services like:
   - "Bed per night" (for standard beds)
   - "ICU bed per night" (for ICU beds)
   - Set pricing for each

**Note:** The auto-sync functionality (`syncBedServicesToPricing()`) is a placeholder and can be implemented later if needed.

## 🧪 Testing Checklist

- [ ] Enable in-patient services on dashboard
- [ ] Configure at least one room
- [ ] Add at least one bed to the room
- [ ] Admit a patient from clinical note
- [ ] Assign room/bed from admissions dashboard
- [ ] Verify bed shows as occupied
- [ ] Discharge the patient
- [ ] Verify bed shows as available again

## 📝 Notes

- All data follows **Supabase-first hybrid architecture**
- Bed availability is tracked in real-time
- Admissions are linked to patient visits/appointments
- Only Nurses and Administrators can access the Admissions Dashboard
- The "Admit Patient" button only appears when in-patient services are enabled

