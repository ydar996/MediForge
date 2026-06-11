# MediForge Agent Handover

**Last updated:** May 2026  
**Purpose:** Primary handover document for the next AI agent. Read this first.

---

## Communication with the user (mandatory)

**Always explain things in layman's terms.** The project owner is not asking for jargon, long checklists they must execute themselves, or “fancy” technical prose.

- Say **what** changed, **why** it matters, and **what they need to do next** — in plain English.
- Avoid dense acronyms without a one-line explanation. Prefer “website login key” over unexplained shorthand.
- When you can **do the work yourself** (deploy, commit, run checks), **do it** — don’t hand back a long DIY checklist unless they asked to do it themselves.
- Keep answers **short and direct**. No padding, no consultant tone.
- Technical detail belongs in code comments or docs — not in every reply to the user.

---

## Netlify CLI auth (never commit tokens)

- **Normal deploys:** `git push` to `dev` / `staging` / `main` — no personal access token needed.
- **CLI on the user's PC:** prefer `netlify login` (browser). Do **not** paste `nfp_...` tokens into repo docs or chat.
- **`NETLIFY_AUTH_TOKEN`:** only if the user explicitly sets it in Windows or GitHub Actions secrets — never in git.
- Old tokens were scrubbed from `QUICK-REFERENCE.md`, `START-HERE.md`, `DEPLOYMENT-AND-FIXES-STATUS.md`, etc. (May 2026).

---

These rules are **non-negotiable**. Follow them exactly.

### 0. NEVER DEPLOY WITHOUT EXPLICIT APPROVAL (READ FIRST)

- **Do NOT deploy when the user says "deploy" or "deploy to main dev url."** Those phrases are NOT sufficient approval.
- **You MUST wait for explicit approval** before running any deploy command. Examples of explicit approval: *"Yes, deploy"*, *"I approve the deployment"*, *"Go ahead and deploy"*, *"You have my approval to deploy"*.
- **When the user asks to deploy:** Summarize what will be deployed, then **stop and wait** for them to confirm. Do not run `netlify deploy` until they give explicit approval.
- **When in doubt, do not deploy.** Ask: "Should I proceed with the deployment?"
- Agents have repeatedly deployed without proper approval. This rule overrides all others. **No deployment without explicit, separate approval.**

### 1. Deploy Only to Dev (Unless Explicitly Approved)

- **Deploy first to the main dev URL only.** Never deploy to staging or production without the user's explicit say-so.
- **Staging and production require separate, explicit user instruction each time.** Do not assume approval.

### 2. Single Deployment, Even for Many Changes

- **Do one deployment only**, even after several prompts, fixes, or upgrades.
- Batch all changes into a **single deployment** with **detailed, clear notes** about what was changed.
- **Never do multiple deployments** just because many changes were made.
- When deploying, use a comprehensive deploy message listing all tasks, files, and fixes.

### 3. Site IDs – Use the Site ID Document

- **Site IDs:** See `NETLIFY-SITE-IDS.txt` (and table below) for authoritative IDs.
- Dev, staging, and production are separate Netlify sites. Always deploy to dev first.
- Verify which site you are linked to: `netlify status`

---

## Netlify Site IDs and URLs

| Environment | Netlify Site     | Site ID                                | URL                                    |
|-------------|------------------|----------------------------------------|----------------------------------------|
| **Dev**     | mediforge-dev   | `OLD-SITE-ID-REMOVED-CREATE-NEW-SITE` | https://mediforge-dev.netlify.app     |
| **Staging** | mediforge-staging | `OLD-SITE-ID-REMOVED-CREATE-NEW-SITE` | https://mediforge-staging.netlify.app |
| **Production** | mediforge    | `OLD-SITE-ID-REMOVED-CREATE-NEW-SITE` | https://mediforge.netlify.app         |

### Linking and Deploying to Dev

```powershell
cd C:\Users\yinka\Documents\MediForge
netlify unlink
netlify link --id OLD-SITE-ID-REMOVED-CREATE-NEW-SITE
netlify deploy --prod --dir .
```

*(Use `--prod` because it deploys to the "production" URL of that linked site—i.e., the main dev URL.)*

---

## Reference Documents

| Document | Purpose |
|---------|---------|
| **`NETLIFY-SITE-IDS.txt`** | **Authoritative Site IDs for deploy targets** – use this to reference where to deploy |
| `DEPLOYMENT-HANDOVER.md` | Deploy URLs, site IDs, process (no secrets — keys in Netlify) |
| `DEPLOYMENT-ENVIRONMENTS.md` | Branch/site mapping, promotion flow |
| `Correct deployment pipeline.txt` | Production pipeline, trace logging, testing checklist |
| `mediforge deployment handover 10202025.txt` | Deployment credentials, critical rules |

---

## Security posture (infrastructure & assessments)

Use this alongside automated scans (e.g. Skipfish); do not wait for the next PDF before acting.

