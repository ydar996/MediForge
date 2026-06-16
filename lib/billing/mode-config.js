'use strict';

const fs = require('fs');
const path = require('path');

const MODES = ['Canada', 'USA'];
const cache = {};

function normalizeMode(mode) {
  const m = String(mode || 'Canada').trim();
  if (m.toUpperCase() === 'USA' || m === 'US' || m === 'United States') return 'USA';
  return 'Canada';
}

function configFileForMode(mode) {
  return mode === 'USA' ? 'billing-usa.json' : 'billing-canada.json';
}

function loadModeConfig(mode, configDir) {
  const normalized = normalizeMode(mode);
  if (cache[normalized]) return cache[normalized];

  const dir = configDir || path.join(process.cwd(), 'config');
  const filePath = path.join(dir, configFileForMode(normalized));
  if (!fs.existsSync(filePath)) {
    throw new Error(`Billing config not found: ${filePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  parsed.billingMode = normalized;
  cache[normalized] = parsed;
  return parsed;
}

function clearModeConfigCache() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}

function resolveBillingModeFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return 'Canada';
  if (settings.system?.billingMode) return normalizeMode(settings.system.billingMode);
  if (settings.billingMode) return normalizeMode(settings.billingMode);
  return 'Canada';
}

module.exports = {
  MODES,
  normalizeMode,
  loadModeConfig,
  clearModeConfigCache,
  resolveBillingModeFromSettings,
  configFileForMode
};
