'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { IntegrationService } = require('../../lib/integrations/IntegrationService');

describe('Phase 8: per-org provincial hub config', () => {
  it('saveProvincialHubConfig merges hub URLs', () => {
    const service = new IntegrationService({
      supabase: null,
      config: {
        province: 'ON',
        connectingOntario: { viewerBaseUrl: 'https://co.example/viewer' },
        dhdr: { fhirBaseUrl: 'https://dhdr.example/fhir' },
        hrm: { facilityId: 'FAC-1' }
      }
    });
    const res = service.saveProvincialHubConfig({
      dhdr: { fhirBaseUrl: 'https://live-dhdr.example/fhir' },
      hrm: { facilityId: 'FAC-2' }
    });
    assert.equal(res.saved, true);
    assert.equal(res.config.dhdr.fhirBaseUrl, 'https://live-dhdr.example/fhir');
    assert.equal(res.config.hrm.facilityId, 'FAC-2');
    assert.match(res.config.connectingOntario.viewerBaseUrl, /co.example/);
  });
});

describe('Phase 8: gateway audit + consent enforcement', () => {
  it('HRM ingest respects consent gate', async () => {
    const service = new IntegrationService({
      supabase: null,
      config: { province: 'ON', security: { requireConsent: true } }
    });
    const blocked = await service.ingestHrmReport({
      rawHl7: 'MSH|^~\\&|HOSP|FAC|MEDIFORGE|CLINIC|20260622120000||MDM^T02|X|P|2.5',
      organizationId: 'org-1'
    });
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.code, 'HRM_CONSENT_REQUIRED');
  });
});
