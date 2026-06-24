'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prescribeitConsent = require('../../lib/interop/prescribeit-consent');
const rxWorkflow = require('../../lib/interop/rx-workflow');
const rxAdapter = require('../../lib/interop/adapters/rx-adapter');
const { IntegrationService } = require('../../lib/integrations/IntegrationService');

const sampleDispense = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../samples/fhir/medication-dispense-feedback.json'), 'utf8')
);

describe('Phase 5: PrescribeIT consent', () => {
  it('detects granted prescribeit_erx consent', () => {
    assert.equal(
      prescribeitConsent.isErxConsentGranted([{ consent_type: 'prescribeit_erx', granted: true }]),
      true
    );
  });

  it('blocks when eRx consent missing', () => {
    const r = prescribeitConsent.assertErxConsent([], { requireConsent: true });
    assert.equal(r.blocked, true);
    assert.equal(r.code, 'ERX_CONSENT_REQUIRED');
  });
});

describe('Phase 5: rx adapter', () => {
  const patient = { id: 'p1', firstName: 'Jane', lastName: 'Doe' };
  const prescription = {
    id: 'rx-1',
    prescription_number: 'MEC-RX-0001',
    medications: [{ name: 'Metformin 500mg', dosage: '500mg', frequency: 'BID' }],
    status: 'signed'
  };

  it('builds Infoway MedicationRequest payload', () => {
    const payload = rxAdapter.prescriptionToInfowayPayload({ patient, prescription, config: { province: 'ON' } });
    assert.equal(payload.resource.resourceType, 'MedicationRequest');
    assert.equal(payload.resource.status, 'active');
  });

  it('builds cancellation payload', () => {
    const payload = rxAdapter.prescriptionToCancelledPayload({
      patient,
      prescription,
      config: { province: 'ON' },
      reason: 'Patient request'
    });
    assert.equal(payload.resource.status, 'cancelled');
    assert.equal(payload.messageType, 'cancel');
  });

  it('builds renewal payload with basedOn', () => {
    const payload = rxAdapter.prescriptionToRenewalPayload({
      patient,
      prescription,
      config: { province: 'ON' },
      requestedBy: 'dr.smith'
    });
    assert.equal(payload.messageType, 'renewal');
    assert.ok(payload.resource.basedOn?.length);
  });

  it('parses MedicationDispense feedback', () => {
    const feedback = rxAdapter.parseMedicationDispenseFeedback(sampleDispense);
    assert.equal(feedback.parsed, true);
    assert.equal(feedback.pharmacyStatus, 'filled');
  });

  it('attaches pharmacy routing', () => {
    const base = rxAdapter.prescriptionToInfowayPayload({ patient, prescription, config: { province: 'ON' } });
    const withPh = rxAdapter.attachPharmacyDestination(base, { id: 'ON-SDM-1', name: 'Shoppers', fhirEndpoint: 'https://rx.example/fhir' });
    assert.equal(withPh.routing.pharmacyId, 'ON-SDM-1');
  });
});

describe('Phase 5: rx workflow', () => {
  it('summarizes eRx queue rows', () => {
    const rows = rxWorkflow.summarizeErxQueue([
      { id: '1', patient_id: 'p1', pharmacy_status: 'external', status: 'signed' },
      { id: '2', patient_id: 'p2', erx_status: 'transmitted', status: 'signed' }
    ]);
    assert.equal(rows.length, 2);
  });

  it('applies dispense feedback patch', () => {
    const feedback = rxAdapter.parseMedicationDispenseFeedback(sampleDispense);
    const applied = rxWorkflow.applyDispenseFeedback({ id: 'rx-1', erx_status: 'transmitted' }, feedback);
    assert.equal(applied.updated, true);
    assert.equal(applied.patch.erx_status, 'dispensed');
  });

  it('matches prescription by dispense ref', () => {
    const feedback = rxAdapter.parseMedicationDispenseFeedback(sampleDispense);
    const match = rxWorkflow.matchPrescriptionByDispense(
      [{ id: 'x', prescription_number: 'MEC-RX-0001' }],
      feedback
    );
    assert.equal(match.prescription_number, 'MEC-RX-0001');
  });
});

describe('Phase 5: IntegrationService eRx gates', () => {
  it('blocks send when eRx consent required but not granted', async () => {
    const service = new IntegrationService({
      config: { enabled: false, province: 'ON', security: { requireConsent: true }, adapters: {}, fhir: {}, rx: {} }
    });
    const result = await service.sendPrescription({
      patient: { id: 'p1' },
      prescription: { id: 'rx1', prescription_number: 'RX-1', medications: [] },
      organizationId: 'org',
      erxConsentGranted: false
    });
    assert.equal(result.blocked, true);
    assert.equal(result.code, 'ERX_CONSENT_REQUIRED');
  });

  it('simulates Rx transmit in queue mode', async () => {
    const service = new IntegrationService({
      config: { enabled: false, province: 'ON', security: { requireConsent: false }, adapters: {}, fhir: {}, rx: {} }
    });
    const result = await service.simulateRxTransmit({
      patient: { id: 'p1' },
      prescription: {
        id: 'rx1',
        prescription_number: 'RX-1',
        medications: [{ name: 'Metformin', dosage: '500mg' }]
      },
      organizationId: 'org'
    });
    assert.equal(result.simulated, true);
    assert.equal(result.queued, true);
    assert.ok(result.payload?.resource);
  });

  it('ingests MedicationDispense feedback', async () => {
    const service = new IntegrationService({
      config: { enabled: false, province: 'ON', adapters: {}, fhir: {}, rx: {} }
    });
    const feedback = await service.ingestMedicationDispense({
      fhirBundle: sampleDispense,
      organizationId: 'org'
    });
    assert.equal(feedback.parsed, true);
  });
});
