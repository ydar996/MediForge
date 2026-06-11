# 🔥 CRITICAL WORKFLOWS - REGRESSION TEST SCENARIOS

**Purpose:** These workflows MUST be tested before and after EVERY change to ensure no functionality is broken.

---

## 📋 WORKFLOW 1: PATIENT MANAGEMENT

### **Scenario 1.1: Create New Patient**

**Steps:**
1. Navigate to `/add-patient`
2. Fill in patient form (name, DOB, gender, etc.)
3. Click "Save Patient"

**Expected Behavior:**
- ✅ Patient is saved to Supabase `patients` table
- ✅ Patient is also saved to localStorage (backup)
- ✅ Patient ID is generated (legacy format: MEC0012/H1Z7C)
- ✅ `patient.id` is **NEVER** a UUID (only legacy ID)
- ✅ UUID is stored in `patient._supabaseUuid` field
- ✅ User is redirected to patient list
- ✅ Patient appears in patient list

**Test Data:**
```javascript
{
  firstName: "Test",
  lastName: "Patient",
  dateOfBirth: "1990-01-01",
  gender: "Male",
  phone: "1234567890"
}
```

**Failure Points to Test:**
- ❌ Supabase offline → Should save to localStorage and queue for sync
- ❌ Invalid data → Should show validation error
- ❌ Duplicate patient → Should handle gracefully

---

### **Scenario 1.2: Edit Existing Patient**

**Steps:**
1. Navigate to `/patients`
2. Click "Edit" on an existing patient
3. Modify patient information
4. Click "Save"

**Expected Behavior:**
- ✅ Patient is updated in Supabase
- ✅ localStorage is updated
- ✅ Patient ID remains unchanged (legacy ID format)
- ✅ Changes are immediately visible
- ✅ No data loss

**Failure Points to Test:**
- ❌ Supabase offline → Should update localStorage and queue for sync
- ❌ Patient not found → Should show error message
- ❌ Concurrent edit → Should handle conflicts

---

### **Scenario 1.3: View Patient Details**

**Steps:**
1. Navigate to `/patients`
2. Click on a patient name or "View Details"

**Expected Behavior:**
- ✅ Patient details load from Supabase (priority)
- ✅ Falls back to localStorage if Supabase unavailable
- ✅ Patient ID displays correctly (legacy format, not UUID)
- ✅ All patient information displays correctly
- ✅ Can navigate to related pages (appointments, clinical notes, etc.)

**Test Cases:**
- Patient loaded by UUID → Should resolve to patient object with legacy ID
- Patient loaded by legacy ID → Should work directly
- Patient not found → Should show "Patient not found" message

---

### **Scenario 1.4: Patient ID Resolution**

**Critical:** This is the most error-prone area. Test thoroughly.

**Test Case 1: resolvePatientByIdentifier with UUID**
```javascript
// Input: UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
// Expected: Patient object with:
//   - patient.id = legacy ID (e.g., "MEC0012")
//   - patient._supabaseUuid = input UUID
```

**Test Case 2: resolvePatientByIdentifier with Legacy ID**
```javascript
// Input: Legacy ID (e.g., "MEC0012" or "MEC0012/H1Z7C")
// Expected: Patient object with:
//   - patient.id = same legacy ID
//   - patient._supabaseUuid = UUID from database
```

**Test Case 3: Patient ID in URL**
```javascript
// URL: /patient-details?patientId=MEC0012
// Expected: Patient loads correctly, patient.id is "MEC0012" (not UUID)
```

**Test Case 4: Patient ID in URL (UUID)**
```javascript
// URL: /patient-details?patientId=550e8400-e29b-41d4-a716-446655440000
// Expected: Patient resolves correctly, patient.id becomes legacy ID
```

---

## 📅 WORKFLOW 2: APPOINTMENT SCHEDULING

### **Scenario 2.1: Create New Appointment**

**Steps:**
1. Navigate to `/add-appointment`
2. Select patient
3. Select date and time
4. Select doctor
5. Select appointment type
6. Add notes (optional)
7. Click "Save Appointment"

