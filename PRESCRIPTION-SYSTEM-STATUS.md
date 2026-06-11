# Prescription System Status & Answers

## Your Questions Answered

### 1. Does the prescription appear on the pharmacy dashboard?

**YES**, but only if all of the following are true:
- ✅ The prescription is **signed** (`status === 'signed'`)
- ✅ Your organization has **in-house pharmacy enabled** (`settings.in_house_pharmacy === true`)
- ✅ The prescription is **synced to the Supabase `prescriptions` table** (not only saved to the patient record)

**What was fixed (Feb 2025):** Previously, when doctors signed prescriptions, the app only saved them into the **patient record** (patient.prescriptions and sync to `patients` table). The Pharmacy dashboard reads from the **`prescriptions`** table, so those prescriptions never appeared. Now, when you sign and save a prescription:
1. It is still saved to the patient record (so it shows on patient-details, clinical-note, etc.).
2. It is also inserted/updated in the Supabase **`prescriptions`** table with `pharmacy_status = 'pending'` (if in-house pharmacy is enabled), so it appears on the Pharmacy dashboard for fulfilment.

**Required:** `prescription.html` must load `js/prescriptions-supabase.js` (so `createPrescription` runs). This is already added to `prescription.html`.

**If in-house pharmacy is disabled:**
- Prescriptions get `pharmacy_status = 'external'`
- They can be downloaded/printed for external pharmacies
- They do NOT appear on the pharmacy dashboard

**To check if in-house pharmacy is enabled:**
- Dashboard → toggle "💊 In-House Pharmacy: True/False", or check in Supabase: `organizations.settings.in_house_pharmacy`

### 2. What's in place for doctors to know fulfillment status?

**CURRENT STATUS:** ❌ **NOT IMPLEMENTED**

Currently, doctors **cannot see** prescription fulfillment status on:
- `patient-details.html`
- `patient-encounters.html`
- `clinical-note.html`

The pharmacy dashboard tracks status (pending → in-process → filled), but doctors don't have visibility.

**RECOMMENDATION:** Add pharmacy status column to prescription tables on patient pages.

### 3. Why don't I see existing prescriptions on prescription.html?

**ANSWER:** `prescription.html` is a **form to CREATE new prescriptions**, not a list view.

Existing prescriptions are displayed on:
- ✅ `patient-details.html` - Shows all prescriptions for the patient
- ✅ `patient-encounters.html` - Shows prescriptions for that specific visit
- ✅ `clinical-note.html` - Shows prescriptions for that visit

**RECOMMENDATION:** Consider adding a section on `prescription.html` to show existing prescriptions for that patient/visit.

### 4. Are prescriptions syncing to patient-details and patient-encounters?

**YES** ✅ Prescriptions sync via:
- `loadPrescriptionsForVisit()` - Loads prescriptions for a specific visit
- `loadAllPrescriptionsForPatient()` - Loads all prescriptions for a patient
- Both functions sync from Supabase to localStorage and vice versa

## System Architecture

### Prescription Flow:
1. **Doctor creates prescription** → Saved to Supabase `prescriptions` table
2. **If signed + in-house pharmacy enabled** → `pharmacy_status = 'pending'` → Appears on pharmacy dashboard
3. **Pharmacist processes** → Status changes: `pending` → `in-process` → `filled`
4. **Prescriptions sync** → Available on patient-details, patient-encounters, clinical-note

### Database Schema:
- `prescriptions.pharmacy_status`: `'pending' | 'in-process' | 'filled' | 'cancelled' | 'external'`
- `prescriptions.sent_to_pharmacy_at`: Timestamp when sent to pharmacy
- `prescriptions.filled_at`: Timestamp when filled
- `prescriptions.filled_by_user_id`: Pharmacist who filled it

## Recommended Improvements

1. **Add pharmacy status to patient pages** - Show fulfillment status to doctors
2. **Add existing prescriptions list to prescription.html** - Show what's already been prescribed
3. **Add pharmacy status filter** - Allow filtering by status on patient pages
4. **Add notifications** - Alert doctors when prescriptions are filled

