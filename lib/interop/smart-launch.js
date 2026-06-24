'use strict';

/**
 * SMART-on-FHIR contextual launch URL builder (prep for embedded viewers).
 */
function buildSmartLaunchUrl({ patient, config, scope, launch }) {
  const fhirBase = config?.fhir?.baseUrl || 'REPLACE_WITH_FHIR_BASE';
  const clientId = config?.smart?.clientId || 'mediforge-emr';
  const redirect = config?.smart?.redirectUri || 'https://mediforge.netlify.app/smart-callback';
  const patientId = patient?.id || '';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirect,
    scope: scope || 'launch/patient openid fhirUser',
    aud: fhirBase,
    launch: launch || 'mediforge-chart',
    state: patientId
  });
  const authorize = config?.smart?.authorizeUrl || `${fhirBase.replace(/\/$/, '')}/authorize`;
  return {
    authorizeUrl: `${authorize}?${params.toString()}`,
    queued: fhirBase.startsWith('REPLACE_'),
    patientId
  };
}

module.exports = {
  buildSmartLaunchUrl
};
