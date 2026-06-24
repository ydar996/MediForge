'use strict';

/**
 * OHIP billing period and cut-off helpers.
 * Service dates map to a claim period; submission must occur before period cut-off.
 * Rules are simplified for software validation; confirm against current MOH calendar.
 */

function parseYmd(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Billing period = calendar month of service date (YYYY-MM).
 */
function getBillingPeriod(serviceDate) {
  const d = parseYmd(serviceDate);
  if (!d) return null;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return {
    periodKey: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month
  };
}

/**
 * Cut-off: last day of month following service month (end of M+1).
 * Example: June 2026 services -> cut-off July 31, 2026.
 */
function getCutoffDate(serviceDate) {
  const period = getBillingPeriod(serviceDate);
  if (!period) return null;
  const cutoffMonth = period.month === 12 ? 1 : period.month + 1;
  const cutoffYear = period.month === 12 ? period.year + 1 : period.year;
  const lastDay = new Date(Date.UTC(cutoffYear, cutoffMonth, 0));
  return formatYmd(lastDay);
}

function isWithinCutoff(serviceDate, asOfDate) {
  const cutoff = getCutoffDate(serviceDate);
  const asOf = parseYmd(asOfDate || new Date().toISOString());
  const cutoffD = parseYmd(cutoff);
  if (!asOf || !cutoffD) return { within: false, cutoffDate: cutoff, reason: 'invalid date' };
  const within = asOf.getTime() <= cutoffD.getTime();
  return {
    within,
    cutoffDate: cutoff,
    reason: within ? 'within cut-off' : 'past cut-off; may require manual adjustment'
  };
}

function validateServiceDatesForBatch(claims, asOfDate) {
  const warnings = [];
  (claims || []).forEach((claim, idx) => {
    const serviceDate = claim.serviceDate || claim.invoice?.date;
    const check = isWithinCutoff(serviceDate, asOfDate);
    if (!check.within) {
      warnings.push({
        claimIndex: idx,
        claimReference: claim.claimReference || claim.invoice?.invoiceNumber,
        serviceDate,
        cutoffDate: check.cutoffDate,
        message: check.reason
      });
    }
  });
  return { valid: warnings.length === 0, warnings };
}

module.exports = {
  getBillingPeriod,
  getCutoffDate,
  isWithinCutoff,
  validateServiceDatesForBatch
};
