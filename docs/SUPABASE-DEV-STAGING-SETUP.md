# Layperson guide: Create Dev and Staging databases in Supabase

**Audience:** Someone comfortable with web dashboards and copy-paste, not necessarily a database expert.

**Goal:** You already have **production** data in one Supabase project. This guide helps you add **two new empty projects**—**Staging** and **Dev**—with the **same table structure** (schema) as production, so tests and experiments do not touch live patient data.

**Related:** Netlify sites and branches are described in [`DEPLOYMENT-ENVIRONMENTS.md`](../DEPLOYMENT-ENVIRONMENTS.md). Site IDs are in [`NETLIFY-SITE-IDS.txt`](../NETLIFY-SITE-IDS.txt).

---

## 1. What you are actually doing (plain English)

**Organization vs project (read this first):**

| Term | Meaning | For dev/staging |
|------|---------|-----------------|
| **Organization** | Billing folder (e.g. **MediForge**) | **Keep the one you have** — do not create a new org |
| **Project** | One database + Auth + Storage for one environment | **Create 2 new projects** inside MediForge org |

You end with **1 organization, 3 projects** (Prod + Dev + Staging). You are **not** creating extra organizations.

- **Supabase project** = one dedicated PostgreSQL database + Auth + Storage + APIs for that environment.
- **Production** stays where it is. You **do not delete or move** it in this guide.
- You will **create two new projects** (click **New project**, not **New organization**), then **replay** the same SQL migration files your team already uses so the new databases **look like** production structurally (tables, policies, functions)—usually **without** copying real patient rows.

---

## 2. Before you start (checklist)

- [ ] You can log in to [supabase.com](https://supabase.com) as an **Owner** or **Admin** of the team/organization that owns production.
- [ ] You know which **region** production uses (Supabase Dashboard → your prod project → **Settings** → **General** → **Region**). Use the **same region** for staging and dev unless you have a reason not to (simpler, fewer surprises).
- [ ] You have **15–60 minutes** for the first pass; applying many SQL files can take a while.
- [ ] You understand: **Staff logins in Dev are separate from Prod.** After setup you will create test users in Dev/Staging or invite them again.

---

## 3. Create the Staging project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your **MediForge** organization (where **MediForge-Prod** already lives).
3. Click **New project** — **not** “+ New organization”.
4. Confirm **Organization: MediForge** on the form (same org as production).
5. **Name:** e.g. `MediForge Staging` (any clear name).
6. **Database password:** generate a strong password and **save it** in your password manager (you rarely need it day-to-day, but you need it for some tools).
7. **Region:** match production (see §2).
8. **Pricing plan:** choose what fits your org (Free tier has limits; paid orgs bill **compute per project**—see Supabase pricing). Staging is often on the **smallest** instance size.
9. Click **Create new project** and wait until the dashboard shows the project as ready.

**Write down:**

- **Project reference** (a short id like `abcdefghijklmnop`) — visible in **Settings → General**.
- Nothing else yet; keys come in the next step.

---

## 4. Create the Dev project

Repeat **§3** with a different name, e.g. `MediForge Dev`.

You should end with **three** projects total: **Production** (existing), **Staging** (new), **Dev** (new).

---

## 5. Copy the API keys for each new project (Staging, then Dev)

For **each** of Staging and Dev:

1. Open that project in the dashboard.
2. Go to **Settings** (gear) → **API**.
3. Copy and store securely (password manager or internal runbook):

   | Item | Where it appears | What it’s for |
   |------|------------------|---------------|
   | **Project URL** | **Project URL** | Browser and apps connect here. |
   | **anon public** key | **Project API keys** → `anon` `public` | Safe to put in frontend **for that environment only**. |
   | **service_role** key | **Project API keys** → `service_role` `secret` | **Secret.** Server/Netlify Functions only. Never commit to Git. |

Repeat so you have **two complete sets**: one for **Staging**, one for **Dev**. Production keys stay as they are.

---

## 6. Put the schema on Staging and Dev (same structure as production)

Your repository stores SQL under `supabase/migrations/`. Those files are the **recipe** for the database shape.

You have two practical approaches.

### Option A — Recommended if someone on the team uses the terminal: Supabase CLI

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) on your computer.
2. In a terminal, go to your project folder (the repo root where the `supabase` folder lives).
3. Log in: `supabase login`.
4. **Link** to **Staging** first: `supabase link --project-ref <STAGING_PROJECT_REF>` (the short id from Settings → General).
5. Push migrations: `supabase db push`  
   - This applies migration history to that project. Resolve any errors with your developer; first-time setup issues are usually fixable.
6. **Link** to **Dev**: `supabase link --project-ref <DEV_PROJECT_REF>` and run `supabase db push` again.

