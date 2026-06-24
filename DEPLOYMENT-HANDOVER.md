# MediForge deployment handover

**Last updated:** June 22, 2026

> **Primary handover:** **[AGENT-HANDOVER.md](AGENT-HANDOVER.md)** (living document: read and update every session).  
> **Pipeline (dev → staging → prod + git sync):** **[DEPLOYMENT-PIPELINE.md](DEPLOYMENT-PIPELINE.md)**  
> **First-time setup:** **[GO-LIVE-GUIDE.md](GO-LIVE-GUIDE.md)**  
> **Environments:** **[DEPLOYMENT-ENVIRONMENTS.md](DEPLOYMENT-ENVIRONMENTS.md)**

---

## How to talk to the user

Use layman's terms. Explain what changed, why it matters, and what you handled vs what only they can do (e.g. paste a key in Netlify). See **AGENT-HANDOVER.md** → “Communication with the user”.

---

## Deployment rules (mandatory)

1. **Never deploy without explicit approval** (“Yes, deploy” / “I approve”: not just “deploy”).
2. **Dev site first**: staging and production need separate approval each time.
3. **One deployment per batch**: detailed `--message` listing all changes.
4. **No secrets in git**: Supabase service role and Netlify tokens live in Netlify env vars only.
5. **Always keep repos in sync**: commit + push after changes; GitHub must match what is deployed.

---

## Production (live)

| Item | Value |
|------|--------|
| URL | https://mediforge.netlify.app |
| Netlify site | `mediforge` |
| Site ID | `06ef6cf9-280d-4d5f-97a2-7cbfd7586b7a` |
| Git branch | `main` |
| GitHub | https://github.com/ydar996/MediForge |
| Supabase | MediForge-Prod (ref `fyhtdkotlyyqyrjabojw`) |

---

## Dev and staging (set up next)

Follow **`DEPLOYMENT-PIPELINE.md`** § one-time setup:

- Create git branches `dev` and `staging`
- Create Netlify sites `mediforge-dev` and `mediforge-staging`
- Link each site to the matching GitHub branch
- Create Dev + Staging Supabase projects (`docs/SUPABASE-DEV-STAGING-SETUP.md`)
- Fill site IDs in **`NETLIFY-SITE-IDS.txt`**

---

## Netlify environment variables (required per site)

Set in **Site configuration → Environment variables** on **each** site:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL for **that** environment |
| `SUPABASE_PUBLISHABLE_KEY` | Browser-safe key (injected at build) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (Functions): **secret** |

After adding vars, trigger a deploy (push to branch or `netlify deploy --prod --dir .`).

---

## Deploy commands

**Preferred (when Netlify CD is linked):**

```powershell
git push origin dev       # or staging / main
```

**CLI (emergency or before CD linked):**

```powershell
cd C:\Users\yinka\Documents\MediForge
netlify link --id SITE-ID-FROM-NETLIFY-SITE-IDS.txt
netlify deploy --prod --dir . --message "Detailed summary of all changes"
```

Or:

```powershell
.\deploy-with-message.ps1 -SiteId SITE-ID -Prod -MessageOverride "Detailed summary"
```

After CLI production deploy: **commit and push to `main`** so GitHub stays in sync.

---

## Pre-deploy checklist

- [ ] `npm run check` passes
- [ ] Tested on dev/staging URL (once those exist)
- [ ] Owner gave **explicit** deploy approval
- [ ] Deploy message lists every task in the batch
- [ ] No secrets committed
- [ ] Changes committed and pushed to GitHub

Regression scenarios: **[CRITICAL-WORKFLOWS.md](CRITICAL-WORKFLOWS.md)**

---

## URLs

| Role | Path |
|------|------|
| Staff login | `/login` |
| Register new org | `/register` |
| Platform admin | `/platform-login` |
| Patient portal | `/patient-login` |

| Environment | Base URL |
|-------------|----------|
| Production | https://mediforge.netlify.app |
| Staging | https://mediforge-staging.netlify.app |
| Dev | https://mediforge-dev.netlify.app |

---

## Session notes

**June 18, 2026:** Portal order review workflow, prescription pickup fix, and order-sent status deployed (`9135454`) to dev, staging, and production. Production via `deploy-with-message.ps1`; dev/staging via GitHub CD. Owner: run SQL migrations `20260618160000`, `20260618170000`, `20260618180000` on staging + prod Supabase.

**June 12, 2026:** Production live; GitHub connected; deployment pipeline documented (`DEPLOYMENT-PIPELINE.md`); mandatory git sync rules added to agent handover. Dev/staging sites and branches still to be created.
