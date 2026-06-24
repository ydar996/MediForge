'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const hrmAdapter = require('../../lib/interop/adapters/hrm-adapter');
const hrmWorkflow = require('../../lib/interop/hrm-workflow');
const hrmConsent = require('../../lib/interop/hrm-consent');
const dhdrConsent = require('../../lib/interop/dhdr-consent');
const dhdr = require('../../lib/interop/dhdr');
const { IntegrationService } = require('../../lib/integrations/IntegrationService');

describe('Phase 7: HRM adapter', () => {
  it('maps HL7 payload to chart document', () => {
    const raw = 'MSH|^~\\&|HOSP|FAC|MEDIFORGE|CLINIC|20260622120000||MDM^T02|HRM-001|P|2.5\rPID|1||MRN123^^^CLINIC||DOE^JANE\rOBR|1||PLACER-99||DIS^Discharge Summary\rOBX|1|TX|DIS^Discharge||Patient stable.';
    const payload = hrmAdapter.parseHrmHl7(raw);
    const doc = hrmAdapter.hrmPayloadToChartDocument(payload);
    assert.equal(doc.source, 'hrm');
    assert.match(doc.body, /Patient stable/);
    assert.ok(doc.title);
  });

  it('parses FHIR DocumentReference bundle', () => {
    const bundle = {
      entry: [{
        resource: {
          resourceType: 'DocumentReference',
          description: 'ED Summary',
          content: [{ attachment: { data: Buffer.from('Report text').toString('base64') } }]
        }
      }]
    };
    const parsed = hrmAdapter.fhirDocumentReferenceToChart(bundle);
    assert.equal(parsed.parsed, true);
    assert.equal(parsed.document.title, 'ED Summary');
    assert.equal(parsed.document.body, 'Report text');
  });
});

describe('Phase 7: HRM workflow + consent', () => {
  it('summarizes awaiting review inbox', () => {
    const rows = hrmWorkflow.summarizeHrmInbox([
      { id: '1', status: 'awaiting_review', report_title: 'Discharge' },
      { id: '2', status: 'filed', filed_at: '2026-06-22', report_title: 'Old' }
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, '1');
  });

  it('blocks HRM without consent', () => {
    const denied = hrmConsent.assertHrmConsent([], { requireConsent: true });
    assert.equal(denied.blocked, true);
    assert.equal(denied.code, 'HRM_CONSENT_REQUIRED');
  });

  it('allows HRM with hrm_query consent', () => {
    const ok = hrmConsent.assertHrmConsent([{ consent_type: 'hrm_query', granted: true }]);
    assert.equal(ok.ok, true);
  });
});

describe('Phase 7: DHDR', () => {
  it('builds queued query URL when not configured', () => {
    const q = dhdr.buildDhdrQueryUrl({ patient: { phn: '1234567890AB' }, config: {} });
    assert.equal(q.queued, true);
    assert.match(q.queryUrl, /MedicationStatement/);
    assert.match(q.queryUrl, /1234567890AB/);
  });

  it('parses MedicationStatement bundle', () => {
    const meds = dhdr.parseMedicationStatementBundle({
      entry: [{
        resource: {
          resourceType: 'MedicationStatement',
          id: 'm1',
          status: 'active',
          medicationCodeableConcept: { text: 'Metformin 500mg' }
        }
      }]
    });
    assert.equal(meds.length, 1);
    assert.equal(meds[0].medication, 'Metformin 500mg');
  });

  it('blocks DHDR without consent', () => {
    const denied = dhdrConsent.assertDhdrConsent([], { requireConsent: true });
    assert.equal(denied.code, 'DHDR_CONSENT_REQUIRED');
  });
});

describe('Phase 7: IntegrationService HRM/DHDR', () => {
  const service = new IntegrationService({ supabase: null, config: { province: 'ON', security: { requireConsent: true } } });

  it('ingestHrmReport returns document from HL7', async () => {
    const raw = 'MSH|^~\\&|HOSP|FAC|MEDIFORGE|CLINIC|20260622120000||MDM^T02|HRM-002|P|2.5\rOBX|1|TX|RPT^Report||Hello HRM.';
    const res = await service.ingestHrmReport({
      rawHl7: raw,
      organizationId: 'org-1',
      userId: 'u1',
      hrmConsentGranted: true
    });
    assert.equal(res.standard, 'hl7');
    assert.match(res.document.body, /Hello HRM/);
  });

  it('queryDhdrMedications blocks without consent flag', () => {
    const blocked = service.queryDhdrMedications({
      patient: { phn: '1234567890AB' },
      organizationId: 'org-1',
      userId: 'u1'
    });
    assert.equal(blocked.blocked, true);
  });

  it('queryDhdrMedications parses bundle when consented', () => {
    const res = service.queryDhdrMedications({
      patient: { phn: '1234567890AB' },
      dhdrConsentGranted: true,
      fhirBundle: {
        entry: [{ resource: { resourceType: 'MedicationStatement', medicationCodeableConcept: { text: 'Aspirin' } } }]
      }
    });
    assert.equal(res.medications[0].medication, 'Aspirin');
  });
});
