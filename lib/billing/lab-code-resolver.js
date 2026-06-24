'use strict';

const fs = require('fs');
const path = require('path');
const { getProvinceMap, getCodeSystemLabel } = require('./generate-lab-code-map');

let mapCache = null;

function loadLabCodeMap(configDir) {
  if (mapCache) return mapCache;
  const resolved = path.join(configDir || path.join(process.cwd(), 'config'), 'lab-code-map-canada.json');
  if (!fs.existsSync(resolved)) {
    mapCache = { provinces: {}, byCpt: {}, byPanelCpt: {}, imagingByCpt: {} };
    return mapCache;
  }
  mapCache = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return mapCache;
}

function clearLabCodeMapCache() {
  mapCache = null;
}

function normalizeMode(mode) {
  const m = String(mode || 'Canada').trim();
  if (m.toUpperCase() === 'USA' || m === 'US') return 'USA';
  return 'Canada';
}

function normalizeProvince(province) {
  const p = String(province || 'ON').trim().toUpperCase();
  if (['BC', 'AB', 'QC', 'ON'].includes(p)) return p;
  return 'ON';
}

function extractCptFromLabCode(code) {
  const raw = String(code || '').trim();
  const match = raw.match(/^LAB\s*-\s*(.+)$/i);
  if (!match) return null;
  const segment = match[1].trim();
  if (segment.includes('/')) return segment;
  if (/^\d{4,5}$/.test(segment)) return segment;
  return segment.split(/\s+/)[0] || null;
}

function normalizePanelCpt(cpt) {
  return String(cpt || '')
    .trim()
    .replace(/\s+/g, '')
    .split('/')
    .filter(Boolean)
    .join('/');
}

function lookupProvincialFeeCode({ cpt, labCode, name, map, province }) {
  const cfg = getProvinceMap(map, province);
  const panelKey = normalizePanelCpt(cpt);
  if (panelKey && cfg.byPanelCpt?.[panelKey]) return cfg.byPanelCpt[panelKey];
  if (labCode && cfg.byLabCode?.[labCode]) return cfg.byLabCode[labCode];
  if (name && cfg.byTestName) {
    const norm = String(name)
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (norm && cfg.byTestName[norm]) return cfg.byTestName[norm];
  }
  const primary = panelKey ? panelKey.split('/')[0] : String(cpt || '').trim();
  if (primary && cfg.byCpt?.[primary]) return cfg.byCpt[primary];
  return null;
}

/** @deprecated use lookupProvincialFeeCode */
function lookupOhipFeeCode(opts) {
  return lookupProvincialFeeCode(opts);
}

function resolveLabCode({
  code,
  name,
  cpt,
  ohipFeeCode,
  provincialFeeCode,
  billingMode,
  province,
  type = 'lab',
  map
}) {
  const mode = normalizeMode(billingMode);
  const prov = normalizeProvince(province);
  const labCode = code || (cpt ? `LAB - ${cpt}` : null);
  const resolvedCpt = cpt || extractCptFromLabCode(labCode) || extractCptFromLabCode(code);
  const panelCpt = resolvedCpt && String(resolvedCpt).includes('/') ? resolvedCpt : null;
  const codeSystem = getCodeSystemLabel(prov);
  const feeLabel = `Fee Code (${codeSystem})`;

  if (mode === 'USA') {
    const display = panelCpt || resolvedCpt || labCode || name || '';
    return {
      billingMode: 'USA',
      province: prov,
      internalCode: labCode || code,
      cpt: panelCpt || resolvedCpt,
      displayCode: display,
      claimFeeCode: panelCpt || resolvedCpt,
      codeSystem: type === 'imaging' ? 'CPT' : 'CPT',
      columnLabel: 'CPT Code',
      columnLabelPlural: type === 'imaging' ? 'CPT Code' : 'CPT Code(s)'
    };
  }

  const cfg = map || loadLabCodeMap();
  const provMap = getProvinceMap(cfg, prov);
  const fee =
    provincialFeeCode ||
    ohipFeeCode ||
    lookupProvincialFeeCode({ cpt: panelCpt || resolvedCpt, labCode, name, map: cfg, province: prov }) ||
    (type === 'imaging' && resolvedCpt ? provMap.imagingByCpt?.[String(resolvedCpt).split('/')[0]] : null);

  return {
    billingMode: 'Canada',
    province: prov,
    internalCode: labCode || code,
    cpt: panelCpt || resolvedCpt,
    ohipFeeCode: fee,
    provincialFeeCode: fee,
    displayCode: fee || panelCpt || resolvedCpt || labCode || ':',
    claimFeeCode: fee,
    cptReference: panelCpt || resolvedCpt,
    codeSystem: fee ? codeSystem : 'CPT (unmapped)',
    columnLabel: type === 'imaging' ? feeLabel : feeLabel,
    columnLabelPlural: type === 'imaging' ? feeLabel : `${feeLabel}(s)`,
    unmapped: !fee
  };
}

function enrichCatalogService(service, billingMode, map, province) {
  if (!service) return service;
  const isLab =
    String(service.category || '').toLowerCase() === 'laboratory' ||
    /^LAB\s*-/i.test(String(service.code || ''));
  if (!isLab) return service;
  const cpt = service.cpt || extractCptFromLabCode(service.code);
  const resolved = resolveLabCode({
    code: service.code,
    name: service.name,
    cpt,
    ohipFeeCode: service.ohipFeeCode,
    provincialFeeCode: service.provincialFeeCode,
    billingMode,
    province,
    map
  });
  return {
    ...service,
    cpt: cpt || service.cpt,
    ohipFeeCode: resolved.provincialFeeCode || service.ohipFeeCode || null,
    provincialFeeCode: resolved.provincialFeeCode || service.provincialFeeCode || null
  };
}

function enrichClaimServiceLine(line, billingMode, map, province) {
  const resolved = resolveLabCode({
    code: line.code || line.serviceCode,
    name: line.name || line.description,
    cpt: line.cpt || line.serviceCode,
    ohipFeeCode: line.ohipFeeCode || line.feeCode,
    billingMode,
    province: province || line.province,
    type: line.category === 'Imaging' ? 'imaging' : 'lab',
    map
  });
  if (normalizeMode(billingMode) === 'Canada' && resolved.claimFeeCode) {
    return {
      ...line,
      cpt: resolved.cpt,
      feeCode: resolved.claimFeeCode,
      ohipFeeCode: resolved.claimFeeCode,
      provincialFeeCode: resolved.claimFeeCode,
      serviceCode: resolved.claimFeeCode,
      billingCodeSystem: resolved.codeSystem,
      province: resolved.province,
      cptReference: resolved.cpt
    };
  }
  return {
    ...line,
    cpt: resolved.cpt || line.cpt,
    feeCode: resolved.claimFeeCode || line.feeCode,
    serviceCode: resolved.claimFeeCode || line.serviceCode || line.cpt,
    billingCodeSystem: 'CPT'
  };
}

module.exports = {
  loadLabCodeMap,
  clearLabCodeMapCache,
  extractCptFromLabCode,
  lookupOhipFeeCode,
  lookupProvincialFeeCode,
  resolveLabCode,
  enrichCatalogService,
  enrichClaimServiceLine,
  normalizeMode,
  normalizeProvince,
  getProvinceMap,
  getCodeSystemLabel
};
