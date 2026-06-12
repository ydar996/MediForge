# SQL run packet — Dev, Staging & Production

Simple checklist for Supabase **SQL Editor**. Run scripts **one at a time**, wait for **Success**, then move on.

| Environment | Supabase project | Website |
|-------------|------------------|---------|
| **Dev** | MediForge Dev | https://mediforge-dev.netlify.app |
| **Staging** | MediForge Staging | https://mediforge-staging.netlify.app |
| **Production** | MediForge-Prod | https://mediforge.netlify.app |

All scripts below are **idempotent** (safe to run more than once).

---

## When to run this

1. **Deploy the latest app code first** (Dev → Staging → Production when ready).
2. Then run the SQL steps on the **matching** Supabase project.
3. **Step 6 is required** for the current registration and patient intake flows (Canada/US addresses, postal codes, org activation, intake org lookup).

**Order for each environment:** Dev first → Staging → Production (only when you are deliberately promoting the same release).

---

## Before you start

1. Open the **correct** Supabase project (Dev, Staging, or Prod — do not mix them up).
2. Go to **SQL Editor → New query**.
3. Open each file from your repo, **Select all → Copy → Paste → Run**.

### Optional quick check

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'organizations',
    'users',
    'patients',
    'patient_intake_submissions',
    'interop_messages',
    'patient_payer_profiles'
  )
ORDER BY table_name;
```

---

## Brand-new empty database?

If Dev or Staging has **no tables yet**, apply the full schema first:

**Option A (recommended):**

```powershell
cd C:\Users\yinka\Documents\MediForge
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option B:** Run every file in `supabase/migrations/` in **filename date order**, then continue with Step 1 below.

If the database already has production-style tables, skip this and start at **Step 1**.

---

## Steps (run in order)

| Step | File | What it does |
|------|------|--------------|
| **1** | `sql-scripts/RUN-PACKET-dev-staging-idempotent.sql` | Address columns, registration RLS, demographics columns |
| **2** | `supabase/migrations/20251109000000_create_patient_intake_tables.sql` | Patient self-onboarding tables |
| **3** | `supabase/migrations/20260611170000_intake_approval_postal_demographics.sql` | Intake approval: postal code + demographics |
| **4** | `supabase/migrations/20260611000000_interoperability_tables.sql` | Interop queue + PHN identifiers |
| **5** | `supabase/migrations/20260611100000_billing_payers_tables.sql` | Billing / payer profiles + claims |
| **6** | `supabase/migrations/20260611180000_registration_and_intake_fixes.sql` | **Required** — org Admin UPDATE, `get_organization_intake_context` RPC, intake approval permissions |
| **7** | `supabase/migrations/20260612100000_registration_profile_rpc.sql` | **Required** — registration profile RPC + own-profile SELECT (fixes join-org RLS failures) |

**Step 2 skip:** If `patient_intake_submissions` already exists, Step 2 is optional (re-running is still safe).

**Do not run separately:** `supabase/migrations/20260611150000_users_registration_rls.sql` — already included in Step 1.

---

## After SQL — Auth settings (Dev & Staging only)

**Authentication → URL configuration**

| Project | Site URL |
|---------|----------|
| Dev | `https://mediforge-dev.netlify.app` |
| Staging | `https://mediforge-staging.netlify.app` |

Add the same URLs under **Redirect URLs**, plus `/login` and `/register` if prompted.

**Authentication → Email → Confirm email** → turn **OFF** on Dev and Staging (easier test registration).

Production: keep **Confirm email ON** unless your prod policy says otherwise.

---

## Optional — platform admin (Dev / Staging)

Only if you need `/platform-login`:

1. **Authentication → Users → Add user** (confirm email).
2. Run `sql-scripts/create-platform-admin.sql` (idempotent).

---

## Verify (run after all steps)

```sql
-- Registration policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('organizations', 'users')
  AND policyname ILIKE '%registration%'
ORDER BY tablename, policyname;

-- Key tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'patient_intake_submissions',
    'interop_messages',
    'patient_payer_profiles'
  );

-- Required RPCs for current app code
SELECT proname
FROM pg_proc
WHERE proname IN (
  'approve_patient_intake_submission',
  'get_organization_intake_context'
);
```

**Expected:** at least **2** registration policies, **3** tables, **2** functions.

---

## Smoke test

On **Dev** (repeat on Staging when Dev passes):

1. Register a **test clinic** at `/register` (Canada address + postal code).
2. Accept legal agreements on the registration form.
3. Open the clinic **patient intake link** and submit a test patient.
4. Staff: approve intake → patient should have address + postal code.

---

## Production

When promoting **Staging → main** (production website):

1. Merge and deploy production code on Netlify (`main` branch).
2. Open **MediForge-Prod** in Supabase SQL Editor.
3. Run **Steps 1–6 in the same order** (skip Step 2 if intake tables already exist).
4. Do **not** turn off email confirmation on production.
5. Run the **Verify** queries above, then smoke-test with a controlled test org if possible.

**No SQL needed for:** legal agreement text updates (Canada/US) — those are HTML/JS only, deployed with the app.

---

## Do not run on Dev / Staging

| File | Why |
|------|-----|
| `sql-scripts/fix-registration-rls.sql` | Superseded by Step 1 |
| `supabase/migrations/20260611150000_users_registration_rls.sql` | Included in Step 1 |
| `supabase/migrations/20251105000002_fix_staff_data_access.sql` | Old; use `20251105000003` on Prod only if needed |
| One-off `RUN_THIS_*` / data-fix scripts | Prod data fixes only — not fresh setup |

---

## Checklist (copy per project)

**MediForge Dev**

- [ ] Latest code deployed to Dev
- [ ] Step 1 — `RUN-PACKET-dev-staging-idempotent.sql`
- [ ] Step 2 — patient intake tables (if needed)
- [ ] Step 3 — intake approval postal/demographics
- [ ] Step 4 — interoperability tables
- [ ] Step 5 — billing tables
- [ ] Step 6 — `20260611180000_registration_and_intake_fixes.sql`
- [ ] Auth URLs + Confirm email OFF
- [ ] Verify queries pass
- [ ] Smoke test: clinic registration + patient intake

**MediForge Staging**

- [ ] Latest code deployed to Staging
- [ ] Steps 1–6 (same as Dev)
- [ ] Auth URLs + Confirm email OFF
- [ ] Verify + smoke test

**MediForge Production** *(when promoting a release)*

- [ ] Code merged to `main` and deployed
- [ ] Steps 1–6 on MediForge-Prod
- [ ] Verify queries pass
- [ ] Controlled smoke test (optional)

---

*Last updated: 11 June 2026 — Canada/US registration, postal codes, intake RPC, interop, billing, legal agreements (app-only).*
