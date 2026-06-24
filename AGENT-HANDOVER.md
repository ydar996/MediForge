# MediForge Agent Handover (living document)

**Last updated:** June 2026  
**Purpose:** Primary handover for every AI agent and developer. **Read this first.**  
**Project folder:** `C:\Users\yinka\Documents\MediForge`

---

## Rule #1: Talk to the owner in plain English (always)

The project owner is **not** a developer. **Every** reply to them: questions, plans, explanations, status updates, technical topics: must use the **simplest layman's terms** first.

| Do | Don't |
|----|-------|
| Explain like talking to a smart friend who doesn't work in tech | Lead with jargon (JSONB, migration, RLS, idempotent, schema) |
| Say what it means for the clinic in everyday words | Assume they know git, SQL, Netlify, or the terminal |
| Use a short analogy when a concept is new | Dump acronyms without a one-sentence plain meaning |
| Do the work yourself when you can | Hand back long DIY checklists unless they asked |

Technical detail belongs in code comments and docs for developers: **not** as the first thing in chat with the owner. See also **`docs/MEDIFORGE-PRODUCT-RULES.md`** §6 and **`docs/PROJECT-OVERVIEW.md`** → “Talking to the project owner”.

---

## Rule #2: No em dashes in user-facing text (always)

The owner does **not** want em dashes (—) in the app, docs, or agent replies. Use **colons**, commas, or separate sentences instead.

| Do | Don't |
|----|-------|
| “Lab orders: 176+ tests” | “Lab orders — 176+ tests” |
| “June 23, 2026: Readiness report published” | “June 23, 2026 — Readiness report published” |
| “Reviewed: results available” | “Reviewed — results available” |

**Scope:** All user-visible HTML, patient/staff UI strings in JS, owner-facing docs, marketing pages, and handover text.

**Enforcement:** `npm run check` includes `check:no-em-dash`. To fix bulk issues: `node scripts/replace-em-dashes.mjs`.

See **`docs/MEDIFORGE-PRODUCT-RULES.md`** §8.

---

## Rule #3: Keep all project documentation in sync (always)

Code, config, and docs ship together. **Every session that changes the product must update related documentation before you finish**: not only when the owner asks.

| Do | Don't |
|----|-------|
| Update the written report when you change its shareable webpage (e.g. `ontario-readiness.html` ↔ `ONTARIO-EMR-READINESS-REPORT.md`) | Ship code or UI changes and leave companion docs at old percentages or "coming soon" |
| Add a session log entry and bump **Last updated** in this file | Assume the owner will notice stale docs later |
| Update **`docs/DOCUMENTATION-INDEX.md`** when you add or rename docs | Skip docs because "it's just a small fix" |
| Update user manual (md + html) when staff-visible workflows change | Update only the file you edited |

**Minimum checklist (every session with code or config changes):**

1. **`AGENT-HANDOVER.md`**: session log + **Last updated** date.
2. **`docs/DOCUMENTATION-INDEX.md`**: new/changed doc rows.
3. **Companion pairs** (keep in sync):
   - `/ontario-readiness` ↔ `docs/ONTARIO-EMR-READINESS-REPORT.md`
   - `/capabilities` ↔ `docs/MEDIFORGE-CAPABILITIES-GUIDE.md`
   - `user-manual.html` ↔ `docs/USER-MANUAL.md`
   - `docs/ONTARIO-EMR-IMPLEMENTATION-PLAN.md` task status when you complete plan items
   - `docs/ONTARIOMD-GAP-REPORT.md` when Ontario readiness scores or gaps change
4. **`docs/PROJECT-OVERVIEW.md`**: when architecture, auth, or major modules change.

Full checklist: **§ How to keep this document alive** below. See also **`docs/MEDIFORGE-PRODUCT-RULES.md`** §9.

---

## How to keep this document alive

Documentation is part of the deliverable. **Every agent that makes meaningful changes in a session must update project docs before finishing**: not only when the owner asks. This is **Rule #3** above; the checklist below expands it.

### Always update (every session with code or config changes)

1. **`AGENT-HANDOVER.md` (this file)**
   - Set **Last updated** to today’s date.
   - Add a short **Session log** entry: what changed, why, what the owner should do next.
2. **`docs/DOCUMENTATION-INDEX.md`**
   - Add or update a row for any new or renamed doc under `docs/` or top-level `*.md`.
   - Bump **Last updated** if you changed the index.
3. **`docs/PROJECT-OVERVIEW.md`**
   - Update when architecture, key files, auth flow, or major modules change.

### Update when the change is user-facing (staff will see it)

4. **`docs/USER-MANUAL.md`** and **`user-manual.html`**: keep both in sync (same steps, plain language).
5. **`docs/user-manual/HOW-TO-UPDATE-MANUAL.md`**: note new screenshot slot numbers if UI changed.
6. **Feature guide**: add or update a focused doc when helpful (e.g. `docs/PATIENT-BULK-IMPORT-GUIDE.md`).

### Update when deployment or environment changes

7. **`NETLIFY-SITE-IDS.txt`**: if sites were created or IDs changed.
8. **`GO-LIVE-GUIDE.md`**: if first-time setup steps changed.
9. **`DEPLOYMENT-PIPELINE.md`** or **`PROMOTE-RELEASE-WALKTHROUGH.md`**: if promotion or env rules changed.

