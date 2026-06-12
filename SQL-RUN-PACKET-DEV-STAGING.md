# SQL run packet — Dev & Staging

Run these scripts in **Supabase → SQL Editor** for **each** practice database:

| Project | Website |
|---------|---------|
| **MediForge Dev** | https://mediforge-dev.netlify.app |
| **MediForge Staging** | https://mediforge-staging.netlify.app |

**Do not run on Production** unless you are deliberately promoting the same changes there.

All scripts listed below are **idempotent** (safe to run more than once).

---

## Before you start

1. Open the correct Supabase project (Dev or Staging — not Prod).
2. Go to **SQL Editor → New query**.
3. Run **one step at a time**, in order. Wait for **Success** before the next step.
4. Repeat the full list on the **other** project when Dev is done.

### Quick check (optional)

Run this first to see what is already in place:

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

## Is this a brand-new empty database?

If you **just created** MediForge Dev or Staging and **no migrations have been applied yet**, run the **full schema** first:

**Option A (recommended):** from your repo folder in PowerShell:

```powershell
cd C:\Users\yinka\Documents\MediForge
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option B:** run every file in `supabase/migrations/` in **date order** (filename prefix), then continue with **Step 1** below.

If the database already came from production or earlier setup, skip the full schema and start at **Step 1**.

---

## Execution order (Dev and Staging)

| Step | File | What it fixes | Idempotent |
|------|------|---------------|------------|
| **1** | `sql-scripts/RUN-PACKET-dev-staging-idempotent.sql` | Address columns, registration RLS, demographics columns | Yes |
| **2** | `supabase/migrations/20251109000000_create_patient_intake_tables.sql` | Patient self-onboarding tables | Yes (`IF NOT EXISTS`) |
| **3** | `supabase/migrations/20260611170000_intake_approval_postal_demographics.sql` | Intake approval saves postal code + demographics | Yes (`CREATE OR REPLACE`) |
| **4** | `supabase/migrations/20260611000000_interoperability_tables.sql` | Interop message queue + PHN identifiers | Yes |
| **5** | `supabase/migrations/20260611100000_billing_payers_tables.sql` | Billing / payer profiles + claims | Yes |
| **6** | `supabase/migrations/20260611180000_registration_and_intake_fixes.sql` | Org/patient columns, registration RLS, org Admin UPDATE, intake org RPC | Yes |

### Step 2 — skip if already applied

If `patient_intake_submissions` appears in the quick check above, Step 2 is optional (re-running is still safe).

---

## How to run each step

1. Open the file in your repo (paths above).
2. **Select all** → **Copy**.
3. Supabase **SQL Editor** → paste → **Run**.
4. Confirm **Success** (no red error).

**Shortcut:** Step 1 is a single combined script. Steps 2–5 are separate migration files.

---

## After SQL — Auth settings (each project)

In **Authentication → URL configuration**:

| Project | Site URL |
|---------|----------|
| Dev | `https://mediforge-dev.netlify.app` |
| Staging | `https://mediforge-staging.netlify.app |

Add the same URLs under **Redirect URLs**, plus `/login` and `/register` if prompted.

For Dev/Staging only: **Authentication → Email → Confirm email** → turn **OFF** (easier clinic test registration).

---

## Optional — platform admin (you only)

Only if you need `/platform-login` on Dev or Staging:

1. **Authentication → Users → Add user** (confirm email).
2. Edit and run `sql-scripts/create-platform-admin.sql` (uses `ON CONFLICT` — idempotent).

---

## Verify everything worked

Run after all steps:

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

-- Intake approval function exists
SELECT proname
FROM pg_proc
WHERE proname = 'approve_patient_intake_submission';
```

Expected: at least **2** registration policies (`organizations` + `users`), **3** tables, **1** function.

---

## Smoke test in the app

On **Dev** only:

1. Register a **test clinic** at `/register` (Canada address + postal code).
2. Open the clinic **patient intake link** and submit a test patient.
3. Staff: approve intake → patient should have address + postal code.

Repeat on Staging when Dev looks good.

---

## Do not run on Dev/Staging

| File | Why |
|------|-----|
| `sql-scripts/fix-registration-rls.sql` | Superseded by Step 1 packet (same policies, cleaner merge) |
| `supabase/migrations/20260611150000_users_registration_rls.sql` | Already included in Step 1 packet |
| `supabase/migrations/20251105000002_fix_staff_data_access.sql` | Old version; use `20251105000003` only on Prod if needed |
| One-off `RUN_THIS_*` / data-fix scripts | For specific prod data issues, not fresh Dev/Staging setup |

---

## Checklist

Copy and tick off per project:

**MediForge Dev**

- [ ] Step 1 — `RUN-PACKET-dev-staging-idempotent.sql`
- [ ] Step 2 — patient intake tables (if needed)
- [ ] Step 3 — intake approval postal/demographics
- [ ] Step 4 — interoperability tables
- [ ] Step 5 — billing tables
- [ ] Step 6 — registration and intake fixes (`20260611180000_registration_and_intake_fixes.sql`)
- [ ] Auth URLs configured
- [ ] Test clinic registration
- [ ] Test patient intake + approval

**MediForge Staging**

- [ ] Same steps as Dev
- [ ] Auth URLs configured
- [ ] Smoke test

---

*Last updated: June 2026 — registration, postal code, intake, interop, and billing fixes.*
