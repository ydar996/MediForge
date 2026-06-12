# MediForge deployment pipeline

**Purpose:** Safe path from your computer → GitHub → Netlify, with **dev** and **staging** before **production**.  
**Modeled on:** EHR-Africa pipeline in `Documents\Ehr-Africa` (same three-branch pattern).

**GitHub:** https://github.com/ydar996/MediForge

**Simple owner setup (dev + staging):** **[SETUP-DEV-STAGING-SIMPLE.md](SETUP-DEV-STAGING-SIMPLE.md)** ← start here if you are not technical.

---

## Plain English: how changes should flow

```
You edit code on your PC
    → commit
    → push to GitHub (dev branch first)
    → Netlify builds the matching site automatically
    → test on dev URL
    → promote to staging (PR) → test again
    → promote to production (PR) → live site updates
```

**Three copies of the app, three safety nets:**

| Step | Git branch | Website | Database |
|------|------------|---------|----------|
| 1. Try it | `dev` | https://mediforge-dev.netlify.app | Dev Supabase (empty test data) |
| 2. Final check | `staging` | https://mediforge-staging.netlify.app | Staging Supabase (empty test data) |
| 3. Live users | `main` | https://mediforge.netlify.app | Production Supabase (MediForge-Prod) |

This minimizes production downtime: you break things on **dev**, not on the live clinic site.

---

## Keep repos in sync (mandatory)

These three must match after every meaningful change:

| Layer | What “in sync” means |
|-------|----------------------|
| **Your PC** | `git status` → clean; commits saved locally |
| **GitHub** | `git push` succeeded; `Your branch is up to date with 'origin/...'` |
| **Netlify** | Site built from the branch you intended (via Git push or approved CLI deploy) |

### Agent rule

Before finishing any session with code changes, agents **must**:

1. `git add` relevant files (never secrets: `.env`, service role keys, `supabase-credentials*.txt`).
2. `git commit` with a clear message.
3. `git push origin <branch>` (usually `dev` first, not `main`).
4. Deploy only with **explicit owner approval** (“Yes, deploy” / “I approve”).
5. Confirm: `git status` clean and remote matches.

### Owner habit (after dev/staging sites exist)

```powershell
cd C:\Users\yinka\Documents\MediForge
git checkout dev
git add -A
git commit -m "Short description of what changed"
git push origin dev
```

Netlify deploys **mediforge-dev** automatically. No manual `netlify deploy` needed when Continuous Deployment is linked.

### Check you succeeded

```powershell
git status
git log --oneline -3
```

Browser: open the GitHub repo and confirm your latest commit appears.

---

## Current setup status (update as you go)

| Item | Status |
|------|--------|
| Production Netlify | **Live** — `mediforge` → https://mediforge.netlify.app |
| Production site ID | `06ef6cf9-280d-4d5f-97a2-7cbfd7586b7a` (see `NETLIFY-SITE-IDS.txt`) |
| Production Supabase | **MediForge-Prod** (project ref `fyhtdkotlyyqyrjabojw`) |
| GitHub repo | **Connected** — https://github.com/ydar996/MediForge |
| Git branch `main` | Exists; tracks production |
| Git branch `dev` | **Create** (see setup below) |
| Git branch `staging` | **Create** (see setup below) |
| Netlify `mediforge-dev` | **Create and link to `dev` branch** |
| Netlify `mediforge-staging` | **Create and link to `staging` branch** |
| Dev / Staging Supabase | **Create** — see `docs/SUPABASE-DEV-STAGING-SETUP.md` |

---

## One-time setup: dev + staging (owner checklist)

Do this once. Same pattern as EHR-Africa.

### A. Create Git branches

```powershell
cd C:\Users\yinka\Documents\MediForge
git checkout main
git pull origin main
git checkout -b dev
git push -u origin dev
git checkout -b staging
git push -u origin staging
git checkout dev
```

### B. Create Netlify sites

In [app.netlify.com](https://app.netlify.com) (or CLI):

1. **Site:** `mediforge-dev` → link to GitHub repo **MediForge**, branch **`dev`**
2. **Site:** `mediforge-staging` → link to GitHub repo **MediForge**, branch **`staging`**
3. **Site:** `mediforge` (production) → link to branch **`main`** if not already linked

Copy each **Site ID** into **`NETLIFY-SITE-IDS.txt`**.

Build settings (all three sites):

- Build command: `node scripts/inject-supabase-env.cjs && npm run check`
- Publish directory: `.`

### C. Supabase env vars (each Netlify site)

On **each** site → **Site configuration → Environment variables**:

| Variable | Dev site | Staging site | Production site |
|----------|----------|--------------|-----------------|
| `SUPABASE_URL` | Dev project URL | Staging project URL | Prod project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Dev publishable key | Staging publishable key | Prod publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev secret key | Staging secret key | Prod secret key |

Create Dev + Staging Supabase **projects** (not new organizations): stay in the existing **MediForge** org → **New project** twice. See **`SETUP-DEV-STAGING-SIMPLE.md`** (owner) or **`docs/SUPABASE-DEV-STAGING-SETUP.md`** (detail).

In each Supabase project → **Authentication → URL configuration**, add that environment’s Netlify URL (e.g. `https://mediforge-dev.netlify.app`).

### D. Test the pipeline

1. Make a tiny change on `dev`, commit, `git push origin dev`
2. Open https://mediforge-dev.netlify.app — confirm deploy finished
3. Open a PR **dev → staging** on GitHub, merge, confirm staging site
4. When ready for live users: PR **staging → main**, merge, confirm production

---

## Promotion flow (no downtime strategy)

1. **Develop on `dev`** — all feature work lands here first.
2. **PR `dev` → `staging`** — review diff on GitHub; test on staging URL.
3. **PR `staging` → `main`** — production release; Netlify rebuilds production.

**Do not** push directly to `main` for routine changes once this pipeline is live.

**Do not** use manual CLI deploy to production except emergencies — it bypasses GitHub history and can desync repos.

---

## Deploy approval (agents)

- “Deploy” alone is **not** approval.
- Wait for: *“Yes, deploy”*, *“I approve”*, *“Go ahead and deploy”*.
- **Dev first.** Staging and production need **separate** approval each time.
- **One deploy per batch** with a detailed message.

---

## CLI deploy (when CD is unavailable or emergency)

Site IDs: **`NETLIFY-SITE-IDS.txt`**

```powershell
cd C:\Users\yinka\Documents\MediForge
netlify link --id SITE-ID-FROM-NETLIFY-SITE-IDS.txt
netlify deploy --prod --dir . --message "Detailed summary of all changes"
```

Or:

```powershell
.\deploy-with-message.ps1 -SiteId SITE-ID -Prod -MessageOverride "Detailed summary"
```

After any CLI deploy to production: **commit and push to `main`** so GitHub matches what is live.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| **`AGENT-HANDOVER.md`** | Living agent rules (includes repo sync) |
| **`DEPLOYMENT-ENVIRONMENTS.md`** | Branch ↔ site mapping |
| **`DEPLOYMENT-HANDOVER.md`** | URLs, env vars, checklists |
| **`docs/SUPABASE-DEV-STAGING-SETUP.md`** | Create Dev/Staging databases |
| **`CRITICAL-WORKFLOWS.md`** | Test before promoting to production |
| **`NETLIFY-SITE-IDS.txt`** | Authoritative Netlify site IDs |
