# MediForge Billing & Payments Documentation

**Version:** 1.0  
**Date:** June 2026  
**Focus:** Canadian provincial payers + flexible patient payments (cash, bank, Zelle, e-Transfer, card)

Works alongside **`MEDIFORGE-INTEROPERABILITY-DOCS.md`** for lab/imaging/Rx order transmission.

---

## Overview

| Layer | Path | Purpose |
|-------|------|---------|
| Payer engine (Node) | `lib/billing/` | OHIP/RAMQ/MSP rules, claim drafts, remittance |
| Browser engine | `js/billing-payer-engine.js` | Invoice enrichment, payer profiles |
| Hooks | `js/billing-payer-hooks.js` | Wraps `createInvoice` / `recordPayment` |
| Config | `config/billing-payers.json` | Payers, copay rules, gateways |
| Check-in UI | `billing-check-in.html` | Copay calculation + redirect to checkout |
| Checkout UI | `collect-payment.html` | Cash, check, bank, e-Transfer, Zelle, card |
| Gap analysis | `billing-payments-gaps.md` | Before/after matrix |

---

## Canadian provincial payers (configured)

| Code | Province | Transport (target) |
|------|----------|-------------------|
| OHIP | Ontario | MCEDT |
| RAMQ | Quebec | RAMQ_NET |
| MSP | British Columbia | Teleplan |
| AHCIP | Alberta | HLINK |

Private insurers in config: Blue Cross, Canada Life, Manulife, Sun Life, Green Shield, Desjardins.

**Production claim submission** requires provincial onboarding: drafts are stored in `insurance_claims`.

---

## Patient payment methods (emphasis)

MediForge prioritizes **flexible patient-pay** for copays, uninsured services, and private clinics:

| Method | ID | Notes |
|--------|-----|-------|
| Cash | `cash` | Auto cash-register entry |
| Check/cheque | `check` | Manual reference |
| Bank transfer | `bank_transfer` | Proof upload supported |
| Interac e-Transfer | `etransfer` | Canada |
| Zelle | `zelle` | US/CA practices |
| Credit/debit card | `card` / `debit` | Manual entry today; Stripe/Square/Moneris pluggable |

---

## Setup

### 1. Database migration

Run on each Supabase project:

```
supabase/migrations/20260611100000_billing_payers_tables.sql
```

Also run interoperability migration if not done:

```
supabase/migrations/20260611000000_interoperability_tables.sql
```

### 2. Configuration

Edit `config/billing-payers.json`:

- `defaultProvince`, `defaultCurrency` (CAD)
- `copayRules.defaultCopay`
- `provincialPayers` / `privateInsurers`
- `paymentGateways` when enabling Stripe/Moneris

### 3. Registration (`add-patient.html`)

Captures:

- Province + PHN (health card)
- Primary payer (provincial / private / self-pay / WCB)
- Preferred payment method
- Private insurance details when applicable

Saved to `patient_payer_profiles` via `MediForgePayerEngine.savePayerProfile()`.

---

## Workflows

### Registration → payer profile

1. Staff registers patient with PHN + province  
2. Select primary payer (defaults to provincial for ON → OHIP)  
3. Set preferred payment method (cash, e-Transfer, etc.)  
4. Profile stored in `patient_payer_profiles`

### Check-in → copay

1. Open **`billing-check-in.html`**  
2. Enter patient ID + service amount  
3. Engine calculates insurer vs patient portion  
4. **Collect payment →** opens `collect-payment.html` for patient due

### Invoice → claim draft

1. `createInvoice()` (via hooks) enriches with `payerSplit`  
2. Patient due shown at checkout; insurer portion queued as claim draft  
3. Draft in `insurance_claims` with status `draft`

### Payment collection

1. `collect-payment.html` shows payer split banner when applicable  
2. Staff selects cash, e-Transfer, Zelle, etc.  
3. `recordPayment()` updates invoice, cash register, GL, lab/Rx gates

### Remittance (when payer pays)

1. Import remittance JSON to `remittance_records`  
2. `lib/billing/remittance-adapter.js` reconciles with invoices

---

## Integration with clinical orders

| Source | Billing link |
|--------|--------------|
| Lab order | `js/lab-order-billing.js` → invoice → payment gate |
| Prescription | `js/pharmacy-manager.js` → invoice → `paid_at` |
| Imaging | Manual checkout or clinical note invoice |
| Interop | Order serial in claim `serviceLines.sourceId` |

Sample claim with lab line: `tests/samples/billing/ohip-claim-draft.json`

---

## Sample files

| File | Description |
|------|-------------|
| `tests/samples/billing/ohip-claim-draft.json` | OHIP draft with encounter + lab lines |
| `tests/samples/billing/patient-copay-etransfer.json` | Copay paid via e-Transfer |
| `tests/samples/hl7/*.hl7` | Lab order/result (interop) |
| `tests/samples/fhir/*.json` | FHIR orders/results (interop) |

---

## Tests

```powershell
npm run test:billing
npm run test:interop
npm run test:clinical
```

---

## Production checklist

- [ ] Run Supabase migrations (billing + interop)
- [ ] Configure `billing-payers.json` per clinic province
- [ ] OHIP billing number on provider profile
- [ ] MCEDT / clearinghouse credentials (provincial)
- [ ] Payment gateway keys in Netlify env (optional card processing)
- [ ] Staff training: check-in → copay → flexible payment methods
- [ ] Reconcile cash register daily

---

## Honest limits (today)

- **OHIP/RAMQ/MSP live claim submission**: draft only until MCEDT/clearinghouse connected  
- **Eligibility verification**: stub; no live OHIP eligibility API  
- **Card processing**: manual entry; gateway integration config-ready  
- **Fee schedules**: use pricing catalog; provincial fee codes in claim payload only  

For interoperability setup see **`MEDIFORGE-INTEROPERABILITY-DOCS.md`**.

Support: support@eworkchop.com
