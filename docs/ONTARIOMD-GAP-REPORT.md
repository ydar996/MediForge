# OntarioMD Gap Report: MediForge

**Version:** June 23, 2026  
**Purpose:** Itemized gap analysis against Ontario EMR Specifications, provincial connectivity requirements, and OntarioMD certification expectations.  
**Audience:** Product owner, engineering, compliance, investors, and OntarioMD readiness reviewers.  
**Related:** `ONTARIO-EMR-READINESS-REPORT.md`, `ONTARIOMD-READINESS-PLAN.md`, `ONTARIO-EMR-IMPLEMENTATION-PLAN.md`

**Status legend:** **Done** | **Partial** | **Missing** | **Blocked** (partner credentials, OntarioMD process, or legal enrollment required)

---

## Executive Summary

MediForge is a Canada-first, web-based clinic platform with a strong functional EMR core and an integration layer prepared for Ontario provincial systems. Overall Ontario readiness is estimated at **60 to 70%** after Phases 0–4 software work (June 2026). Clinical workflows are **75 to 85%** complete. Live provincial connectivity remains **5 to 15%** because OLIS, MCEDT, PrescribeIT, HRM, DHDR, and ConnectingOntario require vendor agreements and clinic credentials that no code sprint alone can unlock.

**Phases 0–4 (June 2026): software complete where possible.** Delivered: internal evidence, core standards, MCEDT claims desk, OLIS-ready lab desk, spec traceability, self-assessment, and evidence binder. These raise documented evidence to **60 to 70%** internal readiness but do not constitute OntarioMD certification.

| Pillar | ~% Ready | Status Mix |
|--------|----------|------------|
| **Overall Ontario readiness** | 60 to 70% | Phases 0–4 software; live connectivity credential-gated |
| **Foundational standards and security** | 60 to 70% | Compliance pack, gateway audit, append-only interop messages |
| **EHR connectivity (provincial)** | 5 to 15% | Adapters, staff UI, queue mode; no live provincial pipes |
| **Functional clinical EMR** | 75 to 85% | CPP summary, i4C mapping, consent capture live |
| **OntarioMD certification** | 25 to 35% | Evidence binder, self-assessment; Stage 5 not started |
| **Engineering practices** | 55 to 70% | Modular adapters, interop tests; sandbox testing weak |

---

## Summary Table (All Categories)

| Category | Item | Status | ~% | Priority |
|----------|------|--------|-----|----------|
| **Foundational** | HL7 v2 messaging | Partial | 60% | High |
| | FHIR R4 | Partial | 55% | High |
| | DICOM | Partial | 40% | Medium |
| | PHIPA / security | Partial | 60% | High |
| | ONE ID federation | Missing | 0% | Blocked |
| | Audit logging | Partial | 65% | High |
| | Encryption | Partial | 55% | Medium |
| | Consent management | Partial | 40% | High |
| **EHR Connectivity** | OLIS (labs) | Partial | 20% | High |
| | MCEDT (OHIP claims) | Partial | 25% | High |
| | PrescribeIT (eRx) | Partial | 10% | High |
| | HRM (hospital reports) | Missing | 0% | Blocked |
| | DHDR (drug repository) | Missing | 0% | Blocked |
| | ConnectingOntario | Missing | 0% | Blocked |
| | Imaging DI / DIR | Partial | 15% | Medium |
| **Functional Clinical** | Patients / demographics | Done | 90% | : |
| | Charting (SOAP, problems) | Done | 85% | : |
| | Orders (lab / imaging) | Done | 85% | : |
| | Labs (in-clinic + requisitions) | Partial | 75% | Medium |
| | Imaging (orders + attach) | Partial | 70% | Medium |
| | Prescribing (Rx) | Partial | 75% | Medium |
| | Billing / claims drafts | Partial | 70% | High |
| | Patient portal | Done | 80% | : |
| | Preventive care / gaps | Partial | 70% | Medium |
| | Inpatient module | Done | 80% | Low |
| | Pharmacy module | Partial | 75% | Low |
| **Certification** | OntarioMD vendor process | Missing | 0% | Blocked |
| | Evidence binder | Partial | 50% | High |
| **Engineering** | Modular adapters | Done | 80% | : |
| | Automated testing | Partial | 50% | Medium |
| | Monitoring / alerting | Partial | 30% | Medium |
| | Documentation / runbooks | Partial | 55% | Medium |

