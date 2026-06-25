# Strategic Partner Project Plan: Costs, Timelines, and Capital Flow

**Work Chop Inc. · MediForge EMR Platform**  
**Date:** June 2026  
**Shareable web version:** https://mediforge.netlify.app/project-plan  
**Written companion to:** **`project-plan.html`** (keep in sync per `AGENT-HANDOVER.md` Rule #3)

**Related diligence:** [Financial Model](https://mediforge.netlify.app/financial-model) (interactive inputs) · [Term Sheet](TERM-SHEET-SEED-PREFERRED-SHARE.md) · [Valuation & Equity Structure](VALUATION-AND-EQUITY-STRUCTURE.md) · [Revenue Projection](REVENUE-AND-NET-INCOME-PROJECTION.md) · [Ontario Readiness Report](https://mediforge.netlify.app/ontario-readiness) · [Certification path](https://mediforge.netlify.app/ontario-readiness#certification-path) · [Canada Certification Roadmap](../ROADMAP-CANADA-CERTIFICATION.md)

---

## Purpose

This document is the **single high-level overview** that ties together:

1. **Operational phases** (software Phases 0–8 complete; certification path Phases A–D forward)
2. **Seed capital deployment** (milestone-linked tranches from the Term Sheet)
3. **Phased cost bands** (what money is for, and when)
4. **Timeline** (6–12 months to commercial readiness; ~18 months for full seed deployment)

Detailed task backlogs remain in [ONTARIO-EMR-IMPLEMENTATION-PLAN.md](../ONTARIO-EMR-IMPLEMENTATION-PLAN.md). Financial terms remain authoritative in the Term Sheet and Valuation documents.

---

## Executive summary

| Dimension | Value |
|-----------|-------|
| Software delivered (Phases 0–8) | **Complete** where buildable without live credentials |
| Documented Ontario readiness | **72–82%** |
| Time to full commercial status (operational) | **6–12 months** from June 2026 |
| Seed investment (Strategic Partner) | **CAD $300,000 – $600,000** |
| Capital deployment | **Four tranches** over **~18 months** (not a lump sum) |
| Founder development fee (Company obligation) | **CAD $80,000–$120,000** (**$32,000–$48,000** at Closing = 40%; balance per options) |
| OntarioMD milestone fees (approx.) | **~CAD $27,500** |
| Third-party audit / legal / pilot band | **$50k–$150k+** (within seed use of proceeds) |

---

## Gantt-style timeline (18-month horizon)

Months are indicative from **Closing (Month 0)**. Phases A and B may overlap where credentials allow.

```mermaid
gantt
    title MediForge: Capital Flow and Certification Path (from Closing)
    dateFormat YYYY-MM
    axisFormat %b %Y

    section Software (complete)
    Phases 0-8 delivered           :done, sw, 2025-01, 2026-06

    section Seed capital tranches
    Tranche 1 Closing 25pct        :crit, t1, 2026-06, 1M
    Tranche 2 Phase A 25pct        :t2, 2026-08, 2026-10
    Tranche 3 Phase B 30pct        :t3, 2026-11, 2027-04
    Tranche 4 Phase C 20pct        :t4, 2027-05, 2027-12

    section Operational phases
    Phase A OntarioMD cert path    :a, 2026-06, 2026-12
    Phase B Live provincial pipes  :b, 2026-09, 2027-04
    Phase C Pilots and GTM         :c, 2027-03, 2027-09
    Phase D Scale ongoing          :d, 2027-07, 2028-06
```

---

## Phased costs and capital alignment

Illustrative amounts use a **$450,000 midpoint** commitment (25% / 25% / 30% / 20%). Scale proportionally for $300k–$600k.

| Period | Operational focus | Seed tranche | Illustrative capital (CAD) | Primary cost categories |
|--------|-------------------|--------------|------------------------------|-------------------------|
| **Pre-Closing** | Phases 0–8 software (done) | n/a | Sunk founder capital; **dev fee $80k–$120k** recognized at Closing | Platform build (replacement cost **$140k–$320k+**) |
| **Month 0** | Closing; OntarioMD vendor contact; reference clinic search | **Tranche 1 (25%)** | **$75k–$150k** | Legal/definitive docs ($15k–$25k); dev fee **$32k–$48k** at Closing (40%); compliance retainers; vendor consultation |
| **Months 2–4** | **Phase A:** certification path, Stage 1 submission, audit vendor | **Tranche 2 (25%)** | **$75k–$150k** | OntarioMD fees (initial portion of **~$27.5k**); PIA/security audit ($25k–$60k); evidence polish |
| **Months 5–10** | **Phase B:** live MCEDT/OLIS/PrescribeIT/DIR/HRM/DHDR onboarding | **Tranche 3 (30%)** | **$90k–$180k** | Credential enrollment; conformance testing; integration engineering support; Stage 5 prep |
| **Months 11–18** | **Phase C:** pilot clinics, sales, commercial ops | **Tranche 4 (20%)** | **$60k–$120k** | Pilot support; marketing and sales; ops; remaining dev fee balance if note/hybrid |
| **Ongoing** | **Phase D:** scale and expansion | Revenue / future round | TBD | Additional provinces; advanced features; compliance maintenance |

**Total seed deployment:** **$300k–$600k** over ~18 months. **Operational commercial target:** **6–12 months** (Phases A–C core path).

---

## Milestone map (capital release ↔ operations)

| Tranche | Target | Operational milestone (indicative) | Cost outcome |
|---------|--------|-------------------------------------|--------------|
| 1 | Closing | IP assigned; OntarioMD consultation initiated | Company legally funded; dev fee partial paid; audit/legal engaged |
| 2 | Months 2–4 | Reference clinic LOI; Stage 1 submitted; audit underway | Certification path unlocked; compliance spend committed |
| 3 | Months 5–10 | First provincial credential live; Stage 5 scheduled | Live pipes moving from queue-mode to test transactions |
| 4 | Months 11–18 | First pilot clinic live or first live provincial transaction | Revenue-ready pilots; GTM spend |

Exact release mechanics and reporting (e.g., quarterly use-of-proceeds) per definitive agreements. See [Term Sheet](TERM-SHEET-SEED-PREFERRED-SHARE.md).

---

## What is already funded (Phases 0–8)

| Phase | Delivered (software) | Status |
|-------|----------------------|--------|
| 0 | Gap report, PHIPA pack, FHIR export, readiness page | Complete |
| 1 | HL7/FHIR/DICOM, gateway audit, consent registry | Complete |
| 2 | Spec traceability, self-assessment, evidence binder | Complete |
| 3 | MCEDT claims desk, remittance, XML validation | Complete (live MOH blocked) |
| 4 | OLIS lab desk, PHN registry, HL7 export | Complete (live OLIS blocked) |
| 5 | PrescribeIT eRx queue, MedicationRequest workflow | Complete (live Infoway blocked) |
| 6 | Imaging desk, DICOMweb, launch stubs | Complete (live DIR blocked) |
| 7 | HRM inbox, File to chart, DHDR hooks, hub settings | Complete (live pipes blocked) |
| 8 | Runbook, load tests, monitoring, user manual | Complete |

This de-risks the Strategic Partner investment: seed capital funds **certification, live pipes, and go-to-market**, not greenfield EMR build.

---

## Forward operational phases (A–D)

| Phase | Timeline | Focus | Key spend |
|-------|----------|-------|-----------|
| **A** | 2–6 months | OntarioMD vendor path, Stages 1–5 prep, reference site | OntarioMD fees, audit, legal |
| **B** | 3–6 months (may parallel A) | Live OLIS, MCEDT, PrescribeIT, DIR, HRM, DHDR | Integration onboarding, testing |
| **C** | 3–6 months | 1–3 pilot clinics, support, sales collateral | Pilot ops, marketing |
| **D** | Ongoing | Scale, additional provinces, advanced features | Growth and maintenance |

Detail: [ROADMAP-CANADA-CERTIFICATION.md](../ROADMAP-CANADA-CERTIFICATION.md) and [/ontario-readiness#certification-path](https://mediforge.netlify.app/ontario-readiness#certification-path).

---

## Risk and dependency notes

- **OntarioMD pace** and **reference clinic selection** drive Phase A duration (owner-led).
- **Live provincial pipes** require Infoway/MOH/Ontario Health credentials shared by all vendors (not unique to MediForge).
- **Third-party security audit** is outstanding; budgeted in Tranche 2 band.
- Tranche timing assumes good-faith milestone achievement; definitive docs define remedies if external gates delay progress.

---

*For discussion and diligence only. Not legal or financial advice. Align with [Term Sheet](TERM-SHEET-SEED-PREFERRED-SHARE.md) and [Valuation](VALUATION-AND-EQUITY-STRUCTURE.md) for binding economics.*
