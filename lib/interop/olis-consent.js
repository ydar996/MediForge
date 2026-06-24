'use strict';

const PHN_SYSTEM_ON = 'http://ehealthontario.ca/fhir/NamingSystem/id-on-patient-hcn';

/**
 * OLIS consent helpers. Live OLIS query still requires Infoway credentials.
 */
function isOlisConsentGranted(consents) {
  return (consents || []).some((c) => c.consent_type === 'olis_query' && c.granted === true);
}

function assertOlisConsent(consents, options = {}) {
  if (options.requireConsent === false) return { ok: true, skipped: true };
  if (isOlisConsentGranted(consents)) return { ok: true };
  return {
    ok: false,
    blocked: true,
    code: 'OLIS_CONSENT_REQUIRED',
    message: 'Patient OLIS lab query consent (olis_query) is required before provincial lab network actions.'
  };
}

module.exports = {
  PHN_SYSTEM_ON,
  isOlisConsentGranted,
  assertOlisConsent
};