### Rules

- Do **not** paste secrets (passwords, service role keys, Netlify tokens) into any doc.
- Do **not** finish a session with shipped code and stale handover/docs: the next agent and the owner depend on them.
- When you change a **shareable webpage**, update its **written companion doc** in the same session (see Rule #3 companion pairs).
- If you only answered a question with **no** code or config changes, doc updates are optional.

---

## Communication with the user (mandatory)

This repeats **Rule #1** so agents do not miss it mid-document.

- **Always** use the simplest layman's terms: including when explaining feasibility, database design, imports, or “how would this work?”
- Say **what** changed, **why** it matters for the clinic, and **what they should do next**.
- **Never** give jargon-first answers. If a technical word is unavoidable, define it in one plain sentence immediately after.
- When you can **do the work yourself** (deploy, commit, run checks, capture screenshots), **do it**: do not hand back a long DIY checklist unless they asked to do it themselves.
- Keep answers **short and direct**. Use numbered steps for anything they must click or type.
- For **user manual screenshots**: point them to **`docs/user-manual/GET-THE-PICTURES.md`** (Snipping Tool method first; automatic script second).

---

## What MediForge is

MediForge is a **multi-tenant electronic health record (EMR)** platform: clinic staff manage patients, appointments, clinical notes, billing, pharmacy, labs, in-patient care, and platform administration.

It was **forked from a prior codebase in June 2026**, fully rebranded, and pointed at a **new, empty Supabase project**. It is **not** the same product deployment as any legacy project.

### Product rules (non-negotiable)

| Rule | Detail |
|------|--------|
| **Product name** | MediForge only. No “EHR Africa” branding in user-facing copy or new docs. |
| **Default currency** | **CAD** (Canadian Dollar) for new orgs and platform fallbacks. Orgs can override (e.g. Mecure → NGN). |
| **Organizations** | Database starts **empty**. **Mecure Clinics** is registered first via `/register`. **All other orgs must self-register**: do not seed demo orgs in production. |
| **Data isolation** | Each org sees only its own data (Supabase RLS + `organization_id`). |
| **Secrets** | Browser uses publishable key in `js/supabase-env.js` (or Netlify build injection). Service role key **only** in Netlify env + Functions. |

Full product rules: **`docs/MEDIFORGE-PRODUCT-RULES.md`**

---

## Architecture (30-second version)

```
Browser (HTML + JS pages)
    ↕  Supabase JS client (anon/publishable key)
Supabase (Postgres + Auth + Storage bucket patient-documents)
    ↕  service role (server only)
Netlify Functions (secure-supabase.js, reminders, legal agreements, CSP report)
```

- **Hybrid data:** Supabase-first; localStorage fallback when offline. See **`HANDOVER-NOTE-HYBRID-ARCHITECTURE.md`**.
- **Auth:** Clinic users → Supabase Auth + `users` table. Platform admin → `/platform-login` + `platform_admins` table.
- **Build:** `netlify.toml` runs `node scripts/inject-supabase-env.cjs && npm run check` on deploy.

Key files:

| File | Role |
|------|------|
| `js/supabase-env.js` | Browser Supabase URL + publishable key (Netlify build inject; may be partial if URL masked at build) |
| `js/supabase-client.js` | Shared client; loads `get-supabase-browser-config` when static config invalid |
| `netlify/functions/get-supabase-browser-config.js` | Runtime Supabase URL + publishable key for browser |
| `scripts/resolve-supabase-url.cjs` | Build/function helper: `SUPABASE_PROJECT_REF` → `https://{ref}.supabase.co` |
| `js/universal-data-loader.js` | Loads org data from Supabase into localStorage |
| `js/billing.js` | `getDefaultCurrency()` → CAD fallback |
| `js/register-handler.js` | Org registration; creates org if new |
| `js/bulk-patient-import.js` | CSV/Excel bulk patient import (`/bulk-patient-import`) |
| `netlify/functions/secure-supabase.js` | Privileged RPC / admin operations |
| `supabase/migrations/` | ~100 SQL migrations (schema history) |

---

## Deployment rules (non-negotiable)

### 0. NEVER deploy without explicit approval

- “Deploy” or “deploy to dev” alone is **not** approval.
- Wait for: *“Yes, deploy”*, *“I approve”*, *“Go ahead and deploy”*.
- Summarize what will ship, then **stop** until they confirm.

### 1. Dev first

Deploy to **dev** Netlify site first. Staging and production need **separate** explicit approval each time.

### 2. One deployment per batch of work

Batch changes into **one** deploy with a **detailed** `--message` listing all tasks.

### 3. Site IDs

Use **`NETLIFY-SITE-IDS.txt`** after sites exist. Full pipeline: **`DEPLOYMENT-PIPELINE.md`**.

### 4. Keep git, GitHub, and Netlify in sync (mandatory)

**After every session that changes code**, agents must leave the repo in a synced state:

| Step | Action |
|------|--------|
| 1 | `git add` changed files: **never** commit secrets (`.env`, service role keys, `supabase-credentials*.txt`, live tokens) |
| 2 | `git commit -m "..."` with a clear message |
| 3 | `git push origin <branch>`: default **`dev`** for new work; **`main`** only when owner approved a production release |
| 4 | Deploy (if approved) via **git push** to the matching branch when Netlify CD is linked, or CLI with site ID |
| 5 | Verify: `git status` clean; `Your branch is up to date with 'origin/...'` |

**Never finish a session** with uncommitted work on disk while telling the owner “it’s deployed.”  
**If you CLI-deploy to production**, also **commit and push to `main`** so GitHub matches what is live.

**Preferred deploy path (once dev/staging sites exist):**

```powershell
git push origin dev      # → mediforge-dev
git push origin staging  # → mediforge-staging (after PR)
git push origin main     # → mediforge production (after PR + approval)
```

Do **not** rely on manual `netlify deploy` for routine releases: it desyncs GitHub from the live site.

### Netlify CLI auth

- Prefer `netlify login` (browser). Never commit `nfp_...` tokens.
- `NETLIFY_AUTH_TOKEN` only in user machine env or GitHub Actions secrets.

---

## Environments (target setup)

| Git branch | Netlify site (name) | Purpose |
|------------|---------------------|---------|
| `dev` | `mediforge-dev` | Daily development |
| `staging` | `mediforge-staging` | Pre-production validation |
| `main` | `mediforge` | Production |

Site IDs: **`NETLIFY-SITE-IDS.txt`**.  
Promotion: `dev` → `staging` → `main` via PR. Full setup: **`DEPLOYMENT-PIPELINE.md`**.

**Current git state (June 16, 2026):**

- GitHub: https://github.com/ydar996/MediForge
- Branches **`dev`**, **`staging`**, **`main`**: aligned after promotions; push `dev` first for new work
- **Netlify site IDs**: see **`NETLIFY-SITE-IDS.txt`** (dev, staging, production all live)
- **Supabase per site:** Dev, Staging, and Prod each have their own project; set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and **`SUPABASE_PROJECT_REF`** (build inject when URL is masked)
- Production: https://mediforge.netlify.app: site ID `06ef6cf9-280d-4d5f-97a2-7cbfd7586b7a`
- Dev: https://mediforge-dev.netlify.app: site ID `d15040f5-830c-49fc-bd54-10165abcc5e8`
- Staging: https://mediforge-staging.netlify.app: site ID `a0626083-1c07-436e-84a3-ca8555ca632e`

---

## Go-live (owner-facing summary)

Full steps: **`GO-LIVE-GUIDE.md`** (~30 minutes).

1. Create new Supabase project (Canada Central recommended).
2. Export schema from legacy DB with `scripts/export-database-schema.ps1` (structure only, no patient data).
3. Run schema in new project; create `patient-documents` bucket; run `sql-scripts/create-platform-admin.sql`.
4. Paste Supabase URL + publishable key into `js/supabase-env.js`.
5. `netlify sites:create` + `netlify deploy --prod --dir .`
6. Set Netlify env vars: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; redeploy.
7. Register **Mecure Clinics** at `/register`.

---

## Local testing

```powershell
cd C:\Users\yinka\Documents\MediForge
# Edit js/supabase-env.js with dev Supabase credentials first
python -m http.server 5500
# Open http://localhost:5500/login.html
```

```powershell
npm run check          # icon + patient-identity guards (runs on Netlify build too)
npm run inject:supabase-env   # regenerate supabase-env.js from env vars
```

---

## Quick commands

```powershell
# Repo sync check
git status
git log --oneline -3

# Push to environment (preferred when Netlify CD is linked)
git push origin dev
git push origin staging
git push origin main

# CLI deploy (emergency or before CD linked: use site ID from NETLIFY-SITE-IDS.txt)
netlify status
netlify link --id 06ef6cf9-280d-4d5f-97a2-7cbfd7586b7a   # production example
netlify deploy --prod --dir . --message "Summary: ..."
.\deploy-with-message.ps1 -SiteId YOUR-SITE-ID -Prod -MessageOverride "..."

git restore .netlify/   # if pre-push hook complains about .netlify churn
```

---

## Documentation map

| Document | Audience | Purpose |
|----------|----------|---------|
| **`AGENT-HANDOVER.md`** (this file) | AI agents | Living handover: update every session |
| **`GO-LIVE-GUIDE.md`** | Owner | First-time Netlify + Supabase setup |
| **`docs/DOCUMENTATION-INDEX.md`** | Everyone | Master index of all docs |
| **`docs/PROJECT-OVERVIEW.md`** | Developers | Technical deep dive |
| **`docs/MEDIFORGE-PRODUCT-RULES.md`** | Agents + owner | CAD, orgs, branding rules |
| **`DEPLOYMENT-PIPELINE.md`** | Owner + agents | Git sync, dev/staging/prod promotion, one-time setup |
| **`DEPLOYMENT-ENVIRONMENTS.md`** | DevOps | Branch/site mapping |
| **`CRITICAL-WORKFLOWS.md`** | QA / agents | Regression scenarios before deploy |
| **`docs/USER-DOCUMENTATION-INDEX.md`** | Clinic staff | End-user help topics |

Legacy handover notes from the fork (hybrid architecture, prescriptions, legal agreements, etc.) remain in `HANDOVER-*.md` files: use when debugging those areas.

---

## Security reminders

- RLS on all tenant tables; review in Supabase Dashboard regularly.
- CSP + security headers in `netlify.toml`; violations → `/.netlify/functions/csp-report`.
- Never put service role key in front-end JS or git.
- Key rotation: **`docs/ROTATE-SUPABASE-KEYS-AFTER-EXPOSURE.md`**.

---

## Known fork carryovers (do not confuse with MediForge policy)

The codebase still contains **legacy implementation details** from the source fork:

- `js/mediforge-org-patient-id.js`: org-specific patient ID prefixes (`window.mf*` API).
- Migrations referencing orgs like MFASC / MIN-*: apply only if those orgs exist in **this** database (they won’t on a fresh MediForge DB).
- Mecure test patient ID examples (e.g. `MEC0006`) in old handover docs: valid only after Mecure is registered and has data.

On a **fresh MediForge database**, ignore org-specific migration scripts unless the owner explicitly creates those organizations.

---

## Session log

### June 11, 2026: Initial MediForge fork

- Cloned codebase to `Documents/MediForge`; removed backups, node_modules, `.git` history from source.
- Rebranded ~354 files from legacy name to **MediForge**; scrubbed old Supabase URLs/keys from app code.
- Default currency set to **CAD** (`js/billing.js`, `js/currency-converter.js`, registration, platform plans, etc.).
- Added Canada to country list; neutralized Africa-only marketing copy on public pages.
- Created **`GO-LIVE-GUIDE.md`**, `scripts/export-database-schema.ps1`, `sql-scripts/create-platform-admin.sql`.
- Fresh git repo: `main` @ `173f3ac`.
- **Owner next steps:** Run go-live guide; create Netlify sites; fill `NETLIFY-SITE-IDS.txt`; register Mecure Clinics.

### June 11, 2026: Legacy `ehr` name scrub

- Clarified for owner: literal **“ehr-africa”** text was already removed; remaining hits were generic **EHR** (Electronic Health Record) or internal **`ehr*`** code prefixes from the fork.
- Renamed `js/ehr-org-patient-id.js` → `js/mediforge-org-patient-id.js`; `window.ehr*` → `window.mf*`.
- Renamed `diagnose-ehr-app.html` → `diagnose-mediforge-app.html`.
- Updated cache keys (`mediforge-cache`), session cookies, dashboard title, and 88+ files via `scripts/scrub-ehr-legacy-names.ps1`.
- **Still OK to keep:** “Electronic Health Record (EHR)” as a medical acronym on marketing pages: that is not “EHR Africa” branding.

### June 12, 2026: Production live, GitHub connected, deployment pipeline docs

- Production live at https://mediforge.netlify.app (Netlify site ID recorded in `NETLIFY-SITE-IDS.txt`).
- GitHub repo https://github.com/ydar996/MediForge on branch `main`.
- Canada-first marketing and CAD subscription pricing deployed.
- Added **`DEPLOYMENT-PIPELINE.md`** (mirrors EHR-Africa dev → staging → main flow).
- **Mandatory agent rule:** always commit + push; keep PC, GitHub, and Netlify in sync.
- **Owner next steps:** create `dev` + `staging` branches, Netlify sites, and Dev/Staging Supabase projects per **`DEPLOYMENT-PIPELINE.md`**.

### June 13, 2026: User manual update + plain-language rule

- Updated **`user-manual.html`** and **`docs/USER-MANUAL.md`** for June 2026 features (Canada registration, race, ICD-10-CA, manual meds, patient intake).
- Added **`docs/user-manual/GET-THE-PICTURES.md`**: plain steps for manual screenshots (Snipping Tool) or automatic capture.
- Strengthened **Communication with the user** in this file: simplest layman's terms always; point to GET-THE-PICTURES for manual images.
- **Owner next steps:** Save PNGs into `docs/user-manual/images/` (see GET-THE-PICTURES.md), then deploy so `/user-manual` shows pictures on production.

### June 14–15, 2026: Preventive gaps, user manual screenshots, login config fix

- **Preventive care gaps:** Mark Addressed + proof attachments (`js/preventive.js`, Supabase `unstructured_records`).
- **User manual:** Sections 8–9 (prescriptions, preventive gaps); screenshots `05`, `19`, `20`.
- **Login regression:** Netlify build was writing masked `SUPABASE_URL` (`****************e.co`) into `js/supabase-env.js` on redeploy. Fixed with `SUPABASE_PROJECT_REF` + `scripts/resolve-supabase-url.cjs` + `get-supabase-browser-config` + login wait for async client (`6d05572`). Promoted dev → staging → production.
- **Netlify env:** Each site needs `SUPABASE_PROJECT_REF` (dev `hhxsmenuphzfxvgwxvut`, staging `imfgrcbpjvoerfhhckiy`, prod `fyhtdkotlyyqyrjabojw`).

### June 16, 2026: Bulk patient import

- **`/bulk-patient-import`**: CSV/Excel mass registration with flexible headers, optional legacy Patient IDs, preview, Supabase-first save.
- Template: **`data/patient-bulk-import-template.csv`**; guide: **`docs/PATIENT-BULK-IMPORT-GUIDE.md`**.
- Dashboard button under **Patient Management**.
- Deployed dev → staging → production (this session).

### June 17, 2026: Promote bulk import + intake fixes to staging and production

- Merged `dev` → `staging` → `main` (commit `c32debe`).
- Deployed **mediforge-staging** and **mediforge** (production).
- **Live:** https://mediforge-staging.netlify.app and https://mediforge.netlify.app

### June 17, 2026: Bulk import: map columns mode

- **`/bulk-patient-import`**: **Map my columns** mode: match foreign spreadsheet headers, extras → patient Notes.
- Smarter parsing: `Age (DOB)` like `63 (1962-11-27)`, `Health Ins. #`, `Health Card Type`, `Record ID`.
- **Keep existing Patient IDs** optional; when off, new org numbers assigned and old file ID stored in Notes.

### June 17, 2026: Rule #1 plain language (reinforced)

- Added **Rule #1: Talk to the owner in plain English** at the top of this handover (before other sections).
- **`docs/PROJECT-OVERVIEW.md`**: new “Talking to the project owner” section.
- **`docs/MEDIFORGE-PRODUCT-RULES.md`**: new §6 Communication with the project owner.

### June 17, 2026: Mandatory documentation upkeep (spelled out)

- Expanded **§ How to keep this document alive** with explicit checklist: handover, documentation index, project overview, user manual (md + html), feature guides, deployment docs.
- Synced **`DEPLOYMENT-PIPELINE.md`**, **`docs/DOCUMENTATION-INDEX.md`**, and **`START-HERE.md`** to reference the same rule.

### June 17, 2026: Patient practice fields + profile persistence (dev deploy)

- **Six optional patient fields:** Enrolled Physician, Status Enrolment, Show Email on Consults, Date Joined Practice, Health Insurance Card Effective Date, Assigned Physician MRP: on add/edit patient forms and bulk import.
- **Date Joined Practice:** auto-set on new registration; existing patients backfilled from registration date via migration.
- **Profile fix:** medical license and personal phone now persist through registration, login, and edit profile.
- **Migration:** `supabase/migrations/20260616140000_patient_enrolment_practice_fields.sql`: **must be run in dev Supabase SQL Editor** before new fields save to the database.
- Pushed to **`dev`** → https://mediforge-dev.netlify.app

### June 17, 2026: Promote practice fields + profile fix to staging and production

- **`fd2ef4d`** on `dev`, `staging`, and `main` (dashboard: bulk import after Setup Patient Portal).
- **Staging:** https://mediforge-staging.netlify.app
- **Production:** https://mediforge.netlify.app
- **Owner:** Run migration `20260616140000_patient_enrolment_practice_fields.sql` on **staging** and **production** Supabase if not done yet (dev first).

### June 18, 2026: Schedule by provider + patient portal lab/results/pickup (dev → staging → production)

- **Commit `9135454`** on `dev`, `staging`, and `main` (includes prior `bf9ff49` schedule-by-provider on all branches).
- **Schedule:** Per-provider daily grid on `/schedule` (By Provider button + provider filter on Daily View).
- **Patient portal: Results (`/patient-results`):**
  - Status **Order Sent** when order goes to external lab/imaging (no in-house lab assumption).
  - **Test Completed: Awaiting Provider Review** when results are back but doctor has not reviewed.
  - **Reviewed: results available** after doctor marks reviewed; patient can open results + provider comments.
  - **Print / view order copy** for lab and imaging requisitions anytime.
- **Patient portal: Medications:** **I picked this up** fixed (legacy `RX…` ids, not only UUID); records `patient_pickup_at`; clinic notified via portal message; pharmacy Filled tab shows pickup status.
- **SQL migrations (owner ran on dev Supabase):** `20260618160000`, `20260618170000`, `20260618180000`: run same three on **staging** and **production** Supabase if not done yet.
- **URLs:** Dev https://mediforge-dev.netlify.app · Staging https://mediforge-staging.netlify.app · Prod https://mediforge.netlify.app
- **Owner next steps:** Hard-refresh portal after deploy; run three portal SQL files on staging/prod Supabase; smoke-test Results + Medications on dev.

### June 18, 2026 (later): Visit summaries auto-publish (dev → staging → production)

- **Commit `2174d2d`**: Patient portal **Visit Summaries** no longer empty after concluded visits.
- **Auto-publish** when staff **checks out** an appointment, **locks** a clinical note, or opens a concluded visit note (backfill).
- **Portal fallback** lists completed/checked-out appointments even before a full summary row exists.
- **Owner next steps:** Hard-refresh `/patient-visit-summaries`; for existing patients with missing summaries, open their clinical note once or re-check-out; ensure `20260617140000_office_visit_summaries.sql` ran on each Supabase environment.

### June 22, 2026: Lab & imaging order picker: categories, search, notes, expanded imaging catalog (dev → staging → production)

- **Imaging catalog:** 67 studies (was 39): added Ontario requisition gaps (contrast echo, sinus/shoulder/elbow X-rays, combined abdomen+pelvis US, transvaginal pelvis, MSK ultrasound, arterial ABI, PFT, Holter, etc.) with **CPT/OHIP** codes via `npm run build:diagnostic-catalog`.
- **Categories:** Imaging grouped like the paper form (Cardiology, X-Ray, Ultrasound, CT, MRI, Mammography, etc.). Lab orders already had category headers: unchanged data model.
- **UI:** `select-lab-orders.html` and `select-imaging-orders.html`: **search bar**, **category filter**, **ordering note** per test (saved on the order and printed on requisitions). Shared module: **`js/diagnostic-order-picker.js`**.
- **No SQL required**: doctor notes live inside existing `orders.selected_items` JSON.
- **Docs:** `AGENT-HANDOVER.md`, `docs/DOCUMENTATION-INDEX.md`, `docs/PROJECT-OVERVIEW.md`, `docs/USER-MANUAL.md`, `user-manual.html`.
- **URLs:** Dev https://mediforge-dev.netlify.app · Staging https://mediforge-staging.netlify.app · Prod https://mediforge.netlify.app
- **Owner next steps:** Hard-refresh after deploy; from a clinical note open **Order Labs** or **Order Imaging** and try search + optional note; no Supabase scripts for this feature.

### June 22, 2026 (later): Ontario lab & imaging fee codes fixed (L-codes + proper imaging codes) (dev → staging → production)

- **Problem the owner spotted:** Almost all imaging studies showed the same code **G004**; dozens of lab tests showed **G482** (physician venipuncture: wrong schedule). Codes came from category placeholders in `scripts/build-diagnostic-catalog.mjs`, not Ontario fee schedules.
- **Fix: imaging:** `config/ohip-imaging-fee-crosswalk.json`: CPT → proper OHIP professional codes (X-, G-, J- per study type). **G004 removed** from imaging map.
- **Fix: labs:** `config/ohip-lab-fee-crosswalk.json` + `scripts/ohip-lab-fee-crosswalk-data.mjs`: **168 CPTs + 11 panels** → Ontario **Laboratory Services L-codes** (Schedule 22, licensed lab appendix, 2026 SOB-LS bulletins). **99 distinct L-codes**; **0** lab rows on G482. Quantiferon-TB shows **Private pay** (not OHIP-insured at community labs).
- **Build:** `npm run build:diagnostic-catalog` regenerates `ohip-cpt-crosswalk-reference.json`, `lab-code-map-canada.json`, and syncs `js/patients.js` / `js/pricing.js`. Tests: `tests/billing/generate-lab-code-map.test.js`.
- **No SQL required**: config/JS only.
- **Owner next steps:** Hard-refresh (Ctrl+F5) on Order Labs / Order Imaging; spot-check CBC **L393**, TSH **L341**, chest X-ray **X091**, ECG **G313**.

---

## Billing fee codes: agent checklist (learned June 2026)

When adding or expanding **lab** or **imaging** catalog tests, agents **must not** rely on category default codes (e.g. `G482`, `J307`, `G004`). Those are placeholders and will show wrong codes to clinicians.

| Step | Action |
|------|--------|
| 1 | Map each new CPT to the **correct schedule**: labs → Ontario **L-codes** (`config/ohip-lab-fee-crosswalk.json`); imaging → OHIP physician codes (`config/ohip-imaging-fee-crosswalk.json`). |
| 2 | Run `npm run build:diagnostic-catalog` and `npm run check:lab-codes`. |
| 3 | **Sanity-check diversity:** if >3 unrelated tests share one fee code, investigate before shipping. |
| 4 | Run `node --test tests/billing/generate-lab-code-map.test.js`. |
| 5 | Mark uninsured tests (e.g. Quantiferon) as `PRIVATE` in crosswalk: do not invent L-codes. |

**Owner handover hints that help agents:** (a) “Fee codes must match Ontario lab L-codes / imaging OHIP schedule, not one code for everything.” (b) “After catalog expansion, verify fee code column shows distinct codes per test.” (c) Point agents at this checklist and the two crosswalk JSON files.

---

## OntarioMD readiness (June 2026)

**Full plan:** **`docs/ONTARIOMD-READINESS-PLAN.md`**

**Current alignment:** ~55–65% documented Ontario readiness (Phases 0–3 software complete, June 2026). Clinical core strongest; live provincial connectivity still credential-gated (~5–15%).

### STOP GATE: mandatory for all agents

**Phases 0 and 1 are complete.** Do not start **Phase 2+** (OntarioMD certification path, live provincial pipes) until the owner explicitly says to proceed (e.g. **Start Phase 2**).

Documentation and planning before that phrase are OK. When phase status or readiness scores change, update **all companion pairs** in the same session (**Rule #3**).

### Historical: Tier A/B same-day sprint (Phase 0, completed June 2026)

When approved, agents executed **Tier A** first (gap report, audit hardening, FHIR export, CPP summary, compliance pack, data residency doc), then **Tier B** (consent, i4C mapping, OHIP claim file draft). See plan doc for acceptance criteria.

**Agent confidence with minimal owner supervision:**

| Tier | Can agent deliver today? | Owner input |
|------|--------------------------|-------------|
| **A** (gap report, audit, FHIR export, CPP, compliance skeleton, residency doc) | **Yes: very high (85–95%)** | Review at end; no blockers |
| **B** (consent, i4C map, claim file draft) | **Yes: high (75–85%)** if Tier A done | ~5 min on consent types |
| **C** (live OLIS, HRM, PrescribeIT, ONE ID, MCEDT live, certification) | **No: not in agent control** | External partners |

**Realistic same-day score lift:** +5 to +12 points (internal evidence), not full certification.

### Session log

### June 2026: Phase 2 + Phase 4 software complete (owner-approved)

- **Owner ask:** Do what we can on our own in Phase 2 and 4; update pages and docs; deploy dev, promote staging and production.
- **Phase 2 delivered:** Spec traceability matrix (`docs/ONTARIO-EMR-SPEC-TRACEABILITY.md`); `/ontario-self-assessment`; `/evidence-binder`; PHASE-2 completion doc.
- **Phase 4 delivered:** `olis-consent.js`, `lab-results-workflow.js`; `/lab-results-queue`, `/patient-identifiers`; HL7 export on external lab orders; consent gates (client + server); interop hooks (`ingestOruAndApply`, `exportLabOrderHl7`); tests `tests/interop/phase4-olis.test.js`.
- **Docs synced:** ontario-readiness ↔ readiness report (60–70%), capabilities, implementation plan, at-a-glance, documentation index, PHASE-4 completion doc.
- **Blocked:** OntarioMD Stage 5, live OLIS MLLP/FHIR, Infoway sandbox (partner credentials).
- **Owner SQL:** ensure Step 4 interop tables (`20260611000000`) exist before append-only interop migration on staging.

### June 2026: Phase 3 MCEDT claims complete

- **Owner ask:** Finish Phase 3; update all relevant pages, docs, handover, ontario readiness.
- **Phase 3 delivered:** `mcedt-format`, `mcedt-client`, `mcedt-cutoff`, `claims-workflow`; gateway actions; `/claims-queue`, `/remittance-reconcile`, `/mcedt-settings`; invoice XML/submit; `claims-batch-daily`; tests.
- **Docs synced:** implementation plan, readiness page/report, capabilities, PHASE-3 completion doc, handover, documentation index.
- **Blocked:** live MOH upload, remittance download, eligibility API (clinic credentials).
- **Production:** run `netlify deploy --prod` after promote if auto-deploy not connected.

### June 22, 2026: Rule #3 failure audit + companion doc catch-up

- **Owner ask:** Why Ontario readiness was not fully synced despite Rule #3; which other pages were stale.
- **Root cause:** Phase 1 session updated code and some docs but did not verify every companion pair end-to-end before marking docs complete. Partial `/ontario-readiness` update (header vs body) slipped through.
- **Fixed in this session:** `/ontario-readiness` + `ONTARIO-EMR-READINESS-REPORT.md` (prior commit `d9b3625`); `/capabilities` + `MEDIFORGE-CAPABILITIES-GUIDE.md`; `ONTARIOMD-GAP-REPORT.md`; `MEDIFORGE-AT-A-GLANCE.md`; `AGENT-HANDOVER.md` OntarioMD section and STOP GATE.
- **Still outstanding:** `docs/USER-MANUAL.md` + `user-manual.html` (no consent management, FHIR export, or CPP summary sections yet).

### June 2026: Phase 1 complete + investor letter

- **Owner ask:** Finish Phase 1; investor letter; update all relevant pages and docs.
- **Phase 1 delivered:** Gateway audit logging, FHIR `exportPatientBundle`/`fhirSearchPatients`, consent management (`/consent-management`), chart image viewer module, `interop_messages` append-only migration, PHIPA policy pack index, Phase 1 completion doc, tests.
- **Investor letter:** `/investor-letter` + `docs/investor/INVESTOR-LETTER-2026-06.md`.
- **Docs synced:** implementation plan, investor letter, capabilities (partial: readiness pair missed until owner follow-up), handover, documentation index, compliance README.
- **Owner SQL:** run `20260624100000_interop_messages_append_only.sql` per environment (if not done).
- **Phase 2:** OntarioMD certification path (owner approval for vendor contact).

### June 23, 2026: Phase 0 promoted dev → staging → production + capabilities update

- **Owner ask:** Promote missed updates to staging and production with detailed notes; confirm capabilities page current.
- **Git:** `dev`, `staging`, and `main` all promoted to `ca34046` (Phase 0). Capabilities + release notes committed after promotion.
- **Release notes:** `RELEASE-NOTES-2026-06-PHASE0.md` (full commit list, URLs, SQL steps, verification checklist).
- **Capabilities:** Added Ontario EMR Readiness section; synced `docs/MEDIFORGE-CAPABILITIES-GUIDE.md`.
- **Owner must run:** both `2026062320*` Supabase migrations on dev, staging, and prod SQL Editor.
- **Phase 1:** complete (June 2026). Phase 2 blocked until owner says to proceed.

### June 23, 2026 (later): Rule #3 documentation sync + stale Ontario docs fixed

- **Owner ask:** Keep all project documentation updated as changes are made; confirm handover includes this permanently.
- **Added:** **Rule #3: Keep all project documentation in sync** at top of `AGENT-HANDOVER.md` (companion page/doc pairs, minimum checklist).
- **Added:** **`docs/MEDIFORGE-PRODUCT-RULES.md`** §9 (same rule for developers).
- **Fixed:** `docs/ONTARIO-EMR-READINESS-REPORT.md` synced to `/ontario-readiness` (45–55%, Phase 0 complete).
- **Fixed:** `docs/ONTARIOMD-GAP-REPORT.md` executive summary and Phase 0 table marked complete.
- **Fixed:** `docs/ONTARIOMD-READINESS-PLAN.md` baseline updated post Phase 0.
- **Lesson:** Rule existed in § How to keep this document alive since June 17 but was not followed during Phase 0 and ontario-readiness deploy; Rule #3 makes it impossible to miss.

### June 23, 2026: Phase 0 Ontario EMR implementation sprint **completed** (owner approved start)

- **Owner said:** "Start implementation plan phase 0 first."
- **Delivered (all Phase 0 items):**
  - `docs/ONTARIOMD-GAP-REPORT.md` (full category status)
  - `docs/compliance/` pack (PHIPA, breach, custody, DR, data residency)
  - Migrations: `20260623200000_audit_logs_append_only.sql`, `20260623210000_patient_consents.sql`
  - FHIR export: `lib/interop/fhir/patient-chart-bundle.js`, `js/fhir-patient-export.js`, tests
  - CPP summary: `/cpp-patient-summary` + `js/cpp-patient-summary.js`
  - Consents UI: `/patient-consents` + `js/patient-consent.js`
  - i4C mapping: `js/i4c-indicator-map.js`
  - OHIP claim draft export: `js/ohip-claim-export.js` + invoice-details button
  - Patient chart access audit: `js/patient-access-audit.js`
  - Patient chart nav: CPP, FHIR, Consents buttons on `patient-details.html`
- **Owner must run in Supabase SQL Editor (dev, then staging, then prod):** both `2026062320*` migrations above.
- **Phase 1 blocked** until owner says to proceed.
- **Git:** commit `a5ce7ad` on `dev` (26 files, +2716 lines).
- **Deploy:** Netlify dev draft live at `https://6a3b35f806e4c50665ca006a--mediforge.netlify.app` (June 23, 2026). Run migrations before testing consents/RPC audit on live DB.

### June 23, 2026 (later): Ontario readiness webpage updated for Phase 0

- **Owner ask:** Reflect Phase 0 progress on `/ontario-readiness`.
- **Updated:** `ontario-readiness.html` (45–55% overall, Phase 0 complete callout, pillar and table updates).
- **Git:** commit `b183d13`; production deploy live.

### June 23, 2026 (later): Ontario readiness report docs, em dash policy, app-wide punctuation fix

- **Owner ask:** Keep written copy of investor readiness report; merge tasks into implementation plan; remove all em dashes from app (use colons); document rule so agents never need reminding.
- **Created:** `docs/ONTARIO-EMR-READINESS-REPORT.md` (written report companion to `/ontario-readiness`).
- **Created:** `docs/ONTARIO-EMR-IMPLEMENTATION-PLAN.md` (Phases 0–8 task backlog with status: Done / Partial / Not started / Blocked).
- **Created:** `scripts/replace-em-dashes.mjs`, `scripts/check-no-em-dash.mjs`; added `check:no-em-dash` to `npm run check`.
- **Updated:** **Rule #2** in this file (no em dashes); **`docs/MEDIFORGE-PRODUCT-RULES.md`** §8; **`docs/PROJECT-OVERVIEW.md`** writing style section; **`docs/DOCUMENTATION-INDEX.md`**.
- **Bulk fix:** Replaced em dashes with colons in **170 files** (HTML, JS UI strings, docs). Vendor minified JS excluded.
- **Owner next step:** Review `/ontario-readiness` and implementation plan; say **"Implement the Ontario-ready plan"** when ready to start Phase 0 sprint.

### June 23, 2026: OntarioMD readiness plan documented (implementation **blocked** pending owner go-ahead)

- **Owner ask:** Improve OntarioMD alignment score; wants work **today**, not 8 weeks; minimal supervision; **do not implement yet**.
- **Created:** `docs/ONTARIOMD-READINESS-PLAN.md` (tiers, confidence, acceptance criteria, STOP gate).
- **Created:** `docs/compliance/README.md` (placeholder for PHIPA/breach/custody/DR/residency docs).
- **Updated:** `AGENT-HANDOVER.md` (this section), `docs/DOCUMENTATION-INDEX.md`.
- **Baseline score:** ~35–45%; same-day target ~45–55% after Tier A+B sprint.
- **Owner next step:** Say **“Implement the Ontario-ready plan”** when ready to start. Optional: list 2–3 consent types for Tier B.

### June 23, 2026 (later): Plain-language features overview for non-technical readers

- **Created:** `docs/MEDIFORGE-AT-A-GLANCE.md`: what MediForge does today in everyday language (not a how-to manual).
- **Updated:** `docs/DOCUMENTATION-INDEX.md`, `docs/USER-DOCUMENTATION-INDEX.md`.
- **Similar existing docs:** `MEDIFORGE-BROCHURE-CONTENT.md` (marketing tables), `key-features.html` / `brochure.html` (web), `USER-MANUAL.md` (step-by-step staff guide).

### June 23, 2026: Full capabilities guide + shareable webpage

- **Created:** `docs/MEDIFORGE-CAPABILITIES-GUIDE.md`: most complete written feature list (June 2026).
- **Created:** `capabilities.html`: public shareable page with icons and **real app screenshots** from user manual.
- **Share URL:** https://mediforge.netlify.app/capabilities (after deploy).
- **vs brochure/key-features:** capabilities page is current; brochure is shorter marketing PDF; key-features is outdated vs 2026 build.
- **Owner next step:** Deploy to dev/staging/prod when ready; share `/capabilities` link with partners.

---

**Next agent:** Read this file → **`docs/MEDIFORGE-PRODUCT-RULES.md`** (Rules #1–#3) → **`GO-LIVE-GUIDE.md`** if setup incomplete. **OntarioMD:** Phases 0–3 software complete; **Phase 2 blocked** until owner approves. **Phase 4+** blocked similarly. Investor materials: `/investor-letter`, `/ontario-readiness`, `/capabilities`.
