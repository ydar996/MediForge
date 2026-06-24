# Ontario EMR Implementation Plan

**Created:** June 2026  
**Source:** Owner Ontario EMR pre-configuration brief + internal readiness assessment (`ONTARIO-EMR-READINESS-REPORT.md`)  
**Related:** `ONTARIOMD-READINESS-PLAN.md` (agent sprint with STOP GATE), `MEDIFORGE-INTEROPERABILITY-DOCS.md`

**Priority order (owner-approved sequence):** OntarioMD certification path → MCEDT (claims) → OLIS (labs) → PrescribeIT → Imaging → HRM/DHDR/ConnectingOntario.

**Legend:** ✅ Done | 🔶 Partial | ⬜ Not started | 🚫 Blocked (partner/credentials)

---

## Phase 0: Internal Readiness (No Provincial Credentials)

*Phases 0–8 software complete (June 2026). All agent-buildable tasks for Phases 0–8 are done; remaining 🔶 items need live provincial credentials or licensed datasets. **STOP GATE:** do not start OntarioMD Stage 5 submission until owner approves.*

| ID | Task | Status | Owner / Agent |
|----|------|--------|---------------|
| 0.1 | Gap report: every OntarioMD category → Done / Partial / Missing / Blocked | ✅ | `docs/ONTARIOMD-GAP-REPORT.md` |
| 0.2 | Compliance pack: PHIPA overview, breach procedure, custody, DR, data residency | ✅ | `docs/compliance/` |
| 0.3 | Audit hardening: append-only DB rules, broader patient-access logging | ✅ | Migration + `patient-access-audit.js` |
| 0.4 | FHIR R4 Patient chart export (Bundle download/API) | ✅ | `fhir-patient-export.js` + lib module |
| 0.5 | CPP-aligned patient summary view/tab | ✅ | `/cpp-patient-summary` |
| 0.6 | Data residency statement (Supabase/Netlify Canada posture) | ✅ | `docs/compliance/DATA-RESIDENCY-CANADA.md` |
| 0.7 | Consent capture: DB + UI (portal, data sharing, research) | ✅ | `/patient-consents` + migration |
| 0.8 | i4C-style indicator mapping from preventive gaps | ✅ | `js/i4c-indicator-map.js` |
| 0.9 | OHIP claim file draft generator (export from billing drafts) | ✅ | `ohip-claim-export.js` + invoice button |
| 0.10 | Shareable readiness report page (Strategic Partner) | ✅ | `/ontario-readiness` live |
| 0.11 | Written readiness report in repo | ✅ | `ONTARIO-EMR-READINESS-REPORT.md` |

---

## Phase 1: Core Standards & Architecture

**Status: complete (June 2026).** See **`docs/PHASE-1-CORE-STANDARDS-COMPLETION.md`**. Blocked items require partner enrollment or third-party audit.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 1.1 | HL7 v2 ORM/ORU generators and parsers | ✅ | `lib/interop/hl7/`, tests |
| 1.2 | HL7 v2 ACK handling | ✅ | `lib/interop/hl7/ack.js` |
| 1.3 | MLLP client with TLS | 🔶 | Library complete; live endpoints per clinic |
| 1.4 | FHIR R4 resource builders (Patient, ServiceRequest, DiagnosticReport, MedicationRequest, ImagingStudy) | ✅ | `lib/interop/fhir/resources.js` |
| 1.5 | FHIR R4 REST client with OAuth2 | ✅ | `lib/interop/fhir/client.js` |
| 1.6 | Production FHIR server or certified gateway exposure | 🔶 | `interop-gateway`: `exportPatientBundle`, `fhirSearchPatients` |
| 1.7 | DICOMweb client (QIDO/WADO/STOW) | ✅ | `lib/interop/dicom/dicomweb-client.js` |
| 1.8 | DICOM C-FIND/C-MOVE via gateway appliance | ✅ | Stub responses when `dimseGatewayUrl` not set; live via gateway |
| 1.9 | Embedded clinical image viewer in chart | ✅ | `chart-image-viewer.js`, documents + orders DICOMweb |
| 1.10 | AES-256 field-level encryption (optional) | 🔶 | Setup/recovery UI exists |
| 1.11 | Comprehensive audit logs for all integrations | ✅ | Gateway audit + `interop_messages` |
| 1.12 | Structured consent management module | ✅ | `/consent-management`, `/patient-consents` |
| 1.13 | Role-based access controls | ✅ | Multi-role dashboards |
| 1.14 | ONE ID federation login | 🚫 | Ontario enrollment |
| 1.15 | Formal PHIPA policy pack | ✅ | `docs/compliance/` + index (legal review pending) |
| 1.16 | Third-party security audit | 🚫 | Owner/vendor engagement |
| 1.17 | Immutable append-only audit at DB level | ✅ | `audit_logs` + `interop_messages` migrations |

