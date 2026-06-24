# MediForge

Electronic health record and clinic operations platform. **Default currency: Canadian Dollar (CAD).**

---

## Start

| Role | Read this |
|------|-----------|
| **Project owner** | **[START-HERE.md](START-HERE.md)** → **[GO-LIVE-GUIDE.md](GO-LIVE-GUIDE.md)** (first deploy) |
| **AI agent / developer** | **[AGENT-HANDOVER.md](AGENT-HANDOVER.md)** (living handover: update every session) |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/DOCUMENTATION-INDEX.md](docs/DOCUMENTATION-INDEX.md) | Master index of all docs |
| [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) | Architecture and repo layout |
| [docs/MEDIFORGE-PRODUCT-RULES.md](docs/MEDIFORGE-PRODUCT-RULES.md) | CAD, organizations, branding rules |
| [DEPLOYMENT-ENVIRONMENTS.md](DEPLOYMENT-ENVIRONMENTS.md) | dev / staging / production |
| [CRITICAL-WORKFLOWS.md](CRITICAL-WORKFLOWS.md) | Regression tests before deploy |

### End-user help

- **[User Manual (web)](user-manual.html)**
- **[User Manual (markdown)](docs/USER-MANUAL.md)**
- **[User documentation index](docs/USER-DOCUMENTATION-INDEX.md)**

---

## Local development

```powershell
# 1. Set Supabase URL + publishable key in js/supabase-env.js
# 2. Start a local server
python -m http.server 5500
# 3. Open http://localhost:5500/login.html
```

```powershell
npm install          # first time only
npm run check        # pre-deploy guards (also runs on Netlify build)
```

---

## Screenshots for the manual

```powershell
$env:MANUAL_BASE_URL="https://your-mediforge-site.netlify.app"
$env:MANUAL_USERNAME="your_username"
$env:MANUAL_PASSWORD="your_password"
npm run manual:screenshots
```

See [docs/user-manual/README-SCREENSHOTS.md](docs/user-manual/README-SCREENSHOTS.md).
