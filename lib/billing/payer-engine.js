'use strict';

const { loadBillingConfig } = require('./config');

const PROVINCE_PAYER_MAP = {
  ON: 'OHIP',
  QC: 'RAMQ',
  BC: 'MSP',
  AB: 'AHCIP',
  SK: 'SHS',
  MB: 'MHSC',
  NB: 'MCE',
  NS: 'MSI',
  PE: 'PEI_HPEI',
  NL: 'MCP',
  NT: 'NTHIP',
  YT: 'YHCIP',
  NU: 'NHB'
};

const PATIENT_PAY_METHODS = {
  cash: { label: 'Cash', category: 'cash', receiptRequired: true },
  check: { label: 'Check / Cheque', category: 'check', receiptRequired: true },
  bank_transfer: { label: 'Bank transfer (wire/ACH)', category: 'bank', receiptRequired: true },
  etransfer: { label: 'Interac e-Transfer', category: 'bank', receiptRequired: true, countries: ['CA'] },
  zelle: { label: 'Zelle', category: 'bank', receiptRequired: true, countries: ['US', 'CA'] },
  card: { label: 'Credit card', category: 'card', receiptRequired: true },
  debit: { label: 'Debit card', category: 'card', receiptRequired: true },
  mobile_money: { label: 'Mobile money', category: 'mobile', receiptRequired: true }
};

function normalizePhn(value) {
  return String(value || '').replace(/[\s-]/g, '').toUpperCase();
}

function detectPrimaryPayer({ province, paymentSource, privateInsurerId, config }) {
  const cfg = config || loadBillingConfig();
  const prov = (province || cfg.defaultProvince || 'ON').toUpperCase();

  if (paymentSource === 'private_insurance' || paymentSource === 'Insurance') {
    return {
      type: 'private',
      payerId: privateInsurerId || 'PRIVATE_UNKNOWN',
      payerName: cfg.privateInsurers?.[privateInsurerId]?.name || 'Private insurance',
      provincialCode: null
    };
  }

  if (paymentSource === 'cash' || paymentSource === 'Cash' || paymentSource === 'self_pay') {
    return {
      type: 'patient_pay',
      payerId: 'PATIENT',
      payerName: 'Patient pay (self-pay)',
      provincialCode: null
    };
  }

  if (paymentSource === 'wcb') {
    return { type: 'wcb', payerId: 'WCB', payerName: 'Workers compensation', provincialCode: prov };
  }

  const provincialCode = PROVINCE_PAYER_MAP[prov];
  const provincial = cfg.provincialPayers?.[provincialCode];
  return {
    type: 'provincial',
    payerId: provincialCode || `PROV_${prov}`,
    payerName: provincial?.name || `Provincial health (${prov})`,
    provincialCode,
    province: prov
  };
}

/**
 * Split invoice total between payer coverage and patient responsibility
 */
function calculatePatientResponsibility({
  total,
  payerType,
  serviceCodes = [],
  copayAmount,
  deductibleRemaining,
  uninsuredService = false,
  config
}) {
  const cfg = config || loadBillingConfig();
  const amount = parseFloat(total) || 0;
  let patientDue = 0;
  let payerCovered = 0;
  let copay = parseFloat(copayAmount);
  if (Number.isNaN(copay)) copay = cfg.copayRules?.defaultCopay || 0;

  if (uninsuredService || payerType === 'patient_pay') {
    patientDue = amount;
    payerCovered = 0;
  } else if (payerType === 'provincial') {
    payerCovered = Math.max(0, amount - copay);
    patientDue = Math.min(amount, copay);
    if (deductibleRemaining > 0) {
      const dedApply = Math.min(deductibleRemaining, patientDue);
      patientDue = dedApply + Math.max(0, copay - dedApply);
    }
  } else if (payerType === 'private') {
    const coveredPercent = cfg.copayRules?.privateDefaultCoveragePercent ?? 80;
    payerCovered = amount * (coveredPercent / 100);
    patientDue = amount - payerCovered;
  } else {
    patientDue = amount;
  }

  return {
    total: amount,
    payerCovered: roundMoney(payerCovered),
    patientDue: roundMoney(patientDue),
    copay: roundMoney(copay),
    uninsuredService: Boolean(uninsuredService)
  };
}

