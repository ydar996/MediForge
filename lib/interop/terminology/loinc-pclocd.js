'use strict';

/**
 * LOINC + pCLOCD (Pan-Canadian LOINC Observation Code Database) mapping helpers.
 * Production deployments load full code tables from licensed pCLOCD files.
 */

const DEFAULT_LAB_MAPPINGS = {
  'FBS': { loinc: '1558-6', pclocd: '1558-6', display: 'Fasting glucose' },
  'FBG': { loinc: '1558-6', pclocd: '1558-6', display: 'Fasting blood glucose' },
  'HbA1c': { loinc: '4548-4', pclocd: '4548-4', display: 'Hemoglobin A1c' },
  'Glycated Hemoglobin': { loinc: '4548-4', pclocd: '4548-4', display: 'Hemoglobin A1c' },
  'CBC': { loinc: '58410-2', pclocd: '58410-2', display: 'Complete blood count panel' },
  'Creatinine': { loinc: '2160-0', pclocd: '2160-0', display: 'Creatinine' },
  'TSH': { loinc: '3016-3', pclocd: '3016-3', display: 'TSH' }
};

function mapTestToLoinc(testName, cpt, configMappings = {}) {
  const mappings = { ...DEFAULT_LAB_MAPPINGS, ...configMappings };
  const key = testName || '';
  if (mappings[key]) return mappings[key];
  if (cpt && mappings[cpt]) return mappings[cpt];

  const normalized = key.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [k, v] of Object.entries(mappings)) {
    if (k.toLowerCase() === normalized) return v;
  }

  return {
    loinc: '',
    pclocd: '',
    display: testName,
    cpt: cpt || '',
    unmapped: true
  };
}

function enrichLabItems(items, config) {
  const mappings = config?.terminology?.labMappings || {};
  return (items || []).map((item) => {
    const mapped = mapTestToLoinc(item.name || item.testName, item.cpt, mappings);
    return {
      ...item,
      loinc: mapped.loinc,
      pclocd: mapped.pclocd || mapped.loinc,
      display: mapped.display || item.name,
      universalServiceId: mapped.loinc
        ? `${mapped.loinc}^${mapped.display}^LN`
        : `${item.cpt || item.name}^${item.name}^CPT`
    };
  });
}

module.exports = { mapTestToLoinc, enrichLabItems, DEFAULT_LAB_MAPPINGS };
