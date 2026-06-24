'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { IntegrationService } = require('../../lib/integrations/IntegrationService');
const orgHubConfig = require('../../lib/integrations/org-hub-config');
const interop = require('../../lib/interop');

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

  it('provincialHubsToConfigOverlay maps UI settings to gateway config', () => {
    const overlay = orgHubConfig.provincialHubsToConfigOverlay({
      hrmFacilityId: 'FAC-9',
      dhdrFhirBase: 'https://dhdr.example/fhir',
      coViewerBase: 'https://co.example/viewer',
      smartAuthorize: 'https://fhir.example/authorize',
      smartClientId: 'mediforge-emr'
    });
    assert.equal(overlay.hrm.facilityId, 'FAC-9');
    assert.equal(overlay.dhdr.fhirBaseUrl, 'https://dhdr.example/fhir');
    assert.equal(overlay.connectingOntario.viewerBaseUrl, 'https://co.example/viewer');
    assert.equal(overlay.smart.clientId, 'mediforge-emr');
  });

  it('mergeOrgHubsIntoConfig deep-merges org overlay', () => {
    const merged = orgHubConfig.mergeOrgHubsIntoConfig(
      { province: 'ON', dhdr: { fhirBaseUrl: 'REPLACE_WITH_DHDR_FHIR_BASE' } },
      { dhdr: { fhirBaseUrl: 'https://live-dhdr.example/fhir' } }
    );
    assert.equal(merged.dhdr.fhirBaseUrl, 'https://live-dhdr.example/fhir');
  });
});

describe('Phase 8: DICOM C-FIND/C-MOVE stubs', () => {
  it('returns stub C-FIND when gateway URL is not configured', async () => {
    const res = await interop.dicom.dicomweb.cFindViaGateway({
      gatewayUrl: 'REPLACE_WITH_DIMSE_GATEWAY',
      query: { patientId: 'PAT-1' }
    });
    assert.equal(res.stub, true);
    assert.equal(res.results[0].patientId, 'PAT-1');
  });

  it('IntegrationService dicomweb cFind works without DICOMweb root', async () => {
    const service = new IntegrationService({
      supabase: null,
      config: { province: 'ON', dicomweb: { dimseGatewayUrl: 'REPLACE_WITH_DIMSE_GATEWAY' } }
    });
    const res = await service.dicomweb({ operation: 'cFind', params: { query: { modality: 'CR' } } });
    assert.equal(res.stub, true);
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
