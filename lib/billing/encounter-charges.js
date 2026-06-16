'use strict';

const feeSchedule = require('./fee-schedule');

/**
 * Map clinical encounter → billable service lines (mode-aware).
 */
function extractDiagnosisCodes(encounter, config) {
  const codes = [];
  const push = (c) => {
    if (!c) return;
    const code = typeof c === 'string' ? c : c.code || c.icdCode;
    if (code) codes.push(String(code).trim().toUpperCase());
  };
  (encounter?.diagnoses || []).forEach(push);
  (encounter?.diagnosisCodes || []).forEach(push);
  if (encounter?.primaryDiagnosis) push(encounter.primaryDiagnosis);
  if (encounter?.icdCodes) encounter.icdCodes.forEach(push);
  return [...new Set(codes)];
}

function mapEncounterToCharges({ encounter, patient, config, provider }) {
  const mode = config?.billingMode || 'Canada';
  const province = patient?.province || patient?.state || 'ON';
  const scheduleKey =
    mode === 'USA'
      ? (patient?.medicare ? 'MEDICARE' : 'COMMERCIAL')
      : province;

  const feeCode = feeSchedule.resolveEncounterFeeCode({
    encounter,
    config,
    defaultCode: mode === 'USA' ? '99213' : 'A007A'
  });

  const feeEntry = feeSchedule.lookupFeeCode({
    code: feeCode,
    province,
    scheduleKey,
    config
  });

  const diagnosisCodes = extractDiagnosisCodes(encounter, config);
  const line = feeSchedule.buildServiceLineFromFee({
    feeEntry: feeEntry || {
      code: feeCode,
      description: encounter?.chiefComplaint || 'Clinical encounter',
      amount: encounter?.feeAmount || 0
    },
    units: encounter?.units || 1,
    diagnosisCodes,
    modifiers: encounter?.modifiers || []
  });

  return {
    encounterId: encounter?.id || encounter?.encounterId,
    encounterDate: encounter?.date || encounter?.visitDate || encounter?.encounter_date,
    billingMode: mode,
    billingModeAtCapture: mode,
    provider: provider || {},
    diagnosisCodes,
    serviceLines: line ? [line] : [],
    total: line?.total || 0
  };
}

module.exports = { extractDiagnosisCodes, mapEncounterToCharges };
