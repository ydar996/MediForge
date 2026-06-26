# MediForge: Roadmap to Canada Certification (Ontario-Focused)

**Last updated:** June 2026 (research integration: cost benchmarks and references)  
**Written companion to:** [Ontario EMR Implementation Plan](ONTARIO-EMR-IMPLEMENTATION-PLAN.md) · [Ontario Readiness Report](ONTARIO-EMR-READINESS-REPORT.md) · [/ontario-readiness#certification-path](https://mediforge.netlify.app/ontario-readiness#certification-path)

**Shareable web version:** The certification path (Phases A–D, timeline, budget, next action) is published on [/ontario-readiness#certification-path](https://mediforge.netlify.app/ontario-readiness#certification-path). **Consolidated Gantt-style project plan (costs + capital tranches):** [/project-plan](https://mediforge.netlify.app/project-plan). Keep this file in sync with that section per **`AGENT-HANDOVER.md`** Rule #3.

**Source document (Word):** `docs/strategic-partner/originals/Roadmap to Canada Certification - MediForge.docx`

---

## Current status (June 2026)

| Item | Status |
|------|--------|
| Product | **Deployed multi-clinic EMR** in active use (not a prototype) |
| Ontario software (Phases 0–8) | **Complete** where buildable without live provincial credentials; 75+ automated interop tests passing |
| Evidence binder | Traceability matrix, PHIPA pack, audit trails, phase records ([/evidence-binder](https://mediforge.netlify.app/evidence-binder)) |
| Documented Ontario readiness | **72–82%** |
| OntarioMD certification progress | **0%** (Stages 1–5 not started; vendor path pending) |
| Live provincial pipes (OLIS, MCEDT, PrescribeIT, DIR, HRM, DHDR) | **5–15%** (blocked on partner enrollment; queue/stub software ready) |
| OntarioMD Stage 5 validation | **Not started** (owner approval + vendor path required) |

**Goal:** OntarioMD certification (Stages 1–5 including reference site assessment), live provincial integrations, pilot clinics, and commercial readiness for physicians and clinics in Ottawa/Ontario (and expansion beyond).

**Realistic timeline from today:** **6–12 months** for certification path and pilots, depending on OntarioMD pace, reference clinic selection, and credential onboarding. Software foundation is largely in place.

**Budget (remaining, benchmark estimates; subject to quotes):**

See [Lean / Base / Stress scenarios](https://mediforge.netlify.app/financial-model#scenarios).

**Base default:** up to **$400,000** commitment; expected deploy **$300k–$400k**.

Cert spend **$90k–$150k** (excludes dev fee).

OntarioMD fees **$27,500 + HST** ([sourced](https://www.ontariomd.ca/emr-certification/emr-certification/overview)).

---

## What is already done (Phases 0–8 software)

The original roadmap assumed an MVP starting point. As of June 2026, the following are **built and documented**:

### Foundation and compliance (Phase 0–1)

- Gap report, PHIPA compliance pack, append-only audit logs, consent registry
- HL7 v2 and FHIR R4 libraries, interop gateway, DICOMweb client
- Evidence binder, self-assessment, spec traceability matrix
- Strategic Partner pages: `/ontario-readiness`, `/strategic-partner-letter`, `/evidence-binder`

### Provincial desks (Phases 3–7, software)

| System | Software status | Live status |
|--------|-----------------|-------------|
| MCEDT (OHIP claims) | Claims queue, remittance reconcile, batch XML validation | Blocked on MOH credentials |
| OLIS (labs) | Lab results queue, HL7 export, patient identifiers | Blocked on Infoway/OLIS onboarding |
| PrescribeIT (eRx) | eRx queue, MedicationRequest workflow | Blocked on PrescribeIT partner enrollment |
| DIR (imaging) | Imaging queue, DICOM stubs, contextual launch hooks | Blocked on provincial DI repository |
| HRM / DHDR | HRM inbox with chart filing, DHDR query hooks, hub settings | Blocked on Ontario Health enrollment |

### Engineering (Phase 8)

- Load-test scripts, webhook alerts, user manual updates, 75+ interop tests passing

See phase completion records under `docs/PHASE-*-COMPLETION.md` and the [Implementation Plan](ONTARIO-EMR-IMPLEMENTATION-PLAN.md).

---

## Remaining roadmap

### Phase A: OntarioMD certification path (owner-led, 2–6 months)

**Goal:** Open vendor path, complete Stages 1–4 evidence review, prepare for Stage 5 validation.

| Action | Owner | Status |
|--------|-------|--------|
| Contact OntarioMD (emr@ontariomd.com) for new vendor consultation | Owner | ⬜ Next step |
| Select reference clinic site (Ottawa/Ontario pilot) | Owner | ⬜ |
| Stage 1 application: architecture, feature list, alignment matrix | Owner + agent | 🔶 Evidence ready; submission pending |
| Stages 2–4: internal self-assessment and gap closure | Agent | ✅ Software self-assessment live |
| Stage 5: OntarioMD validation testing | OntarioMD | 🚫 Blocked until vendor path opens |
| Pay milestone fees ($27,500 + HST per [published schedule](https://www.ontariomd.ca/emr-certification/emr-certification/overview)) | Owner | ⬜ |
| Third-party privacy impact assessment and security audit ($10k–$40k benchmark; obtain quote) | Owner/vendor | 🚫 |

**Success metrics:** OntarioMD vendor engagement started | Stage 5 scheduled | reference site identified.

---

### Phase B: Live provincial integrations (3–6 months after credentials)

**Goal:** Move from queue-mode software to live test transactions with provincial systems.

| Integration | Key actions | Contact |
|-------------|-------------|---------|
| **OLIS** | Deploy with OntarioMD advisor; HL7 v2 + FHIR patient query; auto-ingest to chart | support@ontariomd.com |
| **MCEDT** | OPS BPS Secure account; clinic certificates in `/mcedt-settings`; live upload/download | ontario.ca MCEDT manuals |
| **PrescribeIT** | Partner API credentials; live eRx transmit/renew/cancel | prescribeit.ca / Infoway |
| **DIR / Imaging** | DICOM C-FIND/C-MOVE via gateway; ConnectingOntario ClinicalViewer launch | OntarioMD / Infoway |
| **HRM / DHDR** | Live hub enrollment; inbound report routing; drug repository query | Provincial hub settings |

**Success metrics:** Successful test transactions on each desk | beta deployment with 1–2 pilot clinics.

---

### Phase C: Pilots and commercial readiness (3–6 months)

**Goal:** Certified, integrated, sellable product with support infrastructure.

| Action | Notes |
|--------|-------|
| Pilot deployments | 1–3 Ottawa-area clinics; reference site for OntarioMD |
| Feedback and fixes | Real-world workflow hardening |
| Support and operations | Helpdesk, training materials, SLA, monitoring, DR |
| Legal and business | Contracts, privacy agreements, insurance, sales collateral |

**Success metrics:** Paying pilot clients | support processes live | sales-ready collateral highlighting certification and integrations.

---

### Phase D: Scale and expansion (ongoing)

- Additional provincial certifications
- Advanced features (analytics, telehealth, AI-assisted workflows)
- Ongoing compliance and integration maintenance as standards evolve

---

## Timeline summary (from June 2026)

| Phase | Focus | Estimate |
|-------|-------|----------|
| A | OntarioMD certification path | 2–6 months |
| B | Live provincial integrations | 3–6 months (parallel with A where credentials allow) |
| C | Pilots and go-to-market | 3–6 months |
| **Total to full commercial status** | | **6–12 months** |

---

## Next immediate action

1. **Email OntarioMD** (support@ontariomd.com or emr@ontariomd.com) with a brief overview of MediForge (deployed EMR, Phases 0–8 software complete, evidence binder ready) and request a **certification consultation**.
2. **Obtain quotes** for legal, PIA/security audit, and consulting support.
3. **Prepare Stage 1 application** and identify an Ontario reference clinic.
4. **Explore Ontario/Canadian health tech grants** to offset certification and pilot costs.

**Cross-border:** Confirm PHIPA-aligned Canada data residency and subprocessors before live PHI pilots if development resources include non-Canadian contributors.

---

## References

MediForge. (2026). *Ontario EMR readiness: Strategic partner report*. https://mediforge.netlify.app/ontario-readiness

Mindbowser. (n.d.). *OntarioMD certification: A guide for digital health vendors*. https://www.mindbowser.com/ontariomd-certification-guide-for-digital-health-vendors/

OntarioMD. (n.d.-a). *EMR certification overview*. https://www.ontariomd.ca/emr-certification/emr-certification/overview

OntarioMD. (n.d.-b). *EMR certification program FAQ*. https://www.ontariomd.ca/emr-certification/faq

---

## Resources and contacts

| Resource | Link / contact |
|----------|----------------|
| OntarioMD | ontariomd.ca · support@ontariomd.com |
| Ontario Health Service Desk | 1-888-411-7742 |
| PrescribeIT | prescribeit.ca |
| MCEDT | ontario.ca (MCEDT Reference Manual) |
| HL7 / FHIR / DICOM | infowayinforoute.ca |
| Agent task backlog | [ONTARIO-EMR-IMPLEMENTATION-PLAN.md](ONTARIO-EMR-IMPLEMENTATION-PLAN.md) |
| Coding agent instructions | [IMPLEMENTATION-INSTRUCTIONS-CODING-AGENTS.md](IMPLEMENTATION-INSTRUCTIONS-CODING-AGENTS.md) |

---

*This roadmap supersedes the June 2026 Word draft that described MediForge as "completed MVP only." Software status above reflects Phases 0–8 delivery.*
