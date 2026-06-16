'use strict';

/**
 * Fee schedule lookup for mode-specific provincial / CPT codes.
 */
function lookupFeeCode({ code, province, scheduleKey, config }) {
  if (!config?.feeSchedules) return null;
  const key = scheduleKey || province || 'ON';
  const schedule = config.feeSchedules[key] || config.feeSchedules.COMMERCIAL;
  if (!schedule?.codes) return null;
  const normalized = String(code || '').trim().toUpperCase();
  return schedule.codes.find((c) => String(c.code).toUpperCase() === normalized) || null;
}

function listFeeCodes({ province, scheduleKey, config, category }) {
  const key = scheduleKey || province || (config.billingMode === 'USA' ? 'COMMERCIAL' : 'ON');
  const schedule = config?.feeSchedules?.[key];
  if (!schedule?.codes) return [];
  if (!category) return schedule.codes;
  return schedule.codes.filter((c) => c.category === category);
}

function resolveEncounterFeeCode({ encounter, config, defaultCode }) {
  const mode = config?.billingMode || 'Canada';
  if (encounter?.feeCode || encounter?.procedureCode || encounter?.cpt) {
    return encounter.feeCode || encounter.procedureCode || encounter.cpt;
  }
  if (encounter?.visitType === 'specialist') {
    return mode === 'USA' ? '99214' : 'K005A';
  }
  if (defaultCode) return defaultCode;
  return mode === 'USA' ? '99213' : 'A007A';
}

function buildServiceLineFromFee({ feeEntry, units = 1, diagnosisCodes = [], modifiers = [] }) {
  if (!feeEntry) return null;
  const amount = parseFloat(feeEntry.amount) || 0;
  const code = String(feeEntry.code);
  return {
    serviceCode: code,
    feeCode: code,
    cpt: /^\d{5}$/.test(code) ? code : undefined,
    description: feeEntry.description,
    amount,
    price: amount,
    units,
    total: Math.round(amount * units * 100) / 100,
    diagnosisCodes,
    modifiers
  };
}

module.exports = {
  lookupFeeCode,
  listFeeCodes,
  resolveEncounterFeeCode,
  buildServiceLineFromFee
};
