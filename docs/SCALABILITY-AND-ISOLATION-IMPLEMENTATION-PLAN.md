# Scalability & Multi-Tenant Isolation: Implementation Plan

**Purpose:** Executable plan to improve **query scalability** and **organization-level data isolation** without breaking existing features. Suitable for internal execution or handover to another engineer/agent.

**Scope:** MediForge (static front end on Netlify + Supabase Postgres + optional Netlify Functions).

**Out of scope (unless later phases):** Rewriting the entire app, migrating off Supabase, or guaranteeing 5,000 orgs / 10M users without load testing.

**Document version:** 1.1  
**Last updated:** 2026-03-25  
**Change log:** 1.1: Mandatory **full root-level page coverage** via `docs/SCALABILITY-PAGE-COVERAGE.md`; **Netlify Functions** checklist via `docs/SCALABILITY-FUNCTION-COVERAGE.md`.

---

## 1. Objectives

| Objective | Target outcome |
|-----------|----------------|
| **Scalability** | List views and APIs use bounded row counts, narrow column selects, and indexes aligned to real queries; no unbounded “load entire org” patterns in hot paths. |
| **Isolation** | PHI and tenant data are enforceable via RLS + consistent `organization_id` scoping; expensive operations can be throttled per tenant where feasible. |
| **Safety** | Incremental deploys; staging validation; rollback per PR/migration; regression checklist unchanged flows. |

---

## 2. Principles (non-negotiable)

1. **One vertical slice per PR**: e.g. “patient list pagination” only, not patients + appointments + orders in one change.
2. **Backward compatibility**: Same user journeys (URLs, roles); changes are **data-fetch shape** (limits, columns), not removal of features.
3. **Staging first**: Every merge to `dev`/`staging` runs automated/manual regression (Section 8) before production.
4. **Feature flags (optional)**: Use env or runtime flags for risky paths (e.g. `STRICT_PAGINATION=true`) if behavior differs for tiny vs large orgs.
5. **Migrations are additive first**: Prefer new indexes and new query patterns; avoid destructive DDL until validated.

---

## 3. Roles & access

| Role | Responsibility |
|------|----------------|
| **Implementer** | Code, migrations, PRs, staging verification. |
| **Reviewer** | RLS policy review, SQL review, security-sensitive changes. |
| **Ops** | Supabase plan limits, Netlify env vars, monitoring alerts. |

**Required access:** Supabase project (SQL + RLS), Git repo, Netlify (if env vars), optional staging DB with anonymized seed data for load smoke tests.

---

## 4. Phase overview

| Phase | Name | Risk | Deploy impact |
|-------|------|------|----------------|
| **0** | Baseline & inventory | Low | Docs / scripts only |
| **1** | Query inventory & indexes | Low–Med | Migrations (indexes), optional logging |
| **2** | Pagination & narrow selects | Med | App JS/HTML changes, incremental |
| **3** | localStorage / hybrid caps | Med | App changes; test offline flows |
| **4** | RLS audit & hardening | Med–High | SQL migrations; **must** test all roles |
| **5** | Rate limits & heavy operations | Med | Edge/function or app-layer |
| **6** | Async jobs & scale-up (optional) | Med–High | Infra / queues / Supabase tier |

Execute phases **in order** unless Phase 0/1 runs in parallel with doc-only work.

---

## 5. Phase 0: Baseline & inventory

### 5.1 Goals

- Single source of truth: which tables, which pages, which functions touch PHI or high-volume data.
- Regression checklist frozen as “must pass before prod.”

### 5.2 Tasks

0. **Complete the page coverage register (mandatory):** Open `docs/SCALABILITY-PAGE-COVERAGE.md`. For **every** root-level `*.html` file listed, assign **Tier** (A/B/C/D) and fill **Scalability** / **Isolation** (use `N/A` only where the tier allows). This ensures **no page is forgotten**; Tier C/D pages still get an explicit decision. When new pages are added to the repo root, **append a row** (or regenerate via the script in that file) before closing Phase 0.

