# SQL Injection Vulnerability Evaluation & Remediation Plan

**Date:** February 2026  
**Scope:** MediForge application – SQL injection risk assessment  
**Status:** FOR REVIEW – No changes implemented until approved

---

## Executive Summary

MediForge uses **Supabase** (PostgreSQL + PostgREST) with a mix of:
- **Client-side Supabase JS client** (`.from()`, `.eq()`, `.or()`, `.ilike()`)
- **Netlify secure-supabase proxy** (builds REST URLs for privileged operations)
- **Supabase RPCs** (server-side PostgreSQL functions with parameters)

**Overall risk: MODERATE.** The database layer (Supabase RPCs, PostgREST) uses parameterized queries. The main risks are:
1. **URL/query string injection** in the secure-supabase proxy when values are concatenated without encoding
2. **Filter expression injection** when user input is interpolated into `.or()` / `.ilike()` filter strings
3. **Missing input validation** before values reach the database

---

## 1. Vulnerability Assessment

### 1.1 LOW RISK – Supabase RPCs (Database Functions)

| Location | Pattern | Risk |
|----------|---------|------|
| `get_platform_admin_by_username(p_username)` | `WHERE LOWER(TRIM(username)) = LOWER(TRIM(p_username))` | **Safe** – parameterized |
| `get_audit_logs(p_action_filter, p_hours, p_limit)` | Compares `p_action_filter` to fixed strings | **Safe** – parameterized |
| Other RPCs in migrations | Use `$1`, `$2` style parameters | **Safe** |

**Conclusion:** Server-side PostgreSQL functions use proper parameterization. No raw SQL concatenation found in migrations.

---

### 1.2 MODERATE RISK – Netlify secure-supabase.js

| Location | Issue | Attack Vector |
|----------|-------|---------------|
| Lines 197, 331, 432, 535 | `id=eq.${p_user_id}` – `p_user_id` concatenated into URL without encoding | If `p_user_id` contains `&`, `)`, or `,`, the query structure can be altered. Example: `p_user_id = "x&id=eq.true"` → `id=eq.x&id=eq.true` |
| Lines 703, 730, 804 | Similar pattern for `p_submission_id`, `organization_id` | Same risk if values are not strictly validated |
| Lines 868–885 (select handler) | `filters` object: keys and values from client payload used in URL | Attacker could send `filters: { "id; DROP TABLE--": "x" }`. Keys are not whitelisted. `value.join(',')` for arrays is not encoded. |
| Line 889 | `order.column` from payload used in URL | If `order.column` is user-controlled, could inject (e.g. `id;DELETE FROM users--`) |

**Mitigation needed:**
- Use `encodeURIComponent()` for all values interpolated into URLs
- Whitelist allowed filter column names against the table schema
- Validate `order.column` against allowed columns
- Validate `p_user_id` as UUID before use (already done for `p_auth_user_id`, but `p_user_id` is less strict)

---

### 1.3 MODERATE RISK – Client-Side Supabase .or() / .ilike() with User Input

| File | Pattern | User Input Source | Risk |
|------|---------|------------------|------|
| `setup-patient-portal.html` | `.or(\`first_name.ilike.%${searchTerm}%,...\`)` | Search box | `searchTerm` with `%`, `,`, `)` can break or broaden the filter |
| `find-missing-clinic.html` | `.or(\`username.ilike.%${searchTerm}%,...\`)` | Search box | Same |
| `js/supabase-patients.js` | `.or(\`firstName.ilike.%${query}%,...\`)` | Patient search | Same |
| `js/patients-supabase.js` | `.or(\`first_name.ilike.%${query}%,...\`)` | Patient search | Same |
| `js/adapters/supabase-adapter.js` | Same pattern | Search | Same |
| `unlock-user-account.html` | `.or(\`identifier.eq.${identifier},...\`)` | Identifier input | `identifier` with `,` or `)` could inject extra conditions |
| `js/legal-agreements.js` | `.or(\`email.eq.${adminEmail},...\`)` | adminEmail | Same |
| `lab-result-entry.html` | `.or(\`id.eq.${orderData.created_by},...\`)` | From order record | Lower risk – data from DB, but could be poisoned if order creation is compromised |
| `doctor-lab-results.html`, `lab-scientist-lab-results.html` | `.or(\`id.eq.${username},...\`)` | From session | Lower risk – username from auth |
| `select-lab-orders.html`, `select-imaging-orders.html` | `.or(\`patient_id.eq.${patientId}\`)` | URL param / user selection | `patientId` could be manipulated in URL |
| `inpatient-dashboard.html` | Multiple `.or()` with patient/admission IDs | Various | Same pattern |

**Note:** Supabase PostgREST uses these filter strings to build parameterized queries. The risk is **filter logic manipulation** (e.g. broadening a search to match more rows) rather than classic SQL injection. However, special characters in user input can cause unexpected behavior or errors.

**Mitigation needed:**
- Sanitize search terms: escape `%`, `_`, `,`, `(`, `)` for `ilike` patterns
- Validate identifiers (UUID, patient_id format) before use in `.eq()` filters
- Use a shared sanitization helper (e.g. `Validation.sanitizeForFilter()`)

---

