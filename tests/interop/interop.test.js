'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const interop = require('../../lib/interop');

const samplesDir = path.join(__dirname, '..', 'samples');

describe('HL7 interoperability', () => {
  it('parses ORU^R01 sample', () => {
    const raw = fs.readFileSync(path.join(samplesDir, 'hl7', 'oru-r01-lab-result.hl7'), 'utf8');
    const parsed = interop.adapters.lab.parseOruMessage(raw);
    assert.equal(parsed.type, 'ORU^R01');
    assert.ok(parsed.obx.length >= 2);
    assert.equal(parsed.pid.patientId, '1234567890');
  });

  it('converts ORU to chart results', () => {
    const raw = fs.readFileSync(path.join(samplesDir, 'hl7', 'oru-r01-lab-result.hl7'), 'utf8');
    const parsed = interop.adapters.lab.parseOruMessage(raw);
    const chart = interop.adapters.lab.oruToChartResults(parsed);
    assert.equal(chart.placerOrderNumber, 'LAB-MEC-001');
    assert.ok(chart.results['Fasting glucose']);
    assert.equal(chart.critical, true);
  });

  it('generates ORM^O01 lab order', () => {
    const hl7 = interop.adapters.lab.orderToHl7({
      patient: { id: 'p1', phn: '1234567890', firstName: 'Jane', lastName: 'Doe', dob: '19850315', gender: 'F' },
      order: {
        serial_number: 'LAB-MEC-001',
        selected_items: [{ name: 'FBS', cpt: '82947' }, { name: 'HbA1c' }]
      }
    });
    assert.match(hl7, /^MSH\|/);
    assert.match(hl7, /ORM\^O01/);
    assert.match(hl7, /LAB-MEC-001/);
    assert.match(hl7, /1558-6/);
  });

  it('generates positive ACK', () => {
    const raw = fs.readFileSync(path.join(samplesDir, 'hl7', 'orm-o01-lab-order.hl7'), 'utf8');
    const { msh } = interop.hl7.parser.parseMessage(raw);
    const ack = interop.hl7.ack.generateAck({ inboundMsh: msh, ackCode: 'AA' });
    assert.match(ack, /MSA\|AA\|LAB-MEC-001/);
  });

  it('wraps and unwraps MLLP', () => {
    const msg = 'MSH|test\rPID|1';
    const wrapped = interop.hl7.mllp.wrapMllp(msg);
    assert.equal(wrapped[0], 0x0b);
    const unwrapped = interop.hl7.mllp.unwrapMllp(wrapped);
    assert.equal(unwrapped, msg);
  });
});

describe('FHIR interoperability', () => {
  it('builds ServiceRequest with LOINC', () => {
    const sr = interop.fhir.resources.buildServiceRequest({
      patientId: 'patient-uuid-001',
      placerOrderNumber: 'LAB-MEC-001',
      items: [{ loinc: '1558-6', name: 'Fasting glucose' }]
    });
    assert.equal(sr.resourceType, 'ServiceRequest');
    assert.equal(sr.code.coding[0].code, '1558-6');
  });

  it('parses DiagnosticReport bundle to chart results', () => {
    const bundle = JSON.parse(
      fs.readFileSync(path.join(samplesDir, 'fhir', 'diagnostic-report-lab.json'), 'utf8')
    );
    const chart = interop.adapters.lab.fhirDiagnosticReportToChartResults(bundle);
    assert.ok(chart.results['Fasting glucose']);
    assert.match(chart.conclusion, /HbA1c/);
  });

  it('builds MedicationRequest with CCDD/DIN', () => {
    const mr = interop.adapters.rx.prescriptionToMedicationRequest({
      patient: { id: 'p1' },
      prescription: {
        prescription_number: 'MEC-RX-0001',
        medications: [{ name: 'metformin', dosage: '500 mg BID' }]
      }
    });
    assert.equal(mr.resourceType, 'MedicationRequest');
    assert.ok(mr.medicationCodeableConcept.coding.length > 0);
  });
});

describe('Imaging adapter', () => {
  it('generates imaging ORM with SNOMED modality', () => {
    const hl7 = interop.adapters.imaging.orderToHl7({
      patient: { phn: '1234567890', firstName: 'Jane', lastName: 'Doe' },
      order: {
        serial_number: 'IMG-MEC-002',
        selected_items: [{ name: 'CT', modality: 'CT' }]
      }
    });
    assert.match(hl7, /77477000/);
  });
});

describe('Patient matching', () => {
  it('matches on Ontario PHN', () => {
    const result = interop.patientMatching.matchPatient({
      phn: '1234-567-890',
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1985-03-15',
      candidates: [
        {
          id: 'p1',
          firstName: 'Jane',
          lastName: 'Doe',
          dob: '1985-03-15',
          phn: '1234567890'
        }
      ]
    });
    assert.equal(result.matched, true);
    assert.equal(result.patient.id, 'p1');
  });
});

describe('Terminology', () => {
  it('maps FBS to LOINC', () => {
    const m = interop.terminology.loinc.mapTestToLoinc('FBS');
    assert.equal(m.loinc, '1558-6');
  });

  it('maps CT to SNOMED', () => {
    const m = interop.terminology.snomed.mapModality('CT');
    assert.equal(m.snomed, '77477000');
  });
});
