# Ontario EMR Specification Traceability Matrix

**Last updated:** June 2026  
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
| Orders | Lab, imaging, procedures | Done | Order workflows, external lab desk |
| Results | Lab/imaging results in chart | Partial | Manual upload + ORU ingest queue |
| Documents | Store and view clinical documents | Done | Patient documents, image viewer |
| Audit trail | Who accessed/changed what | Partial | Append-only audit_logs, gateway audit |
| Consent | Structured consent capture | Partial | `/patient-consents`, OLIS consent type |
| CPP summary | Ontario-aligned patient summary | Done | `/cpp-patient-summary` |
| FHIR export | Interoperable chart export | Done | FHIR R4 Bundle from chart |
| Security / PHIPA | Policies and controls | Partial | `docs/compliance/` pack; audit pending |

## Functional specifications (selected)

| Spec area | Requirement (summary) | Status | Evidence |
|-----------|----------------------|--------|----------|
| Scheduling | Appointments and calendar | Done | Appointments module |
| Billing | Fee codes, invoices | Done | Billing dashboard, OHIP L-codes |
| Claims | OHIP claim submission | Partial | MCEDT queue, XML export (Phase 3) |
| Portal | Patient access to results | Done | Patient portal, results workflow |
| Reporting | Clinic analytics | Done | Reports, preventive gaps |
| ePrescribing | External pharmacy network | Partial | In-clinic Rx; PrescribeIT stub |
| Lab requisitions | Order and track labs | Done | Lab orders, external lab desk |
| Imaging requisitions | Order imaging | Done | Imaging orders module |

## EHR connectivity specifications

| Hub / standard | Requirement (summary) | Status | Evidence |
|----------------|----------------------|--------|----------|
| OLIS | HL7 ORM/ORU lab interface | Partial | Phase 4 lab desk, `/lab-results-queue` |
| OLIS | FHIR Patient Query | Partial | Gateway stub + PHN registry |
| OLIS | Patient consent before query | Partial | `olis_query` consent + server gate |
| MCEDT | Claim file and submission | Partial | Phase 3 MCEDT modules |
| PrescribeIT | MedicationRequest transmit | Partial | Rx adapter queues when disabled |
| HRM | Hospital report inbox | Blocked | Not implemented |
| DHDR | Provincial drug repository | Blocked | Not implemented |
| ConnectingOntario | DI viewer launch | Blocked | Config stub only |
| ONE ID | Provincial identity federation | Blocked | Supabase auth today |

## Test and evidence artifacts

| Artifact | Location |
|----------|----------|
| Automated interop tests | `tests/interop/`, `tests/integrations/` |
| MCEDT Phase 3 tests | `tests/billing/mcedt-phase3.test.js` |
| OLIS Phase 4 tests | `tests/interop/phase4-olis.test.js` |
| HL7 samples | `tests/samples/hl7/` |
| Gap report | `docs/ONTARIOMD-GAP-REPORT.md` |
| Shareable readiness | `/ontario-readiness` |
| Evidence binder | `/evidence-binder` |
| Self-assessment | `/ontario-self-assessment` |

---

*This matrix supports internal self-assessment only. It is not a submission to OntarioMD until the owner completes tasks 2.2–2.6 in the implementation plan.*