### 1.4 GOOD PRACTICE – get-platform-legal-agreements.js

```javascript
const userCheckUrl = `...&or=(email.eq.${encodeURIComponent(searchEmail)},username.eq.${encodeURIComponent(searchEmail)})...`;
```

Uses `encodeURIComponent()` for user input. **Use this as the pattern** for similar cases.

---

## 2. Existing Protections

| Layer | Protection |
|-------|------------|
| **Row Level Security (RLS)** | All tables have RLS. Users only access rows for their organization. |
| **Secure proxy whitelist** | `secure-supabase.js` only allows specific RPCs and tables (`ALLOWED_RPCS`, `ALLOWED_TABLE_SELECTS`). |
| **UUID validation** | Password reset flow validates `p_auth_user_id` as UUID. |
| **Validation module** | `universal-data-loader.js` exposes `Validation.sanitizeString`, `validateUUID`, etc. |
| **Service role isolation** | Privileged RPCs run as `service_role`; not callable by regular users. |

---

## 3. Plan of Action (No Implementation Until Approved)

### Phase 1: secure-supabase.js (Netlify Function)

| Step | Change | Backward Compatibility |
|------|--------|-------------------------|
| 1.1 | Encode all values in URL: `id=eq.${encodeURIComponent(p_user_id)}` | Yes – encoded values decode to same string for valid inputs |
| 1.2 | Define allowed columns for `audit_logs` (e.g. `timestamp`, `action`, `username`). Reject filters with unknown keys. | Yes – only restricts invalid keys |
| 1.3 | Validate `order.column` against allowed list before use | Yes – current usage uses known columns |
| 1.4 | Encode array values in `in.()`: `value.map(v => encodeURIComponent(v)).join(',')` | Yes – safe for UUIDs and normal strings |
| 1.5 | Add UUID validation for `p_user_id` where it is used in URL (same as `p_auth_user_id`) | Yes – `p_user_id` is expected to be UUID when provided |

### Phase 2: Client-Side Filter Sanitization

| Step | Change | Backward Compatibility |
|------|--------|-------------------------|
| 2.1 | Add `Validation.sanitizeForSupabaseFilter(value)` in `universal-data-loader.js`: escape `%`, `_`, `,`, `(`, `)` for ilike; reject or sanitize for eq | Yes – normal input unchanged |
| 2.2 | Apply to all search/filter inputs before `.or()` / `.ilike()` | Yes – only affects malicious input |
| 2.3 | Validate `patientId`, `orderId`, `identifier` as UUID or allowed format before use in filters | Yes – valid IDs pass; invalid rejected |
| 2.4 | For `orderData.created_by` in lab-result-entry: validate format (UUID or alphanumeric) before use | Yes – current valid values pass |

### Phase 3: Input Validation at Boundaries

| Step | Change | Backward Compatibility |
|------|--------|-------------------------|
| 3.1 | Ensure all URL params (`patientId`, `orderId`, `testName`) are validated before Supabase calls | Yes – invalid params already cause errors; validation makes behavior explicit |
| 3.2 | Add max length for search terms (e.g. 200 chars) to prevent DoS-style long inputs | Yes – normal searches well under limit |

### Phase 4: Testing & Verification

| Step | Action |
|------|--------|
| 4.1 | After each phase: run existing flows (login, patient search, lab orders, lab result entry, audit logs) |
| 4.2 | Test with malicious inputs: `' OR '1'='1`, `%; DROP TABLE`, `x&id=eq.true` in dev |
| 4.3 | Deploy to dev first; verify no regressions before staging/production |

---

## 4. Files to Modify (Proposed)

| File | Changes |
|------|---------|
| `netlify/functions/secure-supabase.js` | Encode URL params; whitelist filter keys; validate order.column |
| `js/universal-data-loader.js` | Add `sanitizeForSupabaseFilter()` |
| `setup-patient-portal.html` | Sanitize searchTerm before .or() |
| `find-missing-clinic.html` | Sanitize searchTerm |
| `js/supabase-patients.js` | Sanitize query |
| `js/patients-supabase.js` | Sanitize query |
| `js/adapters/supabase-adapter.js` | Sanitize searchTerm |
| `unlock-user-account.html` | Validate/sanitize identifier |
| `js/legal-agreements.js` | Validate adminEmail format |
| `select-lab-orders.html` | Validate patientId before .or() |
| `select-imaging-orders.html` | Validate patientId |
| `inpatient-dashboard.html` | Validate patient/admission IDs |
| `lab-result-entry.html` | Validate orderData.created_by format |
| `subscription-invoice.html` | Validate orgData.id, orgName |

---

## 5. Risk if No Action Taken

- **URL injection in secure-supabase:** A platform admin or attacker with proxy access could manipulate filter/order parameters to read or affect more data than intended.
- **Filter manipulation:** A user could craft search input to match more rows (e.g. all patients) or cause errors.
- **Defense in depth:** Current RLS limits impact, but fixing these issues improves resilience and audit posture.

---

## 6. Recommendation

Proceed with **Phase 1** (secure-supabase.js) first, as it protects the highest-privilege path. Then **Phase 2** for client-side filters. Phases 3 and 4 can run in parallel with Phase 2.

**No code changes will be made until you approve this plan.**
