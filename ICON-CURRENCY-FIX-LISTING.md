# Pages with ?? (Icons) or ? (Currency) Display Issues

**Scan date:** February 2025  
**Purpose:** Listing of all pages that need fixing before approval to action.

---

## Category A: ?? Replacing Icons (Visible UI – High Priority)

| # | File | Issue | Count |
|---|------|-------|-------|
| 1 | **key-features-local.html** | `??` in section titles and `<span class="feature-icon">??</span>` throughout | ~30+ occurrences |
| 2 | **about-us-local.html** | `??` in h4 headings (Process Automation, Thought Leadership, Global Impact) | 3 |
| 3 | **all-payments.html** | `??` in h1 "All Historical Payments"; `??` in delete confirmation dialog | 2 |
| 4 | **platform-dashboard.html** | `??` / `???` / `?????` in h1, h2, h3, buttons, menu items, alerts, diagnosis text | ~70+ occurrences |

---

## Category B: ? Replacing Currency Symbol (₦ Naira – High Priority)

| # | File | Issue | Count |
|---|------|-------|-------|
| 1 | **payment-receipts.html** | `'NGN': '?'` and `currency === 'NGN' ? '?'` – Naira shown as ? | 4 |
| 2 | **subscription-invoice.html** | `'NGN': '?'` in formatCurrencyDisplay | 1 |
| 3 | **platform-analytics.html** | `'NGN': '?'` in formatCurrency | 1 |
| 4 | **manage-clinics.html** | `'NGN': '?'` in formatCurrency | 1 |
| 5 | **clinic-details.html** | `'NGN': '?'` in formatCurrency | 1 |
| 6 | **restore-subscription-plans.html** | `?${plan.prices?.NGN}` – Naira prefix as ? | 1 |
| 7 | **edit-invoice.html** | `'???? NGN'`, `'???? KES'` etc. in currency dropdown – symbols corrupted | 9 (currency options) |

---

## Category C: ? / ?? in Status/Checkmarks (Medium Priority)

| # | File | Issue | Count |
|---|------|-------|-------|
| 1 | **sync-user-profiles.html** | `'?' : '??'` and `'?' : '? Missing!'` for status cells | 2 |
| 2 | **migrate-patient-demographics.html** | `'?' : '?'` for Address/Emergency/Demographics status | 3 |

---

## Category D: Console/Trace Only (Lower Priority – Dev Tools)

These don't affect visible UI but produce messy logs:

| # | File | Issue |
|---|------|-------|
| 1 | **login.html** | `console.log('?? Service Worker...')` |
| 2 | **manage-subscription.html** | Multiple `console.warn('?? ...')` |
| 3 | **edit-patient.html** | Multiple `console.log('?? TRACE:...')` |
| 4 | **platform-dashboard.html** | Multiple `console.log/warn('??'/'?')` |
| 5 | **todays-revenue.html** | `console.log('?? TRACE:...')` |
| 6 | **test-supabase-connection.html** | `console.log('?? Auto-testing...')` |
| 7 | **sync-mobile-data.html** | Multiple `console.log('??'/'?')` |
| 8 | **subscription-invoice.html** | Multiple `console.log/warn('??'/'?')` |
| 9 | **revenue-analytics.html** | `console.log('?? ...')` |
| 10 | **register.html** | Remaining `console.log('? ...')` (some already fixed) |
| 11 | **platform-settings.html** | `console.log('?? ...')` |

---

## Excluded (Not Issues)

- **JavaScript `??` operator** – Nullish coalescing (e.g. `value ?? 0`) – valid syntax, do NOT change
- **pharmacy-inventory-details.html**, **lab-result-entry.html** – Uses `??` operator, not display
- **patient-intake-approvals.js** – Uses `??` for fallback logic
- **key-features.html** – Uses emoji (🔑, 📋, 🏥, etc.) – may render as ?? on some systems but not literal ?? in source
- **billing.js** – Has correct `'NGN': '₦'` in formatCurrency
- **Backup folder** (`sync-upgrade-backup-*`) – Excluded from fix scope

---

## Summary by Priority

| Priority | Category | Files | Est. Effort |
|----------|----------|-------|-------------|
| **High** | A (Icons) | 4 | Replace ?? with Font Awesome or correct emoji |
| **High** | B (Currency) | 7 | Replace `'?'` with `'₦'` for NGN |
| **Medium** | C (Status) | 2 | Replace with ✓/✗ or Font Awesome |
| **Low** | D (Console) | 11 | Replace ??/? with [OK]/[WARN]/[REG] prefixes |

---

## Recommended Approach

1. **Category A & B** – Fix first (user-facing)
2. **Category C** – Fix with A/B or immediately after
3. **Category D** – Optional; improve developer experience

**Note:** `key-features.html` uses emoji that may render as ?? on Windows/older fonts. Consider Font Awesome for `key-features-local.html` (same pattern as register.html fix).
