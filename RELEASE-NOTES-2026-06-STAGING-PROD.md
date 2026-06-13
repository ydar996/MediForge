# MediForge Release Notes — June 2026 (Dev → Staging → Production)

**Release train:** `dev` → `staging` → `main`  
**Production website:** https://mediforge.netlify.app  
**Staging website:** https://mediforge-staging.netlify.app  
**Dev website:** https://mediforge-dev.netlify.app  

**Commits included:** `3e01354` through `23fb50b` (23 commits ahead of previous production)  
**⚠️ Database required:** Run SQL Steps 1–10 on **each** environment after deploy — see [SQL-RUN-PACKET-DEV-STAGING.md](SQL-RUN-PACKET-DEV-STAGING.md)

---

## Executive summary

This release transforms MediForge from an Africa-market EHR baseline into a **Canada-first** clinic platform: registration and intake with Canadian addresses and health card fields, **ICD-10-CA** as the default diagnosis standard, patient-reported medications with manual entry, a **production-ready interoperability layer** for provincial labs/imaging/Rx/billing (configurable, pending hub credentials), Canadian payer billing foundations, and repo-wide **icon/encoding fixes**.

---

## 1. Registration & clinic onboarding

### New / improved

| Feature | Detail |
|---------|--------|
| **Canada-first address UX** | Country defaults to Canada; cascading **province/state** and **city** dropdowns; **postal code** validation for CA/US |
| **Join existing organization** | Fixed RLS failures — user signs into Supabase Auth before profile insert; `insert_registration_profile` RPC for secure profile creation |
| **Plain-English errors** | Registration failures show readable messages (username taken, org not found, etc.) |
| **Auth email sanitization** | Internal `@mediforge.app` auth emails generated correctly from username + org id |
| **Payer / insurance fields** | Payment source, provincial health card (PHN), private insurance member/policy numbers on registration |
| **Health card uploads** | Optional front/back card image upload on add-patient (`patient-card-uploads.js`) |
| **Title case** | Automatic title case on name and address fields (`ui-title-case.js`) |
| **Registration trace logs** | Console trace helpers for debugging registration flows (`registration-trace.js`) |
| **Legal agreements** | Canada/US privacy law primary; updated agreement text on registration |

### Files touched

- `add-patient.html`, `register.html`, `patient-intake.html`
- `js/patients-supabase.js`, `js/auth.js`, `js/payment-source-fields.js`
- `js/us-ca-cities-data.js`, `js/us-ca-postal-codes-data.js`
- `supabase/migrations/20260611180000_registration_and_intake_fixes.sql`
- `supabase/migrations/20260612100000_registration_profile_rpc.sql`
- `sql-scripts/RUN-PACKET-dev-staging-idempotent.sql`

### SQL required

Steps **1**, **6**, **7** in SQL run packet.

---

## 2. Patient demographics — race (replaces Tribe)

### New / improved

| Feature | Detail |
|---------|--------|
| **Race field** | Standardized race/ethnicity dropdown with research-use note and *Declined to Disclose* option |
| **Tribe removed** | Legacy `tribe` column dropped after backfill to `race` |
| **Intake approval** | Self-registration intake writes `race` from submitted payload |
| **Reporting** | Race included in patient reporting workflows |

### Files touched

- `js/patient-race-options.js`
- `supabase/migrations/20260612110000_add_patient_race_column.sql`
- `supabase/migrations/20260612120000_intake_approval_race_column.sql`
- `supabase/migrations/20260612130000_drop_patient_tribe_column.sql`

### SQL required

Steps **8**, **9**, **10**.

---

## 3. Patient intake (self-registration)

### New / improved

| Feature | Detail |
|---------|--------|
| **Postal code & demographics** | Intake captures postal code and full address; approval RPC persists to patient record |
| **Org context RPC** | `get_organization_intake_context` for secure intake link resolution |
| **End-to-end audit fixes** | Blockers found in intake audit resolved (approval permissions, org activation) |
| **Rate limiting** | Failed intake attempts tracked; success clears limit |

### SQL required

Steps **2**, **3**, **6**.

---

## 4. Diagnosis codes — ICD-10-CA (Canadian physicians)

