// Purpose: General Ledger - income/expense, journal entries, cost centers
// Version: 1.0 - Minimal GL for MediForge FMS

function getBillingKey(key) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  return `${org}_billing_${key}`;
}

function getCurrentUsername() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.username || user.name || "Unknown";
}

// Default cost centers
const DEFAULT_COST_CENTERS = [
  { code: 'OPD', name: 'Outpatient', description: 'Outpatient department' },
  { code: 'LAB', name: 'Laboratory', description: 'Lab services' },
  { code: 'PHARM', name: 'Pharmacy', description: 'Pharmacy' },
  { code: 'ADMIN', name: 'Administration', description: 'Admin/overhead' }
];

// Default GL accounts (income, expense)
const DEFAULT_ACCOUNTS = [
  { code: '4000', name: 'Consultation Revenue', account_type: 'income', cost_center: 'OPD' },
  { code: '4010', name: 'Lab Revenue', account_type: 'income', cost_center: 'LAB' },
  { code: '4020', name: 'Pharmacy Revenue', account_type: 'income', cost_center: 'PHARM' },
  { code: '4030', name: 'Other Service Revenue', account_type: 'income', cost_center: 'OPD' },
  { code: '5000', name: 'Operating Expenses', account_type: 'expense', cost_center: 'ADMIN' }
];

// Ensure default cost centers and accounts exist (localStorage for now - Supabase when org has GL)
window.ensureDefaultGLSetup = async function() {
  const keyCC = getBillingKey('gl_cost_centers');
  const keyAcc = getBillingKey('gl_accounts');
  let cc = JSON.parse(localStorage.getItem(keyCC) || '[]');
  let acc = JSON.parse(localStorage.getItem(keyAcc) || '[]');
  if (cc.length === 0) {
    cc = DEFAULT_COST_CENTERS.map((c, i) => ({ id: `cc-${i}`, ...c, is_active: true }));
    localStorage.setItem(keyCC, JSON.stringify(cc));
  }
  if (acc.length === 0) {
    acc = DEFAULT_ACCOUNTS.map((a, i) => ({ id: `acc-${i}`, ...a, is_active: true }));
    localStorage.setItem(keyAcc, JSON.stringify(acc));
  }
  return { costCenters: cc, accounts: acc };
};

// Get cost centers
window.getGLCostCenters = async function() {
  await window.ensureDefaultGLSetup();
  const key = getBillingKey('gl_cost_centers');
  return JSON.parse(localStorage.getItem(key) || '[]');
};

// Get GL accounts
window.getGLAccounts = async function() {
  await window.ensureDefaultGLSetup();
  const key = getBillingKey('gl_accounts');
  return JSON.parse(localStorage.getItem(key) || '[]');
};

// Get income account for service category
function getIncomeAccountForCategory(category) {
  const map = {
    'Consultation': '4000',
    'Laboratory': '4010',
    'Pharmacy': '4020',
    'Prescription': '4020',
    'Lab': '4010'
  };
  return map[category] || '4030';
}

// Post payment to GL (journal entry)
window.postPaymentToGL = async function(payment, invoice) {
  const key = getBillingKey('gl_journal_entries');
  let entries = JSON.parse(localStorage.getItem(key) || '[]');
  const accounts = await window.getGLAccounts();
  const amount = parseFloat(payment.amount || 0);
  if (amount <= 0) return null;

  const category = (invoice && invoice.services && invoice.services[0]) ? (invoice.services[0].category || 'Other') : 'Other';
  const accountCode = getIncomeAccountForCategory(category);
  const incomeAcc = accounts.find(a => a.code === accountCode) || accounts.find(a => a.account_type === 'income');

  const entry = {
    id: `je-${Date.now()}`,
    entry_date: payment.date || new Date().toISOString().split('T')[0],
    reference_type: 'payment',
    reference_id: payment.id || payment.payment_id,
    description: `Payment ${payment.reference || payment.id} - ${payment.patientName || ''}`,
    created_by: getCurrentUsername(),
    created_at: new Date().toISOString(),
    lines: [
      { account_id: incomeAcc?.id || 'acc-0', account_code: accountCode, debit: amount, credit: 0, description: 'Revenue' },
      { account_id: 'cash-ar', account_code: '1100', debit: 0, credit: amount, description: 'Cash received' }
    ]
  };
  entries.push(entry);
  localStorage.setItem(key, JSON.stringify(entries));
  return entry;
};

// Get journal entries (for report)
window.getGLJournalEntries = async function(startDate, endDate) {
  const key = getBillingKey('gl_journal_entries');
  let entries = JSON.parse(localStorage.getItem(key) || '[]');
  if (startDate || endDate) {
    entries = entries.filter(e => {
      const d = e.entry_date || e.created_at?.split('T')[0];
      if (!d) return true;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }
  return entries.sort((a, b) => (b.entry_date || '').localeCompare(a.entry_date || ''));
};

// Get income summary by account - ALWAYS computed from payments (same source as billing dashboard)
// This guarantees GL totals match billing dashboard; journal entries are for audit only
window.getGLIncomeSummary = async function(startDate, endDate, forceBackfill) {
  if (typeof window.getAllPayments !== 'function') return [];
  const payments = await window.getAllPayments();
  const completed = Array.isArray(payments) ? payments.filter(p => {
    const s = (p.status || '').toLowerCase();
    if (s === 'voided') return false;
    return s === 'completed' && parseFloat(p.amount || 0) > 0;
  }) : [];
  let filtered = completed;
  if (startDate || endDate) {
    filtered = completed.filter(p => {
      const d = (p.date || p.paymentDate || '').toString().split('T')[0];
      if (!d) return true;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }
  const summary = {};
  const accounts = await window.getGLAccounts();
  const nameByCode = (accounts || []).reduce((m, a) => { m[a.code] = a.name; return m; }, {});
  for (const p of filtered) {
    let category = 'Other';
    if ((p.invoiceId || p.invoice_id) && typeof window.getInvoiceById === 'function') {
      try {
        const inv = await window.getInvoiceById(p.invoiceId || p.invoice_id);
        if (inv && inv.services && inv.services[0]) category = inv.services[0].category || 'Other';
      } catch (_) {}
    }
    const code = getIncomeAccountForCategory(category);
    if (!summary[code]) summary[code] = { code, name: nameByCode[code] || code, total: 0, count: 0 };
    summary[code].total += parseFloat(p.amount || 0);
    summary[code].count++;
  }
  if (forceBackfill && typeof window.postPaymentToGL === 'function') {
    const key = getBillingKey('gl_journal_entries');
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    const posted = new Set(raw.map(e => e.reference_id));
    for (const p of completed) {
      const pid = p.id || p.payment_id;
      if (!pid || posted.has(pid)) continue;
      const inv = (p.invoiceId || p.invoice_id) && typeof window.getInvoiceById === 'function' ? await window.getInvoiceById(p.invoiceId || p.invoice_id) : null;
      await window.postPaymentToGL(p, inv);
      posted.add(pid);
    }
  }
  return Object.values(summary);
};
