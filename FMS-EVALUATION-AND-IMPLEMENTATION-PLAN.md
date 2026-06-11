# FMS (Financial Management System) Evaluation Report
## MediForge: Existing vs. Proposed Features

**Date:** February 2026  
**Purpose:** Evaluate the FMS prompt against existing MediForge capabilities; identify gaps; propose a non-disruptive implementation plan.  
**Constraint:** Do not downgrade existing functionality; improve upon it. Maintain current tech stack.

---

## 1. EXECUTIVE SUMMARY

MediForge already implements a substantial portion of the proposed FMS features. The system is **cash-first**, supports **40+ African currencies**, has **lab and prescription billing integration**, and includes **offline-capable architecture**. The main gaps are: **insurance/NHIS/NHIF integration**, **structured payment plans**, **bad debt write-off**, **payment reminders**, **general ledger**, and **digital receipt delivery (SMS/email/WhatsApp)**. Mobile money is supported as a payment method but uses manual reference entry; no live API integration exists.

---

## 2. FEATURES THAT ALREADY EXIST

### 2.1 Charge Capture and Service Billing ✅
- **Location:** `js/billing.js`, `js/pricing.js`, `js/quick-checkout.html`, `js/lab-order-billing.js`
- **What exists:**
  - Invoice creation from clinical encounters (lab orders, prescriptions)
  - Itemized pricing from service catalog
  - Quick-add service buttons and search
  - Real-time and point-of-service billing
- **Implemented (Feb 2026):** Bill Visit button on patient Medical Visits tab; `createInvoiceFromEncounter()` in `js/encounter-billing.js`; links encounter to invoice via `encounterId`.

### 2.2 Cashier and Point-of-Sale (POS) Module ✅
- **Location:** `js/cash-register.js`, `js/quick-checkout.html`, `js/collect-payment.html`
- **What exists:**
  - Cash payments with change calculation
  - Receipt generation (print, download HTML)
  - Daily cash reconciliation (open/close register)
  - Cash drawer management (opening balance, closing count)
  - Discrepancy detection and alerts
- **Improvement opportunity:** Add explicit void/reversal workflow (separate from refund); improve cash-up reports.

### 2.3 Payment Methods ✅
- **Location:** `js/payment-methods.js`, `collect-payment.html`
- **What exists:**
  - Cash (auto-recorded in cash register)
  - Mobile Money (M-Pesa, MTN, Airtel, etc.) – manual reference entry
  - Card (Paystack/Flutterwave integration ready)
  - Bank transfer (manual with receipt upload)
  - Check/Cheque
- **Improvement opportunity:** Add live M-Pesa/MoMo API integration where schemes provide APIs; keep manual as fallback.

### 2.4 Patient Billing and Invoicing ✅
- **Location:** `js/billing.js`, `invoices.html`, `invoice-details.html`
- **What exists:**
  - Itemized bills/invoices
  - Part-payments and balance tracking
  - Discount application with reason tracking
  - Due date management
  - Invoice status (pending, paid, partial, overdue, cancelled)
- **Improvement opportunity:** Add structured payment plans/installments; add waiver categories (indigent, children, pregnant women per policy).

### 2.5 Payment Posting and Reconciliation ✅
- **Location:** `js/billing.js`, `js/payments.js`, `js/cash-register.js`
- **What exists:**
  - Record all payments (cash, mobile, card, bank, check)
  - Reconcile against bills
  - Daily cash-up reports
  - Refunds with audit trail
- **Improvement opportunity:** Add explicit void/reversal workflow; improve bank/mobile deposit tracking.

### 2.6 Accounts Receivable (A/R) and Follow-Up ✅
- **Location:** `js/billing-reports.js`, `billing-reports.html`
- **What exists:**
  - Aging report (0-30, 31-60, 61-90, 90+ days)
  - Outstanding balance tracking
  - Patient-by-patient breakdown
  - Export to CSV
- **Improvement opportunity:** Add SMS/print reminders for outstanding bills; add bad debt write-off workflow.

### 2.7 Financial Reporting and Basic Analytics ✅
- **Location:** `js/billing-reports.js`, `billing-reports.html`, `billing-dashboard.html`
- **What exists:**
  - Cash collections, revenue by service/department
  - Top payers, outstanding balances
  - Revenue trends, collection rates
  - Export to CSV/PDF
- **Improvement opportunity:** Add basic dashboards; improve date range filtering.

### 2.8 Integration with Clinical Data ✅
- **Location:** `js/lab-order-billing.js`, `js/pharmacy-manager.js` (`createInvoiceForPrescription`), `js/pricing.js`
- **What exists:**
  - Lab orders → auto-populate bills (CPT codes, service catalog)
  - Prescriptions → create invoice via pharmacy
  - ICD-11 coded diagnoses in clinical notes
  - Charges match clinical records
- **Improvement opportunity:** Add consultation/procedure billing from clinical encounters; add encounter-to-invoice linkage.

