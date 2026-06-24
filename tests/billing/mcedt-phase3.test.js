'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mcedtFormat = require('../../lib/billing/mcedt-format');
const mcedtCutoff = require('../../lib/billing/mcedt-cutoff');
const { McedtClient } = require('../../lib/billing/mcedt-client');
const claimsWorkflow = require('../../lib/billing/claims-workflow');
const sampleBatch = require('../samples/billing/ohip-mcedt-claim-batch.json');

describe('Phase 3: MCEDT format', () => {
  it('validates sample OHIP batch', () => {
    const batch = mcedtFormat.buildMcedtBatch({
      claims: sampleBatch.claims,
      submitter: sampleBatch.submitter
    });
    const v = mcedtFormat.validateClaimBatch(batch);
    assert.equal(v.valid, true);
  });

  it('serializes batch to XML', () => {
    const batch = mcedtFormat.buildMcedtBatch({
      claims: sampleBatch.claims,
      submitter: sampleBatch.submitter
    });
    const xml = mcedtFormat.serializeBatchToXml(batch);
    assert.match(xml, /McedtClaimBatch/);
    assert.match(xml, /A007A/);
  });

  it('validates XML structure for exported batch', () => {
    const batch = mcedtFormat.buildMcedtBatch({
      claims: sampleBatch.claims,
      submitter: sampleBatch.submitter
    });
    const xml = mcedtFormat.serializeBatchToXml(batch);
    const xmlValidation = mcedtFormat.validateBatchXmlStructure(xml);
    assert.equal(xmlValidation.valid, true);
    assert.ok(xmlValidation.claimCount >= 1);
  });

  it('parses MOH rejection JSON', () => {
    const r = mcedtFormat.parseMohRejection({ rejectionCode: 'E001', message: 'Invalid fee code', claimReference: 'INV-1' });
    assert.equal(r.rejectionCode, 'E001');
    assert.equal(r.claimReference, 'INV-1');
  });
});

describe('Phase 3: MCEDT cut-off', () => {
  it('computes billing period for service date', () => {
    const p = mcedtCutoff.getBillingPeriod('2026-06-15');
    assert.equal(p.periodKey, '2026-06');
  });

  it('flags service date past cut-off', () => {
    const check = mcedtCutoff.isWithinCutoff('2025-01-15', '2026-06-01');
    assert.equal(check.within, false);
  });
});

describe('Phase 3: MCEDT client', () => {
  it('queues batch when not configured', async () => {
    const client = new McedtClient({ enabled: false });
    const batch = mcedtFormat.buildMcedtBatch({ claims: sampleBatch.claims, submitter: sampleBatch.submitter });
    const result = await client.submitBatch(batch);
    assert.equal(result.queued, true);
  });

  it('checks PHN format without live API', async () => {
    const client = new McedtClient({ enabled: false });
    const result = await client.checkEligibility({ phn: '1234567890AB' });
    assert.equal(result.formatValid, true);
    assert.equal(result.queued, true);
  });
});

describe('Phase 3: claims workflow', () => {
  it('applies rejection and allows resubmit', () => {
    const claim = { id: '1', status: 'submitted' };
    const applied = claimsWorkflow.applyRejection(claim, { message: 'Rejected', rejectionCode: 'E99' });
    assert.equal(applied.ok, true);
    assert.equal(applied.claim.status, 'rejected');
    const reset = claimsWorkflow.resubmitClaim(applied.claim);
    assert.equal(reset.claim.status, 'draft');
  });
});
