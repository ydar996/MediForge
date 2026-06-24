# Ontario EMR Readiness Report

**Version:** June 2026 (Phases 0–8 software complete where possible)  
**Audience:** Strategic Partners, partners, clinic leaders  
**Shareable web version:** https://mediforge.netlify.app/ontario-readiness  
**Implementation tasks:** See **`ONTARIO-EMR-IMPLEMENTATION-PLAN.md`**

This document is the written companion to the Strategic Partner readiness webpage. Share the **URL** with external audiences, not this file path. **Keep this file in sync with `ontario-readiness.html`** (see **`AGENT-HANDOVER.md`** Rule #3).

---

## Executive Summary

MediForge is a Canada-first clinic platform with **strong clinical functionality today** (~75–85%) and a **clear path** toward Ontario provincial connectivity and OntarioMD certification. Overall Ontario readiness is estimated at **72–82%** after Phases 0–8 (June 2026). Live provincial pipes remain at **5–15%** because they require partner credentials every certified vendor must obtain.

**The opportunity:** Clinical workflows are largely complete and deployed. Provincial integrations (OLIS, MCEDT, PrescribeIT, DIR, HRM, DHDR) need credentials and agreements; our architecture is prepared. **Phases 0–8 (June 2026)** delivered internal evidence, core standards, MCEDT claims software, OLIS-ready lab desk, PrescribeIT-ready eRx desk, DIR-ready imaging desk, HRM inbox, and DHDR query hooks.

| Metric | Estimate |
|--------|----------|
| Overall Ontario readiness | 72–82% |
| Functional clinical EMR | 75–85% |
| Live provincial connectivity | 5–15% |
| OntarioMD certification | 0% (application not submitted; evidence binder ~25–35%) |

---

## Readiness by Pillar

| Pillar | ~% | Strongest | Weakest |
|--------|-----|-----------|---------|
| Foundational (HL7/FHIR, security, privacy) | 70–80% | Gateway audit, interop append-only logging, consent management, PHIPA pack | ONE ID, third-party audit, legal review |
| EHR connectivity (OLIS, HRM, PrescribeIT, etc.) | 5–15% | Interop libraries, gateway stubs | No live provincial pipes |
| Functional clinical EMR | 75–85% | Charting, orders, portal, billing; CPP, i4C, consents live | Full OntarioMD functional conformance testing |
| Certification process | 25–35% | Spec traceability, self-assessment, evidence binder (Phases 0–2) | OntarioMD application not started |

---

## 1. Core Standards & Architecture Setup

| Requirement | Status | Notes |
|-------------|--------|-------|
| HL7 v2 messaging engine | Partial (~60%) | ORM/ORU, ACK, MLLP in `lib/interop/hl7/`; not live |
| HL7 FHIR R4 client/server | Partial (~60%) | Gateway Bundle export, patient search, chart download |
| DICOM support | Partial (~50%) | DICOMweb, gateway stubs, clinical image/PDF viewer |
| PHIPA/HIPAA-equivalent compliance | Partial (~65%) | Compliance pack and policy index; legal review outstanding |
| Structured consent capture | Partial (~55%) | Patient consents + organization consent management |
| Immutable audit trail | Partial (~75%) | Append-only audit_logs and interop_messages |
| Integration gateway audit | Done | All gateway actions logged to interop_messages |
| ONE ID federation | Not started | Supabase auth only |

---

## 2. Laboratory Integration (OLIS)

| Requirement | Status | Notes |
|-------------|--------|-------|
| HL7 v2 lab interface | Partial (~45%) | ORM export, ORU ingest queue, MLLP when configured |
| FHIR Patient Query | Partial (~30%) | Gateway + PHN registry; live OLIS blocked |
| Auto-ingest results into charts | Partial (~40%) | `/lab-results-queue`, merge workflow |
| OLIS consent gate | Partial (~50%) | `olis_query` consent; client + server |
| PHN registry | Partial (~45%) | `/patient-identifiers` |
| OntarioMD sandbox testing | Not started | Requires Infoway enrollment |

---

## 3. Imaging Integration

| Requirement | Status | Notes |
|-------------|--------|-------|
| DICOMweb / viewer | Partial | Client library; no embedded viewer |
| ConnectingOntario / DI repository | Partial (~35%) | Launch URL stub + provincial hub settings; production SSO blocked |
| Contextual launch from chart | Partial (~35%) | ConnectingOntario + SMART-on-FHIR buttons on patient chart |

---

## 4. Pharmacy / ePrescribing (PrescribeIT)

| Requirement | Status | Notes |
|-------------|--------|-------|
| PrescribeIT API | Partial (~35%) | `/erx-queue`, cancel/renew/dispense; live Infoway blocked |
| CCDD drug dataset | Partial | Health Canada DPD (~14,800 products); full CCDD not licensed |
| MFA for eRx | Partial | App lockout/session; not PrescribeIT-specific |
| Pharmacy network messaging | Partial (queue mode) | Sample pharmacy directory + FHIR transmit when credentialed |

---

## 5. Claims Submission (MCEDT)

| Requirement | Status | Notes |
|-------------|--------|-------|
| MCEDT Web Service client | Partial (~45%) | `mcedt-client.js`, claims queue, batch scheduler; live upload when credentialed |
| Claim file formats | Partial (~45%) | JSON and MOH-oriented XML export; XSD sign-off pending MOH test env |
| Batch processing | Partial (~40%) | `claims-batch-daily` function, `/claims-queue` |
| Rejection workflow | Partial (~40%) | `claims-workflow.js`, reset-to-draft in queue |
| Remittance & reconciliation | Partial (~45%) | `/remittance-reconcile`, `remittance_records` table |
| Cut-off date logic | Done | `mcedt-cutoff.js` |
| Eligibility checking | Partial (~25%) | PHN format validation; live MOH API blocked |

---

## 6. Provincial Hubs & Certification Prep

| Module | Status |
|--------|--------|
| HRM (hospital report inbox) | Partial (~45%) |
| DHDR (drug repository) | Partial (~40%) |
| ConnectingOntario viewer | Partial (~35%) |
| Ontario EMR Specifications alignment | Partial (~60%) |
| Evidence binder / gap report | Partial (~65%) |
| Self-assessment (Stages 1–4) | Partial (~55%) |
| OntarioMD validation process | Not started |

---

## 7. Engineering Best Practices

| Practice | Status |
|----------|--------|
| Modular adapter architecture | Strong (~80%) |
| Logging & audit trails | Partial (~80%) |
| Automated testing | Partial (~65%) |
| Third-party security audit | Not done |
| Integration documentation | Partial (~70%) |
| High-volume scalability testing | Partial (~30%) |

---

## Phase 0 Complete (June 2026)

Internal readiness sprint delivered without provincial credentials:

| Deliverable | Location |
|-------------|----------|
| OntarioMD gap report | `docs/ONTARIOMD-GAP-REPORT.md` |
| PHIPA compliance pack | `docs/compliance/` |
| Append-only audit hardening | `supabase/migrations/20260623200000_audit_logs_append_only.sql` |
| FHIR R4 patient chart export | `lib/interop/fhir/patient-chart-bundle.js`, patient chart button |
| CPP-aligned patient summary | `/cpp-patient-summary` |
| Structured consent capture | `/patient-consents`, migration `20260623210000_patient_consents.sql` |
| i4C indicator mapping | `js/i4c-indicator-map.js` |
| OHIP claim file draft export | `js/ohip-claim-export.js`, invoice details button |

## Phase 1 Complete (June 2026)

| Deliverable | Location |
|-------------|----------|
| Interop gateway audit | `lib/interop/gateway-audit.js`, `interop-gateway` function |
| FHIR gateway export | `exportPatientBundle`, `fhirSearchPatients` actions |
| Consent management (org) | `/consent-management` |
| Clinical image viewer | `js/chart-image-viewer.js` |
| Append-only interop_messages | `20260624100000_interop_messages_append_only.sql` |
| PHIPA policy pack index | `docs/compliance/PHIPA-POLICY-PACK-INDEX.md` |
| Strategic Partner letter | `/strategic-partner-letter` |

**Owner action:** Run `20260624100000_interop_messages_append_only.sql` per environment if not done.

## Phase 3 Complete (June 2026, software)

| Deliverable | Location |
|-------------|----------|
| MCEDT format & XML export | `lib/billing/mcedt-format.js` |
| MCEDT client & cut-off | `lib/billing/mcedt-client.js`, `mcedt-cutoff.js` |
| Claims workflow | `lib/billing/claims-workflow.js` |
| Claims queue UI | `/claims-queue` |
| Remittance reconcile UI | `/remittance-reconcile` |
| MCEDT settings | `/mcedt-settings` |
| Batch scheduler | `netlify/functions/claims-batch-daily.js` |
| Gateway actions | `batchSubmitClaims`, `exportMcedtXml`, `checkOhipEligibility` |

**Blocked until MOH credentials:** live claim upload, live remittance download, live eligibility API.

---

## Priority Roadmap

1. **OntarioMD certification path** (~25–35%: evidence binder, self-assessment, traceability; application pending)
2. **MCEDT claims (live)** (~45% software; MOH credentials needed for upload)
3. **OLIS labs** (~35–45%: lab desk software; Infoway onboarding for live pipe)
4. **PrescribeIT** (~35%: eRx queue, cancel/renew/dispense; live vendor enrollment)
5. **Imaging / DI** (~45% software: imaging desk + CO/SMART stubs; DIR/PACS live blocked)
6. **HRM / DHDR** (~40–45% software: inbox + query hooks; live provincial pipes blocked)

**Next:** OntarioMD vendor contact and Stage 5 validation (owner action). Live PrescribeIT/OLIS/MCEDT/DIR/HRM/DHDR need clinic credentials.

---

## Path to Certification

Forward-looking plan from today (Phases 0–8 software complete, **72–82%** documented readiness) to OntarioMD certification, live provincial pipes, pilot clinics, and commercial readiness. **Keep in sync with `#certification-path` on `/ontario-readiness`.** Consolidated Gantt-style costs and capital flow: **`/project-plan`**.

| Metric | Value |
|--------|-------|
| Estimated timeline to full commercial status | **6–12 months** |
| Remaining budget (audits, legal, pilots, onboarding) | **$50k–$150k+** |
| OntarioMD milestone fees (approx.) | **~$27,500** |

### Phase A: OntarioMD certification path (2–6 months, owner-led)

| Action | Owner | Status |
|--------|-------|--------|
| Contact OntarioMD (emr@ontariomd.com) for vendor consultation | Owner | Next step |
| Select reference clinic site (Ottawa/Ontario pilot) | Owner | Not started |
| Stage 1 application (architecture, features, alignment matrix) | Owner + agent | Evidence ready |
| Stages 2–4 self-assessment and gap closure | Agent | Software live |
| Stage 5 OntarioMD validation testing | OntarioMD | Blocked |
| Pay OntarioMD milestone fees (~CAD $27,500 total) | Owner | Not started |
| Third-party privacy impact assessment and security audit | Owner/vendor | Blocked |

### Phase B: Live provincial integrations (3–6 months after credentials)

| System | Key actions |
|--------|-------------|
| OLIS | Deploy with OntarioMD advisor; HL7 v2 + FHIR patient query; auto-ingest to chart |
| MCEDT | OPS BPS Secure account; clinic certificates; live upload/download |
| PrescribeIT | Partner API credentials; live eRx transmit, renew, cancel |
| DIR / Imaging | DICOM via gateway; ConnectingOntario ClinicalViewer launch |
| HRM / DHDR | Live hub enrollment; inbound report routing; drug repository query |

### Phase C: Pilots and commercial readiness (3–6 months)

Pilot deployments (1–3 Ottawa-area clinics), feedback and fixes, support/operations (helpdesk, training, SLA, monitoring, DR), legal and business readiness (contracts, insurance, sales collateral).

### Phase D: Scale and expansion (ongoing)

Additional provincial certifications, advanced features, ongoing compliance and integration maintenance.

### Timeline summary

| Phase | Focus | Estimate |
|-------|-------|----------|
| A | OntarioMD certification path | 2–6 months |
| B | Live provincial integrations | 3–6 months (parallel with A where credentials allow) |
| C | Pilots and go-to-market | 3–6 months |
| **Total** | **Full commercial status** | **6–12 months** |

**Next immediate action (owner):** Email OntarioMD at emr@ontariomd.com or support@ontariomd.com with a brief overview of MediForge (deployed EMR, Phases 0–8 software complete, 72–82% documented readiness) and request a **certification consultation**.

**Resources:** OntarioMD (ontariomd.ca), Ontario Health Service Desk 1-888-411-7742, PrescribeIT (prescribeit.ca), MCEDT manuals (ontario.ca), Infoway (infowayinforoute.ca). Written companion: **`docs/ROADMAP-CANADA-CERTIFICATION.md`**.

---

## Built Today vs Outstanding

### Built & Usable Today

- Multi-clinic EMR with role-based access
- Patient charts, bulk import, online intake
- SOAP notes, ICD-10-CA, Health Canada Rx
- 176+ lab tests, 67 imaging studies
- Ontario L-codes and OHIP imaging fee codes
- Billing, invoicing, cash register, claim drafts
- Patient portal with results workflow
- Pharmacy and inpatient modules (optional)
- Offline PWA, audit logs, encryption option
- HL7, FHIR, DICOMweb foundation libraries
- CPP-aligned patient summary view
- FHIR R4 patient chart Bundle export
- Structured consent capture (portal, sharing, research)
- i4C-style preventive indicator mapping
- PHIPA compliance documentation pack
- OntarioMD gap report and evidence binder
- OHIP claim file draft export from billing
- Organization consent management registry
- Interop gateway audit on all integration actions
- Clinical image and PDF viewer for chart documents
- Lab results queue, claims queue, eRx queue, imaging desks, HRM inbox, provincial hub settings
- Strategic Partner letter and readiness report pages

### Outstanding (Partner / Credential Gated)

- Live OLIS, MCEDT, PrescribeIT, HRM, DHDR connections
- ConnectingOntario production viewer SSO
- ONE ID authentication
- OntarioMD certification & reference site
- Licensed LOINC / pCLOCD / CCDD at scale
- Legal review of PHIPA pack & third-party audit
- Remittance reconciliation & eligibility APIs
- Provincial sandbox conformance testing

---

## Investment Thesis (Summary)

1. **De-risked clinical core:** Daily clinic workflows are largely built and deployed.
2. **Prepared integration layer:** HL7, FHIR, DICOMweb, billing adapters exist as tested foundations.
3. **Clear regulatory path:** OntarioMD certification gap is documented and bounded; Phases 0–8 software evidence is in repo.
4. **Canada-first moat:** ICD-10-CA, Ontario fee codes, Health Canada formulary, PHN matching, CAD billing are in the product.

---

## Related Documents

| Document | Purpose |
|----------|---------|
| **`ONTARIO-EMR-IMPLEMENTATION-PLAN.md`** | Full task backlog with milestones |
| **`ONTARIOMD-GAP-REPORT.md`** | Itemized gap status by category |
| **`ONTARIOMD-READINESS-PLAN.md`** | Agent sprint plan and STOP gate for Phase 1+ |
| **`MEDIFORGE-INTEROPERABILITY-DOCS.md`** | Technical interop reference |
| **`interoperability-gaps.md`** | Pre/post upgrade gap matrix |
| **`/strategic-partner-letter`** | Shareable Strategic Partner update letter |
| **`/valuation-equity-structure`** | Seed valuation and equity structure (Strategic Partner diligence) |
| **`/project-plan`** | Gantt-style costs, timelines, seed tranche alignment |
| **`/revenue-projection`** | 5-year revenue and net income model (pricing, clinic growth, costs) |
| **`/term-sheet`** | Seed preferred share term sheet (discussion draft) |
| **`/project-plan`** | Phased costs, timelines, Gantt-style capital deployment (sync with term sheet tranches) |
| **`/ontario-readiness`** | Strategic Partner shareable webpage (keep in sync with this doc); includes `#certification-path` |
| **`/evidence-binder`** | Diligence index including valuation, roadmap, and phase completion records |
| **`/capabilities`** | Full product capabilities showcase |

---

*MediForge: built for modern primary care, specialty clinics, and hospital-attached practices. Powered by Work Chop Inc. Not a certification claim.*