### 2.9 Offline-First Capability ✅ (Partial)
- **Location:** `js/db-interface.js`, `js/adapters/indexeddb-adapter.js`, `js/sync/sync-manager.js`, `service-worker.js`
- **What exists:**
  - Service worker for offline caching
  - IndexedDB adapter for local storage
  - Supabase + IndexedDB hybrid (online/offline routing)
  - Sync queue when offline
- **Improvement opportunity:** Ensure billing (invoices, payments) uses db-interface/sync queue for full offline support; add conflict resolution for billing data.

### 2.10 Security and Compliance ✅
- **Location:** `js/security.js`, `AUDIT-LOGGING-IMPLEMENTATION.md`, `supabase/migrations`
- **What exists:**
  - Role-based access (cashier, accountant, admin, clinician)
  - Audit logs (invoice, payment, refund, cash register events)
  - Transaction logs
  - Data protection considerations (NDPR/POPIA)
- **Improvement opportunity:** Formalize role permissions for billing; add data protection compliance checklist.

### 2.11 Multi-Currency ✅
- **Location:** `js/billing.js`, `data/african-billing-config.json`
- **What exists:**
  - 40+ African currencies (NGN, KES, GHS, ZAR, TZS, UGX, etc.)
  - Country-specific tax rates (VAT, health tax)
  - Organization-level default currency
- **Improvement opportunity:** Add multi-currency per-invoice if needed (e.g., patient pays in different currency).