**Expected Behavior:**
- ✅ Appointment is saved to Supabase `appointments` table
- ✅ Appointment is saved to localStorage (backup)
- ✅ Conflict detection works (can't double-book)
- ✅ Appointment appears in calendar
- ✅ Appointment appears in appointments list
- ✅ Provider/doctor name displays correctly

**Test Data:**
```javascript
{
  patientId: "MEC0012", // Legacy ID
  date: "2025-01-15",
  time: "10:00",
  doctor: "Dr. Smith",
  appointmentType: "Consultation",
  notes: "Follow-up visit"
}
```

**Failure Points to Test:**
- ❌ Time slot already taken → Should show conflict error
- ❌ Invalid date/time → Should show validation error
- ❌ Supabase offline → Should save to localStorage and queue

---

### **Scenario 2.2: Edit Existing Appointment**

**Steps:**
1. Navigate to `/appointments`
2. Click "Edit" on an appointment
3. Modify appointment details (time, doctor, type, etc.)
4. Click "Save"

**Expected Behavior:**
- ✅ All existing parameters are pre-populated
  - Date is selected
  - Time is selected (HH:MM format, not HH:MM:SS)
  - Doctor is selected (handles "Dr." prefix)
  - Appointment type is selected (by ID or name)
  - Notes are populated
- ✅ Appointment is updated in Supabase
- ✅ Changes are immediately visible
- ✅ No data loss

**Failure Points to Test:**
- ❌ Dropdowns not populated → Should wait for dropdowns before setting values
- ❌ Time format mismatch → Should normalize HH:MM:SS to HH:MM
- ❌ Doctor name mismatch → Should match case-insensitively, handle "Dr." prefix
- ❌ Appointment type mismatch → Should match by ID first, then case-insensitive name

---

### **Scenario 2.3: View Appointments**

**Steps:**
1. Navigate to `/appointments`
2. View appointments list

**Expected Behavior:**
- ✅ Appointments load from Supabase
- ✅ Fallback to localStorage if Supabase unavailable
- ✅ Appointments display with correct:
  - Patient name
  - Date and time
  - Doctor/provider name (not "Not specified")
  - Appointment type
  - Status

**Test Cases:**
- Appointments with UUID patient_id → Should resolve to patient name
- Appointments with legacy patient_id → Should work directly
- Missing doctor/provider → Should show "Not specified" (but test to avoid this)

---

## 📝 WORKFLOW 3: CLINICAL DOCUMENTATION

### **Scenario 3.1: Create Clinical Note (SOAP)**

**Steps:**
1. Navigate to `/clinical-note?patientId=MEC0012`
2. Fill in SOAP sections:
   - Subjective (chief complaint, history)
   - Objective (vital signs, examination)
   - Assessment (diagnoses, ICD codes)
   - Plan (treatment, medications, follow-up)
3. Click "Save Clinical Note"

**Expected Behavior:**
- ✅ Clinical note is saved to Supabase `clinical_notes` table
- ✅ `patient_id` field uses legacy ID (not UUID)
- ✅ SOAP data is stored as JSONB
- ✅ Note appears in patient's clinical notes list
- ✅ Can view/edit note later

**Test Data:**
```javascript
{
  patientId: "MEC0012", // Legacy ID, not UUID
  soapData: {
    subjective: { chiefComplaint: "Headache" },
    objective: { vitalSigns: { bp: "120/80" } },
    assessment: { diagnoses: [{ name: "Migraine", icd: "G43.9" }] },
    plan: { medications: ["Paracetamol 500mg"] }
  }
}
```

**Critical Validation:**
- ✅ `patient.id` is legacy ID before calling `saveClinicalNoteToSupabase`
- ✅ No UUID is used in `patient_id` field in Supabase

---

### **Scenario 3.2: View Patient Summary**

**Steps:**
1. Navigate to `/patient-encounters?patientId=MEC0012`
2. Click "Print Patient Summary"

**Expected Behavior (Staff Access):**
- ✅ Navigates to `/patient-summary?patientId=MEC0012&source=encounters`
- ✅ **NO patient portal login required** (staff access)
- ✅ Shows "Back to Encounters" button
- ✅ Patient demographics load correctly
- ✅ Recent appointments show:
  - Date
  - Provider/doctor name (not "Not specified")
  - Appointment type
- ✅ Current medications show:
  - Medication name
  - Dosage
  - Instructions
  - Status (active, current, signed)
- ✅ Medical conditions show:
  - Condition name (from `event` or `diagnosis` field)
  - ICD code (if available)
- ✅ Recent lab orders show (if any)

**Test Cases:**
- Staff access (source parameter) → Should bypass login
- Patient portal access (no source) → Should require login
- Missing medications → Should show "No current medications"
- Missing conditions → Should show "No medical conditions recorded"
- Provider name missing → Should show "Not specified" (but test to avoid this)

---

### **Scenario 3.3: Load Medications for Patient Summary**

**Critical:** Medications must load from multiple sources.

**Data Sources (in order of priority):**
1. Supabase `prescriptions` table (filter by patient UUID)
2. Supabase `patients` table → `prescriptions` JSONB column
3. Supabase `patients` table → `medications` JSONB column
4. localStorage fallback

**Expected Behavior:**
- ✅ Medications load from all sources
- ✅ Active medications are filtered correctly:
  - Status: "active", "current", "signed", "", or undefined
  - Case-insensitive matching
- ✅ Medications display with:
  - Name
  - Dosage
  - Instructions
  - Frequency

**Test Cases:**
- Medications in `prescriptions` table → Should load
- Medications in `patients.prescriptions` JSONB → Should load
- Medications in `patients.medications` JSONB → Should load
- Mixed sources → Should combine all medications
- No medications → Should show empty state

---

### **Scenario 3.4: Load Medical Conditions**

**Critical:** Conditions must be parsed from multiple field names.

**Field Names to Check (in order):**
1. `event` (from `medical_history`)
2. `diagnosis` (from `diagnoses`)
3. `name`, `description`, `condition`, `disease`, `medicalCondition`, `diagnosisName`

**Expected Behavior:**
- ✅ Conditions load from all possible field names
- ✅ Condition name displays correctly (not "Unknown")
- ✅ ICD code displays correctly (if available)
- ✅ Conditions are deduplicated

**Test Cases:**
- Conditions with `event` field → Should use `event` as name
- Conditions with `diagnosis` field → Should use `diagnosis` as name
- Conditions with neither → Should try other field names
- No conditions → Should show "No medical conditions recorded"

---

## 💰 WORKFLOW 4: BILLING & PAYMENTS

### **Scenario 4.1: Create Invoice**

**Steps:**
1. Navigate to `/quick-checkout` or billing page
2. Select patient
3. Add services
4. Apply discount (optional)
5. Create invoice

**Expected Behavior:**
- ✅ Invoice is saved to Supabase
- ✅ Invoice number is generated
- ✅ Services are correctly calculated
- ✅ Discount is applied correctly
- ✅ Total amount is correct

---

### **Scenario 4.2: Record Payment**

**Steps:**
1. Navigate to invoice details
2. Click "Record Payment"
3. Enter payment amount and method
4. Save payment

**Expected Behavior:**
- ✅ Payment is saved to Supabase
- ✅ Invoice status is updated
- ✅ Balance is recalculated
- ✅ Payment appears in payment history

---

## 🔐 WORKFLOW 5: AUTHENTICATION & AUTHORIZATION

### **Scenario 5.1: Staff Login**

**Steps:**
1. Navigate to `/login`
2. Enter staff credentials
3. Click "Login"

**Expected Behavior:**
- ✅ User is authenticated via Supabase
- ✅ Session is created
- ✅ User is redirected to dashboard
- ✅ Organization context is set
- ✅ Can access all staff pages

---

### **Scenario 5.2: Patient Portal Access**

**Steps:**
1. Staff: Navigate to `/patient-summary?patientId=MEC0012&source=encounters`
2. Patient: Navigate to `/patient-portal` and login

**Expected Behavior (Staff):**
- ✅ **NO login required** (staff access)
- ✅ Can view patient summary
- ✅ "Back to Encounters" button visible
- ✅ Patient portal navigation hidden

**Expected Behavior (Patient):**
- ✅ Login required
- ✅ Can only view own data
- ✅ Patient portal navigation visible

---

## 🔄 WORKFLOW 6: DATA PERSISTENCE & SYNC

### **Scenario 6.1: Supabase-First Architecture**

**Test:** Verify Supabase is always tried first.

**Expected Behavior:**
- ✅ Data operations try Supabase first
- ✅ If Supabase succeeds, data is saved there
- ✅ localStorage is updated as backup
- ✅ If Supabase fails, localStorage is used
- ✅ Failed operations are queued for sync

---

### **Scenario 6.2: Offline Mode**

**Steps:**
1. Disable network (offline mode)
2. Perform data operations (create patient, appointment, etc.)

**Expected Behavior:**
- ✅ Operations save to localStorage
- ✅ User sees "Saved locally, will sync when online"
- ✅ Data appears in UI immediately
- ✅ When online, data syncs to Supabase
- ✅ No data loss

---

### **Scenario 6.3: UUID vs. Legacy ID Handling**

**Critical:** This is a frequent source of bugs.

**Rules:**
1. `patient.id` must ALWAYS be legacy ID (e.g., "MEC0012")
2. UUID must be stored in `patient._supabaseUuid`
3. Supabase queries use `patient_id` field (which stores legacy ID in `patients` table)
4. Supabase queries to `appointments`, `prescriptions`, `orders` use UUID (from `_supabaseUuid`)

**Test Cases:**
- Creating patient → `patient.id` is legacy ID, UUID in `_supabaseUuid`
- Loading patient → `patient.id` is legacy ID after `resolvePatientByIdentifier`
- Saving clinical note → Uses `patient.id` (legacy ID) in `patient_id` field
- Loading appointments → Resolves legacy ID to UUID for query
- Loading medications → Resolves legacy ID to UUID for query

---

## 📊 TEST EXECUTION CHECKLIST

Before deploying ANY change, verify:

- [ ] **Workflow 1:** Patient Management (all scenarios)
- [ ] **Workflow 2:** Appointment Scheduling (all scenarios)
- [ ] **Workflow 3:** Clinical Documentation (all scenarios)
- [ ] **Workflow 4:** Billing & Payments (all scenarios)
- [ ] **Workflow 5:** Authentication & Authorization (all scenarios)
- [ ] **Workflow 6:** Data Persistence & Sync (all scenarios)

---

## 🚨 CRITICAL VALIDATION POINTS

These MUST be verified in every test run:

1. ✅ `patient.id` is NEVER a UUID (always legacy ID format)
2. ✅ UUID is stored in `patient._supabaseUuid`
3. ✅ Supabase-first architecture is preserved
4. ✅ localStorage fallback works
5. ✅ Patient ID resolution works (UUID → legacy ID)
6. ✅ Staff access to patient summary works without login
7. ✅ Patient portal access requires login
8. ✅ Provider names display correctly (not "Not specified")
9. ✅ Medications load and display correctly
10. ✅ Medical conditions load and display correctly

---

**Last Updated:** 2025-01-XX  
**Owner:** Development Team