If the repo has no `supabase/config.toml`, the CLI may ask you to run `supabase init` once in the repo—your developer can confirm; the important part is **link + push** per project.

### Option B — No CLI: run SQL in the Supabase SQL Editor (dashboard)

1. Open **Staging** → **SQL Editor**.
2. Run migration files **in chronological order** by the date prefix in the filename (e.g. `20250118000000_...` before `20251105000000_...`).
3. Open each file from your computer’s copy of the repo (`supabase/migrations/`), copy the full contents, paste into **SQL Editor**, click **Run**.
4. If one file fails, **stop** and get help; do not skip ordering.
5. Repeat for **Dev** in its own project.

**Files named `RUN_THIS_*.sql` or one-off `verify_*.sql`:** Treat these as **special instructions** from your team. Some are data fixes, not part of the normal chain. Ask a developer which ones apply to a **fresh empty** database, or skip until someone confirms.

**Goal:** After this, Staging and Dev should have tables and policies similar to production. They will **not** automatically contain production’s patient data unless you deliberately import it (see §7).

---

## 7. Data: should you copy production into Dev/Staging?

| Approach | When to use |
|----------|-------------|
| **Empty + test data** | Safest default. Create a fake organization and users for testing. |
| **Anonymized subset** | When you need realistic volume without real identities—requires a planned export/process; get compliance advice first. |
| **Full copy of production** | Highest risk (PHI duplication). Only with explicit policy, encryption, and access control. Not covered here. |

For most teams, **start empty** and add only what you need to click through the app.

---

## 8. Auth (logins) and URLs

If staff use **email magic links** or **OAuth**, each Supabase project has its own Auth settings.

For **Staging** and **Dev**:

1. **Authentication** → **URL configuration** (wording may vary by dashboard version).
2. Add **Site URL** and **Redirect URLs** that match your Netlify URLs, for example:
   - Dev site: `https://<your-dev-netlify-domain>`
   - Staging site: `https://<your-staging-netlify-domain>`

Use the exact URLs Netlify shows for each site. Wrong URLs cause “invalid redirect” errors after login.

---

## 9. Connect Netlify to the right database (each site its own keys)

You have **three Netlify sites** (see `NETLIFY-SITE-IDS.txt`). Each site should get the Supabase credentials **for its environment**:

| Netlify site (branch) | Should use Supabase project |
|------------------------|-----------------------------|
| Dev (`dev` branch) | **Dev** project URL + keys |
| Staging (`staging` branch) | **Staging** project URL + keys |
| Production (`main` branch) | **Production** (unchanged) |

**Where to set this:** Netlify → select the site → **Site configuration** → **Environment variables**.

**Minimum variables** for this app’s serverless proxy (see `netlify/functions/secure-supabase.js`):

- `SUPABASE_URL` = that site’s Project URL  
- `SUPABASE_SERVICE_ROLE_KEY` = that project’s **service_role** secret  

**Frontend:** Today, the browser bundle may still use default keys from `js/supabase-client.js`. To truly separate environments, each Netlify site must supply the correct **anon** URL and key at **build or runtime** (your team may add a small build step or injected config). Until that is done, changing only Netlify function env vars is **not enough** for the browser to switch databases.

---

## 10. Storage, Edge Functions, and cron

- If you use **Storage** buckets in production, recreate or mirror bucket names and policies on Staging/Dev as needed, or features that upload files will fail.
- **Scheduled functions** (e.g. appointment reminders): on Dev, use **test** SMS/email credentials or disable schedules so you do not message real patients from a test database.

---

## 11. Quick verification (smoke test)

1. In **Staging** SQL Editor, run: `select count(*) from information_schema.tables where table_schema = 'public';` — you should see a non-zero count if migrations ran.
2. Log in to the **staging Netlify URL** (once frontend points at Staging Supabase) with a **user that exists only in Staging Auth**.
3. Confirm you **cannot** see production-only data if databases were kept separate.

---

## 12. What to save in your internal runbook

| Environment | Supabase project name | Project ref | Netlify site |
|-------------|----------------------|-------------|--------------|
| Production | (existing) | | Prod site ID in `NETLIFY-SITE-IDS.txt` |
| Staging | | | Staging site ID |
| Dev | | | Dev site ID |

Store API keys in **Netlify env** and a **secure vault**, not in the Git repo.

---

## 13. If something goes wrong

- **“Permission denied” or RLS errors:** Often normal until test users and org rows exist; compare with how production seeds admin users (migrations or manual SQL—ask your developer).
- **Migration fails halfway:** Do not guess; snapshot the error message and fix forward with help—avoid half-applied manual runs on production.
- **Wrong database from the browser:** Frontend config must match the site; see §9.

---

*This document describes setup only. Compliance, backups, and production cutovers are separate decisions.*