0b. **Complete the Netlify Functions coverage register:** Open `docs/SCALABILITY-FUNCTION-COVERAGE.md`. For **every** `netlify/functions/**/*.js` handler, assign **Tier** and fill **Scalability** / **Isolation** (same completion rule as pages). Serverless entry points are **not** listed in the HTML register; they are tracked here.

1. **Create inventory spreadsheet or markdown table** (query-level detail; can reference register) with columns:
   - `Area` (e.g. Patients list)
   - `File(s)` (e.g. `js/patients.js`, `patients.html`)
   - `Supabase table(s)`
   - `Query pattern` (select columns, filters, limit, order)
   - `organization_id` filter? (Y/N/Partial)
   - `RLS` expected? (Y/N/Unknown)

2. **List high-risk patterns to search for** (repo-wide `grep` / IDE):
   - `.select('*')` on large tables
   - Missing `.limit(` or `.range(`
   - `loadPatients`, `loadAll`, `syncAll`, `JSON.parse(localStorage` for large keys
   - `from('patients')` without obvious org filter in the same chain

3. **Document current Supabase setup:**
   - Project ref, regions, plan tier (connection limits, max rows, etc.)
   - Whether RLS is enabled per table (information_schema or Supabase UI)

### 5.3 Deliverables

- `docs/SCALABILITY-PAGE-COVERAGE.md`: **authoritative list of all root `*.html` pages** with Tier + Scalability + Isolation columns (maintained in git).
- `docs/SCALABILITY-FUNCTION-COVERAGE.md`: **authoritative list of all `netlify/functions` handlers** with the same columns (cron, HTTP proxy, email, etc.).
- `docs/SCALABILITY-INVENTORY.md` (or appendix in this file): table of **queries** and risk rating (High/Med/Low); cross-link page names to the coverage register.
- `docs/REGRESSION-CHECKLIST-SCALABILITY.md`: copy Section 8 into a standalone checklist for QA.

### 5.4 Acceptance criteria

- [ ] **100% of rows** in `docs/SCALABILITY-PAGE-COVERAGE.md` have **Tier** set and **Scalability** / **Isolation** non-empty (`N/A` allowed per tier rules).
- [ ] **100% of rows** in `docs/SCALABILITY-FUNCTION-COVERAGE.md` have **Tier** set and **Scalability** / **Isolation** non-empty (same rule).
- [ ] Every **Tier A** and **Tier B** page that loads bulk data has at least one corresponding row in `SCALABILITY-INVENTORY.md` (or explicit “uses shared helper X” note on the register).
- [ ] Tier C/D pages explicitly marked so implementers do not waste cycles on static assets.
- [ ] No production code change required for Phase 0 (optional: add comments in inventory linking to line numbers).

**Scope note:** Only **root** `*.html` files are listed in the page register. Shared `js/*.js` modules are covered **via** the pages that load them (inventory links `patients.html` → `js/patients.js`). HTML under archive folders (e.g. `sync-upgrade-backup-*`) is **out of scope** unless product still links to it: if so, add a one-off row or move the page into root and regenerate.

---

## 6. Phase 1: Indexes & query alignment

### 6.1 Goals

- Database supports the **actual** filter/sort patterns used by the app after pagination is added (Phase 2). Indexes can be added **before** or **with** pagination; prefer **with** or **immediately after** first paginated query merge to avoid unused indexes.

### 6.2 Tasks

1. From Phase 0 inventory, list **top 10 queries** by risk (full table scan risk).
2. For each query, define:
   - `WHERE` clauses (especially `organization_id = ?`)
   - `ORDER BY`
   - `JOIN` keys
3. Add **Supabase migrations** under `supabase/migrations/`:
   - Naming: `YYYYMMDDHHMMSS_scalability_index_<table>_<short_desc>.sql`
   - Use `CREATE INDEX CONCURRENTLY` **only if** your migration runner supports it (Supabase SQL editor often runs in transaction; use non-concurrent if not).
