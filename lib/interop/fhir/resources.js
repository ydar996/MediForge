'use strict';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function meta(profile) {
  return {
    profile: profile ? [profile] : undefined
  };
}

function coding(system, code, display) {
  return { system, code, display: display || code };
}

function reference(resourceType, id) {
  return { reference: `${resourceType}/${id}` };
}

function buildPatient({ id, phn, firstName, lastName, dob, gender, province = 'ON' }) {
  const patientId = id || uuid();
  const identifiers = [];
  if (phn) {
    identifiers.push({
      use: 'official',
      type: {
        coding: [coding('http://terminology.hl7.org/CodeSystem/v2-0203', 'JHN', 'Jurisdictional health number')]
      },
      system: `http://ehealthontario.ca/fhir/NamingSystem/id-${province.toLowerCase()}-patient-hcn`,
      value: phn
    });
  }
  return {
    resourceType: 'Patient',
    id: patientId,
    meta: meta('http://ehealthontario.ca/fhir/StructureDefinition/olis-patient'),
    identifier: identifiers.length ? identifiers : [{ value: patientId }],
    name: [{ family: lastName, given: [firstName].filter(Boolean) }],
    birthDate: dob,
    gender: gender === 'M' || gender === 'male' ? 'male' : gender === 'F' || gender === 'female' ? 'female' : 'unknown'
  };
}

function buildServiceRequest({ id, patientId, placerOrderNumber, items, category = 'laboratory', authoredOn }) {
  const reqId = id || uuid();
  const codeable = (items || []).map((item) => ({
    coding: [
      coding('http://loinc.org', item.loinc || item.code, item.display || item.name),
      item.snomed ? coding('http://snomed.info/sct', item.snomed, item.name) : null
    ].filter(Boolean)
  }));

  return {
    resourceType: 'ServiceRequest',
    id: reqId,
    meta: meta('http://hl7.org/fhir/StructureDefinition/ServiceRequest'),
    identifier: [{ system: 'urn:mediforge:order', value: placerOrderNumber }],
    status: 'active',
    intent: 'order',
    category: [{ coding: [coding('http://snomed.info/sct', category === 'imaging' ? '363679005' : '108252007', category)] }],
    code: codeable[0] || { text: 'Laboratory test' },
    subject: reference('Patient', patientId),
    authoredOn: authoredOn || new Date().toISOString()
  };
}

function buildObservation({ id, patientId, loinc, display, value, units, referenceRange, interpretation, effectiveDateTime }) {
  const obs = {
    resourceType: 'Observation',
    id: id || uuid(),
    status: 'final',
    category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/observation-category', 'laboratory')] }],
    code: { coding: [coding('http://loinc.org', loinc, display)] },
    subject: reference('Patient', patientId),
    effectiveDateTime: effectiveDateTime || new Date().toISOString()
  };

  if (typeof value === 'number') {
    obs.valueQuantity = { value, unit: units, system: 'http://unitsofmeasure.org', code: units };
  } else {
    obs.valueString = String(value);
  }

  if (referenceRange) obs.referenceRange = [{ text: referenceRange }];
  if (interpretation) {
    obs.interpretation = [{ coding: [coding('http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', interpretation)] }];
  }
  return obs;
}

function buildDiagnosticReport({ id, patientId, placerOrderNumber, observations, conclusion, effectiveDateTime }) {
  return {
    resourceType: 'DiagnosticReport',
    id: id || uuid(),
    meta: meta('http://ehealthontario.ca/fhir/StructureDefinition/olis-diagnostic-report'),
    identifier: [{ system: 'urn:mediforge:order', value: placerOrderNumber }],
    status: 'final',
    category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/v2-0074', 'LAB')] }],
    code: { coding: [coding('http://loinc.org', '11502-2', 'Laboratory report')] },
    subject: reference('Patient', patientId),
    effectiveDateTime: effectiveDateTime || new Date().toISOString(),
    result: (observations || []).map((o) => reference('Observation', o.id || o)),
    conclusion
  };
}

function buildMedicationRequest({ id, patientId, prescriptionNumber, medications, prescriberId, authoredOn }) {
  const med = (medications || [])[0] || {};
  return {
    resourceType: 'MedicationRequest',
    id: id || uuid(),
    meta: meta('http://infoway-inforoute.ca/fhir/StructureDefinition/medicationrequest-ca'),
    identifier: [{ system: 'urn:mediforge:prescription', value: prescriptionNumber }],
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [
        med.din ? coding('https://health-products.canada.ca/dpd/', med.din, med.name) : null,
        med.ccdd ? coding('http://terminology.hl7.org/CodeSystem/ca-hc-din', med.ccdd, med.name) : null
      ].filter(Boolean),
      text: med.name
    },
    subject: reference('Patient', patientId),
    authoredOn: authoredOn || new Date().toISOString(),
    requester: prescriberId ? reference('Practitioner', prescriberId) : undefined,
    dosageInstruction: (medications || []).map((m) => ({
      text: `${m.dosage || m.dose || ''} ${m.frequency || ''}`.trim(),
      route: m.route ? { text: m.route } : undefined
    }))
  };
}

function buildImagingStudy({ id, patientId, accessionNumber, modality, seriesInstanceUid, started }) {
  return {
    resourceType: 'ImagingStudy',
    id: id || uuid(),
    identifier: [{ system: 'urn:mediforge:accession', value: accessionNumber }],
    status: 'available',
    subject: reference('Patient', patientId),
    started: started || new Date().toISOString(),
    modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: modality || 'CT' }],
    series: seriesInstanceUid ? [{ uid: seriesInstanceUid }] : []
  };
}

function buildBundle(entries, type = 'transaction') {
  return {
    resourceType: 'Bundle',
    type,
    entry: entries.map((resource) => ({
      resource,
      request: type === 'transaction' ? { method: 'POST', url: resource.resourceType } : undefined
    }))
  };
}

module.exports = {
  buildPatient,
  buildServiceRequest,
  buildObservation,
  buildDiagnosticReport,
  buildMedicationRequest,
  buildImagingStudy,
  buildBundle,
  reference,
  coding
};
