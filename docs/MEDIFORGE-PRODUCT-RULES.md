# MediForge product rules

These rules define how MediForge differs from the legacy codebase it was forked from. Agents and developers must follow them for all new work.

**Last updated:** June 23, 2026

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

**Mecure Clinics exception:** After login, if org name contains “mecure”, `js/universal-data-loader.js` may set billing default to **NGN**: intentional for that clinic’s operations.

---

## 3. Organizations

### Fresh database policy

MediForge uses a **dedicated Supabase project** with **no pre-seeded organizations**.

| Who | How they get access |
|-----|---------------------|
| **Mecure Clinics** | Owner registers via `/register` as the **first** organization after go-live |
| **All other clinics** | Must complete `/register` (new org flow): no manual seeding in production |
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
- Tenant isolation via `organization_id` + RLS: never weaken RLS for convenience.

---

## 5. Configuration

| Setting | Where |
|---------|--------|
| Browser Supabase URL/key | `js/supabase-env.js` or Netlify build injection |
| Server Supabase key | Netlify env `SUPABASE_SERVICE_ROLE_KEY` only |
| File uploads | Supabase Storage bucket **`patient-documents`** (private) |

Placeholder values in `js/supabase-env.js` must be replaced before production use.

---

## 6. Communication with the project owner

AI agents and anyone writing **to the project owner** (not internal dev docs) must:

- Use the **simplest layman's terms** in **every** conversation: including feasibility, imports, database design, and “how would this work?”
- Lead with what it means for the clinic; put technical detail in code comments or developer docs.
- Do the work when possible; don't dump long technical checklists unless the owner asked to do it themselves.

See **`AGENT-HANDOVER.md`** → **Rule #1**.

---

## 7. Deployments

Same as **`AGENT-HANDOVER.md`**: explicit approval, dev first, one batched deploy with detailed message.

---

## 8. Writing style: no em dashes

Do **not** use em dashes (—) in user-facing text, owner-facing documentation, marketing pages, or agent replies to the owner.

| Instead of | Use |
|------------|-----|
| `Feature — description` | `Feature: description` |
| `Updated June 2026 — share this page` | `Updated June 2026: share this page` |
| `Built for clinics — not hospitals only` | `Built for clinics: not hospitals only` |

**Preferred alternatives:** colon, comma, period, or parentheses.

**Check:** `npm run check:no-em-dash` (also runs in full `npm run check`).

**Bulk fix:** `node scripts/replace-em-dashes.mjs`

Agents must follow this without the owner needing to repeat it. See **`AGENT-HANDOVER.md`** → **Rule #2**.

---

## 9. Documentation stays in sync with code (always)

When you change the product, update related documentation **in the same session**. Do not wait for the owner to ask.

| Change type | Also update |
|-------------|-------------|
| Shareable webpage (`ontario-readiness.html`, `capabilities.html`, `investor-letter.html`) | Written companion in `docs/` (investor letter ↔ `docs/investor/INVESTOR-LETTER-2026-06.md`) |
| Ontario readiness scores or phase status | `ONTARIO-EMR-READINESS-REPORT.md`, `ONTARIOMD-GAP-REPORT.md`, `INVESTOR-LETTER-2026-06.md`, `/ontario-readiness`, `/investor-letter` |
| Implementation plan task completed | `ONTARIO-EMR-IMPLEMENTATION-PLAN.md` status column |
| Staff-visible workflow | `USER-MANUAL.md` + `user-manual.html` |
| Any code/config session | `AGENT-HANDOVER.md` session log, `DOCUMENTATION-INDEX.md` |

**Minimum before you finish:** session log in handover, documentation index if docs changed, companion page/doc pairs if either side changed.

See **`AGENT-HANDOVER.md`** → **Rule #3** and **§ How to keep this document alive**.

---

## Change log

| Date | Change |
|------|--------|
| 2026-06-23 | §9 Documentation sync with code; companion page/doc pairs |
| 2026-06-23 | §8 No em dashes: colons preferred; check script added |
| 2026-06-17 | §6 Communication with project owner: simplest layman's terms always |
| 2026-06-11 | Initial rules document at MediForge fork |