---

## Phase 0: June 2026 Internal Readiness Sprint (complete)

These deliverables close documentation and evidence gaps without provincial credentials. Status as of June 23, 2026: **all items delivered** (Done or Partial with repo evidence).

| ID | Deliverable | Status | Notes |
|----|-------------|--------|-------|
| 0.1 | This gap report (`ONTARIOMD-GAP-REPORT.md`) | **Done** | Published June 2026 |
| 0.2 | Compliance pack (`docs/compliance/`) | **Done** | PHIPA, breach, custody, DR, residency; legal review recommended |
| 0.3 | Audit hardening migration | **Partial** | `20260623200000_audit_logs_append_only.sql`; owner runs per environment |
| 0.4 | FHIR R4 patient chart export | **Partial** | `lib/interop/fhir/patient-chart-bundle.js`, `js/fhir-patient-export.js`, tests |
| 0.5 | CPP-aligned patient summary | **Partial** | `/cpp-patient-summary`, `js/cpp-patient-summary.js` |
| 0.6 | Data residency statement | **Done** | `docs/compliance/DATA-RESIDENCY-CANADA.md` |
| 0.7 | Consent capture (DB + UI) | **Partial** | `patient_consents` migration, `/patient-consents`, `js/patient-consent.js` |
| 0.8 | i4C indicator mapping | **Partial** | `js/i4c-indicator-map.js` from preventive gaps |
| 0.9 | OHIP claim file export | **Partial** | `js/ohip-claim-export.js`; not live MCEDT submit |
| 0.10 | Investor readiness webpage | **Done** | `/ontario-readiness` synced with this report |
| 0.11 | Written readiness report | **Done** | `ONTARIO-EMR-READINESS-REPORT.md` |

**Phase 0–4 exit criteria (software):** met where possible (June 2026). Live provincial pipes and OntarioMD Stage 5 remain **Blocked**. Owner action: OntarioMD vendor contact, reference clinic, MOH/Infoway credentials.

---

## 1. Foundational Standards and Security

### 1.1 HL7 v2

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| ORM^O01 / OML^O21 lab order generation | Partial | `lib/interop/hl7/generator.js` |
| ORU^R01 result parsing | Partial | `lib/interop/hl7/parser.js` |
| ACK handling | Partial | `lib/interop/hl7/ack.js` |
| MLLP transport with TLS | Partial | `lib/interop/hl7/mllp.js`; no production endpoints |
| ADT export (patient demographics) | Partial | Referenced in `data-import-export.html`; not full ADT suite |
| Live HL7 interface to LIS / hospital | Missing | Requires partner endpoint |
| OntarioMD HL7 conformance testing | Blocked | Infoway / Ontario Health enrollment |

**Category status: Partial (~60%)**

### 1.2 FHIR R4

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| Resource builders (Patient, ServiceRequest, DiagnosticReport, MedicationRequest, ImagingStudy) | Partial | `lib/interop/fhir/resources.js` |
| FHIR REST client with OAuth2 | Partial | `lib/interop/fhir/client.js`; gateway env vars |
| Patient chart Bundle export | Partial | Phase 0: `patient-chart-bundle.js`, browser export, unit tests |
| Production FHIR server or certified gateway | Missing | No exposed FHIR API for third parties |
| SMART on FHIR launch | Missing | Required for contextual viewers |
| FHIR validation against Ontario profiles | Missing | No certified validator pipeline |

**Category status: Partial (~50%)**

