# MediForge Agent Handover (living document)

**Last updated:** June 11, 2026  
**Purpose:** Primary handover for every AI agent and developer. **Read this first.**  
**Project folder:** `C:\Users\yinka\Documents\MediForge`

---

## How to keep this document alive

Every agent that makes meaningful changes **must** update this file before finishing:

1. Set **Last updated** to today’s date.
2. Add a short entry under **Session log** (what changed, why, what the owner must do next).
3. If Netlify sites were created, update **`NETLIFY-SITE-IDS.txt`** with real site IDs.
4. If Supabase setup steps changed, update **`GO-LIVE-GUIDE.md`** and **`docs/PROJECT-OVERVIEW.md`**.
5. Do **not** paste secrets (passwords, service role keys, Netlify tokens) into any doc.

---

## Communication with the user (mandatory)

**Always explain things in layman's terms.** The project owner is not asking for jargon, long checklists they must execute themselves, or consultant-style prose.

- Say **what** changed, **why** it matters, and **what they need to do next** — in plain English.
- When you can **do the work yourself** (deploy, commit, run checks), **do it** — don’t hand back a long DIY checklist unless they asked to do it themselves.
- Keep answers **short and direct**.
- Technical detail belongs in code comments or docs — not in every chat reply.

---

## What MediForge is

MediForge is a **multi-tenant electronic health record (EMR)** platform: clinic staff manage patients, appointments, clinical notes, billing, pharmacy, labs, in-patient care, and platform administration.

It was **forked from a prior codebase in June 2026**, fully rebranded, and pointed at a **new, empty Supabase project**. It is **not** the same product deployment as any legacy project.

### Product rules (non-negotiable)

| Rule | Detail |
|------|--------|
| **Product name** | MediForge only. No “EHR Africa” branding in user-facing copy or new docs. |
| **Default currency** | **CAD** (Canadian Dollar) for new orgs and platform fallbacks. Orgs can override (e.g. Mecure → NGN). |
| **Organizations** | Database starts **empty**. **Mecure Clinics** is registered first via `/register`. **All other orgs must self-register** — do not seed demo orgs in production. |
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
| `js/supabase-env.js` | Browser Supabase URL + publishable key (placeholders until go-live) |
| `js/supabase-client.js` | Shared client; no hardcoded production credentials |
| `js/universal-data-loader.js` | Loads org data from Supabase into localStorage |
| `js/billing.js` | `getDefaultCurrency()` → CAD fallback |
| `js/register-handler.js` | Org registration; creates org if new |
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

Use **`NETLIFY-SITE-IDS.txt`** after sites exist. Until then, create sites per **`GO-LIVE-GUIDE.md`**.

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

Site IDs: fill in **`NETLIFY-SITE-IDS.txt`** when created.  
Promotion: `dev` → `staging` → `main` via PR. Details: **`DEPLOYMENT-ENVIRONMENTS.md`**.

**Current git state:** Single `main` branch with initial commit (`173f3ac`). Dev/staging branches and Netlify sites are **not created yet** unless the owner has done go-live steps.

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
netlify status
netlify link --id YOUR-SITE-ID-FROM-NETLIFY-SITE-IDS.txt
netlify deploy --prod --dir . --message "Summary: ..."
.\deploy-with-message.ps1 -SiteId YOUR-SITE-ID -Prod -MessageOverride "..."
git restore .netlify/   # if pre-push hook complains about .netlify churn
```

---

## Documentation map

| Document | Audience | Purpose |
|----------|----------|---------|
| **`AGENT-HANDOVER.md`** (this file) | AI agents | Living handover — update every session |
| **`GO-LIVE-GUIDE.md`** | Owner | First-time Netlify + Supabase setup |
| **`docs/DOCUMENTATION-INDEX.md`** | Everyone | Master index of all docs |
| **`docs/PROJECT-OVERVIEW.md`** | Developers | Technical deep dive |
| **`docs/MEDIFORGE-PRODUCT-RULES.md`** | Agents + owner | CAD, orgs, branding rules |
| **`DEPLOYMENT-ENVIRONMENTS.md`** | DevOps | Branch/site promotion |
| **`CRITICAL-WORKFLOWS.md`** | QA / agents | Regression scenarios before deploy |
| **`docs/USER-DOCUMENTATION-INDEX.md`** | Clinic staff | End-user help topics |

Legacy handover notes from the fork (hybrid architecture, prescriptions, legal agreements, etc.) remain in `HANDOVER-*.md` files — use when debugging those areas.

---

## Security reminders

- RLS on all tenant tables; review in Supabase Dashboard regularly.
- CSP + security headers in `netlify.toml`; violations → `/.netlify/functions/csp-report`.
- Never put service role key in front-end JS or git.
- Key rotation: **`docs/ROTATE-SUPABASE-KEYS-AFTER-EXPOSURE.md`**.

---

## Known fork carryovers (do not confuse with MediForge policy)

The codebase still contains **legacy implementation details** from the source fork:

- `js/mediforge-org-patient-id.js` — org-specific patient ID prefixes (`window.mf*` API).
- Migrations referencing orgs like MFASC / MIN-* — apply only if those orgs exist in **this** database (they won’t on a fresh MediForge DB).
- Mecure test patient ID examples (e.g. `MEC0006`) in old handover docs — valid only after Mecure is registered and has data.

On a **fresh MediForge database**, ignore org-specific migration scripts unless the owner explicitly creates those organizations.

---

## Session log

### June 11, 2026 — Initial MediForge fork

- Cloned codebase to `Documents/MediForge`; removed backups, node_modules, `.git` history from source.
- Rebranded ~354 files from legacy name to **MediForge**; scrubbed old Supabase URLs/keys from app code.
- Default currency set to **CAD** (`js/billing.js`, `js/currency-converter.js`, registration, platform plans, etc.).
- Added Canada to country list; neutralized Africa-only marketing copy on public pages.
- Created **`GO-LIVE-GUIDE.md`**, `scripts/export-database-schema.ps1`, `sql-scripts/create-platform-admin.sql`.
- Fresh git repo: `main` @ `173f3ac`.
- **Owner next steps:** Run go-live guide; create Netlify sites; fill `NETLIFY-SITE-IDS.txt`; register Mecure Clinics.

### June 11, 2026 — Legacy `ehr` name scrub

- Clarified for owner: literal **“ehr-africa”** text was already removed; remaining hits were generic **EHR** (Electronic Health Record) or internal **`ehr*`** code prefixes from the fork.
- Renamed `js/ehr-org-patient-id.js` → `js/mediforge-org-patient-id.js`; `window.ehr*` → `window.mf*`.
- Renamed `diagnose-ehr-app.html` → `diagnose-mediforge-app.html`.
- Updated cache keys (`mediforge-cache`), session cookies, dashboard title, and 88+ files via `scripts/scrub-ehr-legacy-names.ps1`.
- **Still OK to keep:** “Electronic Health Record (EHR)” as a medical acronym on marketing pages — that is not “EHR Africa” branding.

---

**Next agent:** Read this file → **`docs/MEDIFORGE-PRODUCT-RULES.md`** → **`GO-LIVE-GUIDE.md`** if setup is incomplete. Follow deployment approval rules. Update this session log before you finish.
