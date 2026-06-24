'use strict';

/**
 * PrescribeIT / national eRx consent helpers. Live transmit still requires Infoway credentials.
 */
function isErxConsentGranted(consents) {
  return (consents || []).some((c) => c.consent_type === 'prescribeit_erx' && c.granted === true);
}

function assertErxConsent(consents, options = {}) {
  if (options.requireConsent === false) return { ok: true, skipped: true };
  if (isErxConsentGranted(consents)) return { ok: true };
  return {
    ok: false,
    blocked: true,
    code: 'ERX_CONSENT_REQUIRED',
    message:
      'Patient PrescribeIT e-prescribing consent (prescribeit_erx) is required before provincial pharmacy network actions.'
  };
}

module.exports = {
  isErxConsentGranted,
  assertErxConsent
};
