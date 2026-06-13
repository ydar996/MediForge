/**
 * Browser payer engine — loads config/billing-payers.json and enriches invoices
 */
(function (global) {
  const PROVINCE_PAYER_MAP = {
    ON: 'OHIP', QC: 'RAMQ', BC: 'MSP', AB: 'AHCIP',
    SK: 'SHS', MB: 'MHSC', NB: 'MCE', NS: 'MSI', PE: 'PEI_HPEI', NL: 'MCP'
  };

  let billingConfig = null;

  async function loadConfig() {
    if (billingConfig) return billingConfig;
    try {
      const res = await fetch('/config/billing-payers.json');
      billingConfig = res.ok ? await res.json() : { defaultCurrency: 'CAD', copayRules: {} };
    } catch {
      billingConfig = { defaultCurrency: 'CAD', copayRules: {} };
    }
    return billingConfig;
  }

  function roundMoney(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function detectPrimaryPayer(patient, cfg) {
    const prov = (patient.province || patient.state || cfg.defaultProvince || 'ON').toUpperCase();
    const src = patient.paymentSource || patient.payment_source || 'provincial';

    if (src === 'Insurance' || src === 'private_insurance') {
      return { type: 'private', payerId: patient.privateInsurerId || patient.insuranceName || 'PRIVATE' };
    }
    if (src === 'wcb' || String(src).toLowerCase().includes('workers')) {
      return { type: 'wcb', payerId: 'WCB', payerName: 'Workers compensation', claimNumber: patient.wcbClaimNumber };
    }
    if (src === 'Cash' || src === 'cash' || src === 'self_pay') {
      return { type: 'patient_pay', payerId: 'PATIENT' };
    }
    const code = PROVINCE_PAYER_MAP[prov];
    return { type: 'provincial', payerId: code || `PROV_${prov}`, province: prov };
  }

  function calculateSplit(total, payerType, patient, cfg) {
    const amount = parseFloat(total) || 0;
    const copay = parseFloat(patient.copayAmount ?? patient.copay_amount ?? cfg.copayRules?.defaultCopay) || 0;

    if (payerType === 'patient_pay') {
      return { total: amount, payerCovered: 0, patientDue: amount, copay: 0 };
    }
    if (payerType === 'provincial') {
      const patientDue = Math.min(amount, copay);
      return { total: amount, payerCovered: roundMoney(amount - patientDue), patientDue: roundMoney(patientDue), copay };
    }
    if (payerType === 'private') {
      const pct = cfg.copayRules?.privateDefaultCoveragePercent ?? 80;
      const payerCovered = roundMoney(amount * (pct / 100));
      return { total: amount, payerCovered, patientDue: roundMoney(amount - payerCovered), copay: 0 };
    }
    return { total: amount, payerCovered: 0, patientDue: amount, copay: 0 };
  }

  async function enrichInvoice(invoiceData, patient) {
    const cfg = await loadConfig();
    const payer = detectPrimaryPayer(patient || {}, cfg);
    const subtotal = (invoiceData.services || []).reduce(
      (s, line) => s + (parseFloat(line.amount || line.price || line.total) || 0), 0
    );
    const total = invoiceData.total || subtotal;
    const split = calculateSplit(total, payer.type, patient || {}, cfg);
    const currency = invoiceData.currency || (patient?.country === 'Canada' ? 'CAD' : cfg.defaultCurrency);

    return {
      ...invoiceData,
      currency,
      primaryPayer: payer,
      payerSplit: split,
      amountDue: split.patientDue > 0 ? split.patientDue : total,
      payerAmountPending: split.payerCovered,
      notes: appendNote(invoiceData.notes, payer, split)
    };
  }

  function appendNote(existing, payer, split) {
    const parts = [existing].filter(Boolean);
    parts.push(`Payer: ${payer.payerId} | Patient due: ${split.patientDue} ${split.payerCovered ? '| Insurer: ' + split.payerCovered : ''}`);
    return parts.join(' | ');
  }

  async function savePayerProfile(patientId, profile) {
    const supabase = global.supabaseClient;
    if (!supabase || !patientId) return null;
    let orgId = null;
    if (typeof global.resolveOrganizationId === 'function') orgId = await global.resolveOrganizationId();
    if (!orgId) return null;

    const metadata = {};
    if (profile.wcbClaimNumber) metadata.wcbClaimNumber = profile.wcbClaimNumber;

    const row = {
      patient_id: patientId,
      organization_id: orgId,
      province: profile.province,
      phn: profile.phn,
      health_card_version: profile.healthCardVersion,
      payment_source: profile.paymentSource || 'provincial',
      primary_payer_code: profile.primaryPayerCode,
      private_insurer_id: profile.privateInsurerId,
      insurance_member_number: profile.insuranceMemberNumber,
      insurance_policy_number: profile.insurancePolicyNumber,
      insurance_group_number: profile.insurancePolicyNumber,
      preferred_payment_method: profile.preferredPaymentMethod || 'cash',
      copay_amount: profile.copayAmount || 0,
      updated_at: new Date().toISOString()
    };
    if (Object.keys(metadata).length) row.metadata = metadata;

    const { data, error } = await supabase.from('patient_payer_profiles').upsert(row, {
      onConflict: 'patient_id,organization_id'
    }).select().single();

    if (error) console.warn('[payer] profile save:', error.message);
    return data;
  }

  async function queueClaimDraft(invoice, patient, services) {
    const cfg = await loadConfig();
    if (!cfg.workflow?.autoCreateClaimOnInvoice) return null;
    const supabase = global.supabaseClient;
    if (!supabase || !invoice.primaryPayer) return null;
    if (invoice.primaryPayer.type === 'patient_pay') return null;

    let orgId = await global.resolveOrganizationId?.();
    if (!orgId) return null;

    const claimType = invoice.primaryPayer.type === 'private' ? 'private' : 'provincial';
    const payload = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      patientPhn: patient?.phn || patient?.healthCardNumber,
      services: services || invoice.services,
      payerSplit: invoice.payerSplit
    };

    const { data, error } = await supabase.from('insurance_claims').insert({
      organization_id: orgId,
      patient_id: patient?.id || invoice.patientId,
      invoice_id: String(invoice.id),
      claim_type: claimType,
      payer_code: invoice.primaryPayer.payerId,
      status: 'draft',
      claim_payload: payload
    }).select().single();

    if (error) console.warn('[payer] claim draft:', error.message);
    return data;
  }

  global.MediForgePayerEngine = {
    loadConfig,
    enrichInvoice,
    savePayerProfile,
    queueClaimDraft,
    detectPrimaryPayer,
    PROVINCE_PAYER_MAP
  };
})(typeof window !== 'undefined' ? window : global);
