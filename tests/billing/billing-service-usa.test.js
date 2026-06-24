'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BillingService } = require('../../src/billing');

const usPatient = {
  id: 'U1',
  firstName: 'John',
  lastName: 'Smith',
  state: 'NY',
  paymentSource: 'private_insurance',
  insuranceMemberNumber: 'MBR-998877',
  insuranceName: 'BCBS',
  insurancePayer: 'BCBS'
};

describe('BillingService: USA mode', () => {
  const svc = new BillingService({ mode: 'USA' });

  it('loads USA config with USD currency', () => {
    assert.equal(svc.mode, 'USA');
    assert.equal(svc.config.defaultCurrency, 'USD');
    assert.equal(svc.config.claimFormat, 'X12-837P');
  });

  it('returns US UI labels (Member ID)', () => {
    const labels = svc.getLabels();
    assert.match(labels.patientId, /Member/i);
    assert.equal(labels.diagnosisCode, 'Diagnosis (ICD-10-CM)');
  });

  it('looks up CPT 99213 from commercial schedule', () => {
    const fee = svc.lookupFeeCode('99213', { scheduleKey: 'COMMERCIAL' });
    assert.ok(fee);
    assert.equal(fee.code, '99213');
  });

  it('maps encounter to CPT service line', () => {
    const data = svc.mapEncounterToInvoiceData({
      encounter: { visitDate: '2026-06-17', cpt: '99214', diagnosisCodes: ['E11.9'] },
      patient: usPatient
    });
    assert.equal(data.services[0].cpt, '99214');
    assert.equal(data.billingMode, 'USA');
  });

  it('generates HIPAA 837P-style private claim', () => {
    const claim = svc.generateClaim({
      encounter: { visitDate: '2026-06-17', cpt: '99213' },
      patient: usPatient,
      provider: { npi: '1234567890' }
    });
    assert.equal(claim.claimType, 'private');
    assert.equal(claim.claimFormat, 'X12-837P');
    assert.equal(claim.transport, 'X12_837P');
  });

  it('validates member ID for insured patients', () => {
    const bad = svc.validateRegistration({ paymentSource: 'private_insurance' });
    assert.equal(bad.valid, false);
    assert.ok(bad.errors[0].match(/member|Member|insurance/i));
  });

  it('enriches invoice with 80/20 private split default', () => {
    const enriched = svc.enrichInvoiceForPatient(
      { services: [{ amount: 100 }], total: 100 },
      usPatient
    );
    assert.equal(enriched.currency, 'USD');
    assert.equal(enriched.payerSplit.payerCovered, 80);
    assert.equal(enriched.payerSplit.patientDue, 20);
  });

  it('collects Zelle payment (US emphasis)', () => {
    const result = svc.collectPatientPayment({
      invoice: { id: 'inv-us-1', amountDue: 20, currency: 'USD' },
      payment: { method: 'zelle', amount: 20 },
      patient: usPatient
    });
    assert.equal(result.success, true);
    assert.equal(result.receipt.complianceFramework, 'HIPAA');
  });

  it('submits claim through clearinghouse when enabled', async () => {
    const claim = svc.generateClaim({ encounter: {}, patient: usPatient });
    const res = await svc.submitClaim(claim, { enabled: true, portalUrl: 'https://clearinghouse.example' });
    assert.equal(res.submitted, true);
    assert.ok(res.externalClaimId);
  });

  it('processes ERA remittance', () => {
    const raw = {
      format: '835',
      payerId: 'BCBS',
      payments: [{ claimId: 'INV-US-01', amount: 80, patientResponsibility: 20 }]
    };
    const { parsed } = svc.processRemittance(raw, []);
    assert.equal(parsed.format, '835');
    assert.equal(parsed.totalPaid, 80);
  });

  it('builds reconciliation summary', () => {
    const summary = svc.buildReconciliationSummary({
      invoices: [{ total: 200, amountDue: 20 }],
      payments: [{ amount: 180 }],
      remittances: [{ totalPaid: 160 }]
    });
    assert.equal(summary.totalBilled, 200);
    assert.equal(summary.totalPatientPayments, 180);
  });

  it('lists US payment methods including Zelle', () => {
    const methods = svc.getPaymentMethods();
    assert.ok(methods.includes('zelle'));
    assert.ok(methods.includes('card'));
  });
});

describe('BillingService: fromOrganizationSettings', () => {
  it('resolves USA from settings.system.billingMode', () => {
    const svc = BillingService.fromOrganizationSettings({ system: { billingMode: 'USA' } });
    assert.equal(svc.mode, 'USA');
  });

  it('defaults to Canada when unset', () => {
    const svc = BillingService.fromOrganizationSettings({});
    assert.equal(svc.mode, 'Canada');
  });
});
