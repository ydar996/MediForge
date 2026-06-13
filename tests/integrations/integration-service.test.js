'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { IntegrationService, loadIntegrationsConfig, listProvinces, messageRouter } = require('../../lib/integrations');
const interop = require('../../lib/interop');

const samplesDir = path.join(__dirname, '..', 'samples');

describe('Integration config', () => {
  it('loads Ontario province overlay', () => {
    const cfg = loadIntegrationsConfig({ province: 'ON', reload: true });
    assert.equal(cfg.province, 'ON');
    assert.ok(cfg.provinceMeta?.hubs?.lab);
    assert.equal(cfg.adapters.lab, 'hl7');
  });

  it('lists configured provinces', () => {
    const provinces = listProvinces();
    assert.ok(provinces.find((p) => p.code === 'ON'));
    assert.ok(provinces.find((p) => p.code === 'BC'));
    assert.ok(provinces.find((p) => p.code === 'AB'));
  });

  it('routes lab to HL7 and imaging to FHIR for Ontario', () => {
    const cfg = loadIntegrationsConfig({ province: 'ON', reload: true });
    assert.equal(messageRouter.resolveTransport('lab', cfg), 'hl7');
    assert.equal(messageRouter.resolveTransport('imaging', cfg), 'fhir');
  });
});

describe('IntegrationService', () => {
  const patient = {
    id: 'p1',
    phn: '1234567890',
    firstName: 'Jane',
    lastName: 'Doe',
    dob: '19850315',
    gender: 'F'
  };

  it('sendOrder queues lab HL7 when disabled', async () => {
    const service = new IntegrationService({ province: 'ON' });
    const result = await service.sendOrder({
      type: 'lab',
      patient,
      order: { serial_number: 'LAB-MEC-001', selected_items: [{ name: 'FBS' }] },
      organizationId: 'org-1',
      userId: 'user-1'
    });
    assert.equal(result.transport, 'hl7');
    assert.equal(result.queued, true);
    assert.match(result.hl7, /ORM\^O01/);
  });

  it('receiveResult parses ORU sample', async () => {
    const service = new IntegrationService({ province: 'ON' });
    const raw = fs.readFileSync(path.join(samplesDir, 'hl7', 'oru-r01-lab-result.hl7'), 'utf8');
    const { chart, ack, standard } = await service.receiveResult({ rawHl7: raw, organizationId: 'org-1' });
    assert.equal(standard, 'hl7');
    assert.ok(chart.results['Fasting glucose']);
    assert.match(ack, /MSA\|AA/);
  });

  it('receiveResult parses FHIR DiagnosticReport bundle', async () => {
    const service = new IntegrationService({ province: 'ON' });
    const bundle = JSON.parse(
      fs.readFileSync(path.join(samplesDir, 'fhir', 'diagnostic-report-lab.json'), 'utf8')
    );
    const { chart, standard } = await service.receiveResult({ fhirBundle: bundle, organizationId: 'org-1' });
    assert.equal(standard, 'fhir');
    assert.ok(chart.results['Fasting glucose']);
  });

  it('sendPrescription queues Infoway payload when disabled', async () => {
    const service = new IntegrationService({ province: 'ON' });
    const result = await service.sendPrescription({
      patient,
      prescription: {
        id: 'rx-1',
        prescription_number: 'MEC-RX-0001',
        medications: [{ name: 'metformin', dosage: '500 mg BID' }]
      },
      organizationId: 'org-1'
    });
    assert.equal(result.queued, true);
    assert.ok(result.payload.resource);
  });

  it('submitClaim returns draft for OHIP', async () => {
    const service = new IntegrationService({ province: 'ON' });
    const result = await service.submitClaim({
      patient,
      provider: { billingNumber: '123456', organizationId: 'org-1' },
      invoice: { id: 'inv-1', invoiceNumber: 'INV-MEC-2026-0042', total: 23.75 },
      services: [{ feeCode: 'A007A', amount: 23.75 }],
      payerCode: 'OHIP',
      organizationId: 'org-1'
    });
    assert.equal(result.draft.payerCode, 'OHIP');
    assert.equal(result.queued, true);
  });

  it('processRemittance reconciles ERA sample', async () => {
    const service = new IntegrationService({ province: 'ON' });
    const raw = fs.readFileSync(path.join(samplesDir, 'billing', 'ohip-remittance-era.json'), 'utf8');
    const { remittance, reconciliation } = await service.processRemittance({
      raw,
      invoices: [{ id: 'inv-uuid-001', invoiceNumber: 'INV-MEC-2026-0042', payerSplit: { patientDue: 0 } }],
      organizationId: 'org-1'
    });
    assert.equal(remittance.totalPaid, 23.75);
    assert.equal(reconciliation[0].matched, true);
  });

  it('matches patient on Ontario PHN', () => {
    const service = new IntegrationService({ province: 'ON' });
    const match = service.matchPatient({
      phn: '1234567890',
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1985-03-15',
      candidates: [patient]
    });
    assert.equal(match.matched, true);
  });
});

describe('Imaging ORU sample', () => {
  it('parses imaging report ORU', () => {
    const raw = fs.readFileSync(path.join(samplesDir, 'hl7', 'oru-r01-imaging-report.hl7'), 'utf8');
    const parsed = interop.adapters.lab.parseOruMessage(raw);
    assert.equal(parsed.type, 'ORU^R01');
    assert.ok(parsed.obx.length >= 1);
  });
});
