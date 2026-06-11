# Agent Handover – MediForge Security & Deployment (February 2025)

**Date:** February 10, 2025  
**Scope:** Cybersecurity fixes 1–4, deployment to Dev/Staging/Prod, documentation updates

---

## 1. Where to Find Netlify Site IDs

**File:** `NETLIFY-SITE-IDS.txt` (project root)

```
Netlify Site IDs

Dev: OLD-SITE-ID-REMOVED-CREATE-NEW-SITE
Staging: OLD-SITE-ID-REMOVED-CREATE-NEW-SITE
Prod: OLD-SITE-ID-REMOVED-CREATE-NEW-SITE
```

---

## 2. Everything Done in This Session

### Fix 1: CSP – Remove `unsafe-eval` ✅

| Item | Detail |
|------|--------|
| **Files** | `netlify.toml`, `package.json` |
| **Changes** | Removed `'unsafe-eval'` from `script-src` in Content-Security-Policy |
| **Reverted** | Tried `@netlify/plugin-csp-nonce`; it failed on Windows (`mkdir -p` incompatibility). Removed plugin from `netlify.toml`, removed dependency from `package.json`, deleted `DEV-CSP-ROLLOUT.md` |
| **Deployed** | Dev, Staging, Production |

### Fix 2: Audit Log IP Capture ✅

| Item | Detail |
|------|--------|
| **File** | `netlify/functions/secure-supabase.js` |
| **Change** | Extended `getClientIP()` to check: `x-forwarded-for`, `x-real-ip`, `x-nf-client-connection-ip`, `cf-connecting-ip`, `true-client-ip`, `x-client-ip`, `client-ip` |
| **Deployed** | Dev, Staging, Production |

### Fix 3: Patient Login Rate Limiting ✅

| Item | Detail |
|------|--------|
| **New file** | `supabase/migrations/20260214000002_patient_login_rate_limit.sql` – extends `check_rate_limit` for `patient_login` (5 attempts / 15 min, 15 min lockout) |
| **Modified** | `js/rate-limiter.js` – added `patient_login` to RATE_LIMIT_CONFIG; updated localStorage fallback for lockout types |
| **Modified** | `js/patient-auth.js` – rate limit check before login, record failed attempts, clear on success |
| **Modified** | `patient-login.html` – loads `rate-limiter.js` |
| **Deployed** | Dev (frontend only) |
| **Pending** | Migration must be run on Supabase before patient rate limiting works |

### Fix 4: Session Storage in httpOnly Cookies ❌

| Item | Detail |
|------|--------|
| **Status** | Not implemented |
| **Reason** | Requires backend and different auth flow. Supabase Auth uses localStorage by default; this is a static Netlify site with no backend for cookie handling. |

### Documentation Updates ✅

| File | Changes |
|------|---------|
| `CYBERSECURITY-ASSESSMENT.md` | Added items 4–6 to Recent Security Hardening; updated Rate Limiting table; updated Outstanding Weaknesses; updated Summary Table and Bottom Line |
| `AGENT-HANDOVER-CYBERSECURITY-2025.md` | Created (this file) |

### Git Commits

- `Security: Fix 1 & 2 in dev - CSP remove unsafe-eval, audit log IP capture` (netlify.toml, package.json, netlify/functions/secure-supabase.js)

---

## 3. Deployment Instructions

### User’s Deployment Order

**Always deploy in this order:** Dev → Staging → Production. Test on Dev before promoting.

### Where to Find Site IDs

**File:** `NETLIFY-SITE-IDS.txt` (project root)

### Commands (PowerShell, Windows)

Use `;` instead of `&&` for command chaining on Windows PowerShell.

```powershell
cd c:\Users\yinka\Documents\MediForge

# 1. Deploy to Dev (test first)
npx netlify deploy --prod --site OLD-SITE-ID-REMOVED-CREATE-NEW-SITE

# 2. Deploy to Staging
npx netlify deploy --prod --site OLD-SITE-ID-REMOVED-CREATE-NEW-SITE

# 3. Deploy to Production
npx netlify deploy --prod --site OLD-SITE-ID-REMOVED-CREATE-NEW-SITE
```