4. **Verify** with `EXPLAIN (ANALYZE, BUFFERS)` on staging (anonymized data) for representative org sizes.

### 6.3 Example index patterns (adjust to real schema)

- Patients by org + recency: `(organization_id, updated_at DESC)` or `(organization_id, created_at DESC)`
- Patients by org + legacy id lookup: `(organization_id, patient_id)` unique if business rules allow
- Orders by org + status: `(organization_id, lab_status, created_at DESC)`
- Appointments by org + date: `(organization_id, visit_date)` or `(organization_id, start_time)`

### 6.4 Acceptance criteria

- [ ] Each new index has a comment in SQL explaining which UI/API it supports.
- [ ] Staging `EXPLAIN` shows index usage for targeted queries (no seq scan on cold cache for large test sets).
- [ ] Migration applied rollback documented (`DROP INDEX` name).

### 6.5 Rollback

- Drop index migration in reverse order; monitor write latency if many indexes added at once.

---

## 7. Phase 2: Pagination & narrow `select()`

### 7.1 Goals

- No primary list view loads unbounded rows from Supabase.
- Responses carry only columns needed for that view.

### 7.2 Implementation pattern (Supabase JS)

```text
Default: .select('id, patient_id, first_name, last_name, dob, ...')
         .eq('organization_id', orgId)
         .order('updated_at', { ascending: false })
         .range(from, to)   // or .limit(n) + cursor on (updated_at, id)
```

### 7.3 Order of surfaces (one PR each)

**Source of truth:** After Phase 0, sort **Tier A** pages from `docs/SCALABILITY-PAGE-COVERAGE.md` where **Scalability** ≠ `N/A` and **Scalability** ≠ `Done`, ordered by **inventory risk** (High first). The list below is the **default** starting order if priorities are equal:

1. **Patient list / search**: `patients.html`, `js/patients.js`, `js/supabase-patients.js`, `js/universal-data-loader.js` (as applicable).
2. **Appointments**: `appointments.html`, `js/appointments.js`, related pages.
3. **Lab orders**: `lab-scientist-dashboard.html`, `select-lab-orders.html`, related JS.
4. **Messages**: `messages.html`, `js/messages.js`.
5. **Remaining Tier A** pages with bulk loads (e.g. `inpatient-dashboard.html`, `reports.html`, `billing-dashboard.html`) per register.
6. **Tier B** (platform/security/billing ops) after Tier A hot paths.

### 7.4 UI requirements

- “Load more” or numbered pages; preserve current **default sort** behavior for first page.
- Search: if today search is client-side over full array, **move** to server-side `ilike` / FTS **incrementally** (may be Phase 2b).
- Empty state and loading state unchanged for zero results.

### 7.5 Acceptance criteria (per surface)

- [ ] Network response row count ≤ agreed cap (e.g. 50) for initial load.
- [ ] `select()` does not include large JSON blobs unless detail view.
- [ ] Regression checklist (Section 8) for that surface passes on staging.
- [ ] Document any API change if patient portal or mobile depends on same helper.

### 7.6 Rollback

- Revert PR; feature flag off if used.

---

## 8. Regression checklist (run on staging after each Phase 2+ deploy)

**Auth & org**

- [ ] Staff login (at least one org admin, one clinician).
- [ ] Wrong org user cannot see other org’s patient (spot-check).

**Patients**

- [ ] Open patient list; open patient detail; edit patient; create patient (if allowed).

**Clinical**

- [ ] Open clinical note for existing visit; save; reload.

**Lab**

- [ ] Select lab orders; lab scientist dashboard sees order; result entry save (if applicable).

**Appointments**

- [ ] List; create; edit; calendar view if used.

**Messages**

- [ ] Inbox load; send message (if applicable).

**Billing / invoices** (if enabled)

- [ ] Open invoice list; open one invoice.

**Patient portal** (if enabled)

