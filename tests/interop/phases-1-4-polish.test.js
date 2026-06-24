'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mcedtFormat = require('../../lib/billing/mcedt-format');
const sampleBatch = require('../samples/billing/ohip-mcedt-claim-batch.json');

describe('Phases 1-4 polish: MCEDT PHN validation', () => {
  it('rejects malformed PHN in batch', () => {
    const batch = mcedtFormat.buildMcedtBatch({
      claims: [{ ...sampleBatch.claims[0], patient: { ...sampleBatch.claims[0].patient, phn: '12345' } }],
      submitter: sampleBatch.submitter
    });
    const v = mcedtFormat.validateClaimBatch(batch);
    assert.equal(v.valid, false);
    assert.ok(v.errors.some((e) => e.includes('PHN')));
  });
});

describe('Phases 1-4 polish: billing cut-off hints', () => {
  it('module exports cut-off helpers in browser file', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/billing-cutoff-hints.js'), 'utf8');
    assert.match(src, /getCutoffDate/);
    assert.match(src, /renderBillingCutoffBanner/);
  });
});

describe('Phases 1-4 polish: interop client call()', () => {
  it('interop-client exports generic call wrapper', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/interop-client.js'), 'utf8');
    assert.match(src, /async function call\(action/);
    assert.match(src, /generateLabFhir/);
  });
});
