# Set up Dev and Staging — simple guide

**Time:** about 1–2 hours (first time)  
**You already have:** production live at https://mediforge.netlify.app

**Goal:** Two **practice** copies of MediForge so you can test changes before real clinics see them.

| Environment | Website | Who uses it |
|-------------|---------|-------------|
| **Dev** | https://mediforge-dev.netlify.app | You and developers — try new ideas |
| **Staging** | https://mediforge-staging.netlify.app | Final check before go-live |
| **Production** | https://mediforge.netlify.app | Real clinics (already live) |

Each environment has its **own database** — test data never touches live patient records.

---

## Read this first — organization vs project (important)

Supabase uses two words that sound similar. They are **not** the same thing.

| Word | Plain English | What you do for dev/staging |
|------|---------------|-----------------------------|
| **Organization** | Your **billing folder** — the account that owns everything | **Keep the one you already have** (named **MediForge**) |
| **Project** | One **database + website backend** — one per environment | **Create 2 new projects** inside that same folder |

### What you have today

```
MediForge  ← organization (billing folder)
└── MediForge-Prod  ← project (production database) ✅ already exists
```

### What you will have when done

```
MediForge  ← same organization — still only ONE
├── MediForge-Prod      ← production (unchanged)
├── MediForge Dev       ← NEW project (practice database)
└── MediForge Staging   ← NEW project (practice database)
```

**Counts:**

| | Before | After |
|---|--------|-------|
| **Organizations** | 1 (MediForge) | **1** — no change |
| **Projects** | 1 (Prod) | **3** — add Dev + Staging |

### Do this ✅

- Stay inside your existing **MediForge** organization
- Click **New project** (inside that organization)
- Create **MediForge Dev**, then create **MediForge Staging**

### Do NOT do this ❌

- Do **not** click **+ New organization**
- Do **not** create a second billing account
- You are **not** setting up 5 organizations — you stay at **1 organization, 3 projects**

> **In the Supabase dashboard:** when you click **New project**, you should see **Organization: MediForge** (or similar) at the top of the form. If it asks you to create a **new organization**, stop — you are in the wrong place.

---

## Part 1 — Create two practice databases (Supabase)

You will do the steps below **twice** — first for **Dev**, then again for **Staging**.

### Step A — Open the right place

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. In the left sidebar, click your **MediForge** organization (you should already see **MediForge-Prod** listed)
3. Click the green **New project** button  
   - **Not** “New organization”  
   - **Not** “+ New organization” in the org switcher

### Step B — Create the project (repeat for Dev, then for Staging)

| Field | First time | Second time |
|-------|------------|-------------|
| **Organization** | **MediForge** (must stay the same) | **MediForge** (same) |
| **Project name** | `MediForge Dev` | `MediForge Staging` |
| **Region** | **Canada Central** (same as Prod) | **Canada Central** |
| **Password** | Save somewhere safe | Save somewhere safe |

4. Click **Create new project**
5. Wait until the dashboard says the project is ready (a few minutes)
6. Go back to the **MediForge** organization and repeat **Step B** for the other name

When finished, your MediForge organization should list **three** projects: **Prod**, **Dev**, and **Staging**.

### Step C — Copy three keys from each new project

Open **MediForge Dev** → **Project Settings** → **API**. Copy all three. Then do the same for **MediForge Staging**.

| Copy this | Paste later into |
|-----------|------------------|
| Project URL | Netlify env vars for that site |
| Publishable key | Netlify env vars for that site |
| Secret key | Netlify env vars for that site (keep private) |

### Step D — Give each new database the same “layout” as production

**Easiest if you have help from a developer:** they run `supabase db push` for each project.

**Or do it yourself:** open your production schema file `mediforge-schema.sql` (or ask a developer to export it again), then in each **new** project → **SQL Editor** → paste → **Run**.

Also in **each** new project (Dev and Staging), run the SQL packet:

→ **`SQL-RUN-PACKET-DEV-STAGING.md`** (Steps 1–6 in Supabase SQL Editor)

Then optionally:

- **Storage** → create private bucket named `patient-documents`
- Run `sql-scripts/create-platform-admin.sql` if you want a test platform admin login

---

## Part 2 — Create two practice websites (Netlify)

Netlify is separate from Supabase. Here you create **two new websites** that point at your **Dev** and **Staging** Git branches.