- **Canonical production host for tools and links:** `https://mediforge.netlify.app` (apex). Do **not** aim scanners only at `www.*` unless that hostname is configured; prefer real paths (e.g. `/login.html`) over bare `/` if the root does not serve HTML.
- **In-repo hardening:** `404.html` (generic message, no stack traces); `netlify.toml` **301** from `https://www.mediforge.netlify.app/*` → apex; `/.well-known/security.txt` (RFC 9116 contact); **CSP** `report-uri` → `/.netlify/functions/csp-report` (watch Netlify function logs for violations); Netlify Functions return **`Content-Type: application/json`** for JSON bodies where applicable; **500** responses from `get-platform-legal-agreements` do not echo exception text to clients.
- **Supabase:** Review **RLS** regularly in the Supabase Dashboard (`anon` / `authenticated`). Never expose **service role** keys in front-end bundles; keep privileged access in Netlify env + Functions.
- **Retesting:** Re-run DAST on the canonical URL with meaningful paths; add manual checks for XSS on reflected input and auth/session flows; run **`npm audit`** before releases and patch where safe.

---

## Current Project State (as of last session)

### Git Branches

- **dev** – Development branch; deploy here first
- **staging** – Pre-production; do not deploy without explicit approval
- **main** – Production; do not deploy without explicit approval

### Recent Work (2026) — patient IDs & numbering

