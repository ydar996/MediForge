# MediForge deployment handover

**Last updated:** June 11, 2026

> **Primary handover:** **[AGENT-HANDOVER.md](AGENT-HANDOVER.md)** (living document — read and update every session).  
> **First-time setup:** **[GO-LIVE-GUIDE.md](GO-LIVE-GUIDE.md)**.  
> **Environments:** **[DEPLOYMENT-ENVIRONMENTS.md](DEPLOYMENT-ENVIRONMENTS.md)**.

---

## How to talk to the user

Use layman's terms. Explain what changed, why it matters, and what you handled vs what only they can do (e.g. paste a key in Netlify). See **AGENT-HANDOVER.md** → “Communication with the user”.

---

## Deployment rules (mandatory)

1. **Never deploy without explicit approval** (“Yes, deploy” / “I approve” — not just “deploy”).
2. **Dev site first** — staging and production need separate approval each time.
3. **One deployment per batch** — detailed `--message` listing all changes.
4. **No secrets in git** — Supabase service role and Netlify tokens live in Netlify env vars only.

---

## MediForge-specific setup

Unlike a long-running production app, MediForge may still be on **initial go-live**:

| Item | Status |
|------|--------|
| Netlify sites | Create via GO-LIVE-GUIDE; record IDs in `NETLIFY-SITE-IDS.txt` |
| Supabase project | **New dedicated project** — not shared with legacy deployments |
| `js/supabase-env.js` | Placeholders until owner pastes URL + publishable key |
| Organizations | Empty until owner registers **Mecure Clinics** at `/register` |

---

## Netlify environment variables (required for full functionality)

Set in **Site configuration → Environment variables**:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Browser-safe key (injected at build) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (Functions) — **secret** |

Optional: `CRON_SECRET` / reminder secrets for appointment cron function.

After adding vars, redeploy: `netlify deploy --prod --dir .`

---

## Deploy commands

```powershell
cd C:\Users\yinka\Documents\MediForge
netlify status
netlify link --id YOUR-SITE-ID   # from NETLIFY-SITE-IDS.txt
netlify deploy --prod --dir . --message "Detailed summary of all changes"
```

Or:

```powershell
.\deploy-with-message.ps1 -SiteId YOUR-SITE-ID -Prod -MessageOverride "Detailed summary"
```

---

## Pre-deploy checklist

- [ ] `npm run check` passes
- [ ] Tested locally on affected pages (`python -m http.server 5500`)
- [ ] Owner gave **explicit** deploy approval
- [ ] Deploy message lists every task in the batch
- [ ] No secrets committed

Regression scenarios: **[CRITICAL-WORKFLOWS.md](CRITICAL-WORKFLOWS.md)**

---

## URLs (after go-live)

| Role | Path |
|------|------|
| Staff login | `/login` |
| Register new org | `/register` |
| Platform admin | `/platform-login` |
| Patient portal | `/patient-login` |

Production URL: `https://mediforge.netlify.app` (or the name chosen at `netlify sites:create`).

---

## Session note (June 11, 2026)

MediForge fork created; deployment docs consolidated into AGENT-HANDOVER, GO-LIVE-GUIDE, and this file. Netlify sites not yet created — follow go-live guide.
