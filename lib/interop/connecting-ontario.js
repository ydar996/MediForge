'use strict';

/**
 * ConnectingOntario / provincial DI viewer query hooks (software prep; live credentials required).
 */
function buildConnectingOntarioLaunchUrl({ patient, config, purpose }) {
  const base = config?.connectingOntario?.viewerBaseUrl || 'REPLACE_WITH_CONNECTINGONTARIO_VIEWER';
  const phn = patient?.phn || patient?.healthCardNumber || '';
  const params = new URLSearchParams({
    purpose: purpose || 'diagnostic-imaging',
    patientHcn: phn,
    emr: 'mediforge'
  });
  return {
    launchUrl: `${base}?${params.toString()}`,
    queued: base.startsWith('REPLACE_'),
    profile: 'connectingontario-viewer-stub-v1'
  };
}

function summarizeConnectingOntarioStatus(config) {
  const base = config?.connectingOntario?.viewerBaseUrl;
  return {
    configured: Boolean(base && !String(base).startsWith('REPLACE_')),
    viewerBaseUrl: base || null,
    mode: base && !String(base).startsWith('REPLACE_') ? 'ready' : 'stub'
  };
}

module.exports = {
  buildConnectingOntarioLaunchUrl,
  summarizeConnectingOntarioStatus
};
