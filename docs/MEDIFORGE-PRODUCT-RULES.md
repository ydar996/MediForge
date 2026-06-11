# MediForge product rules

These rules define how MediForge differs from the legacy codebase it was forked from. Agents and developers must follow them for all new work.

**Last updated:** June 11, 2026

---

## 1. Branding

- Product name: **MediForge** (display), **mediforge** (package/npm, URLs).
- Do not introduce “EHR Africa”, “EHR-Africa”, or “ehrafrica” in:
  - User-visible HTML text
  - New documentation
  - localStorage keys (use `mediForge.*` prefix for new keys)
  - Netlify site names intended for this product
- Internal API prefixes renamed from `ehr*` to `mf*` (e.g. `js/mediforge-org-patient-id.js`). Do not add new `ehr-*` filenames or `window.ehr*` globals.

---

## 2. Default currency: CAD

| Context | Expected behavior |
|---------|-------------------|
| New organization registration | `Canada` → CAD; unknown country → **CAD** (not USD) |
| `getDefaultCurrency()` | Returns saved org setting, else **CAD** |
| Subscription plan defaults | Base currency **CAD** in `js/platform-admin.js` |
| Currency converter | CAD in `EXCHANGE_RATES` and `CURRENCY_INFO` |
| Per-org override | Billing settings and org `currency` column still win |

**Mecure Clinics exception:** After login, if org name contains “mecure”, `js/universal-data-loader.js` may set billing default to **NGN** — intentional for that clinic’s operations.

---

## 3. Organizations

### Fresh database policy

MediForge uses a **dedicated Supabase project** with **no pre-seeded organizations**.

| Who | How they get access |
|-----|---------------------|
| **Mecure Clinics** | Owner registers via `/register` as the **first** organization after go-live |
| **All other clinics** | Must complete `/register` (new org flow) — no manual seeding in production |
| **Platform admin** | Created via `sql-scripts/create-platform-admin.sql` + Supabase Auth user |

### Do not

- Copy organization rows from a legacy database into MediForge production without explicit owner approval.
- Run org-specific SQL (MFASC, MIN-2026-*, Vortexsphere, etc.) unless that org exists in this database.

### Registration flow

`js/register-handler.js`:

1. Looks up org by name in `organizations`.
2. If missing and form is “new org”, creates org with generated `org_code` and country-based currency.
3. Creates auth user and `users` row linked to `organization_id`.

---

## 4. Data and privacy

- **No patient data** in the MediForge repo (no backup JSON dumps in git).
- Schema export (`scripts/export-database-schema.ps1`) is **structure only**.
- Tenant isolation via `organization_id` + RLS — never weaken RLS for convenience.

---

## 5. Configuration

| Setting | Where |
|---------|--------|
| Browser Supabase URL/key | `js/supabase-env.js` or Netlify build injection |
| Server Supabase key | Netlify env `SUPABASE_SERVICE_ROLE_KEY` only |
| File uploads | Supabase Storage bucket **`patient-documents`** (private) |

Placeholder values in `js/supabase-env.js` must be replaced before production use.

---

## 6. Deployments

Same as **`AGENT-HANDOVER.md`**: explicit approval, dev first, one batched deploy with detailed message.

---

## Change log

| Date | Change |
|------|--------|
| 2026-06-11 | Initial rules document at MediForge fork |
