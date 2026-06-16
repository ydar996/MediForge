'use strict';

const fs = require('fs');
const path = require('path');

const PROVINCE_REFS = {
  ON: 'ohip-cpt-crosswalk-reference.json',
  BC: 'msp-cpt-crosswalk-reference.json',
  AB: 'ahcip-cpt-crosswalk-reference.json',
  QC: 'ramq-cpt-crosswalk-reference.json'
};

const CODE_SYSTEM_LABELS = {
  ON: 'OHIP',
  BC: 'MSP',
  AB: 'AHCIP',
  QC: 'RAMQ'
};

function normalizeTestName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePanelCpt(cpt) {
  return String(cpt || '')
    .trim()
    .replace(/\s+/g, '')
    .split('/')
    .filter(Boolean)
    .join('/');
}

function extractCptFromLabCode(code) {
  const raw = String(code || '').trim();
  const match = raw.match(/^LAB\s*-\s*(.+)$/i);
  if (!match) return null;
  return match[1].trim();
}

function loadCrosswalkReference(configDir, province = 'ON') {
  const file = path.join(configDir, PROVINCE_REFS[province] || PROVINCE_REFS.ON);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing provincial crosswalk: ${file}. Run npm run build:provincial-lab-crosswalks`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extractLabServicesFromPricing(repoRoot) {
  const catalogPath = path.join(repoRoot, 'config', 'diagnostic-lab-catalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return (catalog.tests || []).map((t) => ({
      code: t.cpt && String(t.cpt).includes('/') ? `LAB - ${t.cpt}` : `LAB - ${t.cpt}`,
      name: t.name,
      category: t.category
    }));
  }
  const pricingPath = path.join(repoRoot, 'js', 'pricing.js');
  const src = fs.readFileSync(pricingPath, 'utf8');
  const block = src.match(/const labServices = \[([\s\S]*?)\n  \];/);
  if (!block) return [];
  const items = [];
  const re = /\{\s*code:\s*'([^']+)',\s*name:\s*'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(block[1]))) {
    items.push({ code: m[1], name: m[2].replace(/\\'/g, "'") });
  }
  return items;
}

function extractImagingFromPatients(repoRoot) {
  const catalogPath = path.join(repoRoot, 'config', 'diagnostic-imaging-catalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return (catalog.studies || []).map((t) => ({ name: t.name, cpt: t.cpt }));
  }
  const patientsPath = path.join(repoRoot, 'js', 'patients.js');
  const src = fs.readFileSync(patientsPath, 'utf8');
  const block = src.match(/const IMAGING_TESTS = (\[[\s\S]*?\]);/);
  if (!block) return [];
  try {
    // eslint-disable-next-line no-eval
    const arr = eval(block[1]);
    return Array.isArray(arr) ? arr.map((t) => ({ name: t.name, cpt: t.cpt })) : [];
  } catch {
    const items = [];
    const re = /'name':\s*'([^']+)',\s*'cpt':\s*'(\d+)'/g;
    let m;
    while ((m = re.exec(block[1]))) items.push({ name: m[1], cpt: m[2] });
    return items;
  }
}

function resolveFeeForItem({ cpt, labCode, name }, ref, maps) {
  const panelKey = cpt && String(cpt).includes('/') ? normalizePanelCpt(cpt) : null;
  if (panelKey && maps.byPanelCpt[panelKey]) return maps.byPanelCpt[panelKey];
  if (labCode && maps.byLabCode[labCode]) return maps.byLabCode[labCode];

  const normName = normalizeTestName(name);
  if (normName && ref.byTestName?.[normName]) return ref.byTestName[normName];

  const primary = panelKey ? panelKey.split('/')[0] : String(cpt || '').trim();
  if (primary && ref.byCpt?.[primary]) return ref.byCpt[primary];

  if (panelKey) {
    const panel = (ref.panels || []).find((p) => normalizePanelCpt(p.cpt) === panelKey);
    const fee = panel?.feeCode || panel?.ohip;
    if (fee) return fee;
  }

  return null;
}

function buildProvinceMap({ ref, province, labServices, imagingTests }) {
  const byCpt = { ...(ref.byCpt || {}) };
  const byPanelCpt = {};
  const byLabCode = {};
  const byTestName = { ...(ref.byTestName || {}) };
  const imagingByCpt = { ...(ref.imagingByCpt || {}) };
  const unmapped = [];

  for (const panel of ref.panels || []) {
    const key = normalizePanelCpt(panel.cpt);
    const fee = panel.feeCode || panel.ohip;
    if (key && fee) byPanelCpt[key] = fee;
  }

  for (const svc of labServices) {
    const cpt = extractCptFromLabCode(svc.code);
    const fee = resolveFeeForItem({ cpt, labCode: svc.code, name: svc.name }, ref, {
      byPanelCpt,
      byLabCode
    });

    if (fee) {
      byLabCode[svc.code] = fee;
      const normName = normalizeTestName(svc.name);
      if (normName) byTestName[normName] = fee;
      if (cpt && !String(cpt).includes('/')) byCpt[String(cpt).split('/')[0]] = fee;
      if (cpt && String(cpt).includes('/')) byPanelCpt[normalizePanelCpt(cpt)] = fee;
    } else {
      unmapped.push({ code: svc.code, name: svc.name, cpt, province });
    }
  }

  for (const img of imagingTests) {
    const cpt = String(img.cpt || '').trim();
    if (!cpt) continue;
    if (ref.imagingByCpt?.[cpt]) imagingByCpt[cpt] = ref.imagingByCpt[cpt];
    else unmapped.push({ code: `IMG-${cpt}`, name: img.name, cpt, type: 'imaging', province });
  }

  return {
    province,
    codeSystem: ref.codeSystem || CODE_SYSTEM_LABELS[province] || 'Provincial',
    payer: ref.payer || CODE_SYSTEM_LABELS[province],
    unmappedCount: unmapped.length,
    unmapped,
    byCpt,
    byPanelCpt,
    byLabCode,
    byTestName,
    imagingByCpt
  };
}

/**
 * Build lab-code-map-canada.json — multi-province (ON, BC, AB, QC).
 */
function buildLabCodeMapCanada({ repoRoot, configDir }) {
  const root = repoRoot || path.join(__dirname, '..', '..');
  const cfg = configDir || path.join(root, 'config');
  const labServices = extractLabServicesFromPricing(root);
  const imagingTests = extractImagingFromPatients(root);
  const provinces = {};
  let refVersion = '2026.06.3';
  let totalUnmapped = 0;

  for (const province of Object.keys(PROVINCE_REFS)) {
    const ref = loadCrosswalkReference(cfg, province);
    refVersion = ref.version || refVersion;
    const map = buildProvinceMap({ ref, province, labServices, imagingTests });
    provinces[province] = map;
    totalUnmapped += map.unmappedCount;
  }

  const on = provinces.ON;

  return {
    version: refVersion,
    defaultProvince: 'ON',
    generatedAt: new Date().toISOString(),
    generatorVersion: '2.0.0',
    autoGenerated: true,
    notes:
      'AUTO-GENERATED by npm run generate:lab-codes — multi-province ON/BC/AB/QC. Edit provincial-lab-fee-overrides.json then npm run build:provincial-lab-crosswalks',
    catalogLabCount: labServices.length,
    catalogImagingCount: imagingTests.length,
    unmappedCount: totalUnmapped,
    unmapped: Object.values(provinces).flatMap((p) => p.unmapped || []),
    provinces,
    // Legacy ON flat keys for backward compatibility
    province: 'ON',
    codeSystem: on.codeSystem,
    byCpt: on.byCpt,
    byPanelCpt: on.byPanelCpt,
    byLabCode: on.byLabCode,
    byTestName: on.byTestName,
    imagingByCpt: on.imagingByCpt
  };
}

function writeLabCodeMapCanada(options = {}) {
  const root = options.repoRoot || path.join(__dirname, '..', '..');
  const outPath = options.outPath || path.join(root, 'config', 'lab-code-map-canada.json');
  const map = buildLabCodeMapCanada({ repoRoot: root, configDir: options.configDir });
  fs.writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
  return { outPath, map };
}

function getProvinceMap(fullMap, province) {
  const p = String(province || 'ON').trim().toUpperCase();
  if (fullMap?.provinces?.[p]) return fullMap.provinces[p];
  return fullMap;
}

function getCodeSystemLabel(province) {
  return CODE_SYSTEM_LABELS[String(province || 'ON').toUpperCase()] || 'Provincial';
}

module.exports = {
  buildLabCodeMapCanada,
  writeLabCodeMapCanada,
  extractLabServicesFromPricing,
  extractImagingFromPatients,
  normalizeTestName,
  extractCptFromLabCode,
  getProvinceMap,
  getCodeSystemLabel,
  PROVINCE_REFS
};
