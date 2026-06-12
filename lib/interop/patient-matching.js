'use strict';

const PHN_SYSTEM_ON = 'http://ehealthontario.ca/fhir/NamingSystem/id-on-patient-hcn';

function normalizePhn(value) {
  if (!value) return '';
  return String(value).replace(/[\s-]/g, '').toUpperCase();
}

function scoreMatch(candidate, target) {
  const a = normalizePhn(candidate);
  const b = normalizePhn(target);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.endsWith(b) || b.endsWith(a)) return 80;
  return 0;
}

/**
 * Match patient using PHN and demographics (Canadian provincial health number)
 */
function normalizeDob(dob) {
  if (!dob) return '';
  return String(dob).replace(/-/g, '').slice(0, 8);
}

function matchPatient({ phn, firstName, lastName, dob, candidates, minScore = 100 }) {
  const results = (candidates || []).map((patient) => {
    let score = 0;
    const identifiers = patient.identifiers || patient.patient_identifiers || [];
    const phnId = identifiers.find(
      (id) => id.system === PHN_SYSTEM_ON || id.type === 'PHN' || id.type === 'JHN'
    );
    if (phnId && scoreMatch(phnId.value, phn) >= 100) score += 60;
    else if (patient.phn && scoreMatch(patient.phn, phn) >= 100) score += 60;

    if (lastName && patient.lastName && patient.lastName.toLowerCase() === lastName.toLowerCase()) score += 15;
    if (firstName && patient.firstName && patient.firstName.toLowerCase() === firstName.toLowerCase()) score += 15;
    if (dob && patient.dob && normalizeDob(patient.dob) === normalizeDob(dob)) score += 10;

    return { patient, score };
  });

  results.sort((a, b) => b.score - a.score);
  const best = results[0];
  if (!best || best.score < minScore) {
    return { matched: false, score: best?.score || 0, candidates: results.slice(0, 5) };
  }
  return { matched: true, patient: best.patient, score: best.score };
}

module.exports = { normalizePhn, matchPatient, PHN_SYSTEM_ON, scoreMatch };
