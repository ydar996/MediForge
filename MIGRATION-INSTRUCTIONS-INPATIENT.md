# In-Patient Services Migration Instructions

## Overview
This document provides instructions for setting up the new In-Patient Services feature in MediForge.

## Step 1: Run SQL Migration

**File:** `sql-scripts/create-inpatient-tables.sql`

**What it does:**
- Creates `rooms` table for hospital/clinic rooms
- Creates `beds` table for beds within rooms
- Creates `admissions` table for patient admission records
- Sets up Row Level Security (RLS) policies
- Creates indexes for performance

**How to run:**
1. Open Supabase Dashboard → Your Project → SQL Editor
2. Copy the ENTIRE contents of `sql-scripts/create-inpatient-tables.sql`
3. Paste into SQL Editor
4. Click "Run" or press Ctrl+Enter
5. Wait for "Success" message

**Expected result:**
- Three new tables created: `rooms`, `beds`, `admissions`
- RLS policies enabled
- Indexes created for performance

## Step 2: Enable In-Patient Services

1. Navigate to `dashboard.html`
2. Click the "🏥 In-Patient Services: False" button
3. It will toggle to "True"
4. The "🏨 Configure In-Patient Facilities" button will appear

## Step 3: Configure Rooms and Beds

1. Click "🏨 Configure In-Patient Facilities" on the dashboard
2. Add rooms:
   - Enter room name/number (e.g., "Room 101", "Ward A", "ICU-1")
   - Select room type (General, Private, Semi-Private, Ward, ICU, Isolation)
   - Enter floor number (optional)
   - Enter capacity (number of beds)
   - Add notes (optional)
   - Click "Add Room"
3. Add beds to rooms:
   - Click "Add Bed" next to a room
   - Enter bed number/identifier (e.g., "1", "A", "ICU-1")
   - Select bed type (Standard, ICU, Isolation, Bariatric)
   - Add bed name (optional)
   - Add notes (optional)
   - Click "Add Bed"

## Step 4: Bed Services Auto-Sync

When rooms and beds are configured, the system will automatically:
- Create service entries for "Bed per night" (standard beds)
- Create service entries for "ICU bed per night" (ICU beds)
- These services will appear in the "Configure Services" page
- You can set pricing for these services in the services configuration

## Step 5: Admit Patients

1. Navigate to `clinical-note.html` for a patient visit
2. If In-Patient Services are enabled, you'll see an "Admit Patient" button
3. Click "Admit Patient" to create an admission record
4. The admission will appear in the Admissions Dashboard

## Step 6: Assign Rooms and Beds

1. Navigate to the Admissions Dashboard (visible to Nurses and Administrators)
2. View pending admissions (patients admitted but not yet assigned)
3. Click "Assign Room/Bed" for an admission
4. Select a room and available bed
5. Complete the assignment

## Features

### Room Management
- Add, edit, delete rooms
- Activate/deactivate rooms
- View room capacity and bed status
- Track occupied vs. available beds

### Bed Management
- Add, edit, delete beds
- Activate/deactivate beds
- Track bed occupancy status
- Link beds to rooms

### Admission Management
- Admit patients from clinical notes
- Assign rooms and beds to admitted patients
- Track admission status (admitted, assigned, discharged)
- View admission history

### Services Integration
- Automatic service creation for bed types
- Configurable pricing per bed type
- Integration with billing system

## Notes

- All data follows Supabase-first hybrid architecture
- RLS policies ensure organization-scoped access
- Bed availability is tracked in real-time
- Services are automatically synced to pricing configuration

