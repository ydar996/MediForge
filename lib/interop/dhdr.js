'use strict';

/**
 * DHDR medication history query (software prep; live credentials required).
 */
function buildDhdrQueryUrl({ patient, config }) {
  const base = config?.dhdr?.fhirBaseUrl || 'REPLACE_WITH_DHDR_FHIR_BASE';
  const phn = patient?.phn || patient?.healthCardNumber || '';
  const params = new URLSearchParams({
    patient: phn,
    _format: 'json',
    _count: '50'
  });
  return {
    queryUrl: `${base.replace(/\/$/, '')}/MedicationStatement?${params.toString()}`,
    queued: base.startsWith('REPLACE_'),
    profile: 'dhdr-medication-statement-stub-v1'
  };
}

function parseMedicationStatementBundle(bundle) {
  const entries = bundle?.entry || [];
  return entries
    .map((e) => e.resource)
    .filter((r) => r?.resourceType === 'MedicationStatement')
    .map((r) => ({
      id: r.id,
      status: r.status,
      medication: r.medicationCodeableConcept?.text || r.medicationReference?.display || 'Unknown',
      effectiveDate: r.effectiveDateTime || r.effectivePeriod?.start,
      source: 'dhdr'
    }));
}

module.exports = {
  buildDhdrQueryUrl,
  parseMedicationStatementBundle
};
