'use strict';

function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Aging buckets and reconciliation helpers.
 */
function buildAgingReport(invoices, asOfDate) {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  const buckets = {
    current: { label: '0–30 days', total: 0, count: 0, invoices: [] },
    days31_60: { label: '31–60 days', total: 0, count: 0, invoices: [] },
    days61_90: { label: '61–90 days', total: 0, count: 0, invoices: [] },
    over90: { label: '90+ days', total: 0, count: 0, invoices: [] }
  };

  (invoices || []).forEach((inv) => {
    const due = parseFloat(inv.amountDue ?? inv.payerSplit?.patientDue ?? 0);
    if (due <= 0 || inv.status === 'paid' || inv.status === 'cancelled') return;
    const invDate = new Date(inv.date || inv.createdAt || inv.created_at);
    const days = Math.floor((asOf - invDate) / (1000 * 60 * 60 * 24));
    const entry = { id: inv.id, invoiceNumber: inv.invoiceNumber, amountDue: due, days };
    let bucket = buckets.current;
    if (days > 90) bucket = buckets.over90;
    else if (days > 60) bucket = buckets.days61_90;
    else if (days > 30) bucket = buckets.days31_60;
    bucket.total = roundMoney(bucket.total + due);
    bucket.count += 1;
    bucket.invoices.push(entry);
  });

  return {
    asOfDate: asOf.toISOString().split('T')[0],
    buckets,
    totalOutstanding: roundMoney(
      Object.values(buckets).reduce((s, b) => s + b.total, 0)
    )
  };
}

function buildReconciliationSummary({ invoices, remittances, payments }) {
  const paid = (payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remitted = (remittances || []).reduce(
    (s, r) => s + (parseFloat(r.totalPaid) || 0),
    0
  );
  const billed = (invoices || []).reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const outstanding = (invoices || []).reduce(
    (s, i) => s + (parseFloat(i.amountDue) || 0),
    0
  );
  return {
    totalBilled: roundMoney(billed),
    totalPatientPayments: roundMoney(paid),
    totalRemittances: roundMoney(remitted),
    totalOutstanding: roundMoney(outstanding),
    variance: roundMoney(billed - paid - remitted - outstanding)
  };
}

function identifyDunningCandidates(invoices, asOfDate) {
  const aging = buildAgingReport(invoices, asOfDate);
  return [
    ...aging.buckets.days61_90.invoices,
    ...aging.buckets.over90.invoices
  ].sort((a, b) => b.days - a.days);
}

module.exports = {
  buildAgingReport,
  buildReconciliationSummary,
  identifyDunningCandidates
};
