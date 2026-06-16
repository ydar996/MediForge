'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BillingService } = require('../../src/billing');

const ontarioPatient = {
  id: 'P1',
  firstName: 'Jane',
  lastName: 'Doe',
  province: 'ON',
  state: 'ON',
  paymentSource: 'provincial',
  phn: '1234567890AB',
  healthCardNumber: '1234567890AB'
};

const usPatient = {
  id: 'P2',
  firstName: 'John',
  lastName: 'Smith',
  state: 'NY',
  paymentSource: 'private_insurance',
  insuranceMemberNumber: 'MBR123',
  insuranceName: 'BCBS'
};

describe('BillingService — Canada mode', () => {
  const svc = new BillingService({ mode: 'Canada' });

  it('loads Canada config with CAD currency', () => {
    assert.equal(svc.mode, 'Canada');
    assert.equal(svc.config.defaultCurrency, 'CAD');
  });

  it('returns Canada UI labels (PHN)', () => {
    const labels = svc.getLabels();
    assert.match(labels.patientId, /PHN|Health Card/i);
    assert.equal(labels.billingMode, 'Canada');
  });

  it('looks up Ontario OHIP fee code A007A', () => {
    const fee = svc.lookupFeeCode('A007A', { province: 'ON' });
    assert.ok(fee);
    assert.equal(fee.code, 'A007A');
    assert.ok(fee.amount > 0);
  });

  it('maps encounter to OHIP service line', () => {
    const charges = svc.mapEncounterToInvoiceData({
      encounter: { visitDate: '2026-06-17', diagnosisCodes: ['J06.9'] },
      patient: ontarioPatient
    });
    assert.ok(charges.services.length);
    assert.equal(charges.services[0].feeCode, 'A007A');
    assert.equal(charges.billingModeAtCapture, 'Canada');
  });

  it('generates provincial claim draft for OHIP', () => {
    const claim = svc.generateClaim({
      encounter: { visitDate: '2026-06-17' },
      patient: ontarioPatient,
      provider: { billingNumber: '123456' }
    });
    assert.equal(claim.claimType, 'provincial');
    assert.equal(claim.payerCode, 'OHIP');
    assert.equal(claim.transport, 'MCEDT');
  });

  it('validates PHN required for provincial registration', () => {
    const bad = svc.validateRegistration({ paymentSource: 'provincial' });
    assert.equal(bad.valid, false);
    const good = svc.validateRegistration(ontarioPatient);
    assert.equal(good.valid, true);
  });

  it('enriches invoice with zero copay for OHIP', () => {
    const enriched = svc.enrichInvoiceForPatient(
      { services: [{ amount: 77.2 }], total: 77.2 },
      ontarioPatient
    );
    assert.equal(enriched.currency, 'CAD');
    assert.equal(enriched.payerSplit.patientDue, 0);
  });

  it('collects Interac e-Transfer payment', () => {
    const result = svc.collectPatientPayment({
      invoice: { id: 'inv1', amountDue: 25, currency: 'CAD' },
      payment: { method: 'etransfer', amount: 25 },
      patient: ontarioPatient
    });
    assert.equal(result.success, true);
    assert.equal(result.receipt.method, 'etransfer');
  });

  it('submits claim as queued when portal not configured', async () => {
    const claim = svc.generateClaim({ encounter: {}, patient: ontarioPatient });
    const res = await svc.submitClaim(claim, { enabled: false });
    assert.equal(res.queued, true);
  });

  it('processes provincial remittance advice', () => {
    const raw = {
      payerId: 'OHIP',
      remittanceDate: '2026-06-20',
      payments: [{ claimId: 'INV-001', amount: 77.2, patientResponsibility: 0 }]
    };
    const { parsed, reconciled } = svc.processRemittance(raw, [
      { id: '1', invoiceNumber: 'INV-001', amountDue: 0 }
    ]);
    assert.equal(parsed.payerId, 'OHIP');
    assert.equal(reconciled[0].matched, true);
  });

  it('builds aging report buckets', () => {
    const report = svc.buildAgingReport([
      { id: '1', amountDue: 50, date: '2026-01-01', status: 'pending' },
      { id: '2', amountDue: 30, date: '2026-06-01', status: 'partial' }
    ], '2026-06-17');
    assert.ok(report.totalOutstanding > 0);
    assert.ok(report.buckets.over90.count >= 1);
  });
});

describe('BillingService — mode integrity', () => {
  it('preserves billingModeAtCapture on legacy Canada invoice when org switches to USA', () => {
    const usaSvc = new BillingService({ mode: 'USA' });
    const claim = usaSvc.generateClaim({
      encounter: { billingModeAtCapture: 'Canada', visitDate: '2026-05-01' },
      patient: { ...ontarioPatient, billingModeAtCapture: 'Canada' }
    });
    assert.equal(claim.billingModeAtCapture, 'Canada');
  });
});
