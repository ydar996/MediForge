'use strict';

(function (global) {
  function parseYmd(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).slice(0, 10);
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }

  function getCutoffDate(serviceDate) {
    const d = parseYmd(serviceDate);
    if (!d) return null;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const cutoffMonth = month === 12 ? 1 : month + 1;
    const cutoffYear = month === 12 ? year + 1 : year;
    return new Date(Date.UTC(cutoffYear, cutoffMonth, 0)).toISOString().slice(0, 10);
  }

  function daysUntilCutoff(serviceDate, asOfDate) {
    const cutoff = getCutoffDate(serviceDate);
    const asOf = parseYmd(asOfDate || new Date().toISOString());
    const cutoffD = parseYmd(cutoff);
    if (!asOf || !cutoffD) return null;
    return Math.ceil((cutoffD.getTime() - asOf.getTime()) / 86400000);
  }

  function renderBillingCutoffBanner(container) {
    if (!container) return;
    const today = new Date().toISOString().slice(0, 10);
    const prevMonth = new Date();
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    const sampleService = prevMonth.toISOString().slice(0, 10);
    const cutoff = getCutoffDate(sampleService);
    const daysLeft = daysUntilCutoff(sampleService, today);
    let tone = '#e8f5e9';
    let border = '#008753';
    let msg = `OHIP billing reminder: claims for last month should be submitted before cut-off (${cutoff}).`;
    if (daysLeft !== null && daysLeft <= 7 && daysLeft >= 0) {
      tone = '#fff8e1';
      border = '#f9a825';
      msg = `OHIP cut-off approaching: ${daysLeft} day(s) left to submit last month's claims (cut-off ${cutoff}).`;
    } else if (daysLeft !== null && daysLeft < 0) {
      tone = '#fdecea';
      border = '#c62828';
      msg = `Some last-month services may be past OHIP cut-off (${cutoff}). Review the claims queue before submitting.`;
    }
    container.innerHTML =
      `<div style="background:${tone};border:1px solid ${border};border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.93rem;">` +
      `<strong>MCEDT cut-off:</strong> ${msg} <a href="claims-queue" style="margin-left:8px;font-weight:700;">Open claims queue</a></div>`;
  }

  global.MediForgeBillingCutoff = { getCutoffDate, daysUntilCutoff, renderBillingCutoffBanner };
})(typeof window !== 'undefined' ? window : globalThis);