### New / improved

| Feature | Detail |
|---------|--------|
| **ICD-10-CA default** | ~98,000 codes from CDC order file (`js/icd10ca.js`); replaces ICD-11 as default search |
| **Org toggle** | Dashboard → Facility Configuration → **Diagnosis Codes: ICD-10-CA / ICD-11** per organization |
| **ICD-11 retained** | Toggle back to ICD-11 for organizations that need it |
| **Build script** | `npm run build:icd10ca` regenerates dataset from source file |
| **Custom diagnoses** | Free-text / custom entry still supported in ICD search flows |
| **Deploy fix** | Service worker cache bump; mojibake CI skip for large code files; versioned script loads |

### Pages wired

`add-patient`, `edit-patient`, `patient-intake`, `patient-details`, `clinical-note`, `prescription`, `patient-encounters`, `select-referrals`, `care-plan`, `dashboard`

### Files touched

- `js/icd-config.js`, `js/icd-version-settings.js`, `js/icd-selector.js`
- `js/icd10ca.js`, `scripts/build-icd10ca-js.mjs`
- `service-worker.js`

### SQL required

None (app-only).

---

## 5. Patient-reported medications

### New / improved

| Feature | Detail |
|---------|--------|
| **Canadian OTC list** | 48 common OTC medications (`common-otc-medications-ca.js`) |
| **Manual entry** | **"Not in list? Use my typed medication name"** button; dosage always editable; Enter confirms custom name |
| **Shared search module** | `patient-reported-medication-search.js` on add-patient and patient-intake |

### SQL required

None.

---

## 6. Canadian interoperability (labs, imaging, Rx, DICOM)

### New / improved

| Feature | Detail |
|---------|--------|
| **Unified IntegrationService** | `sendOrder`, `receiveResult`, `sendPrescription`, `submitClaim`, `processRemittance` |
| **HL7 v2** | ORM^O01 / OML^O21 orders; ORU^R01 results; MLLP transport |
| **FHIR R4** | ServiceRequest, DiagnosticReport, MedicationRequest (Infoway profile) |
| **DICOMweb** | QIDO-RS, WADO-RS, STOW-RS; C-FIND/C-MOVE via gateway |
| **Province config** | Ontario, BC, Alberta templates (`config/canada-provinces.json`, `config/provinces/*.json`) |
| **Gateway** | `netlify/functions/interop-gateway.js` — server-side routing + audit |
| **Workflow hooks** | Auto-transmit on lab/imaging order save, signed Rx; PHN registration on patient save |
| **Connection guide** | `MEDIFORGE-CONNECTION-GUIDE.md` — OntarioMD, Infoway, OLIS onboarding steps |

### Default state

`config/integrations.json` → **`enabled: false`** until provincial credentials configured. Messages are **built and queued**, not sent live.

### SQL required

Step **4** (`interop_messages`, `patient_identifiers` tables).

---

## 7. Billing & payments (Canadian payers)

### New / improved

| Feature | Detail |
|---------|--------|
| **Payer engine** | OHIP, RAMQ, MSP, AHCIP detection; invoice enrichment with payer split |
| **Claim drafts** | Provincial claim draft generation (MCEDT/Teleplan/HLINK transport placeholders) |
| **Remittance** | ERA parsing and invoice reconciliation |
| **Patient payments** | Cash, check, bank transfer, Interac e-Transfer, Zelle, card — with audit hooks |
| **Billing check-in** | New page wiring payer engine to check-in flow |
| **Config** | `config/billing-payers.json` — provincial payers, private insurers, copay rules |

### SQL required

Step **5** (`patient_payer_profiles`, `insurance_claims` tables).

---

## 8. UI quality — icons & encoding

### Fixed

| Issue | Fix |
|-------|-----|
| `??` / `?` icon placeholders | Replaced with Font Awesome across 62+ user-facing pages |
| Corrupted emoji (`ðŸ…`) | Fixed in backup/migration/test pages → FA icons |
| ICD-11 title mojibake | `Comirnaty®`, `Sézary syndrome`, en-dashes repaired in `icd11.js` |
| NGN currency `?` | Restored `₦` in backup billing pages |
| CI guards | `npm run scan:corruption`, `npm run fix:corruption`, `check:corrupted-text` includes ICD-11 |