### 2.12 Receipts ✅
- **Location:** `js/billing.js`, `payment-receipts.html`, `collect-payment.html`
- **What exists:**
  - Auto-generated receipt numbers (PAY-YYYY-#####)
  - Print-friendly format
  - Auto-print on payment
  - Downloadable HTML receipts
- **Improvement opportunity:** Add SMS/email/WhatsApp delivery (optional, per facility).

---

## 3. FEATURES THAT DO NOT EXIST (OR ARE MINIMAL)

### 3.1 Insurance / NHIS / NHIF Integration ❌
- **What exists:** Admission form has manual fields (insurance provider, policy number, verification checkbox). No API integration.
- **Gap:** No eligibility verification, claim submission, claim status tracking, reimbursement posting, or co-pay handling.
- **Priority:** High for facilities with NHIS/NHIF patients.

### 3.2 Payment Plans / Installments ❌
- **What exists:** Part-payments and balance tracking. No structured schedule.
- **Gap:** No installment plan creation (e.g., 3 monthly payments), no reminders for due installments.
- **Priority:** High for larger bills in low-income settings.

### 3.3 Waivers / Exemptions / Policy-Based Discounts ❌ (Partial)
- **What exists:** Generic discount with reason. No structured categories.
- **Gap:** No indigent/children/pregnant-women categories; no policy-based waiver rules.
- **Priority:** Medium.

### 3.4 Bad Debt Write-Off Workflow ❌
- **What exists:** None.
- **Gap:** No workflow to write off uncollectible balances with approval and audit trail.
- **Priority:** Medium.

### 3.5 Payment Reminders (SMS/Print) ❌
- **What exists:** None.
- **Gap:** No automated or manual reminders for outstanding bills.
- **Priority:** High for A/R recovery.

### 3.6 General Ledger and Basic Accounting ✅ (Implemented Feb 2026)
- **What exists:** `gl_cost_centers`, `gl_accounts`, `gl_journal_entries`, `gl_journal_lines`; `js/gl.js`; `gl-dashboard.html`; auto-post from payments; default cost centers (OPD, Lab, Pharmacy, Admin).
- **Gap:** No expense tracking or payroll; income-only for now.
- **Priority:** Low (expand later).

### 3.7 Void / Reversal (Distinct from Refund) ✅ (Implemented Feb 2026)
- **What exists:** `processVoid()` in payments.js; Void button on All Payments; reverses invoice; audit trail.
- **Priority:** Done.

### 3.8 Mobile Money API Integration ❌
- **What exists:** Mobile money as payment method with manual reference entry.
- **Gap:** No live M-Pesa/MoMo API for real-time verification.
- **Priority:** Medium (depends on API availability and cost).

### 3.9 Receipt Delivery via SMS / Email / WhatsApp ❌
- **What exists:** Print and download only.
- **Gap:** No digital delivery of receipts.
- **Priority:** Medium.

### 3.10 Consultation / Procedure Charge Capture from Encounters ✅ (Implemented Feb 2026)
- **What exists:** Bill Visit button on patient Medical Visits; `createInvoiceFromEncounter()`; defaults to consultation service from catalog.
- **Priority:** Done.

---

## 4. CURRENT TECH STACK (TO BE MAINTAINED)

| Layer | Current | FMS Prompt Suggestion | Decision |
|-------|---------|------------------------|----------|
| Frontend | Vanilla JS, HTML, CSS | React | **Keep** vanilla JS |
| Backend | Supabase (PostgreSQL, Auth, Functions) | Python/Flask or Node.js | **Keep** Supabase |
| Storage | Supabase + localStorage + IndexedDB | SQLite/PostgreSQL | **Keep** |
| Offline | Service worker, IndexedDB, sync-manager | PWA, service workers | **Keep** |
| Deployment | Netlify | On-premise or cloud | **Keep** Netlify |

**Rationale:** Changing to React or a new backend would be disruptive. Existing architecture is proven and supports offline, multi-tenant, and African deployments.

---

## 5. NON-DISRUPTIVE IMPLEMENTATION PLAN

### ✅ Completed (Feb 2026)
- **General Ledger:** `gl_cost_centers`, `gl_accounts`, `gl_journal_entries`, `gl_journal_lines`; `js/gl.js`; `gl-dashboard.html`; auto-post from payments.
- **Void / Reversal:** `processVoid()` in payments.js; Void button on All Payments; reverses invoice; audit trail.
- **Consultation billing from encounters:** Bill Visit button on patient Medical Visits; `createInvoiceFromEncounter()`; `js/encounter-billing.js`.

### Phase 1: Enhance Existing (Low Risk) – 4–6 weeks
1. **Payment plans / installments**
   - Add `payment_plans` table and `installment_schedule` to invoices.
   - UI: Create plan from invoice (e.g., 3 monthly payments), track due dates.
   - Reminders: Simple list of overdue installments; optional SMS later.

2. **Waiver categories**
   - Add policy-based waiver types (indigent, children, pregnant women).
   - Extend discount UI to support waiver category + reason.
   - No change to existing discount logic.

3. ~~**Void / reversal**~~ ✅ Done Feb 2026
4. ~~**Consultation billing from encounters**~~ ✅ Done Feb 2026

### Phase 2: Insurance (Medium Risk) – 6–8 weeks
5. **Insurance schema and UI**
   - Tables: `insurance_providers`, `patient_insurance`, `insurance_claims`.
   - UI: Patient insurance profile; optional eligibility check (manual or batch).
   - Claims: Create claim from invoice; status (pending, paid, denied, partial).

6. **NHIS/NHIF integration (placeholder)**
   - API stubs for eligibility and claim submission.
   - Document assumptions for Ghana NHIS, Kenya NHIF, etc.
   - Implement when facility has API access.

### Phase 3: A/R and Follow-Up – 2–4 weeks
7. **Bad debt write-off**
   - Workflow: Select invoice → Write off → Reason + approval.
   - Audit log; update invoice status to `written_off`.

8. **Payment reminders**
   - UI: List overdue invoices; "Send reminder" (print or PDF).
   - Optional: SMS/email integration (Twilio, SendGrid, etc.) when facility configures.

### Phase 4: Digital Receipts and Mobile Money – 4–6 weeks
9. **Receipt delivery**
   - Optional SMS/email/WhatsApp when facility configures.
   - Use existing receipt HTML; send via configured provider.

10. **Mobile money API (optional)**
    - Integrate M-Pesa/MoMo API where available.
    - Fallback: Keep manual reference entry.

### Phase 5: General Ledger ~~(Optional)~~ – ✅ Done Feb 2026
11. ~~**Basic GL**~~ Implemented: income posting from payments; cost centers; GL dashboard.

---

## 6. DATABASE SCHEMA ADDITIONS (Summary)

- `payment_plans` – plan metadata, schedule
- `installment_schedule` – due dates, amounts
- `waiver_categories` – policy-based waiver types
- `void_transactions` – void audit trail
- `insurance_providers` – NHIS, NHIF, private
- `patient_insurance` – patient–insurance link
- `insurance_claims` – claim submission, status
- `bad_debt_write_offs` – write-off record
- `gl_accounts`, `journal_entries`, `cost_centers` (Phase 5)

---

## 7. API / INTEGRATION NOTES

- **Lab billing:** Already uses `createInvoice` from `lab-order-billing.js`.
- **Pharmacy billing:** Already uses `createInvoiceForPrescription` from `pharmacy-manager.js`.
- **Billing persistence:** Supabase-first with localStorage fallback. Ensure billing tables are in sync queue for offline.
- **Paystack/Flutterwave:** Integration ready; add live keys when facility opts in.

---

## 8. METRICS FOR SUCCESS

- Daily collections accuracy (cash register vs. actual)
- Reduction in billing errors (manual vs. auto-capture)
- Faster patient discharge (quick checkout)
- A/R recovery rate (aging before/after reminders)
- Insurance claim acceptance rate (when implemented)

---

## 9. APPROVAL CHECKPOINT

**Do not proceed with implementation until this report is approved.**

Please review and confirm:
1. Accuracy of existing vs. missing features
2. Prioritization of phases
3. Tech stack retention (no React, no new backend)
4. Any additions or removals from the plan

---

*End of Report*
