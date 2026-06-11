# Start here — MediForge

**MediForge** is a clinic management / EMR web app (patients, appointments, notes, billing, pharmacy, labs, and more).

**Folder:** `C:\Users\yinka\Documents\MediForge`

---

## If you are the project owner

1. **Not live yet?** → **[GO-LIVE-GUIDE.md](GO-LIVE-GUIDE.md)** (about 30 minutes: Supabase + Netlify + register Mecure Clinics).
2. **Already live?** → Open your Netlify URL → `/login` for staff, `/platform-login` for platform admin.
3. **Need help using the app?** → **[docs/USER-DOCUMENTATION-INDEX.md](docs/USER-DOCUMENTATION-INDEX.md)**

**Defaults for this product:**

- Currency: **Canadian Dollar (CAD)** unless a clinic sets otherwise
- Organizations: database starts empty — **Mecure Clinics** registers first; everyone else uses **Register**

---

## If you are an AI agent

1. Read **[AGENT-HANDOVER.md](AGENT-HANDOVER.md)** (living doc — **update it before you finish**).
2. Read **[docs/MEDIFORGE-PRODUCT-RULES.md](docs/MEDIFORGE-PRODUCT-RULES.md)** (CAD, orgs, no legacy branding).
3. Use **[docs/DOCUMENTATION-INDEX.md](docs/DOCUMENTATION-INDEX.md)** to find deeper docs.
4. **Never deploy** without explicit owner approval (“Yes, deploy” / “I approve”).

---

## Key files

| File | Purpose |
|------|---------|
| `js/supabase-env.js` | Supabase URL + browser key (edit before local test / go-live) |
| `NETLIFY-SITE-IDS.txt` | Netlify site IDs (fill in after creating sites) |
| `netlify.toml` | Hosting config, security headers, build command |

---

## Quick local test

```powershell
cd C:\Users\yinka\Documents\MediForge
# Set real values in js/supabase-env.js first
python -m http.server 5500
```

Open `http://localhost:5500/login.html`

---

## Documentation map

| Doc | Purpose |
|-----|---------|
| [AGENT-HANDOVER.md](AGENT-HANDOVER.md) | Agent living handover |
| [GO-LIVE-GUIDE.md](GO-LIVE-GUIDE.md) | First deployment |
| [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) | Technical overview |
| [docs/DOCUMENTATION-INDEX.md](docs/DOCUMENTATION-INDEX.md) | Full doc catalog |
| [CRITICAL-WORKFLOWS.md](CRITICAL-WORKFLOWS.md) | Test before deploy |
