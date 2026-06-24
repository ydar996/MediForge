# Ontario EMR Implementation Plan

**Created:** June 2026  
**Source:** Owner Ontario EMR pre-configuration brief + internal readiness assessment (`ONTARIO-EMR-READINESS-REPORT.md`)  
**Related:** `ONTARIOMD-READINESS-PLAN.md` (agent sprint with STOP GATE), `MEDIFORGE-INTEROPERABILITY-DOCS.md`

**Priority order (owner-approved sequence):** OntarioMD certification path → MCEDT (claims) → OLIS (labs) → PrescribeIT → Imaging → HRM/DHDR/ConnectingOntario.

**Legend:** ✅ Done | 🔶 Partial | ⬜ Not started | 🚫 Blocked (partner/credentials)

---

## Phase 0: Internal Readiness (No Provincial Credentials)

*From `ONTARIOMD-READINESS-PLAN.md` Tier A/B. **STOP GATE:** owner must say "Implement the Ontario-ready plan" before agents execute.*

| ID | Task | Status | Owner / Agent |
|----|------|--------|---------------|
| 0.1 | Gap report: every OntarioMD category → Done / Partial / Missing / Blocked | ⬜ | Agent |
| 0.2 | Compliance pack: PHIPA overview, breach procedure, custody, DR, data residency | ⬜ | Agent + legal review later |
| 0.3 | Audit hardening: append-only DB rules, broader patient-access logging | 🔶 | Agent |
| 0.4 | FHIR R4 Patient chart export (Bundle download/API) | 🔶 | Agent |
| 0.5 | CPP-aligned patient summary view/tab | ⬜ | Agent |
| 0.6 | Data residency statement (Supabase/Netlify Canada posture) | ⬜ | Agent |
| 0.7 | Consent capture: DB + UI (portal, data sharing, research) | ⬜ | Agent + owner picks types |
| 0.8 | i4C-style indicator mapping from preventive gaps | ⬜ | Agent |
| 0.9 | OHIP claim file draft generator (export from billing drafts) | 🔶 | Agent |
| 0.10 | Investor/shareable readiness report page | ✅ | `/ontario-readiness` live |
| 0.11 | Written readiness report in repo | ✅ | `ONTARIO-EMR-READINESS-REPORT.md` |

---

## Phase 1: Core Standards & Architecture

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 1.1 | HL7 v2 ORM/ORU generators and parsers | 🔶 | `lib/interop/hl7/` |
| 1.2 | HL7 v2 ACK handling | 🔶 | Done in library |
| 1.3 | MLLP client with TLS | 🔶 | Needs production endpoints |
| 1.4 | FHIR R4 resource builders (Patient, ServiceRequest, DiagnosticReport, MedicationRequest, ImagingStudy) | 🔶 | `lib/interop/fhir/` |
| 1.5 | FHIR R4 REST client with OAuth2 | 🔶 | Gateway env vars |
| 1.6 | Production FHIR server or certified gateway exposure | ⬜ | |
| 1.7 | DICOMweb client (QIDO/WADO/STOW) | 🔶 | `lib/interop/dicom/` |
| 1.8 | DICOM C-FIND/C-MOVE via gateway appliance | ⬜ | Stub only |
| 1.9 | Embedded clinical image viewer in chart | ⬜ | |
| 1.10 | AES-256 field-level encryption (optional) | 🔶 | Setup/recovery UI exists |
| 1.11 | Comprehensive audit logs for all integrations | 🔶 | `audit_logs`, `interop_messages` |
| 1.12 | Structured consent management module | ⬜ | Phase 0.7 |
| 1.13 | Role-based access controls | ✅ | Multi-role dashboards |
| 1.14 | ONE ID federation login | ⬜ | 🚫 Ontario enrollment |
| 1.15 | Formal PHIPA policy pack | ⬜ | Phase 0.2 |
| 1.16 | Third-party security audit | ⬜ | |
| 1.17 | Immutable append-only audit at DB level | ⬜ | Phase 0.3 |

---

## Phase 2: OntarioMD Certification Path

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 2.1 | Map product to Ontario EMR Specifications (foundation, functional, EHR connectivity) | 🔶 | ~40% alignment |
| 2.2 | Contact OntarioMD (emr@ontariomd.com) for vendor path | ⬜ | Owner |
| 2.3 | Select reference clinic site | ⬜ | Owner |
| 2.4 | Stage 1–4 internal conformance self-assessment | ⬜ | |
| 2.5 | Stage 5 OntarioMD validation testing | ⬜ | 🚫 OntarioMD process |
| 2.6 | Certification application submission | ⬜ | 🚫 OntarioMD process |
| 2.7 | Maintain certification evidence binder (docs + screenshots) | 🔶 | Capabilities + readiness pages |

---

## Phase 3: MCEDT Claims (OHIP)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 3.1 | OHIP claim draft from clinical billing | 🔶 | `claims-adapter.js` |
| 3.2 | Ontario L-codes on lab service lines | ✅ | June 2026 fix |
| 3.3 | OHIP imaging fee codes on imaging lines | ✅ | June 2026 fix |
| 3.4 | MOH claim file format (XSD/schema compliant) | ⬜ | Sample JSON only |
| 3.5 | MCEDT Web Service client (upload/download) | ⬜ | Stub queues when disabled |
| 3.6 | Clinic MOH credentials and certificates | ⬜ | 🚫 Per clinic |
| 3.7 | Batch claim submission scheduler | ⬜ | |
| 3.8 | Error handling and rejection workflow | ⬜ | |
| 3.9 | Remittance download and parsing | ⬜ | |
| 3.10 | Payment reconciliation UI | ⬜ | |
| 3.11 | Cut-off date logic | ⬜ | |
| 3.12 | OHIP eligibility checking API | ⬜ | |

