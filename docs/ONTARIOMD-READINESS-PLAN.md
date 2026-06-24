# OntarioMD Readiness Plan: MediForge

**Created:** June 23, 2026  
**Last updated:** June 2026 (Phases 0–5 software)  
**Owner target:** Complete internal readiness work in focused sprints, not an open-ended program.  
**Current estimated alignment:** ~60–70% overall (Phases 0–5 software complete where possible, June 2026).  
**Next gate:** OntarioMD Stage 5 validation and live provincial pipes (partner credentials + owner vendor contact).

---

## STOP GATE: agents must read this first

**Phases 0–5 software are complete** (where possible without partner credentials). Do not start **Phase 6+** (live imaging hubs, HRM/DHDR) or **OntarioMD Stage 5 submission** until the owner explicitly says to proceed.

Until then: documentation upkeep and bug fixes only; no new Ontario implementation without approval.

After approval: work on **`dev`** first; deploy only with owner approval per **`DEPLOYMENT-PIPELINE.md`**.

When readiness scores or phase status change, update **all companion pairs** in the same session (**Rule #3**): `/ontario-readiness`, `/investor-letter`, `ONTARIO-EMR-READINESS-REPORT.md`, `ONTARIOMD-GAP-REPORT.md`, `INVESTOR-LETTER-2026-06.md`.

---

## Baseline (post Phases 0–5, June 2026)

| Category | ~% in place | Strongest | Weakest |
|----------|-------------|-----------|---------|
| Foundational (HL7/FHIR, security, privacy) | 60–70% | Gateway audit, append-only interop, consent management | ONE ID, legal review, third-party audit |
| EHR connectivity (OLIS, HRM, PrescribeIT, etc.) | 5–15% | MCEDT/OLIS desk UI, HL7/FHIR libraries | No live provincial pipes |
| Functional clinical | 75–85% | Charting, orders, portal; CPP, i4C, consents live | Full OntarioMD functional conformance |
| Certification process | 25–35% | Evidence binder, self-assessment, traceability | OntarioMD Stage 5 not started |

**Sources:** Owner-provided OntarioMD spec summary (June 2026); internal codebase review (`lib/interop/`, `lib/integrations/`, clinical modules, billing, lab desk).

---

## Owner goal vs agent capability (confidence)

**Question:** Can agents deliver Ontario **software** work with **minimal supervision**?

| Tier | Status (June 2026) |
|------|---------------------|
| Phase 0 internal evidence | **Complete** |
| Phase 1 core standards | **Complete** |
| Phase 2 certification prep (software) | **Partial** (binder, self-assessment, traceability) |
| Phase 3 MCEDT software | **Complete** (live MOH blocked) |
| Phase 4 OLIS lab desk | **Partial** (live Infoway blocked) |
| Phase 5 PrescribeIT software | **Partial** (eRx queue, cancel/renew/dispense; live Infoway blocked) |
| Phase 6+ / live pipes | **Blocked** until owner approves |

See **`docs/ONTARIO-EMR-IMPLEMENTATION-PLAN.md`** for task-level status.

---

## Key deliverables (live URLs)

| Deliverable | Location |
|-------------|----------|
| Readiness report | `/ontario-readiness` |
| Investor letter | `/investor-letter` |
| Evidence binder | `/evidence-binder` |
| Self-assessment | `/ontario-self-assessment` |
| eRx queue | `/erx-queue` |
| Gap report (this program) | `docs/ONTARIOMD-GAP-REPORT.md` |

---

## Owner actions (not code)

1. Email OntarioMD (emr@ontariomd.com) for vendor certification path.
2. Select reference clinic site.
3. Enroll for MOH MCEDT and Infoway OLIS/PrescribeIT when ready for live pilots.

---

*Companion to `ONTARIO-EMR-IMPLEMENTATION-PLAN.md` and `AGENT-HANDOVER.md` Rule #3.*
