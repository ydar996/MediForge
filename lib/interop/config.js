'use strict';

const fs = require('fs');
const path = require('path');

let cachedConfig = null;

function loadConfig(configPath) {
  if (cachedConfig) return cachedConfig;
  const resolved =
    configPath ||
    process.env.INTEROP_CONFIG_PATH ||
    path.join(process.cwd(), 'config', 'interoperability.json');

  if (!fs.existsSync(resolved)) {
    return getDefaultConfig();
  }

  cachedConfig = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return cachedConfig;
}

function getDefaultConfig() {
  return {
    version: '1.0',
    province: 'ON',
    enabled: false,
    hl7: {
      sendingApplication: 'MEDIFORGE',
      sendingFacility: 'CLINIC',
      version: '2.5',
      mllp: { host: '', port: 2575, useTls: true }
    },
    fhir: {
      baseUrl: '',
      oauth: { tokenUrl: '', clientId: '', clientSecret: '', scope: 'system/*.read system/*.write' }
    },
    dicomweb: { qidoRsRoot: '', wadoRsRoot: '', stowRsRoot: '', dimseGatewayUrl: '' },
    adapters: { lab: 'hl7', imaging: 'fhir', rx: 'fhir' },
    terminology: { labCodeSystem: 'http://loinc.org', drugCodeSystem: 'https://health-products.canada.ca/dpd/' },
    patientMatching: { primaryIdentifier: 'PHN', province: 'ON' },
    security: { requireConsent: true, auditAllMessages: true, maxRetries: 3 }
  };
}

function getAdapterConfig(config, adapterName) {
  const cfg = config || loadConfig();
  return cfg.adapters?.[adapterName] || cfg.adapters?.[`${adapterName}Endpoint`] || null;
}

function clearConfigCache() {
  cachedConfig = null;
}

module.exports = { loadConfig, getDefaultConfig, getAdapterConfig, clearConfigCache };
