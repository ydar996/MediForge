# MediForge Cybersecurity Assessment

**Date:** February 2025  
**Last Updated:** February 2025 (post CSP + audit-log IP + patient rate limit)  
**Scope:** Authentication, rate limiting, audit logging, data access, CORS/CSP, session management, encryption

---

## Overview

MediForge is a multi-tenant healthcare EHR serving three user types: **platform admins** (super-admins who manage all clinics), **organization staff** (doctors, nurses, pharmacists at clinics), and **patients**. Security is implemented via Supabase Auth, a Netlify secure proxy, and a hybrid local/cloud architecture.

---

## Recent Security Hardening (February 2025)

The following changes were implemented and deployed:

1. **Platform admin authentication – Supabase Auth only**
   - Removed legacy fallback that used hardcoded credentials in JavaScript
   - Platform login now uses Supabase Auth exclusively
   - All platform admins must exist in Supabase Auth and in the `platform_admins` table

2. **Removal of credentials from source code**
   - Removed hardcoded usernames and Base64-encoded passwords from `platform-admin.js`
   - Removed `validatePlatformLogin` and `refreshPlatformAdmins` functions
   - One-time cleanup removes legacy `platformAdmins` from localStorage on load

3. **Platform admin setup**
   - New platform admins: create user in Supabase Dashboard → Authentication → Users
   - Insert row into `platform_admins` with `auth_user_id`, `username`, `email` (see `RUN_THIS_add_platform_admins.sql`)

4. **CSP hardening (February 2025)**
   - Removed `'unsafe-eval'` from `script-src` in Content-Security-Policy
   - Reduces XSS risk; `'unsafe-inline'` remains for inline scripts (full nonce/hash rollout not yet done)

5. **Audit log IP capture (February 2025)**
   - `getClientIP` in `secure-supabase.js` now checks: `x-forwarded-for`, `x-real-ip`, `x-nf-client-connection-ip`, `cf-connecting-ip`, `true-client-ip`, `x-client-ip`, `client-ip`
   - Improves forensics for proxy-originated audit events; flows that bypass the proxy may still have null IP

6. **Patient login rate limiting (February 2025)**
   - Added `patient_login` type: 5 attempts / 15 min, 15 min lockout
   - Migration `20260214000002_patient_login_rate_limit.sql` extends `check_rate_limit`
   - `rate-limiter.js`: added `patient_login` to RATE_LIMIT_CONFIG
   - `patient-auth.js`: check before login, record failed attempts, clear on success
   - `patient-login.html`: loads `rate-limiter.js`

---

## 1. Authentication

| User Type | Method | Notes |
|-----------|--------|-------|
| **Platform admins** | Supabase Auth only | `platform_admins` table maps username → Supabase Auth user. No fallback. |
| **Organization staff** | Supabase Auth | Email/password via Supabase Auth. Supports SHA-256 for legacy users. |
| **Patients** | Supabase Auth | Login via `users` linked to Supabase Auth. Temporary passwords for first login. |

**Platform admin flow:** User enters username → RPC `get_platform_admin_by_username` returns email and `auth_user_id` → `signInWithPassword` with email and password → session stored in localStorage. No credentials are stored in code or localStorage.

---

## 2. Rate Limiting

| Flow | Limit | Storage |
|------|--------|---------|
| **Org login** | 5 attempts / 15 min | Supabase + localStorage fallback |
| **Platform login** | 3 attempts / 15 min, 30 min lockout | Supabase |
| **Patient login** | 5 attempts / 15 min, 15 min lockout | Supabase |
| **Patient intake** | 10 submissions / hour per IP | Supabase |

- Stored in Supabase for cross-device consistency
- Permanent lockout possible after repeated failures
- Platform admins can unlock accounts and reset passwords via secure proxy RPCs

---

## 3. Audit Logging

- **Storage:** Supabase `audit_logs` table
- **Events:** Logins, logouts, patient views, clinical notes, prescriptions, billing, data exports, etc.
- **Context:** Username, role, organization, IP (when available), user agent
- **Access:** Platform admins via secure proxy (bypasses RLS)
- **Realtime:** Security Operations dashboard subscribes to `audit_logs` for live updates (60s poll + WebSocket)

---

## 4. Data Access Control (Row Level Security)

- **Patients:** Staff see only their organization’s patients; patients see only their own record
- **Users:** Staff see only users in their organization
- **Organizations:** Users see only their own organization
- **Other tables:** Inventory, orders, prescriptions, legal agreements, etc. scoped by organization

RLS is enforced at the database level. The secure proxy uses the service role for platform-admin operations (e.g. audit_logs, rate limits).

---

## 5. Secure API Proxy

- **Netlify function:** `secure-supabase.js` proxies privileged calls to Supabase using the service role
- **Whitelist:** Only approved RPCs and table operations (e.g. `get_platform_admin_by_username`, `check_rate_limit`, `audit_logs` insert)
- **Client IP:** Captured from headers for audit logging (x-forwarded-for, x-nf-client-connection-ip, cf-connecting-ip, etc.)
- **CORS:** Origin allowlist (Netlify, localhost, `ALLOWED_ORIGINS`)

