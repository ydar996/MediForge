# MediForge documentation index

Master catalog of project documentation. **Agents:** start with **`AGENT-HANDOVER.md`**. **Owners:** start with **`START-HERE.md`** or **`GO-LIVE-GUIDE.md`**.

**Last updated:** June 2026

**Agent rule (mandatory):** Every session that changes the product must update related docs, record a session log in **`AGENT-HANDOVER.md`**, and after production promote verify live URLs match git. Full companion set and checklist: **`AGENT-HANDOVER.md`** Rule #3 and **`docs/MEDIFORGE-PRODUCT-RULES.md`** §9.

---

## Start here

| Document | Who | Description |
|----------|-----|-------------|
| **[START-HERE.md](../START-HERE.md)** | Owner + agents | One-page orientation |
| **[AGENT-HANDOVER.md](../AGENT-HANDOVER.md)** | AI agents | **Living handover**: update every session |
| **[GO-LIVE-GUIDE.md](../GO-LIVE-GUIDE.md)** | Owner | First Netlify + Supabase setup (~30 min) |
| **[README.md](../README.md)** | Everyone | Repo intro |

---

## Product and architecture

| Document | Description |
|----------|-------------|
| **[docs/MEDIFORGE-AT-A-GLANCE.md](MEDIFORGE-AT-A-GLANCE.md)** | Short plain-language overview (internal) |
| **[docs/MEDIFORGE-CAPABILITIES-GUIDE.md](MEDIFORGE-CAPABILITIES-GUIDE.md)** | **Full capabilities guide: companion to /capabilities page** |
| **[capabilities.html](../capabilities.html)** | **Shareable public page with screenshots (mediforge.netlify.app/capabilities)** |
| **[docs/PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md)** | Stack, folders, auth, billing, functions |
| **[CRITICAL-WORKFLOWS.md](../CRITICAL-WORKFLOWS.md)** | Regression test scenarios |
| **[HANDOVER-NOTE-HYBRID-ARCHITECTURE.md](../HANDOVER-NOTE-HYBRID-ARCHITECTURE.md)** | Supabase + localStorage design |
| **[HYBRID-ARCHITECTURE-AUDIT.md](../HYBRID-ARCHITECTURE-AUDIT.md)** | Hybrid architecture audit |
| **[ABSTRACTION-LAYER-EXPLAINED.md](../ABSTRACTION-LAYER-EXPLAINED.md)** | Data abstraction layer |
| **[docs/ONTARIOMD-READINESS-PLAN.md](ONTARIOMD-READINESS-PLAN.md)** | **OntarioMD gap baseline, today sprint tiers, STOP gate: read before Ontario work** |
| **[docs/ONTARIO-EMR-READINESS-REPORT.md](ONTARIO-EMR-READINESS-REPORT.md)** | **Written investor readiness report (keep in sync with /ontario-readiness)** |
| **[docs/ONTARIO-EMR-IMPLEMENTATION-PLAN.md](ONTARIO-EMR-IMPLEMENTATION-PLAN.md)** | **Full Ontario EMR task backlog with milestones (Phases 0–8)** |
| **[ontario-readiness.html](../ontario-readiness.html)** | **Investor readiness webpage (mediforge.netlify.app/ontario-readiness)** |
| **[investor-letter.html](../investor-letter.html)** | **Investor update letter (mediforge.netlify.app/investor-letter)** |
| **[docs/investor/INVESTOR-LETTER-2026-06.md](investor/INVESTOR-LETTER-2026-06.md)** | **Written investor letter (keep in sync with /investor-letter and /ontario-readiness)** |
| **[docs/ONTARIO-EMR-SPEC-TRACEABILITY.md](ONTARIO-EMR-SPEC-TRACEABILITY.md)** | **Ontario EMR spec traceability matrix** |
| **[docs/PHASE-1-CORE-STANDARDS-COMPLETION.md](PHASE-1-CORE-STANDARDS-COMPLETION.md)** | **Phase 1 completion evidence and task status** |
| **[docs/PHASE-3-MCEDT-CLAIMS-COMPLETION.md](PHASE-3-MCEDT-CLAIMS-COMPLETION.md)** | **Phase 3 MCEDT claims completion evidence** |
| **[docs/PHASE-2-CERTIFICATION-EVIDENCE-COMPLETION.md](PHASE-2-CERTIFICATION-EVIDENCE-COMPLETION.md)** | **Phase 2 certification evidence (software we can do)** |
| **[docs/PHASE-4-OLIS-LAB-DESK-COMPLETION.md](PHASE-4-OLIS-LAB-DESK-COMPLETION.md)** | **Phase 4 OLIS lab desk completion evidence** |
| **[claims-queue.html](../claims-queue.html)** | **OHIP claims queue** |
| **[remittance-reconcile.html](../remittance-reconcile.html)** | **Remittance reconciliation** |
| **[mcedt-settings.html](../mcedt-settings.html)** | **MCEDT / OHIP billing settings** |
| **[consent-management.html](../consent-management.html)** | **Organization consent registry** |
| **[docs/ONTARIOMD-GAP-REPORT.md](ONTARIOMD-GAP-REPORT.md)** | **Full OntarioMD gap status by category** |
| **PrescribeIT / eRx desk** | Partial (~35%) | `/erx-queue`, MedicationRequest workflow; live pipe blocked |
| **[erx-queue.html](../erx-queue.html)** | **Provincial eRx queue (PrescribeIT-ready)** |
| **[docs/PHASE-5-PRESCRIBEIT-COMPLETION.md](PHASE-5-PRESCRIBEIT-COMPLETION.md)** | **Phase 5 software completion notes** |
| **[docs/PHASE-6-IMAGING-DESK-COMPLETION.md](PHASE-6-IMAGING-DESK-COMPLETION.md)** | **Phase 6 imaging desk completion notes** |
| **[docs/TERMINOLOGY-MAPPING-STATUS.md](TERMINOLOGY-MAPPING-STATUS.md)** | LOINC/pCLOCD/CCDD mapping vs licensed datasets |
| **`docs/compliance/`** | PHIPA/privacy/residency docs (Phases 0–5 software complete) |
| **`lib/interop/`** | HL7 v2, FHIR R4, lab/imaging adapters (Ontario connectivity foundation) |

