/**
 * Browser BillingService — loads mode config JSON and exposes claim/payment APIs.
 * Core logic is tested in Node via lib/billing (src/billing re-export).
 */
(function (global) {
  'use strict';

  let serviceInstance = null;
  let configCache = {};

  async function fetchModeConfig(mode) {
    const normalized = mode === 'USA' ? 'USA' : 'Canada';
    if (configCache[normalized]) return configCache[normalized];
    const file = normalized === 'USA' ? '/config/billing-usa.json' : '/config/billing-canada.json';
    const res = await fetch(file);
    if (!res.ok) throw new Error(`Failed to load billing config: ${file}`);
    const json = await res.json();
    json.billingMode = normalized;
    configCache[normalized] = json;
    return json;
  }

  function roundMoney(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function createBrowserService(mode, config) {
    const m = mode === 'USA' ? 'USA' : 'Canada';
    const auditLog = [];

    function audit(action, detail) {
      auditLog.push({ action, detail, mode: m, at: new Date().toISOString() });
    }

    function lookupFeeCode(code, ctx) {
      const key = ctx?.scheduleKey || (m === 'USA' ? 'COMMERCIAL' : (ctx?.province || 'ON'));
      const schedule = config.feeSchedules?.[key];
      if (!schedule?.codes) return null;
      const c = String(code || '').trim().toUpperCase();
      return schedule.codes.find((x) => String(x.code).toUpperCase() === c) || null;
    }

    function mapEncounterToCharges({ encounter, patient, provider }) {
      const province = (patient?.province || patient?.state || 'ON').toUpperCase();
      const feeCode = m === 'USA' ? (encounter?.cpt || '99213') : (encounter?.feeCode || 'A007A');
      const scheduleKey = m === 'USA' ? 'COMMERCIAL' : province;
      const fee = lookupFeeCode(feeCode, { province, scheduleKey });
      const diagnosisCodes = (encounter?.diagnosisCodes || encounter?.diagnoses || [])
        .map((d) => (typeof d === 'string' ? d : d.code))
        .filter(Boolean);
      const amount = fee?.amount || 0;
      const line = fee ? {
        serviceCode: fee.code,
        feeCode: fee.code,
        cpt: /^\d{5}$/.test(fee.code) ? fee.code : undefined,
        description: fee.description,
        amount,
        price: amount,
        units: 1,
        total: amount,
        diagnosisCodes
      } : null;
      return {
        encounterId: encounter?.id,
        encounterDate: encounter?.date || encounter?.visitDate,
        billingMode: m,
        serviceLines: line ? [line] : [],
        total: line?.total || 0,
        diagnosisCodes,
        provider
      };
    }

    return {
      mode: m,
      config,
      getLabels: () => ({ ...config.labels, billingMode: m, currency: config.defaultCurrency }),
      getPaymentMethods: () => config.patientPaymentMethods || [],
      lookupFeeCode,
      mapEncounterToCharges,
      mapEncounterToInvoiceData(args) {
        const charges = mapEncounterToCharges(args);
        const p = args.patient || {};
        return {
          patientId: p.id || p.patient_id,
          patientName: [p.firstName, p.lastName].filter(Boolean).join(' '),
          date: charges.encounterDate || new Date().toISOString().split('T')[0],
          encounterId: charges.encounterId,
          services: charges.serviceLines,
          total: charges.total,
          billingMode: m,
          billingModeAtCapture: m,
          notes: `Encounter billing (${m})`
        };
      },
      generateClaim({ encounter, patient, provider, invoice, services }) {
        const charges = mapEncounterToCharges({ encounter, patient, provider });
        const lines = services?.length ? services : charges.serviceLines;
        audit('generateClaim', { encounterId: charges.encounterId });
        if (m === 'USA') {
          return {
            claimType: 'private',
            billingMode: 'USA',
            billingModeAtCapture: m,
            claimFormat: config.claimFormat,
            status: 'draft',
            insurerId: patient?.insuranceName || 'BCBS',
            serviceLines: lines,
            diagnosisCodes: charges.diagnosisCodes,
            transport: config.submissionChannels?.default?.transport
          };
        }
        const province = (patient?.province || patient?.state || 'ON').toUpperCase();
        return {
          claimType: 'provincial',
          billingMode: 'Canada',
          billingModeAtCapture: m,
          payerCode: config.submissionChannels?.[province]?.payer || 'OHIP',
          claimFormat: config.claimFormat,
          status: 'draft',
          patient: { phn: patient?.phn || patient?.healthCardNumber },
          serviceLines: lines,
          diagnosisCodes: charges.diagnosisCodes,
          transport: config.submissionChannels?.[province]?.transport || 'MCEDT'
        };
      },
      async submitClaim(claim, options) {
        audit('submitClaim', { transport: claim.transport });
        if (!options?.enabled) {
          return { submitted: false, queued: true, reason: 'portal not configured', claim };
        }
        return { submitted: true, queued: false, externalClaimId: `EXT-${Date.now()}`, claim };
      },
      processRemittance(raw, invoices) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const payments = parsed.payments || [];
        const reconciled = payments.map((rp) => {
          const inv = (invoices || []).find((i) => i.invoiceNumber === rp.claimId);
          return { remittancePayment: rp, invoice: inv || null, matched: Boolean(inv) };
        });
        audit('processRemittance', { count: payments.length });
        return { parsed: { ...parsed, parsed: true, totalPaid: payments.reduce((s, p) => s + (p.amount || 0), 0) }, reconciled };
      },
      collectPatientPayment({ invoice, payment }) {
        const amount = parseFloat(payment.amount) || 0;
        audit('collectPatientPayment', { amount, method: payment.method });
        return {
          success: true,
          receipt: {
            receiptId: `RCP-${Date.now()}`,
            invoiceId: invoice?.id,
            amount,
            method: payment.method,
            currency: config.defaultCurrency,
            billingMode: m
          },
          remainingBalance: Math.max(0, (parseFloat(invoice?.amountDue) || 0) - amount)
        };
      },
      validateRegistration(patient) {
        const errors = [];
        if (m === 'Canada' && patient.paymentSource === 'provincial' && !patient.healthCardNumber && !patient.phn) {
          errors.push('PHN required for provincial billing.');
        }
        if (m === 'USA' && patient.paymentSource === 'private_insurance' && !patient.insuranceMemberNumber) {
          errors.push('Member ID required for insurance billing.');
        }
        return { valid: !errors.length, errors };
      },
      getAuditLog: () => [...auditLog]
    };
  }

  async function init(mode) {
    const resolved = mode || (global.MediForgeBillingMode
      ? await global.MediForgeBillingMode.getBillingMode()
      : 'Canada');
    const config = await fetchModeConfig(resolved);
    serviceInstance = createBrowserService(resolved, config);
    return serviceInstance;
  }

  async function reload(mode) {
    const normalized = mode === 'USA' ? 'USA' : 'Canada';
    delete configCache[normalized];
    return init(normalized);
  }

  async function getService() {
    if (!serviceInstance) await init();
    return serviceInstance;
  }

  global.MediForgeBillingService = {
    init,
    reload,
    getService,
    fetchModeConfig
  };
})(typeof window !== 'undefined' ? window : global);