### 1.3 DICOM

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| DICOMweb client (QIDO-RS, WADO-RS, STOW-RS) | Partial | `lib/interop/dicom/dicomweb-client.js` |
| C-FIND / C-MOVE via gateway | Partial | Stub delegates to external PACS gateway |
| DICOM file attach to chart | Partial | Document attachment; not structured study metadata |
| Embedded diagnostic viewer | Missing | No in-chart DICOM viewer |
| Live PACS / DIR integration | Blocked | Partner onboarding |

**Category status: Partial (~40%)**

### 1.4 PHIPA and Security

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| Role-based access control (RBAC) | Done | Multi-role dashboards; Supabase RLS per organization |
| Multi-tenant clinic isolation | Done | Organization-scoped data |
| HTTPS / TLS in transit | Done | Netlify hosting |
| Managed cloud storage (Supabase) | Done | Not loose files on workstation |
| Legal agreements (terms, privacy) | Done | Registration and `legal-agreement.html` |
| Formal PHIPA policy pack | Partial | Phase 0: `docs/compliance/` |
| Privacy impact assessment | Missing | Not documented |
| Third-party security audit | Missing | Not commissioned |
| Breach notification procedure | Partial | Phase 0 compliance doc |
| Data custody and portability policy | Partial | Phase 0 compliance doc |

**Category status: Partial (~45%)**

### 1.5 ONE ID Federation

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| ONE ID SSO for clinicians | Missing | Supabase username/password only |
| Federation with Ontario identity provider | Blocked | Ontario identity enrollment required |
| MFA aligned with provincial e-health policies | Partial | Session timeout, lockout; not ONE ID |

**Category status: Missing (Blocked for live ONE ID)**

### 1.6 Audit

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| Application audit log table | Done | `audit_logs` schema and RPC |
| Security dashboard | Done | Clinic-level monitoring tools |
| Integration message audit | Partial | `interop_messages` planned / partial |
| Append-only audit at database level | Partial | Phase 0 migration `20260623200000_audit_logs_append_only.sql` |
| Patient chart access logging | Partial | Phase 0: `log_patient_chart_access`, `js/patient-access-audit.js` |
| Immutable audit proof for OntarioMD | Partial | Migration pending production deploy |
| Comprehensive integration audit coverage | Partial | Not all outbound/inbound pipes logged yet |

**Category status: Partial (~65%)**

### 1.7 Encryption

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| TLS for all client traffic | Done | Standard HTTPS |
| Encryption at rest (cloud provider) | Done | Supabase managed encryption |
| Optional AES-256 field-level encryption | Partial | Setup and recovery UI exists |
| Key management documentation | Partial | Operational runbook incomplete |
| Encryption of integration payloads at rest | Partial | Depends on adapter config |

**Category status: Partial (~55%)**

### 1.8 Consent

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| Inpatient admission consents | Partial | JSONB on admissions |
| Patient portal / data sharing consent | Partial | Phase 0: `patient_consents` table and UI |
| OLIS query consent before lab network pull | Partial | Consent type `olis_query` in `js/patient-consent.js`; not wired to live OLIS |
| Research consent | Partial | Consent type defined; minimal UI |
| Consent audit trail | Partial | Tied to audit logs; formal reporting missing |
| OntarioMD consent workflow certification | Blocked | Requires live OLIS / OntarioMD validation |

**Category status: Partial (~40%)**

---

## 2. EHR Connectivity (Provincial Systems)

All live provincial connections are **Blocked** until Infoway, Ontario Health, MOH, or OntarioMD vendor agreements and per-clinic credentials are in place. Adapter code exists; production pipes do not.

### 2.1 OLIS (Ontario Labs Information System)

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| HL7 lab order outbound | Partial | `lib/interop/adapters/lab-adapter.js` |
| HL7 lab result inbound and chart ingest | Partial | Parser + ingest path; not wired to live LIS |
| FHIR ServiceRequest / DiagnosticReport | Partial | Adapters in `lib/interop/` |
| FHIR Patient Query (provincial lab lookup) | Missing | PHN matching stub only |
| LOINC / pCLOCD code sets licensed | Missing | Mapping layer in `terminology/`; not licensed at scale |
| Auto-ingest with reconcile queue UI | Missing | No operator queue for unmatched results |
| Critical value alerts | Partial | Hook exists; not OLIS-certified |
| Infoway / Ontario Health onboarding | Blocked | Partner process |
| OntarioMD OLIS sandbox conformance | Blocked | Requires enrollment |

