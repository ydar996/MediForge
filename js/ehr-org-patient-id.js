/**
 * Canonical MFA Staff Clinic org + default MRN prefix.
 * Load before supabase-patients.js, patients.js, and patient-id-normalizer.js.
 */
(function () {
  'use strict';

  window.EHR_MFASC_ORGANIZATION_ID = '94534e80-06a8-468f-b8a2-ece3f07697c4';
  window.EHR_MFASC_DEFAULT_PATIENT_ID_PREFIX = 'MFA-SC';

  window.ehrIsMfascOrganization = function (orgId) {
    return String(orgId || '') === window.EHR_MFASC_ORGANIZATION_ID;
  };

  /**
   * @param {string} organizationId
   * @param {{ name?: string, settings?: object } | null} orgRow
   * @param {{ orgFetchFailed?: boolean } | undefined} opts
   */
  window.ehrResolveDefaultPatientIdPrefix = function (organizationId, orgRow, opts) {
    const failed = opts && opts.orgFetchFailed;
    if (failed && window.ehrIsMfascOrganization(organizationId)) {
      return window.EHR_MFASC_DEFAULT_PATIENT_ID_PREFIX;
    }
    if (
      orgRow &&
      orgRow.settings &&
      typeof orgRow.settings.patient_id_prefix === 'string' &&
      orgRow.settings.patient_id_prefix.trim()
    ) {
      return orgRow.settings.patient_id_prefix.trim().toUpperCase();
    }
    if (window.ehrIsMfascOrganization(organizationId)) {
      return window.EHR_MFASC_DEFAULT_PATIENT_ID_PREFIX;
    }
    if (!orgRow || !orgRow.name) {
      return 'ORG';
    }
    return (orgRow.name || '').substring(0, 3).toUpperCase() || 'ORG';
  };

  window.ehrMaxPatientMrnNumericSuffix = function (patientRows) {
    var stemPatterns = [
      /^MIN([0-9]{4})$/i,
      /^MFA([0-9]{4})$/i,
      /^MFA-MC([0-9]{4})$/i,
      /^MFA-SC([0-9]{4})$/i
    ];
    var maxNumber = 0;
    (patientRows || []).forEach(function (row) {
      var pid = row && typeof row.patient_id === 'string' ? row.patient_id.trim() : '';
      if (!pid) return;
      var n = NaN;
      for (var i = 0; i < stemPatterns.length; i++) {
        var m = pid.match(stemPatterns[i]);
        if (m) {
          n = parseInt(m[1], 10);
          break;
        }
      }
      if (Number.isNaN(n)) {
        var tail = pid.match(/(\d{4})$/);
        if (tail) n = parseInt(tail[1], 10);
      }
      if (!Number.isNaN(n) && n > maxNumber) maxNumber = n;
    });
    return maxNumber;
  };

  window.ehrFormatPatientMrn = function (prefix, numeric) {
    return String(prefix) + String(numeric).padStart(4, '0');
  };

  /** Sync: best-effort prefix from localStorage org cache (MFASC always MFA-SC if no settings). */
  window.ehrCachedOrgPatientPrefix = function (organizationId) {
    if (!organizationId) return null;
    try {
      var user = JSON.parse(localStorage.getItem('user') || '{}');
      var orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      if (user.org && orgs[user.org] && orgs[user.org].id === organizationId) {
        return window.ehrResolveDefaultPatientIdPrefix(organizationId, orgs[user.org], {});
      }
      for (var k in orgs) {
        if (orgs[k] && orgs[k].id === organizationId) {
          return window.ehrResolveDefaultPatientIdPrefix(organizationId, orgs[k], {});
        }
      }
    } catch (e) { /* ignore */ }
    return window.ehrIsMfascOrganization(organizationId)
      ? window.EHR_MFASC_DEFAULT_PATIENT_ID_PREFIX
      : null;
  };
})();
