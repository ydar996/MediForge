'use strict';

/**
 * HRM (Hospital Report Manager) consent gates.
 */
function isHrmConsentGranted(consents) {
  return (consents || []).some((c) => c.consent_type === 'hrm_query' && c.granted === true);
}

function assertHrmConsent(consents, { requireConsent = true } = {}) {
  if (!requireConsent) return { ok: true };
  if (isHrmConsentGranted(consents)) return { ok: true };
  return {
    blocked: true,
    code: 'HRM_CONSENT_REQUIRED',
    message: 'Patient hrm_query consent required before filing hospital reports.'
  };
}

module.exports = { isHrmConsentGranted, assertHrmConsent };
