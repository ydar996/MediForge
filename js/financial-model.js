/**
 * MediForge Strategic Partner financial model (browser-local).
 * Custom assumptions persist in localStorage and drive report pages when active.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'mediforge_financial_model_v1';
  const EVENT_NAME = 'mediforge-financial-model-change';

  const DEFAULTS = {
    seedCommitment: 450000,
    seedLow: 300000,
    seedHigh: 600000,
    devFee: 100000,
    devFeeLow: 80000,
    devFeeHigh: 120000,
    devFeeClosingPct: 0.4,
    tranchePcts: [0.25, 0.25, 0.3, 0.2],
    providersPerClinic: 5,
    year1SubDiscount: 0.2,
    monthlySubRate: 200,
    setupFeeRevenue: 6000,
    onboardingCostPerClinic: 1500,
    years: [
      { clinics: 2, monthlyRate: 160, opex: 75000, oneTimeCert: 350000 },
      { clinics: 5, monthlyRate: 200, opex: 100000, oneTimeCert: 100000 },
      { clinics: 10, monthlyRate: 200, opex: 120000, oneTimeCert: 0 },
      { clinics: 20, monthlyRate: 200, opex: 155000, oneTimeCert: 0 },
      { clinics: 40, monthlyRate: 200, opex: 195000, oneTimeCert: 0 }
    ],
    /** Outflow line items per tranche at $450k seed (scale linearly with commitment). */
    trancheOutflows: [
      {
        tranche: 1,
        period: 'Closing (Month 0)',
        milestone: 'Definitive agreements; IP assigned',
        items: [
          { label: 'Legal & definitive agreements', amount: 20000 },
          { label: 'Founder development fee ($32k–$48k at Closing, 40%)', key: 'devFeeClosing' },
          { label: 'PIA / security audit retainer', amount: 15000 },
          { label: 'OntarioMD vendor consultation', amount: 5000 },
          { label: 'Reference clinic search & LOI prep', amount: 10000 },
          { label: 'Compliance counsel retainer', amount: 12500 },
          { label: 'Corporate admin & insurance', amount: 5000 },
          { label: 'Working capital reserve', key: 'remainder' }
        ]
      },
      {
        tranche: 2,
        period: 'Months 2–4',
        milestone: 'Phase A: Stage 1 submitted; audit engaged',
        items: [
          { label: 'OntarioMD milestone fees (initial)', amount: 27500 },
          { label: 'Privacy impact assessment & security audit', amount: 45000 },
          { label: 'Certification evidence & documentation', amount: 15000 },
          { label: 'Reference site preparation', amount: 15000 },
          { label: 'Dev fee installment (if hybrid)', amount: 10000 },
          { label: 'Travel & site visits', amount: 5000 },
          { label: 'Contingency', key: 'remainder' }
        ]
      },
      {
        tranche: 3,
        period: 'Months 5–10',
        milestone: 'Phase B: first provincial credential live',
        items: [
          { label: 'Provincial credential enrollment (MCEDT, OLIS, etc.)', amount: 40000 },
          { label: 'Conformance testing & gateway engineering', amount: 35000 },
          { label: 'Integration engineering support', amount: 30000 },
          { label: 'Stage 5 validation preparation', amount: 20000 },
          { label: 'Clinic credential wiring & test harness', amount: 10000 },
          { label: 'Contingency', key: 'remainder' }
        ]
      },
      {
        tranche: 4,
        period: 'Months 11–18',
        milestone: 'Phase C: first pilot clinic operational',
        items: [
          { label: 'Pilot clinic support (2–3 sites)', amount: 25000 },
          { label: 'Sales & marketing launch', amount: 20000 },
          { label: 'Commercial operations & support', amount: 20000 },
          { label: 'Remaining dev fee balance (if note/hybrid)', key: 'devFeeRemainder' },
          { label: 'Collateral, events & partner outreach', amount: 10000 },
          { label: 'Contingency', key: 'remainder' }
        ]
      }
    ]
  };

  const BASE_SEED = 450000;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadOverrides() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function hasCustomOverrides() {
    return !!loadOverrides();
  }

  function getAssumptions() {
    const overrides = loadOverrides();
    if (!overrides) return deepClone(DEFAULTS);
    return mergeAssumptions(deepClone(DEFAULTS), overrides);
  }

  function mergeAssumptions(base, overrides) {
    const out = { ...base, ...overrides };
    if (overrides.years) {
      out.years = base.years.map((y, i) => ({ ...y, ...(overrides.years[i] || {}) }));
    }
    if (overrides.trancheOutflows) {
      out.trancheOutflows = overrides.trancheOutflows;
    }
    return out;
  }

  function saveOverrides(partial) {
    const current = getAssumptions();
    const merged = mergeAssumptions(current, partial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: merged }));
    return merged;
  }

  function resetOverrides() {
    localStorage.removeItem(STORAGE_KEY);
    global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
  }

  function scaleAmount(amount, seedCommitment) {
    return Math.round((amount * seedCommitment) / BASE_SEED);
  }

  function formatCad(n, compact) {
    if (n == null || Number.isNaN(n)) return '-';
    const neg = n < 0;
    const abs = Math.abs(Math.round(n));
    if (compact) {
      if (abs >= 1000000) return (neg ? '−' : '') + '$' + (abs / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (abs >= 1000) return (neg ? '−' : '') + '$' + Math.round(abs / 1000) + 'k';
    }
    return (neg ? '−' : '') + '$' + abs.toLocaleString('en-CA');
  }

  function formatRange(low, high, compact) {
    return formatCad(low, compact) + '–' + formatCad(high, compact).replace('−', '');
  }

  function computeTranches(seedCommitment, tranchePcts) {
    return tranchePcts.map((pct, i) => ({
      index: i + 1,
      pct,
      amount: Math.round(seedCommitment * pct),
      amountLow: Math.round(DEFAULTS.seedLow * pct),
      amountHigh: Math.round(DEFAULTS.seedHigh * pct)
    }));
  }

  function resolveTrancheOutflows(assumptions) {
    const seed = assumptions.seedCommitment;
    const scale = seed / BASE_SEED;
    const devFeeClosing = Math.round(assumptions.devFee * assumptions.devFeeClosingPct);
    const devFeeRemainder = Math.max(0, assumptions.devFee - devFeeClosing - scaleAmount(10000, seed));

    const tranches = computeTranches(seed, assumptions.tranchePcts);

    return assumptions.trancheOutflows.map((block, bi) => {
      const trancheAmt = tranches[bi].amount;
      let allocated = 0;
      const items = block.items.map((item) => {
        let amount;
        if (item.key === 'devFeeClosing') amount = devFeeClosing;
        else if (item.key === 'devFeeRemainder') amount = devFeeRemainder;
        else if (item.key === 'remainder') amount = 0;
        else amount = scaleAmount(item.amount, seed);
        if (item.key !== 'remainder') allocated += amount;
        return { label: item.label, amount, key: item.key || null };
      });
      const remainderItem = items.find((it) => it.key === 'remainder');
      if (remainderItem) {
        remainderItem.amount = Math.max(0, trancheAmt - allocated);
        allocated += remainderItem.amount;
      }
      return {
        tranche: block.tranche,
        period: block.period,
        milestone: block.milestone,
        trancheAmount: trancheAmt,
        items,
        totalOutflows: allocated
      };
    });
  }

  function computeSeedUseSummary(assumptions) {
    const outflows = resolveTrancheOutflows(assumptions);
    const byCategory = {};
    let grandTotal = 0;
    outflows.forEach((block) => {
      block.items.forEach((item) => {
        if (item.key === 'remainder') return;
        byCategory[item.label] = (byCategory[item.label] || 0) + item.amount;
        grandTotal += item.amount;
      });
      const rem = block.items.find((it) => it.key === 'remainder');
      if (rem) {
        byCategory['Working capital / contingency'] = (byCategory['Working capital / contingency'] || 0) + rem.amount;
        grandTotal += rem.amount;
      }
    });
    return { byCategory, grandTotal, trancheBlocks: outflows };
  }

  function computeRevenueYear(yearIndex, assumptions, prevClinics) {
    const y = assumptions.years[yearIndex];
    const ppc = assumptions.providersPerClinic;
    const providers = y.clinics * ppc;
    const netNew = Math.max(0, y.clinics - (prevClinics || 0));
    const rate = y.monthlyRate != null ? y.monthlyRate : assumptions.monthlySubRate;
    const subscription = providers * rate * 12;
    const setupFees = netNew * assumptions.setupFeeRevenue;
    const revenue = subscription + setupFees;
    const onboarding = netNew * assumptions.onboardingCostPerClinic;
    const opex = y.opex || 0;
    const oneTime = y.oneTimeCert || 0;
    const operatingCosts = onboarding + opex;
    const allInCosts = operatingCosts + oneTime;
    return {
      year: yearIndex + 1,
      clinics: y.clinics,
      providers,
      netNewClinics: netNew,
      monthlyRate: rate,
      subscription,
      setupFees,
      revenue,
      onboarding,
      opex,
      operatingCosts,
      oneTimeCert: oneTime,
      allInCosts,
      operatingNet: revenue - operatingCosts,
      netIncome: revenue - allInCosts
    };
  }

  function computeDevFeeBreakdown(assumptions) {
    assumptions = assumptions || getAssumptions();
    const pct = assumptions.devFeeClosingPct;
    const low = assumptions.devFeeLow;
    const high = assumptions.devFeeHigh;
    const mid = assumptions.devFee;
    const closingLow = Math.round(low * pct);
    const closingHigh = Math.round(high * pct);
    const balanceLow = low - closingLow;
    const balanceHigh = high - closingHigh;
    const closingMid = Math.round(mid * pct);
    const balanceMid = mid - closingMid;
    const noteInterestLow = Math.round(balanceLow * 0.08);
    const noteInterestHigh = Math.round(balanceHigh * 0.12 * 1.5);
    const convertLow = Math.round(balanceMid / 0.85);
    const convertHigh = Math.round(balanceMid / 0.75);
    const hybridNote = Math.round(balanceMid * 0.5);
    const hybridRevShare = balanceMid - hybridNote;
    return {
      totalLow: low,
      totalHigh: high,
      totalMid: mid,
      closingPct: pct,
      closingLow,
      closingHigh,
      closingMid,
      balanceLow,
      balanceHigh,
      balanceMid,
      noteRepayLow: balanceLow + noteInterestLow,
      noteRepayHigh: balanceHigh + noteInterestHigh,
      noteRepayMid: balanceMid + Math.round(balanceMid * 0.10 * 1.25),
      convertEquityLow: convertLow,
      convertEquityHigh: convertHigh,
      hybridNote,
      hybridRevShare
    };
  }

  function buildDevFeeScheduleHtml(assumptions, opts) {
    assumptions = assumptions || getAssumptions();
    opts = opts || {};
    const d = computeDevFeeBreakdown(assumptions);
    const fmt = formatCad;
    const termSheetLink = opts.termSheetLink !== false;
    const revenueLink = opts.revenueLink !== false;
    const intro = opts.intro ||
      'Upon Closing, the Company shall pay the Founder a one-time development fee of <strong>CAD ' +
      fmt(d.totalLow) + '–' + fmt(d.totalHigh) + '</strong>. This recognizes Phases 0–8 software delivery' +
      (termSheetLink ? ' and matches the <a href="/valuation-equity-structure">Valuation &amp; Equity Structure</a>' : '') + '.';

    return (
      intro +
      '<table style="margin:16px 0"><thead><tr><th>Component</th><th class="num">Amount (CAD)</th><th>Notes</th></tr></thead><tbody>' +
      '<tr><td>Total development fee</td><td class="num"><strong>' + fmt(d.totalLow) + '–' + fmt(d.totalHigh) + '</strong></td><td>One-time; Phases 0–8 platform already delivered</td></tr>' +
      '<tr class="highlight"><td><strong>Paid at Closing (min 40%)</strong></td><td class="num"><strong>' + fmt(d.closingLow) + '–' + fmt(d.closingHigh) + '</strong></td><td><strong>40%</strong> of fee = cash from Tranche 1 (midpoint <strong>' + fmt(d.closingMid) + '</strong>)</td></tr>' +
      '<tr><td>Deferred balance (up to 60%)</td><td class="num">' + fmt(d.balanceLow) + '–' + fmt(d.balanceHigh) + '</td><td>Structured per options below (midpoint <strong>' + fmt(d.balanceMid) + '</strong>)</td></tr>' +
      '</tbody></table>' +
      '<p id="dev-fee-options">The deferred balance may be structured as:</p>' +
      '<div class="fee-option"><p><strong>Option 1: Interest-Bearing Promissory Note</strong><br>' +
      'Deferred portion <strong>' + fmt(d.balanceLow) + '–' + fmt(d.balanceHigh) + '</strong> documented as a Company note to the Founder. ' +
      'Simple interest <strong>8–12%</strong> per annum, repaid over <strong>12–18 months</strong>. ' +
      'Example at <strong>' + fmt(d.balanceMid) + '</strong> midpoint, ~10% over 15 months: interest ~<strong>' + fmt(Math.round(d.balanceMid * 0.10 * 1.25)) + '</strong>; total repayment ~<strong>' + fmt(d.noteRepayMid) + '</strong> ' +
      '(range ~<strong>' + fmt(d.noteRepayLow) + '–' + fmt(d.noteRepayHigh) + '</strong>). ' +
      (termSheetLink ? '<a href="/term-sheet#dev-fee-schedule">Term sheet detail</a> · ' : '') +
      '<a href="/project-plan">Tranche 4 may fund installments</a>.</p></div>' +
      '<div class="fee-option"><p><strong>Option 2: Convertible Note</strong><br>' +
      'Deferred portion <strong>' + fmt(d.balanceLow) + '–' + fmt(d.balanceHigh) + '</strong> converts at the next qualified financing. ' +
      '<strong>15–25% discount</strong> or pre-agreed valuation cap (e.g. <strong>~$2.2M</strong> pre-money). ' +
      'Example: <strong>' + fmt(d.balanceMid) + '</strong> note with <strong>20% discount</strong> → converts as ~<strong>' + fmt(Math.round(d.balanceMid / 0.8)) + '</strong> of equity value. ' +
      '<a href="/valuation-equity-structure#dev-fee-schedule">Valuation context</a>.</p></div>' +
      '<div class="fee-option"><p><strong>Option 3: Hybrid Structure</strong><br>' +
      'Split the <strong>' + fmt(d.balanceMid) + '</strong> midpoint balance: e.g. <strong>' + fmt(d.hybridNote) + '</strong> promissory note (Option 1 terms) plus <strong>' + fmt(d.hybridRevShare) + '</strong> via ' +
      '<strong>1–3% capped revenue share</strong> until paid. Example at <strong>2%</strong> of projected Year 4 subscription revenue (~<strong>$240k</strong>) → ~<strong>$4,800/yr</strong> toward the revenue-share portion' +
      (revenueLink ? ' (<a href="/revenue-projection">revenue model</a>)' : '') + '. ' +
      '<a href="/financial-model">Adjust assumptions</a>.</p></div>' +
      '<p>All structures include full liquidation within <strong>18 months</strong> or upon a liquidity event, whichever occurs first.</p>'
    );
  }

  function computeProjection(assumptions) {
    assumptions = assumptions || getAssumptions();
    const years = [];
    let prevClinics = 0;
    for (let i = 0; i < assumptions.years.length; i++) {
      const row = computeRevenueYear(i, assumptions, prevClinics);
      years.push(row);
      prevClinics = row.clinics;
    }
    const tranches = computeTranches(assumptions.seedCommitment, assumptions.tranchePcts);
    const seedUse = computeSeedUseSummary(assumptions);
    const last = years[years.length - 1];
    return {
      assumptions,
      years,
      tranches,
      seedUse,
      summary: {
        year5Revenue: last.revenue,
        year5Providers: last.providers,
        operatingPositiveYear: years.find((y) => y.operatingNet > 0)?.year || null,
        clinicGrowth: years.map((y) => y.clinics).join(' → ')
      }
    };
  }

  global.MediForgeFinancialModel = {
    STORAGE_KEY,
    EVENT_NAME,
    DEFAULTS: deepClone(DEFAULTS),
    hasCustomOverrides,
    loadOverrides,
    getAssumptions,
    mergeAssumptions,
    saveOverrides,
    resetOverrides,
    computeDevFeeBreakdown,
    buildDevFeeScheduleHtml,
    computeProjection,
    computeTranches,
    resolveTrancheOutflows,
    computeSeedUseSummary,
    formatCad,
    formatRange,
    BASE_SEED
  };
})(typeof window !== 'undefined' ? window : globalThis);
