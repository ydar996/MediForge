# Scalability & isolation: Netlify Functions coverage register

**Purpose:** Every serverless function under `netlify/functions/*.js` is classified and reviewed for **timeout/memory limits**, **unbounded work** (loops, full-table scans), **tenant isolation** (service role, missing `organization_id`), and **abuse** (auth, rate limits). Complements `SCALABILITY-PAGE-COVERAGE.md` (browser entry points).

**Parent plan:** `docs/SCALABILITY-AND-ISOLATION-IMPLEMENTATION-PLAN.md`: treat this register as a **Phase 0 deliverable** for backend entry points.

**Scope:** `netlify/functions/**/*.js` (currently flat `*.js` only). If you add subfolders or new handlers, **append a row** or regenerate via the script below.

---

### Tier definitions (functions)

| Tier | Meaning | Scalability focus | Isolation / security focus |
|------|---------|-------------------|----------------------------|
| **A** | Handles PHI, multi-tenant data, or **service-role** Supabase access | Batch size, timeouts, pagination inside the function | Strict org scoping, auth on every path, no arbitrary RPC/table |
| **B** | Scheduled (cron), bulk notifications, or cross-org reads for platform ops | Fan-out limits, idempotency, retries | Secrets, least privilege, audit who triggered |
| **C** | Public or semi-public read-only with no tenant mutation | Caching, response size | Input validation, no secrets in response |
| **D** | Telemetry / health / CSP reports only | Log volume, payload caps | DoS-friendly (cheap 204), optional rate limit |

---

### Column legend

| Column | Values |
|--------|--------|
| **Tier** | A / B / C / D (required) |
| **Scalability** | Pending / N/A / Done: timeouts, batching, cold-start impact |
| **Isolation** | Pending / N/A / Done: org boundaries, auth, service-role guardrails |
| **Trigger** | HTTP path, cron schedule, or internal |
| **Notes** | Tables/RPCs touched, env vars, link to `SCALABILITY-INVENTORY.md` |

---

## Coverage table

| Function | Tier | Scalability | Isolation | Trigger | Notes |
|----------|------|-------------|-----------|---------|-------|
| `appointment-reminders-daily.js` | | | | Cron / scheduled | Batch appointments, SMS/notifications, `CRON_SECRET`; cap orgs per run if needed |
| `csp-report.js` | | | | `POST /.netlify/functions/csp-report` | CSP reports; low PHI; consider size limits / abuse |
| `get-platform-legal-agreements.js` | | | | HTTP | Platform legal content; confirm cache + no leakage |
| `secure-supabase.js` | | | | HTTP proxy | **Service role**; allowlists for RPC/tables; highest review priority |
| `send-security-email.js` | | | | HTTP / internal | Email dispatch; validate caller; no arbitrary recipient |

---

## Completion rule

Phase 0 (functions slice) is complete when **every** row has **Tier** set and **Scalability** / **Isolation** are non-empty (`N/A` only where tier allows).

**Dependency:** Changes to `netlify.toml` (redirects to functions, headers) should be noted in **Notes** when they affect a function’s exposure.

---

## Regenerate row stubs (PowerShell)

From repository root:

```powershell
Get-ChildItem -Path "netlify/functions" -Filter "*.js" -File -Recurse |
  Sort-Object FullName |
  ForEach-Object {
    $rel = $_.FullName.Replace((Get-Location).Path + '\', '').Replace('\', '/')
    "| ``$rel`` | | | | | |"
  }
```

If you only use a **flat** `netlify/functions` folder (no subfolders), use:

```powershell
Get-ChildItem -Path "netlify\functions" -Filter "*.js" -File |
  Sort-Object Name |
  ForEach-Object { "| ``$($_.Name)`` | | | | | |" }
```

Paste output into the table above when adding new functions.

---

## Cross-reference

| Concern | Where to document |
|---------|-------------------|
| Which pages call which function | `SCALABILITY-INVENTORY.md` + page register |
| RLS vs service role | Phase 4 of implementation plan + Supabase policy review |
| Cron schedules & limits | `netlify.toml` + function source |

*Last generated file list: 5 functions (`appointment-reminders-daily.js`, `csp-report.js`, `get-platform-legal-agreements.js`, `secure-supabase.js`, `send-security-email.js`).*