- [ ] Login; view allowed data.

**Offline / hybrid** (if used)

- [ ] Airplane mode or throttled network: app does not white-screen; degraded behavior documented.

---

## 9. Phase 3: localStorage / hybrid data caps

### 9.1 Goals

- Browser memory and sync time stay bounded for large orgs.
- Small clinics retain current behavior (optional threshold, e.g. cap only when `count > N`).

### 9.2 Tasks

1. Inventory all `localStorage` / `sessionStorage` keys that store patients, visits, orders, or full org dumps (Phase 0).
2. For each:
   - Define **max entries** or **TTL** or **“online-only for list”** strategy.
3. Implement:
   - Prefer **server as source of truth** for lists; cache only current patient or recent IDs.
4. Test **sync** flows in `js/universal-data-loader.js`, `js/main.js`, and any `syncAll` naming.

### 9.3 Acceptance criteria

- [ ] With seeded 10k patient org on staging, dashboard load completes without browser hang.
- [ ] No data loss for workflows that today rely on local cache (explicitly verify).

### 9.4 Rollback

- Revert PR; restore previous cache strategy.

---

## 10. Phase 4: RLS audit & hardening

### 10.1 Goals

- Database enforces tenant isolation even if application code omits a filter.
- Policies align with JWT claims or session variables your app uses.

### 10.2 Tasks

1. **Export policy list**: For each table with PHI: RLS enabled? Policies listed?
2. **Standard pattern** (adapt to your auth model):
   - `USING (organization_id = auth.jwt() ->> 'organization_id')`  
   - Or `organization_id IN (SELECT ... from user_org_map ...)`  
   - **Never** rely on client-supplied org id alone without server-side validation.
3. **Service role / edge functions:** Document every use of service key; ensure it cannot be invoked cross-tenant without checks.
4. **Migrations:** Add missing RLS or tighten policies in **small steps**; test **break-glass** admin paths if any.

### 10.3 Test matrix

| Role | Expected |
|------|----------|
| Org A clinician | Only org A rows |
| Org B clinician | Only org B rows |
| Platform admin | Per product rules (document explicitly) |
| Patient portal user | Only own patient / linked records |
| Anonymous | No PHI |

### 10.4 Acceptance criteria

- [ ] Automated or manual test script confirms cross-org `SELECT` returns zero rows.
- [ ] No regression on legitimate access for each role.

### 10.5 Rollback

- Keep previous policy SQL in migration down notes; restore if critical path breaks.

---

## 11. Phase 5: Rate limiting & expensive operations

### 11.1 Goals

- One org cannot monopolize shared DB/API connections via abusive or buggy clients.

### 11.2 Tasks

1. Identify **expensive** operations: bulk export, full sync, report generation, reminder fan-out.
2. Implement **per-org** or **per-user** limits:
   - Netlify Edge middleware (if on Pro), or
   - Supabase + Postgres (connection pooling is platform-managed; prefer **app-level** throttle in functions), or
   - In-function counters with Redis/Upstash (if introduced).
3. Return **429** with clear message; log incident for ops.

### 11.3 Acceptance criteria

- [ ] Synthetic burst from one API key/org is throttled without killing others on staging.

---

## 12. Phase 6: Optional scale tier (async, replicas, dedicated tenants)

### 12.1 When to trigger

- Sustained high P95 latency, connection saturation, or contractual isolation requirements.

### 12.2 Options

- Move heavy reports to **scheduled jobs** + object storage (CSV/PDF).
- Supabase **read replica** (if available on plan) for reporting.
- **Dedicated** Supabase project for largest customer (highest isolation, highest ops cost).

### 12.3 Acceptance criteria

- Documented SLO and cost; runbook for failover.

---

## 13. Observability (throughout)

| Signal | Tool |
|--------|------|
| API latency / errors | Supabase dashboard, browser Network tab |
| DB slow queries | Supabase logs, `pg_stat_statements` if enabled |
| Client perf | Lighthouse / Performance tab for list pages |
| RLS violations | Audit log, failed queries |

