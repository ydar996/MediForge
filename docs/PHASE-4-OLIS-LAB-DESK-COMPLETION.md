# Phase 4 Completion: OLIS Lab Desk (Software)

**Date:** June 2026  
**Plan reference:** `ONTARIO-EMR-IMPLEMENTATION-PLAN.md` Phase 4

Phase 4 delivers the **software foundation** for Ontario OLIS-style lab connectivity: HL7 order export, ORU ingest, PHN registry, consent gates, and a staff review queue. Live Infoway MLLP/FHIR endpoints remain **blocked until provincial onboarding** (same gate every certified EMR vendor passes).

## Task status

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| 4.1 | HL7 v2 lab order outbound (ORM^O01) | Partial | Generator + **Export HL7** on external lab orders |
| 4.2 | HL7 v2 lab result inbound (ORU^R01) | Partial | Parser, gateway ingest, `/lab-results-queue` |
| 4.3 | FHIR ServiceRequest for lab orders | Partial | Adapter in gateway (existing) |
| 4.4 | FHIR DiagnosticReport ingest | Partial | Adapter in gateway (existing) |
| 4.5 | FHIR Patient Query (OLIS) | Partial | Gateway `fhirSearchPatients` + consent gate |
| 4.6 | Auto-ingest results into patient charts | Partial | `ingestOruAndApply`, order merge workflow |
| 4.7 | Patient PHN storage and matching | Partial | `patient_identifiers` table, `/patient-identifiers` |
| 4.8 | LOINC / pCLOCD code sets | Not started | Mapping layer only; licensed load pending |
| 4.9 | OLIS consent capture before query | Partial | `olis_query` consent, client + server gates |
| 4.10 | Inbound result review queue UI | Done | `/lab-results-queue` |
| 4.11 | Critical value alert handling | Partial | Notification hook on ingest |
| 4.12 | Infoway onboarding | Blocked | Partner enrollment |
| 4.13 | OntarioMD/OLIS sandbox testing | Blocked | Partner sandbox |

## New in Phase 4

- **Libraries:** `lib/interop/olis-consent.js`, `lib/interop/lab-results-workflow.js`
- **Staff UI:** `/lab-results-queue`, `/patient-identifiers`
- **Workflow hooks:** `ingestOruAndApply`, `exportLabOrderHl7`, consent checks on lab transmit
- **External lab orders:** Export HL7 (ORM) button per order
- **Gateway:** OLIS consent flag on lab send, ORU receive, FHIR patient search
- **Tests:** `tests/interop/phase4-olis.test.js`

## Owner / clinic actions

1. Complete Infoway / Ontario Health OLIS vendor onboarding when ready for sandbox.
2. Configure MLLP host in `config/provinces/on.json` (or org integration settings).
3. Enable **OLIS Lab Query** consent on patients before provincial network actions.
4. Ensure `patient_identifiers` and interop tables exist (Step 4 migration on each environment).

## Blocked (partner credentials)

- Live MLLP to OLIS
- Live FHIR Patient Query against provincial server
- OntarioMD/OLIS sandbox conformance sign-off

---

*Not an Infoway certification claim. For Strategic Partner summary see `/ontario-readiness` and `/strategic-partner-letter`.*
