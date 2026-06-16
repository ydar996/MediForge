'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Minimal browser globals for payer-workflow
global.window = global;
require('../../js/payer-workflow.js');

const wf = global.MediForgePayerWorkflow;

describe('payer-workflow', () => {
  it('treats provincial invoice with zero copay as payer-cleared', () => {
    const invoice = {
      status: 'claim_pending',
      amountDue: 0,
      total: 100,
      primaryPayer: { type: 'provincial', payerId: 'OHIP' },
      payerSplit: { patientDue: 0, payerCovered: 100 }
    };
    assert.equal(wf.isPayerClearedForService(invoice), true);
    assert.equal(wf.requiresUpfrontPatientPayment(invoice), false);
  });

  it('requires upfront payment for self-pay', () => {
    const invoice = {
      amountDue: 75,
      total: 75,
      primaryPayer: { type: 'patient_pay', payerId: 'PATIENT' }
    };
    assert.equal(wf.requiresUpfrontPatientPayment(invoice), true);
    assert.equal(wf.isPayerClearedForService(invoice), false);
  });

  it('normalizes legacy Self Pay payment source', () => {
    assert.equal(wf.normalizePaymentSource('Self Pay'), 'self_pay');
    assert.equal(wf.normalizePaymentSource('provincial'), 'provincial');
  });
});
