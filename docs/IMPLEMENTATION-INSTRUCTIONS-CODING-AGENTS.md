# Implementation Instructions for Coding Agents / Software Engineers

**Last updated:** June 2026  
**Purpose:** Ontario EMR pre-configuration brief for AI agents and engineers.  
**Canonical task backlog:** [ONTARIO-EMR-IMPLEMENTATION-PLAN.md](ONTARIO-EMR-IMPLEMENTATION-PLAN.md)  
**Agent rules:** [AGENT-HANDOVER.md](../AGENT-HANDOVER.md) (read first every session)

**Source document (Word):** `docs/strategic-partner/originals/Implementation Instructions for Coding Agents.docx`

**Legend:** ✅ Done | 🔶 Partial | ⬜ Not started | 🚫 Blocked (partner/credentials)

**Priority order (owner-approved):** OntarioMD certification path → MCEDT (claims) → OLIS (labs) → PrescribeIT → Imaging → HRM/DHDR/ConnectingOntario.

**STOP GATE:** Do not start OntarioMD Stage 5 submission until the owner approves.

---

## 1. Core Standards and Architecture Setup

| Requirement | Status | Where |
|-------------|--------|-------|
| HL7 v2 messaging engine (OLIS, claims, reports) | ✅ | `lib/interop/hl7/` |
| HL7 FHIR R4+ client/server | ✅ | `lib/interop/fhir/`, interop gateway |
| DICOM support (viewing, storage, transmission) | 🔶 | DICOMweb client + C-FIND/C-MOVE stubs via gateway |
| PHIPA compliance: encryption, audit logs, consent, access controls | ✅ | `docs/compliance/`, `/consent-management`, `/patient-consents` |
| ONE ID federation login | 🚫 | Ontario enrollment |

---

## 2. Laboratory Integration (OLIS)

| Requirement | Status | Where |
|-------------|--------|-------|
| HL7 v2 interface for results ingestion and patient queries | ✅ | Lab desk adapters |
| FHIR Patient Query endpoint support | 🔶 | Gateway FHIR search |
| Auto-ingest of results into patient charts | ✅ | Lab results queue workflow |
| Test with OntarioMD sandbox or staging | 🚫 | Live credentials required |

**Pages:** `/lab-results-queue`, `/external-lab-orders`, `/patient-identifiers`

---

## 3. Imaging Integration

| Requirement | Status | Where |
|-------------|--------|-------|
| DICOMweb or standard DICOM viewer integration | ✅ | `chart-image-viewer.js`, DICOMweb client |
| ConnectingOntario / DI repository query hooks | 🔶 | Contextual launch stubs |
| Contextual launch from patient record | 🔶 | Chart provincial actions |

**Pages:** `/imaging-results-queue`, `/external-imaging-orders`

---

## 4. Pharmacy / ePrescribing (PrescribeIT)

| Requirement | Status | Where |
|-------------|--------|-------|
| PrescribeIT API: create, transmit, renew, cancel, status | 🔶 | eRx queue; live API blocked |
| CCDD drug data set | 🔶 | Terminology mapping doc; licensed dataset separate |
| Pharmacy selection and secure messaging | 🔶 | Prescription form + eRx queue |

**Pages:** `/erx-queue`, prescription workflow on patient chart

---

## 5. Claims Submission (MCEDT)

| Requirement | Status | Where |
|-------------|--------|-------|
| MCEDT Web Service client (upload/download) | 🔶 | `mcedt-client.js`; live blocked |
| Required claim file formats | ✅ | Batch XML export + `validateBatchXmlStructure` |
| Batch processing, error handling, remittance reconciliation | ✅ | Claims workflow, `/claims-queue`, `/remittance-reconcile` |
| Cut-off date logic and eligibility checking | 🔶 | `mcedt-cutoff.js`; live eligibility API blocked |

**Pages:** `/claims-queue`, `/remittance-reconcile`, `/mcedt-settings`

---

## 6. Provincial Hubs and Certification Prep

| Requirement | Status | Where |
|-------------|--------|-------|
| HRM (hospital reports) | ✅ | `/hrm-inbox` with File to chart |
| DHDR (drug repository) | 🔶 | Query hooks + consents; live blocked |
| ConnectingOntario viewer launch | 🔶 | Launch stubs on chart |
| Align with Ontario EMR Specifications | ✅ | `docs/ONTARIO-EMR-SPEC-TRACEABILITY.md` |
| OntarioMD validation prep (multi-stage) | 🔶 | Self-assessment + evidence binder; Stage 5 blocked |

**Pages:** `/hrm-inbox`, `/provincial-hub-settings`, `/ontario-self-assessment`, `/evidence-binder`

---

## 7. General Best Practices

| Practice | Status | Notes |
|----------|--------|-------|
| Modular adapters/interfaces | ✅ | `lib/interop/`, org hub config merge |
| Logging and monitoring | ✅ | Gateway audit, `interop_messages`, webhook alerts |
| Unit/integration tests | ✅ | 75+ interop tests; run `npm test` |
| Third-party security audit before go-live | 🚫 | Owner engagement |
| Internal API/integration docs | ✅ | Runbook, phase completion docs, this file |
| Cloud-ready scalability | ✅ | Netlify + Supabase architecture |

---

## Agent workflow

1. Read **`AGENT-HANDOVER.md`** before any work.
2. Pick tasks from **`ONTARIO-EMR-IMPLEMENTATION-PLAN.md`** (respect STOP GATE).
3. After code changes: update companion docs, session log, run **`npm run check`**.
4. Do not claim live provincial certification; document software evidence only.
5. Contact OntarioMD support early for owner-led vendor path (emr@ontariomd.com).

---

## Resources for the team

| Resource | Location |
|----------|----------|
| Ontario EMR specs and validation | ontariomd.ca/emr-certification |
| MCEDT Reference Manual | ontario.ca |
| HL7 / FHIR | hl7.org + Canada Health Infoway guides |
| PrescribeIT specs | prescribeit.ca (vendor partner section) |
| Certification roadmap | [ROADMAP-CANADA-CERTIFICATION.md](ROADMAP-CANADA-CERTIFICATION.md) |
| Provincial integration runbook | [PROVINCIAL-INTEGRATION-RUNBOOK.md](PROVINCIAL-INTEGRATION-RUNBOOK.md) |

Assign tasks with milestones. Test against provincial sandboxes when credentials are available.
