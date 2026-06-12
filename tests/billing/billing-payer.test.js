'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const billing = require('../../lib/billing');

describe('Payer engine', () => {
  it('detects OHIP for Ontario provincial payer', () => {
    const payer = billing.payerEngine.detectPrimaryPayer({
      province: 'ON',
      paymentSource: 'provincial'
    });
    assert.equal(payer.type, 'provincial');
    assert.equal(payer.payerId, 'OHIP');
  });

  it('calculates zero patient due for full provincial coverage', () => {
    const split = billing.payerEngine.calculatePatientResponsibility({
      total: 150,
      payerType: 'provincial',
      copayAmount: 0
    });
    assert.equal(split.payerCovered, 150);
    assert.equal(split.patientDue, 0);
  });

  it('calculates full patient due for self-pay', () => {
    const split = billing.payerEngine.calculatePatientResponsibility({
      total: 200,
      payerType: 'patient_pay'
    });
    assert.equal(split.patientDue, 200);
    assert.equal(split.payerCovered, 0);
  });

  it('enriches invoice with CAD and payer split', () => {
    const enriched = billing.payerEngine.enrichInvoice(
      { services: [{ amount: 100 }], patientId: 'p1', patientName: 'Test' },
      { province: 'ON', paymentSource: 'provincial', country: 'Canada' }
    );
    assert.equal(enriched.currency, 'CAD');
    assert.ok(enriched.payerSplit);
    assert.equal(enriched.primaryPayer.payerId, 'OHIP');
  });

  it('validates Zelle payment method', () => {
    const v = billing.payerEngine.validatePaymentMethod('zelle', 'CA');
    assert.equal(v.valid, true);
  });

  it('builds payment plan schedule', () => {
    const plan = billing.payerEngine.buildPaymentPlan({
      invoiceId: 'inv1',
      patientId: 'p1',
      totalDue: 300,
      installments: 3
    });
    assert.equal(plan.schedule.length, 3);
    assert.equal(plan.totalDue, 300);
  });
});

describe('Claims adapter', () => {
  it('builds OHIP claim draft', () => {
    const claim = billing.claims.buildProvincialClaimDraft({
      patient: { phn: '1234567890', lastName: 'Doe', firstName: 'Jane', dob: '1985-03-15', gender: 'F' },
      provider: { billingNumber: '123456', organizationId: 'org1' },
      invoice: { id: '1', invoiceNumber: 'INV-2026-00001', date: '2026-06-11', total: 150, payerSplit: { payerCovered: 150 } },
      services: [{ serviceCode: 'A007', amount: 150, description: 'Office visit' }],
      payerCode: 'OHIP'
    });
    assert.equal(claim.claimType, 'provincial');
    assert.equal(claim.payerCode, 'OHIP');
    assert.equal(claim.status, 'draft');
    assert.equal(claim.patient.phn, '1234567890');
  });
});

describe('Remittance adapter', () => {
  it('parses remittance and reconciles', () => {
    const raw = {
      payerId: 'OHIP',
      remittanceDate: '2026-06-15',
      payments: [{ claimId: 'INV-2026-00001', amount: 150, patientResponsibility: 0 }]
    };
    const rem = billing.remittance.parseRemittanceAdvice(raw);
    assert.equal(rem.parsed, true);
    assert.equal(rem.totalPaid, 150);
    const recon = billing.remittance.reconcileRemittanceWithInvoices(rem, [
      { id: '1', invoiceNumber: 'INV-2026-00001', amountDue: 0, payerSplit: { patientDue: 0 } }
    ]);
    assert.equal(recon[0].matched, true);
  });
});

describe('Interop + billing linkage', () => {
  it('sample claim references lab order serial', () => {
    const fs = require('fs');
    const path = require('path');
    const sample = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'samples', 'billing', 'ohip-claim-draft.json'), 'utf8')
    );
    assert.equal(sample.serviceLines.find((l) => l.sourceType === 'lab').sourceId, 'LAB-MEC-001');
  });
});