---

## Phase 2: OntarioMD Certification Path

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 2.1 | Map product to Ontario EMR Specifications (foundation, functional, EHR connectivity) | ✅ | Expanded `docs/ONTARIO-EMR-SPEC-TRACEABILITY.md` |
| 2.2 | Contact OntarioMD (emr@ontariomd.com) for vendor path | ⬜ | Owner |
| 2.3 | Select reference clinic site | ⬜ | Owner |
| 2.4 | Stage 1–4 internal conformance self-assessment | ✅ | `/ontario-self-assessment` (Phases 0–8 rows) |
| 2.5 | Stage 5 OntarioMD validation testing | ⬜ | 🚫 OntarioMD process |
| 2.6 | Certification application submission | ⬜ | 🚫 OntarioMD process |
| 2.7 | Maintain certification evidence binder (docs + screenshots) | ✅ | `/evidence-binder`, readiness + capabilities |

**Status: complete (June 2026, software).** Stage 5 and submission blocked until OntarioMD vendor path opens.

---

## Phase 3: MCEDT Claims (OHIP)

**Status: complete (June 2026, software).** Live MOH upload/download blocked until clinic credentials. See **`docs/PHASE-3-MCEDT-CLAIMS-COMPLETION.md`**.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 3.1 | OHIP claim draft from clinical billing | ✅ | `claims-adapter.js`, payer workflow |
| 3.2 | Ontario L-codes on lab service lines | ✅ | June 2026 fix |
| 3.3 | OHIP imaging fee codes on imaging lines | ✅ | June 2026 fix |
| 3.4 | MOH claim file format (XSD/schema compliant) | ✅ | `validateBatchXmlStructure` + XML export; MOH XSD sign-off still partner |
| 3.5 | MCEDT Web Service client (upload/download) | 🔶 | `mcedt-client.js`; live blocked |
| 3.6 | Clinic MOH credentials and certificates | 🔶 | `/mcedt-settings`; certs in env |
| 3.7 | Batch claim submission scheduler | 🔶 | `claims-batch-daily` function |
| 3.8 | Error handling and rejection workflow | ✅ | `claims-workflow.js`, `/claims-queue` guided resubmit |
| 3.9 | Remittance download and parsing | 🔶 | Parse + UI; live download blocked |
| 3.10 | Payment reconciliation UI | ✅ | `/remittance-reconcile` |
| 3.11 | Cut-off date logic | ✅ | `mcedt-cutoff.js` |
| 3.12 | OHIP eligibility checking API | 🔶 | PHN format check; live API blocked |

---

## Phase 4: OLIS Laboratory Integration

**Status: partial (June 2026, software).** Live Infoway/OLIS blocked until onboarding. See **`docs/PHASE-4-OLIS-LAB-DESK-COMPLETION.md`**.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 4.1 | HL7 v2 lab order outbound (ORM^O01 / OML^O21) | 🔶 | Export HL7 on external lab orders |
| 4.2 | HL7 v2 lab result inbound (ORU^R01) | 🔶 | Parser + `/lab-results-queue` |
| 4.3 | FHIR ServiceRequest for lab orders | 🔶 | Adapter ready |
| 4.4 | FHIR DiagnosticReport + Observation ingest | 🔶 | Adapter ready |
| 4.5 | FHIR Patient Query (OLIS) | 🔶 | Gateway + consent gate |
| 4.6 | Auto-ingest results into patient charts | 🔶 | `ingestOruAndApply` workflow |
| 4.7 | Patient PHN storage and matching | 🔶 | `/patient-identifiers` |
| 4.8 | LOINC / pCLOCD code sets licensed and loaded | ⬜ | Mapping layer only |
| 4.9 | OLIS consent capture before query | 🔶 | `olis_query` + server gate |
| 4.10 | Inbound result review/reconcile queue UI | ✅ | `/lab-results-queue` |
| 4.11 | Critical value alert handling | ✅ | Dashboard + patient chart banner |
| 4.12 | Infoway/Ontario Health onboarding | ⬜ | 🚫 Partner |
| 4.13 | OntarioMD/OLIS sandbox conformance testing | ⬜ | 🚫 Partner |

---

## Phase 5: PrescribeIT / ePrescribing