1. **MFASC canonical prefix (MFA Staff Clinic only)** — Organization UUID `94534e80-06a8-468f-b8a2-ece3f07697c4`. Default generated MRNs use **`MFA-SC` + 4 digits** when `settings.patient_id_prefix` is missing; merged sequence across legacy stems (MIN/MFA/MFA-MC/MFA-SC). See `supabase/migrations/20260428160000_mfasc_canonical_patient_id_prefix.sql`, `js/ehr-org-patient-id.js`, `js/supabase-patients.js`, `netlify/functions/secure-supabase.js`.
2. **Manual patient numbering** — When enabled per org, **Patient/File Number** is optional: leave blank for the org’s default auto number (for MFASC: **MFA-SC####**); enter a value only to override. `js/patients.js`, `js/manual-patient-numbering.js`.
3. **Planned (not implemented)** — **App-wide numbering for all other orgs:** today, non-MFASC default prefix is still **first three letters of org name** (collision-prone: e.g. Mecure vs Mecrest → both **MEC**). User intent: review options (unique `org_code`, id-derived prefix, hybrid, branch model) before implementation. Tracked as agent todo: strategy + scope + MFASC exception unchanged.

4. **Patient identity & routing (2025–2026)** — Legacy **MIN/MFA/MFA-MC/MFA-SC** handling, `resolvePatientByIdentifier`, URL-safe navigation, suppression of legacy MIN in patient-facing UI where appropriate, appointment/patient name↔ID reconciliation. Touchpoints include `js/patients.js`, `js/appointments.js`, intake approval flows, `secure-supabase` where MFASC intake assigns IDs.

### Broader history (2025–2026) — not exhaustive

The repo has **many commits** after early 2025; do not assume “March 2025” is the last activity. Use **`git log --oneline --since=2025-03-01`** for the full train.

| Area | Notes (high level) |
|------|---------------------|
| **Pharmacy** | Inventory **lots**, **FEFO** dispense, **COGS**; Excel opening stock / **bulk import** UX (progress, column picker); `brand_name`, `pack_size`, `price_unit`; migrations under `supabase/migrations/` (e.g. `20260417*`, `20260219*`). |
| **Physician verification** | Regulatory uploads (e.g. MDCN), admin review, access gates, login/modal/banner UX, configure-services grid. |
| **Configure services / labs** | Heritage-themed UI, CPT lab catalog cleanup, lab ordering grouped by **category**, results/audit trail readability, heritage table CSS fixes. |
| **Patient intake** | Stricter **email** validation; approval RPCs and secure function paths evolve with schema. |
| **Storage / Pre-EMR** | **RLS** for patient documents; path variants and signed-URL/list fallbacks for legacy uploads; org segment fixes. |
| **Appointments** | **Reminder** system (settings, SMS copy, cron/`Run Now`), duplicate-edit and **Supabase row id** fixes, patient UUID vs name reconciliation, safer list filter/sort. |
| **Auth & platform** | **RLS hardening**, auth-related RPCs, login **rate limit** / lockout UX, false-positive **auto-refresh** vs session handling; **username org-scoped** migration exists — check app code vs DB when debugging auth. |
| **Netlify / release** | Promotions **dev → staging → production** appear often in commit messages; still follow **explicit deploy approval** above. |

### Older fixes (examples only)

1. **Patient View button** — `isUuidLike(displayId)` for MFA-MC style IDs in `js/patients.js`.
2. **Icons & currency** — Font Awesome + `formatCurrency` / locale symbols on high-traffic pages (platform dashboard, clinics, billing, register, etc.).

---

## Deployment Workflow (Summary)

1. **Develop** – Make fixes on `dev` branch. Test locally.
2. **Commit** – Use descriptive commit messages. Batch related changes.
3. **Wait** – Do **not** deploy until the user gives **explicit approval** (e.g. "Yes, deploy" or "I approve"). "Deploy" or "Deploy to main dev url" alone is NOT approval—see Rule 0 above.
4. **Deploy to dev** – Only after explicit approval:
   - Link to `mediforge-dev` (site ID above)
   - Run `netlify deploy --prod --dir .`
   - Use a **single deployment** with a **detailed deploy message** listing all tasks implemented.
5. **Staging/Production** – Only when the user explicitly approves. Never assume.

---

## Local Testing

```powershell
python -m http.server 5500
# Then open http://localhost:5500
```

---

## Quick Commands

```powershell
# Check which site is linked
netlify status

# Link to dev and deploy (when user approves)
netlify link --id OLD-SITE-ID-REMOVED-CREATE-NEW-SITE
netlify deploy --prod --dir . --message "DETAILED_LIST_OF_ALL_CHANGES"

# Deploy to dev using deploy-with-message.ps1 (Site ID from NETLIFY-SITE-IDS.txt)
.\deploy-with-message.ps1 -SiteId OLD-SITE-ID-REMOVED-CREATE-NEW-SITE -Prod -MessageOverride "DETAILED_LIST_OF_ALL_CHANGES"

# Discard uncommitted .netlify changes if pre-push fails
git restore .netlify/
```

---

## SQL Scripts for Easy Retrieval

When needed, run these in Supabase SQL Editor. Copy from below or from `supabase/migrations/`.

**Note:** The embedded **MIN→MFA** / **MIN→MFA-MC** blocks below target specific **`org_code`** values. **MFASC** canonical **`MFA-SC`** for Staff Clinic is tied to organization UUID **`94534e80-06a8-468f-b8a2-ece3f07697c4`** — see `supabase/migrations/20260428160000_mfasc_canonical_patient_id_prefix.sql`. Do not assume one script applies to all clinics.

### 1. MIN→MFA (Staff Clinic, org MIN-2026-OO9A)

```sql
-- Migration: Patient ID prefix MIN→MFA for organization MIN-2026-OO9A
-- Purpose: Change patient numbering from MINXXXX to MFAXXXX (retroactive + future)
-- Runs in single transaction - all or nothing

BEGIN;

DO $$
DECLARE
  v_org_id UUID;
  v_settings JSONB;
BEGIN
  SELECT id, COALESCE(settings, '{}'::jsonb)
  INTO v_org_id, v_settings
  FROM public.organizations
  WHERE org_code = 'MIN-2026-OO9A';

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'Organization with org_code MIN-2026-OO9A not found. Skipping migration.';
    RETURN;
  END IF;

  v_settings := v_settings || jsonb_build_object(
    'patient_id_prefix', 'MFA',
    'patient_id_previous_prefix', 'MIN'
  );

  UPDATE public.organizations
  SET settings = v_settings, updated_at = NOW()
  WHERE id = v_org_id;

  RAISE NOTICE 'Updated org % with patient_id_prefix=MFA, patient_id_previous_prefix=MIN', v_org_id;
END $$;

DO $$
DECLARE
  v_org_id UUID;
  v_old_id TEXT;
  v_new_id TEXT;
  v_num TEXT;
  v_updated INT;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE org_code = 'MIN-2026-OO9A';

  IF v_org_id IS NULL THEN RETURN; END IF;

  FOR v_old_id, v_num IN
    SELECT patient_id, SUBSTRING(patient_id FROM 4)
    FROM public.patients
    WHERE organization_id = v_org_id AND patient_id ~ '^MIN[0-9]{4}$'
  LOOP
    v_new_id := 'MFA' || v_num;
    UPDATE public.patients SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated > 0 THEN RAISE NOTICE 'Patients: % -> %', v_old_id, v_new_id; END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'clinical_notes' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.clinical_notes SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'patient_encounters' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.patient_encounters SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'lab_results' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.lab_results SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'lab_orders' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.lab_orders SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'prescriptions' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.prescriptions SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'billing_invoices' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.billing_invoices SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'payments' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.payments SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'patient_documents' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.patient_documents SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'referral_details' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.referral_details SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'preventive_care' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.preventive_care SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'dispensing_records' AND c.column_name = 'patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.dispensing_records SET patient_id = v_new_id WHERE organization_id = v_org_id AND patient_id = v_old_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables t JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE t.table_schema = 'public' AND t.table_name = 'patient_intake_submissions' AND c.column_name = 'created_patient_id' AND c.data_type IN ('text', 'character varying')) THEN
      UPDATE public.patient_intake_submissions SET created_patient_id = v_new_id WHERE organization_id = v_org_id AND created_patient_id = v_old_id;
    END IF;
  END LOOP;
  RAISE NOTICE 'MIN->MFA migration completed for org %', v_org_id;
END $$;

COMMIT;
```

### 2. MIN→MFA-MC (Mobile Clinic, org MIN-2026-BGA5)

Full script: `supabase/migrations/20260312000000_patient_id_prefix_min_to_mfa_mc_bga5.sql`  
If org_code differs (e.g. MIN-2026-6JHW), replace `MIN-2026-BGA5` in both DO blocks.

---

**Next agent:** Read this document first. Follow the deployment rules. Use `NETLIFY-SITE-IDS.txt` for Site IDs. Deploy to dev only with one batch and detailed comments—never piecemeal, never to staging/production without explicit approval.
