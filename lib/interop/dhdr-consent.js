'use strict';

/**
 * DHDR (Digital Health Drug Repository) consent gates.
 */
function isDhdrConsentGranted(consents) {
  return (consents || []).some((c) => c.consent_type === 'dhdr_query' && c.granted === true);
}

function assertDhdrConsent(consents, { requireConsent = true } = {}) {
  if (!requireConsent) return { ok: true };
  if (isDhdrConsentGranted(consents)) return { ok: true };
  return {
    blocked: true,
    code: 'DHDR_CONSENT_REQUIRED',
    message: 'Patient dhdr_query consent required before provincial medication history query.'
  };
}

module.exports = { isDhdrConsentGranted, assertDhdrConsent };
