# MediForge Revenue and Net Income Projection

**Work Chop Inc. · MediForge EMR Platform**  
**Date:** June 2026  
**Shareable web version:** https://mediforge.netlify.app/revenue-projection  
**Written companion to:** **`revenue-projection.html`** (keep in sync per `AGENT-HANDOVER.md` Rule #3)

**Related:** [Project Plan](STRATEGIC-PARTNER-PROJECT-PLAN.md) · [Term Sheet](TERM-SHEET-SEED-PREFERRED-SHARE.md) · [Valuation](VALUATION-AND-EQUITY-STRUCTURE.md) · [Ontario Readiness](https://mediforge.netlify.app/ontario-readiness)

---

## Purpose

This document translates **implementation planning** (Phases 0–8 complete; certification path A–D; seed tranches) into **subscription revenue, implementation fees, operating costs, and net income** under a defined go-to-market assumption.

It answers: *If we land 2 clinics (5 providers each) and double clinic count every year, what do earnings and costs look like?*

---

## Pricing model (assumed)

Canada-focused, global-ready tiers (per provider, per month, CAD):

| Tier | Monthly (CAD) | Typical scope |
|------|---------------|---------------|
| Basic | $120–$150 | Charting, core records |
| Standard | $180–$220 | Billing, scheduling, provincial integrations |
| Premium / Enterprise | $250+ | Hospital modules, analytics, priority support |

**Additional revenue:** one-time implementation **$2k–$15k** per clinic (size-based); add-on modules; **10–15%** annual prepay discount.

**Projection blend (Base case):**

| Item | Assumption |
|------|------------|
| Blended subscription (Years 2–5) | **$200/provider/month** (Standard-heavy Ontario clinics) |
| Year 1 pilot discount | **20%** off subscription (**$160/provider/month**) |
| Implementation fee (avg) | **$6,000** per new clinic (mid-range for 5-provider site) |
| Annual prepay | Not modeled separately (conservative: monthly billing) |

---

## Growth assumption

| Rule | Value |
|------|-------|
| Starting footprint | **2 clinics × 5 providers = 10 providers** |
| Growth | **Double total clinic count every commercial year** (net new clinics = prior year total) |
| Providers per clinic | **5** (constant for projection simplicity) |

| Commercial year | Total clinics | Total providers | Net new clinics | Net new providers |
|-----------------|---------------|-----------------|-----------------|-------------------|
| 1 | 2 | 10 | 2 | 10 |
| 2 | 4 | 20 | 2 | 10 |
| 3 | 8 | 40 | 4 | 20 |
| 4 | 16 | 80 | 8 | 40 |
| 5 | 32 | 160 | 16 | 80 |

**Commercial Year 1** begins after certification/pilot ramp (~**6–12 months** from seed Closing per [Project Plan](STRATEGIC-PARTNER-PROJECT-PLAN.md)). Revenue in Year 1 assumes full-year billing on initial 2 clinics at pilot pricing.

---

## Revenue projection (Base case, CAD)

| Year | Providers | Subscription revenue | Implementation revenue | **Total revenue** |
|------|-----------|----------------------|------------------------|-------------------|
| 1 | 10 | $19,200 | $12,000 | **$31,200** |
| 2 | 20 | $48,000 | $12,000 | **$60,000** |
| 3 | 40 | $96,000 | $24,000 | **$120,000** |
| 4 | 80 | $192,000 | $48,000 | **$240,000** |
| 5 | 160 | $384,000 | $96,000 | **$480,000** |

**Formulas:**

- Subscription Year 1: 10 × $160 × 12 = **$19,200**
- Subscription Years 2–5: providers × $200 × 12
- Implementation: net new clinics × $6,000

**5-year cumulative revenue (Base):** **~$931,200**

---

## Scenario comparison (Year 5 snapshot)

| Scenario | Blended $/provider/mo | Year 5 providers | Year 5 subscription | Year 5 total revenue* |
|----------|---------------------|------------------|---------------------|------------------------|
| Conservative | $150 | 160 | $288,000 | **~$384,000** |
| **Base** | **$200** | **160** | **$384,000** | **~$480,000** |
| Upside | $220 | 160 | $422,400 | **~$518,400** |

*Includes implementation on 16 net new clinics at $6k (Upside uses $8k impl = $128k → **~$550k** total).

---

## Cost structure (aligned with seed plan)

Costs split into **(A) pre-revenue / seed deployment** and **(B) ongoing operating expenses** once clinics are live.

### A. Seed and certification spend (from Term Sheet / Project Plan)

| Bucket | Amount (CAD) | Timing |
|--------|--------------|--------|
| Seed investment (total commitment) | $300,000–$600,000 | ~18 months, tranched |
| Founder development fee (Company) | $100,000–$120,000 | Min 40% at Closing |
| OntarioMD milestone fees | ~$27,500 | Phase A |
| Audit, legal, pilot band | $50,000–$150,000 | Phases A–C |

**Base model uses $450,000 seed deployment** over Commercial Years 1–2 (overlaps certification + first pilots).

### B. Ongoing operating expenses (annual, estimated)

| Category | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|----------|--------|--------|--------|--------|--------|
| Cloud (Supabase, Netlify, tools) | $12k | $18k | $30k | $48k | $72k |
| Compliance & maintenance | $25k | $30k | $35k | $40k | $45k |
| Support & success (staff/contract) | $20k | $55k | $85k | $120k | $160k |
| Sales & marketing | $15k | $35k | $55k | $80k | $110k |
| G&A (legal, accounting, insurance) | $18k | $22k | $28k | $35k | $42k |
| **Total OpEx** | **$90k** | **$160k** | **$233k** | **$323k** | **$429k** |

Year 1 OpEx is **incremental** to seed (founder-led support; pilots); heavy certification spend sits in seed tranches above.

### C. Total cost by commercial year (Base)

| Year | Seed / cert spend | Operating OpEx | **Total costs** |
|------|-------------------|----------------|-----------------|
| 1 | $280,000 | $90,000 | **$370,000** |
| 2 | $170,000 | $160,000 | **$330,000** |
| 3 | $40,000 | $233,000 | **$273,000** |
| 4 | $20,000 | $323,000 | **$343,000** |
| 5 | $20,000 | $429,000 | **$449,000** |

Years 1–2: majority of seed tranches deployed. Years 3–5: tail compliance + scale OpEx; minimal new capital unless growth exceeds plan.

---

## Net income projection (Base case, CAD)

| Year | Total revenue | Total costs | **Net income** | **Cumulative net** |
|------|---------------|-------------|----------------|---------------------|
| 1 | $31,200 | $370,000 | **−$338,800** | −$338,800 |
| 2 | $60,000 | $330,000 | **−$270,000** | −$608,800 |
| 3 | $120,000 | $273,000 | **−$153,000** | −$761,800 |
| 4 | $240,000 | $343,000 | **−$103,000** | −$864,800 |
| 5 | $480,000 | $449,000 | **+$31,000** | −$833,800 |

### Interpretation

- **Years 1–4:** Net cash negative; **seed capital funds certification, pilots, and OpEx** while provider count scales.
- **Year 5 (Base):** First **modest positive net income** (~$31k) at 160 providers; **cumulative** still negative (~−$834k) without counting earlier founder sunk build.
- **Subscription-only break-even on OpEx:** ~**$429k OpEx Year 5** ÷ ($200 × 12) ≈ **179 providers** at Base pricing (or ~**36 clinics** at 5 providers each). Doubling plan reaches 160 providers in Year 5: **near break-even, slightly below** on Base; **Upside pricing** or faster tier mix improves margin sooner.

---

## Unit economics

| Metric | Base case |
|--------|-----------|
| ARPU (subscription) | $200/provider/month ($2,400/year) |
| Implementation ARPU (Year 1 cohort) | $6,000/clinic one-time |
| Year 5 MRR | $32,000/month (160 × $200) |
| Year 5 ARR (subscription only) | $384,000 |
| Gross margin (software) | **~75–85%** after cloud (typical SaaS; no COGS beyond hosting/support) |
| LTV (5-year sub, no churn) | ~$12,000/provider at $200/mo |
| Payback on $6k implementation | ~3 months of subscription revenue per provider at Standard tier |

---

## How implementation planning maps to revenue

| Implementation milestone | Revenue impact |
|--------------------------|----------------|
| Phases 0–8 complete (now) | Product ready; **no recurring revenue** until paid clinics |
| Phase A–B (cert + live pipes) | Unlocks **Standard tier** value (billing, OLIS, eRx); required for Ontario list pricing |
| Phase C (pilots) | **First 2 clinics**; pilot discount; implementation fees |
| Phase D (scale) | Supports **doubling**; support and sales OpEx scale with clinic count |
| Seed tranches | Fund gap until **~Year 4–5** subscription scale covers OpEx |

---

## Sensitivities and risks

1. **Slower doubling:** One year slip in clinic acquisition pushes break-even out 12+ months.
2. **Churn:** Not modeled; 10% annual churn reduces Year 5 providers to ~144 effective.
3. **Pricing pressure:** Conservative $150/provider/mo delays profit to ~**215 providers** for OpEx cover.
4. **Credential delays:** Phase B slip delays live billing integrations → harder to justify Standard tier price.
5. **Support intensity:** Multi-clinic EMR support can exceed model; Year 4–5 OpEx may run **15–25%** higher.

---

## Summary for Strategic Partner discussions

| Question | Base case answer |
|----------|------------------|
| Year 1 revenue (2 clinics, 10 providers)? | **~$31k** (pilot pricing + setup fees) |
| Year 5 revenue (32 clinics, 160 providers)? | **~$480k** total (**~$384k** subscription) |
| When does net income turn positive? | **Year 5** (~$31k); earlier under Upside pricing or slower OpEx growth |
| What funds Years 1–4? | **Seed $300k–$600k** + founder development fee structure |
| Why invest before profit? | Platform **already built**; seed buys certification, live pipes, and GTM to reach **doubling SaaS scale** |

---

*Illustrative model for diligence only. Not a forecast guarantee. Actual results depend on pricing, churn, sales velocity, credential timing, and operating choices. Align with [Term Sheet](TERM-SHEET-SEED-PREFERRED-SHARE.md) for capital terms.*