---

## 6. CORS and CSP

- **CORS:** Restricted to allowed origins. Unknown origins receive a non-matching origin so the browser blocks the request.
- **CSP:** Content-Security-Policy in `netlify.toml` restricts script sources, connect targets (including `wss://` for Supabase Realtime), and form actions.
- **CSP reporting:** `report-uri` sends violations to `csp-report` Netlify function for monitoring.

---

## 7. Session Management

- **Timeout:** 30 minutes of inactivity
- **Warning:** 2 minutes before logout, then 10-second countdown
- **Activity tracking:** Mouse, keyboard, scroll, touch, etc.
- **Storage:** Session in localStorage; Supabase JWT auto-refreshed

---

## 8. Data Encryption

- **At rest (optional):** Client-side encryption for sensitive patient data via `encryption.js` (PBKDF2 + AES). Key derived from master password; optional per organization.
- **In transit:** HTTPS (Netlify, Supabase)
- **Passwords:** Supabase Auth uses bcrypt; legacy org users use SHA-256

---

## 9. Security Monitoring Dashboards

- **Security Operations Center:** `security-monitoring.html` – auto-refresh every 60s, Supabase Realtime, Live indicator
- **Security logs:** `security-logs.html` – login history, locked accounts
- **Platform security dashboard:** `platform-security-dashboard.html` – cross-org events (uses `platformAdmin` from localStorage)

---

## Outstanding Weaknesses

### 1. **CSP Permissive Script Directives**
- `'unsafe-eval'` removed (Feb 2025); `'unsafe-inline'` remains in `script-src` and `style-src`
- Many pages rely on inline scripts; removing these would require significant refactoring
- **Risk:** Inline scripts can be exploited if an XSS vulnerability exists
- **Fix:** Refactor to nonces or hashes to remove `unsafe-inline` (nonce plugin failed on Windows)

### 2. **IP Address in Audit Logs**
- `getClientIP` improved (Feb 2025) to check multiple headers; proxy flows should capture IP more reliably
- Flows that bypass the secure proxy may still have `ip_address` null
- **Impact:** Limited forensics for non-proxy flows; harder to trace attacks by source IP

### 3. **No Rate Limiting on Patient Login** ✅ Fixed (February 2025)
- Patient login now rate limited: 5 attempts / 15 min, 15 min lockout
- Added `patient_login` type to `check_rate_limit`, `rate-limiter.js`, and `patient-auth.js`

### 4. **Session Storage in localStorage**
- Sessions stored in localStorage (not httpOnly cookies)
- **Risk:** XSS could read tokens and hijack sessions
- **Mitigation:** CSP and input validation; consider httpOnly cookies where possible

### 5. **Input Validation**
- **Progress (Feb 2025):** Central validation in `js/validation.js`; `validateLoginInput` added for login forms. Patient login uses it for username/password sanitization and length checks. Remaining: expand to other forms (org login, platform login, patient intake).

### 6. **Third-Party Scripts**
- `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `js.paystack.co` in CSP
- **Risk:** Compromise of these CDNs could affect the app (supply-chain attack)
- **Progress (Feb 2025):** patient-login.html uses pinned Supabase (2.39.3) + SRI. See `SECURITY-THIRD-PARTY-SCRIPTS.md` for hashes and rollout to other pages. Paystack cannot be SRI'd (no version pinning).

---

## Summary Table

| Area | Status | Notes |
|------|--------|-------|
| Auth (org staff) | ✅ Strong | Supabase Auth, rate limited |
| Auth (platform admin) | ✅ Strong | Supabase Auth only; no credentials in code |
| Auth (patients) | ✅ Good | Supabase Auth, rate limited (5/15 min) |
| Rate limiting | ✅ Good | Org + platform + patient + intake |
| Audit logging | ✅ Good | Broad coverage, Realtime |
| RLS / data access | ✅ Good | Org-scoped, patient-scoped |
| CORS | ✅ Hardened | Origin allowlist |
| CSP | ⚠️ Partial | `unsafe-eval` removed; `unsafe-inline` remains |
| Session timeout | ✅ Good | 30 min |
| Encryption (optional) | ✅ Good | Client-side per org |
| Credentials in code | ✅ None | Platform admin credentials removed |

---

## Bottom Line

Platform admin authentication has been hardened: Supabase Auth only, no hardcoded credentials, no legacy fallback. CSP no longer uses `unsafe-eval`; audit log IP capture is improved for proxy flows; patient login is now rate limited. Multi-tenant security, rate limiting, audit logging, and RLS are in place. Remaining priorities: CSP `unsafe-inline` removal (nonces/hashes), httpOnly cookies for session storage, and reducing reliance on third-party scripts.
