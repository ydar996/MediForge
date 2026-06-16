'use strict';

const { loadModeConfig, normalizeMode, resolveBillingModeFromSettings } = require('./mode-config');
const payerEngine = require('./payer-engine');
const claims = require('./claims-adapter');
const remittance = require('./remittance-adapter');
const feeSchedule = require('./fee-schedule');
const encounterCharges = require('./encounter-charges');
const reconciliation = require('./reconciliation');

/**
 * Mode-aware billing orchestrator for Canada (provincial) and USA (insurance) workflows.
 * Existing invoices retain billingModeAtCapture on the claim/invoice metadata.
 */
class BillingService {
  /**
   * @param {object} options
   * @param {'Canada'|'USA'} options.mode
   * @param {object} [options.config] - pre-loaded mode config
   * @param {string} [options.configDir]
   */
  constructor(options = {}) {
    this.mode = normalizeMode(options.mode || 'Canada');
    this.configDir = options.configDir;
    this.config = options.config || loadModeConfig(this.mode, this.configDir);
    this.auditLog = [];
  }

  static fromOrganizationSettings(settings, configDir) {
    const mode = resolveBillingModeFromSettings(settings);
    return new BillingService({ mode, configDir });
  }

  getLabels() {
    return { ...(this.config.labels || {}), billingMode: this.mode, currency: this.config.defaultCurrency };
  }

  getPaymentMethods() {
    return this.config.patientPaymentMethods || [];
  }

  lookupFeeCode(code, context = {}) {
    return feeSchedule.lookupFeeCode({
      code,
      province: context.province,
      scheduleKey: context.scheduleKey,
      config: this.config
    });
  }

  /**
   * Build claim draft from encounter + patient context.
   */
  generateClaim({ encounter, patient, provider, invoice, services }) {
    const chargeBundle = encounterCharges.mapEncounterToCharges({
      encounter,
      patient,
      config: this.config,
      provider
    });

    const serviceLines = services?.length ? services : chargeBundle.serviceLines;
    const captureMode =
      encounter?.billingModeAtCapture ||
      patient?.billingModeAtCapture ||
      invoice?.billingModeAtCapture ||
      this.mode;

    this._audit('generateClaim', { mode: captureMode, encounterId: chargeBundle.encounterId });

    if (captureMode === 'USA') {
      const payerId = patient.insurancePayer || patient.payerId || patient.insuranceName || 'BCBS';
      return {
        ...claims.buildPrivateClaimDraft({
          patient,
          invoice: invoice || { id: 'draft', invoiceNumber: 'DRAFT', total: chargeBundle.total },
          services: serviceLines,
          insurerId: payerId,
          config: this._mergedPayerConfig()
        }),
        billingMode: 'USA',
        billingModeAtCapture: captureMode,
        claimFormat: this.config.claimFormat,
        diagnosisCodeSystem: this.config.diagnosisCodeSystem,
        diagnosisCodes: chargeBundle.diagnosisCodes,
        transport: this.config.submissionChannels?.default?.transport || 'X12_837P'
      };
    }

    const province = (patient.province || patient.state || 'ON').toUpperCase();
    const payerCode =
      payerEngine.PROVINCE_PAYER_MAP[province] ||
      this.config.provincialPayers?.OHIP?.name && 'OHIP';

    return {
      ...claims.buildProvincialClaimDraft({
        patient,
        provider: provider || {},
        invoice: invoice || { id: 'draft', invoiceNumber: 'DRAFT', total: chargeBundle.total },
        services: serviceLines,
        payerCode,
        config: this._mergedPayerConfig()
      }),
      billingMode: 'Canada',
      billingModeAtCapture: captureMode,
      claimFormat: this.config.claimFormat,
      diagnosisCodeSystem: this.config.diagnosisCodeSystem,
      diagnosisCodes: chargeBundle.diagnosisCodes,
      transport: this.config.submissionChannels?.[province]?.transport || 'manual'
    };
  }

  /**
   * Submit claim via configured channel (MCEDT, Teleplan, clearinghouse).
   */
  async submitClaim(claim, options = {}) {
    const transport =
      claim.transport ||
      options.transport ||
      (this.mode === 'USA' ? 'X12_837P' : 'manual');
    const portalUrl = options.portalUrl || '';
    const enabled = options.enabled !== false;

    this._audit('submitClaim', { transport, claimType: claim.claimType, mode: claim.billingMode || this.mode });

    const result = await claims.submitClaimToPortal({
      draft: claim,
      portalUrl,
      transport,
      enabled
    });

    return {
      ...result,
      billingMode: claim.billingMode || this.mode,
      complianceNote: this.config.complianceFramework
    };
  }