**Category status: Partial (~20%)**

### 2.2 MCEDT (OHIP Claims)

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| OHIP claim draft from clinical billing | Partial | `lib/billing/`, `claims-adapter.js` |
| Ontario L-codes on lab lines | Done | June 2026 catalog fix |
| OHIP imaging fee codes | Done | June 2026 catalog fix |
| MOH XSD-compliant claim file | Missing | JSON drafts only |
| OHIP claim batch export | Partial | Phase 0: `js/ohip-claim-export.js` |
| MCEDT Web Service client (upload / download) | Missing | Stub queues when credentials absent |
| Clinic MOH certificates | Blocked | Per-clinic MOH onboarding |
| Batch scheduler, rejection workflow | Missing | Not built |
| Remittance download and reconciliation | Missing | Not built |
| OHIP eligibility API | Missing | PHN validation helpers only |

**Category status: Partial (~15%)**

### 2.3 PrescribeIT (ePrescribing)

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| In-clinic prescribing (Health Canada DPD) | Done | ~14,800 products, interaction checks |
| FHIR MedicationRequest builder | Partial | `lib/interop/adapters/rx-adapter.js` |
| PrescribeIT transmission profile | Partial | Adapter stub; queues when disabled |
| Prescription transmit to pharmacy network | Missing | No live send |
| Renewal, cancel, dispense status | Missing | MedicationDispense stub only |
| Full CCDD dataset | Missing | Optional overlay; not licensed |
| Pharmacy selection for external network | Missing | In-clinic pharmacy only |
| PrescribeIT MFA requirements | Missing | App session security only |
| Infoway vendor enrollment | Blocked | Partner process |

**Category status: Partial (~10%)**

### 2.4 HRM (Hospital Report Manager)

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| HRM inbox module | Missing | Not implemented |
| Auto-file hospital reports to chart | Missing | Not implemented |
| HRM message parsing (HL7 / FHIR) | Missing | No adapter |
| Clinic HRM enrollment | Blocked | Ontario Health agreements |

**Category status: Missing (Blocked)**

### 2.5 DHDR (Digital Health Drug Repository)

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| Provincial medication history query | Missing | Not implemented |
| FHIR MedicationStatement ingest from DHDR | Missing | Not implemented |
| Patient consent before query | Partial | Consent type planned; no live query |
| DHDR clinic enrollment | Blocked | Partner process |

**Category status: Missing (Blocked)**

### 2.6 ConnectingOntario

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| Provincial viewer integration | Missing | Config placeholders in `config/provinces/on.json` |
| Contextual launch from patient chart | Missing | No SMART-on-FHIR launch |
| Aggregated provincial record display | Missing | Not implemented |
| ConnectingOntario credentials | Blocked | Partner process |

**Category status: Missing (Blocked)**

### 2.7 Imaging DI (Diagnostic Imaging Repository)

| Requirement | Status | Evidence / Gap |
|-------------|--------|----------------|
| Imaging order catalog with OHIP codes | Done | 67 studies; June 2026 |
| HL7 / FHIR imaging order outbound | Partial | `imaging-adapter.js` |
| Structured imaging report ingest | Partial | DiagnosticReport path |
| DICOMweb image links in chart | Partial | STOW / WADO client |
| DIR / PACS production connection | Blocked | Partner onboarding |
| In-chart image viewer | Missing | Orders and requisitions only |

**Category status: Partial (~15%)**

---

## 3. Functional Clinical EMR

These modules support daily clinic operations and align with Ontario EMR functional specifications. Percentages reflect product completeness, not OntarioMD certification sign-off.

### 3.1 Patients and Demographics

