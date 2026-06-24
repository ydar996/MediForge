# Ontario EMR Specification Traceability Matrix

**Last updated:** June 2026 (Phases 0–6 software complete where possible)  
**Purpose:** Map MediForge capabilities to Ontario EMR specification categories for OntarioMD diligence and internal Stage 1–4 self-assessment.

Legend: **Done** = implemented and testable in product · **Partial** = foundation or UI without live provincial pipe · **Blocked** = requires partner credentials or OntarioMD process · **N/A** = out of scope today

## Foundation specifications

| Spec area | Requirement (summary) | Status | Evidence |
|-----------|----------------------|--------|----------|
| Patient demographics | Register, update, display patient | Done | Patient registration, chart, MRN |
| Problem list / diagnoses | ICD-10-CA / ICD-11 coding | Done | Conditions module, ICD catalogs |
| Medications | Prescribing and history | Done | Prescriptions, Health Canada DPD |
| Allergies | Capture and alerts | Done | Allergy checks in Rx workflow |
| Immunizations | Record and report | Partial | Chart fields; i4C mapping helper |
| Clinical notes | Provider documentation | Done | Encounters, SOAP notes |
| Orders | Lab, imaging, procedures | Done | Order workflows, external lab/imaging desks |
| Results | Lab/imaging results in chart | Partial | ORU/DiagnosticReport ingest + chart banner |
| Documents | Store and view clinical documents | Done | Patient documents, DICOMweb links |
| Audit trail | Who accessed/changed what | Partial | Append-only audit_logs, gateway audit |
| Consent | Structured consent capture | Done | `/patient-consents`, OLIS + eRx consent types |
| CPP summary | Ontario-aligned patient summary | Done | `/cpp-patient-summary` |
| FHIR export | Interoperable chart export | Done | FHIR R4 Bundle from chart |
| HL7 ADT export | Demographics for HIE | Partial | `interoperability.js` + patient chart button |
| Security / PHIPA | Policies and controls | Partial | `docs/compliance/` pack + encryption runbook |

## Functional specifications (selected)

| Spec area | Requirement (summary) | Status | Evidence |
|-----------|----------------------|--------|----------|
| Scheduling | Appointments and calendar | Done | Appointments module |
| Billing | Fee codes, invoices | Done | Billing dashboard, OHIP L-codes |
| Claims | OHIP claim submission | Partial | MCEDT queue, XML export, rejection UX |
| Portal | Patient access to results | Done | Patient portal, results workflow |
| Reporting | Clinic analytics | Done | Reports, preventive gaps |
| ePrescribing | External pharmacy network | Partial | Rx pharmacy picker, `/erx-queue` |
| Lab requisitions | Order and track labs | Done | Lab orders, external lab desk |
| Imaging requisitions | Order imaging | Done | Imaging orders, external imaging desk |
| Critical results | Alert providers | Partial | Critical lab banner on dashboard + patient chart |

## EHR connectivity specifications

| Hub / standard | Requirement (summary) | Status | Evidence |
|----------------|----------------------|--------|----------|
| OLIS | HL7 ORM/ORU lab interface | Partial | Phase 4 lab desk, `/lab-results-queue` |
| OLIS | FHIR Patient Query | Partial | Gateway stub + PHN registry |
| OLIS | Patient consent before query | Done | `olis_query` consent + server gate |
| OLIS | LOINC / pCLOCD mapping | Partial | `loinc-pclocd.js` + config overlays |
| MCEDT | Claim file and submission | Partial | Phase 3 MCEDT modules |
| MCEDT | Rejection handling | Partial | Claims queue guided resubmit |
| PrescribeIT | MedicationRequest transmit | Partial | eRx queue; transmit/cancel/renew/dispense |
| PrescribeIT | Pharmacy routing | Partial | Pharmacy directory + Rx form picker |
| PrescribeIT | CCDD overlay | Partial | `ccdd.js` + formulary DIN lookup |
| DIR / Imaging | ORM/FHIR order outbound | Partial | `/external-imaging-orders` |
| DIR / Imaging | Report ingest | Partial | `/imaging-results-queue` |
| DIR / Imaging | DICOMweb links | Partial | Chart viewer, documents, orders tab |
| ConnectingOntario | DI viewer launch | Partial | Chart + interop dashboard stubs |
| SMART-on-FHIR | Contextual viewer launch | Partial | Chart + interop dashboard stubs |
| HRM | Hospital report inbox | Partial | `/hrm-inbox`, Phase 7 software |
| DHDR | Provincial drug repository | Partial | Chart query + gateway stub, Phase 7 |
| ONE ID | Provincial identity federation | Blocked | Supabase auth today |

## Test and evidence artifacts

| Artifact | Location |
|----------|----------|
| Automated interop tests | `tests/interop/`, `tests/integrations/` |
| MCEDT Phase 3 tests | `tests/billing/mcedt-phase3.test.js` |
| OLIS Phase 4 tests | `tests/interop/phase4-olis.test.js` |
| PrescribeIT Phase 5 tests | `tests/interop/phase5-prescribeit.test.js` |
| Imaging Phase 6 tests | `tests/interop/phase6-imaging.test.js` |
| Phase 0–6 polish tests | `tests/interop/phases-0-6-polish.test.js` |
| HL7 samples | `tests/samples/hl7/` |
| Terminology mapping status | `docs/TERMINOLOGY-MAPPING-STATUS.md` |
| Gap report | `docs/ONTARIOMD-GAP-REPORT.md` |
| Shareable readiness | `/ontario-readiness` |
| Evidence binder | `/evidence-binder` |
| Self-assessment | `/ontario-self-assessment` |

## Staff UI quick reference

| Desk | URL |
|------|-----|
| Lab results | `/lab-results-queue` |
| External lab orders | `/external-lab-orders` |
| Imaging results | `/imaging-results-queue` |
| External imaging | `/external-imaging-orders` |
| eRx | `/erx-queue` |
| Claims | `/claims-queue` |
| Interop tests | `/interop-dashboard` |

---

*This matrix supports internal self-assessment only. It is not a submission to OntarioMD until the owner completes tasks 2.2–2.6 in the implementation plan.*
