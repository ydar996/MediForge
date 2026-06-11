# Rotate Supabase keys after credential file exposure

**When:** After `supabase-credentials.txt` was publicly reachable on Netlify (May 2026).  
**Time:** About 20–30 minutes per Supabase project (dev, staging, production if separate).

---

## Why there is no “Rotate” on the Legacy tab

Your screenshot shows **Legacy anon, service_role API keys**. Those long `eyJ...` keys are **not rotated one at a time** in Supabase anymore. They are tied to the old JWT system.

Supabase’s current approach:

| What you see | What it is | Can you “rotate” it here? |
|--------------|------------|---------------------------|
| **anon** `public` | Browser / low-privilege key | No separate rotate button |
| **service_role** `secret` | Backend / full-access key (**this was leaked**) | No separate rotate button |

**Do not** use “Reveal and copy” on the old **service_role** and paste it again — that is the same compromised key.

---

## What to do instead (recommended — no app downtime)

Use a **Secret API key** (`sb_secret_...`) for Netlify instead of the leaked legacy **service_role** (`eyJ...`).  
The **browser keeps using the legacy anon key** for now — only Netlify server functions need the new secret.

---

### Step 1 — Get a secret key in Supabase (your screen)

1. Open your project → **Project Settings** → **API Keys**.
2. Open the tab **Publishable and secret API keys** (not Legacy).

**What you will see**

- A green **Create new API keys** button — **this is the only thing you need to click** on this page right now.
- A **small table** on the right (`web`, `mobile`, `backend_api`) — that is a **preview only**. You **cannot** open or copy keys from it. Ignore it for now.
- **Publishable key** / **Secret keys** sections below may look empty until you create keys.

**Do this**

1. Click **Create new API keys** (green button).
2. In the popup, read: it will create a **default publishable** key and a **default secret** key, both named `default`. That is fine.
3. Click **Create keys** (green button in the popup — not Cancel).
4. Wait for the page to finish loading (a few seconds).
5. **Scroll down** past “Publishable key” to the **Secret keys** section.
6. You should now see a row (usually named **`default`**) with an **eye** (reveal) and **copy** icon.
7. Click **reveal** → **copy** the full key. It must start with **`sb_secret_`**.
8. Paste it into your password manager immediately. Supabase may not show the full secret again.

**If Step 6 still shows an empty Secret keys table**

- Hard-refresh the page (Ctrl+F5) and scroll to **Secret keys** again.
- If it is still empty, log out and back into Supabase, or try another browser.
- As a last resort: Supabase Dashboard → **Help** / support — say “Created API keys but cannot reveal default secret key.”

**Do not**

- Copy **service_role** from the **Legacy** tab — that is the leaked `eyJ...` key.
- Put the new `sb_secret_...` key in git or in any HTML/JS file.

---

### Step 2 — Put the secret key in Netlify (each site)

You are **replacing** the old leaked `eyJ...` value with the **`sb_secret_...`** you copied in Step 1.

The list you see (Production, Deploy Previews, Branch deploys, etc.) is **one variable** shown by context — you are not creating four different variables.

#### How to open the editor (Netlify UI)

1. Netlify → pick the site (dev, staging, or production).
2. **Project configuration** → **Environment variables** (left menu).
3. **Click the row** **`SUPABASE_SERVICE_ROLE_KEY`** (click the name / lock icon row — not the dots under it).
4. You should land on a **detail page** for that variable.
5. Click **Edit** or **Edit values** (top right on that detail page).
6. For each deploy context that already has a value, paste the **same** new `sb_secret_...`:
   - **Production** (required)
   - **Deploy Previews**
   - **Branch deploys**
   - **Local development (Netlify CLI)** (if you use local Netlify)
   - **Preview Server & Agent Runners** — optional; was empty on your site
7. Click **Save** / **Update variable**.
8. **Deploys** → **Trigger deploy** → **Deploy site**.

**Alternative:** On the list page, look for **Options** (⋯ or chevron) on the **far right** of the `SUPABASE_SERVICE_ROLE_KEY` row → **Edit**.

#### If everything is view-only (you cannot edit)

That usually means your Netlify login **does not have permission** to change secrets on this team/site.

- You need **Owner** or **Developer** (with env var access) on the Netlify team — not **Reviewer** / read-only.
- Ask whoever owns the Netlify account to either:
  - Update **`SUPABASE_SERVICE_ROLE_KEY`** for you (paste the `sb_secret_...`), or
  - Upgrade your team role so you can edit environment variables.
- Site owner path: **Team settings** → **Members** → check your role.

**Owner can also use CLI** (from a machine logged into Netlify):

```bash
netlify env:set SUPABASE_SERVICE_ROLE_KEY "paste_sb_secret_here" --context production
netlify env:set SUPABASE_SERVICE_ROLE_KEY "paste_sb_secret_here" --context deploy-preview
netlify env:set SUPABASE_SERVICE_ROLE_KEY "paste_sb_secret_here" --context branch-deploy
```

Then trigger a deploy on the site.

#### Shorter new key is OK

