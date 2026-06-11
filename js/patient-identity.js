/**
 * Patient identity — single API for chart safety.
 *
 * INVARIANTS (enforced by convention + CI check:patient-identity):
 * - `patients.id` (row UUID) is the only key for internal joins and matching.
 * - `patients.patient_id` / display values are for humans and URL query params; resolve via resolvePatientByIdentifier.
 * - Never use "has a hyphen" to distinguish UUID from display id; use isPatientRowUuid() only.
 *
 * Load order: after js/patients.js (needs resolvePatientByIdentifier, getPatientIdentifier, isUuidLike).
 */
(function (global) {
  'use strict';

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function isPatientRowUuid(s) {
    if (s == null || typeof s !== 'string') return false;
    var t = s.trim();
    if (global.isUuidLike && typeof global.isUuidLike === 'function') {
      return global.isUuidLike(t);
    }
    return UUID_RE.test(t);
  }

  /**
   * @param {string} input
   * @returns {Promise<string|null>} patients.id (UUID) or null
   */
  async function resolveToPatientRowUuid(input) {
    if (input == null) return null;
    var t = String(input).trim();
    if (!t) return null;
    if (isPatientRowUuid(t)) return t;
    if (typeof global.resolvePatientByIdentifier !== 'function') return null;
    try {
      var p = await global.resolvePatientByIdentifier(t);
      if (!p) return null;
      return p._supabaseUuid || (isPatientRowUuid(p.id) ? p.id : null);
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {string} rowUuid — patients.id
   * @returns {Promise<string|null>} non-UUID display id for URLs, or null
   */
  async function rowUuidToUrlDisplayId(rowUuid) {
    if (!rowUuid || !isPatientRowUuid(String(rowUuid))) return null;
    if (typeof global.resolvePatientByIdentifier !== 'function') return null;
    try {
      var p = await global.resolvePatientByIdentifier(rowUuid);
      if (!p) return null;
      if (global.getPatientIdentifier) {
        var d = global.getPatientIdentifier(p);
        if (d && !isPatientRowUuid(d)) return d;
      }
      if (p.patient_id && !isPatientRowUuid(p.patient_id)) return p.patient_id;
      return null;
    } catch (e) {
      return null;
    }
  }

  function encodeQueryValue(v) {
    return encodeURIComponent(v == null ? '' : String(v));
  }

  /** Reject empty, literal "null", and "undefined" from URL query values. */
  function sanitizeUrlPatientId(raw) {
    if (raw == null) return null;
    var t = String(raw).trim();
    if (!t || t === 'null' || t === 'undefined') return null;
    return t;
  }

  /**
   * Read patient id from URL query (patientId, patient_id, or id).
   * @param {URLSearchParams|string|undefined} searchOrParams
   * @returns {string|null}
   */
  function getPatientIdFromUrl(searchOrParams) {
    var params = searchOrParams;
    if (!params) {
      if (typeof window === 'undefined') return null;
      params = new URLSearchParams(window.location.search);
    } else if (typeof params === 'string') {
      params = new URLSearchParams(params);
    }
    var keys = ['patientId', 'patient_id', 'id'];
    for (var i = 0; i < keys.length; i++) {
      var v = sanitizeUrlPatientId(params.get(keys[i]));
      if (v) return v;
    }
    return null;
  }

  /** Canonicalize URL to patientId= when an alternate param was used. */
  function ensurePatientIdQueryParam() {
    if (typeof window === 'undefined') return null;
    var params = new URLSearchParams(window.location.search);
    var pid = getPatientIdFromUrl(params);
    if (!pid) return null;
    if (params.get('patientId') !== pid) {
      params.set('patientId', pid);
      var newUrl =
        window.location.pathname +
        (params.toString() ? '?' + params.toString() : '') +
        (window.location.hash || '');
      window.history.replaceState({}, '', newUrl);
    }
    return pid;
  }

  /**
   * Optional: same as resolveToPatientRowUuid for single-line tokens in name fields.
   * @param {string} token
   */
  async function resolveTokenBeforeNameLookup(token) {
    if (!token || /\s/.test(String(token))) return null;
    return resolveToPatientRowUuid(token);
  }

  /**
   * Delegates to window.reconcileFormPatientRowWithDisplayedName (patients.js) so all flows
   * share one implementation; safe if patients.js not loaded.
   */
  async function reconcileFormPatientRowWithDisplayedName(rowUuid, displayedFullName, options) {
    if (typeof global.reconcileFormPatientRowWithDisplayedName === 'function') {
      return await global.reconcileFormPatientRowWithDisplayedName(rowUuid, displayedFullName, options);
    }
    return rowUuid;
  }

  global.getPatientIdFromUrl = getPatientIdFromUrl;
  global.ensurePatientIdQueryParam = ensurePatientIdQueryParam;

  global.PatientIdentity = {
    isPatientRowUuid: isPatientRowUuid,
    resolveToPatientRowUuid: resolveToPatientRowUuid,
    rowUuidToUrlDisplayId: rowUuidToUrlDisplayId,
    encodeQueryValue: encodeQueryValue,
    sanitizeUrlPatientId: sanitizeUrlPatientId,
    getPatientIdFromUrl: getPatientIdFromUrl,
    ensurePatientIdQueryParam: ensurePatientIdQueryParam,
    resolveTokenBeforeNameLookup: resolveTokenBeforeNameLookup,
    reconcileFormPatientRowWithDisplayedName: reconcileFormPatientRowWithDisplayedName
  };
})(typeof window !== 'undefined' ? window : global);