function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function enrichInvoice(invoiceData, patientProfile, config) {
  const cfg = config || loadBillingConfig();
  const payer = detectPrimaryPayer({
    province: patientProfile?.province || patientProfile?.state,
    paymentSource: patientProfile?.paymentSource || patientProfile?.payment_source,
    privateInsurerId: patientProfile?.privateInsurerId || patientProfile?.insuranceName,
    config: cfg
  });

  const split = calculatePatientResponsibility({
    total: invoiceData.total || invoiceData.subtotal || sumServices(invoiceData.services),
    payerType: payer.type,
    copayAmount: patientProfile?.copayAmount,
    deductibleRemaining: patientProfile?.deductibleRemaining,
    uninsuredService: invoiceData.uninsuredService,
    config: cfg
  });

  const currency =
    invoiceData.currency ||
    (patientProfile?.country === 'Canada' || patientProfile?.country === 'CA' ? 'CAD' : cfg.defaultCurrency);

  return {
    ...invoiceData,
    currency,
    primaryPayer: payer,
    payerSplit: split,
    amountDue: split.patientDue > 0 ? split.patientDue : split.total,
    payerAmountPending: split.payerCovered,
    billingMetadata: {
      phn: normalizePhn(patientProfile?.phn || patientProfile?.healthCardNumber),
      preferredPaymentMethod: patientProfile?.preferredPaymentMethod,
      claimStatus: split.payerCovered > 0 ? 'draft' : 'not_applicable'
    }
  };
}

function sumServices(services) {
  return (services || []).reduce((s, line) => s + (parseFloat(line.amount || line.price || line.total) || 0), 0);
}

function buildPaymentPlan({ invoiceId, patientId, totalDue, installments = 3, startDate }) {
  const per = roundMoney(totalDue / installments);
  const schedule = [];
  const start = startDate ? new Date(startDate) : new Date();
  for (let i = 0; i < installments; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    schedule.push({
      installment: i + 1,
      amount: i === installments - 1 ? roundMoney(totalDue - per * (installments - 1)) : per,
      dueDate: due.toISOString().split('T')[0],
      status: 'pending'
    });
  }
  return {
    invoiceId,
    patientId,
    totalDue,
    installments,
    schedule,
    status: 'active',
    createdAt: new Date().toISOString()
  };
}

function identifyOverdueInvoices(invoices, asOfDate) {
  const today = asOfDate || new Date().toISOString().split('T')[0];
  return (invoices || []).filter(
    (inv) =>
      (inv.status === 'pending' || inv.status === 'partial' || inv.status === 'overdue') &&
      inv.amountDue > 0 &&
      inv.dueDate &&
      inv.dueDate < today
  );
}

function validatePaymentMethod(method, country, config) {
  const cfg = config || loadBillingConfig();
  const meta = PATIENT_PAY_METHODS[method];
  if (!meta) return { valid: false, error: `Unknown payment method: ${method}` };
  if (meta.countries && country && !meta.countries.includes(country)) {
    return { valid: true, warning: `${meta.label} may not be standard in ${country}` };
  }
  if (!cfg.patientPaymentMethods.includes(method)) {
    return { valid: true, warning: 'Method enabled locally but not in org config' };
  }
  return { valid: true, meta };
}

module.exports = {
  PROVINCE_PAYER_MAP,
  PATIENT_PAY_METHODS,
  normalizePhn,
  detectPrimaryPayer,
  calculatePatientResponsibility,
  enrichInvoice,
  buildPaymentPlan,
  identifyOverdueInvoices,
  validatePaymentMethod
};
