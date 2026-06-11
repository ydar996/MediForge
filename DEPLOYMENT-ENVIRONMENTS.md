# Deployment Environments

This project uses three Netlify sites and three Git branches to separate
development, staging, and production deployments.

## Agent / deploy communication

When reporting deploy status or next steps to the project owner: **plain English only** (layman's terms). No jargon-heavy handoffs. Do the deploy yourself when approved; don't dump long checklists on the user. Full rule: **`AGENT-HANDOVER.md`** → “Communication with the user.”

## Branches and Sites

- `dev` → `mediforge-dev` (development)
- `staging` → `mediforge-staging` (pre-production)
- `main` → `mediforge` (production)

Each Netlify site is linked to the same GitHub repo and deploys only its
assigned branch.

## Promotion Flow

1. Develop on `dev` (feature branches merge into `dev`).
2. Promote `dev` → `staging` via PR.
3. Validate on staging.
4. Promote `staging` → `main` via PR for production release.

## Separate Supabase projects (Dev + Staging + Prod)

Step-by-step setup for **creating** Dev and Staging Supabase projects when Production already exists: [`docs/SUPABASE-DEV-STAGING-SETUP.md`](docs/SUPABASE-DEV-STAGING-SETUP.md).

## Environment Variables

Keep environment variables consistent across sites unless a value must differ
by environment. Recommended approach:

- Copy production variables to staging/dev as a baseline.
- Override only what must be different (e.g., logging levels or feature flags).
- Keep Supabase credentials aligned to the intended environment.

## Netlify Settings Checklist

- Continuous deployment linked to the correct branch.
- Build settings match existing production settings (no build command if not
  needed).
- Functions enabled and available (secure Supabase proxy relies on this).
- Deploy previews allowed for non-production branches as needed.

## Operational Notes

- Do not deploy from local zip uploads to production.
- Use pull requests for promotions to keep history clean and reviewable.

## Deployment Practice

**Always deploy all changes in a single deployment.** Do not split changes across multiple deploys. There is no benefit to staging or incremental deploys.

**Use comprehensive deployment notes.** The deploy message should clearly describe what changed and why. Example format:

```
[Area]: [Summary of changes]
- [Specific change 1]
- [Specific change 2]
- [Files or features affected]
```

This helps with troubleshooting, rollback decisions, and audit trails.