| Capability | Status | Notes |
|------------|--------|-------|
| Search, register, edit patients | Done | Name, DOB, PHN fields |
| Bulk CSV / Excel import | Done | Migration onboarding |
| Patient self-intake with staff approval | Done | Online intake workflow |
| Canadian address and health card fields | Done | Ontario-first demographics |
| Document attachments | Done | PDF, images |
| Patient identifiers for matching | Partial | `patient_identifiers`; OLIS matching not live |
| Full record export | Partial | CSV, PDF; FHIR in Phase 0 |

**Category status: Done (~90%)**

### 3.2 Charting

| Capability | Status | Notes |
|------------|--------|-------|
| SOAP clinical notes | Done | Linked to encounters |
| Problem / diagnosis list (ICD-10-CA, ICD-11) | Done | Active and resolved |
| Allergies, medications, immunizations | Done | Chart sections |
| Vital signs with trends | Done | BP, weight, BMI, etc. |
| Medical history | Done | Past conditions, surgeries |
| CPP-aligned summary view | Partial | Phase 0 deliverable |
| Visit locking and checkout workflow | Done | Portal summary flow |

**Category status: Done (~85%)**

### 3.3 Orders

| Capability | Status | Notes |
|------------|--------|-------|
| Lab order catalog with search | Done | 176+ tests |
| Imaging order catalog with search | Done | 67 studies |
| Ordering notes on requisitions | Done | Saved on printout |
| Referrals with urgency | Done | Status tracking |
| Electronic send to provincial hub | Partial | Print requisition; live send blocked |

**Category status: Done (~85%)**

### 3.4 Labs

| Capability | Status | Notes |
|------------|--------|-------|
| External lab requisitions (print) | Done | L-codes for Ontario |
| In-clinic lab scientist module | Done | Templates, result entry |
| Structured result templates | Done | CBC, chemistry, UA, etc. |
| Auto-ingest from OLIS / HL7 | Partial | Adapter ready; not live |
| Result review and release to portal | Done | Doctor review workflow |

**Category status: Partial (~75%)**

### 3.5 Imaging

| Capability | Status | Notes |
|------------|--------|-------|
| Imaging requisitions with OHIP codes | Done | Print workflow |
| Report text in chart | Partial | Manual entry; DI ingest partial |
| DICOM images in chart | Partial | Attachments; no viewer |
| DI repository query | Missing | Blocked |

**Category status: Partial (~70%)**

### 3.6 Prescribing (Rx)

| Capability | Status | Notes |
|------------|--------|-------|
| Drug search (Health Canada) | Done | Formulary integrated |
| Interaction alerts | Done | Pre-sign checks |
| Print / track prescriptions | Done | In-clinic workflow |
| ePrescribe to pharmacy network | Missing | PrescribeIT blocked |
| Portal medication pickup confirmation | Done | Patient self-report |

**Category status: Partial (~75%)**

### 3.7 Billing

| Capability | Status | Notes |
|------------|--------|-------|
| Fee schedule, invoices, checkout | Done | CAD default |
| Cash register | Done | Daily transactions |
| Provincial fee codes (OHIP L-codes, imaging) | Done | Ontario maps |
| Claim draft generation | Partial | JSON drafts |
| Live OHIP submission (MCEDT) | Missing | Blocked |
| Remittance reconciliation | Missing | Not built |

**Category status: Partial (~70%)**

### 3.8 Patient Portal

| Capability | Status | Notes |
|------------|--------|-------|
| Appointments, medications, results | Done | Role-separated login |
| Visit summaries after checkout | Done | Auto-flow when configured |
| Messages with clinic | Partial | When enabled per org |
| Print lab / imaging orders | Done | Patient-facing copies |
| Consent management in portal | Partial | Phase 0 UI |

**Category status: Done (~80%)**

### 3.9 Preventive Care

| Capability | Status | Notes |
|------------|--------|-------|
| Preventive care gaps | Done | Screenings, vaccines, follow-ups |
| Proof attachments when addressed | Done | Audit-friendly |
| i4C-style indicator mapping | Partial | Phase 0: `js/i4c-indicator-map.js` |
| Ontario primary care quality reporting export | Missing | No official i4C submit |

