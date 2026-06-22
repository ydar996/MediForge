# MediForge project overview

Technical reference for developers and AI agents. For operational handover, see **`AGENT-HANDOVER.md`**. For first deploy, see **`GO-LIVE-GUIDE.md`**.

**Last updated:** June 22, 2026

---

## Talking to the project owner

The owner is **not** a developer. **Every** agent reply to them must use the **simplest layman's terms** — questions, plans, status, and technical topics included.

- Explain what something means for the **clinic**, not how the code is wired.
- Avoid leading with jargon; if a technical word is needed, give a one-sentence plain-English meaning right after.
- Do the work (deploy, commit, checks) when possible instead of long DIY checklists.

Full rule: **`AGENT-HANDOVER.md`** → **Rule #1** and **Communication with the user**.

---

## Repository layout

```
MediForge/
├── index.html, login.html, dashboard.html, …   # Static HTML app (~300+ pages)
├── js/                                           # Application logic
├── css/                                          # Styles (heritage theme, billing, etc.)
├── netlify/
│   └── functions/                                # Serverless API (Node)
├── supabase/
│   └── migrations/                               # SQL schema history (~100 files)
├── sql-scripts/                                  # Ad-hoc / one-off SQL utilities
├── scripts/                                      # Build, checks, schema export
├── docs/                                         # Documentation
├── netlify.toml                                  # Hosting, CSP, redirects, build
├── manifest.json                                 # PWA manifest (MediForge)
├── AGENT-HANDOVER.md                             # Living agent handover
└── GO-LIVE-GUIDE.md                              # Owner go-live checklist
```

**Not in repo:** `node_modules` (run `npm install` when needed), `.netlify` (local link state), live secrets.

---

## Technology stack

| Layer | Technology |
|-------|------------|
| Front end | Vanilla HTML/CSS/JavaScript (no React/Vue build step) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Files | Supabase Storage (`patient-documents`) |
| Hosting | Netlify (static publish + Functions) |
| Payments | Paystack integration (`js/paystack-integration.js`) — configure per region |
| Offline | Service worker + localStorage hybrid cache |

---

## Multi-tenancy model

Every clinical/billing row is scoped by **`organization_id`** (UUID).

```
organizations
    └── users (staff, linked to auth.users)
    └── patients, appointments, clinical_notes, billing_*, pharmacy_*, …
```

Row Level Security (RLS) policies restrict SELECT/INSERT/UPDATE/DELETE to the authenticated user’s organization. Platform-level operations use Netlify Functions with the **service role** key.

---

## Authentication flows

### Clinic staff (`/login`)

1. `js/login-handler.js` / `js/supabase-auth.js`
2. Supabase Auth sign-in
3. Load user profile from `users` table → store in `localStorage.user`
4. Redirect to `dashboard.html`

### Platform admin (`/platform-login`)

1. `js/platform-login.js`
2. RPC `get_platform_admin_by_username` (via secure function) → email
3. Supabase Auth with platform admin credentials
4. Platform dashboard pages

### Patient portal (`/patient-login`)

Separate patient auth flow; see **`PATIENT-PORTAL-STATUS.md`**.

---

## Data loading pattern (hybrid)

Most pages rely on:

1. **`js/supabase-client.js`** — initializes client from `window.__SUPABASE_CONFIG__`
2. **`js/universal-data-loader.js`** — syncs Supabase → localStorage per org
3. Feature modules (`js/patients.js`, `js/billing.js`, …) — read/write with Supabase-first, localStorage fallback

Detailed architecture notes: **`HANDOVER-NOTE-HYBRID-ARCHITECTURE.md`**, **`HYBRID-ARCHITECTURE-AUDIT.md`**.

---

## Billing and currency

- **`js/billing.js`**: invoices, payments, `formatCurrency()`, `getDefaultCurrency()`
- **`js/currency-converter.js`**: multi-currency conversion (USD pivot); includes CAD
- **`js/payments.js`**, **`js/paystack-integration.js`**: checkout flows
- Org billing settings stored in localStorage keys like `{orgName}_billing_default_currency`

