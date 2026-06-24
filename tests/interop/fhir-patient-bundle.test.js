'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildPatientChartBundle } = require('../../lib/interop/fhir/patient-chart-bundle');

describe('FHIR patient chart bundle export', () => {
  it('builds collection Bundle with Patient and clinical resources', () => {
    const bundle = buildPatientChartBundle({
      id: 'p-test-001',
      phn: '1234567890',
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1985-03-15',
      gender: 'F',
      diagnoses: [{ diagnosis: 'Type 2 diabetes', code: 'E11.9' }],
      allergies: [{ allergen: 'Penicillin', reaction: 'Rash' }],
      medications: [{ name: 'Metformin', dosage: '500mg BID' }]
    });

    assert.equal(bundle.resourceType, 'Bundle');
    assert.equal(bundle.type, 'collection');
    assert.ok(bundle.entry.length >= 4);
    const types = bundle.entry.map((e) => e.resource.resourceType);
    assert.ok(types.includes('Patient'));
    assert.ok(types.includes('Condition'));
    assert.ok(types.includes('AllergyIntolerance'));
    assert.ok(types.includes('MedicationRequest'));
  });

  it('includes Ontario PHN identifier system', () => {
    const bundle = buildPatientChartBundle({
      id: 'p2',
      phn: '9876543210',
      firstName: 'A',
      lastName: 'B',
      dob: '1990-01-01',
      gender: 'M'
    });
    const patient = bundle.entry[0].resource;
    assert.equal(patient.resourceType, 'Patient');
    assert.match(patient.identifier[0].system, /ehealthontario/);
  });
});
