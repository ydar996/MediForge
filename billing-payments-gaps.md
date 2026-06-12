# MediForge Billing & Payments Gap Analysis

**Date:** 2026-06-11  
**Focus:** Canadian provincial payers + flexible patient payments (cash, bank, Zelle, card)

---

## Executive summary

MediForge has a **solid cash-first clinic billing system** (invoices, collect-payment, cash register, GL) inherited from the African-market build. **Canadian provincial billing (OHIP, RAMQ, MSP, AHCIP) does not exist.** Private insurance is **demographics only** — no electronic claims or remittance. Patient payments support cash, check, bank transfer, card (manual entry), and mobile money — but **not Zelle/e-Transfer** as first-class methods, and **no copay/deductible/payment-plan engine**.

**Upgrade delivered today:** `lib/billing/` payer engine, `config/billing-payers.json`, hooks on `createInvoice`/`recordPayment`, enhanced registration/checkout UI, claim/remittance adapters (stubs ready for provincial onboarding), tests, and docs.

---

## Existing modules (baseline)

| Area | Files | Capability |
|------|-------|------------|
| Invoices/payments | `js/billing.js`, `js/payments.js` | Full invoice lifecycle, Supabase sync |
| Checkout UI | `collect-payment.html`, `quick-checkout.html` | Cash, card, bank, check, mobile money |
| Cash register | `js/cash-register.js` | Sessions, reconciliation |
| Lab billing | `js/lab-order-billing.js` | Invoice + payment gate |
| Pharmacy billing | `js/pharmacy-manager.js` | Rx invoice workflow |
| Registration | `add-patient.html`, `patient-intake.html` | Cash vs Insurance only |
| Platform subs | `js/paystack-integration.js` | Paystack for org subscriptions, not clinical |
| Canadian PHN | `lib/interop/patient-matching.js`, `patient_identifiers` | Interop only, not billing |

### Database (pre-upgrade)

| Table | Billing use |
|-------|-------------|
| `billing_invoices` / `billing_invoice_services` / `billing_payments` | Core clinical billing |
| `gl_*` | General ledger |
| `patients.insurance_*`, `payment_source` | Generic insurance fields |
| `patient_identifiers` | PHN (interop) |

---

## Gap matrix

| Capability | Before | After (today) |
|------------|--------|---------------|
| OHIP / RAMQ / MSP / AHCIP claims | ❌ | ⚠️ Claim draft generator + adapter stubs |
| Eligibility verification | ❌ | ⚠️ Config-driven stub + hook points |
| Remittance / ERA | ❌ | ⚠️ Parser stub + `remittance_records` table |
| Copay / deductible | ❌ | ✅ `calculatePatientResponsibility()` |
| Hybrid payer split (gov + patient) | ❌ | ✅ Invoice `payerSplit` on create |
| Zelle / e-Transfer | ❌ | ✅ Payment methods + collect-payment UI |
| Payment plans | ❌ | ✅ `payment_plans` table + engine |
| Dunning (unpaid balances) | ❌ | ✅ `identifyOverdueInvoices()` |
| PHN at registration | Partial | ✅ Health card + province + primary payer |
| Preferred payment method | ❌ | ✅ Captured at registration |
| Link billing ↔ lab/imaging/Rx | Partial | ✅ `sourceType` / `sourceId` on invoices |
| CAD default for Canada | Partial | ✅ Payer engine sets CAD |

**Legend:** ✅ Implemented | ⚠️ Foundation/stub — production credentials & conformance still required | ❌ Missing

---

## Provincial payer status

| Payer | Province | Claim format (target) | Today |
|-------|----------|----------------------|-------|
| OHIP | Ontario | MCEDT / OHIP fee schedule | Config + claim draft JSON |
| RAMQ | Quebec | RAMQ billing | Config + claim draft JSON |
| MSP | BC | Teleplan | Config + claim draft JSON |
| AHCIP | Alberta | HLINK | Config + claim draft JSON |
| Blue Cross / Canada Life / Manulife / Sun Life / GSC | National | EDI 837 / proprietary | Private claim stub |

Production submission requires provincial vendor onboarding — not included in repo.

---

## Recommended next steps

1. Run migration `20260611100000_billing_payers_tables.sql` on Supabase  
2. Load `config/billing-payers.json` per organization  
3. Connect OHIP MCEDT or clearinghouse when credentials available  
4. Enable Stripe/Square/Moneris gateway via `paymentGateways` config for live card processing  
5. Train staff on check-in → copay collection flow (`billing-check-in.html`)

See **`MEDIFORGE-BILLING-AND-PAYMENTS-DOCS.md`**.