### SQL required

None.

---

## 9. Infrastructure & documentation

| Item | Detail |
|------|--------|
| **Three-environment pipeline** | `dev` / `staging` / `main` branches → Netlify sites |
| **Deploy docs** | `DEPLOYMENT-PIPELINE.md`, `SETUP-DEV-STAGING-SIMPLE.md`, `PROMOTE-RELEASE-WALKTHROUGH.md` |
| **SQL packet** | `SQL-RUN-PACKET-DEV-STAGING.md` — Steps 1–10 idempotent |
| **Clinical tests** | `npm run test:clinical` — 32 tests (interop + integrations + billing) |
| **ICD-10 page tests** | `npm run test:icd10` / `test:icd10:dev` |
| **Netlify build** | `inject-supabase-env.cjs` + `npm run check` on deploy |

---

## Post-deploy checklist (per environment)

### After website deploys

Run on **MediForge Staging** first, then **MediForge-Prod** after staging smoke test:

| Step | Migration file |
|------|----------------|
| 1 | `sql-scripts/RUN-PACKET-dev-staging-idempotent.sql` |
| 2 | `20251109000000_create_patient_intake_tables.sql` *(if needed)* |
| 3 | `20260611170000_intake_approval_postal_demographics.sql` |
| 4 | `20260611000000_interoperability_tables.sql` |
| 5 | `20260611100000_billing_payers_tables.sql` |
| 6 | `20260611180000_registration_and_intake_fixes.sql` |
| 7 | `20260612100000_registration_profile_rpc.sql` |
| 8 | `20260612110000_add_patient_race_column.sql` |
| 9 | `20260612120000_intake_approval_race_column.sql` |
| 10 | `20260612130000_drop_patient_tribe_column.sql` |

### Auth URLs

| Environment | Site URL |
|-------------|----------|
| Staging | `https://mediforge-staging.netlify.app` |
| Production | `https://mediforge.netlify.app` |

### Smoke test (each environment after SQL)

1. Register test clinic (Canada address + postal code) OR join with org code  
2. Add patient — Race dropdown, ICD-10 search (diabetes → E11)  
3. Add patient-reported medication — custom name + dosage  
4. Patient intake link → submit → staff approve  
5. Dashboard → verify ICD-10/ICD-11 toggle under Facility Configuration  

---

## Commit log (oldest → newest)

```
3e01354 Add Canadian interoperability and billing/payer foundation for dev
beb3495 Make interop and billing migration scripts idempotent for dev
795d555 Put Canada and US first on registration with state and city dropdowns
2e4022f Fix registration auth email sanitization and clearer Supabase errors
32dbbd3 Use plain English registration errors and simple username guidance
f3b5c9d Add users registration RLS policy for clinic signup on dev
b03031b Improve registration and intake with postal codes, Canada-first addresses, and trace logs
3c07cdf Fix registration and intake blockers found in end-to-end audit
1070d64 Update legal agreements for Canada/US and refresh SQL run packet docs
3489ebe Make Canadian privacy law primary in legal agreements
68776dc Fix join-org registration by signing in before profile insert
0fc81fc Fix registration profile RLS with RPC and force fresh JS cache
0c8f002 Race-only demographics, reporting, and icon fixes for Dev deploy
c608f4f Registration UX: payer IDs, card uploads, address dropdowns, title case
a2260fa Fix address dropdowns broken by syntax error on add-patient
d4d1d4a Fix address dropdown initialization across registration pages
2c992d1 Add Canadian OTC meds, fix encoding, and repair ICD-11 titles
916f0e2 Add ICD-10-CA as default diagnosis codes with dashboard org toggle
177081f Fix Netlify deploy and ICD-10 loading on clinical pages
b0f222f Improve manual patient-reported medication entry on add-patient and intake
04f06ea Add unified Canadian integration layer for labs, imaging, Rx, and billing
f3b6187 Fix corrupted icons and text encoding across the entire app
23fb50b Add simple walkthrough for promoting dev to staging and production
```

---

*Generated: 13 June 2026*
