'use strict';

/**
 * CCDD / Health Canada DPD (Drug Product Database) mapping for Canadian e-prescribing.
 */

const DEFAULT_DRUG_MAPPINGS = {
  'metformin': { din: '02229726', ccdd: '9000378', display: 'Metformin 500mg' },
  'amoxicillin': { din: '02242748', ccdd: '9000084', display: 'Amoxicillin 500mg' },
  'atorvastatin': { din: '02242469', ccdd: '9000312', display: 'Atorvastatin 20mg' },
  'lisinopril': { din: '02236975', ccdd: '9000421', display: 'Lisinopril 10mg' },
  'ramipril': { din: '02267670', ccdd: '9000510', display: 'Ramipril 10mg' },
  'omeprazole': { din: '02241463', ccdd: '9000622', display: 'Omeprazole 20mg' },
  'salbutamol': { din: '02246621', ccdd: '9000711', display: 'Salbutamol inhaler' }
};

function mapDrugToCcdd(drugName, configMappings = {}, din) {
  const mappings = { ...DEFAULT_DRUG_MAPPINGS, ...configMappings };
  const dinKey = String(din || '').replace(/\D/g, '').padStart(8, '0').slice(-8);
  if (dinKey && mappings[dinKey]) return mappings[dinKey];
  if (dinKey && typeof global !== 'undefined' && Array.isArray(global.CANADIAN_FORMULARY)) {
    const hit = global.CANADIAN_FORMULARY.find((r) => String(r.din || '').replace(/\D/g, '').padStart(8, '0') === dinKey);
    if (hit && hit.ccdd) {
      return { din: dinKey, ccdd: hit.ccdd, display: hit.ccddDisplay || hit.brand || drugName };
    }
  }
  const key = (drugName || '').toLowerCase().trim();
  if (mappings[key]) return mappings[key];

  for (const [k, v] of Object.entries(mappings)) {
    if (key.includes(k)) return v;
  }

  return { din: '', ccdd: '', display: drugName, unmapped: true };
}

function enrichMedications(medications, config) {
  const mappings = config?.terminology?.drugMappings || {};
  return (medications || []).map((med) => {
    const mapped = mapDrugToCcdd(med.name || med.drugName, mappings, med.din);
    return {
      ...med,
      din: med.din || mapped.din,
      ccdd: med.ccdd || mapped.ccdd,
      display: mapped.display || med.name
    };
  });
}

module.exports = { mapDrugToCcdd, enrichMedications, DEFAULT_DRUG_MAPPINGS };
