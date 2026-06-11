# Security audit: outdated components and public exposure

**Date:** May 2026  
**Scope:** MediForge repo, Netlify deploy (dev / staging / production), Supabase  
**Status:** Tier A complete — Tier B library updates complete (May 2026)

---

## Executive summary

The app has **two kinds of problems**:

1. **Critical exposure (not a library CVE):** secrets and admin tools were reachable on the public website.
2. **Outdated dependencies:** some JavaScript libraries and dev tools are behind supported versions.

Tier **A** must be done first (especially **rotating Supabase keys**). Tiers B and C are documented here for follow-up.

---

## Findings by severity

### Critical — public exposure

| Issue | Evidence | Risk |
|--------|----------|------|
| **`supabase-credentials.txt` on the live site** | Fetched from prod and dev URLs (May 2026) | Service role key + DB password = full database access, bypasses RLS |
| **Admin / recovery / test pages deployed** | e.g. `unlock-all-locked-accounts.html` on production | Extra attack surface; some tools change auth or data |
| **Entire repo published** | `publish = "."` in `netlify.toml` | `sql-scripts/`, backup folders, migration tools exposed unless blocked |

### High — outdated libraries (production)

| Component | Version in use | Notes |
|-----------|----------------|-------|
| **jsPDF** | 2.5.1 (cdnjs) | Used on subscription/legal PDF pages; CVEs fixed in 3.0.1+ / 4.x |
| **Supabase JS** | 2.45.0 vendored + unpinned `@2` on many HTML files | Stale; supply-chain drift on CDN copies |

### Medium — dev/build only

| Component | Version | Notes |
|-----------|---------|-------|
| **Puppeteer** | 23.11.1 (deprecated) | Dev PDF/screenshots only |
| **npm audit** | 3 issues (1 high, 2 moderate) | Transitive via Puppeteer; `npm audit fix` |

### Low / architectural

| Issue | Notes |
|--------|-------|
| **html2canvas 1.4.1** | Old; clinical/PDF flows — monitor |
| **CSP `unsafe-inline`** | Weakens XSS protection; hard to remove quickly |
| **Unpinned Netlify Node** | Functions use Netlify default runtime |

### Managed by vendor (OK if you keep config current)

- Netlify hosting OS/runtime  
- Supabase Postgres / Auth host patches  
- Your responsibility: RLS, migrations, env vars in Netlify (not in git)

---

## Remediation tiers

### Tier A — do first (critical)

| ID | Action | Owner | Repo / ops |
|----|--------|-------|------------|
| **A1** | **Rotate** Supabase service role key + database password | **You (Supabase Dashboard)** | [Key rotation guide](./ROTATE-SUPABASE-KEYS-AFTER-EXPOSURE.md) |
| **A2** | Remove `supabase-credentials.txt` from repo; `.gitignore`; example template only | Agent | Done in repo |
| **A3** | Block sensitive URLs on Netlify (`_redirects` + `netlify.toml`) | Agent | Done in repo |
| **A4** | Block public access to internal admin/diagnostic HTML (keep files for local use) | Agent | Done in repo |

**Tier A is NOT complete until A1 is done in Supabase and Netlify env vars are updated.**

**Tier A is complete** (keys rotated, legacy JWT disabled, credentials file removed/blocked).

### Tier B — library updates (complete May 2026)

| ID | Action | Status |
|----|--------|--------|
| **B1** | jsPDF **4.2.1** on subscription/legal/dashboard PDF pages | Done — CDN pins via `npm run sync:vendor` |
| **B2** | `@supabase/supabase-js` **2.106.1** vendored + pinned CDN | Done — `js/vendor/supabase.min.js` |
| **B3** | `npm audit fix`; Puppeteer **≥ 25** | Done — 0 npm audit vulnerabilities |
| **B4** | html2canvas review | Done — **1.4.1** is latest on npm; pinned on all CDN refs; used for DOM capture before PDF on clinical/billing pages; no newer release to adopt |

Regenerate pins: `npm run sync:vendor` (see `js/vendor/vendor-manifest.json`).

### Tier C — hardening (later)

| ID | Action |
|----|--------|
| **C1** | Pin `NODE_VERSION` in Netlify |
| **C2** | Tighten CSP (reduce `unsafe-inline`) |
| **C3** | Add `npm audit` to CI |
| **C4** | Quarterly dependency + Supabase advisor review |

---

## Tier A remediation log

| Step | Status | Notes |
|------|--------|-------|
| A2 Remove credentials file | Done | Deleted; example + gitignore |
| A3 URL blocks | Done | `_redirects` (278 rules) |
| A4 Block admin tools | Done | Generator script; product pages exempt |
| A1 Key rotation | Done | Publishable + secret keys; legacy JWT disabled |

---

## Pages intentionally NOT blocked (product features)

These stay reachable for logged-in staff/admins:

- Main app: `login`, `dashboard`, `patients`, `clinical-note`, billing, etc.
- `platform-login`, `platform-dashboard`, `manage-clinics` (platform admin auth)
- `recover-encryption`, `setup-encryption` (encryption recovery on dashboard)
- `org-user-management`, `data-import-export`, security dashboards linked from dashboard

Internal tools remain in the repo for **local** use (`http://127.0.0.1:5500/...`) but return **404 on Netlify** after deploy.

---

## Verification after deploy

```text
# Should return 404 (not file contents):
https://mediforge.netlify.app/supabase-credentials.txt
https://mediforge.netlify.app/unlock-all-locked-accounts
https://mediforge.netlify.app/sql-scripts/check-which-security-migrations-ran.sql

# Should still work:
https://mediforge.netlify.app/login
https://mediforge.netlify.app/dashboard
https://mediforge.netlify.app/recover-encryption
```

Repeat on dev and staging.

---

## References

- npm audit: run `npm audit` in project root  
- Supabase advisors: `npm run db:security-advisors`  
- Prior notes: `CYBERSECURITY-REMAINING-TASKS-AND-ASSESSMENT.md`, `AGENT-HANDOVER.md`
