# Deployment Environments

This project uses three Netlify sites and three Git branches to separate
development, staging, and production deployments: same pattern as EHR-Africa.

**Full pipeline (setup + git sync rules):** **[DEPLOYMENT-PIPELINE.md](DEPLOYMENT-PIPELINE.md)**

## Agent / deploy communication

When reporting deploy status or next steps to the project owner: **plain English only** (layman's terms). No jargon-heavy handoffs. Do the deploy yourself when approved; don't dump long checklists on the user. Full rule: **`AGENT-HANDOVER.md`** → “Communication with the user.”

## Branches and Sites

| Git branch | Netlify site | URL |
|------------|--------------|-----|
| `dev` | `mediforge-dev` | https://mediforge-dev.netlify.app |
| `staging` | `mediforge-staging` | https://mediforge-staging.netlify.app |
| `main` | `mediforge` | https://mediforge.netlify.app |

Site IDs: **`NETLIFY-SITE-IDS.txt`**

Each Netlify site is linked to the same GitHub repo (https://github.com/ydar996/MediForge) and deploys only its assigned branch.

## Keep repos in sync (mandatory)

After code changes, agents **must**:

1. Commit to git with a clear message.
2. Push to the correct branch on GitHub (`dev` first for new work).
3. Deploy only with explicit owner approval.
4. Confirm `git status` is clean and remote is up to date.

**Preferred deploy:** `git push` → Netlify Continuous Deployment builds the site.  
**Avoid:** CLI `netlify deploy` to production for routine work: it can leave GitHub out of sync with what is live.

If you CLI-deploy anyway, **commit and push to `main` immediately** after.

## Promotion Flow

1. Develop on `dev` (feature branches merge into `dev`).
2. Promote `dev` → `staging` via PR on GitHub.
3. Validate on https://mediforge-staging.netlify.app
4. Promote `staging` → `main` via PR for production release.

This reduces production risk: test twice before live users see changes.

## Minimizing downtime

- Static site deploys on Netlify are **atomic**: the new version swaps in when the build finishes; no manual server restart.
- Never push untested changes directly to `main`.
- Run **`CRITICAL-WORKFLOWS.md`** scenarios on staging before promoting to production.
- Use **separate Supabase projects** for dev/staging so tests never touch production patient data.

## Separate Supabase projects (Dev + Staging + Prod)

Step-by-step setup: [`docs/SUPABASE-DEV-STAGING-SETUP.md`](docs/SUPABASE-DEV-STAGING-SETUP.md).

| Environment | Supabase |
|-------------|----------|
| Production | MediForge-Prod (`fyhtdkotlyyqyrjabojw`) |
| Staging | Separate project (create per guide) |
| Dev | Separate project (create per guide) |

Each Netlify site gets its own `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

## Environment Variables

Keep environment variables consistent across sites unless a value must differ by environment.

- Copy production variable **names** to staging/dev as a baseline.
- Override **values** so each site points at its own Supabase project.
- Never commit secrets to git.

## Netlify Settings Checklist

- Continuous deployment linked to the correct branch per site.
- Build command: `node scripts/inject-supabase-env.cjs && npm run check`
- Publish directory: `.`
- Functions enabled (secure Supabase proxy relies on this).

## Operational Notes

- Do not deploy from local zip uploads to production.
- Use pull requests for promotions to keep history clean and reviewable.
- Do not split one batch of work across multiple production deploys.

## Deployment Practice

**Always deploy all changes in a single deployment per environment.** Use comprehensive deploy messages:

```
[Area]: [Summary of changes]
- [Specific change 1]
- [Specific change 2]
- [Files or features affected]
```
