'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const olisConsent = require('../../lib/interop/olis-consent');
const labWorkflow = require('../../lib/interop/lab-results-workflow');
const { IntegrationService } = require('../../lib/integrations/IntegrationService');

const sampleOru = fs.readFileSync(
  path.join(__dirname, '../samples/hl7/oru-r01-lab-result.hl7'),
  'utf8'
);

describe('Phase 4: OLIS consent', () => {
  it('detects granted olis_query consent', () => {
    assert.equal(
      olisConsent.isOlisConsentGranted([{ consent_type: 'olis_query', granted: true }]),
      true
    );
  });

  it('blocks when consent missing and required', () => {
    const r = olisConsent.assertOlisConsent([], { requireConsent: true });
    assert.equal(r.blocked, true);
    assert.equal(r.code, 'OLIS_CONSENT_REQUIRED');
  });

  it('skips check when requireConsent is false', () => {
    const r = olisConsent.assertOlisConsent([], { requireConsent: false });
    assert.equal(r.skipped, true);
  });
});

describe('Phase 4: lab results workflow', () => {
  it('finds order by placer serial', () => {
    const order = labWorkflow.findOrderByPlacerNumber(
      [{ serial_number: 'LAB-MEC-001', id: 'uuid-1' }],
      'LAB-MEC-001'
    );
    assert.equal(order.id, 'uuid-1');
  });

  it('merges chart results into order payload', () => {
    const merged = labWorkflow.mergeChartIntoOrderResults(
      { glucose: '5.1' },
      { results: { glucose: '5.2' }, critical: false, standard: 'hl7_oru' }
    );
    assert.equal(merged.glucose, '5.2');
    assert.equal(merged._interop.source, 'hl7_oru');
  });

  it('summarizes inbound review queue', () => {
    const rows = labWorkflow.summarizeInboundQueue([
      { id: '1', portal_results_status: 'awaiting_review', results: {} },
      { id: '2', portal_results_status: 'order_sent', results: { _interop: { critical: true } } }
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].critical, true);
  });
});

describe('Phase 4: IntegrationService consent gate', () => {
  it('blocks lab send when consent required but not granted', async () => {
    const service = new IntegrationService({
      config: { enabled: false, province: 'ON', security: { requireConsent: true }, adapters: {}, hl7: {} }
    });
    const result = await service.sendOrder({
      type: 'lab',
      patient: { id: 'p1' },
      order: { id: 'o1', serial_number: 'LAB-1' },
      organizationId: 'org',
      olisConsentGranted: false
    });
    assert.equal(result.blocked, true);
  });

  it('parses ORU when consent granted', async () => {
    const service = new IntegrationService({
      config: { enabled: false, province: 'ON', security: { requireConsent: true }, adapters: {}, hl7: {} }
    });
    const result = await service.receiveResult({
      rawHl7: sampleOru,
      organizationId: 'org',
      olisConsentGranted: true
    });
    assert.ok(result.chart);
    assert.ok(result.ack);
  });
});
