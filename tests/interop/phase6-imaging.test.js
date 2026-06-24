'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const imagingWorkflow = require('../../lib/interop/imaging-results-workflow');
const connectingOntario = require('../../lib/interop/connecting-ontario');
const smartLaunch = require('../../lib/interop/smart-launch');
const imagingAdapter = require('../../lib/interop/adapters/imaging-adapter');
const { IntegrationService } = require('../../lib/integrations/IntegrationService');

describe('Phase 6: imaging workflow', () => {
  it('finds imaging order by serial', () => {
    const orders = [
      { id: 'o1', type: 'lab', serial_number: 'LAB-1' },
      { id: 'o2', type: 'imaging', serial_number: 'IMG-1' }
    ];
    const found = imagingWorkflow.findImagingOrderBySerial(orders, 'IMG-1');
    assert.equal(found.id, 'o2');
  });

  it('merges report and DICOM link into results', () => {
    const merged = imagingWorkflow.mergeImagingReportIntoOrder(
      { note: 'prior' },
      { results: { impression: 'Normal' }, wadoUrl: 'https://pacs.example/wado' }
    );
    assert.equal(merged.impression, 'Normal');
    assert.equal(merged._imaging.studies[0].wadoUrl, 'https://pacs.example/wado');
  });

  it('summarizes imaging review queue', () => {
    const rows = imagingWorkflow.summarizeImagingReviewQueue([
      { id: '1', type: 'imaging', portal_results_status: 'awaiting_review', patient_id: 'p1', status: 'completed' },
      { id: '2', type: 'lab', portal_results_status: 'awaiting_review', patient_id: 'p2', status: 'completed' }
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, '1');
  });
});

describe('Phase 6: connecting ontario + SMART stubs', () => {
  it('builds queued ConnectingOntario URL when not configured', () => {
    const r = connectingOntario.buildConnectingOntarioLaunchUrl({
      patient: { phn: '1234567890AB' },
      config: {}
    });
    assert.equal(r.queued, true);
    assert.match(r.launchUrl, /patientHcn=1234567890AB/);
  });

  it('builds SMART authorize URL stub', () => {
    const r = smartLaunch.buildSmartLaunchUrl({
      patient: { id: 'pat-1' },
      config: { fhir: { baseUrl: 'https://fhir.example/r4' }, smart: { clientId: 'mf' } }
    });
    assert.match(r.authorizeUrl, /client_id=mf/);
    assert.equal(r.patientId, 'pat-1');
  });
});

describe('Phase 6: imaging adapter + IntegrationService', () => {
  const patient = { id: 'p1', firstName: 'Jane', lastName: 'Doe', phn: '1234567890AB' };
  const order = {
    id: 'img-1',
    serial_number: 'IMG-MEC-001',
    selected_items: [{ name: 'Chest X-Ray', dicomModality: 'DX' }],
    timestamp: '20260622120000'
  };

  it('generates imaging HL7 ORM', () => {
    const hl7 = imagingAdapter.orderToHl7({ patient, order, config: { province: 'ON', hl7: {} } });
    assert.match(hl7, /ORM\^O01/);
    assert.match(hl7, /IMG-MEC-001/);
  });

  it('generates FHIR ServiceRequest for imaging', () => {
    const sr = imagingAdapter.orderToFhirServiceRequest({ patient, order, config: { province: 'ON' } });
    assert.equal(sr.resourceType, 'ServiceRequest');
  });

  it('IntegrationService ingestImagingReport maps FHIR DiagnosticReport', async () => {
    const service = new IntegrationService({ province: 'ON', enabled: false });
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'DiagnosticReport',
            status: 'final',
            code: { text: 'Chest X-Ray' },
            subject: { reference: 'Patient/p1' },
            basedOn: [{ reference: 'ServiceRequest/IMG-MEC-001' }],
            conclusion: 'No acute findings'
          }
        }
      ]
    };
    const result = await service.ingestImagingReport({
      fhirBundle: bundle,
      organizationId: 'org-1',
      userId: 'u1'
    });
    assert.ok(result.chart);
    assert.equal(result.standard, 'fhir');
  });

  it('attachDicomStudyToOrderResults links WADO URL', () => {
    const service = new IntegrationService({ province: 'ON' });
    const merged = service.attachDicomStudyToOrderResults({}, {
      studyInstanceUid: '1.2.3',
      wadoUrl: 'https://pacs/wado'
    });
    assert.equal(merged._imaging.studies.length, 1);
  });
});
