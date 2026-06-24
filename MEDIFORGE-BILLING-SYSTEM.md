# MediForge Billing System: Canada / USA Toggle

**Last updated:** June 17, 2026  
**Module:** `src/billing/` → `lib/billing/` (Node) + `js/billing-service-browser.js` (browser)

---

## Overview

MediForge billing supports two production modes controlled by **`system.billingMode`**:

| Mode | Primary payers | Fee codes | Claims | Compliance |
|------|----------------|-----------|--------|------------|
| **Canada** (default) | OHIP, MSP, RAMQ, AHCIP | Provincial (e.g. A007A) | MCEDT, Teleplan, HLINK | PHIPA |
| **USA** | Medicare, Medicaid, commercial | CPT / HCPCS | HIPAA 837P / ERA 835 | HIPAA |

Toggling the mode changes fee schedules, payer lists, claim formats, submission channels, UI labels, validation rules, and checkout workflows **for new activity**. Existing invoices and claims retain **`billingModeAtCapture`** so historical records stay accurate.

---

## How to switch modes

1. Go to **Dashboard → Billing → Configure services & pricing** (`configure-services.html`).
2. Under **Global Billing Settings**, choose **Billing System**:
   - **Canada**: Provincial (OHIP, MSP, RAMQ, AHCIP)
   - **USA**: Insurance (CPT / ICD-10-CM / 837P)
3. Save: currency default updates (CAD or USD) and the org setting is stored in:
   - `localStorage`: `{org}_billing_settings.system.billingMode`
   - **Supabase**: `organizations.settings.billingMode` and `organizations.settings.system.billingMode`

Admins only. Default for new organizations: **Canada**.

---

## Configuration files

| File | Purpose |
|------|---------|
| `config/billing-canada.json` | Provincial payers, OHIP sample fee schedule, MCEDT/Teleplan channels, PHN validation |
| `config/billing-usa.json` | Commercial/Medicare payers, CPT samples, 837P/ERA, member ID validation |
| `config/billing-payers.json` | Legacy shared payer/copay rules (still used by payer engine hooks) |

Sample Ontario codes in Canada config: **A007A**, **A003A**, **K005A**, etc.  
Sample US codes: **99213**, **99214**, **85025**, **71046**, **J1885** (HCPCS).

---

## BillingService API

**Node / tests:** `const { BillingService } = require('./src/billing');`  
**Browser:** `await MediForgeBillingService.getService()`

| Method | Description |
|--------|-------------|
| `generateClaim({ encounter, patient, provider, invoice, services })` | Build provincial or 837P claim draft from encounter |
| `submitClaim(claim, options)` | Queue/submit via MCEDT, Teleplan, or clearinghouse |
| `processRemittance(raw, invoices)` | Parse remittance / ERA and reconcile |
| `collectPatientPayment({ invoice, payment, patient })` | Validate method, issue receipt metadata |
| `mapEncounterToInvoiceData({ encounter, patient })` | Auto-pull fee codes + diagnoses for invoicing |
| `enrichInvoiceForPatient(invoice, patient)` | Payer split, copay, currency |
| `validateRegistration(patient)` | PHN (Canada) or member ID (USA) checks |
| `buildAgingReport(invoices)` | Reconciliation / dunning buckets |

All actions append to an in-memory **audit log** (`getAuditLog()`) for compliance tracing. Production should also use `logAuditEvent` in the browser hooks.

---

## Sample claim flows

### Canada: OHIP office visit

1. Patient registered with **provincial** payer + PHN (Ontario).
2. Doctor completes encounter → **Bill Visit** uses `A007A` from Ontario schedule.
3. Invoice created with `billingModeAtCapture: Canada`, payer split $0 patient due (insured).
4. `generateClaim` → provincial draft → `submitClaim` queues to **MCEDT** until credentials configured.
5. Remittance advice posts payer payment; patient balance unchanged.

### USA: Commercial E/M visit

1. Patient registered with **private insurance** + member ID.
2. Encounter billed with **CPT 99213**.
3. Invoice split ~80% payer / 20% patient responsibility.
4. `generateClaim` → 837P draft → clearinghouse submission.
5. **ERA (835)** remittance applied; patient collects copay via cash/card/Zelle.

---

## Workflows updated

| Area | Integration |
|------|-------------|
| **Admin settings** | `configure-services.html`: billing mode toggle |
| **Encounters** | `js/encounter-billing.js`: fee schedule + claim draft |
| **Checkout** | `collect-payment.html`: mode-aware payment scripts |
| **Registration** | `BillingService.validateRegistration()`: PHN vs member ID |
| **Payer hooks** | `js/billing-payer-hooks.js`: existing copay/claim queue (unchanged path) |

---

## Province / US payer setup

### Canada

- Set patient **Primary payer** = Provincial health plan.
- Enter **PHN** and version code on registration / edit patient.
- Configure provider **billing number** on staff profile (OHIP billing #).
- Enable MCEDT/Teleplan credentials when ready (transport stubs return `queued: true` until configured).

### USA

- Set **Primary payer** = Private insurance (or Medicare/Medicaid when configured).
- Enter **member / certificate number** and policy/group.
- Provider **NPI** required for claims (`validation.requireNpi`).
- Connect clearinghouse URL when `submitClaim(..., { enabled: true })`.

---

## Tests

```bash
npm run test:billing
```

Includes:

- `tests/billing/billing-service-canada.test.js`: 11 Canada scenarios
- `tests/billing/billing-service-usa.test.js`: 12 USA scenarios
- `tests/billing/billing-payer.test.js`: legacy payer engine tests

---

## Compliance notes

- **PHIPA (Canada):** Audit claim generation, payment collection, and remittance posting. PHN stored in `patient_payer_profiles` / patient record; minimize exposure in logs.
- **HIPAA (USA):** 837P/ERA handling must use encrypted transport in production; audit log supplements `audit_logs` table.
- **Data integrity:** Never rewrite `billingModeAtCapture` on existing invoices when the org toggles mode.
- **Live submission:** MCEDT, Teleplan, RAMQ, and US clearinghouses require clinic credentials: stubs queue claims safely until onboarding completes.

---

## File map

```
config/billing-canada.json
config/billing-usa.json
src/billing/index.js
lib/billing/
  billing-service.js      ← BillingService class
  mode-config.js
  fee-schedule.js
  encounter-charges.js
  reconciliation.js
  payer-engine.js
  claims-adapter.js
  remittance-adapter.js
js/billing-mode-manager.js
js/billing-service-browser.js
js/encounter-billing.js
tests/billing/billing-service-canada.test.js
tests/billing/billing-service-usa.test.js
```

---

## Related docs

- `BILLING-SYSTEM-GUIDE.md`: cash register & invoices
- `MEDIFORGE-BILLING-AND-PAYMENTS-DOCS.md`: payer profiles migration
- `billing-payments-gaps.md`: remaining production gaps (live MCEDT, Supabase catalog sync)
