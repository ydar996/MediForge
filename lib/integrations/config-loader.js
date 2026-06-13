'use strict';

/**
 * Loads unified integration config: config/integrations.json merged with
 * per-province overlays from config/provinces/{code}.json and canada-provinces.json.
 *
 * Real-world: after OntarioMD / Infoway onboarding, set enabled:true and paste
 * production endpoints into the province file — never commit credentials.
 */
const fs = require('fs');
const path = require('path');

let cached = null;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function deepMerge(target, source) {
  const out = { ...target };
  Object.keys(source || {}).forEach((key) => {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  });
  return out;
}

function getConfigRoot() {
  return process.env.INTEGRATIONS_CONFIG_ROOT || path.join(process.cwd(), 'config');
}

function loadCanadaProvinces() {
  return readJson(path.join(getConfigRoot(), 'canada-provinces.json')) || { provinces: {} };
}

function loadIntegrationsConfig(options = {}) {
  if (cached && !options.reload) return cached;

  const root = getConfigRoot();
  const base = readJson(options.configPath || path.join(root, 'integrations.json')) || {};
  const provinceCode = (options.province || base.defaultProvince || base.province || 'ON').toUpperCase();
  const provinceFile = path.join(root, 'provinces', `${provinceCode.toLowerCase()}.json`);
  const provinceOverlay = readJson(provinceFile) || {};

  const registry = loadCanadaProvinces();
  const provinceMeta = registry.provinces?.[provinceCode] || {};

  cached = deepMerge(base, {
    province: provinceCode,
    provinceMeta,
    ...provinceOverlay
  });

  return cached;
}

function listProvinces() {
  const registry = loadCanadaProvinces();
  return Object.entries(registry.provinces || {}).map(([code, meta]) => ({
    code,
    name: meta.name,
    enabled: meta.enabled !== false,
    hubs: meta.hubs || {}
  }));
}

function clearIntegrationsConfigCache() {
  cached = null;
}

module.exports = {
  loadIntegrationsConfig,
  loadCanadaProvinces,
  listProvinces,
  clearIntegrationsConfigCache,
  deepMerge
};
