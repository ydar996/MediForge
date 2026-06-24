# OntarioMD Readiness Plan: MediForge

**Created:** June 23, 2026  
**Owner target:** Complete internal readiness work **today** (single sprint), not an 8-week program.  
**Current estimated alignment:** ~50–60% overall (Phase 0 and Phase 1 complete, June 2026).  
**Phase 2:** Blocked until owner approves OntarioMD certification work.

---

## STOP GATE: agents must read this first

**Phase 0 is complete.** **Phase 1 is complete.** Do not start **Phase 2+** until the owner explicitly says to proceed (e.g. "Start Phase 2").

Until then: documentation upkeep only; no new Ontario implementation without approval.

After approval: work on **`dev`** first; deploy only with owner approval per **`DEPLOYMENT-PIPELINE.md`**.

---

## Baseline (post Phase 0, June 23, 2026)

| Category | ~% in place | Strongest | Weakest |
|----------|-------------|-----------|---------|
| Foundational (HL7/FHIR, security, privacy) | 55–65% | Compliance pack, append-only audit, patient-access logging | ONE ID, legal review, third-party audit |
| EHR connectivity (OLIS, HRM, PrescribeIT, etc.) | 5–15% | `lib/interop/`, integration stubs | No live provincial pipes |
| Functional clinical | 75–85% | Charting, orders, portal; CPP, i4C, consents live | Full OntarioMD functional conformance |
| Certification process | 5–10% | Gap report, evidence binder, readiness pages | OntarioMD application not started |

**Sources:** Owner-provided OntarioMD spec summary (June 23, 2026); internal codebase review (`lib/interop/`, `lib/integrations/`, clinical modules, billing stubs).

---

## Owner goal vs agent capability (confidence)

**Question:** Can agents deliver this with **minimal supervision** in **one day**?

| Confidence | Meaning |
|------------|---------|
| **Very high (90%+)** | Agent can finish alone; owner only reviews at end |
| **High (75–89%)** | Agent finishes; owner approves 1–2 wording or policy choices |
| **Medium (50–74%)** | Needs owner input on scope or legal sign-off |
| **Low (&lt;50%)** | Requires external partners (OntarioMD, Infoway, MOH): not a code sprint |

### Tier A: Today sprint (agent-led, minimal owner input)

| # | Deliverable | Agent confidence | Owner input needed |
|---|-------------|------------------|-------------------|
| A1 | **Gap report + prioritized backlog** (`docs/ONTARIOMD-GAP-REPORT.md`) | Very high | None: review optional |
| A2 | **Compliance & privacy pack** (PHIPA, breach, custody, DR summary) in `docs/compliance/` | High | Optional legal review later |
| A3 | **Audit hardening**: append-only rules, broader patient-access logging (migration + hooks) | Very high | None |
| A4 | **FHIR R4 Patient chart export**: Bundle from existing chart using `lib/interop/fhir/` | High | None |
| A5 | **CPP-aligned patient summary**: single view/tab mapping Ontario CPP fields from existing data | High | None |
| A6 | **Data residency statement**: document Supabase/Netlify Canada posture + checklist | High | Confirm prod Supabase region if not CA |

**Tier A same-day score impact:** ~+5 to +8 points (foundational + functional evidence).

### Tier B: Today if time remains (one quick owner choice)

| # | Deliverable | Agent confidence | Owner input needed |
|---|-------------|------------------|-------------------|
| B1 | **Consent capture**: DB table + minimal UI (portal + chart sharing) | High | Pick 2–3 consent types (e.g. portal, data sharing, research) |
| B2 | **i4C-style indicator mapping**: map preventive gaps → Ontario primary-care indicators | Medium-high | Confirm indicator list priority (top 10 OK) |
| B3 | **OHIP claim file draft generator**: structured export from billing drafts (not live MCEDT) | Medium-high | None for format; live submit needs MOH later |

**Tier B same-day score impact:** ~+3 to +5 additional points.

### Tier C: Not today (blocked without partners)

| Item | Why not same-day |
|------|------------------|
| Live OLIS / HRM / PrescribeIT / DHDR / ConnectingOntario | Credentials + OntarioMD/Infoway agreements |
| ONE ID login | Ontario identity enrollment |
| Live MCEDT submission | MOH billing credentials |
| Certification application / reference site | OntarioMD vendor process |

**Ceiling without Tier C:** ~55–60% internal readiness evidence: not certified EMR status.

---

## Today sprint: execution order (after owner approval)

1. A1 Gap report (anchors all other work)  
2. A3 Audit hardening (quick win, high audit value)  
3. A4 FHIR export + tests  
4. A5 CPP-aligned summary view  
5. A2 Compliance pack (can parallel with code)  
6. A6 Data residency doc  
7. B1–B3 if clock time remains  
8. `npm run check` + targeted tests  
9. Update **`AGENT-HANDOVER.md`** session log  
10. Commit to **`dev`**: deploy only when owner approves  

---

## Acceptance criteria (today)

- [ ] Gap report lists every OntarioMD category with status: **Done / Partial / Missing / Blocked**
- [ ] Compliance folder exists with owner-readable policies (no secrets)
- [ ] Audit logs cannot be updated/deleted by app users (append-only at DB level)
- [ ] Staff can export a patient chart as FHIR R4 Bundle (download or API)
- [ ] Patient chart has CPP-aligned summary section
- [ ] All changes on `dev`; handover updated; no production deploy without owner OK

---

## What the owner should NOT need to do during the sprint

- Write code or SQL  
- Configure Netlify/Supabase (unless agent hits a missing env var)  
- Contact OntarioMD (that comes after internal evidence pack is ready)

## What the owner MAY need to do (5–15 minutes total)

- Say **“Implement the Ontario-ready plan”** to start  
- Optionally pick consent types (Tier B1)  
- Optionally approve deploy to dev/staging when agent asks  
- Schedule legal review of compliance docs later (not blocking sprint)

---

## Related files (existing)

| Path | Role |
|------|------|
| **`docs/ONTARIO-EMR-READINESS-REPORT.md`** | Written investor readiness report |
| **`docs/ONTARIO-EMR-IMPLEMENTATION-PLAN.md`** | Full task backlog (Phases 0–8) |
| **`ontario-readiness.html`** | Shareable investor page (`/ontario-readiness`) |
| `lib/interop/` | HL7 v2, FHIR R4, DICOMweb, terminology |
| `lib/integrations/IntegrationService.js` | Outbound queue (OLIS/rx/claims stubs) |
| `config/provinces/on.json` | Ontario integration placeholders |
| `config/interoperability.ontario.example.json` | Example OLIS/FHIR config |
| `supabase/migrations/*audit_logs*` | Audit schema |
| `js/preventive.js` | Preventive gaps (i4C mapping source) |

---

## After today (owner decision, not automatic)

1. Contact **emr@ontariomd.com** for vendor certification path  
2. Begin Infoway/Ontario Health partner discussions for OLIS, HRM, PrescribeIT  
3. Legal review of compliance pack  
4. Reference site selection for stage 5 validation  

---

**Maintainer:** Update this doc when sprint completes or scope changes. Link from **`AGENT-HANDOVER.md`** § OntarioMD readiness.
