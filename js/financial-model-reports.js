/**
 * Renders financial model tables on Strategic Partner report pages.
 */
(function (global) {
  'use strict';

  const FM = () => global.MediForgeFinancialModel;

  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') node.className = v;
      else node.setAttribute(k, v);
    });
    if (html != null) node.innerHTML = html;
    return node;
  }

  function fillTbody(tbody, rows) {
    if (!tbody) return;
    tbody.innerHTML = '';
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.className) tr.className = row.className;
      row.cells.forEach((cell) => {
        const td = document.createElement('td');
        if (cell.className) td.className = cell.className;
        if (cell.colSpan) td.colSpan = cell.colSpan;
        td.innerHTML = cell.html != null ? cell.html : (cell.text != null ? cell.text : '');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function buildOutflowDetailRows(p, fmt) {
    return p.seedUse.trancheBlocks.flatMap((block) => {
      const header = {
        cells: [
          { html: '<strong>T' + block.tranche + '</strong>' },
          { html: '<strong>' + block.period + '</strong> · ' + block.milestone },
          { html: '<strong>' + fmt(block.trancheAmount) + '</strong>', className: 'num' }
        ]
      };
      const lines = block.items.map((item) => ({
        cells: [
          { text: '' },
          { text: item.label },
          { text: fmt(item.amount), className: 'num' }
        ]
      }));
      const total = {
        className: 'highlight',
        cells: [
          { text: '' },
          { html: '<strong>Tranche ' + block.tranche + ' total outflows</strong>' },
          { html: '<strong>' + fmt(block.totalOutflows) + '</strong>', className: 'num' }
        ]
      };
      return [header, ...lines, total];
    });
  }

  function shortPrimaryUses(block) {
    const labels = block.items
      .filter((it) => it.key !== 'remainder')
      .slice(0, 3)
      .map((it) => it.label.split(' (')[0].split(' ($')[0]);
    const suffix = block.items.filter((it) => it.key !== 'remainder').length > 3 ? '; …' : '';
    return labels.join('; ') + suffix;
  }

  function showCustomBanner() {
    const m = FM();
    if (!m || !m.hasCustomOverrides()) return;
    const banner = document.getElementById('fm-custom-banner');
    if (banner) {
      banner.hidden = false;
      banner.innerHTML = '<strong>Custom model active.</strong> Figures reflect your saved inputs on the <a href="/financial-model">Financial Model</a> page. <button type="button" id="fm-reset-inline">Reset to defaults</button>';
      const btn = document.getElementById('fm-reset-inline');
      if (btn) btn.addEventListener('click', () => { m.resetOverrides(); location.reload(); });
    }
  }

  function renderRevenuePage() {
    const m = FM();
    if (!m) return;
    const p = m.computeProjection();
    const fmt = m.formatCad;

    const heroMeta = document.getElementById('fm-hero-meta');
    if (heroMeta) heroMeta.textContent = 'Clinics: ' + p.summary.clinicGrowth + ' · ' + (m.hasCustomOverrides() ? 'Custom assumptions' : 'Default assumptions');

    const stats = document.querySelectorAll('[data-fm-stat]');
    stats.forEach((node) => {
      const key = node.getAttribute('data-fm-stat');
      if (key === 'pricing') node.textContent = fmt(p.assumptions.monthlySubRate - 80, true) + '–' + fmt(p.assumptions.monthlySubRate + 50, true);
      if (key === 'providers') node.textContent = p.years[0].providers + ' → ' + p.years[4].providers;
      if (key === 'y5rev') node.textContent = fmt(p.summary.year5Revenue, true);
      if (key === 'oppos') node.textContent = 'Year ' + (p.summary.operatingPositiveYear || '3') + '+';
    });

    fillTbody(document.getElementById('fm-growth-tbody'), p.years.map((y, i) => ({
      className: i === 4 ? 'highlight' : '',
      cells: [
        { text: String(y.year) },
        { text: String(y.clinics), className: 'num' },
        { text: String(y.providers), className: 'num' },
        { text: String(y.netNewClinics), className: 'num' }
      ]
    })));

    const revNote = document.getElementById('fm-revenue-note');
    if (revNote) revNote.innerHTML = fmt(p.assumptions.monthlySubRate) + '/provider/mo (Year 1 pilot ' + fmt(p.years[0].monthlyRate) + '); setup fee <strong>' + fmt(p.assumptions.setupFeeRevenue) + '</strong> per new clinic.';

    fillTbody(document.getElementById('fm-revenue-tbody'), p.years.map((y, i) => ({
      className: i === 4 ? 'highlight' : '',
      cells: [
        { text: String(y.year) },
        { text: fmt(y.subscription), className: 'num' },
        { text: fmt(y.setupFees), className: 'num' },
        { text: fmt(y.revenue), className: 'num' }
      ]
    })));

    fillTbody(document.getElementById('fm-onetime-tbody'), p.years.filter((y) => y.oneTimeCert > 0 || y.year <= 2).map((y) => ({
      cells: [
        { text: y.year <= 2 ? String(y.year) : '3–5' },
        { text: y.year <= 2 ? fmt(y.oneTimeCert) : '$0', className: 'num' }
      ]
    })).concat(p.years[2].oneTimeCert === 0 ? [{ cells: [{ text: '3–5' }, { text: '$0', className: 'num' }] }] : []));

    const onetimeBody = document.getElementById('fm-onetime-tbody');
    if (onetimeBody) {
      const rows = [];
      p.years.forEach((y) => {
        if (y.year <= 2) rows.push({ cells: [{ text: String(y.year) }, { text: fmt(y.oneTimeCert), className: 'num' }] });
      });
      rows.push({ cells: [{ text: '3–5' }, { text: '$0', className: 'num' }] });
      fillTbody(onetimeBody, rows);
    }

    fillTbody(document.getElementById('fm-costs-tbody'), p.years.map((y, i) => ({
      cells: [
        { text: String(y.year) },
        { text: fmt(y.onboarding), className: 'num' },
        { text: fmt(y.opex), className: 'num' },
        { text: fmt(y.operatingCosts), className: 'num' }
      ]
    })));

    fillTbody(document.getElementById('fm-operating-tbody'), p.years.map((y) => ({
      className: y.operatingNet >= 0 ? 'positive' : 'negative',
      cells: [
        { text: String(y.year) },
        { text: fmt(y.revenue), className: 'num' },
        { text: fmt(y.operatingCosts), className: 'num' },
        { text: (y.operatingNet >= 0 ? '+' : '−') + fmt(Math.abs(y.operatingNet)).replace('$', '$'), className: 'num' }
      ]
    })));

    fillTbody(document.getElementById('fm-allin-tbody'), p.years.map((y) => ({
      className: y.netIncome >= 0 ? 'positive' : 'negative',
      cells: [
        { text: String(y.year) },
        { text: fmt(y.revenue), className: 'num' },
        { text: fmt(y.allInCosts), className: 'num' },
        { text: (y.netIncome >= 0 ? '+' : '−') + fmt(Math.abs(y.netIncome)).replace('$', '$'), className: 'num' }
      ]
    })));
  }

  function renderProjectPlanPage() {
    const m = FM();
    if (!m) return;
    const p = m.computeProjection();
    const fmt = m.formatCad;
    const a = p.assumptions;

    const seedStat = document.querySelector('[data-fm-stat="seed"]');
    if (seedStat) seedStat.textContent = fmt(a.seedLow, true) + '–' + fmt(a.seedHigh, true);

    fillTbody(document.getElementById('fm-capital-align-tbody'), [
      { cells: [{ html: 'Pre-Closing' }, { html: 'Phases 0–8 software (complete)' }, { text: 'n/a' }, { html: 'Dev fee <strong>' + fmt(a.devFeeLow, true) + '–' + fmt(a.devFeeHigh, true) + '</strong> at Closing' }, { html: 'Platform already delivered' }] },
      ...p.tranches.map((t, i) => {
        const block = p.seedUse.trancheBlocks[i];
        return {
          cells: [
            { html: block.period },
            { html: block.milestone },
            { text: t.index + ' (' + Math.round(t.pct * 100) + '%)' },
            { html: '<strong>' + fmt(t.amountLow, true) + '–' + fmt(t.amountHigh, true) + '</strong><br><small>Mid: ' + fmt(t.amount) + '</small>' },
            { html: shortPrimaryUses(block) + ' · <a href="/capital-deployment-detail">Detail</a>' }
          ]
        };
      }),
      { cells: [{ html: 'Ongoing' }, { html: 'Phase D: scale' }, { text: 'Revenue / future round' }, { text: 'TBD' }, { html: 'Expansion and maintenance' }] }
    ]);

    fillTbody(document.getElementById('fm-outflow-detail-tbody'), buildOutflowDetailRows(p, fmt));
  }

  function renderCapitalDeploymentPage() {
    const m = FM();
    if (!m) return;
    const p = m.computeProjection();
    const fmt = m.formatCad;

    const seedStat = document.querySelector('[data-fm-stat="seed"]');
    if (seedStat) seedStat.textContent = fmt(p.assumptions.seedLow, true) + '–' + fmt(p.assumptions.seedHigh, true);

    const grandStat = document.getElementById('fm-grand-stat');
    if (grandStat) grandStat.textContent = fmt(p.seedUse.grandTotal);

    fillTbody(document.getElementById('fm-outflow-detail-tbody'), buildOutflowDetailRows(p, fmt));

    const grand = document.getElementById('fm-outflow-grand');
    if (grand) grand.innerHTML = '<strong>' + fmt(p.seedUse.grandTotal) + '</strong>';
  }

  function renderDevFeeSection(opts) {
    const m = FM();
    if (!m) return;
    const container = document.getElementById('fm-devfee-section');
    if (!container) return;
    container.innerHTML = m.buildDevFeeScheduleHtml(m.getAssumptions(), opts || {});

    const closingStat = document.querySelector('[data-fm-stat="devfee-closing"]');
    if (closingStat) {
      const d = m.computeDevFeeBreakdown();
      closingStat.textContent = m.formatCad(d.closingLow, true) + '–' + m.formatCad(d.closingHigh, true);
    }
  }

  function renderTermSheetPage() {
    const m = FM();
    if (!m) return;
    const p = m.computeProjection();
    const fmt = m.formatCad;
    const a = p.assumptions;

    const stats = document.querySelectorAll('[data-fm-stat]');
    stats.forEach((node) => {
      const key = node.getAttribute('data-fm-stat');
      if (key === 'seed') node.textContent = fmt(a.seedLow, true) + '–' + fmt(a.seedHigh, true);
      if (key === 'devfee') node.textContent = fmt(a.devFeeLow, true) + '–' + fmt(a.devFeeHigh, true);
    });

    const devFeePara = document.getElementById('fm-devfee-text');
    if (devFeePara) devFeePara.remove();

    renderDevFeeSection({ termSheetLink: true, revenueLink: true });

    fillTbody(document.getElementById('fm-tranche-tbody'), p.seedUse.trancheBlocks.map((block, i) => {
      const t = p.tranches[i];
      return {
        cells: [
          { text: String(block.tranche) },
          { text: block.period },
          { text: Math.round(t.pct * 100) + '%' },
          { html: fmt(t.amountLow, true) + '–' + fmt(t.amountHigh, true) + '<br><small>Mid: ' + fmt(t.amount) + '</small>' },
          { text: block.milestone },
          { html: shortPrimaryUses(block) }
        ]
      };
    }));

    const seedSummary = document.getElementById('fm-seed-composition');
    if (seedSummary) {
      const cats = Object.entries(p.seedUse.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => '<li><strong>' + k + ':</strong> ' + fmt(v) + '</li>')
        .join('');
      seedSummary.innerHTML = '<p>At <strong>' + fmt(a.seedCommitment) + '</strong> midpoint commitment, the <strong>$' + fmt(a.seedLow, true).replace('$', '') + '–' + fmt(a.seedHigh, true) + '</strong> round deploys as follows (scaled to your model):</p><ul>' + cats + '</ul><p><strong>Grand total outflows:</strong> ' + fmt(p.seedUse.grandTotal) + ' (equals committed seed at midpoint).</p>';
    }
  }

  function initPage() {
    showCustomBanner();
    const page = document.body.getAttribute('data-fm-page');
    if (page === 'revenue') renderRevenuePage();
    if (page === 'project-plan') renderProjectPlanPage();
    if (page === 'term-sheet') renderTermSheetPage();
    if (page === 'capital-deployment') renderCapitalDeploymentPage();
    if (page === 'valuation') {
      renderDevFeeSection({
        termSheetLink: true,
        revenueLink: true,
        intro: 'A one-time development fee of <strong>CAD ' + FM().formatCad(FM().computeDevFeeBreakdown().totalLow) + '–' + FM().formatCad(FM().computeDevFeeBreakdown().totalHigh) + '</strong> is proposed. This compensates for the Founder\'s pre-financing development work that created the deployed platform and de-risked the opportunity for all parties.'
      });
    }
  }

  global.MediForgeFinancialReports = { initPage, renderRevenuePage, renderProjectPlanPage, renderTermSheetPage };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }

  global.addEventListener(FM().EVENT_NAME, initPage);
})(window);
