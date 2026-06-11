# Dev test checklist – Send to Lab Scientist & regression

**Build:** Root-cause fix (org resolved once at load; Send disabled until ready; simplified send path)  
**Dev URL:** https://mediforge-dev.netlify.app  
**Test account:** ydar2@mecureclinics.com / passcode: ydar2  

Use this checklist to confirm the send-to-lab flow and that existing behaviour is intact.

---

## 1. Login and dashboard

- [ ] Open https://mediforge-dev.netlify.app (or platform-login if your entry point is different).
- [ ] Log in with **ydar2@mecureclinics.com** / **ydar2**.
- [ ] Dashboard loads; no console errors.
- [ ] Navigate to **Patients** and open a patient (or create one if needed).
- [ ] Open a **visit** (or create one) and go to **Clinical note** (or the flow that leads to lab orders).

---

## 2. Select lab orders page – load behaviour

- [ ] From the clinical note (or equivalent), open **Select lab orders** for a patient and visit (with valid `patientId` and `visitDate` in the URL).
- [ ] Page loads; patient info and visit date show at the top.
- [ ] Lab tests table appears with checkboxes and status badges.
- [ ] If your org has in-house lab enabled: **“Send to Lab Scientist”** (per row and/or bulk) is visible.
- [ ] No yellow banner saying “Organization could not be loaded” (if you see it, log out and log in again, then retry).
- [ ] **Bulk actions:** “Send Selected to Lab Scientist” and “Send Selected to Outside Lab” are **disabled** when no tests are selected; they **enable** when at least one test is selected (and org/client are ready).

---

## 3. Send to lab scientist – single test

- [ ] Select **one** lab test (e.g. “Random Blood Sugar” or “Prolactin”).
- [ ] Click the row **“Send to Lab Scientist”** (or use bulk “Send Selected to Lab Scientist” with one selected).
- [ ] A success message appears (e.g. “Lab test … has been sent to lab scientist”).
- [ ] That row’s status badge updates from “Pending” to “Sent to lab” (or your app’s equivalent).
- [ ] In **Lab scientist dashboard** (or lab scientist view), the new order appears for that patient/visit (log in as lab scientist if needed to verify).

---

## 4. Send to lab scientist – multiple tests

- [ ] Select **multiple** tests (e.g. 2–3).
- [ ] Click **“Send Selected to Lab Scientist”**.
- [ ] Confirm in the confirmation dialog if shown.
- [ ] A single success message appears (e.g. “All X selected test(s) have been sent to lab scientist”).
- [ ] All selected rows’ status badges update.
- [ ] In lab scientist view, all those tests appear as orders for that patient/visit.

---

## 5. Send to external lab

- [ ] Select one or more tests.
- [ ] Click **“Send Selected to Outside Lab”** (or per-row “Send Out”).
- [ ] Success message appears and status updates (e.g. “Sent to external lab”).
- [ ] No errors in console.

---

## 6. Print lab orders

- [ ] Select one or more tests (or leave as-is if print works without selection).
- [ ] Click **“Print Lab Orders”**.
- [ ] Print dialog or preview opens with correct patient, visit, org name, and selected tests.
- [ ] No console errors.

---

## 7. Existing orders and patient info

- [ ] For a visit that **already has** lab orders sent earlier, open **Select lab orders** again for the same patient/visit.
- [ ] Existing orders show with the correct status (e.g. “Sent to lab”) so you don’t resend the same test by mistake.
- [ ] Patient info block at the top shows correct name, ID, DOB, visit date.

---

## 8. Back navigation and other flows

- [ ] **“Back to Clinical Note”** (or equivalent) returns to the correct page without errors.
- [ ] From dashboard, open **Patients** → patient → **Lab results** (or **Lab orders** list): existing behaviour unchanged.
- [ ] **Lab result entry** for an order (e.g. from lab scientist dashboard) still opens and saves correctly (hormone panel, etc., if you use that).

---

## 9. Error cases (optional)

- [ ] If you have a way to open select-lab-orders **without** being logged in (or with a user that has no org): a yellow banner should say “Organization could not be loaded…” and Send buttons should stay disabled.
- [ ] If Supabase is unreachable and you have the patient in localStorage: sending may fall back to “saved locally” with the message that the lab scientist may not see it until synced; no silent failure.

---

## 10. Devices (if possible)

- [ ] Repeat **sections 2–4** on a **phone** or **tablet** (or narrow browser window): same behaviour, Send works after page load, no race where Send appears to work but order is not saved.

---

## Sign-off

- [ ] All checked items pass.
- [ ] No regressions in login, dashboard, patients, clinical note, print, or lab scientist view.
- [ ] Build is ready to promote to staging/production.

**Tester:** _________________ **Date:** _________________