### Alternative: deploy-with-message.ps1

```powershell
.\deploy-with-message.ps1 -SiteId OLD-SITE-ID-REMOVED-CREATE-NEW-SITE -Prod   # Dev
.\deploy-with-message.ps1 -SiteId OLD-SITE-ID-REMOVED-CREATE-NEW-SITE -Prod   # Staging
.\deploy-with-message.ps1 -SiteId OLD-SITE-ID-REMOVED-CREATE-NEW-SITE -Prod   # Production
```

### Live URLs

| Environment | URL |
|-------------|-----|
| Dev | https://mediforge-dev.netlify.app |
| Staging | https://mediforge-staging.netlify.app |
| Production | https://mediforge.netlify.app |

---

## 4. Supabase Migration Required (Fix 3)

Patient login rate limiting will not work until the migration is applied.

**Migration:** `supabase/migrations/20260214000002_patient_login_rate_limit.sql`

```bash
# If Supabase is linked
npx supabase db push
```

Or run the SQL manually in Supabase Dashboard → SQL Editor. Supabase may not be linked; migrations may need manual application.

---

## 4b. Session 2 (February 2025) – Additional Hardening

| Item | Detail |
|------|--------|
| **Input validation** | Added `validateLoginInput` to `js/validation.js`; patient-login.html validates and sanitizes username/password before submit; patient-auth.js uses sanitization for rate-limit identifier |
| **Third-party SRI** | patient-login.html: Supabase pinned to 2.39.3 + SRI. Created `SECURITY-THIRD-PARTY-SCRIPTS.md` with hashes for Supabase, jsPDF, html2canvas, Chart.js |
| **Deployed** | Not yet – deploy to Dev first, then Staging/Prod |

---

## 5. Outstanding Work

### From CYBERSECURITY-ASSESSMENT.md

| # | Weakness | Status |
|---|----------|--------|
| 1 | **CSP `unsafe-inline`** | Not done – needs nonces/hashes (nonce plugin failed on Windows) |
| 2 | **IP in audit logs** | Partially done – flows bypassing proxy may still have null IP |
| 4 | **Session storage in localStorage** | Not done – move to httpOnly cookies |
| 5 | **Input validation** | Done – patient-login uses Validation.validateLoginInput; Validation.js extended with validateLoginInput |
| 6 | **Third-party scripts** | In progress – patient-login has Supabase pinned + SRI; see SECURITY-THIRD-PARTY-SCRIPTS.md |

### Other Follow-Up

| Item | Detail |
|------|--------|
| **Fix 3 to Staging/Prod** | Patient rate limiting deployed to Dev only. Staging and Prod still need this deploy after migration is run. |
| **Git** | Work is on `dev` branch. Push to appropriate branch before deploying to production. |

---

## 6. Key Files Reference

| Purpose | Path |
|---------|------|
| Site IDs | `NETLIFY-SITE-IDS.txt` |
| Security assessment | `CYBERSECURITY-ASSESSMENT.md` |
| CSP config | `netlify.toml` |
| Secure proxy (IP, CORS) | `netlify/functions/secure-supabase.js` |
| Rate limiter | `js/rate-limiter.js` |
| Patient auth | `js/patient-auth.js` |
| Patient login page | `patient-login.html` |
| Patient rate limit migration | `supabase/migrations/20260214000002_patient_login_rate_limit.sql` |
| Third-party scripts (SRI) | `SECURITY-THIRD-PARTY-SCRIPTS.md` |
| Central validation | `js/validation.js` (validateLoginInput) |

---

## 7. Environment Notes

- **OS:** Windows (PowerShell)
- **Shell:** Use `;` instead of `&&` for chaining commands
- **Supabase:** Project may not be linked; migrations may need manual application
- **Git branch:** Work is on `dev`; push to appropriate branch before production deploy
