'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const claimsWorkflow = require('../../lib/billing/claims-workflow');
const loinc = require('../../lib/interop/terminology/loinc-pclocd');
const ccdd = require('../../lib/interop/terminology/ccdd');
const connectingOntario = require('../../lib/interop/connecting-ontario');

describe('Phases 0-6 polish: claims rejection UX helpers', () => {
  it('parses MOH rejection via claims-workflow', () => {
    const claim = { id: 'c1', status: 'submitted' };
    const result = claimsWorkflow.applyRejection(claim, { code: 'PHN-INVALID', message: 'Invalid health card' });
    assert.equal(result.ok, true);
    assert.equal(result.claim.status, 'rejected');
    assert.match(result.claim.error, /Invalid health card/i);
  });

  it('resets rejected claim to draft for resubmit', () => {
    const claim = { id: 'c1', status: 'rejected', error: 'bad code', rejectionCode: 'X1' };
    const reset = claimsWorkflow.resubmitClaim(claim);
    assert.equal(reset.claim.status, 'draft');
    assert.equal(reset.claim.error, null);
  });
});

describe('Phases 0-6 polish: terminology mappings', () => {
  it('maps extended LOINC tests', () => {
    const alt = loinc.mapTestToLoinc('ALT');
    assert.equal(alt.loinc, '1742-6');
    const psa = loinc.mapTestToLoinc('PSA');
    assert.equal(psa.loinc, '2857-1');
  });

  it('maps extended CCDD drug names', () => {
    const omep = ccdd.mapDrugToCcdd('omeprazole 20mg');
    assert.equal(omep.ccdd, '9000622');
  });
});

describe('Phases 0-6 polish: provincial launch stubs', () => {
  it('ConnectingOntario launch includes patient PHN', () => {
    const r = connectingOntario.buildConnectingOntarioLaunchUrl({
      patient: { phn: '9999999999AA' },
      config: { connectingOntario: { viewerBaseUrl: 'https://co.example/viewer' } }
    });
    assert.equal(r.queued, false);
    assert.match(r.launchUrl, /9999999999AA/);
  });
});