---

## Deployment and operations

| Document | Description |
|----------|-------------|
| **[RELEASE-NOTES-2026-06-PHASE0.md](../RELEASE-NOTES-2026-06-PHASE0.md)** | **Phase 0 Ontario EMR promotion notes (dev → staging → prod)** |
| **[DEPLOYMENT-ENVIRONMENTS.md](../DEPLOYMENT-ENVIRONMENTS.md)** | dev / staging / main branches and Netlify sites |
| **[DEPLOYMENT-HANDOVER.md](../DEPLOYMENT-HANDOVER.md)** | Deploy process summary |
| **[DEPLOYMENT-GUIDE.md](../DEPLOYMENT-GUIDE.md)** | General deployment guide |
| **[DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md)** | Pre-deploy checklist |
| **[NETLIFY-SITE-IDS.txt](../NETLIFY-SITE-IDS.txt)** | Site IDs (fill in after site creation) |
| **[AUTO-DEPLOY-SETUP.md](../AUTO-DEPLOY-SETUP.md)** | GitHub → Netlify auto deploy |
| **[docs/SUPABASE-DEV-STAGING-SETUP.md](SUPABASE-DEV-STAGING-SETUP.md)** | Separate Supabase per environment |
| **[docs/ROTATE-SUPABASE-KEYS-AFTER-EXPOSURE.md](ROTATE-SUPABASE-KEYS-AFTER-EXPOSURE.md)** | Key rotation procedure |
| **[LOCAL-TESTING-GUIDE.md](../LOCAL-TESTING-GUIDE.md)** | Local dev server testing |

---

## Security

| Document | Description |
|----------|-------------|
| **[SECURITY-POLICY.md](../SECURITY-POLICY.md)** | Security policy |
| **[CYBERSECURITY-STATUS-REPORT.md](../CYBERSECURITY-STATUS-REPORT.md)** | Status report |
| **[docs/SECURITY-COMPONENT-AND-EXPOSURE-AUDIT.md](SECURITY-COMPONENT-AND-EXPOSURE-AUDIT.md)** | Component audit |
| **[INCIDENT-RESPONSE-PLAYBOOK.md](../INCIDENT-RESPONSE-PLAYBOOK.md)** | Incident response |
| **[HTTPS-SETUP-GUIDE.md](../HTTPS-SETUP-GUIDE.md)** | HTTPS / custom domain |

---

## Feature guides (staff / admin)

