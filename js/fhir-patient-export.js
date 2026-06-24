'use strict';

/**
 * Browser FHIR R4 patient chart export.
 * Logic mirrors lib/interop/fhir/patient-chart-bundle.js for OntarioMD Phase 0.
 */
(function (global) {
  function ref(type, id) {
    return { reference: `${type}/${id}` };
  }

  function coding(system, code, display) {
    return { system, code, display: display || code };
  }

  function buildPatient(p) {
    const id = p.id || crypto.randomUUID();
    const identifiers = [];
    const phn = p.phn || p.healthCardNumber;
    if (phn) {
      identifiers.push({
        use: 'official',
        system: 'http://ehealthontario.ca/fhir/NamingSystem/id-on-patient-hcn',
        value: phn
      });
    }
    return {
      resourceType: 'Patient',
      id,
      meta: { profile: ['http://ehealthontario.ca/fhir/StructureDefinition/olis-patient'] },
      identifier: identifiers.length ? identifiers : [{ value: id }],
      name: [{ family: p.lastName, given: [p.firstName].filter(Boolean) }],
      birthDate: p.dob,
      gender: /^(m|male)$/i.test(p.gender || '') ? 'male' : /^(f|female)$/i.test(p.gender || '') ? 'female' : 'unknown',
      telecom: [p.phone && { system: 'phone', value: p.phone }, p.email && { system: 'email', value: p.email }].filter(Boolean),
      address: (p.addressLine1 || p.city) ? [{ line: [p.addressLine1].filter(Boolean), city: p.city, postalCode: p.postalCode, country: 'CA' }] : undefined
    };
  }

  function buildBundleFromPatient(patient) {
    const patientRes = buildPatient(patient);
    const pid = patientRes.id;
    const entries = [patientRes];

    (patient.diagnoses || []).forEach((dx, i) => {
      entries.push({
        resourceType: 'Condition',
        id: `cond-${i + 1}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        code: { text: dx.diagnosis || dx.description },
        subject: ref('Patient', pid)
      });
    });

    (patient.allergies || []).forEach((a, i) => {
      entries.push({
        resourceType: 'AllergyIntolerance',
        id: `allergy-${i + 1}`,
        code: { text: a.allergen || a.name },
        patient: ref('Patient', pid)
      });
    });

    (patient.medications || []).forEach((m, i) => {
      entries.push({
        resourceType: 'MedicationRequest',
        id: `med-${i + 1}`,
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: { text: m.name || m.drugName },
        subject: ref('Patient', pid)
      });
    });

    return {
      resourceType: 'Bundle',
      type: 'collection',
      meta: { lastUpdated: new Date().toISOString() },
      identifier: { system: 'urn:mediforge:export', value: `chart-${pid}-${Date.now()}` },
      entry: entries.map((resource) => ({ resource }))
    };
  }

  function findPatientById(patientId) {
    const keys = [];
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.org) keys.push(`${user.org}_patients`);
    } catch (_) { /* ignore */ }
    keys.push('patients');
    for (let i = 0; i < keys.length; i += 1) {
      const list = JSON.parse(localStorage.getItem(keys[i]) || '[]');
      const hit = list.find((p) => String(p.id) === String(patientId));
      if (hit) return hit;
    }
    return null;
  }

  function downloadJson(bundle, patientId) {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${patientId}-fhir-bundle-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportPatientFhirBundle(patientId) {
    const patient = findPatientById(patientId);
    if (!patient) {
      alert('Patient not found for FHIR export.');
      return null;
    }
    const bundle = buildBundleFromPatient(patient);
    downloadJson(bundle, patientId);
    if (typeof global.logAuditEvent === 'function') {
      global.logAuditEvent('patient_exported_fhir', { patient_id: patientId, resource_count: bundle.entry.length });
    }
    return bundle;
  }

  global.MediForgeFhirExport = {
    buildBundleFromPatient,
    exportPatientFhirBundle,
    findPatientById
  };
})(typeof window !== 'undefined' ? window : globalThis);