---

## Phase 4: OLIS Laboratory Integration

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 4.1 | HL7 v2 lab order outbound (ORM^O01 / OML^O21) | 🔶 | Generator ready |
| 4.2 | HL7 v2 lab result inbound (ORU^R01) | 🔶 | Parser + ingest adapter |
| 4.3 | FHIR ServiceRequest for lab orders | 🔶 | Adapter ready |
| 4.4 | FHIR DiagnosticReport + Observation ingest | 🔶 | Adapter ready |
| 4.5 | FHIR Patient Query (OLIS) | ⬜ | PHN matching stub |
| 4.6 | Auto-ingest results into patient charts | 🔶 | Not wired to live LIS |
| 4.7 | Patient PHN storage and matching | 🔶 | `patient_identifiers` table |
| 4.8 | LOINC / pCLOCD code sets licensed and loaded | ⬜ | Mapping layer only |
| 4.9 | OLIS consent capture before query | ⬜ | Config flag hook |
| 4.10 | Inbound result review/reconcile queue UI | ⬜ | |
| 4.11 | Critical value alert handling | 🔶 | Hook exists |
| 4.12 | Infoway/Ontario Health onboarding | ⬜ | 🚫 Partner |
| 4.13 | OntarioMD/OLIS sandbox conformance testing | ⬜ | 🚫 Partner |

---

## Phase 5: PrescribeIT / ePrescribing

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 5.1 | In-clinic prescribing (Health Canada DPD) | ✅ | ~14,800 products |
| 5.2 | Drug interaction alerts | ✅ | |
| 5.3 | FHIR MedicationRequest builder | 🔶 | |
| 5.4 | PrescribeIT / Infoway transmission profile | 🔶 | Adapter stub |
| 5.5 | Prescription transmit (create, send) | ⬜ | Queues when disabled |
| 5.6 | Renewal requests | ⬜ | |
| 5.7 | Cancellation | ⬜ | |
| 5.8 | Dispense status from pharmacy | ⬜ | MedicationDispense stub |
| 5.9 | Full CCDD dataset licensed and merged | ⬜ | Optional overlay only |
| 5.10 | Pharmacy selection UI | ⬜ | In-house only today |
| 5.11 | Secure messaging with pharmacy | ⬜ | |
| 5.12 | PrescribeIT MFA requirements | ⬜ | |
| 5.13 | Infoway vendor partner enrollment | ⬜ | 🚫 Partner |

---

## Phase 6: Imaging & ConnectingOntario

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 6.1 | Imaging order catalog (67 studies) with OHIP codes | ✅ | June 2026 |
| 6.2 | HL7/FHIR imaging order outbound | 🔶 | Adapters ready |
| 6.3 | Structured imaging report ingest | 🔶 | DiagnosticReport path |
| 6.4 | DICOMweb image storage links in chart | 🔶 | STOW/WADO client |
| 6.5 | ConnectingOntario / DI repository query hooks | ⬜ | Config placeholders |
| 6.6 | Contextual viewer launch from patient record | ⬜ | SMART-on-FHIR |
| 6.7 | DIR/PACS production onboarding | ⬜ | 🚫 Partner |

---

## Phase 7: Provincial Hubs (HRM, DHDR, ConnectingOntario)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 7.1 | HRM hospital report inbox module | ⬜ | |
| 7.2 | HRM report auto-file to patient chart | ⬜ | |
| 7.3 | DHDR drug repository query | ⬜ | |
| 7.4 | ConnectingOntario viewer integration | ⬜ | |
| 7.5 | Hub credentials and agreements per clinic | ⬜ | 🚫 Partner |

---

## Phase 8: Engineering Best Practices

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 8.1 | Modular adapter architecture | ✅ | `lib/interop/`, `IntegrationService` |
| 8.2 | Configurable per-org/per-province interfaces | 🔶 | `config/provinces/on.json` |
| 8.3 | Integration audit trail | 🔶 | `interop_messages` |
| 8.4 | Unit tests for interop/billing | 🔶 | `npm run test:interop` |
| 8.5 | Provincial sandbox integration tests | ⬜ | |
| 8.6 | Internal API/integration runbooks | 🔶 | Interop docs exist |
| 8.7 | User guides for provincial features | ⬜ | When live |
| 8.8 | Load testing (labs, claims volume) | ⬜ | |
| 8.9 | Monitoring/alerting for integration failures | ⬜ | |

---

## Milestones

| Milestone | Target | Exit criteria |
|-----------|--------|---------------|
| M0 | Internal evidence pack | Phase 0 complete; gap report published |
| M1 | MCEDT pilot | One clinic submits test claims; remittance parsed |
| M2 | OLIS pilot | Live ORU ingest + ORM outbound in sandbox |
| M3 | PrescribeIT pilot | Test Rx transmitted and dispense status returned |
| M4 | Imaging pilot | DI report + image link in chart from DIR |
| M5 | OntarioMD validation | Stage 5 passed at reference site |
| M6 | Production provincial go-live | HRM + OLIS + MCEDT + PrescribeIT for enrolled clinics |

---

## Resources

| Resource | URL / location |
|----------|----------------|
| Ontario EMR Specs & Validation | ontariomd.ca/emr-certification |
| MCEDT Reference Manual | ontario.ca (search MCEDT) |
| HL7 / FHIR Canada guides | hl7.org + Canada Health Infoway |
| PrescribeIT vendor specs | prescribeit.ca |
| MediForge interop docs | `MEDIFORGE-INTEROPERABILITY-DOCS.md` |
| Investor readiness page | https://mediforge.netlify.app/ontario-readiness |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-06-23 | Initial plan from owner brief + readiness report; merged with ONTARIOMD-READINESS-PLAN Tier A/B tasks |
