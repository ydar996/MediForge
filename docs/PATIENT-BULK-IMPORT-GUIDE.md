# Bulk patient import guide

**Last updated:** June 17, 2026  
**Audience:** Clinic administrators migrating from paper charts or another EMR  
**Page:** Dashboard → **Patient Management** → **Bulk Import Patients (CSV/Excel)** (`/bulk-patient-import`)

---

## What it does

Imports many patients at once from a spreadsheet into your organization’s Supabase database (with local cache). Empty fields are allowed: complete them later in **Edit Patient**.

---

## Download the template

On the import page, click **Download Excel/CSV template**, or use:

`data/patient-bulk-import-template.csv`

Open in Excel, fill rows, then save as **CSV** or upload the **.xlsx** file directly.

---

## Required vs optional

| Required | Optional (edit later) |
|----------|------------------------|
| **First name** or **last name** (at least one) | Date of birth, gender, race, address, phone, email |
| | Emergency contact, payer / health card, clinical lists |

If date of birth is missing, a placeholder is stored so the row still imports; fix it in the patient chart.

---

## Patient IDs (MRN / file numbers)

| Option | When to use |
|--------|-------------|
| **Keep existing Patient IDs** (checkbox, default on) | Migrating legacy chart numbers: put them in the **Patient ID** column |
| Uncheck the box | Always assign new org auto-numbers (e.g. `MFA-SC0001`) |

Duplicate IDs in the file or database are skipped for that row; other rows continue.

---

## Semi-structured spreadsheets

Use **Map my columns** on the import page when your file came from another system (not our template).

Column headers are also matched automatically in **Template import** mode. Examples that work:

- `Surname`, `Given Name`, `Age (DOB)` like `63 (1962-11-27)`, `PHN`, `Health Ins. #`, `Chart No`, `Record ID`
- Medications in one cell: `Metformin 500mg; Lisinopril 10mg`
- Allergies: `Penicillin; Latex`

In **Map my columns** mode, any column you do not map to a standard field can be sent to **patient Notes** so nothing is lost.

---

## Patient IDs: keep or replace

| Checkbox | What happens |
|----------|----------------|
| **Keep existing Patient IDs** (on) | Uses numbers from your file (e.g. `1234`) when the column is mapped to Patient ID |
| **Unchecked** | Everyone gets a new org number (e.g. `MFA-SC0001`). The old file number is saved in **Notes** for reference |

---

## After import

1. **Manage Patients**: search and open charts to complete missing fields.
2. Upload ID and insurance card images per patient (not included in CSV import).
3. Review **Notes** on imported patients for bulk-import warnings.

---

## Technical notes (agents)

| Item | Detail |
|------|--------|
| Code | `js/bulk-patient-import.js`, `bulk-patient-import.html` |
| Saves | Supabase `patients` insert + localStorage via `getDataKey('patients')` |
| Supersedes | `data-import-export.html` localStorage-only CSV import for demographics |
| Excel | SheetJS (`xlsx` CDN): first worksheet, row 1 = headers |

---

*For deployment and env setup, see `AGENT-HANDOVER.md` and `DEPLOYMENT-PIPELINE.md`.*
