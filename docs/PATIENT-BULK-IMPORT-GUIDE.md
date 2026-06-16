# Bulk patient import guide

**Last updated:** June 16, 2026  
**Audience:** Clinic administrators migrating from paper charts or another EMR  
**Page:** Dashboard → **Patient Management** → **Bulk Import Patients (CSV/Excel)** (`/bulk-patient-import`)

---

## What it does

Imports many patients at once from a spreadsheet into your organization’s Supabase database (with local cache). Empty fields are allowed — complete them later in **Edit Patient**.

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
| **Keep existing Patient IDs** (checkbox, default on) | Migrating legacy chart numbers — put them in the **Patient ID** column |
| Uncheck the box | Always assign new org auto-numbers (e.g. `MFA-SC0001`) |

Duplicate IDs in the file or database are skipped for that row; other rows continue.

---

## Semi-structured spreadsheets

Column headers are matched flexibly. Examples that work:

- `Surname`, `Given Name`, `DOB`, `PHN`, `Chart No`, `File Number`
- Medications in one cell: `Metformin 500mg; Lisinopril 10mg`
- Allergies: `Penicillin; Latex`

Tab-separated paste is supported when using **Parse pasted CSV**.

---

## After import

1. **Manage Patients** — search and open charts to complete missing fields.
2. Upload ID and insurance card images per patient (not included in CSV import).
3. Review **Notes** on imported patients for bulk-import warnings.

---

## Technical notes (agents)

| Item | Detail |
|------|--------|
| Code | `js/bulk-patient-import.js`, `bulk-patient-import.html` |
| Saves | Supabase `patients` insert + localStorage via `getDataKey('patients')` |
| Supersedes | `data-import-export.html` localStorage-only CSV import for demographics |
| Excel | SheetJS (`xlsx` CDN) — first worksheet, row 1 = headers |

---

*For deployment and env setup, see `AGENT-HANDOVER.md` and `DEPLOYMENT-PIPELINE.md`.*
