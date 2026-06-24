'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const interop = require('../../lib/interop');
const { buildPatientChartBundle } = require('../../lib/interop/fhir/patient-chart-bundle');
const { logGatewayAction } = require('../../lib/interop/gateway-audit');

describe('Phase 1: FHIR resource builders', () => {
  it('builds ImagingStudy with modality', () => {
    const study = interop.fhir.resources.buildImagingStudy({
      patientId: 'p-1',
      accessionNumber: 'ACC-99',
      modality: 'MR',
      seriesInstanceUid: '1.2.3.4'
    });
    assert.equal(study.resourceType, 'ImagingStudy');
    assert.equal(study.modality[0].code, 'MR');
  });

  it('builds patient chart bundle with conditions', () => {
    const bundle = buildPatientChartBundle({
      id: 'p-1',
      firstName: 'Jane',
      lastName: 'Doe',
      phn: '1234567890',
      diagnoses: [{ diagnosis: 'Hypertension', code: 'I10' }]
    });
    assert.equal(bundle.resourceType, 'Bundle');
    assert.ok(bundle.entry.length >= 2);
  });
});

describe('Phase 1: DICOM gateway stubs', () => {
  it('exports cFindViaGateway function', () => {
    assert.equal(typeof interop.dicom.dicomweb.cFindViaGateway, 'function');
    assert.equal(typeof interop.dicom.dicomweb.cMoveViaGateway, 'function');
  });
});

describe('Phase 1: gateway audit helper', () => {
  it('logs without supabase (console path)', async () => {
    const out = await logGatewayAction(null, {
      action: 'exportPatientBundle',
      body: { organizationId: 'org-1', patient: { id: 'p1' } },
      status: 'success'
    });
    assert.equal(out.logged, false);
    assert.equal(out.entry.message_type, 'exportPatientBundle');
  });
});