### If you can see your other GitHub repos in Netlify — but not MediForge

**Why (plain English):**  
Your Netlify ↔ GitHub link is working. **MediForge is just not on Netlify’s allowed list yet.**

That usually happens because:

- Netlify is set to **“Only select repositories”**, and
- **MediForge is a new repo** — you picked your older repos when you first connected Netlify, but **MediForge did not exist yet**, so it was never added.

Your other projects show up; MediForge does not. That is the telltale sign.

**Fix — add MediForge to the list (about 1 minute):**

1. On the Netlify repo picker, click **Configure Netlify on GitHub**  
   *(Or: GitHub → profile photo → **Settings** → **Applications** → **Installed GitHub Apps** → **Netlify** → **Configure**.)*
2. Under **Repository access**, if you see **Only select repositories**, click **Select repositories** and **add `MediForge`**.
3. Click **Save**.
4. Back in Netlify, refresh and search for **MediForge** again.

**Optional:** switch to **All repositories** so any future new repo shows up automatically.

**Branch not listed yet?** Do **Part 3** first (create `dev` and `staging` branches), then return here.

### Site 1: Dev

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Choose **GitHub** → repo **MediForge**
3. **Branch:** you will create `dev` in Part 3 — pick **`dev`** when it exists (or create branch first)
4. **Site name:** `mediforge-dev`
5. **Build command:** `node scripts/inject-supabase-env.cjs && npm run check`
6. **Publish directory:** `.`
7. Deploy

**Environment variables** (Site configuration → Environment variables):

- `SUPABASE_URL` = **MediForge Dev** project URL  
- `SUPABASE_PUBLISHABLE_KEY` = **MediForge Dev** publishable key  
- `SUPABASE_SERVICE_ROLE_KEY` = **MediForge Dev** secret key  

### Site 2: Staging

Repeat the same steps:

- Branch: **`staging`**
- Site name: **`mediforge-staging`**
- Same build settings
- Use **MediForge Staging** Supabase keys (not Dev keys)

### Production site (check only)

Open your existing **mediforge** site → confirm it deploys from GitHub branch **`main`**.

---

## Part 3 — Create two Git branches (GitHub)

Open PowerShell — run **one line at a time**:

```powershell
cd C:\Users\yinka\Documents\MediForge
```

```powershell
git checkout main
```

```powershell
git pull origin main
```

```powershell
git checkout -b dev
```

```powershell
git push -u origin dev
```

```powershell
git checkout -b staging
```

```powershell
git push -u origin staging
```

```powershell
git checkout dev
```

If Netlify sites were created before these branches existed, go back to Netlify and set each site’s **branch** to `dev` or `staging`.

---

## Part 4 — Tell Supabase about the new website addresses

In **each** Supabase project (**MediForge Dev** and **MediForge Staging**):

1. **Authentication** → **URL configuration**
2. **Site URL:**  
   - Dev: `https://mediforge-dev.netlify.app`  
   - Staging: `https://mediforge-staging.netlify.app`
3. **Redirect URLs:** add the same URL (and `/login`, `/register` if asked)

---

## Part 5 — Quick test

1. Open https://mediforge-dev.netlify.app — page loads
2. Try `/login` — connects (no errors about Supabase)
3. Register a **test** clinic on Dev only (not production)

---

## How you will use this every day

1. **Make changes** on your computer on the **`dev`** branch  
2. **Commit and push** (one line at a time in PowerShell):  
   ```powershell
   git add -A
   ```  
   ```powershell
   git commit -m "What you changed"
   ```  
   ```powershell
   git push origin dev
   ```  
3. **Test** on https://mediforge-dev.netlify.app  
4. When happy: on GitHub, open a **Pull Request** from `dev` → `staging`, merge, test staging URL  
5. When ready for real clinics: **Pull Request** from `staging` → `main`, merge → production updates  

---

## Write down site IDs

After Netlify creates the sites, copy each **Site ID** into **`NETLIFY-SITE-IDS.txt`**.

(Find it: Netlify → your site → **Site configuration** → **General** → **Site details** → Site ID)

---

## Need more detail?

- Database steps: **`docs/SUPABASE-DEV-STAGING-SETUP.md`**
- Full pipeline: **`DEPLOYMENT-PIPELINE.md`**