**Category status: Partial (~70%)**

### 3.10 Inpatient

| Capability | Status | Notes |
|------------|--------|-------|
| Admissions, beds, wards | Done | Optional module |
| Ward dashboards, rounds, vitals | Done | Inpatient workflows |
| Discharge summaries | Done | Linked to chart |
| Hospital ADT integration | Missing | No live HL7 ADT feed |

**Category status: Done (~80%)**

### 3.11 Pharmacy

| Capability | Status | Notes |
|------------|--------|-------|
| Pharmacist dashboard | Done | Optional module |
| Allergy check before dispense | Done | Safety workflow |
| Dispensing and inventory | Done | In-clinic only |
| External pharmacy network (PrescribeIT) | Missing | Blocked |

**Category status: Partial (~75%)**

---

## 4. Certification

### 4.1 OntarioMD Process

| Step | Status | Notes |
|------|--------|-------|
| Map product to Ontario EMR Specifications | Partial | ~40% alignment documented |
| Contact OntarioMD (emr@ontariomd.com) | Missing | Owner action post Phase 0 |
| Select reference clinic site | Missing | Owner decision |
| Stage 1 to 4 internal self-assessment | Missing | Not started |
| Stage 5 OntarioMD validation testing | Blocked | OntarioMD process |
| Certification application submission | Blocked | OntarioMD process |
| Maintain certified status (updates, revalidation) | Missing | Post-certification obligation |

**Category status: Missing (Blocked for Stages 5 and application)**

### 4.2 Evidence Binder

| Artifact | Status | Notes |
|----------|--------|-------|
| Capabilities showcase (`/capabilities`) | Done | Public evidence |
| Investor readiness page (`/ontario-readiness`) | Done | Shareable URL |
| Written readiness report | Done | `ONTARIO-EMR-READINESS-REPORT.md` |
| This gap report | Done | June 2026 |
| Compliance policy pack | Partial | Phase 0 |
| Screenshots / workflow evidence per spec item | Partial | Ad hoc; not full binder |
| Conformance test results | Missing | Requires sandbox |
| Reference site validation report | Missing | Post Stage 5 |

**Category status: Partial (~35%)**

---

## 5. Engineering

### 5.1 Modular Adapters

| Practice | Status | Notes |
|----------|--------|-------|
| `lib/interop/` HL7, FHIR, DICOM, terminology | Done | Core libraries |
| Province-specific config | Partial | `config/provinces/on.json`, example JSON |
| `IntegrationService` outbound queue | Partial | OLIS, Rx, claims stubs |
| Per-org enable flags | Partial | Config-driven; not all UI exposed |

**Category status: Done (~80%)**

### 5.2 Testing

| Practice | Status | Notes |
|----------|--------|-------|
| Unit tests (interop, billing) | Partial | `npm run test:interop`, billing tests |
| FHIR bundle export tests | Partial | Phase 0 |
| Provincial sandbox integration tests | Missing | Blocked until sandboxes |
| Load / volume testing (claims, labs) | Missing | Not performed |
| End-to-end clinical regression | Partial | Manual; limited automation |

**Category status: Partial (~50%)**

### 5.3 Monitoring

| Practice | Status | Notes |
|----------|--------|-------|
| Application audit and security dashboard | Partial | Clinic-level |
| Integration failure alerting | Missing | No pager / alert pipeline |
| `interop_messages` delivery tracking | Partial | Schema partial |
| Uptime and performance SLOs | Missing | Not documented for provincial pipes |
| High-volume scalability proof | Missing | Not tested |

**Category status: Partial (~30%)**

### 5.4 Documentation

| Artifact | Status | Notes |
|----------|--------|-------|
| `MEDIFORGE-INTEROPERABILITY-DOCS.md` | Partial | Technical reference |
| `interoperability-gaps.md` | Done | Pre/post upgrade matrix |
| User manual and at-a-glance guides | Done | Staff-facing |
| Integration runbooks (production) | Partial | Stubs documented; live steps TBD |
| Provincial feature user guides | Missing | When live pipes exist |
| Agent handover and implementation plan | Done | `ONTARIO-EMR-IMPLEMENTATION-PLAN.md` |