MediForge default: **CAD**. See **`docs/MEDIFORGE-PRODUCT-RULES.md`**.

---

## Netlify Functions

| Function | Purpose |
|----------|---------|
| `secure-supabase.js` | Privileged Supabase RPC/queries (service role) |
| `get-platform-legal-agreements.js` | Legal agreement content for registration |
| `appointment-reminders-daily.js` | Scheduled appointment SMS/email |
| `csp-report.js` | Content-Security-Policy violation reports |
| `send-security-email.js` | Security notification emails |

Functions read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Netlify environment variables.

---

## Build and deploy pipeline

**`netlify.toml`:**

```toml
command = "node scripts/inject-supabase-env.cjs && npm run check"
publish = "."
```

1. **`scripts/inject-supabase-env.cjs`** — writes `js/supabase-env.js` from Netlify env at build time
2. **`npm run check`** — `check:icons` + `check:patient-identity` guardrails

Local deploy (after owner approval):

```powershell
netlify deploy --prod --dir .
```

---

## Database setup

### Option A — Fresh MediForge (recommended)

1. New Supabase project
2. Import schema only: **`scripts/export-database-schema.ps1`** → `mediforge-schema.sql`
3. Optional: run migrations incrementally from `supabase/migrations/` if schema dump is incomplete
4. Create storage bucket + platform admin (see **`GO-LIVE-GUIDE.md`**)

### Option B — Supabase CLI linked project

If using Supabase CLI against a linked project:

```powershell
npx supabase db push
```

Requires `supabase link` and a configured project. Not required for initial go-live if using schema dump.

### SQL utilities

- **`sql-scripts/`** — one-off fixes, diagnostics (not auto-run)
- **`sql-scripts/create-platform-admin.sql`** — platform login setup
- **`sql-scripts/COMPLETE-SCHEMA-ALL-TABLES.sql`** — partial clinical tables only; **not** a full app schema

---

## Major feature areas

| Area | Entry pages / modules |
|------|------------------------|
| Patients | `patients.html`, `js/patients.js`, `js/supabase-patients.js`, `bulk-patient-import.html`, `js/bulk-patient-import.js` |
| Clinical notes | `clinical-note.html`, `patient-encounters.html` |
| Appointments | `appointments.html`, `js/appointments.js` |
| Billing | `billing-dashboard.html`, `js/billing.js` |
| Pharmacy | `pharmacy-dashboard.html`, `js/pharmacy-manager.js` |
| Labs & imaging orders | `select-lab-orders.html`, `select-imaging-orders.html`, `lab-order.html`, `imaging-order.html`, `js/diagnostic-order-picker.js`, `js/lab-code-resolver.js`, `config/diagnostic-*-catalog.json`, `config/ohip-*-fee-crosswalk.json`, `lib/billing/generate-lab-code-map.js`, `scripts/build-diagnostic-catalog.mjs` |
| In-patient | `inpatient-dashboard.html` |
| Platform admin | `platform-dashboard.html`, `js/platform-admin.js` |
| Security | `clinic-security-dashboard.html`, `security-monitoring.html` |

Feature guides: **`BILLING-SYSTEM-GUIDE.md`**, **`PLATFORM-ADMIN-GUIDE.md`**, **`INPATIENT-SETUP-GUIDE.md`**, etc. (indexed in **`docs/DOCUMENTATION-INDEX.md`**).

---

## Testing before deploy

1. **`npm run check`** — static guards
2. **`CRITICAL-WORKFLOWS.md`** — manual regression paths
3. Local server smoke test on changed pages
4. Owner explicit approval → single Netlify deploy with detailed message

---

## Related documentation

- **`docs/DOCUMENTATION-INDEX.md`** — full doc catalog
- **`docs/MEDIFORGE-PRODUCT-RULES.md`** — CAD, org, branding rules
- **`DEPLOYMENT-ENVIRONMENTS.md`** — dev/staging/prod branches
- **`docs/SUPABASE-DEV-STAGING-SETUP.md`** — separate Supabase projects per environment
