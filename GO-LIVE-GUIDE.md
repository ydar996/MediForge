# MediForge Go-Live Guide (about 30 minutes)

MediForge has two halves:

1. **The website** (all the pages): lives on **Netlify**.
2. **The database** (organizations, users, patients): lives on **Supabase**.

You set up the database first, then the website. The new database starts **empty**:
you will register **Mecure Clinics** as the first organization, and every other
organization must register themselves through the site.

---

## Part 1: Create the database (about 15 minutes)

### Step 1: Create a new Supabase project (5 min)

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**. Name it `mediforge`. Pick a strong database password
   and **save it somewhere safe**. Region: **Canada (Central)**.
3. Wait ~2 minutes for it to finish setting up.

### Step 2: Copy the database structure from your old project (5 min)

The new project needs the same tables and security rules as your old system
(structure only: **no patient data is copied**).

1. Make sure **Docker Desktop** is running on your PC (whale icon in the taskbar).
2. In your **old** Supabase project: click **Connect** (top bar) and copy the
   **Direct connection** string. Replace `[YOUR-PASSWORD]` in it with the old
   project's database password.
3. Open PowerShell in this MediForge folder and run:

   ```powershell
   .\scripts\export-database-schema.ps1 -DbUrl "paste-the-connection-string-here"
   ```

   This creates a file called `mediforge-schema.sql`.
4. In your **new** Supabase project: open **SQL Editor**, paste the entire
   contents of `mediforge-schema.sql`, and click **Run**.

### Step 3: Two small finishing touches (5 min)

1. **File storage:** In the new project go to **Storage → New bucket**,
   name it exactly `patient-documents`, keep it **private**, and create it.
2. **Your platform admin login:** Follow the two steps written at the top of
   `sql-scripts/create-platform-admin.sql` (create a user in Authentication,
   then run that file in the SQL Editor). This is the account you'll use at
   `/platform-login` to oversee the whole platform.

---

## Part 2: Put the website live (about 10 minutes)

### Step 4: Connect the website to your new database (2 min)

1. In the new Supabase project: **Project Settings → API**. You'll see two things:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **Publishable / anon key** (a long code: this one is safe for browsers)
2. Open the file `js/supabase-env.js` in this folder and replace the two
   placeholder values with yours. Save.

### Step 5: Deploy to Netlify (5 min)

Open PowerShell in this MediForge folder and run, one line at a time:

```powershell
netlify login
netlify sites:create --name mediforge
netlify deploy --prod --dir .
```

(If the name `mediforge` is taken, pick another, e.g. `mediforge-emr`.)
Your site is now live at `https://mediforge.netlify.app` (or the name you chose).

### Step 6: Give the server its keys (3 min)

Some features (legal agreements, appointment reminders, secure admin actions)
run on Netlify's servers and need their own keys:

1. Go to [app.netlify.com](https://app.netlify.com) → your site →
   **Site configuration → Environment variables**.
2. Add these three:

   | Name | Value (from Supabase → Project Settings → API) |
   |------|------------------------------------------------|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | the publishable / anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key (keep this secret!) |

3. Back in PowerShell, run `netlify deploy --prod --dir .` once more so the
   servers pick up the keys.

---

## Part 3: Create Mecure Clinics (5 minutes)

1. Open your live site and go to `/register`.
2. Register **Mecure Clinics** as a new organization, with its admin user.
3. Done. Mecure is now the only organization in the system. Anyone else who
   wants to use MediForge must register their own organization the same way.

---

## Quick answers

- **Did any patient data come across?** No. Only the database *structure* was
  copied. The new system starts completely empty.
- **Default currency?** Canadian Dollar (CAD). Each organization can still pick
  its own currency in billing settings (e.g. Mecure can use NGN).
- **Where do I log in?**
  - Clinic staff: `/login`
  - Patients: `/patient-login`
  - You (platform owner): `/platform-login`
- **How do I update the site later?** Make your changes in this folder, then
  run `netlify deploy --prod --dir .` again.
