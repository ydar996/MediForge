# Phase 3 Completion: MCEDT Claims (OHIP)

**Date:** June 2026  
**Plan reference:** `ONTARIO-EMR-IMPLEMENTATION-PLAN.md` Phase 3

Phase 3 delivers the **software foundation** for Ontario OHIP claim submission via MCEDT. Live MOH upload, remittance download, and eligibility API remain **blocked until clinic MOH credentials** are enrolled (same gate every certified EMR vendor passes).

## Task status

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| 3.1 | OHIP claim draft from clinical billing | Done | `claims-adapter.js`, `billing-payer-engine.js`, invoice workflow |
| 3.2 | Ontario L-codes on lab lines | Done | `lab-code-resolver.js` |
| 3.3 | OHIP imaging fee codes | Done | `ohip-imaging-fee-crosswalk.json` |
| 3.4 | MOH claim file format | Partial | `mcedt-format.js` XML export; XSD sign-off needs MOH test env |
| 3.5 | MCEDT Web Service client | Partial | `mcedt-client.js`; live upload blocked |
| 3.6 | Clinic MOH credentials | Partial | `/mcedt-settings`, `organizations.settings.mcedt`; certs in Netlify env |
| 3.7 | Batch claim submission scheduler | Partial | `claims-batch-daily` Netlify function |
| 3.8 | Error handling / rejection workflow | Partial | `claims-workflow.js`, `/claims-queue` resubmit |
| 3.9 | Remittance download and parsing | Partial | Parse + reconcile done; live MCEDT download blocked |
| 3.10 | Payment reconciliation UI | Done | `/remittance-reconcile` |
| 3.11 | Cut-off date logic | Done | `mcedt-cutoff.js` |
| 3.12 | OHIP eligibility checking API | Partial | PHN format check; live MOH API blocked |

## New in Phase 3

- **MCEDT libraries:** format validation, XML serialization, cut-off dates, client interface, claims workflow.
- **Gateway actions:** `batchSubmitClaims`, `checkOhipEligibility`, `downloadMcedtRemittance`, `exportMcedtXml`.
- **Staff UI:** `/claims-queue`, `/remittance-reconcile`, `/mcedt-settings`.
- **Invoice details:** Export JSON/XML, queue OHIP submit.
- **Billing dashboard:** links to claims queue, remittance, MCEDT settings.
- **Tests:** `tests/billing/mcedt-phase3.test.js` (8 tests).

## Owner / clinic actions

1. Enroll clinic with MOH MCEDT and obtain billing number + certificates.
2. Enter billing number in **MCEDT Settings** (`/mcedt-settings`).
3. Store MOH certificates in Netlify environment variables (platform operator).
4. Enable Ontario integration in `config/provinces/on.json` when ready for live pilot.

## Blocked (partner credentials)

- Live claim upload to MOH
- Live remittance download from MCEDT
- Live OHIP Health Card Validation / eligibility API

---

*Not an MOH certification claim. For Strategic Partner summary see `/strategic-partner-letter` and `/ontario-readiness`.*
