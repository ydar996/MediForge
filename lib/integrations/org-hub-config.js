'use strict';

const configLoader = require('./config-loader');

function provincialHubsToConfigOverlay(hubs) {
  if (!hubs || typeof hubs !== 'object') return {};
  const overlay = {};
  if (hubs.hrmFacilityId) {
    overlay.hrm = { facilityId: hubs.hrmFacilityId };
  }
  if (hubs.dhdrFhirBase) {
    overlay.dhdr = { fhirBaseUrl: hubs.dhdrFhirBase };
  }
  if (hubs.coViewerBase) {
    overlay.connectingOntario = { viewerBaseUrl: hubs.coViewerBase };
  }
  if (hubs.smartAuthorize || hubs.smartClientId) {
    overlay.smart = {};
    if (hubs.smartAuthorize) overlay.smart.authorizeUrl = hubs.smartAuthorize;
    if (hubs.smartClientId) overlay.smart.clientId = hubs.smartClientId;
  }
  return overlay;
}

async function loadOrgProvincialHubOverlay(supabase, organizationId) {
  if (!supabase || !organizationId) return {};
  const { data, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .maybeSingle();
  if (error || !data?.settings?.provincialHubs) return {};
  return provincialHubsToConfigOverlay(data.settings.provincialHubs);
}

function mergeOrgHubsIntoConfig(baseConfig, overlay) {
  if (!overlay || !Object.keys(overlay).length) return baseConfig;
  return configLoader.deepMerge(baseConfig, overlay);
}

module.exports = {
  provincialHubsToConfigOverlay,
  loadOrgProvincialHubOverlay,
  mergeOrgHubsIntoConfig
};