**Category status: Partial (~55%)**

---

## 6. Gap Count by Status

| Status | Count | Examples |
|--------|-------|----------|
| **Done** | 14 | RBAC, patient portal, SOAP charting, modular adapters, OHIP fee codes |
| **Partial** | 38 | HL7/FHIR libraries, audit hardening, OLIS adapters, MCEDT drafts, consent, CPP |
| **Missing** | 22 | ONE ID, HRM, DHDR, ConnectingOntario, remittance, eligibility, embedded viewer |
| **Blocked** | 12 | Live OLIS, MCEDT submit, PrescribeIT, OntarioMD Stage 5, partner sandboxes |

---

## 7. Prioritized Remediation Roadmap

### Done (Phases 0–4 software, June 2026)

1. Compliance pack, data residency, FHIR export, CPP summary, consent UI, i4C map, claim export  
2. MCEDT claims desk (queue, remittance, settings, cut-off logic)  
3. OLIS-ready lab desk (HL7/FHIR export, ORU ingest queue, PHN registry, consent gates)  
4. Evidence binder, self-assessment, spec traceability matrix  

### Immediate (owner + ops)

1. Deploy append-only audit and interop migrations to staging/production if not done  
2. Contact OntarioMD for vendor certification path  
3. Select reference clinic for future live pilots  

### Short term (3 to 6 months: owner + engineering)

1. Contact OntarioMD for vendor certification path  
2. MOH XSD claim format and MCEDT client (credential-ready)  
3. OLIS inbound queue UI and ORM/ORU end-to-end in sandbox  
4. PrescribeIT adapter hardening and Infoway enrollment paperwork  
5. Formal PHIPA pack legal review  

### Medium term (6 to 18 months: partners required)

1. Live OLIS pilot at reference clinic  
2. Live MCEDT submit and remittance reconciliation  
3. PrescribeIT pilot (transmit + dispense status)  
4. HRM inbox and auto-file  
5. DHDR medication history query  
6. ConnectingOntario / DI viewer launch  
7. ONE ID federation  
8. OntarioMD Stage 5 validation and certification  

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Partner credential delays | Blocks 5 to 15% connectivity lift | Phase 0 evidence; adapter-first architecture |
| OntarioMD spec changes | Rework on CPP, consent, audit | Track ontariomd.ca releases; gap report updates |
| LOINC / pCLOCD / CCDD licensing cost | Lab and Rx code completeness | Budget line item; mapping layer ready |
| No reference site | Cannot pass Stage 5 | Owner selects pilot clinic early |
| Compliance docs without legal review | Audit finding | Schedule counsel review post Phase 0 |

---

## 9. Related Files

| Path | Role |
|------|------|
| `docs/ONTARIO-EMR-READINESS-REPORT.md` | Investor-facing readiness summary |
| `docs/ONTARIOMD-READINESS-PLAN.md` | Sprint plan and STOP GATE |
| `docs/ONTARIO-EMR-IMPLEMENTATION-PLAN.md` | Full phased backlog |
| `lib/interop/` | HL7, FHIR, DICOM, adapters |
| `lib/integrations/IntegrationService.js` | Outbound integration queue |
| `config/interoperability.ontario.example.json` | Example OLIS / FHIR config |
| `config/provinces/on.json` | Ontario integration placeholders |
| `docs/compliance/` | PHIPA and operational policies (Phase 0) |
| `ontario-readiness.html` | Shareable readiness page |

---

## 10. Document Control

| Field | Value |
|-------|-------|
| Author | MediForge engineering / OntarioMD readiness sprint |
| Last updated | June 23, 2026 |
| Next review | After Phase 2 start or OntarioMD vendor contact |
| Certification claim | **None.** This document is internal gap analysis only. |

---

*MediForge: built for modern primary care and specialty clinics. Powered by Work Chop Inc.*