Add **alerts** when P95 exceeds threshold or error rate spikes after a deploy.

---

## 14. Git & deploy workflow

1. Branch from `dev`: `feat/scalability-patients-pagination` (example).
2. PR → `dev` → deploy Netlify dev URL.
3. Run Section 8 checklist.
4. PR `dev` → `staging` → validate.
5. PR `staging` → `main` (production) per release process.

**Database:** Apply Supabase migrations to staging project first; production after sign-off.

---

## 15. Handover package for another agent

Provide the next implementer:

1. This file: `docs/SCALABILITY-AND-ISOLATION-IMPLEMENTATION-PLAN.md`
2. `docs/SCALABILITY-PAGE-COVERAGE.md` (must be kept current; Phase 0 gate)
3. `docs/SCALABILITY-FUNCTION-COVERAGE.md` (Netlify handlers; Phase 0 gate)
4. Output of Phase 0: `docs/SCALABILITY-INVENTORY.md` (once created)
5. Link to Supabase project and branch deploy URLs
6. Test accounts for Org A and Org B
7. Regression checklist (Section 8)
8. Explicit **current phase** and **next single PR** scope (name the **page** from the register, or **function** from `SCALABILITY-FUNCTION-COVERAGE.md`)

**Prompt snippet for agent:**

```text
Implement only Phase [N], Task [X] from docs/SCALABILITY-AND-ISOLATION-IMPLEMENTATION-PLAN.md.
Do not change unrelated features. Run the regression checklist in Section 8 for affected surfaces.
Output: PR description, migration file names, and any env vars added.
```

---

## 16. Risk register

| Risk | Mitigation |
|------|------------|
| Pagination breaks search/sort expectations | Match default sort to legacy; add tests |
| RLS locks out valid users | Role matrix testing; staged policy rollout |
| Indexes slow writes | Add incrementally; monitor write latency |
| Portal depends on full local cache | Phase 3 threshold + portal-specific test |
| Over-scoping PR | Enforce one-surface-per-PR rule |
| Page register incomplete | Phase 0 blocked until `SCALABILITY-PAGE-COVERAGE.md` is 100% classified |
| Function register incomplete | Phase 0 blocked until `SCALABILITY-FUNCTION-COVERAGE.md` is 100% classified |

---

## 17. Full page coverage policy

This plan **does** cover **all** deployable root-level HTML entry points by requiring:

1. **`docs/SCALABILITY-PAGE-COVERAGE.md`**: one row per `*.html` in the repository root (regenerate when pages are added/removed).
2. **`docs/SCALABILITY-FUNCTION-COVERAGE.md`**: one row per `netlify/functions` handler (regenerate when functions are added/removed).
3. **Tier assignment**: every page and every function gets A/B/C/D so work is prioritized correctly; nothing is “invisible” to the plan.
4. **Phase 2+**: implementation order is driven by the registers + inventory risk, not an informal subset of pages.

**What is not duplicated row-by-row:** Shared `js/` and `css/` modules are traced **through** the pages that load them and the query inventory: otherwise the HTML register would duplicate hundreds of paths without adding clarity. **Netlify functions** are **not** inferred from HTML alone; use `SCALABILITY-FUNCTION-COVERAGE.md`.

---

## 18. Sign-off

| Milestone | Owner | Date | Notes |
|-----------|-------|------|-------|
| Page register 100% (Tier + S/I columns) | | | See `SCALABILITY-PAGE-COVERAGE.md` |
| Function register 100% (Tier + S/I columns) | | | See `SCALABILITY-FUNCTION-COVERAGE.md` |
| Phase 0 complete | | | |
| Phase 1 complete | | | |
| Phase 2 (patients) complete | | | |
| Phase 2 (appointments) complete | | | |
| Phase 4 RLS complete | | | |
| Production release | | | |

---

*End of implementation plan.*