**Status: partial (June 2026, software).** Live Infoway/PrescribeIT blocked until onboarding. See **`docs/PHASE-5-PRESCRIBEIT-COMPLETION.md`**.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 5.1 | In-clinic prescribing (Health Canada DPD) | ✅ | ~14,800 products |
| 5.2 | Drug interaction alerts | ✅ | |
| 5.3 | FHIR MedicationRequest builder | ✅ | `rx-adapter.js`, `generateRxFhir` |
| 5.4 | PrescribeIT / Infoway transmission profile | 🔶 | Infoway profile + pharmacy routing |
| 5.5 | Prescription transmit (create, send) | 🔶 | `/erx-queue`, gateway; queues when disabled |
| 5.6 | Renewal requests | 🔶 | `requestPrescriptionRenewal` |
| 5.7 | Cancellation | 🔶 | `cancelPrescription` |
| 5.8 | Dispense status from pharmacy | 🔶 | `ingestMedicationDispense` + queue UI |
| 5.9 | Full CCDD dataset licensed and merged | ⬜ | Optional overlay only |
| 5.10 | Pharmacy selection UI | ✅ | Rx form picker + sample directory + erx-queue |
| 5.11 | Secure messaging with pharmacy | ⬜ | Live PrescribeIT blocked |
| 5.12 | PrescribeIT MFA requirements | ⬜ | App session only |
| 5.13 | Infoway vendor partner enrollment | ⬜ | 🚫 Partner |

---

## Phase 6: Imaging & ConnectingOntario

**Status: partial (June 2026, software).** Live DIR/PACS blocked until onboarding. See **`docs/PHASE-6-IMAGING-DESK-COMPLETION.md`**.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 6.1 | Imaging order catalog (67 studies) with OHIP codes | ✅ | June 2026 |
| 6.2 | HL7/FHIR imaging order outbound | 🔶 | `/external-imaging-orders`, gateway exports |
| 6.3 | Structured imaging report ingest | 🔶 | `/imaging-results-queue`, `ingestImagingReport` |
| 6.4 | DICOMweb image storage links in chart | 🔶 | `attachDicomStudy`, chart viewer WADO |
| 6.5 | ConnectingOntario / DI repository query hooks | 🔶 | Launch URL stub + interop dashboard |
| 6.6 | Contextual viewer launch from patient record | 🔶 | SMART-on-FHIR launch stub |
| 6.7 | DIR/PACS production onboarding | ⬜ | 🚫 Partner |

---

## Phase 7: Provincial Hubs (HRM, DHDR, ConnectingOntario)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 7.1 | HRM hospital report inbox module | ✅ | `/hrm-inbox`, `hrm_inbound_reports` |
| 7.2 | HRM report auto-file to patient chart | ✅ | `fileHrmReportToChart` gateway + chart unstructured record |
| 7.3 | DHDR drug repository query | 🔶 | Chart button, gateway `queryDhdr` |
| 7.4 | ConnectingOntario viewer integration | 🔶 | Phase 6 stubs + provincial hub settings |
| 7.5 | Hub credentials and agreements per clinic | ⬜ | 🚫 Partner |

---

## Phase 8: Engineering Best Practices

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 8.1 | Modular adapter architecture | ✅ | `lib/interop/`, `IntegrationService` |
| 8.2 | Configurable per-org/per-province interfaces | ✅ | `/provincial-hub-settings` → gateway merges `organizations.settings.provincialHubs` |
| 8.3 | Integration audit trail | 🔶 | `interop_messages` + gateway audit |
| 8.4 | Unit tests for interop/billing | 🔶 | `npm run test:interop` (phase7/8 tests) |
| 8.5 | Provincial sandbox integration tests | ⬜ | 🚫 Partner sandboxes |
| 8.6 | Internal API/integration runbooks | 🔶 | `PROVINCIAL-INTEGRATION-RUNBOOK.md` |
| 8.7 | User guides for provincial features | ✅ | User manual HRM/DHDR/provincial hub sections |
| 8.8 | Load testing (labs, claims volume) | ✅ | `scripts/load-test-interop.mjs`, `scripts/load-test-claims.mjs` |
| 8.9 | Monitoring/alerting for integration failures | ✅ | Dashboard failure summary + optional webhook alert |

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
| Strategic Partner readiness page | https://mediforge.netlify.app/ontario-readiness |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-06 | Phase 7 HRM/DHDR desk + Phase 8 engineering polish; Phases 0–8 software complete where possible |
| 2026-06 | Phase 6 imaging desk software; Phases 0–6 complete where possible |
| 2026-06 | Phase 5 PrescribeIT eRx desk software; Phases 0–5 complete where possible |
| 2026-06-23 | Initial plan from owner brief + readiness report; merged with ONTARIOMD-READINESS-PLAN Tier A/B tasks |