  processRemittance(raw, invoices = []) {
    const parsed = remittance.parseRemittanceAdvice(raw);
    const reconciled = remittance.reconcileRemittanceWithInvoices(parsed, invoices);
    this._audit('processRemittance', { payerId: parsed.payerId, totalPaid: parsed.totalPaid });
    return { parsed, reconciled };
  }

  /**
   * Patient payment collection with mode-specific validation and receipt metadata.
   */
  collectPatientPayment({ invoice, payment, patient }) {
    const country = this.mode === 'USA' ? 'US' : 'CA';
    const method = payment.method || payment.paymentMethod;
    const validation = payerEngine.validatePaymentMethod(method, country, this._mergedPayerConfig());

    if (!validation.valid) {
      return { success: false, error: validation.error, validation };
    }

    const amount = parseFloat(payment.amount) || 0;
    const receipt = {
      receiptId: `RCP-${Date.now()}`,
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      patientId: patient?.id || invoice?.patientId,
      amount,
      method,
      currency: invoice?.currency || this.config.defaultCurrency,
      billingMode: invoice?.billingModeAtCapture || invoice?.billingMetadata?.billingMode || this.mode,
      collectedAt: new Date().toISOString(),
      complianceFramework: this.config.complianceFramework
    };

    this._audit('collectPatientPayment', { method, amount, invoiceId: invoice?.id });

    return {
      success: true,
      receipt,
      validation,
      remainingBalance: Math.max(0, (parseFloat(invoice?.amountDue) || 0) - amount)
    };
  }

  enrichInvoiceForPatient(invoiceData, patientProfile) {
    const enriched = payerEngine.enrichInvoice(invoiceData, patientProfile, this._mergedPayerConfig());
    return {
      ...enriched,
      billingMode: this.mode,
      billingModeAtCapture: patientProfile?.billingModeAtCapture || this.mode,
      billingMetadata: {
        ...(enriched.billingMetadata || {}),
        billingMode: this.mode,
        diagnosisCodeSystem: this.config.diagnosisCodeSystem
      }
    };
  }

  mapEncounterToInvoiceData({ encounter, patient, provider }) {
    const charges = encounterCharges.mapEncounterToCharges({
      encounter,
      patient,
      config: this.config,
      provider
    });
    return {
      patientId: patient.id || patient.patient_id,
      patientName: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
      date: charges.encounterDate || new Date().toISOString().split('T')[0],
      encounterId: charges.encounterId,
      services: charges.serviceLines,
      total: charges.total,
      billingMode: this.mode,
      billingModeAtCapture: this.mode,
      notes: `Encounter billing (${this.mode})`
    };
  }

  validateRegistration(patient) {
    const errors = [];
    const v = this.config.validation || {};
    if (this.mode === 'Canada') {
      if (v.phnRequiredForProvincial && patient.paymentSource === 'provincial') {
        const phn = payerEngine.normalizePhn(patient.phn || patient.healthCardNumber);
        if (!phn) errors.push('PHN (health card number) is required for provincial billing.');
        if (v.phnPattern && phn && !new RegExp(v.phnPattern).test(phn)) {
          errors.push('PHN format is invalid for provincial billing.');
        }
      }
    } else {
      if (v.memberIdRequiredForInsured && patient.paymentSource === 'private_insurance') {
        if (!patient.insuranceMemberNumber && !patient.insurance_member_number) {
          errors.push('Insurance member ID is required for US insured billing.');
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  buildAgingReport(invoices, asOfDate) {
    return reconciliation.buildAgingReport(invoices, asOfDate);
  }

  buildReconciliationSummary(payload) {
    return reconciliation.buildReconciliationSummary(payload);
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  _mergedPayerConfig() {
    return {
      defaultCurrency: this.config.defaultCurrency,
      defaultCountry: this.config.defaultCountry,
      patientPaymentMethods: this.config.patientPaymentMethods,
      provincialPayers: this.config.provincialPayers || {},
      privateInsurers: this.config.payers || this.config.privateInsurers || {},
      copayRules: this.config.copayRules || { defaultCopay: 0 }
    };
  }

  _audit(action, detail) {
    this.auditLog.push({
      action,
      detail,
      mode: this.mode,
      at: new Date().toISOString()
    });
  }
}

module.exports = { BillingService };
