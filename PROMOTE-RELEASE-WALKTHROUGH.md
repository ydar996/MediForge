# Promote Dev → Staging → Production (simple walkthrough)

**Situation:** All new work is on **`dev`** (22+ commits ahead of `staging` and `main` as of June 2026).  
**Rule:** Code and database must move together: deploy the app first, then run SQL on the **matching** Supabase project.

| Environment | Git branch | Website | Supabase project |
|-------------|------------|---------|------------------|
| Dev | `dev` | https://mediforge-dev.netlify.app | MediForge Dev |
| Staging | `staging` | https://mediforge-staging.netlify.app | MediForge Staging |
| Production | `main` | https://mediforge.netlify.app | MediForge-Prod |

---

## Part 1: Promote code to Staging (≈5 minutes)

### Option A: GitHub (no terminal)

1. Open https://github.com/ydar996/MediForge/compare/staging...dev
2. Click **Create pull request**
3. Title: `Promote dev to staging: registration, ICD-10, integrations, icon fixes`
4. **Merge** the PR
5. Wait for Netlify **mediforge-staging** deploy to finish (green check on GitHub or Netlify dashboard)
6. Open https://mediforge-staging.netlify.app and hard-refresh (Ctrl+F5)

### Option B: PowerShell (fastest if you already merged locally)

```powershell
cd C:\Users\yinka\Documents\MediForge
git checkout staging
git pull origin staging
git merge origin/dev
git push origin staging
```

Netlify deploys **mediforge-staging** automatically when `staging` updates.

---

## Part 2: Run SQL on Staging (≈20–30 minutes)

**Open:** Supabase → **MediForge Staging** → **SQL Editor**

Use the full checklist in **`SQL-RUN-PACKET-DEV-STAGING.md`**. Summary: run **in order**, one file per query, wait for Success:

| Step | File |
|------|------|
| 1 | `sql-scripts/RUN-PACKET-dev-staging-idempotent.sql` |
| 2 | `supabase/migrations/20251109000000_create_patient_intake_tables.sql` *(skip if table exists)* |
| 3 | `supabase/migrations/20260611170000_intake_approval_postal_demographics.sql` |
| 4 | `supabase/migrations/20260611000000_interoperability_tables.sql` |
| 5 | `supabase/migrations/20260611100000_billing_payers_tables.sql` |
| 6 | `supabase/migrations/20260611180000_registration_and_intake_fixes.sql` |
| 7 | `supabase/migrations/20260612100000_registration_profile_rpc.sql` |
| 8 | `supabase/migrations/20260612110000_add_patient_race_column.sql` |
| 9 | `supabase/migrations/20260612120000_intake_approval_race_column.sql` |
| 10 | `supabase/migrations/20260612130000_drop_patient_tribe_column.sql` |

**Auth (Staging only):** Authentication → URL configuration → Site URL `https://mediforge-staging.netlify.app` → add Redirect URLs for `/login`, `/register` → turn **Confirm email OFF** for easier testing.

**Verify**: paste the queries at the bottom of `SQL-RUN-PACKET-DEV-STAGING.md` (expect `race` column, no `tribe`, 2 RPCs).

**Smoke test on Staging:**

1. Register a test clinic or join with org code
2. Add patient: Race dropdown + ICD-10 search (diabetes → E11 codes)
3. Patient intake link → submit → staff approve

---

## Part 3: Promote code to Production (only after Staging passes)

### GitHub PR (recommended)

1. https://github.com/ydar996/MediForge/compare/main...staging
2. Create PR → review diff → **Merge**
3. Netlify **mediforge** (production) deploys from `main`

### PowerShell alternative

```powershell
git checkout main
git pull origin main
git merge origin/staging
git push origin main
```

---

## Part 4: Run SQL on Production (≈20–30 minutes)

**Only after Staging smoke test passes.**

1. Open Supabase → **MediForge-Prod** (not Dev, not Staging)
2. Run **the same Steps 1–10** from `SQL-RUN-PACKET-DEV-STAGING.md`
3. **Do not** turn off email confirmation on production
4. Run **Verify** queries
5. Optional: controlled smoke test with a test org: not live patient data

---

## What this release includes (dev → staging)

- Canadian registration & intake (postal codes, race demographics, profile RPC)
- ICD-10-CA default + dashboard toggle
- Patient-reported medications (manual entry UX)
- Canadian interoperability layer (labs, imaging, Rx, billing: config only until hubs connected)
- Icon / encoding fixes repo-wide
- Legal agreements Canada-first

---

## Do NOT run on Staging / Prod

| File | Why |
|------|-----|
| `sql-scripts/fix-registration-rls.sql` | Superseded by Step 1 |
| `supabase/migrations/20260611150000_users_registration_rls.sql` | Included in Step 1 |
| One-off `RUN_THIS_*` scripts | Production data fixes only |
| `sql-scripts/COMPLETE-SCHEMA-ALL-TABLES.sql` | Only for empty databases via `supabase db push` |

---

## Quick status commands

```powershell
cd C:\Users\yinka\Documents\MediForge
git fetch origin
git log --oneline origin/staging..origin/dev   # should be empty after staging merge
git log --oneline origin/main..origin/staging  # commits waiting for prod
```

---

*Last updated: 13 June 2026*
