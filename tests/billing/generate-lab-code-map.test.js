'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  buildLabCodeMapCanada,
  extractLabServicesFromPricing,
  extractImagingFromPatients
} = require('../../lib/billing/generate-lab-code-map');

const repoRoot = path.join(__dirname, '..', '..');

describe('generate-lab-code-map', () => {
  it('extracts all lab services from pricing.js', () => {
    const labs = extractLabServicesFromPricing(repoRoot);
    assert.ok(labs.length >= 100);
    assert.ok(labs.some((l) => l.code === 'LAB - 85025'));
  });

  it('builds map with zero unmapped catalog items', () => {
    const map = buildLabCodeMapCanada({ repoRoot });
    assert.equal(map.unmappedCount, 0, `unmapped: ${JSON.stringify(map.unmapped)}`);
    assert.ok(map.byLabCode['LAB - 85025']);
    assert.equal(map.byLabCode['LAB - 85025'], 'G200');
    assert.ok(map.byPanelCpt['84146/84403/83001/83002/82670/84144']);
  });

  it('includes imaging CPT mappings', () => {
    const map = buildLabCodeMapCanada({ repoRoot });
    assert.equal(map.imagingByCpt['71046'], 'G004');
    const imaging = extractImagingFromPatients(repoRoot);
    assert.ok(imaging.length >= 35);
  });
});