| Document | Topic |
|----------|-------|
| **[docs/USER-DOCUMENTATION-INDEX.md](USER-DOCUMENTATION-INDEX.md)** | End-user doc hub |
| **[docs/USER-MANUAL.md](USER-MANUAL.md)** | User manual (markdown) |
| **[BILLING-SYSTEM-GUIDE.md](../BILLING-SYSTEM-GUIDE.md)** | Billing |
| **[PLATFORM-ADMIN-GUIDE.md](../PLATFORM-ADMIN-GUIDE.md)** | Platform administration |
| **[INPATIENT-SETUP-GUIDE.md](../INPATIENT-SETUP-GUIDE.md)** | In-patient module |
| **[HOW-TO-USE-OFFLINE-CAPABILITIES.md](../HOW-TO-USE-OFFLINE-CAPABILITIES.md)** | Offline mode |
| **[docs/PATIENT-BULK-IMPORT-GUIDE.md](PATIENT-BULK-IMPORT-GUIDE.md)** | CSV/Excel mass patient registration |
| **[docs/PHARMACY-INVENTORY-TESTING-GUIDE.md](PHARMACY-INVENTORY-TESTING-GUIDE.md)** | Pharmacy inventory |
| **[PRESCRIPTION-SYSTEM-STATUS.md](../PRESCRIPTION-SYSTEM-STATUS.md)** | Prescriptions |
| **[PATIENT-PORTAL-STATUS.md](../PATIENT-PORTAL-STATUS.md)** | Patient portal |
| **[docs/PATIENT-PORTAL-ORDER-RESULTS.md](PATIENT-PORTAL-ORDER-RESULTS.md)** | Portal lab/imaging order status and results release |
| **`js/diagnostic-order-picker.js`** | Shared lab/imaging order UI (search, category filter, per-test notes) |
| **`config/diagnostic-imaging-catalog.json`** | Platform imaging study catalog (synced into `js/patients.js`) |
| **`config/diagnostic-lab-catalog.json`** | Platform lab test catalog (synced into `js/patients.js`) |
| **`config/ohip-imaging-fee-crosswalk.json`** | CPT → OHIP imaging fee codes (X/G/J); edit then `npm run build:diagnostic-catalog` |
| **`config/ohip-lab-fee-crosswalk.json`** | CPT → Ontario Laboratory Services L-codes; source: `scripts/ohip-lab-fee-crosswalk-data.mjs` |
| **`config/lab-code-map-canada.json`** | Auto-generated multi-province fee map (ON/BC/AB/QC) |

---

## SQL and database

| Location | Description |
|----------|-------------|
| **`supabase/migrations/`** | Versioned schema migrations |
| **`sql-scripts/`** | Ad-hoc SQL (diagnostics, one-off fixes) |
| **`sql-scripts/create-platform-admin.sql`** | Platform admin setup |
| **`scripts/export-database-schema.ps1`** | Export schema from existing Supabase |
| **[SQL-SCRIPTS-TO-RUN.md](../SQL-SCRIPTS-TO-RUN.md)** | When to run specific scripts |

---

## Legacy handover notes (from fork)

Use when debugging specific subsystems. May reference orgs or IDs that **do not exist** on a fresh MediForge database.

| Document | Topic |
|----------|-------|
| HANDOVER-INSTRUCTIONS-CLINICAL-NOTE-FIX.md | Clinical notes |
| HANDOVER-INSTRUCTIONS-PRESCRIPTION-MODAL.md | Prescription modal |
| HANDOVER-LEGAL-AGREEMENTS-FIX.md | Legal agreements |
| HANDOVER-HYBRID-ARCHITECTURE-FIXES.md | Hybrid fixes |
| HANDOVER_MESSAGING_SYSTEM.md | Messaging |
| AGENT-HANDOVER-CYBERSECURITY-2025.md | Cybersecurity session |
| AGENT-HANDOVER-LAB-TEMPLATES-2025.md | Lab templates |

---

## Scripts reference

| Command | Purpose |
|---------|---------|
| `npm run check` | Pre-deploy HTML/JS guards |
| `npm run build:diagnostic-catalog` | Rebuild lab/imaging catalogs + OHIP crosswalks + `lab-code-map-canada.json` |
| `npm run check:lab-codes` | Verify `lab-code-map-canada.json` matches catalog |
| `npm run inject:supabase-env` | Build supabase-env.js from env vars |
| `npm run manual:screenshots` | Capture user manual screenshots |
| `.\scripts\export-database-schema.ps1` | Export DB schema for new Supabase project |

---

## Maintaining this index

**Mandatory for agents** (see **`AGENT-HANDOVER.md`** § “How to keep this document alive”):

When you add or change features, docs, or deployment steps in a session:

1. Add or update a row in **this file** for any new or renamed doc.
2. Add a **Session log** entry in **`AGENT-HANDOVER.md`**.
3. Update **`docs/PROJECT-OVERVIEW.md`** when architecture or key modules change.
4. Update **`docs/USER-MANUAL.md`** and **`user-manual.html`** together when clinic staff will see the change.
