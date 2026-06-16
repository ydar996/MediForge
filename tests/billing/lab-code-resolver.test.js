'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const labCodes = require('../../lib/billing/lab-code-resolver');

const configDir = path.join(__dirname, '..', '..', 'config');

describe('lab-code-resolver', () => {
  labCodes.clearLabCodeMapCache();

  it('extracts CPT from LAB - ##### catalog key', () => {
    assert.equal(labCodes.extractCptFromLabCode('LAB - 85025'), '85025');
    assert.equal(labCodes.extractCptFromLabCode('LAB - 84146/84403/83001'), '84146/84403/83001');
  });

  it('returns CPT display in USA mode', () => {
    const r = labCodes.resolveLabCode({
      code: 'LAB - 85025',
      billingMode: 'USA'
    });
    assert.equal(r.billingMode, 'USA');
    assert.equal(r.displayCode, '85025');
    assert.equal(r.claimFeeCode, '85025');
  });

  it('maps single CPT to OHIP in Canada mode', () => {
    const map = labCodes.loadLabCodeMap(configDir);
    const r = labCodes.resolveLabCode({
      code: 'LAB - 82947',
      cpt: '82947',
      billingMode: 'Canada',
      map
    });
    assert.equal(r.billingMode, 'Canada');
    assert.equal(r.ohipFeeCode, '1558-6');
    assert.equal(r.claimFeeCode, '1558-6');
    assert.equal(r.cptReference, '82947');
  });

  it('maps panel CPT string to panel OHIP code', () => {
    const map = labCodes.loadLabCodeMap(configDir);
    const r = labCodes.resolveLabCode({
      code: 'LAB - 84146/84403/83001/83002/82670/84144',
      cpt: '84146/84403/83001/83002/82670/84144',
      billingMode: 'Canada',
      map
    });
    assert.equal(r.ohipFeeCode, 'G365');
    assert.equal(r.claimFeeCode, 'G365');
  });

  it('maps BC patient to MSP fee code', () => {
    const map = labCodes.loadLabCodeMap(configDir);
    const r = labCodes.resolveLabCode({
      code: 'LAB - 85025',
      cpt: '85025',
      billingMode: 'Canada',
      province: 'BC',
      map
    });
    assert.equal(r.provincialFeeCode, '90138');
    assert.equal(r.codeSystem, 'MSP');
  });

  it('enriches claim service lines for Canada', () => {
    const map = labCodes.loadLabCodeMap(configDir);
    const line = labCodes.enrichClaimServiceLine(
      { code: 'LAB - 85025', name: 'CBC', cpt: '85025', price: 50 },
      'Canada',
      map
    );
    assert.equal(line.feeCode, 'G200');
    assert.equal(line.serviceCode, 'G200');
    assert.equal(line.billingCodeSystem, 'OHIP');
    assert.equal(line.cptReference, '85025');
  });

  it('enriches catalog service with cpt and ohip fields', () => {
    const map = labCodes.loadLabCodeMap(configDir);
    const svc = labCodes.enrichCatalogService(
      { code: 'LAB - 85025', name: 'CBC', category: 'Laboratory' },
      'Canada',
      map
    );
    assert.equal(svc.cpt, '85025');
    assert.equal(svc.ohipFeeCode, 'G200');
  });
});
