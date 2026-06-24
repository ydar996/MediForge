# Ontario EMR Readiness Report

**Version:** June 2026  
**Audience:** Investors, partners, clinic leaders  
**Shareable web version:** https://mediforge.netlify.app/ontario-readiness  
**Implementation tasks:** See **`ONTARIO-EMR-IMPLEMENTATION-PLAN.md`**

This document is the written companion to the investor readiness webpage. Share the **URL** with external audiences, not this file path.

---

## Executive Summary

MediForge is a Canada-first clinic platform with **strong clinical functionality today** (~70–80%) and a **clear path** toward Ontario provincial connectivity and OntarioMD certification. Overall Ontario readiness is estimated at **35–45%**. Live provincial pipes remain at **5–15%** because they require partner credentials every certified vendor must obtain.

**The opportunity:** Clinical workflows are largely complete and deployed. Provincial integrations (OLIS, MCEDT, PrescribeIT, HRM) need credentials and agreements; our architecture is prepared. Internal readiness work can raise documented evidence to ~45–55% before partner credentials arrive.

| Metric | Estimate |
|--------|----------|
| Overall Ontario readiness | 35–45% |
| Functional clinical EMR | 70–80% |
| Live provincial connectivity | 5–15% |
| OntarioMD certification | 0% (not started) |

---

## Readiness by Pillar

| Pillar | ~% | Strongest | Weakest |
|--------|-----|-----------|---------|
| Foundational (HL7/FHIR, security, privacy) | 40–50% | Auth, RLS, audit logs | ONE ID, formal PHIPA pack, immutable audit |
| EHR connectivity (OLIS, HRM, PrescribeIT, etc.) | 5–15% | Interop libraries, gateway stubs | No live provincial pipes |
| Functional clinical EMR | 70–80% | Charting, orders, portal, billing | Formal CPP, i4C analytics |
| Certification process | 0% | Readiness plan documented | Application not started |

---

## 1. Core Standards & Architecture Setup

| Requirement | Status | Notes |
|-------------|--------|-------|
| HL7 v2 messaging engine | Partial (~60%) | ORM/ORU, ACK, MLLP in `lib/interop/hl7/`; not live |
| HL7 FHIR R4 client/server | Partial (~50%) | Resource builders, gateway; no production FHIR server |
| DICOM support | Partial (~40%) | DICOMweb client; file attach; no live PACS/viewer |
| PHIPA/HIPAA-equivalent compliance | Partial (~45%) | RBAC, audit, encryption option; formal policy pack missing |
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
| Claim file formats | Partial | JSON drafts; not MOH XSD-certified |
| Batch processing, remittance, reconciliation | Not started | |
| Eligibility checking | Not started | PHN validation helpers only |

---

## 6. Provincial Hubs & Certification Prep

| Module | Status |
|--------|--------|
| HRM (hospital report inbox) | Not implemented |
| DHDR (drug repository) | Not implemented |
| ConnectingOntario viewer | Not implemented |
| Ontario EMR Specifications alignment | Partial (~40%) |
| OntarioMD validation process | Not started |

---

## 7. Engineering Best Practices

| Practice | Status |
|----------|--------|
| Modular adapter architecture | Strong (~80%) |
| Logging & audit trails | Partial (~60%) |
| Automated testing | Partial (~50%) |
| Third-party security audit | Not done |
| Integration documentation | Partial (~55%) |
| High-volume scalability testing | Not done |

---

## Priority Roadmap

1. **OntarioMD certification path** (0%: planning only)
2. **MCEDT claims** (~15%: drafts ready; MOH credentials needed)
3. **OLIS labs** (~20%: HL7/FHIR plumbing; Infoway onboarding)
4. **PrescribeIT** (~10%: adapter stubs; vendor enrollment)
5. **Imaging / DI** (~15%: orders + DICOMweb; DIR/PACS live)

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

### Outstanding (Partner / Credential Gated)

- Live OLIS, MCEDT, PrescribeIT connections
- HRM, DHDR, ConnectingOntario
- ONE ID authentication
- OntarioMD certification & reference site
- Licensed LOINC / pCLOCD / CCDD at scale
- Formal PHIPA policy pack & third-party audit
- Remittance reconciliation & eligibility APIs
- Provincial sandbox conformance testing

---

## Investment Thesis (Summary)

1. **De-risked clinical core:** Daily clinic workflows are largely built and deployed.
2. **Prepared integration layer:** HL7, FHIR, DICOMweb, billing adapters exist as tested foundations.
3. **Clear regulatory path:** OntarioMD certification gap is documented and bounded.
4. **Canada-first moat:** ICD-10-CA, Ontario fee codes, Health Canada formulary, PHN matching, CAD billing are in the product.

---

## Related Documents

| Document | Purpose |
|----------|---------|
| **`ONTARIO-EMR-IMPLEMENTATION-PLAN.md`** | Full task backlog with milestones |
| **`ONTARIOMD-READINESS-PLAN.md`** | Agent sprint plan (STOP GATE until owner approves) |
| **`MEDIFORGE-INTEROPERABILITY-DOCS.md`** | Technical interop reference |
| **`interoperability-gaps.md`** | Pre/post upgrade gap matrix |
| **`/ontario-readiness`** | Investor shareable webpage |
| **`/capabilities`** | Full product capabilities showcase |

---

*MediForge: built for modern primary care, specialty clinics, and hospital-attached practices. Powered by Work Chop Inc. Not a certification claim.*
