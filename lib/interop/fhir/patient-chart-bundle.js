'use strict';

const resources = require('./resources');

function mapGender(gender) {
  const g = String(gender || '').toLowerCase();
  if (g === 'm' || g === 'male') return 'male';
  if (g === 'f' || g === 'female') return 'female';
  return 'unknown';
}

function normalizePatientInput(patient) {
  const p = patient || {};
  return {
    id: p.id || p.patientId,
    phn: p.phn || p.healthCardNumber || p.health_card_number,
    firstName: p.firstName || p.first_name,
    lastName: p.lastName || p.last_name,
    dob: p.dob || p.date_of_birth,
    gender: p.gender,
    province: p.province || p.state || 'ON',
    phone: p.phone,
    email: p.email,
    addressLine1: p.addressLine1 || p.address_line1,
    city: p.city,
    postalCode: p.postalCode || p.postal_code || p.zip,
    diagnoses: p.diagnoses || p.problems || [],
    medications: p.medications || [],
    allergies: p.allergies || [],
    immunizations: p.immunizations || [],
    vitals: p.vitals || p.vitalSigns || [],
    orders: p.orders || []
  };
}

function buildConditionResources(patientId, diagnoses) {
  return (diagnoses || []).map((dx, idx) => ({
    resourceType: 'Condition',
    id: `cond-${idx + 1}`,
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
    },
    code: {
      text: dx.diagnosis || dx.description || dx.name,
      coding: dx.code ? [resources.coding('http://hl7.org/fhir/sid/icd-10-cm', dx.code, dx.diagnosis)] : undefined
    },
    subject: resources.reference('Patient', patientId),
    recordedDate: dx.date || dx.recordedDate
  }));
}

function buildAllergyResources(patientId, allergies) {
  return (allergies || []).map((a, idx) => ({
    resourceType: 'AllergyIntolerance',
    id: `allergy-${idx + 1}`,
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
    code: { text: a.allergen || a.substance || a.name },
    patient: resources.reference('Patient', patientId),
    reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }], severity: a.severity }] : undefined
  }));
}

function buildImmunizationResources(patientId, immunizations) {
  return (immunizations || []).map((imm, idx) => ({
    resourceType: 'Immunization',
    id: `imm-${idx + 1}`,
    status: 'completed',
    vaccineCode: { text: imm.vaccine || imm.name },
    patient: resources.reference('Patient', patientId),
    occurrenceDateTime: imm.date || imm.givenDate
  }));
}

function buildVitalObservations(patientId, vitals) {
  const obs = [];
  (vitals || []).forEach((v, idx) => {
    const base = {
      subject: resources.reference('Patient', patientId),
      effectiveDateTime: v.date || v.recordedAt || new Date().toISOString()
    };
    if (v.bloodPressure || v.bp) {
      obs.push({
        resourceType: 'Observation',
        id: `obs-bp-${idx}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }] },
        ...base,
        component: [
          { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic' }] }, valueQuantity: { value: v.systolic || v.bloodPressureSystolic, unit: 'mmHg' } },
          { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic' }] }, valueQuantity: { value: v.diastolic || v.bloodPressureDiastolic, unit: 'mmHg' } }
        ]
      });
    }
    if (v.weight) {
      obs.push(resources.buildObservation({
        id: `obs-wt-${idx}`,
        patientId,
        loinc: '29463-7',
        display: 'Body weight',
        value: parseFloat(v.weight),
        units: 'kg',
        effectiveDateTime: base.effectiveDateTime
      }));
    }
  });
  return obs;
}

function buildMedicationRequests(patientId, medications) {
  return (medications || []).map((med, idx) => resources.buildMedicationRequest({
    id: `med-${idx + 1}`,
    patientId,
    prescriptionNumber: med.id || `RX-${idx + 1}`,
    medications: [med],
    authoredOn: med.startDate || med.start_date
  }));
}

/**
 * Build FHIR R4 collection Bundle from MediForge patient chart object.
 */
function buildPatientChartBundle(patientInput, options = {}) {
  const p = normalizePatientInput(patientInput);
  const patientResource = resources.buildPatient({
    id: p.id,
    phn: p.phn,
    firstName: p.firstName,
    lastName: p.lastName,
    dob: p.dob,
    gender: p.gender,
    province: p.province
  });
  if (p.phone || p.email) {
    patientResource.telecom = [];
    if (p.phone) patientResource.telecom.push({ system: 'phone', value: p.phone, use: 'mobile' });
    if (p.email) patientResource.telecom.push({ system: 'email', value: p.email });
  }
  if (p.addressLine1 || p.city) {
    patientResource.address = [{
      line: [p.addressLine1].filter(Boolean),
      city: p.city,
      postalCode: p.postalCode,
      country: 'CA'
    }];
  }

  const patientId = patientResource.id;
  const entries = [
    patientResource,
    ...buildConditionResources(patientId, p.diagnoses),
    ...buildAllergyResources(patientId, p.allergies),
    ...buildImmunizationResources(patientId, p.immunizations),
    ...buildVitalObservations(patientId, p.vitals),
    ...buildMedicationRequests(patientId, p.medications)
  ];

  const bundle = resources.buildBundle(entries, options.bundleType || 'collection');
  bundle.meta = {
    lastUpdated: new Date().toISOString(),
    profile: ['http://hl7.org/fhir/StructureDefinition/Bundle']
  };
  bundle.identifier = {
    system: 'urn:mediforge:export',
    value: `chart-${patientId}-${Date.now()}`
  };
  return bundle;
}

module.exports = { buildPatientChartBundle, normalizePatientInput };
