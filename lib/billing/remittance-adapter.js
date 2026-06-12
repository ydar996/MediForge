'use strict';

/**
 * Remittance advice / ERA processing stub
 */
function parseRemittanceAdvice(raw) {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { parsed: false, format: 'unknown', error: 'Invalid remittance payload' };
    }
  }

  const payments = raw.payments || raw.claimPayments || [];
  return {
    parsed: true,
    format: raw.format || 'json',
    payerId: raw.payerId,
    remittanceDate: raw.remittanceDate || raw.paymentDate,
    totalPaid: raw.totalPaid || payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
    payments: payments.map((p) => ({
      claimId: p.claimId || p.claimReference,
      invoiceId: p.invoiceId,
      paidAmount: parseFloat(p.amount) || 0,
      patientResponsibility: parseFloat(p.patientResponsibility) || 0,
      adjustmentReason: p.adjustmentReason || p.reasonCode,
      status: p.status || 'paid'
    }))
  };
}

function reconcileRemittanceWithInvoices(remittance, invoices) {
  const results = [];
  (remittance.payments || []).forEach((rp) => {
    const inv = (invoices || []).find(
      (i) => i.id === rp.invoiceId || i.invoiceNumber === rp.claimId
    );
    results.push({
      remittancePayment: rp,
      invoice: inv || null,
      matched: Boolean(inv),
      remainingPatientBalance: inv
        ? Math.max(0, (inv.payerSplit?.patientDue || inv.amountDue) - rp.paidAmount)
        : null
    });
  });
  return results;
}

module.exports = { parseRemittanceAdvice, reconcileRemittanceWithInvoices };