The new **`sb_secret_...`** key is **shorter** than the old **`eyJ...`** service_role key. That is normal. Use the full `sb_secret_` string — do not use the Legacy tab key.

For **dev**, **staging**, and **production**: repeat for **each Netlify site** (each may point at a different Supabase project).

MediForge uses this key in Netlify Functions such as `secure-supabase` and `appointment-reminders-daily`. No code change is required.

### Step 3 — Test before disabling anything old

1. Log in on that environment.
2. Open patients, billing, platform dashboard (if you use it).
3. Try an action that uses the secure proxy (e.g. platform patient list, appointments via org RPC).
4. In Netlify → **Functions** → check logs for `secure-supabase` errors.

If something fails, put the old key back temporarily and fix the env var name before continuing.

### Step A — Put the publishable key in Netlify (you do this)

The browser key is **public** — it is safe in Netlify env vars (not in git).

For **each** Netlify site (dev, staging, production):

1. Netlify → pick the site → **Project configuration** → **Environment variables**.
2. Add or edit **`SUPABASE_PUBLISHABLE_KEY`**:
   - Value = the **`sb_publishable_...`** key from **that site’s** Supabase project (Publishable and secret API keys tab).
   - Apply to **Production**, **Deploy Previews**, **Branch deploys** (same as you did for the secret key).
3. Confirm **`SUPABASE_URL`** is also set to that project’s URL (you likely already have this for `secure-supabase`).

The build writes `js/supabase-env.js` automatically — **you do not paste the key into any file in git.**

### Step B — Deploy (code already wired)

After env vars are saved, trigger **Deploy site** on that Netlify site (or push to the matching branch).

### Step C — Test, then disable legacy keys

1. Log in and open **Patients** on that environment.
2. Supabase → **API Keys** → **Legacy** → **Disable JWT-based API keys**.
3. Log in again — if it still works, the old keys are dead.

Repeat Steps A–C for dev, staging, and production (each Supabase project has its **own** publishable key).

---

### Manual fallback (local only)

If you run the site locally without Netlify env vars, the app still uses the legacy anon default in `js/supabase-client.js`. For local testing with the publishable key:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
npm run inject:supabase-env
```

---

### Step 4 (legacy doc) — Invalidate the **old** leaked service_role key

Creating a new secret key **does not** automatically disable the old `eyJ...` **service_role** key. An attacker could still use the copied key until you disable it.

**Option A — Prefer if available (safest for your app):**

1. Stay on **API Keys**.
2. On the **Legacy** tab, look for a way to **disable** legacy keys, or a control that turns off **service_role** only.
3. If Supabase only offers **Disable legacy API keys** as one switch, **do not flip it yet** unless you have migrated the browser to a **publishable** key (see “Later migration” below). Disabling all legacy keys can break login until the frontend uses the new publishable key.

**Option B — Security incident (old key must die now):**

1. **Project Settings** → **JWT** → **JWT signing keys** (or Legacy JWT secret).
2. Follow Supabase’s flow to **revoke** the legacy JWT secret / disable legacy API keys.
3. **Warning:** This can log users out and may require updating the **anon** key in the app to the new **publishable** key.

If you are unsure, do **Steps 1–3 first** (new `sb_secret_` on Netlify), then ask in Supabase support or dashboard docs whether your project can disable **service_role** without disabling **anon**.

### Step 5 — Database password (if it was in the leaked file)

1. **Project Settings** → **Database** → reset database password.
2. Update only tools that connect directly to Postgres (not the normal website login).

---

## Which key is which (plain English)

| Key | Used where | Rotate how |
|-----|------------|------------|
| **anon** (legacy `eyJ...`) | Browser — `js/supabase-client.js` | Later: move to **publishable** key; do not rush unless disabling legacy |
| **service_role** (legacy `eyJ...`) | **Was** in Netlify / leaked file | **Replace** with new **`sb_secret_...`** in Netlify; then disable legacy service_role |
| **sb_secret_...** | Netlify Functions only | Create new in dashboard; revoke old secret keys when rotating again |

---

## Per environment checklist

Do Steps 1–4 for **each** Supabase project × matching Netlify site:

- [ ] Dev Supabase → Dev Netlify  
- [ ] Staging Supabase → Staging Netlify  
- [ ] Production Supabase → Production Netlify  

---

## Verify

- App login and clinical flows work.
- Platform admin counts / org RPCs work (uses `secure-supabase`).
- Old URL blocked: `https://your-site.netlify.app/supabase-credentials.txt` → 404 (after Tier A deploy).

---

## Later migration (optional, not urgent for this incident)

Supabase is moving all projects to **publishable + secret** keys and away from legacy `anon` / `service_role`. Plan a separate task to:

1. Create a **publishable** key in the dashboard.
2. Update `js/supabase-client.js` (or Netlify env + meta tags) to use it.
3. Then **Disable legacy API keys** safely.

See [Supabase API keys docs](https://supabase.com/docs/guides/getting-started/api-keys).

---

**Never** commit `sb_secret_...` or service role keys to git. Netlify environment variables only.
