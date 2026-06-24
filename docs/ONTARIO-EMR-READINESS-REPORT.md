# Ontario EMR Readiness Report

**Version:** June 2026 (Phase 0 complete)  
**Audience:** Investors, partners, clinic leaders  
**Shareable web version:** https://mediforge.netlify.app/ontario-readiness  
**Implementation tasks:** See **`ONTARIO-EMR-IMPLEMENTATION-PLAN.md`**

This document is the written companion to the investor readiness webpage. Share the **URL** with external audiences, not this file path. **Keep this file in sync with `ontario-readiness.html`** (see **`AGENT-HANDOVER.md`** Rule #3).

---

## Executive Summary

MediForge is a Canada-first clinic platform with **strong clinical functionality today** (~75–85%) and a **clear path** toward Ontario provincial connectivity and OntarioMD certification. Overall Ontario readiness is estimated at **45–55%** after Phase 0 internal evidence work (June 2026). Live provincial pipes remain at **5–15%** because they require partner credentials every certified vendor must obtain.

**The opportunity:** Clinical workflows are largely complete and deployed. Provincial integrations (OLIS, MCEDT, PrescribeIT, HRM) need credentials and agreements; our architecture is prepared. **Phase 0 (June 2026)** delivered the internal evidence pack: gap report, PHIPA compliance documentation, audit hardening, FHIR patient export, CPP summary, consent capture, i4C mapping, and OHIP claim draft export.

| Metric | Estimate |
|--------|----------|
| Overall Ontario readiness | 45–55% |
| Functional clinical EMR | 75–85% |
| Live provincial connectivity | 5–15% |
| OntarioMD certification | 0% (application not submitted; evidence binder ~5–10%) |

---

## Readiness by Pillar

| Pillar | ~% | Strongest | Weakest |
|--------|-----|-----------|---------|
| Foundational (HL7/FHIR, security, privacy) | 55–65% | PHIPA compliance pack, append-only audit migration, patient-access logging | ONE ID, third-party security audit, legal review of policies |
| EHR connectivity (OLIS, HRM, PrescribeIT, etc.) | 5–15% | Interop libraries, gateway stubs | No live provincial pipes |
| Functional clinical EMR | 75–85% | Charting, orders, portal, billing; CPP summary, i4C mapping, consent capture live | Full OntarioMD functional conformance testing |
| Certification process | 5–10% | Gap report and evidence binder published | OntarioMD application not started |

---

## 1. Core Standards & Architecture Setup

| Requirement | Status | Notes |
|-------------|--------|-------|
| HL7 v2 messaging engine | Partial (~60%) | ORM/ORU, ACK, MLLP in `lib/interop/hl7/`; not live |
| HL7 FHIR R4 client/server | Partial (~55%) | Resource builders, gateway, patient chart Bundle export; no production FHIR server |
| DICOM support | Partial (~40%) | DICOMweb client; file attach; no live PACS/viewer |
| PHIPA/HIPAA-equivalent compliance | Partial (~60%) | RBAC, audit, encryption option, compliance pack in `docs/compliance/`; legal review outstanding |
| Structured consent capture | Partial (~40%) | Portal, data sharing, research types; DB + UI (`/patient-consents`) |
| Immutable audit trail | Partial (~65%) | Append-only DB migration; patient chart access logging (migration per environment) |
| ONE ID federation | Not started | Supabase auth only |

---

## 2. Laboratory Integration (OLIS)

| Requirement | Status | Notes |
|-------------|--------|-------|
| HL7 v2 lab interface | Foundation | ORM^O01, ORU^R01, MLLP when configured |
| FHIR Patient Query | Stub | PHN matching; Ontario config template |
| Auto-ingest results into charts | Partial | Ingest adapters; not wired to live LIS |
| OntarioMD sandbox testing | Not started | Requires Infoway enrollment |

---

## 3. Imaging Integration

| Requirement | Status | Notes |
|-------------|--------|-------|
| DICOMweb / viewer | Partial | Client library; no embedded viewer |
| ConnectingOntario / DI repository | Not live | Config stubs only |
| Contextual launch from chart | Not started | Orders yes; no SMART-on-FHIR launch |

---

## 4. Pharmacy / ePrescribing (PrescribeIT)

| Requirement | Status | Notes |
|-------------|--------|-------|
| PrescribeIT API | Foundation (~10%) | MedicationRequest builder; adapter stub |
| CCDD drug dataset | Partial | Health Canada DPD (~14,800 products); full CCDD not licensed |
| MFA for eRx | Partial | App lockout/session; not PrescribeIT-specific |
| Pharmacy network messaging | In-clinic only | No external pharmacy network |

---

## 5. Claims Submission (MCEDT)

| Requirement | Status | Notes |
|-------------|--------|-------|
| MCEDT Web Service client | Stub (~15%) | OHIP claim drafts; submit queues when not configured |
| Claim file formats | Partial (~25%) | JSON drafts and invoice OHIP claim file export; not MOH XSD-certified |
| Batch processing, remittance, reconciliation | Not started | |
| Eligibility checking | Not started | PHN validation helpers only |

---

## 6. Provincial Hubs & Certification Prep

| Module | Status |
|--------|--------|
| HRM (hospital report inbox) | Not implemented |
| DHDR (drug repository) | Not implemented |
| ConnectingOntario viewer | Not implemented |
| Ontario EMR Specifications alignment | Partial (~50%) |
| Evidence binder / gap report | Partial (~50%) |
| OntarioMD validation process | Not started |

---

## 7. Engineering Best Practices

| Practice | Status |
|----------|--------|
| Modular adapter architecture | Strong (~80%) |
| Logging & audit trails | Partial (~70%) |
| Automated testing | Partial (~55%) |
| Third-party security audit | Not done |
| Integration documentation | Partial (~55%) |
| High-volume scalability testing | Not done |

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

**Owner action:** Run both `2026062320*` migrations in Supabase SQL Editor (dev → staging → prod) before consents and chart-access audit RPC work on live DB.

---

## Priority Roadmap

1. **OntarioMD certification path** (~5–10%: gap report + evidence pack complete; application pending)
2. **MCEDT claims** (~25%: draft export live; MOH credentials needed)
3. **OLIS labs** (~20%: HL7/FHIR plumbing; Infoway onboarding)
4. **PrescribeIT** (~10%: adapter stubs; vendor enrollment)
5. **Imaging / DI** (~15%: orders + DICOMweb; DIR/PACS live)

**Next:** Phase 1 core standards and OntarioMD vendor outreach (blocked until owner approves).

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

### Outstanding (Partner / Credential Gated)

- Live OLIS, MCEDT, PrescribeIT connections
- HRM, DHDR, ConnectingOntario
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
3. **Clear regulatory path:** OntarioMD certification gap is documented and bounded; Phase 0 evidence is in repo.
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
| **`/ontario-readiness`** | Investor shareable webpage (keep in sync with this doc) |
| **`/capabilities`** | Full product capabilities showcase |

---

*MediForge: built for modern primary care, specialty clinics, and hospital-attached practices. Powered by Work Chop Inc. Not a certification claim.*
