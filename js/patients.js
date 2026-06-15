// Purpose: Manages all patient-related actions: loading list, searching, adding, editing, deleting, viewing details, adding visits.
// Version: 3.0 - COMPLETE REWRITE: Fixed Supabase-first loading to resolve DOB display issue permanently
// CRITICAL FIX: Removed all merge logic that was overriding Supabase data with localStorage data

// Reduce console noise and avoid logging sensitive data unless debugging is enabled.
const __patientsDebugEnabled = !!window.__DEBUG_LOGS;
const console = __patientsDebugEnabled
  ? window.console
  : { log: () => {}, warn: () => {}, error: window.console.error.bind(window.console) };

// Helper function to get organization-specific localStorage key
function getDataKey(key) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user && user.org ? `${user.org}_${key}` : key;
}

// Expose getDataKey globally
window.getDataKey = getDataKey;

// Helper: true if string looks like a UUID (never return these to user)
function isUuidLike(s) {
  return s && typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}
window.isUuidLike = isUuidLike;

// Helper function to get user-friendly patient ID (patient_id or patientNumber) for URLs
// Returns the user-friendly ID (e.g., MEC006, MFA-MC0001) instead of UUID
// LEGACY SYSTEM SUPPORT: In legacy system, id field IS the display ID (MEC0013 format)
window.getPatientIdentifier = function getPatientIdentifier(patient) {
  if (!patient) return null;
  
  // CRITICAL: NEVER return a UUID - always return legacy ID or null
  
  // Prefer patient_id, patientNumber, then id - but reject any that look like UUIDs
  if (patient.patient_id && !isUuidLike(patient.patient_id) && patient.patient_id !== 'Unknown ID') {
    return patient.patient_id; // Supports MFA0001, MFA-MC0001, MEC0016, etc.
  }
  if (patient.patientNumber && !isUuidLike(patient.patientNumber) && patient.patientNumber !== 'Unknown ID') {
    return patient.patientNumber;
  }
  if (patient.id && !isUuidLike(patient.id) && patient.id !== 'Unknown ID') {
    return patient.id; // Legacy: id is display ID (MEC0013, MFA-MC0001, etc.)
  }
  
  return null;
}

/** Legacy MIN#### MRNs must never drive user-facing labels when MFA-MC is canonical (CSV / Supabase). */
window.isLegacyMinPatientMrn = function isLegacyMinPatientMrn(s) {
  if (!s || typeof s !== 'string') return false;
  return /^MIN[0-9]{4}$/i.test(s.trim());
};

/** Plain MFA#### (four digits only after MFA) — superseded by MFA-SC#### for MFASC canonical orgs */
window.isPlainMfaFourDigitMrn = function isPlainMfaFourDigitMrn(s) {
  if (!s || typeof s !== 'string') return false;
  return /^MFA[0-9]{4}$/i.test(s.trim());
};

/** Cached org prefix from organizations JSON / localStorage (sync). */
window.getStoredOrgPatientIdPrefix = function getStoredOrgPatientIdPrefix() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const oid = u.organizationId || u.organization_id;
    const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (u.org && orgs[u.org] && orgs[u.org].settings && orgs[u.org].settings.patient_id_prefix) {
      return String(orgs[u.org].settings.patient_id_prefix).trim();
    }
    for (const k of Object.keys(orgs || {})) {
      const e = orgs[k];
      if (e && oid && e.id === oid && e.settings && e.settings.patient_id_prefix) {
        return String(e.settings.patient_id_prefix).trim();
      }
    }
    const orgName = (u.org || '').toLowerCase();
    if (orgName.includes('mobile clinic') && orgName.includes('foreign')) return 'MFA-MC';
    if (orgName.includes('staff') && orgName.includes('foreign')) return 'MFA-SC';
  } catch (e) {}
  return '';
};

/**
 * When settings.patient_id_prefix is MFA-SC or MFA-MC, map MIN/MFA legacy ids to the org canonical form for UI.
 */
window.normalizePatientMrnForUi = function normalizePatientMrnForUi(pid) {
  if (!pid || typeof pid !== 'string') return '';
  const s = pid.trim();
  const canonical =
    typeof window.getStoredOrgPatientIdPrefix === 'function'
      ? window.getStoredOrgPatientIdPrefix()
      : '';
  const canon = canonical ? canonical.trim().toUpperCase() : '';

  if (canon === 'MFA-MC') {
    let m = s.match(/^MIN([0-9]{4})$/i);
    if (m) return 'MFA-MC' + m[1];
    m = s.match(/^MFA([0-9]{4})$/i);
    if (m) return 'MFA-MC' + m[1];
    if (/^MFA-MC([0-9]{4})$/i.test(s)) {
      const n = s.match(/^MFA-MC([0-9]{4})$/i);
      return n ? 'MFA-MC' + n[1] : s;
    }
    return s;
  }

  if (canon === 'MFA-SC') {
    let m = s.match(/^MIN([0-9]{4})$/i);
    if (m) return 'MFA-SC' + m[1];
    m = s.match(/^MFA([0-9]{4})$/i);
    if (m) return 'MFA-SC' + m[1];
    m = s.match(/^MFA-MC([0-9]{4})$/i);
    if (m) return 'MFA-SC' + m[1];
    if (/^MFA-SC([0-9]{4})$/i.test(s)) {
      const n = s.match(/^MFA-SC([0-9]{4})$/i);
      return n ? 'MFA-SC' + n[1] : s;
    }
    return s;
  }

  return s;
};

window.isCanonicalMfaMcOrg = function isCanonicalMfaMcOrg() {
  const p =
    typeof window.getStoredOrgPatientIdPrefix === 'function'
      ? window.getStoredOrgPatientIdPrefix()
      : '';
  return !!p && /^MFA-MC$/i.test(p.trim());
};

window.isCanonicalMfaScOrg = function isCanonicalMfaScOrg() {
  const p =
    typeof window.getStoredOrgPatientIdPrefix === 'function'
      ? window.getStoredOrgPatientIdPrefix()
      : '';
  return !!p && /^MFA-SC$/i.test(p.trim());
};

/**
 * Patient-facing display MRN: MFA-SC org maps MIN/MFA/MFA-MC → MFA-SC####; otherwise MFA-MC URL hints apply.
 */
window.getPatientIdForDisplay = function getPatientIdForDisplay(patient, urlIdentifier) {
  if (!patient) return '';
  let u = urlIdentifier != null ? String(urlIdentifier).trim() : '';
  try {
    if (!u && typeof window !== 'undefined' && window.location && window.location.search) {
      const sp = new URLSearchParams(window.location.search);
      u = (sp.get('id') || sp.get('patientId') || '').trim();
    }
  } catch (e) {}

  const canonSc =
    typeof window.isCanonicalMfaScOrg === 'function' && window.isCanonicalMfaScOrg();
  const canonMc =
    typeof window.isCanonicalMfaMcOrg === 'function' && window.isCanonicalMfaMcOrg();

  const tryCanonicalMap = (raw, pattern) => {
    if (!raw || isUuidLike(raw) || typeof window.normalizePatientMrnForUi !== 'function') return '';
    const mapped = window.normalizePatientMrnForUi(raw);
    return mapped && pattern.test(mapped) ? mapped : '';
  };

  if (canonMc && typeof window.normalizePatientMrnForUi === 'function') {
    const fromUrl = tryCanonicalMap(u, /^MFA-MC[0-9]{4}$/i);
    if (fromUrl) return fromUrl;
    let cand =
      typeof window.getPatientIdentifier === 'function' ? window.getPatientIdentifier(patient) : null;
    const fromCand = tryCanonicalMap(cand, /^MFA-MC[0-9]{4}$/i);
    if (fromCand) return fromCand;
    const pid =
      patient.patient_id && typeof patient.patient_id === 'string'
        ? patient.patient_id.trim()
        : '';
    const fromPid = tryCanonicalMap(pid, /^MFA-MC[0-9]{4}$/i);
    if (fromPid) return fromPid;
    const pn =
      patient.patientNumber && typeof patient.patientNumber === 'string'
        ? patient.patientNumber.trim()
        : '';
    const fromPn = tryCanonicalMap(pn, /^MFA-MC[0-9]{4}$/i);
    if (fromPn) return fromPn;
    const legacyId =
      patient.id && typeof patient.id === 'string' ? patient.id.trim() : '';
    const fromLegacy = tryCanonicalMap(legacyId, /^MFA-MC[0-9]{4}$/i);
    if (fromLegacy) return fromLegacy;
    return '';
  }

  if (canonSc && typeof window.normalizePatientMrnForUi === 'function') {
    if (u && !isUuidLike(u)) {
      const nu = window.normalizePatientMrnForUi(u);
      if (nu && /^MFA-SC[0-9]{4}$/i.test(nu)) return nu;
    }
    let cand =
      typeof window.getPatientIdentifier === 'function' ? window.getPatientIdentifier(patient) : null;
    if (cand && cand !== 'Unknown ID') {
      const nc = window.normalizePatientMrnForUi(cand);
      if (nc && /^MFA-SC[0-9]{4}$/i.test(nc)) return nc;
    }
    const pid =
      patient.patient_id && typeof patient.patient_id === 'string'
        ? patient.patient_id.trim()
        : '';
    if (pid && !isUuidLike(pid)) {
      const np = window.normalizePatientMrnForUi(pid);
      if (np && /^MFA-SC[0-9]{4}$/i.test(np)) return np;
    }
    const pn =
      patient.patientNumber && typeof patient.patientNumber === 'string'
        ? patient.patientNumber.trim()
        : '';
    if (pn && !isUuidLike(pn)) {
      const nn = window.normalizePatientMrnForUi(pn);
      if (nn && /^MFA-SC[0-9]{4}$/i.test(nn)) return nn;
    }
    const legacyId =
      patient.id && typeof patient.id === 'string' ? patient.id.trim() : '';
    if (legacyId && !isUuidLike(legacyId)) {
      const nl = window.normalizePatientMrnForUi(legacyId);
      if (nl && /^MFA-SC[0-9]{4}$/i.test(nl)) return nl;
    }
    return '';
  }

  if (u && !window.isLegacyMinPatientMrn(u)) {
    if (/^MFA-MC/i.test(u)) return u;
    if (/^MFA[0-9]{4}$/i.test(u)) return u;
  }

  let cand =
    typeof window.getPatientIdentifier === 'function' ? window.getPatientIdentifier(patient) : null;
  if (cand && !window.isLegacyMinPatientMrn(cand) && cand !== 'Unknown ID') return cand;

  const pid =
    patient.patient_id && typeof patient.patient_id === 'string'
      ? patient.patient_id.trim()
      : '';
  if (pid && !window.isLegacyMinPatientMrn(pid) && !isUuidLike(pid)) return pid;

  const pn =
    patient.patientNumber && typeof patient.patientNumber === 'string'
      ? patient.patientNumber.trim()
      : '';
  if (pn && !window.isLegacyMinPatientMrn(pn) && !isUuidLike(pn)) return pn;

  const legacyId =
    patient.id && typeof patient.id === 'string' ? patient.id.trim() : '';
  if (legacyId && !isUuidLike(legacyId) && !window.isLegacyMinPatientMrn(legacyId)) return legacyId;

  if (typeof window.normalizePatientMrnForUi === 'function') {
    const trySources = [u, cand, pid, pn, legacyId].filter((x) => x && !isUuidLike(x));
    for (let i = 0; i < trySources.length; i++) {
      const mapped = window.normalizePatientMrnForUi(trySources[i]);
      if (mapped && !window.isLegacyMinPatientMrn(mapped)) return mapped;
    }
  }

  return '';
};

/** Always safe for HTML: never shows legacy MIN#### (uses em dash when unknown). */
window.patientMrnForUi = function patientMrnForUi(patient, urlIdentifier) {
  const v =
    typeof window.getPatientIdForDisplay === 'function'
      ? window.getPatientIdForDisplay(patient, urlIdentifier)
      : '';
  return v || '—';
};

/** Read patient id token from current page URL (for display mapping). */
window.getUrlPatientIdHint = function getUrlPatientIdHint() {
  if (typeof window.getPatientIdFromUrl === 'function') {
    const fromHelper = window.getPatientIdFromUrl();
    if (fromHelper) return fromHelper;
  }
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const sp = new URLSearchParams(window.location.search);
      const keys = ['patientId', 'patient_id', 'id'];
      for (let i = 0; i < keys.length; i++) {
        const v = sp.get(keys[i]);
        if (v && String(v).trim() && String(v).trim() !== 'null') return String(v).trim();
      }
    }
  } catch (e) {}
  return '';
};

/** Canonical UI label for patient MRN everywhere in the app. */
window.displayPatientMrn = function displayPatientMrn(patientOrString, urlHint) {
  return typeof window.patientMrnDisplay === 'function'
    ? window.patientMrnDisplay(patientOrString, urlHint)
    : '—';
};

/**
 * Sweep helper: patient object → patientMrnForUi; plain string → org-canonical map or suppress raw MIN.
 */
window.patientMrnDisplay = function patientMrnDisplay(patientOrString, urlHint) {
  let hint = urlHint;
  if (hint == null || String(hint).trim() === '') {
    hint =
      typeof window.getUrlPatientIdHint === 'function' ? window.getUrlPatientIdHint() : '';
  }
  if (patientOrString != null && typeof patientOrString === 'object') {
    return typeof window.patientMrnForUi === 'function'
      ? window.patientMrnForUi(patientOrString, hint)
      : '—';
  }
  const s = patientOrString == null ? '' : String(patientOrString).trim();
  if (!s) {
    if (hint && typeof window.normalizePatientMrnForUi === 'function') {
      const fromHint = window.normalizePatientMrnForUi(hint);
      if (fromHint && !window.isLegacyMinPatientMrn(fromHint)) return fromHint;
    }
    return '—';
  }
  if (typeof window.normalizePatientMrnForUi === 'function') {
    const mapped = window.normalizePatientMrnForUi(s);
    if (mapped && mapped !== s && !window.isLegacyMinPatientMrn(mapped)) return mapped;
  }
  if (
    typeof window.isCanonicalMfaScOrg === 'function' &&
    window.isCanonicalMfaScOrg() &&
    typeof window.normalizePatientMrnForUi === 'function'
  ) {
    const n = window.normalizePatientMrnForUi(s);
    if (n && /^MFA-SC[0-9]{4}$/i.test(n)) return n;
  }
  if (
    typeof window.isCanonicalMfaMcOrg === 'function' &&
    window.isCanonicalMfaMcOrg() &&
    typeof window.normalizePatientMrnForUi === 'function'
  ) {
    const n = window.normalizePatientMrnForUi(s);
    if (n && /^MFA-MC[0-9]{4}$/i.test(n)) return n;
  }
  if (
    typeof window.isLegacyMinPatientMrn === 'function' &&
    window.isLegacyMinPatientMrn(s)
  ) {
    if (typeof window.normalizePatientMrnForUi === 'function') {
      const mapped = window.normalizePatientMrnForUi(s);
      if (mapped && !window.isLegacyMinPatientMrn(mapped)) return mapped;
    }
    if (hint && hint !== s && typeof window.normalizePatientMrnForUi === 'function') {
      const fromHint = window.normalizePatientMrnForUi(hint);
      if (fromHint && !window.isLegacyMinPatientMrn(fromHint)) return fromHint;
    }
    return '—';
  }
  if (
    typeof window.isPlainMfaFourDigitMrn === 'function' &&
    window.isPlainMfaFourDigitMrn(s) &&
    typeof window.isCanonicalMfaScOrg === 'function' &&
    window.isCanonicalMfaScOrg()
  ) {
    return '—';
  }
  return s;
};

function patientRowUuidForDisplay(p) {
  if (!p) return null;
  if (p._supabaseUuid) return p._supabaseUuid;
  if (p.id && isUuidLike(p.id)) return p.id;
  return null;
}

/**
 * For orgs with patient_id_prefix / patient_id_previous_prefix (e.g. MIN#### → MFA-MC####),
 * prefer the new display form when: no patient row uses the mapped id yet, or the mapped id
 * resolves to this same person. If the mapped id belongs to another patient, return null
 * and keep the real id from the record (e.g. MIN) — avoids label collision.
 */
window.chooseDisplayPatientIdForMigratedOrg = async function chooseDisplayPatientIdForMigratedOrg(patient) {
  if (!patient || !window.supabaseClient) return null;
  const base = window.getPatientIdentifier(patient) || patient.patient_id || patient.patientNumber;
  if (!base || isUuidLike(base)) return null;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  let orgId = user.organizationId || user.organization_id;
  if (!orgId && user.org) {
    const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
    orgId = orgs[user.org] && orgs[user.org].id;
  }
  if (!orgId) return null;
  try {
    const { data: orgRow } = await window.supabaseClient
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .maybeSingle();
    const prev = orgRow && orgRow.settings && orgRow.settings.patient_id_previous_prefix;
    const newPrefix = orgRow && orgRow.settings && orgRow.settings.patient_id_prefix;
    if (!prev || !newPrefix) return null;
    const esc = String(prev).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = String(base).match(new RegExp('^' + esc + '([0-9]{4})$', 'i'));
    if (!m) return null;
    const mapped = String(newPrefix).trim() + m[1];
    const selfUuid = patientRowUuidForDisplay(patient);
    if (typeof window.resolvePatientByIdentifier !== 'function') return null;
    const atMapped = await window.resolvePatientByIdentifier(mapped);
    if (!atMapped) {
      return mapped;
    }
    const atUuid = patientRowUuidForDisplay(atMapped);
    if (selfUuid && atUuid && selfUuid === atUuid) {
      return mapped;
    }
    return null;
  } catch (e) {
    console.warn('chooseDisplayPatientIdForMigratedOrg:', e);
    return null;
  }
};

/** Merge pre-EMR / unstructured records by id (remote overwrites local fields for same id). */
function mergeUnstructuredRecordsById(localRecords, remoteRecords) {
  const map = new Map();
  const add = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((r) => {
      if (!r || !r.id) return;
      map.set(r.id, { ...(map.get(r.id) || {}), ...r });
    });
  };
  add(localRecords);
  add(remoteRecords);
  return Array.from(map.values());
}

// Helper function to resolve patient identifier (UUID or patient ID) to patient object
// This allows URLs to work with either UUIDs (backward compatibility) or patient IDs
window.resolvePatientByIdentifier = async function(identifier) {
  if (!identifier) {
    console.warn('resolvePatientByIdentifier: No identifier provided');
    return null;
  }

  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn : () => {};

  // Do NOT rewrite MIN#### -> MFA-MC#### before lookup. That string concat can point at a
  // different person (same 4 digits, new scheme) and skip the real patient_id=MIN#### row.
  // Migration fallback: only after a failed Supabase query on the exact id (see below).

  debugLog('🔍 resolvePatientByIdentifier: Looking for patient with identifier:', identifier);

  // Try to load patients with Supabase-first priority
  let patients = [];
  if (typeof window.loadPatientsWithSupabasePriority === 'function') {
    try {
      patients = await window.loadPatientsWithSupabasePriority();
      debugLog(`🔍 resolvePatientByIdentifier: Loaded ${patients.length} patients from Supabase-first loader`);
    } catch (error) {
      debugWarn('Error loading patients with Supabase priority:', error);
      // Fallback: get patients from localStorage with organization-specific key
      const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                             typeof getDataKey === 'function' ? getDataKey :
                             (key) => {
                               const user = JSON.parse(localStorage.getItem("user") || "{}");
                               return user && user.org ? `${user.org}_${key}` : key;
                             };
      patients = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
      debugLog(`🔍 resolvePatientByIdentifier: Fallback - loaded ${patients.length} patients from localStorage`);
    }
  } else {
    // Fallback: get patients from localStorage with organization-specific key
    const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                           typeof getDataKey === 'function' ? getDataKey :
                           (key) => {
                             const user = JSON.parse(localStorage.getItem("user") || "{}");
                             return user && user.org ? `${user.org}_${key}` : key;
                           };
    patients = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
    debugLog(`🔍 resolvePatientByIdentifier: Loaded ${patients.length} patients from localStorage (no loader available)`);
  }
  
  // First, try to find by UUID (check both id and _supabaseUuid fields)
  // In localStorage, id might be display ID, but _supabaseUuid contains the actual UUID
  let patient = patients.find(p => 
    p.id === identifier || 
    p._supabaseUuid === identifier
  );
  
  // CRITICAL FIX: If patient found in localStorage but has UUID as id and no patient_id,
  // we still need to query Supabase to get the patient_id (which might have been generated)
  // Only return early if patient has a valid legacy ID
  if (patient) {
    const rawPid = String(patient.patient_id || patient.patientNumber || '').trim();
    const hasStaleMin =
      typeof window.isLegacyMinPatientMrn === 'function' &&
      window.isLegacyMinPatientMrn(rawPid);
    const hasValidLegacyId =
      patient.patient_id &&
      !isUuidLike(patient.patient_id) &&
      patient.patient_id !== 'Unknown ID';
    const hasValidId =
      patient.id &&
      !isUuidLike(patient.id) &&
      patient.id !== 'Unknown ID';

    if (!hasStaleMin && (hasValidLegacyId || hasValidId)) {
      debugLog(
        '✅ resolvePatientByIdentifier: Found patient in localStorage with valid legacy ID:',
        patient.patient_id || patient.id
      );
      return patient;
    }
    debugWarn(
      hasStaleMin
        ? '⚠️ resolvePatientByIdentifier: Local patient_id is legacy MIN — refreshing from Supabase...'
        : '⚠️ resolvePatientByIdentifier: Found patient in localStorage but missing valid legacy ID. Querying Supabase to get patient_id...'
    );
    patient = null;
  }
  
  // If not found by UUID, try to find by patient_id or patientNumber
  patient = patients.find(p => 
    p.patient_id === identifier || 
    p.patientNumber === identifier
  );
  
  // FALLBACK: For MFA-MC9810 / MFA-SC9810, try MIN9810 in case local cache has pre-migration data
  if (!patient && identifier.match(/^MFA-MC([0-9]{4})$/i)) {
    const oldId = 'MIN' + identifier.match(/^MFA-MC([0-9]{4})$/i)[1];
    patient = patients.find(p => p.patient_id === oldId || p.patientNumber === oldId);
    if (patient) debugLog('✅ resolvePatientByIdentifier: Found by legacy MIN in local array:', oldId);
  }
  if (!patient && identifier.match(/^MFA-SC([0-9]{4})$/i)) {
    const oldId = 'MIN' + identifier.match(/^MFA-SC([0-9]{4})$/i)[1];
    patient = patients.find(p => p.patient_id === oldId || p.patientNumber === oldId);
    if (patient) debugLog('✅ resolvePatientByIdentifier: Found by legacy MIN in local array (MFA-SC):', oldId);
  }
  
  if (patient) {
    if (
      identifier &&
      /^MFA-MC/i.test(String(identifier).trim()) &&
      typeof window.isLegacyMinPatientMrn === 'function' &&
      window.isLegacyMinPatientMrn(patient.patient_id || patient.patientNumber)
    ) {
      const canon = String(identifier).trim();
      patient.patient_id = canon;
      if (!patient.patientNumber || window.isLegacyMinPatientMrn(patient.patientNumber)) {
        patient.patientNumber = canon;
      }
      if (!patient.id || patient.id.includes('-')) patient.id = canon;
      debugLog(
        '✅ resolvePatientByIdentifier: Overrode stale MIN cache with URL MFA-MC:',
        canon
      );
    }
    debugLog(
      '✅ resolvePatientByIdentifier: Found patient by patient_id/patientNumber:',
      patient.patient_id || patient.patientNumber
    );
    return patient;
  }

  debugWarn('⚠️ resolvePatientByIdentifier: Patient not found in local array, trying Supabase query...');
  debugLog('🔍 resolvePatientByIdentifier: Identifier type check - is UUID:', identifier.includes('-') && identifier.length === 36);
  
  // Try Supabase query if we have a client
  if (!patient && window.supabaseClient) {
    try {
      let orgId = null;
      if (typeof window.resolveOrganizationId === 'function') {
        orgId = await window.resolveOrganizationId();
      } else {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        orgId = user.organizationId || user.organization_id;
        if (!orgId && user.org) {
          const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgData = organizations[user.org];
          if (orgData && orgData.id) {
            orgId = orgData.id;
            debugLog('🔍 resolvePatientByIdentifier: Found orgId from organizations:', orgId);
          }
        }
      }
      
      debugLog('🔍 resolvePatientByIdentifier: Querying Supabase with orgId:', orgId);
      
      if (!orgId) {
        console.error('❌ resolvePatientByIdentifier: No orgId found! Cannot query Supabase.');
        return null;
      }
      
      // Try querying by UUID (id column) first if identifier looks like a UUID
      let supabasePatient = null;
      let error = null;
      
      if (identifier.includes('-') && identifier.length === 36) {
        debugLog('🔍 resolvePatientByIdentifier: Trying UUID query on id column');
        const result = await window.supabaseClient
          .from('patients')
          .select('*')
          .eq('id', identifier)
          .eq('organization_id', orgId)
          .maybeSingle();
        supabasePatient = result.data;
        error = result.error;
        
        if (error) {
          debugWarn('⚠️ resolvePatientByIdentifier: UUID query on id column failed:', error.message);
        } else if (supabasePatient) {
          debugLog('✅ resolvePatientByIdentifier: Found patient by UUID (id column):', supabasePatient.patient_id || supabasePatient.id);
        }
      }
      
      // If UUID query didn't work, try patient_id column (display ID like "MEC0012", "MFA-MC9810")
      if (!supabasePatient) {
        debugLog('🔍 resolvePatientByIdentifier: Trying query on patient_id column (display ID):', identifier);
        let result = await window.supabaseClient
          .from('patients')
          .select('*')
          .eq('patient_id', identifier)
          .eq('organization_id', orgId)
          .maybeSingle();
        supabasePatient = result.data;
        error = result.error;
        
        // FALLBACK: MIN#### not in DB — same person may have been re-keyed to MFA-MC#### only (org migration)
        if (!supabasePatient && !error && identifier.match(/^MIN[0-9]{4}$/i)) {
          try {
            const { data: orgRow } = await window.supabaseClient
              .from('organizations')
              .select('settings')
              .eq('id', orgId)
              .maybeSingle();
            const prev = orgRow?.settings?.patient_id_previous_prefix;
            const newPrefix = orgRow?.settings?.patient_id_prefix;
            const m = String(identifier).match(/^([A-Z]{3})([0-9]{4})$/i);
            if (prev && newPrefix && m && m[1].toUpperCase() === String(prev).toUpperCase()) {
              const mappedId = String(newPrefix).trim().toUpperCase() + m[2];
              debugLog('🔍 resolvePatientByIdentifier: MIN id not in DB, trying org-mapped patient_id:', mappedId);
              result = await window.supabaseClient
                .from('patients')
                .select('*')
                .eq('patient_id', mappedId)
                .eq('organization_id', orgId)
                .maybeSingle();
              supabasePatient = result.data;
              error = result.error;
              if (supabasePatient) debugLog('✅ resolvePatientByIdentifier: Found by post-MIN-migration id:', mappedId);
            }
          } catch (e) {
            debugWarn('MIN->mapped patient_id fallback failed:', e);
          }
        }
        
        // FALLBACK: If MFA-MC9810 / MFA-SC9810 not found, try old MIN9810 (migration may not have run on this DB yet)
        if (!supabasePatient && !error && identifier.match(/^MFA-MC([0-9]{4})$/i)) {
          const oldId = 'MIN' + identifier.match(/^MFA-MC([0-9]{4})$/i)[1];
          debugLog('🔍 resolvePatientByIdentifier: MFA-MC id not found, trying legacy MIN:', oldId);
          result = await window.supabaseClient
            .from('patients')
            .select('*')
            .eq('patient_id', oldId)
            .eq('organization_id', orgId)
            .maybeSingle();
          supabasePatient = result.data;
          error = result.error;
          if (supabasePatient) debugLog('✅ resolvePatientByIdentifier: Found by legacy MIN id:', oldId);
        }
        if (!supabasePatient && !error && identifier.match(/^MFA-SC([0-9]{4})$/i)) {
          const oldId = 'MIN' + identifier.match(/^MFA-SC([0-9]{4})$/i)[1];
          debugLog('🔍 resolvePatientByIdentifier: MFA-SC id not found, trying legacy MIN:', oldId);
          result = await window.supabaseClient
            .from('patients')
            .select('*')
            .eq('patient_id', oldId)
            .eq('organization_id', orgId)
            .maybeSingle();
          supabasePatient = result.data;
          error = result.error;
          if (supabasePatient) debugLog('✅ resolvePatientByIdentifier: Found by legacy MIN id (MFA-SC):', oldId);
        }
        
        if (error) {
          debugWarn('⚠️ resolvePatientByIdentifier: patient_id query failed:', error.message);
          
          // CRITICAL FIX: If patient_id lookup failed and identifier looks like a temporary ID (MEC + 4 hex digits),
          // try to find the patient by matching the UUID digits in localStorage
          // Temporary IDs are generated as: orgPrefix + last 4 hex digits of UUID (e.g., MEC0BF6 from ...0bf6...)
          if (identifier.match(/^[A-Z]{3}[0-9A-F]{4}$/i)) {
            debugLog('🔍 resolvePatientByIdentifier: Identifier looks like temporary ID, searching localStorage for matching UUID...');
            const tempIdDigits = identifier.substring(3).toUpperCase(); // Get the 4 hex digits (e.g., "0BF6")
            
            // Search through patients in localStorage to find one whose UUID ends with these digits
            for (const p of patients) {
              const uuid = p._supabaseUuid || p.id;
              if (uuid && uuid.includes('-') && uuid.length === 36) {
                // Extract last 4 hex digits from UUID (positions 28-32 after removing dashes)
                const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
                if (uuidDigits === tempIdDigits) {
                  debugLog('✅ resolvePatientByIdentifier: Found matching UUID in localStorage:', uuid);
                  // Now query Supabase by UUID
                  const uuidResult = await window.supabaseClient
                    .from('patients')
                    .select('*')
                    .eq('id', uuid)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  supabasePatient = uuidResult.data;
                  error = uuidResult.error;
                  if (supabasePatient) {
                    debugLog('✅ resolvePatientByIdentifier: Found patient in Supabase by UUID:', supabasePatient.id);
                    break;
                  }
                }
              }
            }
          }
        } else if (supabasePatient) {
          debugLog('✅ resolvePatientByIdentifier: Found patient by patient_id (display ID):', supabasePatient.patient_id || supabasePatient.id);
        }
      }
      
      if (!error && supabasePatient) {
        debugLog('✅ resolvePatientByIdentifier: Found patient in Supabase:', { 
          id: supabasePatient.id, 
          patient_id: supabasePatient.patient_id,
          name: `${supabasePatient.first_name} ${supabasePatient.last_name}`
        });
        
        // CRITICAL FIX: If patient_id is NULL or UUID, generate and assign a legacy ID
        let displayId = supabasePatient.patient_id;
        // Check if patient_id is missing, null, 'Unknown ID', or is a UUID (should be legacy ID format)
        const isUuid = displayId && displayId.includes('-') && displayId.length === 36;
        if (!displayId || displayId === null || displayId === 'Unknown ID' || isUuid) {
          if (isUuid) {
            debugWarn('⚠️ resolvePatientByIdentifier: Patient has UUID as patient_id (incorrect), generating proper legacy ID...');
          } else {
            debugWarn('⚠️ resolvePatientByIdentifier: Patient has no patient_id, generating one...');
          }
          debugWarn('⚠️ resolvePatientByIdentifier: Patient has no patient_id, generating one...');
          try {
            // Generate legacy ID using the same logic as createSupabasePatient
            if (typeof window.generateSupabasePatientId === 'function') {
              displayId = await window.generateSupabasePatientId(orgId);
            } else if (typeof generateSupabasePatientId === 'function') {
              displayId = await generateSupabasePatientId(orgId);
            } else {
              const client = window.supabaseClient;
              if (client) {
                const { data: org } = await client
                  .from('organizations')
                  .select('name, settings')
                  .eq('id', orgId)
                  .single();
                const prefix =
                  typeof window.mfResolveDefaultPatientIdPrefix === 'function'
                    ? window.mfResolveDefaultPatientIdPrefix(orgId, org, { orgFetchFailed: !org })
                    : (org?.settings?.patient_id_prefix
                        ? String(org.settings.patient_id_prefix).trim().toUpperCase()
                        : org?.name
                          ? org.name.substring(0, 3).toUpperCase()
                          : 'ORG');
                const { data: existingPatients } = await client
                  .from('patients')
                  .select('patient_id')
                  .eq('organization_id', orgId)
                  .not('patient_id', 'is', null);
                const maxN =
                  typeof window.mfMaxPatientMrnNumericSuffix === 'function'
                    ? window.mfMaxPatientMrnNumericSuffix(existingPatients)
                    : (function (rows) {
                        var stemPatterns = [
                          /^MIN([0-9]{4})$/i,
                          /^MFA([0-9]{4})$/i,
                          /^MFA-MC([0-9]{4})$/i,
                          /^MFA-SC([0-9]{4})$/i
                        ];
                        var max = 0;
                        (rows || []).forEach(function (p) {
                          var pid = p && typeof p.patient_id === 'string' ? p.patient_id.trim() : '';
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
                          if (!Number.isNaN(n) && n > max) max = n;
                        });
                        return max;
                      })(existingPatients);
                displayId =
                  typeof window.mfFormatPatientMrn === 'function'
                    ? window.mfFormatPatientMrn(prefix, maxN + 1)
                    : `${prefix}${(maxN + 1).toString().padStart(4, '0')}`;
              } else {
                displayId = generatePatientId();
              }
            }
            
            // CRITICAL: Update Supabase with the generated patient_id BEFORE creating patient object
            if (displayId && displayId !== 'Unknown ID' && window.supabaseClient) {
              const { error: updateError } = await window.supabaseClient
                .from('patients')
                .update({ patient_id: displayId })
                .eq('id', supabasePatient.id)
                .eq('organization_id', orgId);
              
              if (updateError) {
                console.error('❌ Could not update patient_id in Supabase:', updateError);
                // Don't set to 'Unknown ID' - try to use generated ID anyway
                console.warn('⚠️ Using generated ID despite update error:', displayId);
              } else {
                console.log('✅ Generated and assigned patient_id:', displayId);
              }
              
              // CRITICAL: Update supabasePatient object IMMEDIATELY so it's used in patient object creation
              supabasePatient.patient_id = displayId;
            } else {
              console.error('❌ Could not generate patient_id - displayId:', displayId);
              // Don't set to 'Unknown ID' - this will cause issues
              // Instead, try to use a fallback based on UUID
              displayId = null; // Will be handled below
            }
          } catch (genError) {
            console.error('❌ Error generating patient_id:', genError);
            displayId = null; // Will be handled below
          }
        }
        
        // CRITICAL: Ensure displayId is set - if generation failed, use a fallback and SAVE IT
        if (!displayId || displayId === 'Unknown ID') {
          debugWarn('⚠️ resolvePatientByIdentifier: No valid displayId, generating UUID-based fallback and saving to Supabase...');
          // Generate a fallback ID based on UUID (last resort)
          const uuidShort = supabasePatient.id.replace(/-/g, '').substring(28, 32).toUpperCase(); // Last 4 digits
          const { data: org } = await window.supabaseClient
            .from('organizations')
            .select('name, settings')
            .eq('id', orgId)
            .single();
          const orgPrefix =
            typeof window.mfResolveDefaultPatientIdPrefix === 'function'
              ? window.mfResolveDefaultPatientIdPrefix(orgId, org, { orgFetchFailed: !org })
              : org?.name
                ? org.name.substring(0, 3).toUpperCase()
                : 'ORG';
          displayId = `${orgPrefix}${uuidShort}`;
          
          // CRITICAL: Save this fallback ID to Supabase so it persists
          if (window.supabaseClient) {
            const { error: saveError } = await window.supabaseClient
              .from('patients')
              .update({ patient_id: displayId })
              .eq('id', supabasePatient.id)
              .eq('organization_id', orgId);
            
            if (saveError) {
              console.error('❌ Could not save fallback patient_id:', saveError);
            } else {
              console.log('✅ Saved fallback patient_id to Supabase:', displayId);
            }
          }
          
          supabasePatient.patient_id = displayId;
          console.warn('⚠️ Using fallback patient_id (run SQL script for proper sequential ID):', displayId);
        }
        
            // Helper function to safely parse JSON fields
            const parseJSONField = (field, defaultValue = []) => {
              if (!field) return defaultValue;
              if (Array.isArray(field)) return field;
              if (typeof field === 'string') {
                try {
                  const parsed = JSON.parse(field);
                  return Array.isArray(parsed) ? parsed : defaultValue;
                } catch (e) {
                  return defaultValue;
                }
              }
              return defaultValue;
            };
            
            // Convert Supabase format to localStorage format with ALL fields
            // CRITICAL: Store UUID in _supabaseUuid, and use patient_id (display ID) for id field
            // NEVER use UUID as display ID - if patient_id doesn't exist, generate one (done above)
            
            // Parse address fields (handle both separate fields and combined address)
            let parsedAddressLine1 = supabasePatient.address_line1 || '';
            let parsedAddressLine2 = supabasePatient.address_line2 || '';
            let parsedCity = supabasePatient.city || '';
            let parsedState = supabasePatient.state || '';
            let parsedCountry = supabasePatient.country || '';
            let parsedPostal = supabasePatient.postal_code || '';
            
            // If separate address fields are empty but combined address exists, parse it
            if (!parsedAddressLine1 && !parsedCity && supabasePatient.address) {
              const combinedAddress = (supabasePatient.address || '').trim();
              if (combinedAddress) {
                const parts = combinedAddress.split(',').map(p => p.trim()).filter(Boolean);
                if (parts.length > 0) parsedAddressLine1 = parts[0];
                if (parts.length > 1) parsedCity = parsedCity || parts[1];
                if (parts.length > 2) parsedState = parsedState || parts[2];
                if (parts.length > 3) parsedCountry = parsedCountry || parts[3];
              }
            }
            
            // Parse emergency address fields (handle both separate fields and combined address)
            let emergencyAddr1 = supabasePatient.emergency_address_line1 || '';
            let emergencyAddr2 = supabasePatient.emergency_address_line2 || '';
            let emergencyCity = supabasePatient.emergency_city || '';
            let emergencyState = supabasePatient.emergency_state || '';
            let emergencyCountry = supabasePatient.emergency_country || '';
            
            // Fallback to parsing combined address only if separate fields are not available
            if (!emergencyAddr1 && !emergencyCity && !emergencyState && !emergencyCountry && supabasePatient.emergency_contact_address) {
              const emergencyCombined = (supabasePatient.emergency_contact_address || '').trim();
              if (emergencyCombined) {
                const eparts = emergencyCombined.split(',').map(p => p.trim()).filter(Boolean);
                if (eparts.length > 0) emergencyAddr1 = eparts[0];
                if (eparts.length > 1) emergencyCity = eparts[1];
                if (eparts.length > 2) emergencyState = eparts[2];
                if (eparts.length > 3) emergencyCountry = eparts[3];
              }
            }
            
            // Parse emergency contact name into first and last name
            const emergencyContactName = supabasePatient.emergency_contact_name || '';
            const emergencyFirstName = emergencyContactName ? emergencyContactName.split(' ')[0] : '';
            const emergencyLastName = emergencyContactName ? emergencyContactName.split(' ').slice(1).join(' ') : '';
            
            // CRITICAL: Ensure patient_id is set - if it's still null, use displayId that was generated
            const finalPatientId = supabasePatient.patient_id || displayId || 'Unknown ID';
            
            patient = {
              id: finalPatientId, // ALWAYS use legacy ID, never UUID
              _supabaseUuid: supabasePatient.id, // Actual UUID for database operations
              patient_id: finalPatientId, // Ensure patient_id is always set
              patientNumber: supabasePatient.patient_number,
              firstName: supabasePatient.first_name,
              middleName: supabasePatient.middle_name || '',
              lastName: supabasePatient.last_name,
              dob: supabasePatient.date_of_birth,
              phone: supabasePatient.phone,
              email: supabasePatient.email || '',
              gender: supabasePatient.gender || 'Male',
              maritalStatus: supabasePatient.marital_status || '',
              race: supabasePatient.race || '',
              // Address fields
              address: supabasePatient.address || '',
              addressLine1: parsedAddressLine1,
              addressLine2: parsedAddressLine2,
              city: parsedCity,
              state: parsedState,
              country: parsedCountry,
              postalCode: parsedPostal,
              // Emergency contact fields
              emergencyFirstName: emergencyFirstName,
              emergencyLastName: emergencyLastName,
              emergencyPhone: supabasePatient.emergency_contact_phone || '',
              emergencyEmail: supabasePatient.emergency_contact_email || '',
              emergencyRelationship: supabasePatient.emergency_contact_relationship || '',
              emergencyAddressCombined: supabasePatient.emergency_contact_address || '',
              emergencyAddressLine1: emergencyAddr1,
              emergencyAddressLine2: emergencyAddr2,
              emergencyCity: emergencyCity,
              emergencyState: emergencyState,
              emergencyCountry: emergencyCountry,
              // Other fields
              bloodGroup: supabasePatient.blood_group || supabasePatient.blood_type || '',
              paymentSource: supabasePatient.payment_source || 'Self Pay',
              organizationId: supabasePatient.organization_id,
              // CRITICAL: Parse all JSON array fields
              immunizations: parseJSONField(supabasePatient.immunizations, []),
              allergies: parseJSONField(supabasePatient.allergies, []),
              medicalHistory: parseJSONField(supabasePatient.medical_history, []),
              diagnoses: parseJSONField(supabasePatient.diagnoses, []),
              vitals: parseJSONField(supabasePatient.vitals, []),
              medications: parseJSONField(supabasePatient.medications, []),
              visits: parseJSONField(supabasePatient.visits, []),
              prescriptions: parseJSONField(supabasePatient.prescriptions, []),
              hasDiabetes: supabasePatient.has_diabetes || false,
              unstructuredRecords: parseJSONField(supabasePatient.unstructured_records, []),
            };
            
            // If we found patient from Supabase, we should also update the patients array
            // so it's available for subsequent saves
            const existingIndex = patients.findIndex(p => 
              p.id === patient.id || 
              p.patient_id === patient.patient_id ||
              p._supabaseUuid === patient._supabaseUuid
            );
            const remoteUr = patient.unstructuredRecords;
            if (existingIndex >= 0) {
              const prev = patients[existingIndex];
              const mergedUr = mergeUnstructuredRecordsById(prev.unstructuredRecords, remoteUr);
              patients[existingIndex] = { ...prev, ...patient, unstructuredRecords: mergedUr };
              patient = { ...patient, unstructuredRecords: mergedUr };
            } else {
              patients.push(patient);
            }
            // Save to localStorage for caching
            localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
            debugLog('✅ resolvePatientByIdentifier: Patient loaded from Supabase and cached, returning patient with id:', patient.id);
            return patient;
          } else {
            debugWarn('⚠️ resolvePatientByIdentifier: Supabase query returned error:', error);
          }
    } catch (error) {
      debugWarn('Error querying Supabase for patient:', error);
    }
  } else {
    debugWarn('⚠️ resolvePatientByIdentifier: Supabase client not available');
  }
  
  debugWarn('resolvePatientByIdentifier: Patient not found with identifier:', identifier);
  
  return null;
}

/**
 * When a form still has a patient row UUID (e.g. from a prior selection) but the visible name
 * no longer matches that row, prefer re-resolving by name (+ optional DOB). App-wide guard for
 * stale dataset / copy-paste / edit drift; not specific to appointments.
 * @param {string} rowUuid - patients.id
 * @param {string} displayedFullName - text the user believes they selected
 * @param {{ orgId?: string, dob?: string|null }} [options]
 * @returns {Promise<string>} row UUID to use (unchanged if already consistent or cannot fix)
 */
window.reconcileFormPatientRowWithDisplayedName = async function (rowUuid, displayedFullName, options) {
  if (!rowUuid || !displayedFullName) return rowUuid;
  const u = String(rowUuid).trim();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(u)) return rowUuid;
  const norm = (s) =>
    String(s || '')
      .replace(/\(DOB:.*?\)/gi, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const want = norm(displayedFullName);
  if (!want) return rowUuid;
  let pat = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    try {
      pat = await window.resolvePatientByIdentifier(u);
    } catch (e) {
      /* ignore */
    }
  }
  if (pat) {
    const got = norm(
      `${pat.firstName || ''} ${pat.middleName ? pat.middleName + ' ' : ''}${pat.lastName || ''}`.trim()
    );
    if (want === got) return rowUuid;
  }
  let orgId = options && options.orgId;
  if (!orgId) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    orgId = user.organizationId || user.organization_id;
    if (!orgId && user.org) {
      const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
      orgId = organizations[user.org] && organizations[user.org].id;
    }
  }
  if (!orgId) return rowUuid;
  const dob = options && options.dob != null ? options.dob : null;
  if (typeof window.resolveSupabasePatientIdByName === 'function') {
    const fromName = await window.resolveSupabasePatientIdByName(displayedFullName, orgId, dob);
    if (fromName && uuidRe.test(String(fromName).trim())) {
      if (String(fromName).trim() !== u) {
        console.warn(
          'reconcileFormPatientRowWithDisplayedName: UUID did not match displayed name; using name/DOB resolution.'
        );
      }
      return String(fromName).trim();
    }
  }
  return rowUuid;
};

// Generate sequential patient ID for current organization (localStorage max only; prefer generateSupabasePatientId when online)
function generatePatientId() {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  let orgPrefix = user.org ? user.org.substring(0, 3).toUpperCase() : "ORG";
  let oid = null;
  let entry = null;
  try {
    const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
    oid = user.organizationId || user.organization_id;
    entry = user.org ? organizations[user.org] : null;
    const orgIdForPrefix = oid || (entry && entry.id) || null;
    const synthetic = entry ? { name: entry.name, settings: entry.settings } : null;
    if (typeof window.mfResolveDefaultPatientIdPrefix === "function" && orgIdForPrefix) {
      orgPrefix = window.mfResolveDefaultPatientIdPrefix(orgIdForPrefix, synthetic, {});
    } else {
      const MFASC_ORGANIZATION_ID = "94534e80-06a8-468f-b8a2-ece3f07697c4";
      if (oid === MFASC_ORGANIZATION_ID || (entry && entry.id === MFASC_ORGANIZATION_ID)) {
        orgPrefix = "MFA-SC";
      } else if (entry && entry.settings && entry.settings.patient_id_prefix) {
        orgPrefix = String(entry.settings.patient_id_prefix).trim().toUpperCase();
      }
    }
  } catch (e) { /* keep orgPrefix */ }

  let maxNumber = 0;
  if (typeof window.mfMaxPatientMrnNumericSuffix === "function") {
    let scoped = patients;
    if (oid) {
      scoped = patients.filter(
        (p) => !p.organization_id || p.organization_id === oid || p.organizationId === oid
      );
    }
    const asRows = scoped.map((p) => ({ patient_id: p.id || p.patient_id }));
    maxNumber = window.mfMaxPatientMrnNumericSuffix(asRows);
  } else {
    const escapedPrefix = orgPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tailRe = new RegExp("^" + escapedPrefix + "(\\d{4})$", "i");
    patients.forEach((patient) => {
      const id = patient.id || patient.patient_id;
      if (!id || typeof id !== "string") return;
      const m = id.trim().match(tailRe);
      if (m) {
        const patientNumber = parseInt(m[1], 10);
        if (!Number.isNaN(patientNumber) && patientNumber > maxNumber) maxNumber = patientNumber;
      }
    });
  }

  const nextNumber = maxNumber + 1;
  return typeof window.mfFormatPatientMrn === "function"
    ? window.mfFormatPatientMrn(orgPrefix, nextNumber)
    : `${orgPrefix}${nextNumber.toString().padStart(4, "0")}`;
}

// Function to load clinical note data from Supabase
async function loadClinicalNoteDataFromSupabase(patient, visitDate) {
  // HYBRID ARCHITECTURE: Supabase-first, localStorage fallback only on errors
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn : () => {};

  if (!window.supabaseClient) {
    debugLog('Supabase not available, skipping clinical note data load (will use existing localStorage data)');
    return; // Fallback: patient data already loaded from localStorage via universal-data-loader
  }

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    // Try multiple fields for organization ID
    let orgId = user.organizationId || user.organization_id || user.org;
    
    // If orgId is not a UUID (might be organization name), try to resolve it
    if (orgId && !orgId.includes('-')) {
      // It's likely a name, not an ID - we'll need to query for it
      // For now, fallback to default
      orgId = '576522cc-e769-4fb4-9487-3d150857d970';
    }
    
    // Final fallback
    if (!orgId) {
      orgId = '576522cc-e769-4fb4-9487-3d150857d970';
    }
    
    debugLog('Loading clinical note data from Supabase patients table for patient:', patient.id);
    debugLog('🔍 [loadClinicalNoteDataFromSupabase] Patient object:', {
      id: patient.id,
      patient_id: patient.patient_id,
      _supabaseUuid: patient._supabaseUuid,
      orgId: orgId
    });
    
    // HYBRID ARCHITECTURE STEP 1: Try Supabase first
    // CRITICAL: Query by UUID (id column) if available, otherwise by legacy ID (patient_id column)
    // Priority: _supabaseUuid > id (if UUID) > patient_id (legacy ID)
    let queryColumn = 'id';
    let queryValue = null;
    
    if (patient._supabaseUuid && patient._supabaseUuid.includes('-') && patient._supabaseUuid.length === 36) {
      // Use _supabaseUuid if available (most reliable)
      queryColumn = 'id';
      queryValue = patient._supabaseUuid;
      debugLog('🔍 [loadClinicalNoteDataFromSupabase] Using _supabaseUuid for query:', queryValue);
    } else if (patient.id && patient.id.includes('-') && patient.id.length === 36) {
      // Use id if it's a UUID
      queryColumn = 'id';
      queryValue = patient.id;
      debugLog('🔍 [loadClinicalNoteDataFromSupabase] Using id (UUID) for query:', queryValue);
    } else if (patient.patient_id && !patient.patient_id.includes('-')) {
      // Use patient_id if it's a legacy ID (not UUID)
      queryColumn = 'patient_id';
      queryValue = patient.patient_id;
      debugLog('🔍 [loadClinicalNoteDataFromSupabase] Using patient_id (legacy ID) for query:', queryValue);
    } else if (patient.id && !patient.id.includes('-')) {
      // Use id if it's a legacy ID
      queryColumn = 'patient_id';
      queryValue = patient.id;
      debugLog('🔍 [loadClinicalNoteDataFromSupabase] Using id (legacy ID) for query:', queryValue);
    } else {
      console.error('❌ [loadClinicalNoteDataFromSupabase] Cannot determine query value for patient.');
      return; // Cannot query without valid ID
    }
    
    const { data: patientData, error } = await window.supabaseClient
      .from('patients')
      .select('medical_history, diagnoses, immunizations, allergies, vitals, medications')
      .eq(queryColumn, queryValue)
      .eq('organization_id', orgId)
      .single();

    // HYBRID ARCHITECTURE: Only fall back to localStorage on actual errors (not empty data)
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is valid, not an error. Use existing patient data from localStorage.
        debugLog('No clinical note data in Supabase for this patient - using existing localStorage data');
        return;
      } else {
        // Actual error - fall back to localStorage (Hybrid Architecture rule)
        debugWarn('Error loading clinical note data from Supabase, using localStorage fallback:', error);
        return; // Patient data already loaded from localStorage via universal-data-loader
      }
    }

    // HYBRID ARCHITECTURE: Supabase query succeeded - use Supabase data (even if empty)
    if (patientData) {
        // Found clinical note data in Supabase
      
      try {
        // Normalize JSONB from Supabase (string | array | object | null).
        // Critical: do NOT overwrite in-memory / localStorage clinical sections when Supabase returns empty/null (that was wiping notes after refresh).
        const normalizeClinicalArray = (raw, fieldName) => {
          if (raw == null || raw === '' || raw === 'null') return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'object') return [raw];
          if (typeof raw === 'string') {
            const t = raw.trim();
            if (!t) return [];
            try {
              const parsed = JSON.parse(t);
              if (Array.isArray(parsed)) return parsed;
              if (parsed && typeof parsed === 'object') return [parsed];
              return [];
            } catch (e) {
              console.warn(`Error parsing ${fieldName} JSON:`, e);
              return [];
            }
          }
          return [];
        };

        const mergeClinicalSection = (existing, raw, fieldName) => {
          const next = normalizeClinicalArray(raw, fieldName);
          const prev = Array.isArray(existing) ? existing : (existing ? [existing] : []);
          if (next.length > 0) return next;
          return prev;
        };

        patient.medicalHistory = mergeClinicalSection(patient.medicalHistory, patientData.medical_history, 'medical_history');
        patient.diagnoses = mergeClinicalSection(patient.diagnoses, patientData.diagnoses, 'diagnoses');
        patient.immunizations = mergeClinicalSection(patient.immunizations, patientData.immunizations, 'immunizations');
        patient.allergies = mergeClinicalSection(patient.allergies, patientData.allergies, 'allergies');
        patient.vitals = mergeClinicalSection(patient.vitals, patientData.vitals, 'vitals');
        
        // Handle medications - might be string or array
        const medsParsed = normalizeClinicalArray(patientData.medications, 'medications');
        if (medsParsed.length > 0) {
          patient.medications = medsParsed;
        } else if (patient.medications && typeof patient.medications === 'string') {
          try {
            patient.medications = JSON.parse(patient.medications);
          } catch (e) {
            console.warn('Error parsing medications JSON:', e);
            patient.medications = [];
          }
        } else if (!patient.medications) {
          patient.medications = [];
        }
        
        console.log('✅ Clinical note data merged from Supabase (empty Supabase fields keep localStorage):', {
          medicalHistory: patient.medicalHistory?.length || 0,
          diagnoses: patient.diagnoses?.length || 0,
          immunizations: patient.immunizations?.length || 0,
          allergies: patient.allergies?.length || 0,
          vitals: patient.vitals?.length || 0,
          medications: patient.medications?.length || 0
        });
        
        // Save the updated patient object back to localStorage (sync Supabase → localStorage)
        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        const patientIndex = patients.findIndex(p =>
          p.id === patient.id ||
          p.patient_id === patient.id ||
          (patient.patient_id && p.patient_id === patient.patient_id) ||
          (patient._supabaseUuid && (p._supabaseUuid === patient._supabaseUuid || p.id === patient._supabaseUuid))
        );
        if (patientIndex !== -1) {
          patients[patientIndex] = patient;
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        }
      } catch (parseError) {
        console.warn('Error parsing clinical note JSON data, using existing localStorage data:', parseError);
        // On parse error, keep existing patient data (already loaded from localStorage)
      }
    } else {
      console.log('No clinical note data found in Supabase - using existing localStorage data');
    }
  } catch (error) {
    // HYBRID ARCHITECTURE: Error occurred - fall back to localStorage (already loaded)
    console.warn('Error loading clinical note data from Supabase, using localStorage fallback:', error);
    // Patient data already loaded from localStorage via universal-data-loader, so no action needed
  }
}

// Function to load clinical note SOAP data from Supabase clinical_notes table (Supabase-first)
async function loadClinicalNoteSOAPFromSupabase(patient, visitDate) {
  // HYBRID ARCHITECTURE: Supabase-first, localStorage fallback only on errors
  if (!window.supabaseClient) {
    console.warn('[PERSISTENCE] Supabase not available, skipping clinical note SOAP data load (will use existing localStorage data)');
    return; // Fallback: patient data already loaded from localStorage
  }

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    // Get organization ID
    let orgId = user.organizationId || user.organization_id || user.org;
    
    // If orgId is not a UUID, try to resolve it
    if (orgId && !orgId.includes('-')) {
      orgId = '576522cc-e769-4fb4-9487-3d150857d970';
    }
    
    // Final fallback
    if (!orgId) {
      orgId = '576522cc-e769-4fb4-9487-3d150857d970';
    }
    
    // VALIDATION: Ensure patient.id is legacy ID before querying Supabase
    const isUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
    if (isUuid) {
      console.error('❌ CRITICAL: patient.id is UUID before Supabase query! Using patient.patient_id instead.');
      const legacyId = patient.patient_id || patient.patientNumber || 'Unknown ID';
      console.warn('🔧 Using legacy ID for query:', legacyId);
      patient.id = legacyId; // Fix it
    }
    
    console.warn('[PERSISTENCE] Loading clinical note SOAP data from Supabase clinical_notes table for patient:', patient.id, 'visit:', visitDate);
    console.warn('[PERSISTENCE] Patient ID validation - is legacy format:', !isUuid, 'patient_id:', patient.patient_id, '_supabaseUuid:', patient._supabaseUuid);
    
    // Check if we've already determined that soap_data column doesn't exist (cache to avoid repeated 400 errors)
    const soapDataColumnExists = window._soapDataColumnExists !== false; // undefined or true = assume it exists, false = confirmed doesn't exist
    
    let clinicalNote = null;
    let error = null;
    
    // HYBRID ARCHITECTURE STEP 1: Try Supabase first (only if we haven't confirmed column doesn't exist)
    // CRITICAL: clinical_notes table stores patient_id as UUID, so we need to use UUID for query
    // But we also need to try legacy ID as fallback in case old data was saved with legacy ID
    let queryPatientId = patient.id;
    let legacyIdForFallback = null;
    
    if (patient._supabaseUuid && patient._supabaseUuid.includes('-') && patient._supabaseUuid.length === 36) {
      queryPatientId = patient._supabaseUuid;
      legacyIdForFallback = patient.id || patient.patient_id; // Store legacy ID for fallback query
    } else if (patient.id && !patient.id.includes('-') && patient.id.length < 36) {
      // Legacy ID - need to resolve to UUID
      legacyIdForFallback = patient.id; // Store for fallback
      try {
        const { data: patientData, error: patientError } = await window.supabaseClient
          .from('patients')
          .select('id')
          .eq('patient_id', patient.id)
          .eq('organization_id', orgId)
          .maybeSingle();
        
        if (!patientError && patientData && patientData.id) {
          queryPatientId = patientData.id;
          console.warn('[PERSISTENCE] Resolved legacy ID to UUID for clinical_notes query:', patient.id, '->', queryPatientId);
        }
      } catch (resolveError) {
        console.warn('[PERSISTENCE] Could not resolve UUID, will try legacy ID fallback:', resolveError);
      }
    }
    
    if (soapDataColumnExists) {
      // Try UUID first (new data format)
      let result = await window.supabaseClient
        .from('clinical_notes')
        .select('soap_data')
        .eq('patient_id', queryPatientId)
        .eq('organization_id', orgId)
        .eq('note_date', visitDate)
        .maybeSingle();
      
      clinicalNote = result.data;
      error = result.error;
      
      // If no result with UUID and we have a legacy ID, try legacy ID as fallback (old data format)
      if ((!clinicalNote || error?.code === 'PGRST116') && legacyIdForFallback && legacyIdForFallback !== queryPatientId) {
        console.warn('[PERSISTENCE] No data found with UUID, trying legacy ID fallback:', legacyIdForFallback);
        result = await window.supabaseClient
          .from('clinical_notes')
          .select('soap_data')
          .eq('patient_id', legacyIdForFallback)
          .eq('organization_id', orgId)
          .eq('note_date', visitDate)
          .maybeSingle();
        
        if (!result.error && result.data) {
          clinicalNote = result.data;
          error = null;
          console.warn('[PERSISTENCE] ✅ Found data with legacy ID fallback!');
        }
      }
      
      // If successful, clear any cached "column doesn't exist" flag and confirm we're using soap_data column
      if (!error && clinicalNote) {
        if (window._soapDataColumnExists === false) {
          console.warn('[PERSISTENCE] ✅ soap_data column now exists! Cleared cache flag - using clinical_notes.soap_data column');
          window._soapDataColumnExists = true; // Clear the cache - column exists
        }
        if (clinicalNote.soap_data) {
          console.warn('[PERSISTENCE] ✅ Successfully loaded SOAP data from clinical_notes.soap_data column (Supabase-first)');
          console.warn('[PERSISTENCE] 🔍 Raw soap_data from Supabase:', JSON.stringify(clinicalNote.soap_data).substring(0, 500));
        }
      } else if (error && (error.code === '42703' || error.message?.includes('soap_data') || error.message?.includes('column') || error.message?.includes('schema'))) {
        // If we get a 400 error, it likely means the column doesn't exist - cache this to avoid future attempts
        console.warn('[PERSISTENCE] soap_data column doesn\'t exist in clinical_notes table (caching to avoid future 400 errors)');
        window._soapDataColumnExists = false; // Cache that column doesn't exist
      }
    } else {
      // Column doesn't exist (cached) - but try once more in case it was just added
      console.warn('[PERSISTENCE] soap_data column was cached as non-existent, trying once more in case it was added...');
      let result = await window.supabaseClient
        .from('clinical_notes')
        .select('soap_data')
        .eq('patient_id', queryPatientId)
        .eq('organization_id', orgId)
        .eq('note_date', visitDate)
        .maybeSingle();
      
      clinicalNote = result.data;
      error = result.error;
      
      // Try legacy ID fallback if UUID didn't work
      if ((!clinicalNote || error?.code === 'PGRST116') && legacyIdForFallback && legacyIdForFallback !== queryPatientId) {
        console.warn('[PERSISTENCE] No data found with UUID (cached column check), trying legacy ID fallback:', legacyIdForFallback);
        result = await window.supabaseClient
          .from('clinical_notes')
          .select('soap_data')
          .eq('patient_id', legacyIdForFallback)
          .eq('organization_id', orgId)
          .eq('note_date', visitDate)
          .maybeSingle();
        
        if (!result.error && result.data) {
          clinicalNote = result.data;
          error = null;
          console.warn('[PERSISTENCE] ✅ Found data with legacy ID fallback (cached column check)!');
        }
      }
      
      if (!error && clinicalNote) {
        // Success! Column exists now - clear the cache
        console.warn('[PERSISTENCE] ✅ soap_data column now exists! Cleared cache flag - using clinical_notes.soap_data column');
        window._soapDataColumnExists = true;
      } else {
        // Still doesn't exist - skip to avoid 400 error
        console.warn('[PERSISTENCE] soap_data column still doesn\'t exist (cached), skipping clinical_notes query to avoid 400 error');
        error = { code: '42703', message: 'Column does not exist (cached)' };
      }
    }

    // HYBRID ARCHITECTURE: Only fall back to localStorage on actual errors (not empty data)
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is valid, not an error. Try patients table (Supabase-first).
        console.warn('[PERSISTENCE] No clinical note in clinical_notes table, checking patient_encounters table (Supabase-first)...');
        // Continue to try patient_encounters table below
      } else if (error.code === '42703' || error.message?.includes('soap_data') || error.message?.includes('column') || error.message?.includes('schema')) {
        // Column doesn't exist - try patient_encounters table instead (Supabase-first)
        console.warn('[PERSISTENCE] soap_data column doesn\'t exist, checking patient_encounters table for SOAP data (Supabase-first)...');
        // Continue to try patient_encounters table below
      } else {
        // Other error - fall back to localStorage (Hybrid Architecture rule)
        console.warn('[PERSISTENCE] Error loading clinical note SOAP data from Supabase, using localStorage fallback:', error);
        return; // Patient data already loaded from localStorage
      }
      
      // SUPABASE-FIRST: Try to load SOAP data from patient_encounters table (proper Supabase table with SOAP fields)
      try {
        const encounterQueryIds = [];
        if (queryPatientId) encounterQueryIds.push(queryPatientId);
        if (patient.id && patient.id !== queryPatientId) encounterQueryIds.push(patient.id);
        if (patient.patient_id && patient.patient_id !== queryPatientId && patient.patient_id !== patient.id) {
          encounterQueryIds.push(patient.patient_id);
        }

        let encounterData = null;
        let encounterError = null;
        for (const candidateId of encounterQueryIds) {
          const result = await window.supabaseClient
            .from('patient_encounters')
            .select('*')
            .eq('patient_id', candidateId)
            .eq('organization_id', orgId)
            .eq('encounter_date', visitDate)
            .maybeSingle();

          encounterData = result.data;
          encounterError = result.error;
          if (encounterData || (encounterError && encounterError.code !== 'PGRST116')) {
            break;
          }
        }
        
        if (encounterError) {
          if (encounterError.code === 'PGRST116') {
            // No rows found - this is valid, not an error
            console.warn('[PERSISTENCE] No encounter found in patient_encounters table for this visit - using existing localStorage data');
            return;
          } else {
            // Actual error - log it but continue to localStorage fallback
            console.error('[PERSISTENCE] ❌ Error loading from patient_encounters table:', encounterError);
            console.error('[PERSISTENCE] Error details:', {
              message: encounterError.message,
              code: encounterError.code,
              details: encounterError.details,
              hint: encounterError.hint
            });
            return; // Fall back to localStorage
          }
        }
        
        if (encounterData) {
          // Found SOAP data in patient_encounters table - use it (Supabase-first)
          if (!patient.visits) {
            patient.visits = [];
          }
          let localVisit = patient.visits.find(v => v.date === visitDate);
          if (!localVisit) {
            localVisit = { date: visitDate, soap: {} };
            patient.visits.push(localVisit);
          }
          
          if (!localVisit.soap) {
            localVisit.soap = {};
          }
          
          // SUPABASE-FIRST: Update visit.soap with Supabase data from patient_encounters table
          if (!localVisit.soap.subjective) {
            localVisit.soap.subjective = {};
          }
          if (!localVisit.soap.plan) {
            localVisit.soap.plan = {};
          }
          
          // Map patient_encounters fields to SOAP structure
          if (encounterData.soap_subjective_cc) {
            localVisit.soap.subjective.cc = encounterData.soap_subjective_cc;
          }
          if (encounterData.soap_subjective_hpi) {
            localVisit.soap.subjective.hpi = encounterData.soap_subjective_hpi;
          }
          if (encounterData.soap_subjective_fh) {
            localVisit.soap.subjective.fh = encounterData.soap_subjective_fh;
          }
          if (encounterData.soap_subjective_sh) {
            localVisit.soap.subjective.sh = encounterData.soap_subjective_sh;
          }
          if (encounterData.soap_subjective_ros) {
            localVisit.soap.subjective.ros = encounterData.soap_subjective_ros;
          }
          if (encounterData.soap_plan_treatments) {
            localVisit.soap.plan.treatments = encounterData.soap_plan_treatments;
          }
          if (encounterData.soap_plan_education) {
            localVisit.soap.plan.education = encounterData.soap_plan_education;
          }
          if (encounterData.soap_plan_followup) {
            localVisit.soap.plan.followup = encounterData.soap_plan_followup;
            localVisit.soap.plan.followUp = encounterData.soap_plan_followup;
          }
          
          // Save updated patient object back to localStorage (sync Supabase → localStorage)
          const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          const patientIndex = patients.findIndex(p => p.id === patient.id);
          if (patientIndex !== -1) {
            patients[patientIndex] = patient;
            localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          }
          
          console.warn('[PERSISTENCE] ✅ SUCCESS: Clinical note SOAP data loaded from Supabase patient_encounters table (Supabase-first):', {
            cc: localVisit.soap.subjective?.cc?.substring(0, 50) || '',
            hpi: localVisit.soap.subjective?.hpi?.substring(0, 50) || '',
            treatments: localVisit.soap.plan?.treatments?.substring(0, 50) || '',
          });
          return; // Successfully loaded from patient_encounters table
        }
        
        // No SOAP data found in patient_encounters table - use localStorage
        console.warn('[PERSISTENCE] No SOAP data found in Supabase patient_encounters table - using existing localStorage data');
        return;
      } catch (encounterTableError) {
        console.error('[PERSISTENCE] ❌ EXCEPTION loading from patient_encounters table:', encounterTableError);
        return; // Fall back to localStorage
      }
    }

    // HYBRID ARCHITECTURE: Supabase query succeeded - use Supabase data (even if empty)
    if (clinicalNote && clinicalNote.soap_data) {
      try {
        // Find or create the visit
        if (!patient.visits) {
          patient.visits = [];
        }
        let visit = patient.visits.find(v => v.date === visitDate);
        if (!visit) {
          visit = { date: visitDate, soap: {} };
          patient.visits.push(visit);
        }
        
        // Initialize SOAP structure if it doesn't exist
        if (!visit.soap) {
          visit.soap = {};
        }
        
        // SUPABASE-FIRST: Update visit.soap with Supabase data (overwrite localStorage)
        // CRITICAL: soap_data might be a JSON string that needs parsing
        let soapData = clinicalNote.soap_data;
        if (typeof soapData === 'string') {
          try {
            soapData = JSON.parse(soapData);
            console.warn('[PERSISTENCE] Parsed soap_data JSON string:', Object.keys(soapData));
          } catch (parseError) {
            console.error('[PERSISTENCE] Error parsing soap_data JSON string:', parseError);
            soapData = {};
          }
        }
        
        console.warn('[PERSISTENCE] 🔍 soapData structure:', {
          hasSubjective: !!soapData.subjective,
          hasObjective: !!soapData.objective,
          hasAssessment: !!soapData.assessment,
          hasPlan: !!soapData.plan,
          subjectiveKeys: soapData.subjective ? Object.keys(soapData.subjective) : [],
          objectiveKeys: soapData.objective ? Object.keys(soapData.objective) : []
        });
        
        if (soapData.subjective) {
          visit.soap.subjective = { ...visit.soap.subjective, ...soapData.subjective };
        }
        if (soapData.objective) {
          visit.soap.objective = { ...visit.soap.objective, ...soapData.objective };
        }
        if (soapData.assessment) {
          visit.soap.assessment = { ...visit.soap.assessment, ...soapData.assessment };
        }
        if (soapData.plan) {
          visit.soap.plan = { ...visit.soap.plan, ...soapData.plan };
        }
        if (soapData.radiology) {
          visit.soap.radiology = soapData.radiology;
        }
        
        // Save updated patient object back to localStorage (sync Supabase → localStorage)
        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        const patientIndex = patients.findIndex(p => p.id === patient.id);
        if (patientIndex !== -1) {
          patients[patientIndex] = patient;
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        }
        
        console.warn('[PERSISTENCE] ✅ Clinical note SOAP data loaded from Supabase (Supabase-first)');
      } catch (parseError) {
        console.warn('[PERSISTENCE] Error parsing clinical note SOAP data, using existing localStorage data:', parseError);
        // On parse error, keep existing patient data (already loaded from localStorage)
      }
    } else {
      console.warn('[PERSISTENCE] No clinical note SOAP data found in Supabase - using existing localStorage data');
    }
  } catch (error) {
    // HYBRID ARCHITECTURE: Error occurred - fall back to localStorage (already loaded)
    console.warn('[PERSISTENCE] Error loading clinical note SOAP data from Supabase, using localStorage fallback:', error);
    // Patient data already loaded from localStorage, so no action needed
  }
}

// Function to save patient data to Supabase (hybrid architecture)
async function savePatientToSupabase(patient) {
  // VALIDATION: Skip if patient is incomplete or invalid
  if (!patient || !patient.id || !patient.firstName || !patient.lastName || !patient.dob) {
    if (window.__DEBUG_LOGS) {
      console.warn('⚠️ [SAVE-PATIENT] Skipping save - patient missing required fields');
    }
    return false;
  }
  
  if (!window.supabaseClient) {
    throw new Error('Supabase not available');
  }

  try {
    // Get organization ID - use same method as universal data loader
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = null;
    
    // Method 1: Try from user object
    if (user.organizationId) {
      orgId = user.organizationId;
    }
    
    // Method 2: Try from user.org (fallback)
    if (!orgId && user.org) {
      // For Mecure Clinics, use the known org ID
      if (user.org.toLowerCase().includes('mecure')) {
        orgId = '576522cc-e769-4fb4-9487-3d150857d970';
      }
    }
    
    // Method 3: Default to Mecure Clinics org ID if no user data
    if (!orgId) {
      orgId = '576522cc-e769-4fb4-9487-3d150857d970';
      // Using default organization ID
    }
    
    // Organization ID resolved (UUID removed for privacy)

    // CRITICAL FIX: Get existing patient data first to merge arrays instead of overwriting
    // Determine query column and value: use _supabaseUuid (UUID) if available, otherwise check patient.id
    // In localStorage format: id = display ID ("MEC0012/H1Z7C"), _supabaseUuid = actual UUID
    // UUID pattern: contains dashes and is 36 characters long (e.g., d308554d-e730-41fa-ae9a-8d460cd78874)
    const hasUuid = patient._supabaseUuid && patient._supabaseUuid.includes('-') && patient._supabaseUuid.length === 36;
    const isIdUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
    const queryColumn = (hasUuid || isIdUuid) ? 'id' : 'patient_id';
    const queryValue = hasUuid ? patient._supabaseUuid : patient.id;
    
    // Try to select encounters column, but handle gracefully if it doesn't exist
    let existingPatient = null;
    let fetchError = null;
    
    try {
      const query = window.supabaseClient
        .from('patients')
        .select('allergies, chronic_conditions, diagnoses, immunizations, medical_history, vitals, medications, encounters, non_visit_encounters, unstructured_records')
        .eq(queryColumn, queryValue)
        .eq('organization_id', orgId);
      
      const result = await query.single();
      
      existingPatient = result.data;
      fetchError = result.error;
    } catch (err) {
      // If encounters column doesn't exist, try without it
      if (err.code === '42703' || err.message?.includes('encounters')) {
        console.warn('⚠️ encounters column does not exist, trying without it...');
        const query = window.supabaseClient
          .from('patients')
          .select('allergies, chronic_conditions, diagnoses, immunizations, medical_history, vitals, medications, unstructured_records')
          .eq(queryColumn, queryValue)
          .eq('organization_id', orgId);
        
        const result = await query.single();
        
        existingPatient = result.data;
        fetchError = result.error;
      } else {
        fetchError = err;
      }
    }

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw fetchError;
    }

    const parseExisting = value => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "object") {
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (_) {
          return [];
        }
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed || trimmed.toLowerCase() === "null") return [];
        try {
          return JSON.parse(trimmed);
        } catch (_) {
          return [];
        }
      }
      return [];
    };

    const existingAllergies = parseExisting(existingPatient?.allergies);
    const existingConditions = parseExisting(existingPatient?.chronic_conditions);
    const existingDiagnoses = parseExisting(existingPatient?.diagnoses);
    const existingImmunizations = parseExisting(existingPatient?.immunizations);
    const existingMedicalHistory = parseExisting(existingPatient?.medical_history);
    const existingVitals = parseExisting(existingPatient?.vitals);
    const existingMedications = parseExisting(existingPatient?.medications);
    const existingEncounters = parseExisting(existingPatient?.encounters || existingPatient?.non_visit_encounters);

    let mergedAllergies = Array.isArray(patient.allergies) && patient.allergies.length ? patient.allergies : existingAllergies;
    let mergedConditions = Array.isArray(patient.conditions) && patient.conditions.length ? patient.conditions : existingConditions;
    let mergedDiagnoses = Array.isArray(patient.diagnoses) && patient.diagnoses.length ? patient.diagnoses : existingDiagnoses;
    let mergedImmunizations = Array.isArray(patient.immunizations) && patient.immunizations.length ? patient.immunizations : existingImmunizations;
    let mergedMedicalHistory = Array.isArray(patient.medicalHistory) && patient.medicalHistory.length ? patient.medicalHistory : existingMedicalHistory;
    let mergedVitals = Array.isArray(patient.vitals) && patient.vitals.length ? patient.vitals : existingVitals;
    let mergedMedications = Array.isArray(patient.medications) && patient.medications.length ? patient.medications : existingMedications;
    
    // Merge encounters: CRITICAL FIX - Use patient.encounters as authoritative source
    // If patient.encounters is provided, use it directly (handles deletions correctly)
    // Only merge if patient.encounters is not provided or undefined
    let mergedEncounters = [];
    if (Array.isArray(patient.encounters)) {
      // patient.encounters is the authoritative source - use it directly
      // This ensures deletions are respected (deleted encounters won't be in the array)
      mergedEncounters = patient.encounters;
    } else if (patient.encounters === null || patient.encounters === undefined) {
      // If encounters is explicitly null/undefined, use existing
      mergedEncounters = existingEncounters;
    } else {
      // Fallback: use existing encounters
      mergedEncounters = existingEncounters;
    }

    // Patient data saved to Supabase (details removed for privacy)
    
    // Merge unstructured records (if they exist)
    // CRITICAL: Always merge arrays, don't replace - combine existing with new
    const existingUnstructuredRecords = parseExisting(existingPatient?.unstructured_records);
    // FIXED: Properly merge arrays - combine new records with existing ones
    // Create a map to avoid duplicates by record ID
    const recordsMap = new Map();
    
    // Add existing records first
    if (Array.isArray(existingUnstructuredRecords)) {
      existingUnstructuredRecords.forEach(record => {
        if (record && record.id) {
          recordsMap.set(record.id, record);
        }
      });
    }
    
    // Add/update with patient's records (these take precedence)
    if (Array.isArray(patient.unstructuredRecords)) {
      patient.unstructuredRecords.forEach(record => {
        if (record && record.id) {
          recordsMap.set(record.id, record);
        }
      });
    }
    
    // Convert map back to array
    let mergedUnstructuredRecords = Array.from(recordsMap.values());
    const updateData = {
      allergies: JSON.stringify(mergedAllergies),
      chronic_conditions: JSON.stringify(mergedConditions),
      diagnoses: JSON.stringify(mergedDiagnoses),
      immunizations: JSON.stringify(mergedImmunizations),
      medical_history: JSON.stringify(mergedMedicalHistory),
      vitals: JSON.stringify(mergedVitals),
      medications: JSON.stringify(mergedMedications),
      prescriptions: JSON.stringify(patient.prescriptions || []),
      unstructured_records: JSON.stringify(mergedUnstructuredRecords),
      updated_at: new Date().toISOString()
    };
    
    // CRITICAL: Always save encounters array (even if empty) to ensure deletions persist
    // Try to save encounters to Supabase, but handle gracefully if column doesn't exist
    let encountersSavedToSupabase = false;
    
    // Always include encounters in the update (even if empty array) to ensure deletions persist
    if (Array.isArray(mergedEncounters)) {
      try {
        // First, try to update with encounters column (always include encounters, even if empty)
        const updateWithEncounters = {
          ...updateData,
          encounters: JSON.stringify(mergedEncounters), // Save array directly (empty or not)
          non_visit_encounters: JSON.stringify(mergedEncounters)
        };
        
        const { error: updateError, data: updateDataResult } = await window.supabaseClient
          .from('patients')
          .update(updateWithEncounters)
          .eq(queryColumn, queryValue)
          .eq('organization_id', orgId)
          .select('unstructured_records');
        
        if (updateError) {
          console.error('❌ [SAVE-PATIENT] Update error:', updateError);
          // If encounters column doesn't exist, try without it
          if (updateError.code === '42703' || updateError.message?.includes('encounters')) {
            console.warn('⚠️ encounters column does not exist, saving without it. Please run the migration script: sql-scripts/add-encounters-column-to-patients.sql');
            // Fall back to saving without encounters column
            const { error: fallbackError, data: fallbackResult } = await window.supabaseClient
              .from('patients')
              .update(updateData)
              .eq(queryColumn, queryValue)
              .eq('organization_id', orgId)
              .select('unstructured_records');
            
            if (fallbackError) {
              console.error('❌ [SAVE-PATIENT] Fallback update error:', fallbackError);
              throw fallbackError;
            }
            
            // Encounters will be saved to localStorage as fallback
            console.warn('⚠️ Encounters saved to localStorage only. Run migration script to enable Supabase persistence.');
            encountersSavedToSupabase = false;
          } else {
            throw updateError;
          }
        } else {
          // Success - encounters saved to Supabase (only log if encounters exist)
          encountersSavedToSupabase = true;
        }
      } catch (err) {
        if (err.code === '42703' || err.message?.includes('encounters')) {
          // Column doesn't exist - save without it
          const { error: fallbackError } = await window.supabaseClient
            .from('patients')
            .update(updateData)
            .eq(queryColumn, queryValue)
            .eq('organization_id', orgId);
          
          if (fallbackError) {
            throw fallbackError;
          }
          console.warn('⚠️ Encounters column does not exist. Saving encounters to localStorage only.');
          encountersSavedToSupabase = false;
        } else {
          throw err;
        }
      }
    } else {
      // If mergedEncounters is not an array, proceed with normal update (shouldn't happen, but handle gracefully)
      const { error } = await window.supabaseClient
        .from('patients')
        .update(updateData)
        .eq(queryColumn, queryValue)
        .eq('organization_id', orgId);
      
      if (error) {
        throw error;
      }
    }
    
    // CRITICAL: Always save encounters to localStorage as fallback
    // This ensures encounters persist even if Supabase column doesn't exist
    if (Array.isArray(mergedEncounters)) {
      patient.encounters = mergedEncounters;
      // Save to localStorage (only log if encounters exist to reduce noise)
      const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      const patientIndex = patients.findIndex(p => p.id === patient.id);
      if (patientIndex !== -1) {
        patients[patientIndex].encounters = mergedEncounters;
        localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        // Only log if there are encounters or if this was an explicit save operation
      }
    }
    
    return true;

    if (error) {
      console.error('❌ Supabase update error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    // Clinical data is now saved directly to patients table above
    // Also save clinical note data to clinical_notes table (DISABLED - using patients table instead)
    const urlParams = new URLSearchParams(window.location.search);
    const visitDate = urlParams.get("visitDate") || new Date().toISOString().split('T')[0];
    
    // Check if we're on clinical-note page (has visitDate) - DISABLED
    if (false && visitDate) {
      // Saving clinical note data to clinical_notes table
      
      // Check if clinical note already exists
      const { data: existingNote, error: selectError } = await window.supabaseClient
        .from('clinical_notes')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('organization_id', orgId)
        .eq('note_date', visitDate)
        .single();

      const clinicalNoteData = {
        patient_id: patient.id,
        organization_id: orgId,
        note_date: visitDate,
        medical_history: JSON.stringify(patient.medicalHistory || []),
        diagnoses: JSON.stringify(patient.diagnoses || []),
        immunizations: JSON.stringify(patient.immunizations || []),
        allergies: JSON.stringify(patient.allergies || [])
      };

      let result;
      if (existingNote) {
        // Update existing clinical note
        result = await window.supabaseClient
          .from('clinical_notes')
          .update(clinicalNoteData)
          .eq('id', existingNote.id);
      } else {
        // Insert new clinical note
        result = await window.supabaseClient
          .from('clinical_notes')
          .insert(clinicalNoteData);
      }

      if (result.error) {
        console.warn('Failed to save clinical note data:', result.error);
        // Don't throw error - patient data was saved successfully
      } else {
        console.log('✅ Clinical note data saved to clinical_notes table');
      }
    }

    // Patient data saved to Supabase successfully
    return true;
  } catch (error) {
    console.error('❌ Error saving patient data to Supabase:', error);
    throw error;
  }
}

// Export savePatientToSupabase to window for use by other scripts
window.savePatientToSupabase = savePatientToSupabase;

// Migrate existing patients to new sequential ID format
function migratePatientIds() {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const orgPrefix = user.org ? user.org.substring(0, 3).toUpperCase() : "ORG";
  
  let hasChanges = false;
  let patientCounter = 1;
  
  // Check if any patients need migration
  const needsMigration = patients.some(patient => 
    !patient.id || !patient.id.match(/^[A-Z]{3}\d{4}$/)
  );
  
  if (!needsMigration) {
    return; // No migration needed
  }
  
  // Sort patients by creation date (oldest first) to maintain order
  const sortedPatients = [...patients].sort((a, b) => {
    // If both have timestamp IDs, sort by ID
    if (a.id && b.id && /^\d+$/.test(a.id) && /^\d+$/.test(b.id)) {
      return parseInt(a.id) - parseInt(b.id);
    }
    // If one has new format, prioritize old format
    if (a.id && a.id.match(/^[A-Z]{3}\d{4}$/)) return 1;
    if (b.id && b.id.match(/^[A-Z]{3}\d{4}$/)) return -1;
    return 0;
  });
  
  // Assign new sequential IDs
  sortedPatients.forEach(patient => {
    if (!patient.id || !patient.id.match(/^[A-Z]{3}\d{4}$/)) {
      const oldId = patient.id;
      patient.id = `${orgPrefix}${patientCounter.toString().padStart(4, '0')}`;
        // Patient ID migrated
      patientCounter++;
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    localStorage.setItem(getDataKey("patients"), JSON.stringify(sortedPatients));
    // Patient ID migration completed
  }
}

const PAGE_SIZE = 10;
let currentPatientPage = 1;
let currentSort = { field: 'name', dir: 1 };

// Temporary arrays for add-patient.html
let tempMedicalHistory = [];
let tempDiagnoses = [];
let tempMedications = [];
let tempAllergies = [];
let tempImmunizations = [];

// Lab tests array for clinical-note.html
const LAB_TESTS = [
  {
    name: "Antistreptolysin O (ASO); titer",
    category: "Medical Microbiology / Serology",
    cpt: "86060",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "ASO titer for detection of recent streptococcal infection. Normal: <200 IU/mL (adults), <170 IU/mL (children). Elevated titers indicate recent Group A streptococcal infection."
  },
  {
    name: "Complete Blood Count (CBC)",
    category: "Haematology",
    cpt: "85025",
    specimen: "Whole blood / 3 mL",
    container: "Lavender (EDTA) tube",
    transport: "Room temperature / Stable 48 hours",
    notes: "Includes differential and platelets."
  },
  {
    name: "Basic Metabolic Panel (BMP)",
    category: "Clinical Chemistry",
    cpt: "80048",
    specimen: "Serum / 1 mL",
    container: "Serum separator tube (SST) or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Includes glucose, electrolytes, BUN, creatinine, calcium."
  },
  {
    name: "Comprehensive Metabolic Panel (CMP)",
    category: "Clinical Chemistry",
    cpt: "80053",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Includes BMP plus liver function tests (ALT, AST, etc.)."
  },
  {
    name: "Lipid Panel",
    category: "Clinical Chemistry",
    cpt: "80061",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Fasting preferred. Measures cholesterol, HDL, LDL, triglycerides."
  },
  {
    name: "Thyroid Stimulating Hormone (TSH)",
    category: "Clinical Chemistry",
    cpt: "84443",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Reflex to Free T4 if abnormal (additional code if reflexed)."
  },
  {
    name: "Glycated Hemoglobin (HbA1c)",
    category: "Clinical Chemistry",
    cpt: "83036",
    specimen: "Whole blood / 1 mL",
    container: "Lavender (EDTA) tube",
    transport: "Room temperature / Stable 7 days",
    notes: "For diabetes monitoring."
  },
  {
    name: "Urinalysis (UA)",
    category: "Clinical Chemistry",
    cpt: "81001",
    specimen: "Urine / 10 mL",
    container: "Sterile urine container",
    transport: "Refrigerated / Stable 72 hours",
    notes: "Complete UA; reflex to microscopic if indicated."
  },
  {
    name: "C-Reactive Protein (CRP)",
    category: "Clinical Chemistry",
    cpt: "86140",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "For inflammation assessment."
  },
  {
    name: "Vitamin D Level (25(OH)D)",
    category: "Clinical Chemistry",
    cpt: "82306",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Total 25-hydroxyvitamin D immunoassay."
  },
  {
    name: "Prothrombin Time with INR (PT/INR)",
    category: "Haematology",
    cpt: "85610",
    specimen: "Plasma / 2.7 mL",
    container: "Light blue (citrate) tube (full draw required)",
    transport: "Room temperature / Stable 24 hours",
    notes: "For coagulation monitoring."
  },
  {
    name: "Prostate-Specific Antigen (PSA)",
    category: "Clinical Chemistry",
    cpt: "84153",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 5 days",
    notes: "For males; screening for prostate issues."
  },
  {
    name: "Hormonal Profile (Panel)",
    category: "Clinical Chemistry",
    cpt: "84146/84403/83001/83002/82670/84144",
    specimen: "Serum / 3-5 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Panel includes Prolactin, Testosterone (Total), FSH, LH, Estrogen (E2), and Progesterone. Prefer morning collection for testosterone.",
    panelTests: [
      "Prolactin",
      "Testosterone (Total)",
      "Follicle Stimulating Hormone (FSH)",
      "Luteinizing Hormone (LH)",
      "Estrogen (E2)",
      "Progesterone"
    ]
  },
  {
    name: "Prolactin",
    category: "Clinical Chemistry",
    cpt: "84146",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Reference ranges vary by sex and pregnancy status."
  },
  {
    name: "Testosterone (Total)",
    category: "Clinical Chemistry",
    cpt: "84403",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Prefer morning draw. Reference ranges vary by sex and age."
  },
  {
    name: "Follicle Stimulating Hormone (FSH)",
    category: "Clinical Chemistry",
    cpt: "83001",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Reference ranges vary by sex and menstrual phase."
  },
  {
    name: "Luteinizing Hormone (LH)",
    category: "Clinical Chemistry",
    cpt: "83002",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Reference ranges vary by sex and menstrual phase."
  },
  {
    name: "Estrogen (E2)",
    category: "Clinical Chemistry",
    cpt: "82670",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Reference ranges vary by sex, menstrual phase, and reproductive status."
  },
  {
    name: "Progesterone",
    category: "Clinical Chemistry",
    cpt: "84144",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Reference ranges vary by menstrual phase or pregnancy."
  },
  {
    name: "Random Blood Sugar (RBS)",
    category: "Clinical Chemistry",
    cpt: "82947",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 24 hours",
    notes: "No fasting required. Random glucose level."
  },
  {
    name: "Fasting Blood Sugar (FBS)",
    category: "Clinical Chemistry",
    cpt: "82947",
    specimen: "Serum / 1 mL",
    container: "Gray-top (fluoride/oxalate) tube or SST",
    transport: "Refrigerated / Stable 24 hours",
    notes: "Fasting required (8-12 hours). Also known as Fasting Blood Glucose."
  },
  {
    name: "2-Hour Postprandial Glucose",
    category: "Clinical Chemistry",
    cpt: "82950",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 24 hours",
    notes: "Blood drawn 2 hours after meal. Normal <140 mg/dL (<7.8 mmol/L). Used for diabetes screening and monitoring."
  },
  {
    name: "Urine MCS (Urine Culture and Sensitivity)",
    category: "Medical Microbiology / Serology",
    cpt: "87086",
    specimen: "Urine / 10-20 mL (midstream clean catch)",
    container: "Sterile urine container",
    transport: "Refrigerated / Must be cultured within 2 hours or preserved",
    notes: "Culture for bacterial identification and antibiotic susceptibility testing. Midstream clean catch preferred. Colony count ≥10^5 CFU/mL indicates significant bacteriuria."
  },
  {
    name: "Stool MCS (Stool Culture and Sensitivity)",
    category: "Medical Microbiology / Serology",
    cpt: "87045/87046/87427",
    specimen: "Stool / 5-10 g",
    container: "Sterile stool container",
    transport: "Refrigerated / Transport within 2 hours or use transport medium",
    notes: "Culture for enteric pathogens with sensitivity testing as indicated. Includes qualitative pathogen reporting."
  },
  {
    name: "High Vaginal Swab (HVS)",
    category: "Medical Microbiology / Serology",
    cpt: "87070/87481/87661/81513",
    specimen: "High vaginal swab",
    container: "Sterile swab with transport medium",
    transport: "Room temperature / Transport within 2 hours",
    notes: "Qualitative reporting for flora/pathogens; consider NAAT panel when indicated."
  },
  {
    name: "Blood Group (ABO and Rh Factor)",
    category: "Haematology",
    cpt: "86900",
    specimen: "Whole blood / 2 mL",
    container: "Lavender (EDTA) tube or red-top tube",
    transport: "Room temperature / Stable 7 days",
    notes: "ABO blood group and Rh (D) antigen typing."
  },
  {
    name: "Hemoglobin Genotype",
    category: "Haematology",
    cpt: "83020",
    specimen: "Whole blood / 3 mL",
    container: "Lavender (EDTA) tube",
    transport: "Room temperature / Stable 7 days",
    notes: "Hemoglobin electrophoresis for genotype (AA, AS, SS, SC, etc.)."
  },
  {
    name: "Packed Cell Volume (PCV / Hematocrit)",
    category: "Haematology",
    cpt: "85014",
    specimen: "Whole blood / 2 mL",
    container: "Lavender (EDTA) tube",
    transport: "Room temperature / Stable 24 hours",
    notes: "Hematocrit measurement. Often included in CBC."
  },
  {
    name: "Hemoglobin Concentration (HB)",
    category: "Haematology",
    cpt: "85018",
    specimen: "Whole blood / 2 mL",
    container: "Lavender (EDTA) tube",
    transport: "Room temperature / Stable 24 hours",
    notes: "Hemoglobin level measurement. Often included in CBC."
  },
  {
    name: "Erythrocyte Sedimentation Rate (ESR)",
    category: "Haematology",
    cpt: "85651",
    specimen: "Whole blood / 2 mL",
    container: "Lavender (EDTA) tube or black-top (sodium citrate) tube",
    transport: "Room temperature / Must be tested within 4 hours",
    notes: "Westergren method preferred. Indicates inflammation."
  },
  {
    name: "Widal Test (Typhoid Fever Serology)",
    category: "Medical Microbiology / Serology",
    cpt: "86780",
    specimen: "Serum / 2 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Agglutination test for Salmonella typhi and paratyphi antibodies."
  },
  {
    name: "Malaria Parasite (Blood Film for MP)",
    category: "Haematology",
    cpt: "87207",
    specimen: "Whole blood / 2 mL",
    container: "Lavender (EDTA) tube",
    transport: "Room temperature / Must be tested within 6 hours",
    notes: "Thick and thin blood films for malaria parasite detection."
  },
  {
    name: "Pregnancy Test (hCG)",
    category: "Medical Microbiology / Serology",
    cpt: "84703",
    specimen: "Urine / 10 mL or Serum / 1 mL",
    container: "Sterile urine container or SST",
    transport: "Room temperature (urine) / Refrigerated (serum) / Stable 7 days",
    notes: "Qualitative hCG test. Urine or serum. Can detect pregnancy early."
  },
  {
    name: "VDRL (Syphilis Screening)",
    category: "Medical Microbiology / Serology",
    cpt: "86592",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Venereal Disease Research Laboratory test for syphilis screening."
  },
  {
    name: "HIV Screening (HIV 1 & 2 Antibodies)",
    category: "Medical Microbiology / Serology",
    cpt: "86703",
    specimen: "Serum / 2 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "HIV-1/HIV-2 antibody screen. Requires consent and counseling."
  },
  {
    name: "Hepatitis B Surface Antigen (HBsAg)",
    category: "Medical Microbiology / Serology",
    cpt: "87340",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "HBsAg screening. Can be ordered alone or as part of Hepatitis B Profile."
  },
  {
    name: "Hepatitis B Profile",
    category: "Medical Microbiology / Serology",
    cpt: "87340/86706/87350/86707/86704",
    specimen: "Serum / 2-3 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Panel includes HBsAg, HBsAb, HBeAg, HBeAb, HBcAb. HBsAg can be ordered separately.",
    panelTests: [
      "HBsAg (Hepatitis B Surface Antigen)",
      "HBsAb (Hepatitis B Surface Antibody)",
      "HBeAg (Hepatitis B e Antigen)",
      "HBeAb (Hepatitis B e Antibody)",
      "HBcAb (Hepatitis B Core Antibody)"
    ]
  },
  {
    name: "Hepatitis C Virus Antibody (Anti-HCV)",
    category: "Medical Microbiology / Serology",
    cpt: "86803",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "HCV antibody screening test. Reflex to HCV RNA if positive."
  },
  {
    name: "Tuberculosis Screening (TB)",
    category: "Medical Microbiology / Serology",
    cpt: "87555",
    specimen: "Sputum / 3-5 mL or Whole blood / 2 mL",
    container: "Sterile sputum container or Lavender (EDTA) tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Sputum AFB smear/culture or GeneXpert MTB/RIF. Blood test for IGRA available."
  },
  {
    name: "Helicobacter pylori Test",
    category: "Medical Microbiology / Serology",
    cpt: "87338",
    specimen: "Serum / 1 mL or Stool / 1 g or Breath sample",
    container: "SST (serum) or Stool container or Breath test kit",
    transport: "Refrigerated / Stable 7 days (serum/stool) or Room temp (breath)",
    notes: "Serology, stool antigen, or urea breath test for H. pylori detection."
  },
  {
    name: "Calcium Lab Test",
    category: "Clinical Chemistry",
    cpt: "82310",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Total serum calcium. May include ionized calcium if indicated."
  },
  {
    name: "Liver Function Test (LFT)",
    category: "Clinical Chemistry",
    cpt: "80076",
    specimen: "Serum / 2 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Includes AST, ALT, Alkaline Phosphatase, Total Bilirubin, Conjugate Bilirubin, Unconjugate Bilirubin, Total Protein, Albumin, Globulin."
  },
  {
    name: "Electrolytes, Urea, and Creatinine (EUC) Test",
    category: "Clinical Chemistry",
    cpt: "80051",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "Includes Sodium, Potassium, Chloride, Bicarbonate, Urea, and Creatinine."
  },
  {
    name: "Uric Acid Test",
    category: "Clinical Chemistry",
    cpt: "84520",
    specimen: "Serum / 1 mL",
    container: "SST or red-top tube",
    transport: "Refrigerated / Stable 7 days",
    notes: "For gout monitoring and kidney function assessment."
  },
  {
    name: "Clotting Profile (Coagulation Panel)",
    category: "Haematology",
    cpt: "85610/85730",
    specimen: "Plasma / 2.7 mL per tube (citrated plasma); serum if additional tests",
    container: "Light blue-top (sodium citrate) tube; red-top for serum",
    transport: "Room temperature / Stable 24 hours; frozen for extended storage",
    notes: "Assesses blood clotting factors for bleeding or thrombotic disorders. Often includes PT/INR and aPTT; comprehensive profiles may add Thrombin Time or D-Dimer."
  },
  {
    name: "Sputum MCS (Microscopy, Culture, and Sensitivity)",
    category: "Medical Microbiology / Serology",
    cpt: "87070/87205",
    specimen: "Sputum / 2 mL (early morning deep cough sample)",
    container: "Sterile container",
    transport: "Room temperature; refrigerate if delayed / Stable 24-48 hours",
    notes: "Cultures sputum for bacteria with Gram stain and sensitivity if positive. For diagnosing lower respiratory infections like pneumonia."
  },
  {
    name: "Blood Culture",
    category: "Medical Microbiology / Serology",
    cpt: "87040",
    specimen: "Whole blood / 8-10 mL per bottle (adult); 1-4 mL pediatric",
    container: "Aerobic and anaerobic blood culture bottles",
    transport: "Room temperature / Stable 24 hours",
    notes: "Cultures blood for aerobic and anaerobic bacteria to detect bacteremia or septicemia. If positive, additional ID and susceptibility testing."
  },
  {
    name: "Blood Film (Peripheral Blood Smear)",
    category: "Haematology",
    cpt: "85007/85008",
    specimen: "Whole blood / 3 mL or prepared slides",
    container: "Lavender-top (EDTA) tube",
    transport: "Refrigerated / Stable 24-48 hours",
    notes: "Examines blood cell morphology for abnormalities like anemia or infections. Manual review for atypical findings."
  }
];

// Sort LAB_TESTS by category (per Excel), then alphabetically by name within category
const LAB_CATEGORY_ORDER = ['Haematology', 'Medical Microbiology / Serology', 'Clinical Chemistry'];
LAB_TESTS.sort((a, b) => {
  const catA = LAB_CATEGORY_ORDER.indexOf(a.category || '') >= 0 ? LAB_CATEGORY_ORDER.indexOf(a.category) : 999;
  const catB = LAB_CATEGORY_ORDER.indexOf(b.category || '') >= 0 ? LAB_CATEGORY_ORDER.indexOf(b.category) : 999;
  if (catA !== catB) return catA - catB;
  const nameA = (a.name || '').toLowerCase();
  const nameB = (b.name || '').toLowerCase();
  return nameA.localeCompare(nameB);
});

const IMAGING_TESTS = [{'name': 'Chest X-ray', 'cpt': '71046', 'modality': 'X-ray', 'preparation': 'Remove upper body clothing and jewelry; wear gown.', 'contrast': 'No', 'notes': 'PA and lateral views; for respiratory symptoms or screening.'}, {'name': 'Abdominal X-ray', 'cpt': '74019', 'modality': 'X-ray', 'preparation': 'Remove clothing over abdomen; may need to hold breath.', 'contrast': 'No', 'notes': '2 views (supine/upright); for GI issues like obstruction.'}, {'name': 'Extremity X-ray', 'cpt': '73562', 'modality': 'X-ray', 'preparation': 'Remove clothing/jewelry from affected limb; immobilize as needed.', 'contrast': 'No', 'notes': 'Example for knee (3 views); specify body part in order.'}, {'name': 'Mammography', 'cpt': '77067', 'modality': 'Mammography', 'preparation': 'No deodorant, powder, powder; wear two-piece clothing; bring priors.', 'contrast': 'No', 'notes': 'Bilateral screening; for breast cancer detection.'}, {'name': 'Bone Density Scan', 'cpt': '77080', 'modality': 'DEXA', 'preparation': 'Avoid calcium supplements 24 hours prior; no recent barium exams.', 'contrast': 'No', 'notes': 'Axial skeleton; for osteoporosis risk assessment.'}, {'name': 'Abdominal Ultrasound', 'cpt': '76700', 'modality': 'Ultrasound', 'preparation': 'NPO 6-8 hours prior; drink water if needed for bladder.', 'contrast': 'No', 'notes': 'Complete exam; for organ evaluation like liver/kidneys.'}, {'name': 'Pelvic Ultrasound', 'cpt': '76856', 'modality': 'Ultrasound', 'preparation': 'Drink 32 oz water 1 hour prior for full bladder; may undress.', 'contrast': 'No', 'notes': 'Transabdominal; add transvaginal if indicated (CPT 76830).'}, {'name': 'Thyroid Ultrasound', 'cpt': '76536', 'modality': 'Ultrasound', 'preparation': 'None specific; expose neck area.', 'contrast': 'No', 'notes': 'Soft tissue neck; for nodules or enlargement.'}, {'name': 'Head CT (Noncontrast)', 'cpt': '70450', 'modality': 'CT', 'preparation': 'None; remove headwear/jewelry.', 'contrast': 'No', 'notes': 'For acute neurological issues; avoid if pregnant.'}, {'name': 'Abdomen/Pelvis CT', 'cpt': '74177', 'modality': 'CT', 'preparation': 'NPO 4 hours; arrive early for oral contrast if ordered.', 'contrast': 'Yes (IV/Oral)', 'notes': 'With contrast; for detailed abdominal evaluation.'}, {'name': 'Brain MRI', 'cpt': '70553', 'modality': 'MRI', 'preparation': 'Screen for metal implants/claustrophobia; remove metal objects.', 'contrast': 'Yes (IV Optional)', 'notes': 'With and without contrast; for brain pathology.'}, {'name': 'Lumbar Spine MRI', 'cpt': '72148', 'modality': 'MRI', 'preparation': 'Screen for contraindications; may take 30-60 min.', 'contrast': 'No', 'notes': 'Without contrast; for disc/nerve issues.'}];

// Expose globally for order pages - MUST be after both arrays are declared
/** Get category for a lab test by name (for result display). */
function getLabTestCategory(testName) {
  if (!testName) return null;
  const t = LAB_TESTS.find(x => x.name === testName);
  return t ? t.category : null;
}

if (typeof window !== 'undefined') {
  window.LAB_TESTS = LAB_TESTS;
  window.IMAGING_TESTS = IMAGING_TESTS;
  window.getLabTestCategory = getLabTestCategory;

  /** DB rows use selected_items; in-memory orders use selectedItems; value may be a JSON string. */
  window.mfNormalizeOrderSelectedItems = function (order) {
    if (!order || typeof order !== 'object') return [];
    let sel =
      order.selectedItems != null && order.selectedItems !== ''
        ? order.selectedItems
        : order.selected_items;
    if (typeof sel === 'string') {
      try {
        sel = JSON.parse(sel);
      } catch (e) {
        sel = [];
      }
    }
    if (!Array.isArray(sel)) sel = [];
    return sel;
  };

  /** Normalize lab/imaging test labels for matching (orders may differ slightly from catalog). */
  window.mfNormalizeLabTestDisplayName = function (s) {
    return String(s || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[–—]/g, '-')
      .toLowerCase();
  };

  window.mfLooseLabNameMatch = function (a, b) {
    const na = window.mfNormalizeLabTestDisplayName(a);
    const nb = window.mfNormalizeLabTestDisplayName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.length < 6 || nb.length < 6) return false;
    if (na.includes(nb) || nb.includes(na)) return true;
    const strip = function (x) {
      return x.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const wa = strip(na)
      .split(' ')
      .filter(function (w) {
        return w.length > 1;
      });
    const sb = new Set(
      strip(nb)
        .split(' ')
        .filter(function (w) {
          return w.length > 1;
        })
    );
    var inter = 0;
    for (var i = 0; i < wa.length; i++) {
      if (sb.has(wa[i])) inter++;
    }
    return inter >= 3;
  };

  window.mfResolveLabCatalogEntryForDisplay = function (item) {
    var tests = LAB_TESTS;
    if (!tests.length) return null;
    var obj = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    var rawName = typeof item === 'string' ? item : (obj.name || obj.testName || obj.test_name || '');
    var nameKey = String(rawName).trim();
    var norm = window.mfNormalizeLabTestDisplayName(nameKey);

    var catalog = null;
    if (nameKey) {
      catalog = tests.find(function (t) {
        return t.name === nameKey;
      });
      if (!catalog) {
        catalog = tests.find(function (t) {
          return window.mfNormalizeLabTestDisplayName(t.name) === norm;
        });
      }
      if (!catalog) {
        catalog = tests.find(function (t) {
          if (!t.panelTests || !t.panelTests.length) return false;
          return t.panelTests.some(function (p) {
            return (
              p === nameKey ||
              window.mfNormalizeLabTestDisplayName(p) === norm ||
              window.mfLooseLabNameMatch(p, nameKey)
            );
          });
        });
      }
      if (!catalog) {
        catalog = tests.find(function (t) {
          return window.mfLooseLabNameMatch(t.name, nameKey);
        });
      }
    }

    var itemCpt = obj.cpt != null ? String(obj.cpt).trim() : '';
    var itemTokens = itemCpt
      ? itemCpt.split(/[/,;]+/).map(function (s) {
          return s.trim();
        }).filter(Boolean)
      : [];

    if (!catalog && itemTokens.length) {
      var best = null;
      var bestScore = 0;
      tests.forEach(function (t) {
        if (!t.cpt) return;
        var catTokens = String(t.cpt)
          .split(/[/,;]+/)
          .map(function (s) {
            return s.trim();
          }).filter(Boolean);
        if (!catTokens.length) return;
        var score = 0;
        if (itemTokens.length === catTokens.length) {
          var same = itemTokens.slice().sort().join(',') === catTokens.slice().sort().join(',');
          if (same) score = 5;
        }
        if (!score && itemTokens.every(function (x) { return catTokens.indexOf(x) >= 0; })) {
          score = itemTokens.length === catTokens.length ? 5 : 4;
        }
        if (!score && itemTokens.length === 1 && catTokens.indexOf(itemTokens[0]) >= 0) score = 3;
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      });
      if (bestScore >= 3) catalog = best;
    }

    return catalog || null;
  };

  window.mfMergeLabOrderItemWithCatalog = function (item) {
    var obj = item && typeof item === 'object' && !Array.isArray(item) ? Object.assign({}, item) : {};
    if (typeof item === 'string') obj.name = String(item).trim();
    var catalog = window.mfResolveLabCatalogEntryForDisplay(item);
    var merged = Object.assign({}, catalog || {});
    ['name', 'cpt', 'specimen', 'container', 'transport', 'notes', 'category'].forEach(function (k) {
      var v = obj[k];
      if (v != null && String(v).trim() !== '') merged[k] = v;
    });
    var nameKey = String(obj.name || obj.testName || obj.test_name || '').trim();
    if (!merged.name && nameKey) merged.name = nameKey;
    return merged;
  };

  window.mfResolveImagingCatalogEntryForDisplay = function (item) {
    var tests = IMAGING_TESTS;
    if (!tests.length) return null;
    var obj = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    var rawName = typeof item === 'string' ? item : (obj.name || obj.testName || obj.test_name || '');
    var nameKey = String(rawName).trim();
    var norm = window.mfNormalizeLabTestDisplayName(nameKey);

    var catalog = null;
    if (nameKey) {
      catalog = tests.find(function (t) {
        return t.name === nameKey;
      });
      if (!catalog) {
        catalog = tests.find(function (t) {
          return window.mfNormalizeLabTestDisplayName(t.name) === norm;
        });
      }
      if (!catalog) {
        catalog = tests.find(function (t) {
          return window.mfLooseLabNameMatch(t.name, nameKey);
        });
      }
    }

    var itemCpt = obj.cpt != null ? String(obj.cpt).trim() : '';
    if (!catalog && itemCpt) {
      catalog = tests.find(function (t) {
        return t.cpt && String(t.cpt).trim() === itemCpt;
      });
    }

    return catalog || null;
  };

  window.mfMergeImagingOrderItemWithCatalog = function (item) {
    var obj = item && typeof item === 'object' && !Array.isArray(item) ? Object.assign({}, item) : {};
    if (typeof item === 'string') obj.name = String(item).trim();
    var catalog = window.mfResolveImagingCatalogEntryForDisplay(item);
    var merged = Object.assign({}, catalog || {});
    ['name', 'cpt', 'modality', 'preparation', 'contrast', 'notes'].forEach(function (k) {
      var v = obj[k];
      if (v != null && String(v).trim() !== '') merged[k] = v;
    });
    var nameKey = String(obj.name || obj.testName || obj.test_name || '').trim();
    if (!merged.name && nameKey) merged.name = nameKey;
    return merged;
  };
}

function expandLabPanelNames(selectedItems) {
  if (!Array.isArray(selectedItems)) return [];
  const expanded = [];
  
  selectedItems.forEach(item => {
    const name = (item && typeof item === 'object') ? item.name : item;
    if (!name) return;
    const panel = LAB_TESTS.find(test => test.name === name && Array.isArray(test.panelTests) && test.panelTests.length > 0);
    if (panel) {
      panel.panelTests.forEach(panelName => expanded.push(panelName));
    } else {
      expanded.push(name);
    }
  });
  
  return Array.from(new Set(expanded));
}

/** For display only: collapse expanded panel sub-tests back to panel name so "Hepatitis B Profile" and "Hormonal Profile (Panel)" show as one line each. */
function collapsePanelNamesForDisplay(selectedItems) {
  if (!Array.isArray(selectedItems) || selectedItems.length === 0) return [];
  const names = selectedItems.map(item => (typeof item === 'object' && item != null) ? (item.name || item.testName || '') : String(item)).filter(Boolean);
  const nameSet = new Set(names);
  const out = [];
  const used = new Set();
  LAB_TESTS.forEach(test => {
    if (!test.panelTests || test.panelTests.length === 0) return;
    const allPresent = test.panelTests.every(t => nameSet.has(t));
    const noneUsed = test.panelTests.every(t => !used.has(t));
    if (allPresent && noneUsed) {
      out.push(test.name);
      test.panelTests.forEach(t => used.add(t));
    }
  });
  names.forEach(n => {
    if (!used.has(n)) out.push(n);
  });
  return out.length > 0 ? out : names;
}

if (typeof window !== 'undefined') {
  window.expandLabPanelNames = expandLabPanelNames;
}

// Function to add history entry on add-patient.html
window.addHistoryEntry = function() {
  const date = document.getElementById("history-date").value;
  const event = document.getElementById("history-event").value;
  const notes = document.getElementById("history-notes").value;
  let filledCount = 0;
  if (date) filledCount++;
  if (event) filledCount++;
  if (notes) filledCount++;
  if (filledCount < 2) {
    alert("Please enter at least two fields.");
    return;
  }
  if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    alert("Please enter date in YYYY-MM-DD format.");
    return;
  }
  tempMedicalHistory.push({ date, event, notes });
  displayTempTable('history-table', tempMedicalHistory, ['date', 'event', 'notes']);
  document.getElementById("add-history-form").reset();
};

// Function to add diagnosis entry on add-patient.html
window.addDiagnosisEntry = function() {
  const date = document.getElementById("diagnosis-date").value;
  const diagnosis = document.getElementById("diagnosis").value;
  const notes = document.getElementById("diagnosis-notes").value;
  let filledCount = 0;
  if (date) filledCount++;
  if (diagnosis) filledCount++;
  if (notes) filledCount++;
  if (filledCount < 2) {
    alert("Please enter at least two fields.");
    return;
  }
  if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    alert("Please enter date in YYYY-MM-DD format.");
    return;
  }
  tempDiagnoses.push({ date, diagnosis, notes });
  displayTempTable('diagnoses-table', tempDiagnoses, ['date', 'diagnosis', 'notes']);
  document.getElementById("add-diagnosis-form").reset();
};

// ICD Search functionality for add-patient.html
function setupIcdSearch() {
  const getIcdResults = (query) => {
    if (typeof window.searchLocalCodesOptimized === 'function') {
      return window.searchLocalCodesOptimized(query, 50);
    }
    if (typeof searchLocalCodes === 'function') {
      return searchLocalCodes(query);
    }
    return [];
  };

  const loadIcdCodes = async () => {
    if (typeof window.getActiveIcdCodes === 'function' && window.getActiveIcdCodes().length) return;
    if (typeof window.loadIcdCodes === 'function') {
      await window.loadIcdCodes();
    }
  };

  const debounce = (fn, delay = 250) => {
    let timer = null;
    return function(...args) {
      const context = this;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => fn.apply(context, args), delay);
    };
  };

  const showInitialIcdResults = async (resultsDiv, targetInputId) => {
    await loadIcdCodes();
    let initial = [];
    if (typeof window.getIcdInitialSuggestions === 'function') {
      initial = window.getIcdInitialSuggestions(20);
    } else if (typeof window.getActiveIcdCodes === 'function' && window.getActiveIcdCodes().length) {
      initial = window.getActiveIcdCodes().slice(0, 20);
    }
    if (initial.length) {
      displayIcdResults(initial, resultsDiv, targetInputId);
    }
  };

  // Setup ICD search for medical history (using the history-event field directly)
  const historyEventInput = document.getElementById('history-event');
  const historyResultsDiv = document.getElementById('icd-results-history');
  
  if (historyEventInput && historyResultsDiv && historyEventInput.dataset.icdSearchBound !== 'true') {
    historyEventInput.dataset.icdSearchBound = 'true';
    const handleHistoryInput = debounce(async function() {
      const query = this.value.trim();
      if (query.length >= 2) {
        await loadIcdCodes();
        const results = getIcdResults(query);
        displayIcdResults(results, historyResultsDiv, 'history-event', query);
      } else {
        historyResultsDiv.style.display = 'none';
      }
    }, 250);

    historyEventInput.addEventListener('input', handleHistoryInput);
    historyEventInput.addEventListener('focus', () => showInitialIcdResults(historyResultsDiv, 'history-event'));
    historyEventInput.addEventListener('click', () => showInitialIcdResults(historyResultsDiv, 'history-event'));
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
      if (!historyEventInput.contains(e.target) && !historyResultsDiv.contains(e.target)) {
        historyResultsDiv.style.display = 'none';
      }
    });
  }
  
  // Setup ICD search for diagnoses (using the diagnosis field directly)
  const diagnosisInput = document.getElementById('diagnosis');
  const diagnosisResultsDiv = document.getElementById('icd-results-diagnosis');
  
  if (diagnosisInput && diagnosisResultsDiv && diagnosisInput.dataset.icdSearchBound !== 'true') {
    diagnosisInput.dataset.icdSearchBound = 'true';
    const handleDiagnosisInput = debounce(async function() {
      const query = this.value.trim();
      if (query.length >= 2) {
        await loadIcdCodes();
        const results = getIcdResults(query);
        displayIcdResults(results, diagnosisResultsDiv, 'diagnosis', query);
      } else {
        diagnosisResultsDiv.style.display = 'none';
      }
    }, 250);

    diagnosisInput.addEventListener('input', handleDiagnosisInput);
    diagnosisInput.addEventListener('focus', () => showInitialIcdResults(diagnosisResultsDiv, 'diagnosis'));
    diagnosisInput.addEventListener('click', () => showInitialIcdResults(diagnosisResultsDiv, 'diagnosis'));
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
      if (!diagnosisInput.contains(e.target) && !diagnosisResultsDiv.contains(e.target)) {
        diagnosisResultsDiv.style.display = 'none';
      }
    });
  }
}

// Display ICD search results
function displayIcdResults(results, resultsDiv, targetInputId, query = '') {
  if (!results || results.length === 0) {
    const safeQuery = (query || '').trim();
    if (safeQuery.length >= 2) {
      const safeLabel = safeQuery.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      resultsDiv.innerHTML = `
        <div style="padding: 10px; color: #666;">No results found</div>
        <div class="icd-result-item" data-icd-custom="true" data-icd-custom-text="${safeQuery.replace(/"/g, '&quot;')}" style="padding: 8px; cursor: pointer; border-top: 1px solid #eee; background: #f8f9fa;"
             onclick="selectCustomIcdEntry('${safeQuery.replace(/'/g, "\\'")}', '${targetInputId}')">
          ➕ Use custom entry: <strong>${safeLabel}</strong>
        </div>
      `;
    } else {
    resultsDiv.innerHTML = '<div style="padding: 10px; color: #666;">No results found</div>';
    }
    resultsDiv.style.display = 'block';
    return;
  }
  
  const html = results.map(result => 
    `<div class="icd-result-item" data-icd-code="${String(result.code || '').replace(/"/g, '&quot;')}" data-icd-title="${String(result.title || '').replace(/"/g, '&quot;')}" style="padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;" 
         onclick="selectIcdResult('${result.code}', '${result.title.replace(/'/g, "\\'")}', '${targetInputId}')">
       <strong>${result.code}</strong> - ${result.title}
     </div>`
  ).join('');
  
  resultsDiv.innerHTML = html;
  resultsDiv.style.display = 'block';
}

// Force-show ICD dropdown (used on pages where fields are toggled dynamically)
window.showIcdDropdown = async function(targetInputId, resultsDivId) {
  try {
    console.log('[ICD] showIcdDropdown called', { targetInputId, resultsDivId });
    if (typeof window.loadIcdCodes === 'function') {
      await window.loadIcdCodes();
    }
    const resultsDiv = document.getElementById(resultsDivId);
    if (!resultsDiv) {
      console.warn('[ICD] results container missing', resultsDivId);
      return;
    }
    let initial = [];
    if (typeof window.getIcdInitialSuggestions === 'function') {
      initial = window.getIcdInitialSuggestions(20);
    } else if (typeof window.getActiveIcdCodes === 'function' && window.getActiveIcdCodes().length) {
      initial = window.getActiveIcdCodes().slice(0, 20);
    }
    console.log('[ICD] initial suggestions count', initial.length);
    if (initial.length) {
      displayIcdResults(initial, resultsDiv, targetInputId, '');
    }
  } catch (error) {
    console.warn('[ICD] showIcdDropdown failed', error);
  }
};

window.filterIcdDropdown = async function(targetInputId, resultsDivId, query) {
  try {
    const normalized = (query || '').trim();
    console.log('[ICD] filterIcdDropdown called', { targetInputId, resultsDivId, query: normalized });
    if (normalized.length < 2) {
      const resultsDiv = document.getElementById(resultsDivId);
      if (resultsDiv) {
        resultsDiv.style.display = 'none';
      }
      return;
    }
    if (typeof window.loadIcdCodes === 'function') {
      await window.loadIcdCodes();
    }
    const resultsDiv = document.getElementById(resultsDivId);
    if (!resultsDiv) return;
    let results = [];
    if (typeof window.searchLocalCodesOptimized === 'function') {
      results = window.searchLocalCodesOptimized(normalized, 50);
    } else if (typeof searchLocalCodes === 'function') {
      results = searchLocalCodes(normalized);
    }
    displayIcdResults(results, resultsDiv, targetInputId, normalized);
  } catch (error) {
    console.warn('[ICD] filterIcdDropdown failed', error);
  }
};

function selectCustomIcdEntry(text, targetInputId) {
  const targetInput = document.getElementById(targetInputId);
  if (targetInput) {
    targetInput.value = text;
  }
  const resultsDiv = targetInputId === 'history-event' ?
    document.getElementById('icd-results-history') :
    document.getElementById('icd-results-diagnosis');
  if (resultsDiv) {
    resultsDiv.style.display = 'none';
  }
}

// Select ICD result and populate target input
function selectIcdResult(code, title, targetInputId) {
  const targetInput = document.getElementById(targetInputId);
  if (targetInput) {
    targetInput.value = `${code} - ${title}`;
  }
  
  // Hide results
  const resultsDiv = targetInputId === 'history-event' ? 
    document.getElementById('icd-results-history') : 
    document.getElementById('icd-results-diagnosis');
  if (resultsDiv) {
    resultsDiv.style.display = 'none';
  }
}

// Ensure selection helpers are available globally for inline handlers
if (typeof window !== 'undefined') {
  window.selectIcdResult = selectIcdResult;
  window.selectCustomIcdEntry = selectCustomIcdEntry;
}

// Ensure ICD search is bound even when fields are injected later (e.g., hidden forms)
function ensureIcdSearchBound() {
  const historyInput = document.getElementById('history-event');
  const diagnosisInput = document.getElementById('diagnosis');
  const historyResults = document.getElementById('icd-results-history');
  const diagnosisResults = document.getElementById('icd-results-diagnosis');

  if ((historyInput || diagnosisInput) && (historyResults || diagnosisResults)) {
    if (typeof setupIcdSearch === 'function') {
      setupIcdSearch();
    }
  }

  // Avoid repeated re-binding on static forms (intake/add/edit) when dropdown mutations occur
  const isStaticForm = !!(document.getElementById('patient-intake-form')
    || document.getElementById('add-patient-form')
    || document.getElementById('edit-patient-form'));
  const historyBound = !historyInput || historyInput.dataset.icdSearchBound === 'true';
  const diagnosisBound = !diagnosisInput || diagnosisInput.dataset.icdSearchBound === 'true';
  if (isStaticForm && historyBound && diagnosisBound && window.__icdSearchObserver) {
    window.__icdSearchObserver.disconnect();
    window.__icdSearchObserver = null;
  }
}

if (typeof window !== 'undefined') {
  const isPatientIntake = !!document.getElementById('patient-intake-form');
  if (!isPatientIntake) {
    if (!window.__icdSearchObserver) {
      const startObserver = () => {
        if (window.__icdSearchObserver || !document.body) return;
        window.__icdSearchObserver = new MutationObserver(() => ensureIcdSearchBound());
        window.__icdSearchObserver.observe(document.body, { childList: true, subtree: true });
      };
      const onReady = () => {
        ensureIcdSearchBound();
        startObserver();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady, { once: true });
      } else {
        onReady();
      }
    }

  // Fallback delegated handlers for filtering/showing (only when results containers exist)
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!target) return;
    if (target.id === 'history-event' && document.getElementById('icd-results-history')) {
      if (typeof window.showIcdDropdown === 'function') {
        window.showIcdDropdown('history-event', 'icd-results-history');
      }
    }
    if (target.id === 'diagnosis' && document.getElementById('icd-results-diagnosis')) {
      if (typeof window.showIcdDropdown === 'function') {
        window.showIcdDropdown('diagnosis', 'icd-results-diagnosis');
      }
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!target) return;
    if (target.dataset && target.dataset.icdSearchBound === 'true') return;
    if (!window.__icdDelegatedTimers) window.__icdDelegatedTimers = {};
    const runFilter = (inputId, resultsId) => {
      const key = `${inputId}:${resultsId}`;
      if (window.__icdDelegatedTimers[key]) {
        clearTimeout(window.__icdDelegatedTimers[key]);
      }
      window.__icdDelegatedTimers[key] = setTimeout(() => {
        if (typeof window.filterIcdDropdown === 'function') {
          window.filterIcdDropdown(inputId, resultsId, target.value);
        }
      }, 200);
    };
    if (target.id === 'history-event' && document.getElementById('icd-results-history')) {
      runFilter('history-event', 'icd-results-history');
    }
    if (target.id === 'diagnosis' && document.getElementById('icd-results-diagnosis')) {
      runFilter('diagnosis', 'icd-results-diagnosis');
    }
  });
  }
}

// Function to add medication entry on add-patient.html
window.addMedicationEntry = function() {
  const name = document.getElementById("med-name").value;
  const dosage = document.getElementById("med-dosage").value;
  const startDate = document.getElementById("med-start").value;
  const endDate = document.getElementById("med-end").value;
  const notes = document.getElementById("med-notes").value;
  let filledCount = 0;
  if (name) filledCount++;
  if (dosage) filledCount++;
  if (startDate) filledCount++;
  if (endDate) filledCount++;
  if (notes) filledCount++;
  if (filledCount < 2) {
    alert("Please enter at least two fields.");
    return;
  }
  if (startDate && !startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    alert("Please enter start date in YYYY-MM-DD format.");
    return;
  }
  if (endDate && !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    alert("Please enter end date in YYYY-MM-DD format.");
    return;
  }
  tempMedications.push({ name, dosage, startDate, endDate, notes });
  displayTempTable('medications-table', tempMedications, ['name', 'dosage', 'startDate', 'endDate', 'notes']);
  document.getElementById("add-medication-form").reset();
  if (typeof window.MediForgePatientReportedMeds !== "undefined") {
    window.MediForgePatientReportedMeds.resetFields();
  }
};
// Function to add allergy entry on add-patient.html
window.addAllergyEntry = function() {
  // Get field elements (may be null if enhanced selector replaced them)
  const categoryField = document.getElementById("allergy-category");
  const allergenField = document.getElementById("allergen");
  const reactionField = document.getElementById("reaction");
  const severityField = document.getElementById("severity");
  const notesField = document.getElementById("allergy-notes");

  // Determine category from hidden field or selector
  let category = categoryField ? categoryField.value : "";
  if (!category) {
    const selectorCategory = document.getElementById("allergy-selector-container-category");
    if (selectorCategory) {
      category = selectorCategory.value || "";
    }
  }
  if (!category && allergenField && allergenField.value) {
    category = "Manual Entry";
  }
  
  // Get values safely, handling null fields
  const allergen = allergenField ? allergenField.value : '';
  const reaction = reactionField ? reactionField.value : '';
  const severity = severityField ? severityField.value : '';
  const notes = notesField ? notesField.value : '';

  const reactions = reaction
    ? reaction.split(",").map(r => r.trim()).filter(Boolean)
    : [];
  
  let filledCount = 0;
  if (category) filledCount++;
  if (allergen) filledCount++;
  if (reactions.length) filledCount++;
  if (severity) filledCount++;
  if (notes) filledCount++;
  if (filledCount < 2) {
    alert("Please enter at least two fields.");
    return;
  }
  tempAllergies.push({
    category,
    allergen,
    reaction,
    reactions,
    severity,
    notes
  });
  displayTempTable('allergies-table', tempAllergies, ['category', 'allergen', 'severity', 'reactions', 'notes']);
  
  // Reset form if it exists
  const form = document.getElementById("add-allergy-form");
  if (form && form.reset) {
    form.reset();
  }
  
  // Clear individual fields if they exist
  if (categoryField) categoryField.value = '';
  if (allergenField) allergenField.value = '';
  if (reactionField) reactionField.value = '';
  if (severityField) severityField.value = '';
  if (notesField) notesField.value = '';
};

// Function to add immunization entry on add-patient.html
window.addImmunizationEntry = function() {
  // Get field elements (may be null if vaccine selector replaced them)
  const vaccineField = document.getElementById("vaccine");
  const dateField = document.getElementById("immun-date");
  const notesField = document.getElementById("immun-notes");
  
  // Get values safely, handling null fields
  const vaccine = vaccineField ? vaccineField.value : '';
  const date = dateField ? dateField.value : '';
  const notes = notesField ? notesField.value : '';
  
  let filledCount = 0;
  if (vaccine) filledCount++;
  if (date) filledCount++;
  if (notes) filledCount++;
  if (filledCount < 2) {
    alert("Please enter at least two fields.");
    return;
  }
  if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    alert("Please enter date in YYYY-MM-DD format.");
    return;
  }
  tempImmunizations.push({ vaccine, date, notes });
  displayTempTable('immunizations-table', tempImmunizations, ['vaccine', 'date', 'notes']);
  
  // Reset form if it exists
  const form = document.getElementById("add-immunization-form");
  if (form && form.reset) {
    form.reset();
  }
  
  // Clear individual fields if they exist
  if (vaccineField) vaccineField.value = '';
  if (dateField) dateField.value = '';
  if (notesField) notesField.value = '';
};

// Helper to display temporary table on add-patient.html
function displayTempTable(tableId, data, fields) {
  const tbody = document.getElementById(tableId).querySelector('tbody');
  tbody.innerHTML = "";
  data.forEach((item, index) => {
    const row = document.createElement("tr");
    fields.forEach(field => {
      const td = document.createElement("td");
      const value = item[field];
      if (Array.isArray(value)) {
        td.textContent = value.join(', ');
      } else if (typeof value === 'object' && value !== null) {
        td.textContent = JSON.stringify(value);
      } else {
        td.textContent = value || '';
      }
      row.appendChild(td);
    });
    const actionTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => removeTempEntry(tableId, index);
    actionTd.appendChild(removeBtn);
    row.appendChild(actionTd);
    tbody.appendChild(row);
  });
}

// Helper to remove temporary entry on add-patient.html
function removeTempEntry(tableId, index) {
  if (tableId === 'history-table') tempMedicalHistory.splice(index, 1);
  if (tableId === 'diagnoses-table') tempDiagnoses.splice(index, 1);
  if (tableId === 'medications-table') tempMedications.splice(index, 1);
  if (tableId === 'allergies-table') tempAllergies.splice(index, 1);
  if (tableId === 'immunizations-table') tempImmunizations.splice(index, 1);
  displayTempTable(tableId, getTempData(tableId), getFields(tableId));
}

function getTempData(tableId) {
  if (tableId === 'history-table') return tempMedicalHistory;
  if (tableId === 'diagnoses-table') return tempDiagnoses;
  if (tableId === 'medications-table') return tempMedications;
  if (tableId === 'allergies-table') return tempAllergies;
  if (tableId === 'immunizations-table') return tempImmunizations;
}

function getFields(tableId) {
  if (tableId === 'history-table') return ['date', 'event', 'notes'];
  if (tableId === 'diagnoses-table') return ['date', 'diagnosis', 'notes'];
  if (tableId === 'medications-table') return ['name', 'dosage', 'startDate', 'endDate', 'notes'];
  if (tableId === 'allergies-table') return ['category', 'allergen', 'severity', 'reactions', 'notes'];
  if (tableId === 'immunizations-table') return ['vaccine', 'date', 'notes'];
}


// Load and display patients in the list with pagination
// VERSION 3.1 - FIXED: Check localStorage first for immediate display
async function loadPatients(page = 1) {
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn : () => {};

  // CRITICAL FIX: Check for refresh parameter and force cache clear
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('refresh')) {
    debugLog('🔄 [PATIENTS] Refresh parameter detected, clearing cache');
    if (typeof window.clearPatientCache === 'function') {
      window.clearPatientCache();
    }
    // Remove refresh parameter from URL
    window.history.replaceState({}, '', window.location.pathname);
  }
  
  // CRITICAL FIX: Remove duplicate patients created in the last hour
  // This runs once per page load to clean up duplicates
  if (typeof window.removeDuplicatePatients === 'function') {
    try {
      const dedupeResult = await window.removeDuplicatePatients();
      if (dedupeResult.removed > 0) {
        debugLog(`✅ [PATIENTS] Removed ${dedupeResult.removed} duplicate patients from last hour`);
      }
    } catch (dedupeError) {
      debugWarn('⚠️ [PATIENTS] Duplicate removal error (non-critical):', dedupeError);
    }
  }
  
  // console.log('🚀🚀🚀 VERSION 3.1 LOADED - loadPatients called with page:', page);
  // console.log('🔍 DEBUG: This is the FIXED version with direct localStorage fallback');
  // console.log('🔍 DEBUG: Current timestamp:', new Date().toISOString());
  currentPatientPage = page;
  
  // IMMEDIATE FALLBACK: Check localStorage first for quick display
  // console.log('🔍 DEBUG: Checking localStorage first for immediate display...');
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const patientsKey = getDataKey("patients");
  const localPatients = JSON.parse(localStorage.getItem(patientsKey) || "[]");
  // console.log('🔍 DEBUG: Found', localPatients.length, 'patients in localStorage with key:', patientsKey);
  
  let displayedFromLocal = false;
  if (localPatients.length > 0) {
    await displayPatientsFromUniversalLoader(localPatients, page);
    displayedFromLocal = true;
  }
  
  // Use universal data loader for consistency across all devices
  // Wait for universal data loader to be available (mobile compatibility)
  let retryCount = 0;
  const maxRetries = 10;
  
  while (retryCount < maxRetries && typeof window.loadPatientsWithSupabasePriority !== 'function') {
    debugLog(`⏳ Waiting for universal data loader... (attempt ${retryCount + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 200));
    retryCount++;
  }
  
  if (typeof window.loadPatientsWithSupabasePriority === 'function') {
    // console.log('🔄 Using universal data loader for patients...');
    try {
      const patients = await window.loadPatientsWithSupabasePriority();
      if (Array.isArray(patients) && patients.length) {
        await displayPatientsFromUniversalLoader(patients, page);
        return;
      }
      
      // Check if we have no patients AND no organization ID - show login prompt
      if ((!patients || patients.length === 0) && !displayedFromLocal) {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const orgId = user.organizationId || user.organization_id;
        
        if (!orgId) {
          debugLog('🔍 No patients found and no organization ID - showing login prompt');
          await showLoginPromptForMissingOrgId();
          return;
        }
      }
      
      if (!displayedFromLocal) {
        await displayPatientsFromUniversalLoader([], page);
        return;
      }
      return;
    } catch (error) {
      console.warn('⚠️ Patients loader failed; using cached data when available.');
      debugWarn('Patients loader error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        errorString: String(error)
      });
      
      // Check if error is about missing org ID (check multiple ways)
      const errorMessage = error?.message || String(error) || '';
      const isOrgIdError = errorMessage.includes('No organization ID') || 
                          errorMessage.includes('organization ID') ||
                          errorMessage.includes('please log in');
      
      if (isOrgIdError) {
        debugLog('🔄 Detected organization ID error, showing login prompt...');
        
        // Try to restore user context first
        if (typeof window.restoreUserContextFromSupabase === 'function') {
          try {
            debugLog('🔄 Attempting to restore user context...');
            await window.restoreUserContextFromSupabase();
            // Retry loading patients after restoring context
            try {
              const patients = await window.loadPatientsWithSupabasePriority();
              if (Array.isArray(patients) && patients.length) {
                await displayPatientsFromUniversalLoader(patients, page);
                return;
              }
            } catch (retryError) {
              debugWarn('⚠️ Retry after context restoration failed:', retryError);
            }
          } catch (restoreError) {
            debugWarn('⚠️ Could not restore user context:', restoreError);
          }
        }
        
        // Show helpful message to user
        const shown = await showLoginPromptForMissingOrgId();
        if (shown) {
          return;
        }
        
        // Fallback: try to display empty state
        if (!displayedFromLocal) {
          await displayPatientsFromUniversalLoader([], page);
          // Try one more time to set the message
          await showLoginPromptForMissingOrgId();
        }
        return;
      }
      
      // For other errors, still try to show empty state if nothing was displayed
      debugLog('⚠️ Other error type, showing empty state...');
      if (!displayedFromLocal) {
        await displayPatientsFromUniversalLoader([], page);
      }
    }
  }
  
  // Fallback to original logic if universal loader not available
  debugLog('⚠️ Universal data loader not available, using fallback logic');
  let patients = [];
  
  // Get Supabase client from global scope
  const supabaseClient = window.supabaseClient;
  // Supabase client availability checked
  
  // STEP 1: Load from Supabase (PRIORITY - SUSTAINABLE SOLUTION)
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      // console.log('🔄 Loading patients from Supabase...');
      
      // Get organization ID - try multiple methods
      let orgId = null;
      
      // Method 1: Try from user object
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.organizationId) {
        orgId = user.organizationId;
      }
      
      // Method 2: Try from user.org (fallback)
      if (!orgId && user.org) {
        // For Mecure Clinics, use the known org ID
        if (user.org.toLowerCase().includes('mecure')) {
          orgId = '576522cc-e769-4fb4-9487-3d150857d970';
        }
      }
      
      // Method 3: Default to Mecure Clinics org ID if no user data
      if (!orgId) {
        orgId = '576522cc-e769-4fb4-9487-3d150857d970';
        // Using default organization ID
      }
      
      // Organization ID resolved (UUID removed for privacy)
      
      const { data: supabasePatients, error } = await supabaseClient
        .from('patients')
        .select('*')
        .eq('organization_id', orgId);
      
      if (error) {
        console.error('❌ Error loading from Supabase:', error);
        // Fallback to localStorage if Supabase fails
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      } else {
        // console.log('✅ Loaded', supabasePatients.length, 'patients from Supabase');
        
        // Convert Supabase format to localStorage format
        // console.log('🔍 DEBUG: Converting', supabasePatients.length, 'patients from Supabase format');
        patients = supabasePatients.map(patient => {
          // Fallback parse for legacy combined address fields
          const combinedAddress = (patient.address || '').trim();
          let parsedAddressLine1 = patient.address_line1 || '';
          let parsedAddressLine2 = patient.address_line2 || '';
          let parsedCity = patient.city || '';
          let parsedState = patient.state || '';
          let parsedCountry = patient.country || '';
          let parsedPostal = patient.postal_code || '';

          if (!parsedAddressLine1 && combinedAddress) {
            const parts = combinedAddress.split(',').map(p => p.trim()).filter(Boolean);
            if (parts.length > 0) parsedAddressLine1 = parts[0];
            if (parts.length > 1) parsedCity = parsedCity || parts[1];
            if (parts.length > 2) parsedState = parsedState || parts[2];
            if (parts.length > 3) parsedCountry = parsedCountry || parts[3];
          }

          const emergencyCombined = (patient.emergency_contact_address || '').trim();
          let emergencyAddr1 = '';
          let emergencyAddr2 = '';
          let emergencyCity = '';
          let emergencyState = '';
          let emergencyCountry = '';
          if (emergencyCombined) {
            const eparts = emergencyCombined.split(',').map(p => p.trim()).filter(Boolean);
            if (eparts.length > 0) emergencyAddr1 = eparts[0];
            if (eparts.length > 1) emergencyCity = eparts[1];
            if (eparts.length > 2) emergencyState = eparts[2];
            if (eparts.length > 3) emergencyCountry = eparts[3];
          }
          // Converting patient data (ID and DOB removed for privacy)
          // Safely handle JSON fields
          let allergies = [];
          let conditions = [];
          
          try {
            if (patient.allergies && patient.allergies.trim() && patient.allergies !== 'null') {
              allergies = JSON.parse(patient.allergies);
            }
          } catch (e) {
            // Could not parse allergies (patient ID removed for privacy)
          }
          
          try {
            if (patient.chronic_conditions && patient.chronic_conditions.trim() && patient.chronic_conditions !== 'null') {
              conditions = JSON.parse(patient.chronic_conditions);
            }
          } catch (e) {
            // Could not parse conditions (patient ID removed for privacy)
          }
          
          // LEGACY SYSTEM SUPPORT: Check if patient.id is already a display ID (MEC0013 format)
          // In legacy system, id field IS the display ID, not a UUID
          const isLegacyId = patient.id && /^[A-Z]{3}\d+$/.test(patient.id);
          const displayId = patient.patient_id || (isLegacyId ? patient.id : null);
          const supabaseUuid = isLegacyId ? null : patient.id; // Only store UUID if id is not legacy format
          
          return {
            id: displayId || patient.id, // Use display ID if available, otherwise use id (legacy or UUID)
            patient_id: displayId || patient.patient_id, // Display ID (MEC0006 format or legacy MEC0013)
            patientNumber: patient.patient_number || displayId || patient.patient_id, // Fallback
            _supabaseUuid: supabaseUuid, // Store actual Supabase UUID if id was a UUID
            firstName: patient.first_name || '',
            middleName: patient.middle_name || '',
            lastName: patient.last_name || '',
            dob: patient.date_of_birth, // This is the key field!
            gender: patient.gender || '',
            maritalStatus: patient.marital_status || '',
            race: patient.race || '',
            occupation: patient.occupation || '',
            phone: patient.phone || '',
            email: patient.email || '',
            addressLine1: parsedAddressLine1,
            addressLine2: parsedAddressLine2,
            city: parsedCity,
            state: parsedState,
            country: parsedCountry,
            postalCode: parsedPostal,
            bloodGroup: patient.blood_group || '',
            paymentSource: patient.payment_source || 'Self Pay',
            allergies: allergies,
            conditions: conditions,
            emergencyFirstName: patient.emergency_contact_name ? patient.emergency_contact_name.split(' ')[0] : '',
            emergencyLastName: patient.emergency_contact_name ? patient.emergency_contact_name.split(' ').slice(1).join(' ') : '',
            emergencyPhone: patient.emergency_contact_phone || '',
            emergencyRelationship: patient.emergency_contact_relationship || '',
            emergencyEmail: patient.emergency_contact_email || '',
            emergencyAddressCombined: emergencyCombined,
            emergencyAddressLine1: emergencyAddr1,
            emergencyAddressLine2: emergencyAddr2,
            emergencyCity: emergencyCity,
            emergencyState: emergencyState,
            emergencyCountry: emergencyCountry,
            createdDate: patient.created_at,
            updatedDate: patient.updated_at,
            // Add default fields
            visits: [],
            immunizations: [],
            prescriptions: [],
            hasDiabetes: false
          };
        });
        
        // Update localStorage with fresh data for offline use
        localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        // console.log('💾 Updated localStorage with fresh Supabase data');
        // console.log('🔍 DEBUG: Final patients array length:', patients.length);
        // console.log('🔍 DEBUG: Patients with DOB:', patients.filter(p => p.dob).length);
        // console.log('🔍 DEBUG: Sample patient DOB:', patients[0]?.dob);
      }
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      // Fallback to localStorage
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } else {
    console.log('⚠️ Supabase client not available, using localStorage');
    // STEP 2: Fallback to localStorage (existing behavior)
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");

    // Migration: If no patients under prefixed key, check non-prefixed and migrate
    if (patients.length === 0) {
      const oldPatients = JSON.parse(localStorage.getItem("patients") || "[]");
      if (oldPatients.length > 0) {
        localStorage.setItem(getDataKey("patients"), JSON.stringify(oldPatients)); // Migrate
        localStorage.removeItem("patients"); // Clean up old key
        patients = oldPatients;
      }
    }

    // New migration: Set hasDiabetes to false if undefined for any patient
    let changed = false;
    patients = patients.map(p => {
      if (p.hasDiabetes === undefined) {
        p.hasDiabetes = false;
        changed = true;
      }
      return p;
    });
    if (changed) {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    }
  }

  // console.log('Final patients count:', patients.length);

  // Sort patients
  patients.sort((a, b) => {
    let valA, valB;
    if (currentSort.field === 'name') {
      valA = `${a.firstName} ${a.lastName}`.toLowerCase();
      valB = `${b.firstName} ${b.lastName}`.toLowerCase();
    } else if (currentSort.field === 'dob') {
      valA = new Date(a.dob);
      valB = new Date(b.dob);
    }
    return (valA > valB ? 1 : -1) * currentSort.dir;
  });

  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const paginatedPatients = patients.slice(start, end);

  const tbody = document.getElementById("patient-list");
  if (tbody) {  // Only if on patients.html
    tbody.innerHTML = "";  // Clear old rows
    if (paginatedPatients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No patients found. Add a new patient to get started.</td></tr>';
    } else {
      // CRITICAL FIX: Resolve all patient display IDs before rendering buttons
      // This ensures buttons always have valid MEC0006 format IDs, never UUIDs
      const resolvedPatients = await Promise.all(
        paginatedPatients.map(async (patient) => {
          let displayId = getPatientIdentifier(patient);
          
          // If display ID is null or patient.id is a UUID, query Supabase to get the display ID
          const isUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
          const hasSupabaseUuid = patient._supabaseUuid && patient._supabaseUuid.includes('-') && patient._supabaseUuid.length === 36;
          
          if ((!displayId || isUuid || hasSupabaseUuid) && window.supabaseClient) {
            try {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const orgId = user.organizationId || user.organization_id;
              
              if (orgId) {
                // Try multiple query strategies to find the patient
                let found = false;
                const uuidToQuery = patient._supabaseUuid || (isUuid ? patient.id : null);
                
                // Strategy 1: Query by UUID (either patient.id or _supabaseUuid) to get full patient record
                if (uuidToQuery) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id, id')
                    .eq('id', uuidToQuery)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data) {
                    // If patient_id exists in Supabase, use it
                    if (data.patient_id && !isUuidLike(data.patient_id)) {
                      displayId = data.patient_id;
                      patient.patient_id = data.patient_id;
                      found = true;
                    }
                    // If patient exists but patient_id is null, we'll generate a fallback below
                  }
                }
                
                // Strategy 2: If Strategy 1 found patient but no patient_id, try querying by patient_id field
                if (!found && patient.patient_id && !isUuidLike(patient.patient_id)) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id')
                    .eq('patient_id', patient.patient_id)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data && data.patient_id && !isUuidLike(data.patient_id)) {
                    displayId = data.patient_id;
                    found = true;
                  }
                }
                
                // Strategy 3: If still not found, try querying by name + DOB (last resort)
                if (!found && patient.firstName && patient.lastName && patient.dob) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id')
                    .eq('first_name', patient.firstName)
                    .eq('last_name', patient.lastName)
                    .eq('date_of_birth', patient.dob)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data && data.patient_id && !isUuidLike(data.patient_id)) {
                    displayId = data.patient_id;
                    patient.patient_id = data.patient_id;
                    found = true;
                  }
                }
              }
            } catch (error) {
              console.warn('⚠️ Could not resolve patient ID from Supabase:', error);
            }
          }
          
          // CRITICAL: Never use UUID as display ID - always generate a temporary one if needed
          if (!displayId || isUuidLike(displayId) || displayId.length >= 36) {
            // Generate temporary ID from UUID if needed
            const uuid = patient._supabaseUuid || patient.id;
            if (uuid && uuid.includes('-')) {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const orgId = user.organizationId || user.organization_id;
              let orgPrefix = 'MEC';
              
              if (orgId && window.supabaseClient) {
                try {
                  const { data: org } = await window.supabaseClient
                    .from('organizations')
                    .select('name')
                    .eq('id', orgId)
                    .single();
                  if (org?.name) {
                    orgPrefix = org.name.substring(0, 3).toUpperCase();
                  }
                } catch (error) {
                  // Use default MEC prefix
                }
              }
              
              const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
              displayId = `${orgPrefix}${uuidDigits}`;
              console.warn('⚠️ Using temporary patient_id:', displayId, '- Run SQL script for proper sequential ID');
            } else {
              displayId = 'TEMP0001'; // Last resort
            }
          }
          return { patient, displayId };
        })
      );
      
      // Filter out null entries (patients without valid display IDs)
      const validResolvedPatients = resolvedPatients.filter(p => p !== null);
      
      validResolvedPatients.forEach(({ patient, displayId }) => {
        const row = document.createElement("tr");  // Create new table row
        // Row created for patient (name removed for privacy)
        row.innerHTML = `
          <td>${patient.firstName} ${patient.lastName}</td>
          <td>${patient.dob}</td>  <!-- Display DOB instead of age -->
          <td>${patient.gender}</td>
          <td>
            <button class="action-btn" onclick="window.location.href='/patient-details?id=${displayId}'">View</button>
            <button class="action-btn" onclick="window.location.href='/edit-patient?id=${displayId}'">Edit</button>
            <button class="action-btn" onclick="deletePatient('${displayId}')">Delete</button>
            <button class="action-btn" onclick="window.location.href='/patient-encounters?patientId=${displayId}'">Add New Encounter</button>
            <button class="action-btn" onclick="window.location.href='/add-appointment?patientId=${displayId}'">Add New Appointment</button>
            <button class="action-btn print-summary-btn" onclick="openPatientSummaryFromList('${displayId}')">📄 Print Patient Summary</button>
          </td>
        `;
        tbody.appendChild(row);  // Add row to table
      });
    }
  } else {
    // console.log('No patient-list element found, not on patients.html?');
  }

  // Update pagination controls
  updatePagination(patients.length, page);
}

// Update pagination UI
function updatePagination(total, currentPage) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const controls = document.getElementById("pagination-controls");
  if (controls) {
    // CRITICAL FIX: Put Previous and Next buttons on same line - use inline-block to ensure they share one line
    const paginationHtml = `
      <div class="patients-pagination">
        <button class="pagination-btn pagination-prev" onclick="loadPatients(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn pagination-next" onclick="loadPatients(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
      </div>
    `;
    controls.innerHTML = paginationHtml;
    
    // Also add pagination controls above the table
    const table = document.getElementById("patients-table");
    if (table && table.parentNode) {
      // Remove existing top pagination if any
      const existingTopPagination = document.getElementById("pagination-controls-top");
      if (existingTopPagination) {
        existingTopPagination.remove();
      }
      
      // Create new top pagination - same styling as bottom pagination
      const topPagination = document.createElement("div");
      topPagination.id = "pagination-controls-top";
      topPagination.innerHTML = paginationHtml;
      table.parentNode.insertBefore(topPagination, table);
    }
  }
}

// Sorting function
window.sortPatients = function(field) {
  if (currentSort.field === field) {
    currentSort.dir = -currentSort.dir;
  } else {
    currentSort.field = field;
    currentSort.dir = 1;
  }
  loadPatients(currentPatientPage);
};

// Search functionality (updated to search by full name and trigger pagination on full list)
// HYBRID ARCHITECTURE: Supabase-first, localStorage fallback
const searchInput = document.getElementById("search");
if (searchInput) {
  searchInput.addEventListener("input", async function() {
    const query = this.value.toLowerCase();  // Get search text
    
    // STEP 1: Try Supabase-first (loadPatientsWithSupabasePriority)
    let patients = [];
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      try {
        patients = await window.loadPatientsWithSupabasePriority();
      } catch (error) {
        console.warn('⚠️ Supabase data loader failed for search, falling back to localStorage:', error);
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } else {
      // STEP 2: Fallback to localStorage
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    const filtered = patients.filter(p => {
      const fullName = (p.firstName + " " + p.lastName).toLowerCase();
      const race = (p.race || '').toLowerCase();
      const gender = (p.gender || '').toLowerCase();
      return fullName.includes(query) || race.includes(query) || gender.includes(query);
    });
    currentPatientPage = 1;  // Reset to first page on search
    // Display filtered filtered as if full list, with pagination
    const start = (currentPatientPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginated = filtered.slice(start, end);
    const tbody = document.getElementById("patient-list");
    tbody.innerHTML = "";
    if (paginated.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No patients match the search criteria.</td></tr>';
    } else {
      // CRITICAL FIX: Resolve all patient display IDs before rendering buttons
      // This ensures buttons always have valid MEC0006 format IDs, never UUIDs
      const resolvedPatients = await Promise.all(
        paginated.map(async (patient) => {
          let displayId = getPatientIdentifier(patient);
          
          // If display ID is null or patient.id is a UUID, query Supabase to get the display ID
          const isUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
          const hasSupabaseUuid = patient._supabaseUuid && patient._supabaseUuid.includes('-') && patient._supabaseUuid.length === 36;
          
          if ((!displayId || isUuid || hasSupabaseUuid) && window.supabaseClient) {
            try {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const orgId = user.organizationId || user.organization_id;
              
              if (orgId) {
                // Try multiple query strategies to find the patient
                let found = false;
                const uuidToQuery = patient._supabaseUuid || (isUuid ? patient.id : null);
                
                // Strategy 1: Query by UUID (either patient.id or _supabaseUuid) to get full patient record
                if (uuidToQuery) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id, id')
                    .eq('id', uuidToQuery)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data) {
                    // If patient_id exists in Supabase, use it
                    if (data.patient_id && !isUuidLike(data.patient_id)) {
                      displayId = data.patient_id;
                      patient.patient_id = data.patient_id;
                      found = true;
                    }
                    // If patient exists but patient_id is null, we'll generate a fallback below
                  }
                }
                
                // Strategy 2: If Strategy 1 found patient but no patient_id, try querying by patient_id field
                if (!found && patient.patient_id && !isUuidLike(patient.patient_id)) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id')
                    .eq('patient_id', patient.patient_id)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data && data.patient_id && !isUuidLike(data.patient_id)) {
                    displayId = data.patient_id;
                    found = true;
                  }
                }
                
                // Strategy 3: If still not found, try querying by name + DOB (last resort)
                if (!found && patient.firstName && patient.lastName && patient.dob) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id')
                    .eq('first_name', patient.firstName)
                    .eq('last_name', patient.lastName)
                    .eq('date_of_birth', patient.dob)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data && data.patient_id && !isUuidLike(data.patient_id)) {
                    displayId = data.patient_id;
                    patient.patient_id = data.patient_id;
                    found = true;
                  }
                }
              }
            } catch (error) {
              console.warn('⚠️ Could not resolve patient ID from Supabase:', error);
            }
          }
          
          // CRITICAL: Never use UUID as display ID - always generate a temporary one if needed
          if (!displayId || isUuidLike(displayId) || displayId.length >= 36) {
            // Generate temporary ID from UUID if needed
            const uuid = patient._supabaseUuid || patient.id;
            if (uuid && uuid.includes('-')) {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const orgId = user.organizationId || user.organization_id;
              let orgPrefix = 'MEC';
              
              if (orgId && window.supabaseClient) {
                try {
                  const { data: org } = await window.supabaseClient
                    .from('organizations')
                    .select('name')
                    .eq('id', orgId)
                    .single();
                  if (org?.name) {
                    orgPrefix = org.name.substring(0, 3).toUpperCase();
                  }
                } catch (error) {
                  // Use default MEC prefix
                }
              }
              
              const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
              displayId = `${orgPrefix}${uuidDigits}`;
              console.warn('⚠️ Using temporary patient_id:', displayId, '- Run SQL script for proper sequential ID');
            } else {
              displayId = 'TEMP0001'; // Last resort
            }
          }
          return { patient, displayId };
        })
      );
      
      // Filter out null entries (patients without valid display IDs)
      const validResolvedPatients = resolvedPatients.filter(p => p !== null);
      
      validResolvedPatients.forEach(({ patient, displayId }) => {
        const row = document.createElement("tr");
        // Search result row created (name removed for privacy)
        row.innerHTML = `
          <td>${patient.firstName} ${patient.lastName}</td>
          <td>${patient.dob}</td>
          <td>${patient.gender}</td>
          <td>
            <button class="action-btn" onclick="window.location.href='/patient-details?id=${displayId}'">View</button>
            <button class="action-btn" onclick="window.location.href='/edit-patient?id=${displayId}'">Edit</button>
            <button class="action-btn" onclick="deletePatient('${displayId}')">Delete</button>
            <button class="action-btn" onclick="window.location.href='/patient-encounters?patientId=${displayId}'">Add New Encounter</button>
            <button class="action-btn" onclick="window.location.href='/add-appointment?patientId=${displayId}'">Add New Appointment</button>
            <button class="action-btn print-summary-btn" onclick="openPatientSummaryFromList('${displayId}')" style="background: #28a745; color: white;">📄 Print Patient Summary</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
    updatePagination(validResolvedPatients.length, currentPatientPage);  // Update with filtered count
  });
}
// Add new patient (updated with new fields)
const addPatientForm = document.getElementById("add-patient-form");
if (addPatientForm) {
  const patientTypeModal = document.getElementById("patient-type-modal");
  const patientTypeNewBtn = document.getElementById("patient-type-new");
  const patientTypeExistingBtn = document.getElementById("patient-type-existing");

  const setPatientType = (type) => {
    addPatientForm.dataset.patientType = type;
    if (patientTypeModal) patientTypeModal.style.display = "none";
    applyPatientTypeRequirements(type);
    if (typeof addPatientForm.requestSubmit === "function") {
      addPatientForm.requestSubmit();
    } else {
      addPatientForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  };

  const showPatientTypeModal = () => {
    if (patientTypeModal) patientTypeModal.style.display = "flex";
  };

  const updateManualPatientNumberingField = async (type) => {
    const isExisting = type === "existing";
    const customPatientIdGroup = document.getElementById("customPatientId-group");
    const customPatientIdInput = document.getElementById("customPatientId");
    if (!customPatientIdInput) return;

    if (!isExisting) {
      let manualNumberingEnabled = false;
      if (typeof window.getManualPatientNumberingEnabled === "function") {
        try {
          manualNumberingEnabled = await window.getManualPatientNumberingEnabled();
        } catch (error) {
          console.warn("Error checking manual numbering setting:", error);
        }
      }
      addPatientForm.dataset.manualNumberingEnabled = manualNumberingEnabled ? "true" : "false";
      customPatientIdInput.required = false;
      if (manualNumberingEnabled && customPatientIdGroup) {
        customPatientIdGroup.style.display = "block";
        customPatientIdInput.value = "";
        customPatientIdInput.placeholder =
          "Optional — leave blank for next auto number (e.g. MFA-SC####); or enter to override";
      } else {
        if (customPatientIdGroup) customPatientIdGroup.style.display = "none";
        customPatientIdInput.placeholder = "Enter patient/file number";
      }
      updateRequiredLabels(type, false);
      return;
    }

    // For Existing Old Patient: ALWAYS show the file number field so users can enter
    // their legacy patient/file number, regardless of manual numbering org setting.
    let manualNumberingEnabled = false;
    if (typeof window.getManualPatientNumberingEnabled === "function") {
      try {
        manualNumberingEnabled = await window.getManualPatientNumberingEnabled();
      } catch (error) {
        console.warn("Error checking manual numbering setting:", error);
      }
    }

    addPatientForm.dataset.manualNumberingEnabled = manualNumberingEnabled ? "true" : "false";
    if (customPatientIdGroup) {
      customPatientIdGroup.style.display = "block"; // Always show for existing patients
    }
    customPatientIdInput.required = true; // Always required for existing patients
    updateRequiredLabels(type, true); // Always require customPatientId for existing
  };

  const applyPatientTypeRequirements = (type) => {
    const isExisting = type === "existing";
    const inputs = addPatientForm.querySelectorAll("input, select, textarea");
    inputs.forEach((field) => {
      field.removeAttribute("required");
    });
    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");
    if (firstName) firstName.required = true;
    if (lastName) lastName.required = true;

    if (!isExisting) {
      // Restore required attributes for core fields for new patients
      const requiredIds = [
        "dob", "gender", "maritalStatus", "race", "phone", "addressLine1",
        "city", "state", "country", "paymentSource"
      ];
      requiredIds.forEach((id) => {
        const field = document.getElementById(id);
        if (field) field.required = true;
      });
    }
    updateRequiredLabels(type);
    updateManualPatientNumberingField(type);
  };

  const updateRequiredLabels = (type, manualNumberingOverride) => {
    const isExisting = type === "existing";
    const manualNumberingEnabled = typeof manualNumberingOverride === "boolean"
      ? manualNumberingOverride
      : addPatientForm.dataset.manualNumberingEnabled === "true";
    const requiredIds = isExisting
      ? ["firstName", "lastName"].concat(manualNumberingEnabled ? ["customPatientId"] : [])
      : [
          "firstName", "lastName", "dob", "gender", "maritalStatus", "race",
          "phone", "addressLine1", "city", "state", "country", "paymentSource"
        ];
    const labels = addPatientForm.querySelectorAll("label[for]");
    labels.forEach((label) => {
      const fieldId = label.getAttribute("for");
      if (!fieldId) return;
      if (!label.dataset.originalLabel) {
        label.dataset.originalLabel = label.textContent || "";
      }
      const baseText = label.dataset.originalLabel.replace(/\*\s*:?$/, '').trim();
      if (requiredIds.includes(fieldId)) {
        label.textContent = `${baseText}*`;
      } else {
        label.textContent = baseText;
      }
    });
  };

  if (patientTypeNewBtn) {
    patientTypeNewBtn.addEventListener("click", () => setPatientType("new"));
  }
  if (patientTypeExistingBtn) {
    patientTypeExistingBtn.addEventListener("click", () => setPatientType("existing"));
  }

  // Show selection modal on page load so user chooses before filling out the form
  showPatientTypeModal();

  // Handle "Same as Contact" checkbox
  const sameAsContact = document.getElementById("sameAsContact");
  const emergencyAddressFields = document.getElementById("emergencyAddressFields");
  const emergencyAddressInputs = [
    document.getElementById("emergencyAddressLine1"),
    document.getElementById("emergencyCity"),
    document.getElementById("emergencyState"),
    document.getElementById("emergencyCountry")
  ];  // Required address inputs (exclude optional Line 2)

  sameAsContact.addEventListener("change", function() {
    if (this.checked) {
      // Copy patient address to emergency fields
      document.getElementById("emergencyAddressLine1").value = document.getElementById("addressLine1").value;
      document.getElementById("emergencyAddressLine2").value = document.getElementById("addressLine2").value;
      document.getElementById("emergencyCity").value = document.getElementById("city").value;
      document.getElementById("emergencyState").value = document.getElementById("state").value;
      document.getElementById("emergencyCountry").value = document.getElementById("country").value;
      
      // CRITICAL: Also copy phone country code to emergency phone country code
      const phoneCountryCode = document.getElementById("phoneCountryCode");
      const emergencyPhoneCountryCode = document.getElementById("emergencyPhoneCountryCode");
      if (phoneCountryCode && emergencyPhoneCountryCode) {
        emergencyPhoneCountryCode.value = phoneCountryCode.value;
        // Update placeholder if function exists
        if (typeof updateEmergencyPhonePlaceholder === 'function') {
          updateEmergencyPhonePlaceholder();
        }
      }
      
      // Hide ALL emergency address fields including country and state
      emergencyAddressFields.style.display = "none";
      
      // Hide country and state fields (they're outside the emergencyAddressFields div)
      const emergencyCountryLabel = document.querySelector('label[for="emergencyCountry"]');
      const emergencyCountrySelect = document.getElementById("emergencyCountry");
      const emergencyStateLabel = document.querySelector('label[for="emergencyState"]');
      const emergencyStateSelect = document.getElementById("emergencyState");
      
      if (emergencyCountryLabel) emergencyCountryLabel.style.display = "none";
      if (emergencyCountrySelect) emergencyCountrySelect.style.display = "none";
      if (emergencyStateLabel) emergencyStateLabel.style.display = "none";
      if (emergencyStateSelect) emergencyStateSelect.style.display = "none";
      
      // Hide required asterisks for country and state
      const emergencyCountryRequired = document.getElementById("emergencyCountryRequired");
      const emergencyStateRequired = document.getElementById("emergencyStateRequired");
      if (emergencyCountryRequired) emergencyCountryRequired.style.display = "none";
      if (emergencyStateRequired) emergencyStateRequired.style.display = "none";
      
      // Remove 'required' from ALL address inputs including country and state
      emergencyAddressInputs.forEach(input => input.required = false);
      document.getElementById("emergencyAddressLine2").required = false;  // Optional one
      if (emergencyCountrySelect) emergencyCountrySelect.required = false;
      if (emergencyStateSelect) emergencyStateSelect.required = false;
    } else {
      // Clear emergency address fields
      document.getElementById("emergencyAddressLine1").value = "";
      document.getElementById("emergencyAddressLine2").value = "";
      document.getElementById("emergencyCity").value = "";
      document.getElementById("emergencyState").value = "";
      document.getElementById("emergencyCountry").value = "";
      
      // Show ALL emergency address fields including country and state
      emergencyAddressFields.style.display = "block";
      
      // Show country and state fields
      const emergencyCountryLabel = document.querySelector('label[for="emergencyCountry"]');
      const emergencyCountrySelect = document.getElementById("emergencyCountry");
      const emergencyStateLabel = document.querySelector('label[for="emergencyState"]');
      const emergencyStateSelect = document.getElementById("emergencyState");
      
      if (emergencyCountryLabel) emergencyCountryLabel.style.display = "block";
      if (emergencyCountrySelect) emergencyCountrySelect.style.display = "block";
      if (emergencyStateLabel) emergencyStateLabel.style.display = "block";
      if (emergencyStateSelect) emergencyStateSelect.style.display = "block";
      
      // Show required asterisks for country and state
      const emergencyCountryRequired = document.getElementById("emergencyCountryRequired");
      const emergencyStateRequired = document.getElementById("emergencyStateRequired");
      if (emergencyCountryRequired) emergencyCountryRequired.style.display = "inline";
      if (emergencyStateRequired) emergencyStateRequired.style.display = "inline";
      
      // Add 'required' back to ALL address inputs including country and state
      emergencyAddressInputs.forEach(input => input.required = true);
      if (emergencyCountrySelect) emergencyCountrySelect.required = true;
      if (emergencyStateSelect) emergencyStateSelect.required = true;
      // Line 2 remains optional
    }
  });

  addPatientForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    const patientType = addPatientForm.dataset.patientType;
    if (!patientType) {
      showPatientTypeModal();
      return;
    }
    if (patientType === "existing") {
      applyPatientTypeRequirements("existing");
    }
    
    // Disable submit button to prevent double-clicks
    const submitButton = addPatientForm.querySelector('button[type="submit"]') || 
                        addPatientForm.querySelector('input[type="submit"]') ||
                        document.querySelector('button:contains("Save Patient")');
    let originalButtonText = '';
    let buttonDisabled = false;
    
    if (submitButton) {
      originalButtonText = submitButton.textContent || submitButton.value || 'Save Patient';
      submitButton.disabled = true;
      buttonDisabled = true;
      submitButton.textContent = submitButton.value = 'Saving...';
      submitButton.style.opacity = '0.6';
      submitButton.style.cursor = 'not-allowed';
    }
    
    // Helper function to re-enable button
    const reEnableButton = () => {
      if (buttonDisabled && submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.value = originalButtonText;
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
      }
    };
    
    try {
      // Add patient form submit triggered
    // Custom validation for required fields
    const isExistingPatient = patientType === "existing";
    const customPatientIdInput = document.getElementById("customPatientId");
    const customPatientId = customPatientIdInput ? customPatientIdInput.value.trim() : "";

    let manualNumberingEnabled = false;
    if (typeof window.getManualPatientNumberingEnabled === "function") {
      try {
        manualNumberingEnabled = await window.getManualPatientNumberingEnabled();
      } catch (error) {
        console.warn("Error checking manual numbering setting:", error);
      }
    }

    if (isExistingPatient && manualNumberingEnabled && customPatientIdInput) {
      customPatientIdInput.required = true;
    }
    
    // Check if emergency contact is required based on organization setting
    let emergencyContactRequired = true; // Default to required for backward compatibility
    try {
      if (typeof window.getEmergencyContactRequired === 'function') {
        emergencyContactRequired = await window.getEmergencyContactRequired();
      }
    } catch (error) {
      console.warn('⚠️ Error checking emergency contact required setting, defaulting to required:', error);
    }
    
    if (!emergencyContactRequired || isExistingPatient) {
      // When optional, ensure HTML5 required attributes are removed (double-check)
      const emergencyFields = [
        "emergencyFirstName", "emergencyLastName", "emergencyRelationship", 
        "emergencyPhone", "emergencyEmail", "emergencyCountry", "emergencyState",
        "emergencyAddressLine1", "emergencyCity"
      ];
      emergencyFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.removeAttribute('required');
        }
      });
      console.log('✅ [PATIENTS] Emergency contact fields set to optional - removed required attributes');
    }

    if (!addPatientForm.checkValidity()) {
      addPatientForm.reportValidity();
      reEnableButton();
      return;
    }

    if (typeof window.MediForgePaymentSourceFields?.getMissingFields === 'function') {
      const payerMissing = window.MediForgePaymentSourceFields.getMissingFields();
      if (payerMissing.length > 0) {
        alert("Please fill in the following payer ID fields: " + payerMissing.join(", "));
        reEnableButton();
        return;
      }
    }

    if (typeof window.MediForgePatientCardUploads?.getMissingRegistrationCards === 'function') {
      const cardMissing = window.MediForgePatientCardUploads.getMissingRegistrationCards();
      if (cardMissing.length > 0) {
        alert("Please upload the following required documents: " + cardMissing.join(", "));
        reEnableButton();
        return;
      }
    }

    // CRITICAL: Check for duplicate patients (same name and DOB) before saving
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const middleName = document.getElementById("middleName").value.trim();
    const dob = document.getElementById("dob").value;
    
    // Normalize names for comparison (case-insensitive, trimmed)
    const normalizeName = (name) => (name || '').trim().toLowerCase();
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);
    const normalizedMiddleName = normalizeName(middleName);
    
    // Check for duplicates in Supabase first
    let duplicateFound = false;
    let duplicatePatientInfo = null;
    
    // Resolve organization ID
    let orgId = null;
    try {
      if (typeof window.resolveOrganizationId === 'function') {
        orgId = await window.resolveOrganizationId();
      }
    } catch (orgIdError) {
      console.warn('Organization ID resolution error:', orgIdError);
    }
    
    if (!orgId) {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        orgId = user.organizationId || user.organization_id;
        if (!orgId && user.org) {
          const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgData = organizations[user.org];
          if (orgData && orgData.id) {
            orgId = orgData.id;
          }
        }
      } catch (fallbackError) {
        console.warn('Fallback org ID resolution error:', fallbackError);
      }
    }
    
    if (orgId && window.supabaseClient) {
      try {
        // Query Supabase for patients with same name and DOB
        const { data: existingPatients, error: queryError } = await window.supabaseClient
          .from('patients')
          .select('patient_id, first_name, last_name, middle_name, date_of_birth')
          .eq('organization_id', orgId)
          .eq('date_of_birth', dob);
        
        if (!queryError && existingPatients && existingPatients.length > 0) {
          // Check if any match by name (case-insensitive)
          for (const existing of existingPatients) {
            const existingFirstName = normalizeName(existing.first_name);
            const existingLastName = normalizeName(existing.last_name);
            const existingMiddleName = normalizeName(existing.middle_name || '');
            
            // Match if first and last names match, and middle names match (if provided)
            const namesMatch = existingFirstName === normalizedFirstName && 
                              existingLastName === normalizedLastName;
            
            const middleNamesMatch = !normalizedMiddleName || !existingMiddleName || 
                                    normalizedMiddleName === existingMiddleName;
            
            if (namesMatch && middleNamesMatch) {
              duplicateFound = true;
              duplicatePatientInfo = {
                patientId: existing.patient_id,
                name: `${existing.first_name} ${existing.middle_name ? existing.middle_name + ' ' : ''}${existing.last_name}`,
                dob: existing.date_of_birth
              };
              break;
            }
          }
        }
      } catch (supabaseError) {
        console.warn('⚠️ Error checking duplicates in Supabase (will check localStorage):', supabaseError);
      }
    }
    
    // Also check localStorage for duplicates (for unsynced patients)
    if (!duplicateFound) {
      try {
        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        for (const existing of patients) {
          // Normalize existing patient names
          const existingFirstName = normalizeName(existing.firstName || existing.first_name);
          const existingLastName = normalizeName(existing.lastName || existing.last_name);
          const existingMiddleName = normalizeName(existing.middleName || existing.middle_name || '');
          const existingDob = existing.dob || existing.date_of_birth;
          
          // Check if DOB matches
          if (existingDob === dob) {
            // Check if names match
            const namesMatch = existingFirstName === normalizedFirstName && 
                              existingLastName === normalizedLastName;
            
            const middleNamesMatch = !normalizedMiddleName || !existingMiddleName || 
                                    normalizedMiddleName === existingMiddleName;
            
            if (namesMatch && middleNamesMatch) {
              duplicateFound = true;
              duplicatePatientInfo = {
                patientId: existing.patient_id || existing.id,
                name: `${existing.firstName || existing.first_name} ${existing.middleName || existing.middle_name ? (existing.middleName || existing.middle_name) + ' ' : ''}${existing.lastName || existing.last_name}`,
                dob: existingDob
              };
              break;
            }
          }
        }
      } catch (localStorageError) {
        console.warn('⚠️ Error checking duplicates in localStorage:', localStorageError);
      }
    }
    
    // Alert user if duplicate found
    if (duplicateFound && duplicatePatientInfo) {
      const confirmMessage = `A patient with the same name and date of birth already exists:\n\n` +
                            `Name: ${duplicatePatientInfo.name}\n` +
                            `Date of Birth: ${duplicatePatientInfo.dob}\n` +
                            `Patient ID: ${typeof window.patientMrnDisplay === 'function' ? window.patientMrnDisplay(duplicatePatientInfo.patientId || '') : duplicatePatientInfo.patientId}\n\n` +
                            `Are you sure you want to create a duplicate patient?`;
      
      const proceed = confirm(confirmMessage);
      if (!proceed) {
        return; // User cancelled, don't save
      }
    }

    // ROOT CAUSE FIX: Wrap entire handler in try-catch to ensure patient ALWAYS saves
    try {
      // Proceed with saving if valid
      // Handle required document uploads
      let identificationCard = "";
      let insuranceCard = "";
      let identificationCardFileName = "";
      let insuranceCardFileName = "";
      let insuranceCardFront = null;
      let insuranceCardBack = null;
      try {
        if (typeof window.MediForgePatientCardUploads?.readRegistrationCards === 'function') {
          const cards = await window.MediForgePatientCardUploads.readRegistrationCards({ required: true });
          identificationCard = cards.identificationCard;
          insuranceCard = cards.insuranceCard;
          identificationCardFileName = cards.identificationCardFileName;
          insuranceCardFileName = cards.insuranceCardFileName;
          insuranceCardFront = cards.insuranceCardFront || cards.insuranceCard;
        } else {
          throw new Error('Document upload handler is not available. Please refresh the page.');
        }
      } catch (fileError) {
        alert(fileError.message || 'Please upload both required document files.');
        reEnableButton();
        return;
      }

      // For Existing Old Patient: always require custom file number.
      // For New Patient: use custom ID only when manual numbering is enabled.
      let patientId;
      if (isExistingPatient && !customPatientId) {
        alert("Please enter a Patient/File Number for existing old patients.");
        return;
      }

      if (customPatientId) {
        // Use custom patient ID
        patientId = customPatientId;
        
        // Validate uniqueness (Supabase-first, localStorage fallback)
        if (window.supabaseClient && orgId) {
          const { data: existing, error: checkError } = await window.supabaseClient
            .from('patients')
            .select('patient_id')
            .eq('organization_id', orgId)
            .eq('patient_id', patientId)
            .maybeSingle();
          
          if (checkError && checkError.code !== 'PGRST116') {
            alert(`Error checking patient number: ${checkError.message}`);
            return;
          }
          
          if (existing) {
            alert(`Patient number "${patientId}" already exists. Please choose a different number.`);
            return;
          }
        } else {
          // Fallback: Check localStorage
          const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          const exists = patients.some(p => p.id === patientId || p.patient_id === patientId);
          if (exists) {
            alert(`Patient number "${patientId}" already exists. Please choose a different number.`);
            return;
          }
        }
      } else {
        // Prefer Supabase-aware prefix (settings.patient_id_prefix, MFA-SC for MFASC) — never user.org.slice(0,3) → MIN
        if (window.supabaseClient && orgId && typeof window.generateSupabasePatientId === 'function') {
          try {
            patientId = await window.generateSupabasePatientId(orgId);
          } catch (genErr) {
            console.warn('generateSupabasePatientId failed, falling back to local generatePatientId:', genErr);
            patientId = generatePatientId();
          }
        } else {
          patientId = generatePatientId();
        }
      }
      
      // Get phone country codes separately
      const phoneCountryCodeEl = document.getElementById("phoneCountryCode");
      const emergencyPhoneCountryCodeEl = document.getElementById("emergencyPhoneCountryCode");
      const phoneCountryCode = phoneCountryCodeEl ? phoneCountryCodeEl.value : '';
      const emergencyPhoneCountryCode = emergencyPhoneCountryCodeEl ? emergencyPhoneCountryCodeEl.value : '';
      
      const patient = {
        id: patientId,
        firstName: document.getElementById("firstName").value,
        middleName: document.getElementById("middleName").value,
        lastName: document.getElementById("lastName").value,
        dob: document.getElementById("dob").value,
        gender: document.getElementById("gender").value,
        maritalStatus: document.getElementById("maritalStatus").value,
        race: document.getElementById("race").value,
        email: document.getElementById("email").value,
        phone: (typeof getFullPhoneNumber === 'function' ? getFullPhoneNumber('phone') : document.getElementById("phone").value),
        phoneCountryCode: phoneCountryCode, // Save phone country code separately
        addressLine1: document.getElementById("addressLine1").value,
        addressLine2: document.getElementById("addressLine2").value,
        city: document.getElementById("city").value,
        state: document.getElementById("state").value,
        country: document.getElementById("country").value,
        postalCode: document.getElementById("postalCode")?.value?.trim() || "",
        emergencyFirstName: document.getElementById("emergencyFirstName").value,
        emergencyLastName: document.getElementById("emergencyLastName").value,
        emergencyRelationship: document.getElementById("emergencyRelationship").value,
        emergencyPhone: (typeof getFullPhoneNumber === 'function' ? getFullPhoneNumber('emergencyPhone') : (document.getElementById("emergencyPhone")?.value || "")),
        emergencyPhoneCountryCode: emergencyPhoneCountryCode, // Save emergency phone country code separately
        emergencyEmail: document.getElementById("emergencyEmail")?.value || "",
        emergencyAddressLine1: document.getElementById("emergencyAddressLine1").value,
        emergencyAddressLine2: document.getElementById("emergencyAddressLine2").value,
        emergencyCity: document.getElementById("emergencyCity").value,
        emergencyState: document.getElementById("emergencyState").value,
        emergencyCountry: document.getElementById("emergencyCountry").value,
        hasDiabetes: document.getElementById("hasDiabetes").checked,
        paymentSource: document.getElementById("paymentSource").value,
        province: document.getElementById("patientProvince")?.value || document.getElementById("state")?.value || 'ON',
        state: document.getElementById("state")?.value || document.getElementById("patientProvince")?.value,
        healthCardNumber: document.getElementById("healthCardNumber")?.value || "",
        healthCardVersion: document.getElementById("healthCardVersion")?.value || "",
        phn: document.getElementById("healthCardNumber")?.value || "",
        preferredPaymentMethod: document.getElementById("preferredPaymentMethod")?.value || "cash",
        wcbClaimNumber: document.getElementById("wcbClaimNumber")?.value?.trim() || "",
        insuranceName: document.getElementById("insuranceName").value || "",
        insurancePolicyGroupNumber: document.getElementById("insurancePolicyGroupNumber").value || "",
        insuranceMemberNumber: document.getElementById("insuranceMemberNumber").value || "",
        identificationCard,
        identificationCardFileName,
        insuranceCard,
        insuranceCardFileName,
        insuranceCardFront: insuranceCardFront,
        insuranceCardBack: insuranceCardBack,
        visits: [],  // Empty list for visits
        preventiveGaps: [],  // Empty for gaps
        medicalHistory: tempMedicalHistory,
        diagnoses: tempDiagnoses,
        medications: tempMedications,
        allergies: tempAllergies,
        immunizations: tempImmunizations
      };
      
      // HYBRID ARCHITECTURE: Supabase-first, localStorage fallback
      // This ensures consistent behavior across ALL devices (mobile, tablet, desktop)
      const supabaseClient = window.supabaseClient;
      let savedToSupabase = false;
      let orgId = null;
      
      // Resolve organization ID using standardized utility with robust fallbacks
      try {
        if (typeof window.resolveOrganizationId === 'function') {
          orgId = await window.resolveOrganizationId();
        }
      } catch (orgIdError) {
        console.warn('Organization ID resolution error:', orgIdError);
      }
      
      // Fallback to manual resolution if utility failed
      if (!orgId) {
        try {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          orgId = user.organizationId || user.organization_id;
          if (!orgId && user.org) {
            const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
            const orgData = organizations[user.org];
            if (orgData && orgData.id) {
              orgId = orgData.id;
            }
          }
        } catch (fallbackError) {
          console.warn('Fallback org ID resolution error:', fallbackError);
        }
      }
      
      // Prepare Supabase patient data (same format for all devices)
      const supabasePatient = {
        patient_id: patient.id,
        first_name: patient.firstName,
        last_name: patient.lastName,
        middle_name: patient.middleName || null,
        gender: patient.gender,
        date_of_birth: patient.dob || null,
        phone: patient.phone,
        email: patient.email || null,
        address: patient.addressLine1 ? 
          `${patient.addressLine1}${patient.addressLine2 ? ', ' + patient.addressLine2 : ''}` : null,
        address_line1: patient.addressLine1 || null,
        address_line2: patient.addressLine2 || null,
        city: patient.city || null,
        state: patient.state || null,
        country: patient.country || null,
        postal_code: patient.postalCode || null,
        emergency_contact_name: patient.emergencyFirstName && patient.emergencyLastName ?
          `${patient.emergencyFirstName} ${patient.emergencyLastName}` : null,
        emergency_contact_relationship: patient.emergencyRelationship || null,
        emergency_contact_phone: patient.emergencyPhone || null,
        blood_group: patient.bloodGroup || null,
        genotype: patient.genotype || null,
        race: patient.race || null,
        marital_status: patient.maritalStatus || null,
        allergies: patient.allergies ? JSON.stringify(patient.allergies) : '[]',
        chronic_conditions: patient.conditions ? JSON.stringify(patient.conditions) : '[]',
        medications: patient.medications ? JSON.stringify(patient.medications) : '[]',
        medical_history: patient.medicalHistory ? JSON.stringify(patient.medicalHistory) : '[]',
        diagnoses: patient.diagnoses ? JSON.stringify(patient.diagnoses) : '[]',
        payment_source: patient.paymentSource || 'Self Pay',
        insurance_name: patient.insuranceName || null,
        insurance_policy_number: patient.insurancePolicyNumber || null,
        insurance_member_number: patient.insuranceMemberNumber || null,
        organization_id: orgId
      };
      
      // HYBRID ARCHITECTURE: Supabase-first with localStorage fallback
      // STEP 1: Try Supabase FIRST (always attempt)
      if (orgId && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
          console.log('💾 [PATIENTS] SUPABASE-FIRST: Attempting to save to Supabase');
          console.log('💾 [PATIENTS] Organization ID:', orgId);
          console.log('💾 [PATIENTS] Patient data:', { patient_id: supabasePatient.patient_id, first_name: supabasePatient.first_name, last_name: supabasePatient.last_name });
          
          // Direct Supabase insert
          const { data, error } = await supabaseClient
            .from('patients')
            .insert(supabasePatient)
            .select()
            .single();
          
          if (error) {
            console.error('❌ [PATIENTS] Supabase insert failed:', error);
            throw error;
          }
          
          if (!data) {
            throw new Error('No data returned from Supabase insert');
          }
          
          // SUCCESS - Supabase save successful
          savedToSupabase = true;
          console.log('✅ [PATIENTS] Patient saved to Supabase successfully:', data.patient_id);

          if (typeof window.MediForgePayerEngine !== 'undefined' && window.MediForgePayerEngine.savePayerProfile) {
            try {
              await window.MediForgePayerEngine.savePayerProfile(data.id, {
                province: patient.province,
                phn: patient.phn || patient.healthCardNumber,
                healthCardVersion: patient.healthCardVersion,
                paymentSource: patient.paymentSource,
                primaryPayerCode: window.MediForgePayerEngine.PROVINCE_PAYER_MAP?.[patient.province],
                privateInsurerId: patient.insuranceName,
                insuranceMemberNumber: patient.insuranceMemberNumber,
                insurancePolicyNumber: patient.insurancePolicyGroupNumber,
                preferredPaymentMethod: patient.preferredPaymentMethod,
                wcbClaimNumber: patient.wcbClaimNumber
              });
            } catch (payerErr) {
              console.warn('[PATIENTS] Payer profile save skipped:', payerErr.message);
            }
          }
          
          // STEP 2: Cache to localStorage after successful Supabase save
          try {
            patient.organization_id = orgId;
            patient.organizationId = orgId;
            
            const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
            const existingIndex = patients.findIndex(p => {
              const pDisplayId = p.patient_id || (p.id && !p.id.includes('-') ? p.id : null);
              const pUuid = p.id && p.id.includes('-') ? p.id : null;
              const patientDisplayId = patient.id && !patient.id.includes('-') ? patient.id : null;
              return pDisplayId === patientDisplayId || pDisplayId === patient.id || pUuid === data.id;
            });
            
            const cachedPatient = {
              ...patient,
              id: data.patient_id,
              patient_id: data.patient_id,
              organization_id: orgId,
              organizationId: orgId,
              _synced: true,
              _fromLocalStorage: false,
              _supabaseUuid: data.id
            };
            
            if (existingIndex >= 0) {
              patients[existingIndex] = cachedPatient;
            } else {
              patients.push(cachedPatient);
            }
            localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
            console.log('✅ [PATIENTS] Patient cached to localStorage (after Supabase success)');
            
            if (typeof window.clearPatientCache === 'function') {
              window.clearPatientCache();
            }
            
            if (typeof window.showSuccessNotification === 'function') {
              window.showSuccessNotification('Patient saved successfully');
            } else {
              alert('✅ Patient saved successfully!');
            }
            
          } catch (cacheError) {
            console.warn('⚠️ [PATIENTS] Failed to cache to localStorage (non-critical):', cacheError);
          }
          
        } catch (err) {
          // SUPABASE FAILED - Fallback to localStorage (hybrid architecture pattern)
          console.error('❌ [PATIENTS] Supabase save failed, falling back to localStorage:', err);
          
          // STEP 3: Fallback to localStorage and queue for sync
          try {
            if (!patient.organization_id && !patient.organizationId) {
              patient.organization_id = orgId;
              patient.organizationId = orgId;
            }
            
            const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
            const existingIndex = patients.findIndex(p => {
              const pDisplayId = p.patient_id || (p.id && !p.id.includes('-') ? p.id : null);
              return pDisplayId === patient.id;
            });
            
            const fallbackPatient = {
              ...patient,
              organization_id: orgId,
              organizationId: orgId,
              _synced: false,
              _fromLocalStorage: true
            };
            
            if (existingIndex >= 0) {
              patients[existingIndex] = fallbackPatient;
            } else {
              patients.push(fallbackPatient);
            }
            localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
            console.log('✅ [PATIENTS] Patient saved to localStorage as fallback with org_id:', orgId);
            
            // Queue for sync when online (hybrid architecture pattern)
            if (typeof window.queueForSync === 'function') {
              window.queueForSync('patients', supabasePatient);
              console.log('✅ [PATIENTS] Patient queued for sync');
            }
            
            if (typeof window.clearPatientCache === 'function') {
              window.clearPatientCache();
            }
            
            if (typeof window.showWarningNotification === 'function') {
              window.showWarningNotification('Patient saved locally. Will sync to cloud when connection is available.');
            } else {
              alert('⚠️ Patient saved locally. Will sync to cloud when connection is available.');
            }
            
          } catch (localStorageError) {
            console.error('❌ [PATIENTS] CRITICAL: Even localStorage save failed:', localStorageError);
            alert('❌ CRITICAL ERROR: Could not save patient. Please try again or contact support.');
            reEnableButton();
            return;
          }
        }
      } else {
        // NO SUPABASE AVAILABLE - Use localStorage (hybrid architecture fallback)
        console.warn('⚠️ [PATIENTS] Supabase not available, using localStorage fallback');
        
        try {
          if (!patient.organization_id && !patient.organizationId) {
            patient.organization_id = orgId;
            patient.organizationId = orgId;
          }
          
          const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          const existingIndex = patients.findIndex(p => {
            const pDisplayId = p.patient_id || (p.id && !p.id.includes('-') ? p.id : null);
            return pDisplayId === patient.id;
          });
          
          const fallbackPatient = {
            ...patient,
            organization_id: orgId,
            organizationId: orgId,
            _synced: false,
            _fromLocalStorage: true
          };
          
          if (existingIndex >= 0) {
            patients[existingIndex] = fallbackPatient;
          } else {
            patients.push(fallbackPatient);
          }
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          
          if (typeof window.clearPatientCache === 'function') {
            window.clearPatientCache();
          }
          
          // Queue for sync when Supabase becomes available
          if (typeof window.queueForSync === 'function' && orgId) {
            window.queueForSync('patients', supabasePatient);
          }
          
          if (typeof window.showWarningNotification === 'function') {
            window.showWarningNotification('Patient saved locally. Will sync to cloud when connection is available.');
          } else {
            alert('⚠️ Patient saved locally. Will sync to cloud when connection is available.');
          }
          
        } catch (localStorageError) {
          console.error('❌ [PATIENTS] CRITICAL: localStorage save failed:', localStorageError);
          alert('❌ CRITICAL ERROR: Could not save patient. Please try again or contact support.');
          reEnableButton();
          return;
        }
      }
      
      // Audit log: Patient created (non-blocking)
      try {
        if (typeof logAuditEvent !== 'undefined') {
          logAuditEvent('patient_created', {
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            dob: patient.dob,
            gender: patient.gender
          });
        }
      } catch (auditError) {
        console.warn('Audit log error (non-critical):', auditError);
      }
      
      // Reset temp arrays
      tempMedicalHistory = [];
      tempDiagnoses = [];
      tempMedications = [];
      tempAllergies = [];
      tempImmunizations = [];
      
      // CRITICAL FIX: ALWAYS redirect - patient is saved successfully
      // CRITICAL FIX: Force refresh patients page by adding cache-busting parameter
      setTimeout(() => {
        try {
          // Add timestamp to force refresh and bypass cache
          const timestamp = Date.now();
          window.location.href = `/patients?refresh=${timestamp}`;
        } catch (redirectError) {
          console.error('Redirect error:', redirectError);
          setTimeout(() => {
            const timestamp = Date.now();
            window.location.href = `/patients?refresh=${timestamp}`;
          }, 500);
        }
      }, savedToSupabase ? 1000 : 1500); // Slightly longer delay to ensure Supabase data is queryable
      
    } catch (criticalError) {
      // Re-enable button on error
      reEnableButton();
      // ROOT CAUSE FIX: Even if critical error occurs, try to save patient to localStorage
      console.error('❌ Critical error in patient creation:', criticalError);
      
      try {
        // Try to extract patient data from form even if error occurred
        const patient = {
          id: generatePatientId(),
          firstName: document.getElementById("firstName")?.value || '',
          lastName: document.getElementById("lastName")?.value || '',
          middleName: document.getElementById("middleName")?.value || '',
          dob: document.getElementById("dob")?.value || '',
          gender: document.getElementById("gender")?.value || '',
          maritalStatus: document.getElementById("maritalStatus")?.value || '',
          race: document.getElementById("race")?.value || '',
          email: document.getElementById("email")?.value || '',
          phone: (typeof getFullPhoneNumber === 'function' ? getFullPhoneNumber('phone') : document.getElementById("phone")?.value || ''),
          addressLine1: document.getElementById("addressLine1")?.value || '',
          addressLine2: document.getElementById("addressLine2")?.value || '',
          city: document.getElementById("city")?.value || '',
          state: document.getElementById("state")?.value || '',
          country: document.getElementById("country")?.value || '',
          postalCode: document.getElementById("postalCode")?.value?.trim() || '',
          emergencyFirstName: document.getElementById("emergencyFirstName")?.value || '',
          emergencyLastName: document.getElementById("emergencyLastName")?.value || '',
          emergencyRelationship: document.getElementById("emergencyRelationship")?.value || '',
          emergencyPhone: (typeof getFullPhoneNumber === 'function' ? getFullPhoneNumber('emergencyPhone') : (document.getElementById("emergencyPhone")?.value || "")),
          emergencyEmail: document.getElementById("emergencyEmail")?.value || "",
          emergencyAddressLine1: document.getElementById("emergencyAddressLine1")?.value || '',
          emergencyAddressLine2: document.getElementById("emergencyAddressLine2")?.value || '',
          emergencyCity: document.getElementById("emergencyCity")?.value || '',
          emergencyState: document.getElementById("emergencyState")?.value || '',
          emergencyCountry: document.getElementById("emergencyCountry")?.value || '',
          hasDiabetes: document.getElementById("hasDiabetes")?.checked || false,
          paymentSource: document.getElementById("paymentSource")?.value || 'Self Pay',
          insuranceName: document.getElementById("insuranceName")?.value || "",
          insurancePolicyGroupNumber: document.getElementById("insurancePolicyGroupNumber")?.value || "",
          insuranceMemberNumber: document.getElementById("insuranceMemberNumber")?.value || "",
          visits: [],
          preventiveGaps: [],
          medicalHistory: tempMedicalHistory || [],
          diagnoses: tempDiagnoses || [],
          medications: tempMedications || [],
          allergies: tempAllergies || [],
          immunizations: tempImmunizations || []
        };
        
        // Save to localStorage as last resort
        // CRITICAL FIX: Ensure organization_id is set
        if (!patient.organization_id && !patient.organizationId && orgId) {
          patient.organization_id = orgId;
          patient.organizationId = orgId;
        }
        
        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        // Check if patient already exists
        const existingIndex = patients.findIndex(p => {
          const pDisplayId = p.patient_id || (p.id && !p.id.includes('-') ? p.id : null);
          return pDisplayId === patient.id;
        });
        if (existingIndex >= 0) {
          patients[existingIndex] = {
            ...patient,
            organization_id: orgId || patient.organization_id,
            organizationId: orgId || patient.organizationId,
            _synced: false,
            _fromLocalStorage: true
          };
        } else {
          patients.push({
            ...patient,
            organization_id: orgId || patient.organization_id,
            organizationId: orgId || patient.organizationId,
            _synced: false,
            _fromLocalStorage: true
          });
        }
        localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        
        // CRITICAL FIX: Clear cache
        if (typeof window.clearPatientCache === 'function') {
          window.clearPatientCache();
        }
        
        // Show success message - patient IS saved
        if (typeof window.showSuccessNotification === 'function') {
          window.showSuccessNotification('✅ Patient saved successfully! Some features may sync later.');
        } else {
          alert('✅ Patient saved successfully! Some features may sync later.');
        }
        
        // Still redirect
        setTimeout(() => {
          window.location.href = "/patients";
        }, 1500);
      } catch (fallbackError) {
        console.error('❌ Even fallback save failed:', fallbackError);
        reEnableButton();
        alert('❌ Error saving patient. Please try again or contact support.');
        return;
      }
    }
    } finally {
      // Always re-enable button if still disabled (safety net)
      reEnableButton();
    }
  });
}

// Update patient
const editPatientForm = document.getElementById("edit-patient-form");
if (editPatientForm) {
  editPatientForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get("id");
    
    // Check if patient number was changed (manual numbering enabled)
    const customPatientIdInput = document.getElementById('customPatientId');
    const newPatientId = customPatientIdInput && customPatientIdInput.value.trim() 
      ? customPatientIdInput.value.trim() 
      : null;
    
    let currentPatientId = patientId; // Use current patient ID
    
    // If patient ID was changed, cascade update (allows retroactive fix for wrong IDs)
    if (newPatientId && newPatientId !== patientId) {
      const updateResult = await window.updatePatientNumber(patientId, newPatientId);
      if (!updateResult.success) {
        alert(updateResult.error || 'Failed to update patient number');
        return;
      }
      // Update patientId for rest of form submission
      currentPatientId = newPatientId;
      urlParams.set('id', newPatientId);
      window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
    }
    
    const raceValue = (document.getElementById("race")?.value || '').trim();

    console.log('🔍 [EDIT-PATIENT] Saving patient data:', {
      middleName: document.getElementById("middleName").value,
      race: raceValue
    });
    
    const updated = {
      firstName: document.getElementById("firstName").value,
      middleName: document.getElementById("middleName").value,
      lastName: document.getElementById("lastName").value,
      dob: document.getElementById("dob").value,
      gender: document.getElementById("gender").value,
      maritalStatus: document.getElementById("maritalStatus").value,
      race: raceValue,
      email: document.getElementById("email").value,
      phone: (typeof getFullPhoneNumber === 'function' ? getFullPhoneNumber('phone') : document.getElementById("phone").value),
      addressLine1: document.getElementById("addressLine1").value,
      addressLine2: document.getElementById("addressLine2").value,
      city: document.getElementById("city").value,
      state: document.getElementById("state").value,
      country: document.getElementById("country").value,
      postalCode: document.getElementById("postalCode")?.value?.trim() || "",
      emergencyFirstName: document.getElementById("emergencyFirstName").value,
      emergencyLastName: document.getElementById("emergencyLastName").value,
      emergencyRelationship: document.getElementById("emergencyRelationship").value,
      emergencyPhone: (typeof getFullPhoneNumber === 'function' ? getFullPhoneNumber('emergencyPhone') : (document.getElementById("emergencyPhone")?.value || "")),
      emergencyEmail: document.getElementById("emergencyEmail")?.value || "",
      emergencyAddressLine1: document.getElementById("emergencyAddressLine1").value,
      emergencyAddressLine2: document.getElementById("emergencyAddressLine2").value,
      emergencyCity: document.getElementById("emergencyCity").value,
      emergencyState: document.getElementById("emergencyState").value,
      emergencyCountry: document.getElementById("emergencyCountry").value,
      phoneCountryCode: document.getElementById("phoneCountryCode")?.value || '',
      emergencyPhoneCountryCode: document.getElementById("emergencyPhoneCountryCode")?.value || '',
      hasDiabetes: document.getElementById("hasDiabetes").checked,
      paymentSource: document.getElementById("paymentSource").value,
      province: document.getElementById("patientProvince")?.value || document.getElementById("state")?.value || "",
      healthCardNumber: document.getElementById("healthCardNumber")?.value || "",
      healthCardVersion: document.getElementById("healthCardVersion")?.value || "",
      phn: document.getElementById("healthCardNumber")?.value || "",
      preferredPaymentMethod: document.getElementById("preferredPaymentMethod")?.value || "cash",
      wcbClaimNumber: document.getElementById("wcbClaimNumber")?.value?.trim() || "",
      insuranceName: document.getElementById("insuranceName").value || "",
      insurancePolicyGroupNumber: document.getElementById("insurancePolicyGroupNumber").value || "",
      insuranceMemberNumber: document.getElementById("insuranceMemberNumber").value || ""
    };

    if (typeof window.MediForgePatientCardUploads?.readRegistrationCards === 'function') {
      try {
        const cards = await window.MediForgePatientCardUploads.readRegistrationCards({ required: false });
        if (cards.identificationCard) {
          updated.identificationCard = cards.identificationCard;
          updated.identificationCardFileName = cards.identificationCardFileName;
        }
        if (cards.insuranceCard) {
          updated.insuranceCard = cards.insuranceCard;
          updated.insuranceCardFileName = cards.insuranceCardFileName;
          updated.insuranceCardFront = cards.insuranceCardFront || cards.insuranceCard;
        }
      } catch (cardError) {
        alert(cardError.message || 'Could not read uploaded document files.');
        return;
      }
    }
    
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patient = patients.find(p => p.id === currentPatientId || p.patient_id === currentPatientId);
    
    if (patient) {
      // Preserve existing insurance card files if no new ones uploaded
      if (!updated.insuranceCard && !updated.insuranceCardFront && patient.insuranceCardFront) {
        updated.insuranceCardFront = patient.insuranceCardFront;
        updated.insuranceCard = patient.insuranceCard || patient.insuranceCardFront;
      }
      if (!updated.insuranceCardBack && patient.insuranceCardBack) {
        updated.insuranceCardBack = patient.insuranceCardBack;
      }
      if (!updated.identificationCard && patient.identificationCard) {
        updated.identificationCard = patient.identificationCard;
        updated.identificationCardFileName = patient.identificationCardFileName;
      }
      
      // HYBRID ARCHITECTURE FIX: Supabase-first, localStorage fallback
      Object.assign(patient, updated);
      
      // Resolve organization ID using standardized utility
      let orgId = null;
      if (typeof window.resolveOrganizationId === 'function') {
        orgId = await window.resolveOrganizationId();
      } else {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        orgId = user.organizationId || user.organization_id;
        if (!orgId && user.org) {
          const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgData = organizations[user.org];
          if (orgData && orgData.id) {
            orgId = orgData.id;
          }
        }
      }
      
      if (!orgId) {
        const errorMsg = 'Cannot determine your organization. Please log out and log back in.';
        if (typeof window.showErrorNotification === 'function') {
          window.showErrorNotification(errorMsg);
        } else {
          alert(`❌ Error: ${errorMsg}`);
        }
        return;
      }
      
      // HYBRID ARCHITECTURE: Supabase-first with localStorage fallback
      // STEP 1: Try Supabase FIRST (always attempt)
      if (window.supabaseClient) {
        try {
        // CRITICAL: Use updated values (from form) not patient object (old values)
        // The patient object is updated with Object.assign AFTER we create this update object
        const supabasePatientUpdate = {
            first_name: updated.firstName,
            last_name: updated.lastName,
            middle_name: updated.middleName || null, // Use updated value from form
            gender: updated.gender,
            date_of_birth: updated.dob || null,
            phone: updated.phone,
            email: updated.email || null,
            // Schema only has 'address' (combined), not address_line1/address_line2
            address: updated.addressLine1 ? 
              `${updated.addressLine1}${updated.addressLine2 ? ', ' + updated.addressLine2 : ''}` : null,
            city: updated.city || null,
            state: updated.state || null,
            country: updated.country || null,
            postal_code: updated.postalCode || null,
            emergency_contact_name: updated.emergencyFirstName && updated.emergencyLastName ? 
              `${updated.emergencyFirstName} ${updated.emergencyLastName}` : null,
            emergency_contact_relationship: updated.emergencyRelationship || null,
            emergency_contact_phone: updated.emergencyPhone || null,
            blood_group: updated.bloodGroup || patient.bloodGroup || null,
            genotype: updated.genotype || patient.genotype || null,
            race: updated.race || null,
            marital_status: updated.maritalStatus || null,
            allergies: patient.allergies ? JSON.stringify(patient.allergies) : '[]',
            chronic_conditions: patient.conditions ? JSON.stringify(patient.conditions) : '[]',
            medications: patient.medications ? JSON.stringify(patient.medications) : '[]',
            medical_history: patient.medicalHistory ? JSON.stringify(patient.medicalHistory) : '[]',
            diagnoses: patient.diagnoses ? JSON.stringify(patient.diagnoses) : '[]',
            payment_source: updated.paymentSource || patient.paymentSource || 'Self Pay',
            insurance_name: updated.insuranceName || patient.insuranceName || null,
            insurance_policy_number: updated.insurancePolicyGroupNumber || patient.insurancePolicyGroupNumber || null,
            insurance_member_number: updated.insuranceMemberNumber || patient.insuranceMemberNumber || null
          };
          
          console.log('🔍 [EDIT-PATIENT] Updating Supabase with:', {
            patient_id: patient.id,
            organization_id: orgId,
            middle_name: supabasePatientUpdate.middle_name,
            first_name: supabasePatientUpdate.first_name,
            last_name: supabasePatientUpdate.last_name
          });
          
          const { data, error } = await window.supabaseClient
            .from('patients')
            .update(supabasePatientUpdate)
            .eq('patient_id', patient.id)
            .eq('organization_id', orgId)
            .select()
            .single();
          
          if (error) {
            console.error('❌ [EDIT-PATIENT] Supabase update error:', error);
            throw error;
          }
          
          console.log('✅ [EDIT-PATIENT] Supabase update successful:', {
            updated_patient: data,
            middle_name: data?.middle_name
          });
          
          // CRITICAL: Update the patient object with the returned data from Supabase
          // This ensures we have the exact data that was saved
          if (data) {
            // Map Supabase fields back to patient object format
            patient.firstName = data.first_name || patient.firstName;
            patient.middleName = data.middle_name || patient.middleName;
            patient.lastName = data.last_name || patient.lastName;
            patient.race = data.race || patient.race;
            patient.gender = data.gender || patient.gender;
            patient.dob = data.date_of_birth || patient.dob;
            patient.email = data.email || patient.email;
            patient.phone = data.phone || patient.phone;
            patient.addressLine1 = data.address_line1 || patient.addressLine1;
            patient.addressLine2 = data.address_line2 || patient.addressLine2;
            patient.city = data.city || patient.city;
            patient.state = data.state || patient.state;
            patient.country = data.country || patient.country;
            patient.emergencyFirstName = data.emergency_contact_name ? data.emergency_contact_name.split(' ')[0] : patient.emergencyFirstName;
            patient.emergencyLastName = data.emergency_contact_name ? data.emergency_contact_name.split(' ').slice(1).join(' ') : patient.emergencyLastName;
            patient.emergencyRelationship = data.emergency_contact_relationship || patient.emergencyRelationship;
            patient.emergencyPhone = data.emergency_contact_phone || patient.emergencyPhone;
            patient.emergencyEmail = data.emergency_contact_email || patient.emergencyEmail;
            patient.emergencyAddressLine1 = data.emergency_address_line1 || patient.emergencyAddressLine1;
            patient.emergencyAddressLine2 = data.emergency_address_line2 || patient.emergencyAddressLine2;
            patient.emergencyCity = data.emergency_city || patient.emergencyCity;
            patient.emergencyState = data.emergency_state || patient.emergencyState;
            patient.emergencyCountry = data.emergency_country || patient.emergencyCountry;
            patient.phoneCountryCode = data.phone_country_code || patient.phoneCountryCode;
            patient.emergencyPhoneCountryCode = data.emergency_phone_country_code || patient.emergencyPhoneCountryCode;
            patient.maritalStatus = data.marital_status || patient.maritalStatus;
            patient.paymentSource = data.payment_source || patient.paymentSource;

            if (typeof window.MediForgePayerEngine !== 'undefined' && window.MediForgePayerEngine.savePayerProfile && data?.id) {
              try {
                await window.MediForgePayerEngine.savePayerProfile(data.id, {
                  province: patient.province,
                  phn: patient.phn || patient.healthCardNumber,
                  healthCardVersion: patient.healthCardVersion,
                  paymentSource: patient.paymentSource,
                  primaryPayerCode: window.MediForgePayerEngine.PROVINCE_PAYER_MAP?.[patient.province],
                  privateInsurerId: patient.insuranceName,
                  insuranceMemberNumber: patient.insuranceMemberNumber,
                  insurancePolicyNumber: patient.insurancePolicyGroupNumber,
                  preferredPaymentMethod: patient.preferredPaymentMethod,
                  wcbClaimNumber: patient.wcbClaimNumber
                });
              } catch (payerErr) {
                console.warn('[EDIT-PATIENT] Payer profile save skipped:', payerErr.message);
              }
            }
            
            console.log('✅ [EDIT-PATIENT] Patient object updated with Supabase data:', {
              middleName: patient.middleName
            });
          }
          
          // Success - save updated patient to localStorage
          // Find and update the patient in the array
          const patientIndex = patients.findIndex(p => p.id === currentPatientId || p.patient_id === currentPatientId);
          if (patientIndex !== -1) {
            patients[patientIndex] = patient; // Use the updated patient object
          }
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          
          // Clear any cached data to force fresh load
          if (typeof window.clearDataCache === 'function') {
            window.clearDataCache('patients');
          }
          
          // Also clear universal data loader cache if available
          if (typeof window.dataCache !== 'undefined' && window.dataCache.patients) {
            window.dataCache.patients = null;
          }
          
          console.log('✅ [EDIT-PATIENT] Patient saved to localStorage:', {
            middleName: patient.middleName,
            patientId: patient.id
          });
          
          // CRITICAL: Verify the save by reading back from Supabase
          try {
            const { data: verifyData, error: verifyError } = await window.supabaseClient
              .from('patients')
              .select('middle_name, first_name, last_name, race')
              .eq('patient_id', patient.id)
              .eq('organization_id', orgId)
              .single();
            
            if (verifyError) {
              console.error('⚠️ [EDIT-PATIENT] Verification query failed:', verifyError);
            } else {
              console.log('✅ [EDIT-PATIENT] Verified save in Supabase:', {
                middle_name: verifyData.middle_name,
                first_name: verifyData.first_name,
                last_name: verifyData.last_name
              });
              
              // Double-check the values match
              if (verifyData.middle_name !== patient.middleName) {
                console.error('❌ [EDIT-PATIENT] MIDDLE NAME MISMATCH!', {
                  saved: patient.middleName,
                  inDatabase: verifyData.middle_name
                });
              }
            }
          } catch (verifyErr) {
            console.warn('⚠️ [EDIT-PATIENT] Could not verify save:', verifyErr);
          }
          
          if (typeof window.showSuccessNotification === 'function') {
            window.showSuccessNotification('Patient updated successfully');
          } else {
            alert('Patient updated successfully');
          }
          
          // Wait longer before redirect to ensure user can see logs
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (err) {
          // SUPABASE UPDATE FAILED - Fallback to localStorage (hybrid architecture pattern)
          console.error('❌ [EDIT-PATIENT] Supabase update failed, falling back to localStorage:', err);
          console.error('❌ [EDIT-PATIENT] Error details:', {
            message: err.message,
            code: err.code,
            details: err.details,
            hint: err.hint
          });
          
          // STEP 2: Fallback to localStorage and queue for sync
          try {
            const patientIndex = patients.findIndex(p => p.id === currentPatientId || p.patient_id === currentPatientId);
            if (patientIndex !== -1) {
              patients[patientIndex] = patient;
            }
            localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
            
            // Queue for sync when online (hybrid architecture pattern)
            if (typeof window.queueForSync === 'function') {
              window.queueForSync('patients', { id: patient.id, updates: updated }, 'update');
              console.log('✅ [EDIT-PATIENT] Patient queued for sync');
            }
            
            if (typeof window.clearDataCache === 'function') {
              window.clearDataCache('patients');
            }
            
            if (typeof window.showWarningNotification === 'function') {
              window.showWarningNotification('Updated locally. Will sync when online.');
            } else {
              alert('⚠️ Updated locally. Will sync when online.');
            }
            
          } catch (localStorageError) {
            console.error('❌ [EDIT-PATIENT] CRITICAL: Even localStorage save failed:', localStorageError);
            alert('❌ CRITICAL ERROR: Could not update patient. Please try again or contact support.');
            return;
          }
        }
      } else {
        // NO SUPABASE AVAILABLE - Use localStorage (hybrid architecture fallback)
        console.warn('⚠️ [EDIT-PATIENT] Supabase not available, using localStorage fallback');
        
        try {
          const patientIndex = patients.findIndex(p => p.id === currentPatientId || p.patient_id === currentPatientId);
          if (patientIndex !== -1) {
            patients[patientIndex] = patient;
          }
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          
          // Queue for sync when Supabase becomes available
          if (typeof window.queueForSync === 'function') {
            window.queueForSync('patients', { id: patient.id, updates: updated }, 'update');
          }
          
          if (typeof window.clearDataCache === 'function') {
            window.clearDataCache('patients');
          }
          
          if (typeof window.showWarningNotification === 'function') {
            window.showWarningNotification('Database not available. Updated locally and will sync automatically.');
          } else {
            alert('⚠️ Database not available. Updated locally and will sync automatically.');
          }
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (localStorageError) {
          console.error('❌ [EDIT-PATIENT] CRITICAL: localStorage save failed:', localStorageError);
          alert('❌ CRITICAL ERROR: Could not update patient. Please try again or contact support.');
          return;
        }
      }
      
      // Audit log: Patient edited
      if (typeof logAuditEvent !== 'undefined') {
        logAuditEvent('patient_edited', {
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`.trim()
        });
      }
      
      console.log('✅ [EDIT-PATIENT] Redirecting to patients page. Final patient data:', {
        id: patient.id,
        middleName: patient.middleName,
        firstName: patient.firstName,
        lastName: patient.lastName
      });
      
      window.location.href = "/patients";
    } else {
      console.error('Patient not found in localStorage for ID:', patientId);
    }
  });
}

// Delete patient
window.deletePatient = async function(patientId) {
  if (!confirm("Are you sure you want to delete this patient?")) {
    return;
  }

  // CRITICAL: Resolve patientId (could be legacy ID or UUID) to patient object
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  }

  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  let patientIndex = -1;
  
  if (patient) {
    // Find by legacy ID or UUID
    patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      p.id === patientId ||
      p.patient_id === patientId ||
      p.patientNumber === patientId
    );
  } else {
    // Fallback: try to find by patientId directly
    patientIndex = patients.findIndex(p => 
      p.id === patientId || 
      p.patient_id === patientId ||
      p.patientNumber === patientId ||
      p._supabaseUuid === patientId
    );
  }
  
  if (patientIndex === -1) {
    alert("Patient not found!");
    return;
  }

  // Get patient from array if not already resolved
  if (!patient) {
    patient = patients[patientIndex];
  }
  const fullName = `${patient.firstName} ${patient.lastName}`;
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const hasAppt = appointments.some(appt => appt.patientName === fullName);
  if (hasAppt) {
    alert("Cannot delete patient with existing appointments. Cancel them first.");
    return;
  }

  // HYBRID ARCHITECTURE: SUPABASE-FIRST
  // Step 1: Delete from Supabase FIRST
  let supabaseDeleted = false;
  if (window.supabaseClient) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      let orgId = user.organizationId || user.organization_id;
      if (!orgId && user.org) {
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        orgId = organizations[user.org]?.id;
      }
      
      if (orgId) {
        // Delete from Supabase using patient_id (display ID) and organization_id
        const { error: deleteError } = await window.supabaseClient
          .from('patients')
          .delete()
          .eq('patient_id', patientId)
          .eq('organization_id', orgId);
        
        if (deleteError) {
          console.warn('⚠️ Supabase delete failed (non-critical):', deleteError.message);
          // Continue with localStorage deletion as fallback
        } else {
          supabaseDeleted = true;
          // Patient deleted from Supabase successfully
        }
      }
    } catch (err) {
      console.warn('⚠️ Supabase delete exception (non-critical):', err.message);
      // Continue with localStorage deletion as fallback
    }
  }

  // Step 2: Delete from localStorage (always, regardless of Supabase result)
  patients.splice(patientIndex, 1);
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));

  // Step 3: Add to deleted patients list for restore
  let deleted = JSON.parse(localStorage.getItem(getDataKey("deleted_patients")) || "[]");
  deleted.push({ patient, deletedAt: Date.now() });
  localStorage.setItem(getDataKey("deleted_patients"), JSON.stringify(deleted));

  // Audit log: Patient deleted
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('patient_deleted', {
      patientId: patient.id,
      patientName: fullName,
      dob: patient.dob
    });
  }

  // Step 4: Update UI immediately (like appointments fix)
  // Update global allPatients array to prevent reappearance
  if (typeof allPatients !== 'undefined' && Array.isArray(allPatients)) {
    const filteredAllPatients = allPatients.filter(p => p && p.id !== patientId);
    allPatients = filteredAllPatients;
    
    // Update filtered patients if search is active
    if (typeof filteredPatients !== 'undefined' && Array.isArray(filteredPatients)) {
      const filteredFilteredPatients = filteredPatients.filter(p => p && p.id !== patientId);
      filteredPatients = filteredFilteredPatients;
    }
    
    // Re-display immediately
    await displayPatientsFromUniversalLoader(allPatients, currentPatientPage);
  } else {
    // Fallback: reload from data source
    loadPatients(currentPatientPage);
  }

  alert("Patient deleted. Available for restore in 60 days.");
};

// Purge old deleted patients (>60 days)
function purgeOldDeleted() {
  const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
  let deleted = JSON.parse(localStorage.getItem(getDataKey("deleted_patients")) || "[]");
  deleted = deleted.filter(d => Date.now() - d.deletedAt < SIXTY_DAYS);
  localStorage.setItem(getDataKey("deleted_patients"), JSON.stringify(deleted));
}

// Load deleted patients list
function loadDeletedPatients() {
  purgeOldDeleted();  // Clean up first
  const deleted = JSON.parse(localStorage.getItem(getDataKey("deleted_patients")) || "[]");
  const tbody = document.getElementById("deleted-list");
  if (tbody) {
    tbody.innerHTML = "";
    deleted.forEach((entry, index) => {
      const patient = entry.patient;
      const deletedDate = new Date(entry.deletedAt).toLocaleDateString();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${patient.firstName} ${patient.lastName}</td>
        <td>${deletedDate}</td>
        <td>
          <button onclick="restoreDeleted(${index})">Restore</button>
          <button onclick="permanentDelete(${index})">Permanent Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}

// Restore deleted patient
window.restoreDeleted = function(index) {
  if (confirm("Restore this patient?")) {
    let deleted = JSON.parse(localStorage.getItem(getDataKey("deleted_patients")) || "[]");
    const restored = deleted.splice(index, 1)[0].patient;
    localStorage.setItem(getDataKey("deleted_patients"), JSON.stringify(deleted));
    
    let patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    patients.push(restored);
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    
    alert("Patient restored.");
    loadDeletedPatients();
  }
};

// Permanent delete
window.permanentDelete = function(index) {
  if (confirm("Permanently delete this patient? This cannot be undone.")) {
    let deleted = JSON.parse(localStorage.getItem(getDataKey("deleted_patients")) || "[]");
    deleted.splice(index, 1);
    localStorage.setItem(getDataKey("deleted_patients"), JSON.stringify(deleted));
    alert("Permanently deleted.");
    loadDeletedPatients();
  }
};

// Load patient details (updated to display new fields)
async function loadPatientDetails() {
  const urlParams = new URLSearchParams(window.location.search);  // Get ID from URL
  let patientId = urlParams.get("patientId") || urlParams.get("id");  // Store patient ID in variable
  
  // CRITICAL FIX: If URL has UUID, resolve to legacy ID and redirect for consistency
  // Use sessionStorage to prevent infinite loops, but allow retry if we successfully get a legacy ID
  const redirectKey = `redirect_${patientId}`;
  const hasRedirected = sessionStorage.getItem(redirectKey);
  
  if (patientId && patientId.includes('-') && patientId.length === 36) {
    // It's a UUID, resolve to legacy ID and redirect
    // Only skip if we've already successfully redirected (not if it failed)
    if (hasRedirected !== 'true' && typeof window.resolvePatientByIdentifier === 'function') {
      try {
        console.log('🔄 loadPatientDetails: Detected UUID in URL, resolving to legacy ID...', patientId);
        const patient = await window.resolvePatientByIdentifier(patientId);
        if (patient) {
          console.log('✅ loadPatientDetails: Resolved patient:', {
            id: patient.id,
            patient_id: patient.patient_id,
            _supabaseUuid: patient._supabaseUuid
          });
          
          // CRITICAL: Check patient_id directly first (may have been just generated)
          let legacyId = patient.patient_id;
          
          // If no patient_id, try getPatientIdentifier
          if (!legacyId || legacyId === 'Unknown ID' || legacyId.includes('-')) {
            legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : null;
            console.log('🔍 loadPatientDetails: getPatientIdentifier returned:', legacyId);
          }
          
          // If still no valid legacy ID, check patient.id (should be legacy ID after resolvePatientByIdentifier)
          if (!legacyId || legacyId === 'Unknown ID' || legacyId.includes('-')) {
            legacyId = patient.id && !patient.id.includes('-') ? patient.id : null;
            console.log('🔍 loadPatientDetails: patient.id check returned:', legacyId);
          }
          
          // If we have a valid legacy ID, redirect immediately (no reload)
          if (legacyId && !legacyId.includes('-') && legacyId !== 'Unknown ID') {
            console.log('✅ loadPatientDetails: Found valid legacy ID, redirecting:', legacyId);
            // Mark that we've redirected to prevent infinite loop
            sessionStorage.setItem(redirectKey, 'true');
            
            // Redirect to legacy ID URL
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('id', legacyId);
            newUrl.searchParams.delete('patientId');
            console.log('🔄 loadPatientDetails: Redirecting to:', newUrl.toString());
            window.location.replace(newUrl.toString()); // Use replace() instead of history.replaceState() to prevent back button issues
            return; // Exit early, page will redirect
          } else {
            console.warn('⚠️ loadPatientDetails: Could not find valid legacy ID. legacyId:', legacyId, 'patient:', patient);
          }
        } else {
          console.warn('⚠️ loadPatientDetails: resolvePatientByIdentifier returned null for UUID:', patientId);
        }
      } catch (error) {
        console.error('❌ loadPatientDetails: Error resolving UUID to legacy ID:', error);
        // Mark redirect attempted to prevent retry loop
        sessionStorage.setItem(redirectKey, 'failed');
      }
    } else if (hasRedirected === 'true') {
      console.log('⏭️ loadPatientDetails: Skipping redirect - already redirected for this UUID');
    }
  }
  
  // Clear redirect flag if we successfully loaded with legacy ID
  if (patientId && !patientId.includes('-')) {
    sessionStorage.removeItem(`redirect_${patientId}`);
  }
  
  // TRACE LOG: patient-details.html loadPatientDetails - v=402
  // console.log('patient-details.html: loadPatientDetails called for patientId:', patientId);
  
  // Use Supabase data loader if available, fallback to localStorage
  let patients = [];
  if (typeof window.loadPatientsWithSupabasePriority === 'function') {
    try {
      // Using Supabase data loader for patient details
      patients = await window.loadPatientsWithSupabasePriority();
    } catch (error) {
      console.error('Supabase data loader failed, falling back to localStorage:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } else {
    console.log('Supabase data loader not available, using localStorage...');
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  // Use resolvePatientByIdentifier to handle both UUIDs and display IDs (MEC0006 format)
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    // Fallback: try to find by id or patient_id
    patient = patients.find(p => p.id === patientId || p.patient_id === patientId);
  }
  // console.log('🔧 TRACE: loadPatientDetails - Found patient:', patient);
  // console.log('🔧 TRACE: loadPatientDetails - patient.medicalHistory before processing:', patient ? patient.medicalHistory : 'patient not found');
  // console.log('🔧 TRACE: loadPatientDetails - patient.allergies:', patient ? patient.allergies : 'patient not found');
  // console.log('🔧 TRACE: loadPatientDetails - patient.diagnoses:', patient ? patient.diagnoses : 'patient not found');
  // console.log('🔧 TRACE: loadPatientDetails - patient.immunizations:', patient ? patient.immunizations : 'patient not found');
  if (patient) {
    // Latest patient_id from Supabase (e.g. after MIN → MFA-MC migration on the row).
    // Resolve the canonical row UUID first, refresh patient_id from that row, then optionally
    // align with the URL id only when it refers to the same row — avoids overwriting with a
    // different patient's row when patientNumber matched the URL but patient_id did not.
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      let orgId =
        user.organizationId ||
        user.organization_id ||
        patient.organizationId ||
        patient.organization_id;
      if (!orgId && user.org) {
        const o = JSON.parse(localStorage.getItem('organizations') || '{}');
        orgId = o[user.org] && o[user.org].id;
      }
      if (orgId && window.supabaseClient) {
        const sb = window.supabaseClient;

        /** @returns {Promise<string|null>} */
        const resolveCanonicalUuid = async () => {
          let uuid = patientRowUuidForDisplay(patient);
          if (uuid) return uuid;
          const tryLookupByDisplayPid = async (pid) => {
            if (!pid || isUuidLike(pid)) return null;
            const { data } = await sb
              .from('patients')
              .select('id')
              .eq('patient_id', pid)
              .eq('organization_id', orgId)
              .maybeSingle();
            return data && data.id ? data.id : null;
          };
          uuid =
            (await tryLookupByDisplayPid(patient.patient_id)) ||
            (await tryLookupByDisplayPid(patient.patientNumber)) ||
            (await tryLookupByDisplayPid(patient.id));
          if (uuid) return uuid;
          const pidStr =
            patientId ||
            patient.patient_id ||
            patient.patientNumber ||
            patient.id ||
            '';
          if (/^[A-Za-z]{3}[0-9A-F]{4}$/.test(String(pidStr))) {
            const tempDigits = String(pidStr).substring(3).toUpperCase();
            for (const p of patients) {
              const u =
                p._supabaseUuid ||
                (p.id && isUuidLike(p.id) ? p.id : null);
              if (!u || !String(u).includes('-')) continue;
              const uuidDigits = String(u).replace(/-/g, '').substring(28, 32).toUpperCase();
              if (uuidDigits === tempDigits) return u;
            }
          }
          return null;
        };

        const canonicalUuid = await resolveCanonicalUuid();
        if (canonicalUuid) {
          patient._supabaseUuid = canonicalUuid;
          const { data: freshRow } = await sb
            .from('patients')
            .select('patient_id')
            .eq('id', canonicalUuid)
            .eq('organization_id', orgId)
            .maybeSingle();
          if (freshRow && freshRow.patient_id && !isUuidLike(freshRow.patient_id)) {
            patient.patient_id = freshRow.patient_id;
            patient.id = freshRow.patient_id;
          }
        }

        if (patientId && !isUuidLike(patientId)) {
          const { data: urlRow } = await sb
            .from('patients')
            .select('patient_id, id')
            .eq('patient_id', patientId)
            .eq('organization_id', orgId)
            .maybeSingle();
          if (
            urlRow &&
            urlRow.patient_id &&
            !isUuidLike(urlRow.patient_id) &&
            canonicalUuid &&
            urlRow.id === canonicalUuid
          ) {
            patient.patient_id = urlRow.patient_id;
            patient.id = urlRow.patient_id;
          }
        }

        const rowUuid = patientRowUuidForDisplay(patient);
        if (rowUuid) {
          const { data: fr } = await sb
            .from('patients')
            .select('patient_id')
            .eq('id', rowUuid)
            .eq('organization_id', orgId)
            .maybeSingle();
          if (fr && fr.patient_id && !isUuidLike(fr.patient_id)) {
            patient.patient_id = fr.patient_id;
            patient.id = fr.patient_id;
          }
        }
      }
    } catch (e) {
      console.warn('loadPatientDetails: canonical patient_id hydrate failed:', e && e.message ? e.message : e);
    }
    // Load clinical note data from Supabase if available (for patient-details.html)
    const urlParams = new URLSearchParams(window.location.search);
    const visitDate = urlParams.get("visitDate") || new Date().toISOString().split('T')[0];
    await loadClinicalNoteDataFromSupabase(patient, visitDate);
    // Audit log: Patient viewed (HIPAA compliance)
    if (typeof logAuditEvent !== 'undefined') {
      logAuditEvent('patient_viewed', {
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        page: 'patient-details'
      });
    }
    
    // Ensure hasDiabetes is set if undefined
    if (patient.hasDiabetes === undefined) {
      patient.hasDiabetes = false;
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    }
    let insuranceInfo = "";
    if (patient.paymentSource === "Insurance") {
      insuranceInfo = `
        <p><strong>Payment Source:</strong> Insurance</p>
        <p><strong>Insurance Name:</strong> ${patient.insuranceName || 'Not provided'}</p>
        <p><strong>Policy Group Number:</strong> ${patient.insurancePolicyGroupNumber || 'Not provided'}</p>
        <p><strong>Member Number:</strong> ${patient.insuranceMemberNumber || 'Not provided'}</p>
        ${patient.identificationCard ? '<p><strong>Identification Card:</strong> ✓ Uploaded</p>' : ''}
        ${(patient.insuranceCard || patient.insuranceCardFront) ? '<p><strong>Insurance Card:</strong> ✓ Uploaded</p>' : ''}
        ${patient.insuranceCardBack ? '<p><strong>Insurance Card Back:</strong> ✓ Uploaded</p>' : ''}
      `;
    } else {
      insuranceInfo = `<p><strong>Payment Source:</strong> Cash</p>`;
    }
    
    // Get user-friendly patient ID (MEC0006 format) - NEVER use UUID for display
    let displayPatientId = getPatientIdentifier(patient);
    
    // CRITICAL FIX: If getPatientIdentifier returns null or UUID, try patient_id directly
    if (!displayPatientId || displayPatientId.includes('-') || displayPatientId === 'Unknown ID') {
      displayPatientId = patient.patient_id || patient.patientNumber || null;
      // If still null or UUID, check if patient.id is a valid legacy ID
      if (!displayPatientId || displayPatientId.includes('-')) {
        if (patient.id && !patient.id.includes('-') && patient.id.length < 36 && patient.id !== 'Unknown ID') {
          displayPatientId = patient.id;
        }
      }
      
      // CRITICAL: If still no valid ID, try to generate one NOW - NEVER show "ID Pending"
      if (!displayPatientId || displayPatientId.includes('-') || displayPatientId === 'Unknown ID') {
        console.warn('⚠️ loadPatientDetails: Patient missing valid legacy ID, attempting to generate...');
        try {
          // Try to resolve patient again to trigger ID generation
          const uuid = patient._supabaseUuid || patient.id;
          if (uuid && uuid.includes('-') && uuid.length === 36 && typeof window.resolvePatientByIdentifier === 'function') {
            const resolvedPatient = await window.resolvePatientByIdentifier(uuid);
            if (resolvedPatient && resolvedPatient.patient_id && !resolvedPatient.patient_id.includes('-')) {
              displayPatientId = resolvedPatient.patient_id;
              patient = resolvedPatient; // Update patient object
              if (window.__DEBUG_LOGS) {
                console.log('✅ loadPatientDetails: Generated legacy ID via resolvePatientByIdentifier:', displayPatientId);
              }
            }
          }
          
          // If still no ID, try ensureLegacyPatientId
          if (!displayPatientId || displayPatientId.includes('-')) {
            const normalizedPatient = await window.ensureLegacyPatientId ? await window.ensureLegacyPatientId(patient) : patient;
            if (normalizedPatient && normalizedPatient.patient_id && normalizedPatient.patient_id !== 'Unknown ID' && !normalizedPatient.patient_id.includes('-')) {
              displayPatientId = normalizedPatient.patient_id;
              patient = normalizedPatient; // Update patient object
              console.log('✅ loadPatientDetails: Generated legacy ID via ensureLegacyPatientId:', displayPatientId);
            }
          }
          
          // If STILL no ID, generate a temporary one based on UUID (will be replaced by SQL script)
          if (!displayPatientId || displayPatientId.includes('-') || displayPatientId === 'Unknown ID') {
            console.warn('⚠️ loadPatientDetails: Generating temporary ID from UUID...');
            const uuid = patient._supabaseUuid || patient.id;
            if (uuid && uuid.includes('-')) {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const orgId = user.organizationId || user.organization_id;
              let orgPrefix = 'ORG';
              
              if (orgId && window.supabaseClient) {
                try {
                  const { data: org } = await window.supabaseClient
                    .from('organizations')
                    .select('name')
                    .eq('id', orgId)
                    .single();
                  if (org?.name) {
                    orgPrefix = org.name.substring(0, 3).toUpperCase();
                  }
                } catch (error) {
                  console.warn('Could not get org prefix, using default:', error);
                }
              }
              
              // Use last 4 digits of UUID for temporary ID
              const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
              displayPatientId = `${orgPrefix}${uuidDigits}`;
              console.warn('⚠️ Using temporary patient_id:', displayPatientId, '- Run SQL script to assign proper sequential ID');
            }
          }
        } catch (error) {
          console.error('❌ loadPatientDetails: Error generating legacy ID:', error);
          // Last resort: use a simple fallback
          if (!displayPatientId || displayPatientId.includes('-')) {
            displayPatientId = 'TEMP001'; // Temporary fallback - should never happen
          }
        }
      }
    }
    
    try {
      if (typeof window.chooseDisplayPatientIdForMigratedOrg === 'function') {
        const preferred = await window.chooseDisplayPatientIdForMigratedOrg(patient);
        if (preferred) {
          displayPatientId = preferred;
          const u = new URLSearchParams(window.location.search);
          const k = u.has('id') ? 'id' : (u.has('patientId') ? 'patientId' : null);
          const cur = (k && u.get(k)) || '';
          if (k && cur && String(preferred).toUpperCase() !== String(cur).toUpperCase() && !String(cur).includes('-')) {
            u.set(k, preferred);
            const qs = u.toString();
            window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
          }
        }
      }
    } catch (e) {
      console.warn('loadPatientDetails: org display id preference', e);
    }

    try {
      if (typeof window.getPatientIdForDisplay === 'function') {
        const uiId = window.getPatientIdForDisplay(patient, patientId);
        if (uiId) displayPatientId = uiId;
      }
    } catch (e) {
      console.warn('loadPatientDetails: patient id for display', e);
    }
    const patientIdForUi =
      typeof window.patientMrnDisplay === 'function'
        ? window.patientMrnDisplay(patient, patientId)
        : displayPatientId;

    // Build address string (only show non-empty parts)
    const addressParts = [
      patient.addressLine1,
      patient.addressLine2,
      patient.city,
      patient.state,
      patient.country
    ].filter(part => part && part.trim() !== '');
    const addressDisplay = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
    
    // Build emergency address string
    const emergencyAddressParts = [
      patient.emergencyAddressLine1,
      patient.emergencyAddressLine2,
      patient.emergencyCity,
      patient.emergencyState,
      patient.emergencyCountry
    ].filter(part => part && part.trim() !== '');
    const emergencyAddressDisplay = emergencyAddressParts.length > 0 ? emergencyAddressParts.join(', ') : 'N/A';
    
    // Build emergency contact name
    const emergencyNameParts = [
      patient.emergencyFirstName,
      patient.emergencyLastName
    ].filter(part => part && part.trim() !== '');
    const emergencyNameDisplay = emergencyNameParts.length > 0 ? emergencyNameParts.join(' ') : 'N/A';
    
    // FIX: Handle both camelCase and snake_case field names from Supabase/localStorage
    // Also check localStorage directly as fallback if Supabase doesn't have the data
    // This handles cases where columns were added after patient registration
    let maritalStatus = (patient.maritalStatus || patient.marital_status || '').trim();
    let race = (patient.race || '').trim();
    
    // If still empty, try to get from localStorage directly (for patients registered before columns existed)
    if (!maritalStatus || !race) {
      try {
        console.log('🔍 Checking localStorage for marital_status/race. Patient:', {
          id: patient.id,
          patient_id: patient.patient_id,
          _supabaseUuid: patient._supabaseUuid,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dob: patient.dob,
          currentMaritalStatus: maritalStatus,
          currentRace: race
        });
        
        const localStoragePatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        console.log('🔍 localStorage patients count:', localStoragePatients.length);
        
        // Try multiple matching strategies
        let localPatient = null;
        
        // Strategy 1: Match by patient_id (display ID like MEC0011) - MOST RELIABLE
        if (patient.patient_id) {
          localPatient = localStoragePatients.find(p => 
            p.patient_id === patient.patient_id || 
            p.id === patient.patient_id ||
            p.patientNumber === patient.patient_id
          );
          if (localPatient) {
            console.log('✅ Found in localStorage by patient_id:', patient.patient_id);
          }
        }
        
        // Strategy 2: Match by UUID (_supabaseUuid or id if UUID)
        if (!localPatient && patient._supabaseUuid) {
          localPatient = localStoragePatients.find(p => 
            p._supabaseUuid === patient._supabaseUuid ||
            (p.id === patient._supabaseUuid && p.id.includes('-'))
          );
          if (localPatient) {
            console.log('✅ Found in localStorage by UUID:', patient._supabaseUuid);
          }
        }
        
        // Strategy 3: Match by name + DOB (fallback)
        if (!localPatient) {
          localPatient = localStoragePatients.find(p => 
            p.firstName === patient.firstName && 
            p.lastName === patient.lastName && 
            p.dob === patient.dob
          );
          if (localPatient) {
            console.log('✅ Found in localStorage by name + DOB');
          }
        }
        
        if (localPatient) {
          console.log('🔍 localStorage patient found:', {
            id: localPatient.id,
            patient_id: localPatient.patient_id,
            maritalStatus: localPatient.maritalStatus || localPatient.marital_status,
            firstName: localPatient.firstName,
            lastName: localPatient.lastName,
            dob: localPatient.dob,
            allKeys: Object.keys(localPatient).filter(k => k.includes('marital') || k.includes('race') || k.includes('Marital') || k.includes('Race'))
          });
          
          // Check ALL possible field name variations
          const localMaritalStatus = localPatient.maritalStatus || localPatient.marital_status || localPatient.MaritalStatus || localPatient.Marital_Status || '';
          const localRace = localPatient.race || '';
          
          console.log('🔍 Raw localStorage values:', {
            maritalStatus: localMaritalStatus,
            race: localRace,
            'localPatient.maritalStatus': localPatient.maritalStatus,
            'localPatient.marital_status': localPatient.marital_status,
            'localPatient.race': localPatient.race,
            'localPatient.race': localPatient.race
          });
          
          if (!maritalStatus) maritalStatus = String(localMaritalStatus || '').trim();
          if (!race) race = String(localRace || '').trim();
          
          console.log('🔍 After localStorage lookup:', { maritalStatus, race, 'maritalStatus length': maritalStatus.length, 'race length': race.length });
          
          // If we found data in localStorage but not in Supabase, sync it back
          // Use patient._supabaseUuid or patient.id (if UUID) for Supabase update
          const supabasePatientId = patient._supabaseUuid || (patient.id && patient.id.includes('-') ? patient.id : null);
          const patientDisplayId = patient.patient_id || patient.id;
          
          if ((maritalStatus || race) && window.supabaseClient) {
            const updateData = {};
            // Only update if Supabase doesn't have the data (check both empty string and null)
            const hasMaritalStatusInSupabase = patient.maritalStatus || patient.marital_status;
            const hasRaceInSupabase = patient.race;
            
            if (maritalStatus && !hasMaritalStatusInSupabase) {
              updateData.marital_status = maritalStatus;
            }
            if (race && !hasRaceInSupabase) {
              updateData.race = race;
              
            }
            
            if (Object.keys(updateData).length > 0) {
              console.log('🔄 Syncing to Supabase:', updateData);
              console.log('🔄 Using patient UUID:', supabasePatientId, 'or patient_id:', patientDisplayId);
              
              // Try UUID first, then fallback to patient_id
              let updatePromise = null;
              if (supabasePatientId) {
                updatePromise = window.supabaseClient
                  .from('patients')
                  .update(updateData)
                  .eq('id', supabasePatientId);
              } else if (patientDisplayId) {
                // Fallback: update by patient_id (display ID) + organization_id
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                const orgId = user.organizationId || user.organization_id;
                if (orgId) {
                  updatePromise = window.supabaseClient
                    .from('patients')
                    .update(updateData)
                    .eq('patient_id', patientDisplayId)
                    .eq('organization_id', orgId);
                }
              }
              
              if (updatePromise) {
                updatePromise
                  .then(({ data, error }) => {
                    if (error) {
                      console.error('❌ Could not sync marital_status/race to Supabase:', error);
                    } else {
                      console.log('✅ Synced marital_status/race from localStorage to Supabase:', updateData);
                      // Update the patient object immediately so display updates
                      if (maritalStatus) patient.maritalStatus = maritalStatus;
                      if (race) patient.race = race; patient.race = race;
                      // Reload patient details to show updated data
                      setTimeout(() => loadPatientDetails(), 500);
                    }
                  })
                  .catch(err => {
                    console.error('❌ Exception syncing marital_status/race to Supabase:', err);
                  });
              } else {
                console.warn('⚠️ Cannot sync: missing UUID or patient_id. supabaseClient:', !!window.supabaseClient, 'supabasePatientId:', supabasePatientId, 'patientDisplayId:', patientDisplayId);
              }
            } else {
              console.log('ℹ️ No update needed - data already in Supabase or no new data found');
            }
          } else {
            console.warn('⚠️ Cannot sync: missing supabaseClient or no data found. supabaseClient:', !!window.supabaseClient, 'maritalStatus:', maritalStatus, 'race:', race);
          }
        } else {
          console.warn('⚠️ Patient not found in localStorage. Searched by:', {
            patient_id: patient.patient_id,
            _supabaseUuid: patient._supabaseUuid,
            name: `${patient.firstName} ${patient.lastName}`,
            dob: patient.dob
          });
        }
      } catch (e) {
        console.error('❌ Exception checking localStorage for marital_status/race:', e);
      }
    }
    
    const email = (patient.email || '').trim();
    const phone = (patient.phone || '').trim();
    const emergencyPhone = (patient.emergencyPhone || patient.emergency_phone || patient.emergency_contact_phone || '').trim();
    const emergencyEmail = (patient.emergencyEmail || patient.emergency_email || patient.emergency_contact_email || '').trim();
    const emergencyRelationship = (patient.emergencyRelationship || patient.emergency_relationship || patient.emergency_contact_relationship || '').trim();
    
    // Extract payment source for inline display
    const paymentSource = patient.paymentSource || 'Cash';
    
    document.getElementById("patient-info").innerHTML = `
      <p><strong>Patient ID:</strong> ${patientIdForUi} | <strong>Full Name:</strong> ${patient.firstName} ${patient.middleName ? patient.middleName : ''} ${patient.lastName} | <strong>DOB:</strong> ${patient.dob} | <strong>Gender:</strong> ${patient.gender} | <strong>Marital Status:</strong> ${maritalStatus || 'N/A'} | <strong>Race:</strong> ${race || 'N/A'}</p>
      <p><strong>Email:</strong> ${email || 'N/A'} | <strong>Phone:</strong> ${phone || 'N/A'} | <strong>Address:</strong> ${addressDisplay}</p>
      <p><strong>Emergency Contact:</strong> ${emergencyNameDisplay}${emergencyRelationship ? ` (${emergencyRelationship})` : ''} | <strong>Emergency Phone:</strong> ${emergencyPhone || 'N/A'} | <strong>Emergency Email:</strong> ${emergencyEmail || 'N/A'} | <strong>Emergency Address:</strong> ${emergencyAddressDisplay}</p>
      <p><strong>Has Diabetes:</strong> ${patient.hasDiabetes ? 'Yes' : 'No'} | <strong>Payment Source:</strong> ${paymentSource}</p>
      ${patient.paymentSource === 'Insurance' ? insuranceInfo.replace(/<p><strong>Payment Source:<\/strong>[^<]+<\/p>\s*/g, '') : ''}
    `;
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit Demographics";
    // CRITICAL: Use legacy ID (displayPatientId) for edit URL, not UUID
    const editPatientId =
      patientIdForUi && patientIdForUi !== '—' ? patientIdForUi : patientId || displayPatientId;
    editBtn.onclick = () => window.location.href = `/edit-patient?id=${encodeURIComponent(editPatientId)}`;
    document.getElementById("patient-info").appendChild(editBtn);
    // console.log('🔧 TRACE: loadPatientDetails - patient.medicalHistory:', patient.medicalHistory);
    // console.log('🔧 TRACE: loadPatientDetails - typeof patient.medicalHistory:', typeof patient.medicalHistory);
    // console.log('🔧 TRACE: loadPatientDetails - patient.medicalHistory length:', patient.medicalHistory ? patient.medicalHistory.length : 'undefined');
    displayHistory(patient.medicalHistory || []);
    displayDiagnoses(patient.diagnoses || []);
  // Display patient-reported medications (historical)
  // Loading patient medications for display
  
  // Ensure medications array exists and is properly initialized
  if (!patient.medications) {
    patient.medications = [];
  }
  
  displayPatientReportedMedications(patient.medications);
  
  // Load all prescriptions for this patient
  loadAllPrescriptionsForPatient(patientId);
  
    displayAllergies(patient.allergies || []);
    displayImmunizations(patient.immunizations || []);
    displayEncountersSummary(patient.encounters || []);
    displayUpcomingAppointments(patient.id);
    
    // Display preventive care gaps
    if (typeof displayGaps === 'function') {
      await displayGaps(patientId, "gaps-section");
    }
    
    // Clean up any invalid orders first
    cleanupInvalidOrders();
    
    await displayGeneratedOrders(patient);
    displayGeneratedReferrals(patient);
    displayVitalSignsSummary(patient);
    
    // Sync appointments to visits before displaying
    syncAppointmentsToVisits(patient);
    
    const visitList = document.getElementById("visit-list");
    visitList.innerHTML = "";
    
    if (!patient.visits || patient.visits.length === 0) {
      return;
    }
    
    patient.visits.forEach(visit => {
      const row = document.createElement("tr");
      
      // Check if note is locked
      let statusText = "Open";
      let statusStyle = "color: #28a745; font-weight: bold;";
      if (visit.soap && visit.soap.locked) {
        statusText = "🔒 Locked";
        statusStyle = "color: #dc3545; font-weight: bold;";
      } else if (visit.soap && visit.soap.auditTrail && visit.soap.auditTrail.length > 0) {
        // Check if there's an audit trail (meaning it was locked before)
        const hasLockHistory = visit.soap.auditTrail.some(entry => entry.action === 'locked');
        if (hasLockHistory) {
          statusText = "🔓 Unlocked";
          statusStyle = "color: #ffc107; font-weight: bold;";
        }
      }
      
      // Create note button (single button - page auto-detects specialty)
      const noteButton = `<button onclick="openClinicalNoteById('${patient.id}', '${visit.date}')" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Open Clinical Note</button>`;
      
      row.innerHTML = `
        <td>${visit.date}</td>
        <td style="${statusStyle}">${statusText}</td>
        <td>${noteButton}</td>
      `;
      visitList.appendChild(row);
    });
  } else {
    console.error("Patient not found in loadPatientDetails");
    document.getElementById("patient-info").innerHTML = '<div style="color: red; padding: 20px;">Error: Patient not found.</div>';
  }
  
  // Ensure prescription button visibility is set based on user role
  const user = JSON.parse(localStorage.getItem("user"));
  if (localStorage.getItem('enableVerboseLogs') === 'true') {
    // Evaluating prescription permissions
  }
  const prescriptionBtn = document.getElementById('new-prescription-btn');
  if (prescriptionBtn) {
    // Only Doctor, Nurse, and Physician Assistant can write prescriptions
    const canWritePrescriptions = user && (user.role === "Doctor" || user.role === "Nurse" || user.role === "Physician Assistant");
    if (canWritePrescriptions) {
      prescriptionBtn.style.setProperty('display', 'block', 'important');
      prescriptionBtn.style.setProperty('visibility', 'visible', 'important');
      prescriptionBtn.style.setProperty('opacity', '1', 'important');
      prescriptionBtn.style.setProperty('position', 'relative', 'important');
      prescriptionBtn.style.setProperty('z-index', '10', 'important');
    } else {
      prescriptionBtn.style.setProperty('display', 'none', 'important');
      prescriptionBtn.style.setProperty('visibility', 'hidden', 'important');
      prescriptionBtn.style.setProperty('opacity', '0', 'important');
    }
    console.log('Setting prescription button visibility:', canWritePrescriptions ? 'visible' : 'hidden', 'for user role:', user?.role);
  }
}
// Load patient details from localStorage only (for sync events)
async function loadPatientDetailsFromLocalStorage() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  
  if (!patientId) {
    console.error("No patient ID found in URL");
    return;
  }
  
  // console.log(`🔧 TRACE: loadPatientDetailsFromLocalStorage called for patientId: ${patientId}`);
  
  // Force localStorage loading
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - Loaded from localStorage, patients count:', patients.length);
  // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - All patients:', patients);
  
  const patient = patients.find(p => p.id === patientId);
  // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - Found patient:', patient);
  // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - patient.medicalHistory:', patient ? patient.medicalHistory : 'patient not found');
  // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - patient keys:', patient ? Object.keys(patient) : 'patient not found');
  
  if (patient) {
    // Load clinical note data from Supabase if available (for patient-details.html)
    const urlParams = new URLSearchParams(window.location.search);
    const visitDate = urlParams.get("visitDate") || new Date().toISOString().split('T')[0];
    await loadClinicalNoteDataFromSupabase(patient, visitDate);
    // Display patient information (with null checks)
    const patientNameEl = document.getElementById("patient-name");
    const patientIdEl = document.getElementById("patient-id");
    const patientDobEl = document.getElementById("patient-dob");
    const patientGenderEl = document.getElementById("patient-gender");
    const patientPhoneEl = document.getElementById("patient-phone");
    const patientEmailEl = document.getElementById("patient-email");
    const patientAddressEl = document.getElementById("patient-address");
    
    // CRITICAL: Get user-friendly patient ID - NEVER use UUID
    const displayPatientId = window.getLegacyPatientId ? window.getLegacyPatientId(patient) : (getPatientIdentifier(patient) || 'TEMP0001');
    
    if (patientNameEl) patientNameEl.textContent = `${patient.firstName} ${patient.lastName}`;
    if (patientIdEl) patientIdEl.textContent = displayPatientId;
    if (patientDobEl) patientDobEl.textContent = patient.dob;
    if (patientGenderEl) patientGenderEl.textContent = patient.gender;
    if (patientPhoneEl) patientPhoneEl.textContent = patient.phone || "N/A";
    if (patientEmailEl) patientEmailEl.textContent = patient.email || "N/A";
    if (patientAddressEl) patientAddressEl.textContent = patient.address || "N/A";
    
    // Add edit button
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit Patient";
    editBtn.className = "btn btn-primary";
    editBtn.onclick = () => editPatient(patient.id);
    document.getElementById("patient-info").appendChild(editBtn);
    // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - patient.medicalHistory:', patient.medicalHistory);
    // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - typeof patient.medicalHistory:', typeof patient.medicalHistory);
    // console.log('🔧 TRACE: loadPatientDetailsFromLocalStorage - patient.medicalHistory length:', patient.medicalHistory ? patient.medicalHistory.length : 'undefined');
    displayHistory(patient.medicalHistory || []);
    displayDiagnoses(patient.diagnoses || []);
    displayAllergies(patient.allergies || []);
    displayImmunizations(patient.immunizations || []);
    displayMedications(patient.medications || []);
    
    // Load prescriptions (with null check)
    if (typeof loadPatientPrescriptions === 'function') {
      loadPatientPrescriptions(patientId);
    }
    
    // Load referrals (with null check)
    if (typeof displayReferrals === 'function') {
      displayReferrals(patientId);
    }
    
    // Load preventive care gaps (with null check)
    if (typeof displayGaps === 'function') {
      await displayGaps(patientId, "gaps-section");
    }
  } else {
    console.error("Patient not found in localStorage");
  }
}

// Display generated orders
// Helper function to format lab order serial number - always use LAB-MEC-XXXX / IMG-MEC-XXXX format
// Retroactively normalizes legacy LAB-XXX (without org prefix) to LAB-MEC-XXX for consistent display
window.formatLabOrderSerial = function formatLabOrderSerial(serialNumber, orderId, orderOrOrgId) {
  if (!serialNumber) {
    return orderId ? orderId.substring(0, 8) : 'N/A';
  }
  
  const normalized = String(serialNumber || '').trim().toUpperCase();
  const prefix = normalized.startsWith('IMG') ? 'IMG' : 'LAB';

  // Get org prefix for display (MEC, etc.) - from order, localStorage, or default
  function getOrgPrefix() {
    let orgId = null;
    if (orderOrOrgId) {
      orgId = typeof orderOrOrgId === 'object' ? (orderOrOrgId.organization_id || orderOrOrgId.orgId) : orderOrOrgId;
    }
    if (!orgId) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        orgId = user.organizationId || user.organization_id;
      } catch (e) {}
    }
    if (orgId) {
      try {
        const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
        const org = Object.values(orgs).find(o => o && o.id === orgId);
        if (org?.name) return org.name.substring(0, 3).toUpperCase();
      } catch (e) {}
    }
    return 'MEC';
  }

  // Legacy format LAB-XXX or IMG-XXX (no org prefix) - normalize to LAB-MEC-XXX for consistent display
  const legacyMatch = normalized.match(/^(LAB|IMG)-(\d+)$/);
  if (legacyMatch) {
    const numPart = legacyMatch[2];
    const padded = numPart.length <= 3 ? numPart.padStart(3, '0') : numPart;
    return `${prefix}-${getOrgPrefix()}-${padded}`;
  }

  // Already in correct format LAB-MEC-XXX / IMG-MEC-XXX - return as-is
  if (serialNumber.length <= 20 && /^(LAB|IMG)-[A-Z]{2,4}-\d+$/.test(normalized)) {
    return serialNumber;
  }
  
  // If it's short but not matching expected format, continue to long-format parsing
  if (serialNumber.length <= 15 && !normalized.match(/^(LAB|IMG)-/)) {
    return serialNumber;
  }
  
  // If it matches pattern like "LAB-MEC0006-1767378043043-if5wean" or "IMG-MEC0006-1767378043043-if5wean", extract meaningful parts
  const parts = serialNumber.split('-');
  if (parts.length > 2 && (parts[0] === 'LAB' || parts[0] === 'IMG')) {
    // Try to extract org prefix from the serial number if present (e.g., MEC0006 -> MEC)
    let orgPrefix = null;
    if (parts.length >= 2) {
      const secondPart = parts[1];
      // Check if second part looks like org prefix + number (e.g., MEC0006)
      const orgPrefixMatch = secondPart.match(/^([A-Z]{2,4})\d+$/);
      if (orgPrefixMatch) {
        orgPrefix = orgPrefixMatch[1];
      }
    }
    
    // Try to find a numeric timestamp part (long number like 1767378043043)
    const timestampPart = parts.find(p => /^\d{10,}$/.test(p));
    if (timestampPart) {
      // Extract last 3 digits from timestamp
      const lastThreeDigits = timestampPart.substring(timestampPart.length - 3);
      // Use org prefix if found, otherwise just LAB
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastThreeDigits}` : `${prefix}-${lastThreeDigits}`;
    }
    
    // If no timestamp found, try to find any numeric part
    const numericPart = parts.find(p => /^\d+$/.test(p));
    if (numericPart) {
      // Use last 3 digits of numeric part
      const lastThreeDigits = numericPart.substring(Math.max(0, numericPart.length - 3));
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastThreeDigits.padStart(3, '0')}` : `${prefix}-${lastThreeDigits.padStart(3, '0')}`;
    }
    
    // Fallback: use last 4 characters of order ID if available
    if (orderId && orderId.length >= 4) {
      const shortId = orderId.substring(orderId.length - 4).replace(/-/g, '');
      return orgPrefix ? `${prefix}-${orgPrefix}-${shortId}` : `${prefix}-${shortId}`;
    }
    
    // Last resort: use first 3 characters of last part
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length >= 3) {
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastPart.substring(0, 3)}` : `${prefix}-${lastPart.substring(0, 3)}`;
    }
  }
  
  // If it's still too long and doesn't match expected pattern, truncate it
  if (serialNumber.length > 20) {
    return serialNumber.substring(0, 17) + '...';
  }
  
  return serialNumber;
};

async function displayGeneratedOrders(patient) {
  // HYBRID ARCHITECTURE: Patient passed in is already from hybrid load (Supabase-first)
  // But we must check localStorage for newest orders (they may not be synced to Supabase yet)
  const patientId = patient ? patient.id : null;
  if (!patientId) {
    console.error('❌ Invalid patient object passed to displayGeneratedOrders');
    return;
  }
  
  const tbody = document.getElementById("generated-orders-list");
  if (!tbody) {
    return;
  }
  
  // CRITICAL: Clear table immediately to prevent duplicates from multiple calls
  tbody.innerHTML = "";
  
  // Add a guard to prevent multiple simultaneous calls
  if (window._displayingOrders) {
    console.log('🔍 [displayGeneratedOrders] Already displaying orders, skipping duplicate call');
    return;
  }
  window._displayingOrders = true;
  
  try {
  
  // HYBRID ARCHITECTURE STEP 1: Load orders from Supabase orders table (Supabase-first)
  // CRITICAL: Orders table stores patient_id as UUID, but patient.id might be legacy ID
  // Need to resolve to UUID first
  let supabaseOrders = [];
  if (window.supabaseClient) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      let orgId = user.organizationId || user.organization_id;
      
      if (orgId) {
        // Determine the UUID to query with - orders table stores UUIDs in patient_id column
        // If patient.id is a legacy ID (MEC0021), use patient._supabaseUuid
        // If patient.id is already a UUID, use it directly
        const isLegacyId = patientId && !patientId.includes('-') && patientId.length < 36;
        const queryPatientId = isLegacyId ? (patient._supabaseUuid || patientId) : patientId;
        
        console.log('🔍 [displayGeneratedOrders] Querying orders with patient ID:', {
          originalPatientId: patientId,
          isLegacyId: isLegacyId,
          queryPatientId: queryPatientId,
          hasSupabaseUuid: !!patient._supabaseUuid
        });
        
        // Try querying with UUID first (most common case)
        let ordersData = null;
        let ordersError = null;
        
        if (queryPatientId) {
          const { data, error } = await window.supabaseClient
            .from('orders')
            .select('*')
            .eq('patient_id', queryPatientId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          
          ordersData = data;
          ordersError = error;
        }
        
        // If no results and we used a legacy ID, try querying by legacy ID as fallback
        // (in case orders were saved with legacy ID for some reason)
        if ((!ordersData || ordersData.length === 0) && isLegacyId && queryPatientId !== patientId) {
          console.log('🔍 [displayGeneratedOrders] No orders found with UUID, trying legacy ID as fallback...');
          const { data, error } = await window.supabaseClient
            .from('orders')
            .select('*')
            .eq('patient_id', patientId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          
          if (!error && data && data.length > 0) {
            ordersData = data;
            ordersError = null;
          }
        }
        
        if (!ordersError && ordersData && ordersData.length > 0) {
          console.log(`✅ Loaded ${ordersData.length} order(s) from Supabase orders table`);
          // Convert Supabase orders to the format expected by display
          supabaseOrders = ordersData.map(order => ({
            id: order.id,
            type: order.type,
            serialNumber: order.serial_number,
            selectedItems: order.selected_items || [],
            noItemsChecked: order.no_items_checked || false,
            status: order.status || 'Generated',
            timestamp: order.timestamp || order.created_at,
            visitDate: order.visit_date,
            results: order.results || null,
            html_content: order.html_content
          }));
        } else if (ordersError) {
          console.warn('⚠️ Error loading orders from Supabase:', ordersError);
        } else {
          console.log('ℹ️ No orders found in Supabase orders table for patient:', queryPatientId || patientId);
        }
      }
    } catch (error) {
      console.warn('⚠️ Exception loading orders from Supabase:', error);
    }
  }
  
  // HYBRID ARCHITECTURE STEP 2: Merge orders from localStorage (newest source for orders)
  const localStoragePatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const localStoragePatient = localStoragePatients.find(p => p.id === patientId);
  
  if (localStoragePatient && localStoragePatient.visits) {
    if (!patient.visits) {
      patient.visits = [];
    }
    
    localStoragePatient.visits.forEach(localVisit => {
      const patientVisit = patient.visits.find(v => v.date === localVisit.date);
      if (patientVisit) {
        // Merge: prioritize localStorage orders (newest), fallback to patient orders (from Supabase)
        if (localVisit.orders && localVisit.orders.length > 0) {
          patientVisit.orders = localVisit.orders;
        }
      } else {
        patient.visits.push(localVisit);
      }
    });
  }
  
  // Fallback: use localStorage patient if no visits in patient data
  if (!patient.visits && localStoragePatient) {
    patient = localStoragePatient;
  }
  
  // Get current visit date from URL if on clinical-note page (filter orders by visit)
  const urlParams = new URLSearchParams(window.location.search);
  const currentVisitDate = urlParams.get("visitDate");
  
  // Collect orders from visits (filter by current visit date if on clinical-note page)
  const allOrders = [];
  const seenOrderKeys = new Set(); // Track seen orders to prevent duplicates
  
  if (patient.visits && Array.isArray(patient.visits)) {
    patient.visits.forEach(visit => {
      // If on clinical-note page, only show orders for current visit
      if (currentVisitDate && visit.date !== currentVisitDate) {
        return; // Skip visits that don't match current visit date
      }
      
      if (visit.orders && visit.orders.length > 0) {
        visit.orders.forEach(order => {
          // Filter out deleted orders (soft-deleted in Supabase)
          if (order.deleted_at || order.deletedAt) {
            return; // Skip deleted orders
          }
          
          // Filter out invalid orders (no items selected and no "no items" checkbox)
          const hasItems = order.selectedItems && order.selectedItems.length > 0;
          const noItemsChecked = order.noItemsChecked;
          if (!hasItems && !noItemsChecked) {
            return; // Skip invalid orders
          }
          
          // Create unique key for deduplication (serial number + timestamp)
          const serialNum = order.serialNumber || order.serial_number || '';
          const timestamp = order.timestamp || '';
          const orderKey = `${serialNum}_${timestamp}`;
          
          // Only add if we haven't seen this order before
          if (!seenOrderKeys.has(orderKey)) {
            seenOrderKeys.add(orderKey);
            allOrders.push({
              ...order,
              visitDate: visit.date
            });
          }
        });
      }
    });
  }
  
  // Merge Supabase orders with visit orders (deduplicate by serial number + timestamp)
  // Also filter by current visit date if on clinical-note page
  supabaseOrders.forEach(supabaseOrder => {
    // If on clinical-note page, only show orders for current visit
    if (currentVisitDate && supabaseOrder.visitDate !== currentVisitDate) {
      return; // Skip orders that don't match current visit date
    }
    
    const serialNum = supabaseOrder.serialNumber || supabaseOrder.serial_number || '';
    const timestamp = supabaseOrder.timestamp || '';
    const orderKey = `${serialNum}_${timestamp}`;
    
    // Only add if we haven't seen this order before
    if (!seenOrderKeys.has(orderKey)) {
      seenOrderKeys.add(orderKey);
      allOrders.push(supabaseOrder);
    } else {
      console.log('🔍 [displayGeneratedOrders] Skipping duplicate order:', orderKey);
    }
  });
  
  console.log(`🔍 [displayGeneratedOrders] Total unique orders after deduplication: ${allOrders.length}`);
  console.log(`🔍 [displayGeneratedOrders] Orders from visits: ${allOrders.filter(o => !o.id).length}, Orders from Supabase: ${allOrders.filter(o => o.id).length}`);
  
  // CRITICAL: Additional deduplication pass - remove any remaining duplicates by serial number
  // This handles cases where timestamps might be slightly different but serial numbers are the same
  const finalOrders = [];
  const seenSerialNumbers = new Set();
  
  allOrders.forEach(order => {
    const serialNum = order.serialNumber || order.serial_number || '';
    if (serialNum && !seenSerialNumbers.has(serialNum)) {
      seenSerialNumbers.add(serialNum);
      finalOrders.push(order);
    } else if (!serialNum) {
      // If no serial number, use timestamp as fallback
      const timestamp = order.timestamp || '';
      const fallbackKey = `no_serial_${timestamp}`;
      if (!seenSerialNumbers.has(fallbackKey)) {
        seenSerialNumbers.add(fallbackKey);
        finalOrders.push(order);
      }
    }
  });
  
  console.log(`🔍 [displayGeneratedOrders] Final orders after serial number deduplication: ${finalOrders.length}`);
  
  // Sort orders by timestamp (most recent first)
  finalOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Use finalOrders instead of allOrders
  const allOrdersToDisplay = finalOrders;
  
  if (allOrdersToDisplay.length === 0) {
    tbody.innerHTML = ""; // Empty table body
    // Show "No orders" message
    const noOrdersMsg = document.getElementById("no-orders-message");
    if (noOrdersMsg) {
      noOrdersMsg.style.display = "block";
    }
    return;
  }
  
  // Hide "No orders" message if orders exist
  const noOrdersMsg = document.getElementById("no-orders-message");
  if (noOrdersMsg) {
    noOrdersMsg.style.display = "none";
  }
  
  // Fetch lab results from Supabase for lab orders
  const labOrderIds = allOrdersToDisplay.filter(o => o.type === 'lab' && o.id).map(o => o.id);
  const labResultsMap = {};
  
  // Use getLabSupabaseClient if available (from lab-results-manager.js), else fallback to supabaseClient
  const getSupabaseForLab = async () => {
    if (typeof window.getLabSupabaseClient === 'function') return await window.getLabSupabaseClient();
    return window.supabaseClient || null;
  };
  if (labOrderIds.length > 0) {
    try {
      const supabase = await getSupabaseForLab();
      if (supabase) {
        const { data: ordersWithResults, error } = await supabase
        .from('orders')
        .select('id, results, status')
        .in('id', labOrderIds)
        .not('results', 'is', null);
      
      if (!error && ordersWithResults) {
        ordersWithResults.forEach(order => {
          labResultsMap[order.id] = order.results;
        });
      }
      }
    } catch (error) {
      console.warn('Could not fetch lab results from Supabase:', error);
    }
  }
  
  allOrdersToDisplay.forEach(order => {
    const row = document.createElement("tr");
    const date = new Date(order.timestamp).toLocaleDateString();
    const orderType = order.type === 'lab' ? 'Lab Order' : 'Imaging Order';
    
    // Fix: Extract item names from objects (selectedItems can be array of objects or strings).
    // For lab orders, collapse panel sub-tests to panel name so we show "Hepatitis B Profile, Hormonal Profile (Panel)".
    let items = 'No items selected';
    if (order.noItemsChecked) {
      items = 'No items required';
    } else if (order.selectedItems && order.selectedItems.length > 0) {
      const displayNames = order.type === 'lab' && typeof collapsePanelNamesForDisplay === 'function'
        ? collapsePanelNamesForDisplay(order.selectedItems)
        : order.selectedItems.map(item => typeof item === 'object' && item !== null ? (item.name || item.testName || JSON.stringify(item)) : item);
      items = Array.isArray(displayNames) ? displayNames.join(", ") : String(displayNames);
    }
    
    const status = order.status || 'Generated';
    
    // Format status with badge
    let statusClass = 'status-default';
    let statusText = status;
    if (status.toLowerCase().includes('sent') || status.toLowerCase().includes('completed') || status.toLowerCase() === 'sent_to_lab' || status.toLowerCase() === 'sent_to_external_lab') {
      statusClass = 'status-success';
      statusText = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } else if (status.toLowerCase().includes('pending') || status.toLowerCase().includes('generated')) {
      statusClass = 'status-pending';
      statusText = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } else {
      statusText = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Use the same formatLabOrderSerial function as lab-scientist-dashboard for consistency
    let displaySerialNumber = order.serialNumber || order.serial_number || 'N/A';
    if (displaySerialNumber && displaySerialNumber !== 'N/A') {
      // Use the global formatLabOrderSerial function if available (from lab-scientist-dashboard.js)
      if (typeof window.formatLabOrderSerial === 'function') {
        displaySerialNumber = window.formatLabOrderSerial(displaySerialNumber, order.id, order);
      } else {
        // Fallback: try to extract simple format
      const simpleMatch = displaySerialNumber.match(/^(LAB|IMG)-(\d{1,})/i);
      if (simpleMatch) {
        const prefix = simpleMatch[1].toUpperCase();
        const number = parseInt(simpleMatch[2]);
        displaySerialNumber = `${prefix}-${number.toString().padStart(3, '0')}`;
        } else if (displaySerialNumber.length > 20) {
          displaySerialNumber = displaySerialNumber.substring(0, 20) + '...';
        }
      }
    }
    
    // Check if results are attached (from localStorage, Supabase, or external lab uploads)
    const attsArray = order.results && (Array.isArray(order.results) ? order.results : (order.results._attachments || []));
    const hasResults = attsArray && attsArray.length > 0;
    // Only show View Results for lab orders when we have at least one completed test or result value (not just in-process with no values)
    const labResultsRaw = order.type === 'lab' && labResultsMap[order.id];
    var labResultsCount = 0;
    function countDisplayableLabResults(res) {
      if (!res || typeof res !== 'object') return 0;
      var meta = ['status','entered_at','entered_by','auditTrail','completed_at','completed_by','_attachments'];
      var n = 0;
      for (var k in res) {
        if (!k || k.charAt(0) === '_' || meta.indexOf(k) >= 0) continue;
        var r = res[k];
        if (!r || typeof r !== 'object') continue;
        if (r.status === 'completed' || (r.value !== undefined && r.value !== null && r.value !== '')) n++;
        else if (r.results && typeof r.results === 'object') n += countDisplayableLabResults(r.results);
        else n += countDisplayableLabResults(r);
      }
      return n;
    }
    labResultsCount = labResultsRaw ? countDisplayableLabResults(labResultsRaw) : 0;
    const hasLabResults = labResultsCount > 0;
    const resultsCount = hasResults ? attsArray.length : 0;
    
    const canDeleteOrders = userCanDeleteOrders();
    
    // "Remove test" UI for lab orders with Supabase id and 2+ tests (syncs across dashboard and notes)
    const canRemoveTest = order.type === 'lab' && order.id && order.selectedItems && order.selectedItems.length > 1;
    let removeTestHtml = '';
    if (canRemoveTest) {
      const optionTags = order.selectedItems.map(item => {
        const name = typeof item === 'object' && item != null ? (item.name || item.testName || '') : String(item);
        const escaped = name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
        return `<option value="${escaped}">${escaped}</option>`;
      }).join('');
      const safeOrderId = String(order.id != null ? order.id : '').replace(/'/g, "\\'");
      removeTestHtml = `
        <select class="remove-test-select" data-order-id="${safeOrderId}" title="Choose a test to remove" style="max-width: 140px; font-size: 12px; padding: 4px 6px;">
          <option value="">Remove a test...</option>${optionTags}
        </select>
        <button type="button" class="action-btn danger-btn" onclick="window.removeTestFromOrderInList(this)" title="Remove selected test from order" style="font-size: 12px; padding: 4px 8px;">Remove</button>
      `;
    }
    
      const viewResultsBtn = (hasResults || hasLabResults) ?
        `<button type="button" class="action-btn success-btn" onclick="viewOrderResults('${patient.id}', '${order.visitDate}', '${order.timestamp}', ${(order.id && (hasResults || hasLabResults)) ? `'${order.id}'` : 'null'})" title="View ${hasLabResults ? labResultsCount : resultsCount} result(s)" style="background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%); color: white; border: 2px solid #1e7e34; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; white-space: nowrap;">
          &#128203; View Results
        </button>` : '';
      
      row.innerHTML = `
        <td>${date}</td>
        <td>${orderType}</td>
        <td>${items}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td style="font-family: 'Courier New', monospace; font-weight: 600; color: var(--primary-green);">${displaySerialNumber}</td>
      <td>
        <div class="order-actions-container" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          <button type="button" class="action-btn primary-btn" onclick="viewOrderDetails('${getPatientIdentifier(patient)}', '${order.visitDate || ''}', '${order.timestamp || ''}')" title="View order details" style="background: linear-gradient(135deg, #008753 0%, #006b42 100%); color: white; border: 2px solid #006b42; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; white-space: nowrap; min-width: 70px;">
            &#128065; View
          </button>
          ${viewResultsBtn}
          ${removeTestHtml}
          ${canDeleteOrders ? 
            `<button type="button" class="action-btn danger-btn btn-danger" onclick="deleteOrder('${patient.id}', '${order.visitDate}', '${order.timestamp}', '${order.id || ''}', '${order.serialNumber || order.serial_number || ''}')" title="Delete this order" style="background: linear-gradient(135deg, #DC143C 0%, #8B0000 100%); color: white; border: 2px solid #8B0000; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; white-space: nowrap; min-width: 70px;">
              &#128465; Delete
            </button>` : ''
          }
        </div>
      </td>
      <td>
        <div class="order-results-container">
          ${hasResults || hasLabResults ? 
            `<span class="status-badge status-success" style="font-size: 12px;">&#128203; ${hasLabResults ? labResultsCount : resultsCount} result(s)</span>` :
            `<button type="button" class="action-btn secondary-btn" onclick="attachOrderResults('${patient.id}', '${order.visitDate}', '${order.timestamp}')" title="Attach results to this order">
              &#128206; Attach
            </button>`
          }
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  } finally {
    // Always clear the guard, even if there's an error
    window._displayingOrders = false;
  }
}

// Remove a single test from a lab order (updates selected_items in Supabase; syncs across dashboard, notes, view order)
// Used by lab scientist dashboard, clinical note, and lab intervention note.
window.removeTestFromLabOrder = window.removeTestFromLabOrder || async function(orderId, testName) {
  if (!orderId || !testName) return;
  if (!confirm(`Remove "${testName}" from this order? This will update the order everywhere.`)) return;
  try {
    const supabase = typeof window.getLabSupabaseClient === 'function'
      ? await window.getLabSupabaseClient()
      : window.supabaseClient;
    if (!supabase) {
      alert('Database connection not available.');
      return;
    }
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, selected_items')
      .eq('id', orderId)
      .eq('type', 'lab')
      .single();
    if (fetchErr || !order) {
      alert('Order not found.');
      return;
    }
    let items = order.selected_items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    if (!Array.isArray(items)) items = [];
    const testNameStr = String(testName).trim();
    const before = items.length;
    const updated = items.filter(item => {
      const name = (item && (item.name || item)) ? String(item.name || item).trim() : '';
      return name !== testNameStr && name.toLowerCase() !== testNameStr.toLowerCase();
    });
    if (updated.length === before) {
      alert('Test not found in this order.');
      return;
    }
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        selected_items: updated,
        no_items_checked: updated.length === 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
    if (updateErr) {
      alert('Failed to update order: ' + (updateErr.message || 'Unknown error'));
      return;
    }
    if (typeof loadDashboard === 'function') {
      await loadDashboard();
    } else if (typeof loadIncomingOrders === 'function') {
      await loadIncomingOrders();
    } else if (document.getElementById('generated-orders-list')) {
      const urlParams = new URLSearchParams(window.location.search);
      const patientId = urlParams.get('patientId') || urlParams.get('id');
      if (patientId) {
        let patients = [];
        if (typeof window.loadPatientsWithSupabasePriority === 'function') {
          patients = await window.loadPatientsWithSupabasePriority();
        } else {
          patients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
        }
        const patient = patients.find(p => p.id === patientId);
        if (patient && typeof displayGeneratedOrders === 'function') {
          await displayGeneratedOrders(patient);
        }
      }
    }
    if (typeof window.showSuccessNotification === 'function') {
      window.showSuccessNotification('Test removed from order');
    } else {
      alert('Test removed from order.');
    }
  } catch (e) {
    console.error('removeTestFromLabOrder:', e);
    alert('Error: ' + (e.message || 'Unknown error'));
  }
};

// Called from "Remove test" dropdown in generated-orders list (clinical note, lab intervention note, patient details)
window.removeTestFromOrderInList = function(buttonEl) {
  const row = buttonEl && buttonEl.closest ? buttonEl.closest('tr') : null;
  if (!row) return;
  const sel = row.querySelector('.remove-test-select');
  if (!sel || !sel.value) {
    alert('Select a test to remove first.');
    return;
  }
  const orderId = sel.getAttribute('data-order-id');
  if (!orderId) return;
  window.removeTestFromLabOrder(orderId, sel.value);
};

// Helper: same role check used for showing and executing order delete
function userCanDeleteOrders() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const roleLower = (currentUser.role && String(currentUser.role).toLowerCase().trim()) || '';
  return !!currentUser.role && (
    roleLower === 'doctor' || roleLower === 'nurse' || roleLower === 'physician assistant' ||
    roleLower === 'medical lab scientist' || roleLower === 'medical laboratory scientist' ||
    roleLower === 'platform admin' || roleLower === 'admin' || roleLower === 'administrator' ||
    roleLower === 'medical director' || roleLower === 'receptionist' || roleLower === 'physician' ||
    roleLower === 'clinician' || roleLower === 'lab scientist' || roleLower === 'lab tech' ||
    roleLower === 'laboratory technician' || roleLower === 'laboratory scientist' ||
    roleLower.includes('admin') || roleLower.includes('doctor') || roleLower.includes('nurse') ||
    roleLower.includes('lab scientist') || roleLower.includes('medical lab') || roleLower.includes('laboratory scientist')
  );
}

// Delete order function
async function deleteOrder(patientId, visitDate, timestamp, orderId = null, orderSerialNumber = null) {
  if (!userCanDeleteOrders()) {
    if (typeof window.showErrorNotification === 'function') {
      window.showErrorNotification("You do not have permission to delete orders.");
    } else {
      alert("You do not have permission to delete orders.");
    }
    return;
  }
  
  if (!confirm("Are you sure you want to delete this order? This will remove it from:\n- Clinical note\n- Patient record\n- Lab scientist dashboard\n\nThis action cannot be undone.")) {
    return;
  }
  
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  
  // Load patient: try hybrid (Supabase-first) so we get orders that may only exist in Supabase
  let patients = [];
  if (typeof window.loadPatientsWithSupabasePriority === 'function') {
    try {
      patients = await window.loadPatientsWithSupabasePriority();
    } catch (e) {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } else {
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  const patient = patients.find(p => p.id === patientId || p.patient_id === patientId);
  
  if (!patient) {
    if (typeof window.showErrorNotification === 'function') {
      window.showErrorNotification("Patient not found");
    } else {
      alert("Patient not found");
    }
    return;
  }
  
  if (!patient.visits) patient.visits = [];
  const visit = patient.visits.find(v => v.date === visitDate);
  let order, orderIndex = -1, orderType = 'Lab Order', finalOrderId = orderId, finalOrderSerialNumber = orderSerialNumber;
  
  if (visit && visit.orders && visit.orders.length > 0) {
    orderIndex = visit.orders.findIndex(o =>
      o.timestamp === timestamp || (orderId && (o.id === orderId || String(o.id) === String(orderId))) || (orderSerialNumber && (o.serialNumber === orderSerialNumber || o.serial_number === orderSerialNumber))
    );
    if (orderIndex >= 0) {
      order = visit.orders[orderIndex];
      orderType = order.type === 'lab' ? 'Lab Order' : 'Imaging Order';
      finalOrderId = orderId || order.id;
      finalOrderSerialNumber = orderSerialNumber || order.serialNumber || order.serial_number;
    }
  }
  
  // If we didn't find order in visit but we have orderId/serial from the UI, we can still delete from Supabase (order may exist only there)
  if (!order && (finalOrderId || finalOrderSerialNumber)) {
    order = { id: finalOrderId, serialNumber: finalOrderSerialNumber, serial_number: finalOrderSerialNumber, type: 'lab' };
  }
  
  if (!order || (!finalOrderId && !finalOrderSerialNumber)) {
    if (typeof window.showErrorNotification === 'function') {
      window.showErrorNotification("Visit or orders not found. The order may have been deleted already.");
    } else {
      alert("Visit or orders not found. The order may have been deleted already.");
    }
    return;
  }
  
  // HYBRID ARCHITECTURE: SUPABASE-FIRST deletion
  // Delete from Supabase FIRST to ensure it disappears from lab scientist dashboard
  let supabaseDeleted = false;
  try {
    const supabase = window.supabaseClient || supabaseClient;
    if (supabase && (finalOrderId || finalOrderSerialNumber)) {
      // Get organization ID using the utility function if available
      let orgId = null;
      if (typeof window.resolveOrganizationId === 'function') {
        orgId = await window.resolveOrganizationId();
      } else {
        orgId = currentUser.organizationId || currentUser.organization_id;
        if (!orgId && currentUser.org) {
          if (currentUser.org.includes('-') && currentUser.org.length === 36) {
            orgId = currentUser.org;
          } else {
            const { data: userData } = await supabase
              .from('users')
              .select('organization_id')
              .eq('username', currentUser.username)
              .maybeSingle();
            if (userData?.organization_id) {
              orgId = userData.organization_id;
            }
          }
        }
      }
      
      if (orgId) {
        // Soft delete: set deleted_at timestamp and deleted_by
        const deleteData = {
          deleted_at: new Date().toISOString(),
          deleted_by: currentUser.username || currentUser.id || currentUser.auth_user_id
        };
        
        // Try to delete by ID first (most reliable)
        if (finalOrderId) {
          const { error } = await supabase
            .from('orders')
            .update(deleteData)
            .eq('id', finalOrderId)
            .eq('organization_id', orgId);
          
          if (error) {
            console.error('❌ Error deleting order from Supabase by ID:', error);
            // Try serial number as fallback
            if (finalOrderSerialNumber) {
              const { error: serialError } = await supabase
                .from('orders')
                .update(deleteData)
                .eq('serial_number', finalOrderSerialNumber)
                .eq('organization_id', orgId);
              
              if (serialError) {
                console.error('❌ Error deleting order from Supabase by serial number:', serialError);
              } else {
                console.log('✅ Order soft-deleted from Supabase by serial number:', finalOrderSerialNumber);
                supabaseDeleted = true;
              }
            }
          } else {
            console.log('✅ Order soft-deleted from Supabase by ID:', finalOrderId);
            supabaseDeleted = true;
          }
        } else if (finalOrderSerialNumber) {
          // Delete by serial number if no ID
          const { error } = await supabase
            .from('orders')
            .update(deleteData)
            .eq('serial_number', finalOrderSerialNumber)
            .eq('organization_id', orgId);
          
          if (error) {
            console.error('❌ Error deleting order from Supabase by serial number:', error);
          } else {
            console.log('✅ Order soft-deleted from Supabase by serial number:', finalOrderSerialNumber);
            supabaseDeleted = true;
          }
        }
      } else {
        console.warn('⚠️ Cannot delete from Supabase: Organization ID not found');
      }
    }
  } catch (error) {
    console.error('❌ Error during Supabase order deletion:', error);
    // Continue with localStorage deletion even if Supabase fails
  }
  
  // Update localStorage: remove or mark order in visit.orders
  if (visit) {
    if (!visit.orders) visit.orders = [];
    if (orderIndex >= 0) {
      order.deleted_at = new Date().toISOString();
      order.deleted_by = currentUser.username || currentUser.id;
      order.deleted = true;
      visit.orders.splice(orderIndex, 1);
    } else {
      // Order was only in Supabase; remove any matching order from this visit by id or serial
      const idx = visit.orders.findIndex(o =>
        (finalOrderId && (o.id === finalOrderId || String(o.id) === String(finalOrderId))) ||
        (finalOrderSerialNumber && (o.serialNumber === finalOrderSerialNumber || o.serial_number === finalOrderSerialNumber))
      );
      if (idx >= 0) visit.orders.splice(idx, 1);
    }
  }
  
  // Save back to localStorage (use same patients array we loaded so we don't overwrite with stale data)
  const patientsToSave = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patientIndex = patientsToSave.findIndex(p => p.id === patient.id || p.patient_id === patient.id);
  if (patientIndex >= 0) {
    patientsToSave[patientIndex] = patient;
  }
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patientsToSave));
  
  // Show success notification
  if (typeof window.showSuccessNotification === 'function') {
    window.showSuccessNotification(`Order deleted successfully. ${supabaseDeleted ? 'Removed from all locations including lab scientist dashboard.' : 'Removed from local records. Will sync to server when online.'}`);
  } else {
    alert(`Order deleted successfully. ${supabaseDeleted ? 'Removed from all locations including lab scientist dashboard.' : 'Removed from local records. Will sync to server when online.'}`);
  }
  
  // Refresh the display
  if (typeof displayGeneratedOrders === 'function') {
    await displayGeneratedOrders(patient);
  }
  
  // Trigger custom event for real-time sync
  window.dispatchEvent(new CustomEvent('patientDataUpdated', {
    detail: { patientId, action: 'orderDeleted', data: { visitDate, timestamp, orderType, orderId: finalOrderId, serialNumber: finalOrderSerialNumber } }
  }));
  
  // Audit log: Order deleted
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('order_deleted', {
      patientId: patient.id,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown',
      visitDate: visitDate,
      orderType: orderType,
      timestamp: timestamp,
      orderId: finalOrderId,
      serialNumber: finalOrderSerialNumber,
      deletedBy: currentUser.username || currentUser.id,
      deletedFrom: 'clinical_note'
    });
  }
  
  if (typeof window.showSuccessNotification === 'function') {
    window.showSuccessNotification(`${orderType} deleted successfully.`);
  } else {
    alert(`${orderType} deleted successfully.`);
  }
}

// View order details - Recreate full order report
async function viewOrderDetails(patientIdentifier, visitDate, timestamp) {
  try {
  // Resolve patient identifier (UUID or patient ID) to patient object
  let patient = await resolvePatientByIdentifier(patientIdentifier);
  
  if (!patient) {
    // Fallback: try direct lookup
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    patient = patients.find(p => p.id === patientIdentifier || p.patient_id === patientIdentifier || p.patientNumber === patientIdentifier);
  }
  
  if (!patient) {
    alert("Patient not found");
    return;
  }
  
  let order = null;
  let effectiveVisitDate = visitDate;
  
  // SUPABASE-FIRST: Query Supabase orders table first (orders may exist without visit in patient.visits)
  if (window.supabaseClient) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const orgId = user.organizationId || user.organization_id;
      
      if (orgId) {
          const isLegacyId = patient.id && !patient.id.includes('-') && patient.id.length < 36;
          const queryPatientId = isLegacyId ? (patient._supabaseUuid || patient.id) : patient.id;
          const toYmd = function(d) {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return String(d);
            return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
          };
          const visitDateNorm = toYmd(visitDate) || visitDate;
          const datesToTry = [visitDate, visitDateNorm].filter((v, i, a) => v && a.indexOf(v) === i);
          
          for (let di = 0; di < datesToTry.length && !order; di++) {
            const qDate = datesToTry[di];
            const { data: supabaseOrders, error } = await window.supabaseClient
              .from('orders')
              .select('*')
              .eq('patient_id', queryPatientId)
              .eq('visit_date', qDate)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });
        
        if (!error && supabaseOrders && supabaseOrders.length > 0) {
            const timestampTime = new Date(timestamp).getTime();
            let foundOrder = supabaseOrders.find(o => {
              const orderTimestamp = o.timestamp || o.created_at;
              if (!orderTimestamp) return false;
              return Math.abs(new Date(orderTimestamp).getTime() - timestampTime) < 30000;
            });
            if (!foundOrder && supabaseOrders.length > 0) foundOrder = supabaseOrders[0];
            if (foundOrder) {
              order = {
                type: foundOrder.type,
                serialNumber: foundOrder.serial_number,
                selectedItems: foundOrder.selected_items || [],
                noItemsChecked: foundOrder.no_items_checked || false,
                timestamp: foundOrder.timestamp || foundOrder.created_at,
                status: foundOrder.status || 'Generated',
                htmlContent: foundOrder.html_content || ''
              };
              effectiveVisitDate = foundOrder.visit_date || visitDate;
            }
          }
        }
        }
    } catch (error) {
        console.error('Error querying Supabase for order:', error);
    }
  }
  
  // Fallback: find order in visit.orders (for legacy/localStorage orders)
  if (!order && patient.visits && Array.isArray(patient.visits)) {
    const toYmd = function(d) {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    };
    const visitDateYmd = toYmd(visitDate) || visitDate;
    const visit = patient.visits.find(v => v.date === visitDate || toYmd(v.date) === visitDateYmd || v.date === visitDateYmd);
    if (visit && visit.orders && visit.orders.length > 0) {
      const timestampTime = new Date(timestamp).getTime();
      order = visit.orders.find(o => {
        const ot = o.timestamp || o.created_at;
        if (!ot) return false;
        return Math.abs(new Date(ot).getTime() - timestampTime) < 30000;
      });
      if (order) order = { type: order.type, serialNumber: order.serial_number, selectedItems: order.selectedItems || order.selected_items || [], noItemsChecked: order.noItemsChecked || order.no_items_checked || false, timestamp: order.timestamp || order.created_at, status: order.status || 'Generated', htmlContent: order.html_content || order.htmlContent || '' };
    }
  }
  
  if (!order) {
      alert("Order not found. The order may have been deleted or the timestamp does not match.");
      console.error('Order not found:', { patientIdentifier, visitDate, timestamp });
    return;
  }
  
    // Navigate to view-order.html page instead of showing modal
    const displayPatientId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id || patientIdentifier);
    if (!displayPatientId) {
      alert("Could not determine patient identifier for order view");
      console.error('Patient identifier not found:', { patient, patientIdentifier });
      return;
    }
    
    // Ensure timestamp is properly formatted
    const orderTimestamp = timestamp || order.timestamp || new Date().toISOString();
    
    const orderUrl = `view-order.html?patientId=${encodeURIComponent(displayPatientId)}&visitDate=${encodeURIComponent(effectiveVisitDate)}&timestamp=${encodeURIComponent(orderTimestamp)}`;
    console.log('🔍 [viewOrderDetails] Navigating to:', orderUrl);
    window.location.href = orderUrl;
  } catch (error) {
    console.error('Error in viewOrderDetails:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      patientIdentifier,
      visitDate,
      timestamp
    });
    alert(`An error occurred while loading order details: ${error.message || 'Unknown error'}. Please try again.`);
  }
}

// Create modal to display recreated order
async function createOrderModal(order, patient, user, visitDate) {
  // Remove existing modal if any
  const existingModal = document.getElementById("order-modal");
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal container
  const modal = document.createElement("div");
  modal.id = "order-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 90%;
    max-height: 90%;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  const supabase = window.supabaseClient;
  let orderedByLine = '';
  let orgLine = '';
  if (typeof window.mfResolveOrderedByLineForOrder === 'function') {
    orderedByLine = await window.mfResolveOrderedByLineForOrder(supabase, order, user);
  }
  if (typeof window.mfResolveOrganizationDisplayLineForOrder === 'function') {
    orgLine = await window.mfResolveOrganizationDisplayLineForOrder(supabase, order, user);
  }

  // Generate order content based on type
  let orderHTML = '';
  
  if (order.type === 'lab') {
    orderHTML = generateLabOrderHTML(order, patient, user, visitDate, orderedByLine, orgLine);
  } else if (order.type === 'imaging') {
    orderHTML = generateImagingOrderHTML(order, patient, user, visitDate, orderedByLine, orgLine);
  }
  
  modalContent.innerHTML = `
    <style>
      .order-modal-table th.order-th-left {
        text-align: left !important;
      }
      .order-modal-table th.order-th-center {
        text-align: center !important;
      }
      .order-modal-table td.order-td-left {
        text-align: left !important;
      }
      .order-modal-table td.order-td-center {
        text-align: center !important;
      }
    </style>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: #333;">${order.type === 'lab' ? 'Lab Order' : 'Imaging Order'} - ${new Date(order.timestamp).toLocaleDateString()}</h2>
      <div>
        <button onclick="downloadOrderAsImage('${order.type}')" style="margin-right: 10px; padding: 8px 16px; background-color: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer;">📱 Download as Image</button>
        <button onclick="printOrderModal()" style="margin-right: 10px; padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
        <button onclick="closeOrderModal()" style="padding: 8px 16px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
      </div>
    </div>
    <div id="order-content-for-image">
      ${orderHTML}
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeOrderModal();
    }
  });
}

// Attach results to an order
function attachOrderResults(patientId, visitDate, timestamp) {
  // attachOrderResults called
  // attachOrderResults called
  
  // Prevent any form submission that might be triggered
  if (event) {
  event.preventDefault();
  event.stopPropagation();
  }
  
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.txt,.xls,.xlsx';
  
  input.onchange = function(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Read files and store them
    let filesProcessed = 0;
    const results = [];
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const result = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result,
          uploadedAt: new Date().toISOString()
        };
        results.push(result);
        
        filesProcessed++;
        if (filesProcessed === files.length) {
          saveOrderResults(patientId, visitDate, timestamp, results);
        }
      };
      reader.readAsDataURL(file);
    });
  };
  
  input.click();
}

// Save results to order
async function saveOrderResults(patientId, visitDate, timestamp, newResults) {
  // saveOrderResults called
  
  // Supabase-first: Load patients from Supabase, fallback to localStorage
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  const patient = patients.find(p => p.id === patientId);
  if (!patient) {
    console.error("Patient not found! Patient ID:", patientId);
    alert("Patient not found");
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit || !visit.orders) {
    alert("Visit or orders not found");
    return;
  }
  
  const order = visit.orders.find(o => o.timestamp === timestamp);
  if (!order) {
    alert("Order not found");
    return;
  }
  
  // Initialize results array if it doesn't exist
  if (!order.results) {
    order.results = [];
  }
  
  // Add new results
  order.results.push(...newResults);
  
  // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
  savePatientToSupabase(patient).then(() => {
    // Save to localStorage as cache/fallback
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('✅ Order results saved to Supabase and localStorage');
    
    // Refresh the display
    if (typeof displayGeneratedOrders === 'function') {
      displayGeneratedOrders(patient);
    }
    
    // Trigger custom event for real-time sync
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'orderResultsAttached', data: { visitDate, timestamp, resultsCount: newResults.length } }
    }));
    
    alert(`Successfully attached ${newResults.length} result(s) to the order`);
  }).catch(error => {
    console.error('Failed to save order results to Supabase, saving to localStorage only:', error);
    // Fallback to localStorage only if Supabase fails
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('Order results saved to localStorage (Supabase unavailable)');
    
    // Refresh the display
    if (typeof displayGeneratedOrders === 'function') {
      displayGeneratedOrders(patient);
    }
    
    // Trigger custom event for real-time sync
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'orderResultsAttached', data: { visitDate, timestamp, resultsCount: newResults.length } }
    }));
    
    alert(`Successfully attached ${newResults.length} result(s) to the order (saved locally)`);
  });
}

// View attached results - navigates to view-order-results.html when orderId provided (no modal)
async function viewOrderResults(patientId, visitDate, timestamp, orderId) {
  let patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  if (typeof window.loadPatientsWithSupabasePriority === 'function') {
    try { patients = await window.loadPatientsWithSupabasePriority(); } catch (e) { /* fallback */ }
  }
  const patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);
  if (!patient) {
    alert("Patient not found");
    return;
  }
  
  // Navigate to dedicated results page when orderId available (same pattern as doctor-lab-result-details)
  if (orderId) {
    const returnUrl = window.location.pathname + (window.location.search || '');
    const pid = typeof window.getPatientIdentifier === 'function' ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id);
    window.location.href = 'view-order-results.html?orderId=' + encodeURIComponent(orderId) +
      '&returnUrl=' + encodeURIComponent(returnUrl) +
      (pid ? '&patientId=' + encodeURIComponent(pid) : '');
    return;
  }
  
  // Fallback for legacy orders (no Supabase id): show modal from visits
  let order = null;
  let resultsArray = null;
  
  // First try visits (localStorage / merged data)
  var toYmd = function(d) {
    if (!d) return '';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  };
  if (patient.visits) {
    var vdNorm = toYmd(visitDate) || visitDate;
    var visit = patient.visits.find(function(v) { return v.date === visitDate || toYmd(v.date) === vdNorm || v.date === vdNorm; });
    if (visit && visit.orders) {
      var tsTime = timestamp ? new Date(timestamp).getTime() : 0;
      order = visit.orders.find(function(o) {
        if (orderId && o.id === orderId) return true;
        var ot = o.timestamp || o.created_at;
        return ot && tsTime && Math.abs(new Date(ot).getTime() - tsTime) < 30000;
      });
      if (order) {
        resultsArray = Array.isArray(order.results) ? order.results : (order.results && order.results._attachments) || [];
      }
    }
  }
  
  // If no results in visits and orderId provided, fetch from Supabase (lab results, external lab uploads)
  if ((!resultsArray || resultsArray.length === 0) && orderId) {
    const supabase = typeof window.getLabSupabaseClient === 'function' ? await window.getLabSupabaseClient() : window.supabaseClient;
    if (supabase) {
      try {
        const { data: supabaseOrder, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();
        if (!error && supabaseOrder) {
          var res = supabaseOrder.results;
          if (typeof res === 'string') { try { res = JSON.parse(res); } catch (e) { res = null; } }
          resultsArray = Array.isArray(res) ? res : (res && res._attachments) || [];
          if (resultsArray.length === 0 && res && typeof res === 'object' && res !== null) {
            var rows = [];
            var meta = ['status','entered_at','entered_by','auditTrail','completed_at','completed_by','_attachments'];
            function collectRows(obj, parentName) {
              if (!obj || typeof obj !== 'object') return;
              for (var k in obj) {
                if (!k || k.charAt(0) === '_' || meta.indexOf(k) >= 0) continue;
                var r = obj[k];
                if (!r) continue;
                if (typeof r === 'object' && r !== null) {
                  if (r.value !== undefined && r.value !== null && r.value !== '') {
                    rows.push({ name: k, value: r.value, unit: r.unit || '', ref: r.referenceRange || r.reference || r.normalRange || '' });
                  } else if (r.results && typeof r.results === 'object') {
                    collectRows(r.results, k);
                  } else {
                    collectRows(r, k);
                  }
                }
              }
            }
            for (var k in res) {
              if (!k || k.charAt(0) === '_' || meta.indexOf(k) >= 0) continue;
              var r = res[k];
              if (r && typeof r === 'object') {
                if (r.value !== undefined && r.value !== null && r.value !== '') {
                  rows.push({ name: k, value: r.value, unit: r.unit || '', ref: r.referenceRange || r.reference || r.normalRange || '' });
                } else {
                  collectRows(r, k);
                }
              }
            }
            if (rows.length > 0) {
              var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Lab Results</title><style>body{font-family:sans-serif;padding:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;}th{background:#008753;color:white;}</style></head><body><h2>Lab Results</h2><table><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference</th></tr>';
              rows.forEach(function(row) {
                html += '<tr><td>' + (row.name || '').replace(/</g,'&lt;') + '</td><td>' + (row.value != null ? String(row.value) : '-').replace(/</g,'&lt;') + '</td><td>' + (row.unit || '').replace(/</g,'&lt;') + '</td><td>' + (row.ref || '').replace(/</g,'&lt;') + '</td></tr>';
              });
              html += '</table></body></html>';
              resultsArray = [{ name: 'Lab Results', type: 'text/html', data: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(html))), attachment: null }];
            }
          }
          if (resultsArray.length > 0) {
            order = {
              id: supabaseOrder.id,
              type: supabaseOrder.type,
              timestamp: supabaseOrder.timestamp || supabaseOrder.created_at,
              visitDate: supabaseOrder.visit_date,
              patientId: patient.id,
              results: resultsArray
            };
          }
        }
      } catch (e) {
        console.warn('Could not fetch order from Supabase:', e);
      }
    }
  }
  
  if (!order || !resultsArray || resultsArray.length === 0) {
    alert("No results found for this order");
    return;
  }
  
  order.results = resultsArray;
  createResultsModal(order, patient, visitDate);
}

// Create modal to display results
function createResultsModal(order, patient, visitDate) {
  const existingModal = document.getElementById("results-modal");
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement("div");
  modal.id = "results-modal";
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0,0,0,0.5); z-index: 10000; display: flex;
    justify-content: center; align-items: center;
  `;
  
  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    background: white; padding: 20px; border-radius: 8px; max-width: 90%;
    max-height: 90%; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  const orderType = order.type === 'lab' ? 'Lab Order' : 'Imaging Order';
  const date = new Date(order.timestamp).toLocaleDateString();
  
  // Store results for view/download (avoids long base64 in HTML for external lab uploads)
  window._viewOrderResultsCache = order.results.map(r => {
    const d = r.data || r.attachment;
    const dataUrl = d && typeof d === 'string' && !d.startsWith('data:') ? `data:${r.type || 'application/pdf'};base64,${d}` : d;
    return { name: r.name || 'Result', data: dataUrl, type: r.type || 'application/pdf', id: r.id || '' };
  });
  
  let resultsHTML = '';
  order.results.forEach((result, idx) => {
    const fileSize = ((result.size || 0) / 1024).toFixed(1) + ' KB';
    const uploadedDate = result.uploadedAt ? new Date(result.uploadedAt).toLocaleString() : 'N/A';
    const hasDelete = result.id && order.patientId;
    
    resultsHTML += `
      <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="margin: 0; color: #333;">${(result.name || 'Result').replace(/</g, '&lt;')}</h4>
          ${hasDelete ? `<button onclick="deleteOrderResult('${order.patientId}', '${order.visitDate}', '${order.timestamp}', '${result.id}')" 
                  style="background-color: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Delete</button>` : ''}
        </div>
        <p style="margin: 5px 0; color: #666; font-size: 12px;">
          Type: ${(result.type || 'application/pdf')} | Size: ${fileSize} | Uploaded: ${uploadedDate}
        </p>
        <div style="margin-top: 10px;">
          <button type="button" data-result-idx="${idx}" class="btn-download-result" 
                  style="background-color: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
            Download
          </button>
          <button type="button" data-result-idx="${idx}" class="btn-view-result" 
                  style="background-color: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
            View
          </button>
        </div>
      </div>
    `;
  });
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: #333;">${orderType} Results - ${patient.firstName} ${patient.lastName}</h2>
      <button onclick="closeResultsModal()" style="padding: 8px 16px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
    </div>
    <p style="color: #666; margin-bottom: 20px;">Order Date: ${date}</p>
    <div id="results-list">
      ${resultsHTML}
    </div>
    <div style="margin-top: 20px; text-align: center;">
      <button onclick="attachOrderResults('${order.patientId || patient.id}', '${order.visitDate}', '${order.timestamp}')" 
              style="background-color: #17a2b8; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
        Attach More Results
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Wire up Download/View for external results (use cache to avoid long base64 in HTML)
  modalContent.querySelectorAll('.btn-download-result').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.getAttribute('data-result-idx'), 10);
      const c = window._viewOrderResultsCache;
      if (c && c[idx]) {
        downloadOrderResult(String(idx), c[idx].name, c[idx].data);
      }
    });
  });
  modalContent.querySelectorAll('.btn-view-result').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.getAttribute('data-result-idx'), 10);
      const c = window._viewOrderResultsCache;
      if (c && c[idx]) {
        viewOrderResult(String(idx), c[idx].name, c[idx].data, c[idx].type || 'application/pdf');
      }
    });
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeResultsModal();
    }
  });
}

// Close results modal
function closeResultsModal() {
  const modal = document.getElementById("results-modal");
  if (modal) {
    modal.remove();
  }
}

// Download a result file
function downloadOrderResult(resultId, fileName, fileData) {
  const link = document.createElement('a');
  link.href = fileData;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
// View a result file (for images and PDFs)
function viewOrderResult(resultId, fileName, fileData, fileType) {
  const existingViewer = document.getElementById("file-viewer-modal");
  if (existingViewer) {
    existingViewer.remove();
  }
  
  const modal = document.createElement("div");
  modal.id = "file-viewer-modal";
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background-color: rgba(0,0,0,0.95); z-index: 10001; display: flex;
    flex-direction: column;
  `;
  
  // Create header with controls
  const header = document.createElement("div");
  header.style.cssText = `
    background: #2c3e50; color: white; padding: 15px 20px; 
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  
  // Create main content area
  const contentArea = document.createElement("div");
  contentArea.style.cssText = `
    flex: 1; display: flex; justify-content: center; align-items: center;
    padding: 0; overflow: hidden; background: #f8f9fa;
  `;
  
  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    background: white; border-radius: 8px; width: 100%; height: 100%;
    overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    display: flex; flex-direction: column;
  `;
  
  let viewerHTML = '';
  if (fileType.startsWith('image/')) {
    viewerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; padding: 20px; min-height: 70vh;">
        <img src="${fileData}" style="max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 4px;" alt="${fileName}">
      </div>
    `;
  } else if (fileType === 'application/pdf') {
    // Add PDF viewer parameters for better zoom and readability
    const pdfUrl = `${fileData}#zoom=150&toolbar=1&navpanes=1&scrollbar=1`;
    viewerHTML = `
      <div style="flex: 1; width: 100%; overflow: hidden;">
        <iframe src="${pdfUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
      </div>
    `;
  } else {
    viewerHTML = `
      <div style="text-align: center; padding: 80px 40px; min-height: 60vh; display: flex; flex-direction: column; justify-content: center;">
        <div style="font-size: 48px; color: #6c757d; margin-bottom: 20px;">📄</div>
        <h3 style="color: #495057; margin-bottom: 15px;">Preview not available for this file type</h3>
        <p style="color: #6c757d; margin-bottom: 30px; font-size: 16px;">File: <strong>${fileName}</strong></p>
        <button onclick="downloadOrderResult('${resultId}', '${fileName}', '${fileData}')" 
                style="background-color: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; transition: background-color 0.2s;">
          📥 Download File
        </button>
      </div>
    `;
  }
  
  header.innerHTML = `
    <div>
      <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${fileName}</h3>
      <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">File Type: ${fileType}</p>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="downloadOrderResult('${resultId}', '${fileName}', '${fileData}')" 
              style="background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
        📥 Download
      </button>
      <button onclick="closeFileViewer()" 
              style="background-color: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
        ✕ Close
      </button>
    </div>
  `;
  
  modalContent.innerHTML = viewerHTML;
  
  // Assemble the modal structure
  modal.appendChild(header);
  contentArea.appendChild(modalContent);
  modal.appendChild(contentArea);
  document.body.appendChild(modal);
  
  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeFileViewer();
    }
  });
  
  // Add keyboard support (ESC to close)
  const handleKeyPress = function(e) {
    if (e.key === 'Escape') {
      closeFileViewer();
      document.removeEventListener('keydown', handleKeyPress);
    }
  };
  document.addEventListener('keydown', handleKeyPress);
}

// Close file viewer modal
function closeFileViewer() {
  const modal = document.getElementById("file-viewer-modal");
  if (modal) {
    modal.remove();
  }
  
  // Remove any keyboard event listeners
  document.removeEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeFileViewer();
    }
  });
}

// Delete a result file
function deleteOrderResult(patientId, visitDate, timestamp, resultId) {
  if (!confirm('Are you sure you want to delete this result?')) {
    return;
  }
  
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (!patient) {
    alert("Patient not found");
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit || !visit.orders) {
    alert("Visit or orders not found");
    return;
  }
  
  const order = visit.orders.find(o => o.timestamp === timestamp);
  if (!order || !order.results) {
    alert("Order or results not found");
    return;
  }
  
  // Remove the result
  order.results = order.results.filter(r => r.id !== resultId);
  
  // Save back to localStorage
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  
  // Refresh the display
  if (typeof displayGeneratedOrders === 'function') {
    displayGeneratedOrders(patient);
  }
  
  // Close and reopen the results modal to refresh
  closeResultsModal();
  viewOrderResults(patientId, visitDate, timestamp);
  
  // Trigger custom event for real-time sync
  window.dispatchEvent(new CustomEvent('patientDataUpdated', {
    detail: { patientId, action: 'orderResultDeleted', data: { visitDate, timestamp, resultId } }
  }));
  
  alert('Result deleted successfully');
}

/** Ordered-by line for session user (viewer). Used only when order has no stored creator. */
window.mfFormatOrderedByFromSessionUser = function mfFormatOrderedByFromSessionUser(sessionUser) {
  if (!sessionUser || (!sessionUser.username && !sessionUser.firstName && !sessionUser.first_name)) {
    return 'Unknown';
  }
  const roleLower = (sessionUser.role && String(sessionUser.role).toLowerCase()) || '';
  let title = '';
  if (roleLower.includes('lab') || roleLower.includes('scientist')) title = 'Medical Lab Scientist';
  else if (roleLower.includes('doctor') || roleLower.includes('physician')) title = 'Dr.';
  else if (roleLower.includes('nurse')) title = 'Nurse';
  else if (roleLower.includes('pharmacist')) title = '';
  else if (roleLower.includes('admin')) title = 'Admin';
  else title = 'Dr.';
  const fn = sessionUser.firstName || sessionUser.first_name || '';
  const ln = sessionUser.lastName || sessionUser.last_name || '';
  const fullName = (`${fn} ${ln}`).trim() || sessionUser.username || 'Unknown';
  const lic = sessionUser.medicalLicenseNumber || sessionUser.license_number || sessionUser.medical_license_number || '';
  const spacer = title && fullName ? ' ' : '';
  return `${title}${spacer}${fullName} (${sessionUser.role || 'N/A'})${lic ? ', Medical License: ' + lic : ''}`;
};

/**
 * Resolve "Ordered By" for a persisted lab/imaging order from order.created_by / order.createdBy.
 * Does not use the viewer unless no creator is stored on the order.
 */
window.mfResolveOrderedByLineForOrder = async function mfResolveOrderedByLineForOrder(supabase, order, sessionUser) {
  const raw =
    order && (order.created_by != null && order.created_by !== '' ? order.created_by : order.createdBy);
  const username = raw != null && String(raw).trim() ? String(raw).trim() : '';
  if (!username) return window.mfFormatOrderedByFromSessionUser(sessionUser);
  if (!supabase || typeof supabase.from !== 'function') return username;
  try {
    let userData = null;
    const { data: usernameMatch } = await supabase
      .from('users')
      .select('first_name, last_name, username, role, license_number, medical_license_number')
      .eq('username', username)
      .maybeSingle();
    if (usernameMatch) userData = usernameMatch;
    else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)) {
      const { data: otherMatch } = await supabase
        .from('users')
        .select('first_name, last_name, username, role, license_number, medical_license_number')
        .or(`id.eq.${username},auth_user_id.eq.${username}`)
        .limit(1)
        .maybeSingle();
      if (otherMatch) userData = otherMatch;
    }
    if (userData) {
      const firstName = userData.first_name || '';
      const lastName = userData.last_name || '';
      const fullName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : firstName || lastName || userData.username || username;
      const role = (userData.role || '').toLowerCase();
      let title = '';
      if (role.includes('lab') || role.includes('scientist')) title = 'Medical Lab Scientist';
      else if (role.includes('doctor') || role.includes('physician')) title = 'Dr.';
      else if (role.includes('nurse')) title = 'Nurse';
      else if (role.includes('pharmacist')) title = '';
      else if (role.includes('admin')) title = 'Admin';
      else title = 'Dr.';
      const lic = userData.license_number || userData.medical_license_number || '';
      const spacer = title && fullName ? ' ' : '';
      return `${title}${spacer}${fullName} (${userData.role || 'N/A'})${lic ? ', Medical License: ' + lic : ''}`;
    }
    if (!username.includes('-')) {
      return `Dr. ${username}`;
    }
  } catch (e) {
    console.warn('[ehrResolveOrderedByLineForOrder]', e);
  }
  return username;
};

/** Organization line for order header from order.organization_id when available. */
window.mfResolveOrganizationDisplayLineForOrder = async function mfResolveOrganizationDisplayLineForOrder(
  supabase,
  order,
  sessionUser
) {
  const oid = order && order.organization_id;
  if (supabase && oid && typeof supabase.from === 'function') {
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('name, address_line1, address_line2, city, state, country')
        .eq('id', oid)
        .maybeSingle();
      if (org) {
        const addr = [org.address_line1, org.address_line2, org.city, org.state, org.country]
          .filter(Boolean)
          .join(', ');
        const name = org.name || 'N/A';
        return addr ? `${name}, Address: ${addr}` : name;
      }
    } catch (e) {
      console.warn('[ehrResolveOrganizationDisplayLineForOrder]', e);
    }
  }
  const u = sessionUser || {};
  const orgName = u.org || u.organization_name || 'N/A';
  const a1 = u.orgAddressLine1 || u.org_address_line1 || '';
  const a2 = u.orgAddressLine2 || u.org_address_line2 || '';
  const c = u.orgCity || u.org_city || '';
  const s = u.orgState || u.org_state || '';
  const co = u.orgCountry || u.org_country || '';
  const addr = `${a1} ${a2 ? a2 + ', ' : ''}${c}, ${s}, ${co}`.trim();
  return addr ? `${orgName}, Address: ${addr}` : orgName;
};

// Generate Lab Order HTML - v195 (Fixed table alignment)
// Expose generateLabOrderHTML globally for use in lab-scientist-dashboard.js and other modules
window.generateLabOrderHTML = function generateLabOrderHTML(
  order,
  patient,
  user,
  visitDate,
  orderedByLineOpt,
  organizationLineOpt
) {
  let tableRows = '';
  
  const sel = window.mfNormalizeOrderSelectedItems(order);
  
  if (order.noItemsChecked) {
    tableRows = '<tr><td colspan="6" style="border: 1px solid #ddd; padding: 12px; text-align: center; font-style: italic; color: #666;">No lab tests required</td></tr>';
  } else if (sel.length > 0) {
    sel.forEach(item => {
      const row =
        typeof window.mfMergeLabOrderItemWithCatalog === 'function'
          ? window.mfMergeLabOrderItemWithCatalog(item)
          : null;
      if (!row || !row.name) {
        const testName =
          typeof item === 'object' && item !== null
            ? item.name || JSON.stringify(item)
            : String(item || '');
        console.warn('⚠️ Invalid or unknown lab test item:', item);
        tableRows += `
          <tr>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">${testName}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
          </tr>
        `;
        return;
      }
      tableRows += `
          <tr>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">${row.name}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.cpt || 'N/A'}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.specimen || 'N/A'}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.container || 'N/A'}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.transport || 'N/A'}</td>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">${row.notes || 'N/A'}</td>
          </tr>
        `;
    });
  } else {
    tableRows = '<tr><td colspan="6" style="border: 1px solid #ddd; padding: 12px; text-align: center; font-style: italic; color: #666;">No items selected</td></tr>';
  }

  const orderedByDisplay =
    orderedByLineOpt != null && orderedByLineOpt !== ''
      ? orderedByLineOpt
      : order && (order.created_by || order.createdBy)
        ? String(order.created_by || order.createdBy)
        : window.mfFormatOrderedByFromSessionUser(user);
  const organizationDisplay =
    organizationLineOpt != null && organizationLineOpt !== ''
      ? organizationLineOpt
      : `${user.org || 'N/A'}, Address: ${user.orgAddressLine1 || ''} ${
          user.orgAddressLine2 ? user.orgAddressLine2 : ''
        }, ${user.orgCity || ''}, ${user.orgState || ''}, ${user.orgCountry || ''}`;
  
  return `
    <div id="patient-info" style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
      <p><strong>Patient:</strong> ${patient.firstName} ${patient.middleName ? patient.middleName : ''} ${patient.lastName}</p>
      <p><strong>DOB:</strong> ${patient.dob} | <strong>Gender:</strong> ${patient.gender} | <strong>Phone:</strong> ${patient.phone} | <strong>Email:</strong> ${patient.email || 'N/A'}</p>
      <p><strong>Address:</strong> ${patient.addressLine1} ${patient.addressLine2 ? patient.addressLine2 : ''}, ${patient.city}, ${patient.state}, ${patient.country}</p>
      <p><strong>Visit Date:</strong> ${visitDate}</p>
      <p><strong>Ordered By:</strong> ${orderedByDisplay}</p>
      <p><strong>Organization:</strong> ${organizationDisplay}</p>
    </div>
    
    <table class="order-modal-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #4CAF50; color: white;">
          <th class="order-th-left" style="border: 1px solid #ddd; padding: 12px;">Test Name</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">CPT Code(s)</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">Specimen Type/Volume</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">Container</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">Transport/Stability</th>
          <th class="order-th-left" style="border: 1px solid #ddd; padding: 12px;">Notes/Reflex</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    
    <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Generated on ${new Date(order.timestamp).toLocaleString()}</p>
    </div>
  `;
}

// Generate Imaging Order HTML - v195 (Fixed table alignment)
function generateImagingOrderHTML(order, patient, user, visitDate, orderedByLineOpt, organizationLineOpt) {
  let tableRows = '';
  const sel = window.mfNormalizeOrderSelectedItems(order);
  
  if (order.noItemsChecked) {
    tableRows = '<tr><td colspan="6" style="border: 1px solid #ddd; padding: 12px; text-align: center; font-style: italic; color: #666;">No imaging tests required</td></tr>';
  } else if (sel.length > 0) {
    sel.forEach(item => {
      const row =
        typeof window.mfMergeImagingOrderItemWithCatalog === 'function'
          ? window.mfMergeImagingOrderItemWithCatalog(item)
          : null;
      if (!row || !row.name) {
        const testName =
          typeof item === 'object' && item !== null
            ? item.name || JSON.stringify(item)
            : String(item || '');
        tableRows += `
          <tr>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">${testName}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">N/A</td>
          </tr>
        `;
        return;
      }
      tableRows += `
          <tr>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">${row.name}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.cpt || 'N/A'}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.modality || 'N/A'}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.preparation || 'N/A'}</td>
            <td class="order-td-center" style="border: 1px solid #ddd; padding: 12px;">${row.contrast || 'N/A'}</td>
            <td class="order-td-left" style="border: 1px solid #ddd; padding: 12px;">${row.notes || 'N/A'}</td>
          </tr>
        `;
    });
  } else {
    tableRows = '<tr><td colspan="6" style="border: 1px solid #ddd; padding: 12px; text-align: center; font-style: italic; color: #666;">No items selected</td></tr>';
  }

  const orderedByDisplayIm =
    orderedByLineOpt != null && orderedByLineOpt !== ''
      ? orderedByLineOpt
      : order && (order.created_by || order.createdBy)
        ? String(order.created_by || order.createdBy)
        : window.mfFormatOrderedByFromSessionUser(user);
  const organizationDisplayIm =
    organizationLineOpt != null && organizationLineOpt !== ''
      ? organizationLineOpt
      : `${user.org || 'N/A'}, Address: ${user.orgAddressLine1 || ''} ${
          user.orgAddressLine2 ? user.orgAddressLine2 : ''
        }, ${user.orgCity || ''}, ${user.orgState || ''}, ${user.orgCountry || ''}`;
  
  return `
    <div id="patient-info" style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
      <p><strong>Patient:</strong> ${patient.firstName} ${patient.middleName ? patient.middleName : ''} ${patient.lastName}</p>
      <p><strong>DOB:</strong> ${patient.dob} | <strong>Gender:</strong> ${patient.gender} | <strong>Phone:</strong> ${patient.phone} | <strong>Email:</strong> ${patient.email || 'N/A'}</p>
      <p><strong>Address:</strong> ${patient.addressLine1} ${patient.addressLine2 ? patient.addressLine2 : ''}, ${patient.city}, ${patient.state}, ${patient.country}</p>
      <p><strong>Visit Date:</strong> ${visitDate}</p>
      <p><strong>Ordered By:</strong> ${orderedByDisplayIm}</p>
      <p><strong>Organization:</strong> ${organizationDisplayIm}</p>
    </div>
    
    <table class="order-modal-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #4CAF50; color: white;">
          <th class="order-th-left" style="border: 1px solid #ddd; padding: 12px;">Test Name</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">CPT Code</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">Modality</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">Patient Preparation</th>
          <th class="order-th-center" style="border: 1px solid #ddd; padding: 12px;">Contrast Required</th>
          <th class="order-th-left" style="border: 1px solid #ddd; padding: 12px;">Notes/Indications</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    
    <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Generated on ${new Date(order.timestamp).toLocaleString()}</p>
    </div>
  `;
}

// Generate Lab Order PDF (print-ready format)
function generateLabOrderPDF(order, patient, user, visitDate) {
  // CRITICAL: Get user-friendly patient ID - NEVER use UUID
  let displayPatientId = getPatientIdentifier(patient);
  // If no legacy ID, generate temporary one - NEVER use UUID
  if (!displayPatientId || displayPatientId.includes('-') || displayPatientId.length >= 36) {
    const uuid = patient._supabaseUuid || patient.id;
    if (uuid && uuid.includes('-')) {
      const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
      const userObj = JSON.parse(localStorage.getItem("user") || "{}");
      const orgId = userObj.organizationId || userObj.organization_id;
      let orgPrefix = 'MEC';
      // Try to get org prefix synchronously from localStorage first
      if (orgId) {
        try {
          const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgData = Object.values(orgs).find(org => org.id === orgId);
          if (orgData?.name) {
            orgPrefix = orgData.name.substring(0, 3).toUpperCase();
          }
        } catch (e) {
          // Fallback to default MEC prefix
        }
      }
      displayPatientId = `${orgPrefix}${uuidDigits}`;
    } else {
      displayPatientId = 'TEMP0001';
    }
  }
  const patientIdUi =
    typeof window.patientMrnDisplay === 'function'
      ? window.patientMrnDisplay(patient, patientId)
      : displayPatientId;
  
  let tableRows = '';
  const selLabPdf = window.mfNormalizeOrderSelectedItems(order);
  
  if (order.noItemsChecked) {
    tableRows = '<tr><td colspan="6" style="text-align: center; font-style: italic; padding: 20px;">No lab tests required</td></tr>';
  } else if (selLabPdf.length > 0) {
    selLabPdf.forEach(item => {
      const row =
        typeof window.mfMergeLabOrderItemWithCatalog === 'function'
          ? window.mfMergeLabOrderItemWithCatalog(item)
          : null;
      const testName =
        typeof item === 'object' && item != null
          ? item.name || item.testName || JSON.stringify(item)
          : item;
      if (row && row.name) {
        tableRows += `
          <tr>
            <td style="border: 1px solid #000; padding: 8px;">${row.name}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${row.cpt || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.specimen || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.container || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.transport || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.notes || 'N/A'}</td>
          </tr>
        `;
      } else {
        tableRows += `
          <tr>
            <td style="border: 1px solid #000; padding: 8px;">${testName}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
          </tr>
        `;
      }
    });
  } else {
    tableRows = '<tr><td colspan="6" style="text-align: center; font-style: italic; padding: 20px;">No items selected</td></tr>';
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Laboratory Order</title>
      <style>
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px; 
          line-height: 1.4;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        .header h1 { 
          font-size: 24px; 
          margin: 0 0 10px 0; 
          color: #000;
        }
        .header h2 { 
          font-size: 18px; 
          margin: 0 0 5px 0; 
          color: #333;
        }
        .header p { 
          margin: 2px 0; 
          font-size: 12px;
        }
        .section { 
          margin: 20px 0; 
        }
        .section h3 { 
          font-size: 14px; 
          margin: 0 0 10px 0; 
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 10px 0;
          font-size: 11px;
        }
        th { 
          background-color: #f0f0f0; 
          border: 1px solid #000; 
          padding: 8px; 
          text-align: center;
          font-weight: bold;
        }
        .footer { 
          margin-top: 40px; 
          text-align: center; 
          font-size: 10px; 
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }
        .patient-info {
          background-color: #f9f9f9;
          border: 1px solid #ccc;
          padding: 15px;
          margin: 20px 0;
        }
        .patient-info p {
          margin: 5px 0;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>LABORATORY ORDER</h1>
        <h2>${user.org || 'Medical Clinic'}</h2>
        <p>${user.orgAddressLine1 || ''} ${user.orgAddressLine2 || ''}</p>
        <p>${user.orgCity || ''}, ${user.orgState || ''} ${user.orgCountry || ''}</p>
        <p>Phone: ${user.phone || ''} | Email: ${user.email || ''}</p>
      </div>

      <div class="section">
        <h3>PRESCRIBER INFORMATION</h3>
        <p><strong>Name:</strong> ${user.username}</p>
        <p><strong>License:</strong> ${user.medicalLicenseNumber || 'N/A'}</p>
        <p><strong>Specialty:</strong> ${user.specialty || 'N/A'}</p>
      </div>
      
      <div class="patient-info">
        <h3>PATIENT INFORMATION</h3>
        <p><strong>Name:</strong> ${patient.firstName} ${patient.middleName ? patient.middleName : ''} ${patient.lastName}</p>
        <p><strong>DOB:</strong> ${patient.dob} | <strong>Gender:</strong> ${patient.gender || 'Not specified'}</p>
        <p><strong>Patient ID:</strong> ${patientIdUi}</p>
        <p><strong>Phone:</strong> ${patient.phone || 'N/A'} | <strong>Email:</strong> ${patient.email || 'N/A'}</p>
        <p><strong>Address:</strong> ${patient.addressLine1} ${patient.addressLine2 ? patient.addressLine2 : ''}, ${patient.city}, ${patient.state}, ${patient.country}</p>
      </div>

      <div class="section">
        <h3>ORDER DETAILS</h3>
        <p><strong>Date:</strong> ${visitDate}</p>
        <p><strong>Order Type:</strong> Laboratory Tests</p>
      </div>

      <div class="section">
        <h3>LABORATORY TESTS</h3>
        <table>
          <thead>
            <tr>
              <th>Test Name</th>
              <th>CPT Code</th>
              <th>Specimen Type/Volume</th>
              <th>Container</th>
              <th>Transport/Stability</th>
              <th>Notes/Reflex</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Ordered by: Dr. ${user.firstName} ${user.lastName} | Date: ${new Date(order.timestamp).toLocaleDateString()}</p>
        <p>Generated on: ${new Date(order.timestamp).toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
}
// Generate Imaging Order PDF (print-ready format)
function generateImagingOrderPDF(order, patient, user, visitDate) {
  // CRITICAL: Get user-friendly patient ID - NEVER use UUID
  let displayPatientId = getPatientIdentifier(patient);
  // If no legacy ID, generate temporary one - NEVER use UUID
  if (!displayPatientId || displayPatientId.includes('-') || displayPatientId.length >= 36) {
    const uuid = patient._supabaseUuid || patient.id;
    if (uuid && uuid.includes('-')) {
      const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
      const userObj = JSON.parse(localStorage.getItem("user") || "{}");
      const orgId = userObj.organizationId || userObj.organization_id;
      let orgPrefix = 'MEC';
      // Try to get org prefix synchronously from localStorage first
      if (orgId) {
        try {
          const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgData = Object.values(orgs).find(org => org.id === orgId);
          if (orgData?.name) {
            orgPrefix = orgData.name.substring(0, 3).toUpperCase();
          }
        } catch (e) {
          // Fallback to default MEC prefix
        }
      }
      displayPatientId = `${orgPrefix}${uuidDigits}`;
    } else {
      displayPatientId = 'TEMP0001';
    }
  }
  const patientIdUiImg =
    typeof window.patientMrnDisplay === 'function'
      ? window.patientMrnDisplay(patient, patientId)
      : displayPatientId;
  
  let tableRows = '';
  const selImPdf = window.mfNormalizeOrderSelectedItems(order);
  
  if (order.noItemsChecked) {
    tableRows = '<tr><td colspan="6" style="text-align: center; font-style: italic; padding: 20px;">No imaging tests required</td></tr>';
  } else if (selImPdf.length > 0) {
    selImPdf.forEach(item => {
      const row =
        typeof window.mfMergeImagingOrderItemWithCatalog === 'function'
          ? window.mfMergeImagingOrderItemWithCatalog(item)
          : null;
      const testLabel =
        typeof item === 'object' && item != null
          ? item.name || item.testName || JSON.stringify(item)
          : item;
      if (row && row.name) {
        tableRows += `
          <tr>
            <td style="border: 1px solid #000; padding: 8px;">${row.name}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${row.cpt || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.modality || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.preparation || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.contrast || 'N/A'}</td>
            <td style="border: 1px solid #000; padding: 8px;">${row.notes || 'N/A'}</td>
          </tr>
        `;
      } else {
        tableRows += `
          <tr>
            <td style="border: 1px solid #000; padding: 8px;">${testLabel}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
            <td style="border: 1px solid #000; padding: 8px;">N/A</td>
          </tr>
        `;
      }
    });
  } else {
    tableRows = '<tr><td colspan="6" style="text-align: center; font-style: italic; padding: 20px;">No items selected</td></tr>';
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Imaging Order</title>
      <style>
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px; 
          line-height: 1.4;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        .header h1 { 
          font-size: 24px; 
          margin: 0 0 10px 0; 
          color: #000;
        }
        .header h2 { 
          font-size: 18px; 
          margin: 0 0 5px 0; 
          color: #333;
        }
        .header p { 
          margin: 2px 0; 
          font-size: 12px;
        }
        .section { 
          margin: 20px 0; 
        }
        .section h3 { 
          font-size: 14px; 
          margin: 0 0 10px 0; 
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 10px 0;
          font-size: 11px;
        }
        th { 
          background-color: #f0f0f0; 
          border: 1px solid #000; 
          padding: 8px; 
          text-align: center;
          font-weight: bold;
        }
        .footer { 
          margin-top: 40px; 
          text-align: center; 
          font-size: 10px; 
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }
        .patient-info {
          background-color: #f9f9f9;
          border: 1px solid #ccc;
          padding: 15px;
          margin: 20px 0;
        }
        .patient-info p {
          margin: 5px 0;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>IMAGING ORDER</h1>
        <h2>${user.org || 'Medical Clinic'}</h2>
        <p>${user.orgAddressLine1 || ''} ${user.orgAddressLine2 || ''}</p>
        <p>${user.orgCity || ''}, ${user.orgState || ''} ${user.orgCountry || ''}</p>
        <p>Phone: ${user.phone || ''} | Email: ${user.email || ''}</p>
      </div>

      <div class="section">
        <h3>PRESCRIBER INFORMATION</h3>
        <p><strong>Name:</strong> ${user.username}</p>
        <p><strong>License:</strong> ${user.medicalLicenseNumber || 'N/A'}</p>
        <p><strong>Specialty:</strong> ${user.specialty || 'N/A'}</p>
      </div>
      
      <div class="patient-info">
        <h3>PATIENT INFORMATION</h3>
        <p><strong>Name:</strong> ${patient.firstName} ${patient.middleName ? patient.middleName : ''} ${patient.lastName}</p>
        <p><strong>DOB:</strong> ${patient.dob} | <strong>Gender:</strong> ${patient.gender || 'Not specified'}</p>
        <p><strong>Patient ID:</strong> ${patientIdUiImg}</p>
        <p><strong>Phone:</strong> ${patient.phone || 'N/A'} | <strong>Email:</strong> ${patient.email || 'N/A'}</p>
        <p><strong>Address:</strong> ${patient.addressLine1} ${patient.addressLine2 ? patient.addressLine2 : ''}, ${patient.city}, ${patient.state}, ${patient.country}</p>
      </div>

      <div class="section">
        <h3>ORDER DETAILS</h3>
        <p><strong>Date:</strong> ${visitDate}</p>
        <p><strong>Order Type:</strong> Imaging Studies</p>
      </div>

      <div class="section">
        <h3>IMAGING STUDIES</h3>
        <table>
          <thead>
            <tr>
              <th>Study Name</th>
              <th>CPT Code</th>
              <th>Modality</th>
              <th>Patient Preparation</th>
              <th>Contrast Required</th>
              <th>Notes/Indications</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Ordered by: Dr. ${user.firstName} ${user.lastName} | Date: ${new Date(order.timestamp).toLocaleDateString()}</p>
        <p>Generated on: ${new Date(order.timestamp).toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
}

// Close order modal
function closeOrderModal() {
  const modal = document.getElementById("order-modal");
  if (modal) {
    modal.remove();
  }
}

// Print order modal
function printOrderModal() {
  const modal = document.getElementById("order-modal");
  if (!modal) return;
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  const modalContent = modal.querySelector('div');
  const contentToPrint = modalContent.innerHTML;
  
  printWindow.document.write(`
    <html>
      <head>
        <title>${document.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          @media print {
            body { margin: 0; font-size: 12pt; }
            table { page-break-inside: auto; }
          }
        </style>
      </head>
      <body>
        ${contentToPrint}
      </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

// Display history list
function displayHistory(history) {
  // displayHistory called
  const tbody = document.getElementById("history-list");
  if (tbody) {
    tbody.innerHTML = "";
    history.forEach((entry, index)=> {
      const row = document.createElement("tr");
      
      // Format the event to show ICD code if present
      let eventDisplay = entry.event;
      if (entry.event && entry.event.includes(' - ')) {
        // Format: "CODE - Description" - keep as is
        eventDisplay = entry.event;
      } else if (entry.event) {
        // Just description - add note that it needs ICD code
        eventDisplay = entry.event + ' <span style="color: #ff9800; font-size: 12px;">(Needs ICD code)</span>';
      }
      
      row.innerHTML = `
        <td>${entry.date}</td>
        <td>${eventDisplay}</td>
        <td>${entry.notes}</td>
        <td>
          <div style="display: flex; gap: 1px; flex-wrap: nowrap; align-items: center;">
          <button type="button" onclick="editEntry('medicalHistory', ${index})">Edit</button>
          <button type="button" onclick="deleteEntry('medicalHistory', ${index})">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}

// Display diagnoses list
function displayDiagnoses(diagnoses) {
  const tbody = document.getElementById("diagnoses-list");
  if (tbody) {
    tbody.innerHTML = "";
    diagnoses.forEach((entry, index) => {
      const row = document.createElement("tr");
      
      // Format the diagnosis to show ICD code if present
      let diagnosisDisplay = entry.diagnosis;
      if (entry.diagnosis && entry.diagnosis.includes(' - ')) {
        // Format: "CODE - Description" - keep as is
        diagnosisDisplay = entry.diagnosis;
      } else if (entry.diagnosis) {
        // Just description - add note that it needs ICD code
        diagnosisDisplay = entry.diagnosis + ' <span style="color: #ff9800; font-size: 12px;">(Needs ICD code)</span>';
      }
      
      row.innerHTML = `
        <td>${entry.date}</td>
        <td>${diagnosisDisplay}</td>
        <td>${entry.notes}</td>
        <td>
          <div style="display: flex; gap: 1px; flex-wrap: nowrap; align-items: center;">
          <button type="button" onclick="editEntry('diagnoses', ${index})">Edit</button>
          <button type="button" onclick="deleteEntry('diagnoses', ${index})">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}

// Display medications list
function displayMedications(medications) {
  // Try different table IDs for different pages
  let tbody = document.getElementById("medications-list"); // For some pages
  if (!tbody) {
    tbody = document.getElementById("medications-from-prescriptions"); // For clinical-note.html
  }
  if (!tbody) {
    tbody = document.getElementById("active-medications-list"); // For patient-details.html
  }
  if (tbody) {
    tbody.innerHTML = "";
    // Ensure medications is an array
    if (!Array.isArray(medications)) {
      medications = medications ? (typeof medications === 'string' ? JSON.parse(medications) : []) : [];
    }
    if (medications && medications.length > 0) {
    medications.forEach((entry, index) => {
      const row = document.createElement("tr");
        
          // Standard 6-column structure for all medication tables
      row.innerHTML = `
            <td>${entry.name || ''}</td>
            <td>${entry.dosage || ''}</td>
            <td>${entry.route || ''}</td>
            <td>${entry.frequency || ''}</td>
            <td>
              <span style="background: ${entry.status === 'Active' ? '#d4edda' : '#fff3cd'}; 
                           color: ${entry.status === 'Active' ? '#155724' : '#856404'}; 
                           padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                ${entry.status || 'Active'}
              </span>
            </td>
        <td>
          <div style="display: flex; gap: 1px; flex-wrap: nowrap; align-items: center;">
          <button type="button" onclick="editEntry('medications', ${index})">Edit</button>
          <button type="button" onclick="deleteEntry('medications', ${index})">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
    }
  }
}

// Display patient-reported medications (historical) for patient-details.html
function displayPatientReportedMedications(medications) {
  const tbody = document.getElementById("patient-medications-list");
  if (!tbody) return;
  
  if (medications.length === 0) {
    // Don't add placeholder text inside the table - let the placeholder div below handle it
    tbody.innerHTML = '';
    const placeholder = document.getElementById('patient-medications-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
    }
    return;
  }
  
  // Hide placeholder when medications exist
  const placeholder = document.getElementById('patient-medications-placeholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
  
  tbody.innerHTML = medications.map((entry, index) => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${entry.name || 'Not specified'}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${entry.dosage || 'Not specified'}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${entry.startDate || 'Not specified'}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${entry.endDate || 'Not specified'}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${entry.notes || 'No notes'}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <div style="display: flex; gap: 5px; align-items: center;">
          <button type="button" onclick="editEntry('medications', ${index})" 
                  style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            Edit
          </button>
          <button type="button" onclick="deleteEntry('medications', ${index})" 
                  style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Display allergies list
function displayAllergies(allergies) {
  const tbody = document.getElementById("allergies-list");
  if (tbody) {
    tbody.innerHTML = "";
    allergies.forEach((entry, index) => {
      const row = document.createElement("tr");
      
      // Create cells with proper styling
      const allergenCell = document.createElement("td");
      allergenCell.textContent = entry.allergen || '';
      
      const reactionCell = document.createElement("td");
      reactionCell.textContent = entry.reaction || '';
      
      const severityCell = document.createElement("td");
      severityCell.textContent = entry.severity || '';
      
      const notesCell = document.createElement("td");
      notesCell.textContent = entry.notes || '';
      
      const actionsCell = document.createElement("td");
      
      // Create container div for buttons
      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "action-buttons";
      
      // Create Edit button
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.className = "edit-btn";
      editButton.onclick = () => {
        console.log('Edit button clicked for index:', index);
        editEntry('allergies', index);
      };
      
      // Create Delete button
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete-btn";
      deleteButton.onclick = () => {
        console.log('Delete button clicked for index:', index);
        deleteEntry('allergies', index);
      };
      
      // Add buttons to container
      buttonsContainer.appendChild(editButton);
      buttonsContainer.appendChild(deleteButton);
      
      // Add container to actions cell
      actionsCell.appendChild(buttonsContainer);
      
      // Add cells to row
      row.appendChild(allergenCell);
      row.appendChild(reactionCell);
      row.appendChild(severityCell);
      row.appendChild(notesCell);
      row.appendChild(actionsCell);
      
      tbody.appendChild(row);
    });
  }
}

// Display immunizations list
function displayImmunizations(immunizations) {
  const tbody = document.getElementById("immunizations-list");
  if (tbody) {
    tbody.innerHTML = "";
    immunizations.forEach((entry, index) => {
      const row = document.createElement("tr");
      const proofCount = entry.proofAttachments ? entry.proofAttachments.length : 0;
      const proofButtons = proofCount > 0 
        ? `<button type="button" onclick="viewImmunizationProof('${entry.vaccine}', ${index})" style="background: #28a745; color: white; font-size: 9px; font-weight: 600; padding: 4px 6px; margin: 1px; width: 50px; height: 24px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); border: none; text-align: center;">View (${proofCount})</button>`
        : '';
      
      row.innerHTML = `
        <td>${entry.vaccine}</td>
        <td>${entry.date}</td>
        <td>${entry.notes}</td>
        <td>
          <div style="display: flex; gap: 8px; flex-wrap: nowrap; align-items: center;">
            <button type="button" class="immunization-edit-btn" onclick="editEntry('immunizations', ${index})">Edit</button>
            <button type="button" class="immunization-delete-btn" onclick="deleteEntry('immunizations', ${index})">Delete</button>
            <button type="button" class="immunization-proof-btn" onclick="addImmunizationProof(${index})">Add Proof</button>
            ${proofButtons}
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}

// Display functions for clinical-note.html tables
function displayNoteHistory(history) {
  console.warn('🔍 [displayNoteHistory] Called with', history?.length || 0, 'entries:', history);
  const tbody = document.getElementById("note-history-list");
  console.warn('🔍 [displayNoteHistory] tbody element:', tbody ? 'found' : 'NOT FOUND');
  if (tbody) {
    tbody.innerHTML = "";
    history.forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.event}</td>
        <td>${entry.notes}</td>
        <td>
          <div style="display: flex; gap: 1px; flex-wrap: nowrap; align-items: center;">
          <button type="button" onclick="editEntry('medicalHistory', ${index})">Edit</button>
          <button type="button" onclick="deleteEntry('medicalHistory', ${index})">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
    // console.log('🔧 TRACE: displayNoteHistory - added', history.length, 'rows');
  } else {
    // console.log('🔧 TRACE: displayNoteHistory - tbody not found!');
  }
}

function displayNoteDiagnoses(diagnoses) {
  // console.log('🔧 TRACE: displayNoteDiagnoses called with:', diagnoses);
  const tbody = document.getElementById("note-diagnoses-list");
  // console.log('🔧 TRACE: displayNoteDiagnoses - tbody element:', tbody);
  if (tbody) {
    tbody.innerHTML = "";
    diagnoses.forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.diagnosis}</td>
        <td>${entry.notes}</td>
        <td>
          <div style="display: flex; gap: 1px; flex-wrap: nowrap; align-items: center;">
          <button type="button" onclick="editEntry('diagnoses', ${index})">Edit</button>
          <button type="button" onclick="deleteEntry('diagnoses', ${index})">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
    // console.log('🔧 TRACE: displayNoteDiagnoses - added', diagnoses.length, 'rows');
  } else {
    // console.log('🔧 TRACE: displayNoteDiagnoses - tbody not found!');
  }
}

// Note: displayNoteMedications function removed - medications now displayed through prescription system

function displayNoteAllergies(allergies) {
  // console.log('🔧 TRACE: displayNoteAllergies called with:', allergies);
  // console.log('🔧 TRACE: displayNoteAllergies - allergies length:', allergies?.length);
  
  const tbody = document.getElementById("note-allergies-list");
  const table = tbody?.closest('table');
  // console.log('🔧 TRACE: displayNoteAllergies - tbody element:', tbody);
  // console.log('🔧 TRACE: displayNoteAllergies - table element:', table);
  
  if (!tbody) {
    console.error('❌ ERROR: note-allergies-list tbody not found!');
    console.error('❌ Available elements with "allergies" in ID:', 
      Array.from(document.querySelectorAll('[id*="allergies"]')).map(el => el.id));
    return;
  }
  
  if (!allergies || allergies.length === 0) {
    // No allergies to display, clearing table
    tbody.innerHTML = "";
    return;
  }
  
  // Clear existing content
  tbody.innerHTML = "";
  
  // Table styling is now handled by CSS classes
  
    allergies.forEach((entry, index) => {
      const row = document.createElement("tr");
    row.style.cssText = "border: 1px solid #ddd;";
    
    // Create cells with proper styling
    const allergenCell = document.createElement("td");
    allergenCell.textContent = entry.allergen || '';
    
    const reactionCell = document.createElement("td");
    reactionCell.textContent = entry.reaction || '';
    
    const severityCell = document.createElement("td");
    severityCell.textContent = entry.severity || '';
    
    const notesCell = document.createElement("td");
    notesCell.textContent = entry.notes || '';
    
    const actionsCell = document.createElement("td");
    
    // Create container div for buttons
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "action-buttons";
    
    // Create Edit button
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.className = "edit-btn";
    editButton.onclick = () => {
      console.log('Edit button clicked for index:', index);
      editEntry('allergies', index);
    };
    
    // Create Delete button
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-btn";
    deleteButton.onclick = () => {
      console.log('Delete button clicked for index:', index);
      deleteEntry('allergies', index);
    };
    
    // Add buttons to container
    buttonsContainer.appendChild(editButton);
    buttonsContainer.appendChild(deleteButton);
    
    // Add container to actions cell
    actionsCell.appendChild(buttonsContainer);
    
    // Add cells to row
    row.appendChild(allergenCell);
    row.appendChild(reactionCell);
    row.appendChild(severityCell);
    row.appendChild(notesCell);
    row.appendChild(actionsCell);
    
      tbody.appendChild(row);
    });
  
  // console.log('🔧 TRACE: displayNoteAllergies - added', allergies.length, 'rows');
  // console.log('🔧 TRACE: displayNoteAllergies - tbody children count:', tbody.children.length);
  
  // Verify buttons were created
  const buttons = tbody.querySelectorAll('button');
  // console.log('🔧 TRACE: Found', buttons.length, 'buttons in allergies table');
  buttons.forEach((button, index) => {
    // console.log(`🔧 TRACE: Button ${index + 1}: "${button.textContent}" - Visible: ${button.offsetWidth > 0}`);
  });
}

// Test function for manual debugging
function testAllergiesDisplay() {
  console.log('🧪 TESTING: Manual allergies display test');
  
  const testAllergies = [
    { allergen: "Test Fish", reaction: "Test Reaction", severity: "Severe", notes: "Test note" },
    { allergen: "Test Milk", reaction: "Test Hives", severity: "Moderate", notes: "Test note 2" }
  ];
  
  console.log('🧪 TESTING: Calling displayNoteAllergies with test data');
  displayNoteAllergies(testAllergies);
  
  // Check results
  const tbody = document.getElementById("note-allergies-list");
  if (tbody) {
    console.log('🧪 TESTING: Table has', tbody.children.length, 'rows');
    const buttons = tbody.querySelectorAll('button');
    console.log('🧪 TESTING: Found', buttons.length, 'buttons');
  } else {
    console.error('🧪 TESTING: tbody not found!');
  }
}
function displayNoteImmunizations(immunizations) {
  // console.log('🔧 TRACE: displayNoteImmunizations called with:', immunizations);
  const tbody = document.getElementById("note-immunizations-list");
  // console.log('🔧 TRACE: displayNoteImmunizations - tbody element:', tbody);
  if (tbody) {
    tbody.innerHTML = "";
    immunizations.forEach((entry, index) => {
      const row = document.createElement("tr");
      const proofCount = entry.proofAttachments ? entry.proofAttachments.length : 0;
      const proofButtons = proofCount > 0 
        ? `<button type="button" onclick="viewImmunizationProof('${entry.vaccine}', ${index})" style="background: #28a745; color: white; font-size: 9px; font-weight: 600; padding: 4px 6px; margin: 1px; width: 50px; height: 24px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); border: none; text-align: center;">View (${proofCount})</button>`
        : '';
      
      row.innerHTML = `
        <td>${entry.vaccine}</td>
        <td>${entry.date}</td>
        <td>${entry.notes}</td>
        <td>
          <div style="display: flex; gap: 8px; flex-wrap: nowrap; align-items: center;">
            <button type="button" class="immunization-edit-btn" onclick="editEntry('immunizations', ${index})">Edit</button>
            <button type="button" class="immunization-delete-btn" onclick="deleteEntry('immunizations', ${index})">Delete</button>
            <button type="button" class="immunization-proof-btn" onclick="addImmunizationProof(${index})">Add Proof</button>
            ${proofButtons}
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
    // console.log('🔧 TRACE: displayNoteImmunizations - added', immunizations.length, 'rows');
  } else {
    // console.log('🔧 TRACE: displayNoteImmunizations - tbody not found!');
  }
}

// Update clinical note weight input label/min/max from user's weight unit preference
window.updateClinicalWeightConfig = function() {
  const cell = document.getElementById('clinical-weight-cell');
  const input = document.getElementById('weight');
  if (!cell || !input || typeof window.getWeightInputConfig !== 'function') return;
  const cfg = window.getWeightInputConfig();
  const label = cell.querySelector('label');
  if (label) label.textContent = cfg.label + ':';
  input.min = cfg.min;
  input.max = cfg.max;
  input.placeholder = cfg.placeholder;
  input.title = 'Weight range: ' + cfg.min + '-' + cfg.max + ' ' + (cfg.label.includes('lbs') ? 'lbs' : 'kg');
};

// New: Display vitals table on clinical-note.html
function displayNoteVitals(vitals) {
  const tbody = document.getElementById("note-vitals-list");
  const showVitalsBtn = document.getElementById("show-vitals-form-btn");
  const addVitalsDiv = document.getElementById("add-vitals-div");
  const computeBmi = (heightValue, weightValue) => {
    const heightInMeters = parseFloat(heightValue) / 100;
    const weightInKg = parseFloat(weightValue);
    if (isNaN(heightInMeters) || isNaN(weightInKg) || heightInMeters <= 0 || weightInKg <= 0) {
      return null;
    }
    return parseFloat((weightInKg / (heightInMeters * heightInMeters)).toFixed(1));
  };
  
  if (tbody) {
    tbody.innerHTML = "";
    // Ensure vitals is an array
    if (!Array.isArray(vitals)) {
      console.log('Vitals is not an array:', vitals);
      vitals = [];
    }
    
    // Filter vitals for current visit date
    const urlParams = new URLSearchParams(window.location.search);
    const visitDate = urlParams.get("visitDate");
    const visitVitals = visitDate ? vitals.filter(v => v.visitDate === visitDate) : vitals;
    
    // CRITICAL: Only show one set of vitals per clinical note (for current visit)
    const displayVitals = visitVitals.slice(0, 1); // Only show first entry for this visit
    
    console.log('🔍 displayNoteVitals: visitVitals.length:', visitVitals.length, 'displayVitals.length:', displayVitals.length);
    
    if (displayVitals.length > 0) {
      // Vitals exist - hide Add button, show table
      console.log('✅ displayNoteVitals: Vitals exist, hiding Add button');
      console.log('🔍 displayNoteVitals: showVitalsBtn found:', !!showVitalsBtn);
      if (showVitalsBtn) {
        showVitalsBtn.style.display = 'none';
        showVitalsBtn.style.setProperty('display', 'none', 'important'); // Force hide with !important
        console.log('✅ displayNoteVitals: Add button hidden, current display:', showVitalsBtn.style.display);
      } else {
        console.error('❌ displayNoteVitals: showVitalsBtn not found!');
      }
      if (addVitalsDiv) addVitalsDiv.style.display = 'none';
      
      displayVitals.forEach((entry, index) => {
        // Find the actual index in the full vitals array for this visit
        const actualIndex = visitVitals.indexOf(entry);
        const needsBmi = (entry.bmi === null || entry.bmi === undefined || entry.bmi === '') &&
          entry.height && entry.weight;
        if (needsBmi) {
          const computedBmi = computeBmi(entry.height, entry.weight);
          if (computedBmi !== null) {
            entry.bmi = computedBmi;

            // Persist BMI update to localStorage (visit + patient.vitals)
            try {
              const urlParams = new URLSearchParams(window.location.search);
              const patientId = urlParams.get("patientId") || urlParams.get("id");
              const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
              const patient = patients.find(p =>
                p.id === patientId ||
                p.patient_id === patientId ||
                p._supabaseUuid === patientId
              );
              if (patient) {
                const visit = (patient.visits || []).find(v => v.date === visitDate);
                if (visit && visit.soap && visit.soap.objective && Array.isArray(visit.soap.objective.vitals)) {
                  const vitalsEntry = visit.soap.objective.vitals.find(v => v.timestamp === entry.timestamp);
                  if (vitalsEntry) {
                    vitalsEntry.bmi = computedBmi;
                  }
                }
                if (Array.isArray(patient.vitals)) {
                  const vitalsEntry = patient.vitals.find(v => v.timestamp === entry.timestamp);
                  if (vitalsEntry) {
                    vitalsEntry.bmi = computedBmi;
                  }
                }
                localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
                if (typeof window.saveClinicalNoteToSupabase === 'function') {
                  window.saveClinicalNoteToSupabase(patient);
                }
              }
            } catch (error) {
              // Silent fail: BMI will still display even if persistence fails
            }
          }
        }
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.temp || ''}</td>
        <td>${entry.hr || ''}</td>
        <td>${entry.rr || ''}</td>
        <td>${entry.systolic || ''}</td>
        <td>${entry.diastolic || ''}</td>
        <td>${entry.o2sat || ''}</td>
        <td>${entry.height || ''}</td>
        <td>${typeof window.formatWeightForDisplay === 'function' ? window.formatWeightForDisplay(entry.weight) : (entry.weight || '')}</td>
          <td>${entry.bmi !== null && entry.bmi !== undefined && entry.bmi !== '' ? entry.bmi : ''}</td>
        <td>${entry.pain || ''}</td>
        <td>${entry.notes || ''}</td>
        <td>
            <button type="button" onclick="editVitals(${actualIndex})">Edit</button>
            <button type="button" onclick="deleteVitals(${actualIndex})">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    } else {
      // No vitals - show Add button, hide table
      console.log('⚠️ displayNoteVitals: No vitals, showing Add button');
      if (showVitalsBtn) {
        showVitalsBtn.style.display = 'inline-block';
        console.log('✅ displayNoteVitals: Add button shown');
      }
      if (addVitalsDiv) addVitalsDiv.style.display = 'none';
    }
  } else {
    console.error('❌ displayNoteVitals: tbody not found!');
  }
}

// Note: Add Past Visit functionality has been removed
// Users can now only add new visits through the "Add New Visit" button

// Add history entry on patient-details
let historyEditIndex = -1;
window.addHistory = async function() {
  // addHistory called
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn : () => {};

  debugLog('🔍 addHistory: Starting...');
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");  // Handle both param names
  debugLog('🔍 addHistory: patientId from URL:', patientId);
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    debugLog('🔍 addHistory: Using resolvePatientByIdentifier...');
    patient = await window.resolvePatientByIdentifier(patientId);
    debugLog('🔍 addHistory: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null');
  } else {
    debugWarn('⚠️ addHistory: resolvePatientByIdentifier not available, using fallback...');
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      debugWarn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId) ||
              patients.find(p => p._supabaseUuid === patientId);
    debugLog('🔍 addHistory: Fallback lookup result:', patient ? `Patient found: ${patient.id || patient.patient_id}` : 'null');
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    debugWarn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (patient) {
    debugLog('✅ addHistory: Patient found, proceeding with history entry...');
    const date = document.getElementById('history-date').value;
    const event = document.getElementById('history-event').value;
    const notes = document.getElementById('history-notes').value;
    let filledCount = 0;
    if (date) filledCount++;
    if (event) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter date in YYYY-MM-DD format.");
      return;
    }
    const entry = { date, event, notes };
    patient.medicalHistory = patient.medicalHistory || [];
    if (historyEditIndex >= 0) {
      patient.medicalHistory[historyEditIndex] = entry;
      historyEditIndex = -1;
      document.getElementById("history-btn").textContent = "Add";
    } else {
      patient.medicalHistory.push(entry);
    }
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
      debugLog('✅ addHistory: Updated patient in array at index:', patientIndex);
    } else {
      patients.push(patient);
      debugLog('✅ addHistory: Added new patient to array');
    }
    
    // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      debugLog('✅ addHistory: Medical history saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteHistory(patient.medicalHistory);
      displayHistory(patient.medicalHistory);
    }).catch(error => {
      console.error('❌ addHistory: Failed to save medical history to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      debugLog('✅ addHistory: Medical history saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteHistory(patient.medicalHistory);
      displayHistory(patient.medicalHistory);
    });
    document.getElementById("history-date").value = '';
    document.getElementById("history-event").value = '';
    document.getElementById("history-notes").value = '';
    
    // Hide form and show button again
    const historyForm = document.getElementById("add-history-div");
    const showHistoryBtn = document.getElementById("show-history-form-btn");
    if (historyForm) historyForm.style.display = 'none';
    if (showHistoryBtn) showHistoryBtn.style.display = 'block';
    
    // Trigger custom event for real-time sync (consistent with other functions)
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'medicalHistoryAdded', data: entry }
    }));
    debugLog('✅ addHistory: Custom event dispatched for real-time sync');
  } else {
    console.error('❌ addHistory: Patient not found! Identifier:', patientId, 'Patients in array:', patients.length);
    alert("Patient not found!");
  }
};

// Add diagnosis entry on patient-details
let diagnosisEditIndex = -1;
window.addDiagnosis = async function() {
  // addDiagnosis called
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn : () => {};

  debugLog('🔍 addDiagnosis: Starting...');
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");  // Handle both param names
  debugLog('🔍 addDiagnosis: patientId from URL:', patientId);
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    debugLog('🔍 addDiagnosis: Using resolvePatientByIdentifier...');
    patient = await window.resolvePatientByIdentifier(patientId);
    debugLog('🔍 addDiagnosis: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null');
  } else {
    debugWarn('⚠️ addDiagnosis: resolvePatientByIdentifier not available, using fallback...');
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      debugWarn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId) ||
              patients.find(p => p._supabaseUuid === patientId);
    debugLog('🔍 addDiagnosis: Fallback lookup result:', patient ? `Patient found: ${patient.id || patient.patient_id}` : 'null');
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    debugWarn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (patient) {
    debugLog('✅ addDiagnosis: Patient found, proceeding with diagnosis entry...');
    const date = document.getElementById('diagnosis-date').value;
    const diagnosis = document.getElementById('diagnosis').value;
    const notes = document.getElementById('diagnosis-notes').value;
    let filledCount = 0;
    if (date) filledCount++;
    if (diagnosis) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter date in YYYY-MM-DD format.");
      return;
    }
    const entry = { date, diagnosis, notes };
    patient.diagnoses = patient.diagnoses || [];
    if (diagnosisEditIndex >= 0) {
      patient.diagnoses[diagnosisEditIndex] = entry;
      diagnosisEditIndex = -1;
      document.getElementById("diagnosis-btn").textContent = "Add";
    } else {
      patient.diagnoses.push(entry);
    }
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
      debugLog('✅ addDiagnosis: Updated patient in array at index:', patientIndex);
    } else {
      patients.push(patient);
      debugLog('✅ addDiagnosis: Added new patient to array');
    }
    
    // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      // Save to localStorage as cache/fallback
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      debugLog('✅ addDiagnosis: Diagnosis saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteDiagnoses(patient.diagnoses);
      displayDiagnoses(patient.diagnoses);
    }).catch(error => {
      console.error('❌ addDiagnosis: Failed to save diagnosis to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      debugLog('✅ addDiagnosis: Diagnosis saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteDiagnoses(patient.diagnoses);
      displayDiagnoses(patient.diagnoses);
    });
    
    document.getElementById("diagnosis-date").value = '';
    document.getElementById("diagnosis").value = '';
    document.getElementById("diagnosis-notes").value = '';
    
    // Hide form and show button again
    const diagnosisForm = document.getElementById("add-note-diagnosis-div");
    const showDiagnosisBtn = document.getElementById("show-diagnosis-form-btn");
    if (diagnosisForm) diagnosisForm.style.display = 'none';
    if (showDiagnosisBtn) showDiagnosisBtn.style.display = 'block';
    
    // Trigger custom event for real-time sync (consistent with other functions)
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'diagnosisAdded', data: entry }
    }));
    debugLog('✅ addDiagnosis: Custom event dispatched for real-time sync');
  } else {
    console.error('❌ addDiagnosis: Patient not found! Identifier:', patientId, 'Patients in array:', patients.length);
    alert("Patient not found!");
  }
};

// Add medication entry on patient-details
let medicationEditIndex = -1;
window.addPatientMedication = function() {
  // addPatientMedication called
  const isClinicalNote = !!document.getElementById("soap-form");
  const prefix = isClinicalNote ? 'note-' : '';
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");  // Handle both param names
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (patient) {
    const name = document.getElementById(prefix + 'med-name').value;
    const dosage = document.getElementById(prefix + 'med-dosage').value;
    const startDate = document.getElementById(prefix + 'med-start').value;
    const endDate = document.getElementById(prefix + 'med-end').value;
    const notes = document.getElementById(prefix + 'med-notes').value;
    let filledCount = 0;
    if (name) filledCount++;
    if (dosage) filledCount++;
    if (startDate) filledCount++;
    if (endDate) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    if (startDate && !startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter start date in YYYY-MM-DD format.");
      return;
    }
    if (endDate && !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter end date in YYYY-MM-DD format.");
      return;
    }
    const entry = { 
      name, 
      dosage, 
      route: '',
      frequency: '',
      startDate, 
      endDate, 
      prescribingProvider: '',
      indication: '',
      status: 'Active',
      quantity: '',
      refillsRemaining: '',
      refills: '',
      notes 
    };
    patient.medications = patient.medications || [];
    if (medicationEditIndex >= 0) {
      patient.medications[medicationEditIndex] = entry;
      medicationEditIndex = -1;
      document.getElementById(prefix + "medication-btn").textContent = "Add";
    } else {
      patient.medications.push(entry);
    }
    
    // Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      // Save to localStorage as cache/fallback
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Medication saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      setTimeout(() => {
        displayPatientReportedMedications(patient.medications);
        displayMedications(patient.medications);
        // Also update the unified active medications table
        if (typeof loadAllPrescriptionsForPatient === 'function') {
          loadAllPrescriptionsForPatient(patientId);
        }
      }, 100);
    }).catch(error => {
      console.error('Failed to save medication to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('Medication saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      setTimeout(() => {
        displayPatientReportedMedications(patient.medications);
        displayMedications(patient.medications);
        // Also update the unified active medications table
        if (typeof loadAllPrescriptionsForPatient === 'function') {
          loadAllPrescriptionsForPatient(patientId);
        }
      }, 100);
    });
    
    document.getElementById(prefix + "med-name").value = '';
    document.getElementById(prefix + "med-dosage").value = '';
    document.getElementById(prefix + "med-start").value = '';
    document.getElementById(prefix + "med-end").value = '';
    document.getElementById(prefix + "med-notes").value = '';
    
    // Trigger localStorage event for cross-tab sync
    // Dispatching localStorage event for medicationAdded
    
    // Use localStorage event for cross-tab synchronization
    const syncEvent = {
      type: 'patientDataUpdated',
      patientId: patientId,
      action: 'medicationAdded',
      data: entry,
      timestamp: new Date().toISOString()
    };
    
    // Store the sync event in localStorage to trigger cross-tab sync
    localStorage.setItem('patientDataSync', JSON.stringify(syncEvent));
    // localStorage sync event dispatched
    
    // Also dispatch the event for immediate page updates
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'medicationAdded', data: entry }
    }));
  } else {
    alert("Patient not found!");
  }
};

// addPatientMedication function available

// Add allergy entry on patient-details
let allergyEditIndex = -1;
window.addAllergy = function() {
  // addAllergy called
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");  // Handle both param names
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (patient) {
    // Get values from form fields (populated by enhanced allergy selector)
    const allergenField = document.getElementById('allergy-selector-container-allergen');
    const severityField = document.getElementById('allergy-selector-container-severity');
    const notesField = document.getElementById('allergy-selector-container-notes');
    
    // Get reactions from the selected reactions checkboxes
    const reactionsContainer = document.getElementById('allergy-selector-container-reactions');
    let reactions = [];
    if (reactionsContainer) {
      const checkedBoxes = reactionsContainer.querySelectorAll('input[type="checkbox"]:checked');
      reactions = Array.from(checkedBoxes).map(cb => cb.value);
    }
    
    const allergen = allergenField ? allergenField.value : '';
    const reaction = reactions.join(', ');
    const severity = severityField ? severityField.value : '';
    const notes = notesField ? notesField.value : '';
    
    let filledCount = 0;
    if (allergen) filledCount++;
    if (reaction) filledCount++;
    if (severity) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    const entry = { allergen, reaction, severity, notes };
    patient.allergies = patient.allergies || [];
    if (allergyEditIndex >= 0) {
      patient.allergies[allergyEditIndex] = entry;
      allergyEditIndex = -1;
      const btn = document.getElementById("allergy-btn");
      if (btn) btn.textContent = "Add";
    } else {
      patient.allergies.push(entry);
    }
    
    // Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      // Save to localStorage as cache/fallback
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Allergy saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteAllergies(patient.allergies);
      displayAllergies(patient.allergies);
    }).catch(error => {
      console.error('Failed to save allergy to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('Allergy saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteAllergies(patient.allergies);
      displayAllergies(patient.allergies);
    });
    
    // Hide allergy selector form and show Add button (for patient-details page)
    const allergyContainer = document.getElementById('allergy-selector-container');
    const showAllergyBtn = document.getElementById('show-allergy-form-btn');
    if (allergyContainer && showAllergyBtn) {
      allergyContainer.style.display = 'none';
      showAllergyBtn.style.display = 'block';
    }
    
    // Clear form fields (only clear if they exist)
    if (allergenField) allergenField.value = '';
    if (severityField) severityField.value = '';
    if (notesField) notesField.value = '';
    
    // Clear reaction checkboxes
    if (reactionsContainer) {
      const checkboxes = reactionsContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => cb.checked = false);
    }
    
    // Trigger custom event for real-time sync (consistent with other functions)
    // Dispatching CustomEvent for allergyAdded
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'allergyAdded', data: entry }
    }));
    // CustomEvent dispatched for allergyAdded
  } else {
    alert("Patient not found!");
  }
};

// Add immunization entry on patient-details
let immunizationEditIndex = -1;
window.addImmunization = async function() {
  // addImmunization called
  console.log('🔍 addImmunization: Starting...');
  const isClinicalNote = !!document.getElementById("soap-form");
  const prefix = isClinicalNote ? 'note-' : '';
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");  // Handle both param names
  console.log('🔍 addImmunization: patientId from URL:', patientId);
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    console.log('🔍 addImmunization: Using resolvePatientByIdentifier...');
    patient = await window.resolvePatientByIdentifier(patientId);
    console.log('🔍 addImmunization: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null');
  } else {
    console.warn('⚠️ addImmunization: resolvePatientByIdentifier not available, using fallback...');
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId) ||
              patients.find(p => p._supabaseUuid === patientId);
    console.log('🔍 addImmunization: Fallback lookup result:', patient ? `Patient found: ${patient.id || patient.patient_id}` : 'null');
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (patient) {
    console.log('✅ addImmunization: Patient found, proceeding with immunization entry...');
    const vaccine = document.getElementById(prefix + 'vaccine').value;
    const date = document.getElementById(prefix + 'immun-date').value;
    const notes = document.getElementById(prefix + 'immun-notes').value;
    let filledCount = 0;
    if (vaccine) filledCount++;
    if (date) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter date in YYYY-MM-DD format.");
      return;
    }
    const entry = { vaccine, date, notes };
    patient.immunizations = patient.immunizations || [];
    if (immunizationEditIndex >= 0) {
      patient.immunizations[immunizationEditIndex] = entry;
      immunizationEditIndex = -1;
      document.getElementById(prefix + "immunization-btn").textContent = "Add";
    } else {
      patient.immunizations.push(entry);
    }
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
      console.log('✅ addImmunization: Updated patient in array at index:', patientIndex);
    } else {
      patients.push(patient);
      console.log('✅ addImmunization: Added new patient to array');
    }
    
    // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ addImmunization: Immunization saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteImmunizations(patient.immunizations);
      displayImmunizations(patient.immunizations);
    }).catch(error => {
      console.error('❌ addImmunization: Failed to save immunization to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ addImmunization: Immunization saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteImmunizations(patient.immunizations);
      displayImmunizations(patient.immunizations);
    });
    
    document.getElementById(prefix + "vaccine").value = '';
    document.getElementById(prefix + "immun-date").value = '';
    document.getElementById(prefix + "immun-notes").value = '';
    
    // Hide form and show button again (for clinical-note only)
    if (isClinicalNote) {
      const immunizationForm = document.getElementById("add-note-immunization-div");
      const showImmunizationBtn = document.getElementById("show-immunization-form-btn");
      if (immunizationForm) immunizationForm.style.display = 'none';
      if (showImmunizationBtn) showImmunizationBtn.style.display = 'block';
    }
    
    // Trigger custom event for real-time sync (consistent with other functions)
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'immunizationAdded', data: entry }
    }));
    console.log('✅ addImmunization: Custom event dispatched for real-time sync');
  } else {
    console.error('❌ addImmunization: Patient not found! Identifier:', patientId, 'Patients in array:', patients.length);
    alert("Patient not found!");
  }
};

// Add note history entry (for clinical-note.html)
let noteHistoryEditIndex = -1;
window.addNoteHistory = async function() {
  // addNoteHistory called
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (patient) {
    const date = document.getElementById('note-history-date').value;
    const event = document.getElementById('note-history-event').value;
    const notes = document.getElementById('note-history-notes').value;
    let filledCount = 0;
    if (date) filledCount++;
    if (event) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter date in YYYY-MM-DD format.");
      return;
    }
    const entry = { date, event, notes };
    patient.medicalHistory = patient.medicalHistory || [];
    if (noteHistoryEditIndex >= 0) {
      patient.medicalHistory[noteHistoryEditIndex] = entry;
      noteHistoryEditIndex = -1;
      document.getElementById("note-history-btn").textContent = "Add";
    } else {
      patient.medicalHistory.push(entry);
    }
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
    } else {
      patients.push(patient);
    }
    
    // Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Medical history saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      // console.log('🔧 TRACE: Calling displayNoteHistory and displayHistory');
      displayNoteHistory(patient.medicalHistory);
      displayHistory(patient.medicalHistory);
    }).catch(error => {
      console.error('Failed to save medical history to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('Medical history saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      // console.log('🔧 TRACE: Calling displayNoteHistory and displayHistory');
      displayNoteHistory(patient.medicalHistory);
      displayHistory(patient.medicalHistory);
    });
    
    document.getElementById("note-history-date").value = '';
    document.getElementById("note-history-event").value = '';
    document.getElementById("note-history-notes").value = '';
    
    // Trigger custom event for real-time sync (consistent with other functions)
    // Dispatching CustomEvent for medicalHistoryAdded
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'medicalHistoryAdded', data: entry }
    }));
    // CustomEvent dispatched for medicalHistoryAdded
  } else {
    alert("Patient not found!");
  }
};
// Add note diagnosis entry (for clinical-note.html)
let noteDiagnosisEditIndex = -1;
window.addNoteDiagnosis = async function() {
  // addNoteDiagnosis called
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (patient) {
    const date = document.getElementById('note-diagnosis-date').value;
    const diagnosis = document.getElementById('note-diagnosis').value;
    const notes = document.getElementById('note-diagnosis-notes').value;
    let filledCount = 0;
    if (date) filledCount++;
    if (diagnosis) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter date in YYYY-MM-DD format.");
      return;
    }
    const entry = { date, diagnosis, notes };
    patient.diagnoses = patient.diagnoses || [];
    if (noteDiagnosisEditIndex >= 0) {
      patient.diagnoses[noteDiagnosisEditIndex] = entry;
      noteDiagnosisEditIndex = -1;
      document.getElementById("note-diagnosis-btn").textContent = "Add";
    } else {
      patient.diagnoses.push(entry);
    }
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
    } else {
      patients.push(patient);
    }
    
    // Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Diagnosis saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteDiagnoses(patient.diagnoses);
      displayDiagnoses(patient.diagnoses);
    }).catch(error => {
      console.error('Failed to save diagnosis to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('Diagnosis saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteDiagnoses(patient.diagnoses);
      displayDiagnoses(patient.diagnoses);
    });
    
    document.getElementById("note-diagnosis-date").value = '';
    document.getElementById("note-diagnosis").value = '';
    document.getElementById("note-diagnosis-notes").value = '';
    
    // Trigger custom event for real-time sync (consistent with other functions)
    // Dispatching CustomEvent for diagnosisAdded
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'diagnosisAdded', data: entry }
    }));
    // CustomEvent dispatched for diagnosisAdded
  } else {
    alert("Patient not found!");
  }
};

// Note: Old medication entry functions removed - now using comprehensive prescription system
// Medications are managed through the prescription form and displayed in the clinical note

// Add note allergy entry (for clinical-note.html)
let noteAllergyEditIndex = -1;
window.addNoteAllergy = async function() {
  // addNoteAllergy called
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  if (patient) {
    // Get values from allergy selector container fields (populated by enhanced allergy selector)
    const containerId = 'clinical-note-allergy-selector-container';
    
    // Try to get values from selector container fields first
    const allergenSelect = document.getElementById(`${containerId}-allergen`);
    const manualAllergenInput = document.getElementById(`${containerId}-manual-allergen`);
    const severitySelect = document.getElementById(`${containerId}-severity`);
    const notesInput = document.getElementById(`${containerId}-notes`);
    
    // Get reactions from checkboxes in the reactions container
    const reactionsContainer = document.getElementById(`${containerId}-reactions`);
    let reactions = [];
    if (reactionsContainer) {
      const checkedBoxes = reactionsContainer.querySelectorAll('input[type="checkbox"]:checked');
      reactions = Array.from(checkedBoxes).map(cb => cb.value);
    }
    
    // Fallback: Try note-* fields if selector fields don't exist
    const allergen = (allergenSelect && allergenSelect.value) || 
                     (manualAllergenInput && manualAllergenInput.value) || 
                     (document.getElementById('note-allergen')?.value || '') ||
                     (document.getElementById('allergen')?.value || '');
    const reaction = reactions.length > 0 ? reactions.join(', ') : 
                     (document.getElementById('note-reaction')?.value || '') ||
                     (document.getElementById('reaction')?.value || '');
    const severity = (severitySelect && severitySelect.value) || 
                     (document.getElementById('note-severity')?.value || '') ||
                     (document.getElementById('severity')?.value || '');
    const notes = (notesInput && notesInput.value) || 
                  (document.getElementById('note-allergy-notes')?.value || '') ||
                  (document.getElementById('allergy-notes')?.value || '');
    
    console.log('🔧 TRACE: Allergy field values:', { allergen, reaction, severity, notes });
    
    let filledCount = 0;
    if (allergen) filledCount++;
    if (reaction) filledCount++;
    if (severity) filledCount++;
    if (notes) filledCount++;
    
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    
    const entry = { allergen, reaction, severity, notes };
    patient.allergies = patient.allergies || [];
    if (noteAllergyEditIndex >= 0) {
      patient.allergies[noteAllergyEditIndex] = entry;
      noteAllergyEditIndex = -1;
      const btn = document.getElementById("note-allergy-btn");
      if (btn) btn.textContent = "Add";
    } else {
      patient.allergies.push(entry);
    }
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
    } else {
      patients.push(patient);
    }
    
    // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      // Save to localStorage as cache/fallback
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Allergy saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteAllergies(patient.allergies);
      displayAllergies(patient.allergies);
    }).catch(error => {
      console.error('Failed to save allergy to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('Allergy saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteAllergies(patient.allergies);
      displayAllergies(patient.allergies);
    });
    
    // Clear form fields (only clear if they exist)
    if (allergenSelect) allergenSelect.value = '';
    if (manualAllergenInput) manualAllergenInput.value = '';
    if (severitySelect) severitySelect.value = '';
    if (notesInput) notesInput.value = '';
    
    // Clear reaction checkboxes
    if (reactionsContainer) {
      const checkboxes = reactionsContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => cb.checked = false);
    }
    
    // Hide form and show button again
    const allergyForm = document.getElementById("clinical-note-allergy-selector-container");
    const showAllergyBtn = document.getElementById("show-allergy-form-btn");
    if (allergyForm) allergyForm.style.display = 'none';
    if (showAllergyBtn) showAllergyBtn.style.display = 'block';
    
    // Trigger custom event for real-time sync (consistent with other functions)
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'allergyAdded', data: entry }
    }));
  } else {
    alert("Patient not found!");
  }
};

// Add note immunization entry (for clinical-note.html)
let noteImmunizationEditIndex = -1;
window.addNoteImmunization = async function() {
  // addNoteImmunization called
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (patient) {
    const vaccineField = document.getElementById('note-vaccine');
    const dateField = document.getElementById('note-immun-date');
    const notesField = document.getElementById('note-immun-notes');
    
    const vaccine = vaccineField ? vaccineField.value : '';
    const date = dateField ? dateField.value : '';
    const notes = notesField ? notesField.value : '';
    
    let filledCount = 0;
    if (vaccine) filledCount++;
    if (date) filledCount++;
    if (notes) filledCount++;
    if (filledCount < 2) {
      alert("Please enter at least two fields.");
      return;
    }
    if (date && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Please enter date in YYYY-MM-DD format.");
      return;
    }
    const entry = { vaccine, date, notes };
    patient.immunizations = patient.immunizations || [];
    if (noteImmunizationEditIndex >= 0) {
      patient.immunizations[noteImmunizationEditIndex] = entry;
      noteImmunizationEditIndex = -1;
      const btn = document.getElementById("note-immunization-btn");
      if (btn) btn.textContent = "Add";
    } else {
      patient.immunizations.push(entry);
    }
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
    } else {
      patients.push(patient);
    }
    
    // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      // Save to localStorage as cache/fallback
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Immunization saved to Supabase and localStorage');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteImmunizations(patient.immunizations);
      displayImmunizations(patient.immunizations);
    }).catch(error => {
      console.error('Failed to save immunization to Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('Immunization saved to localStorage (Supabase unavailable)');
      
      // Update BOTH clinical-note AND patient-details tables for real-time sync
      displayNoteImmunizations(patient.immunizations);
      displayImmunizations(patient.immunizations);
    });
    
    // Clear form fields
    if (vaccineField) vaccineField.value = '';
    if (dateField) dateField.value = '';
    if (notesField) notesField.value = '';
    
    // Hide form and show button again
    const immunizationForm = document.getElementById("add-note-immunization-div");
    const showImmunizationBtn = document.getElementById("show-immunization-form-btn");
    if (immunizationForm) immunizationForm.style.display = 'none';
    if (showImmunizationBtn) showImmunizationBtn.style.display = 'block';
    
    // Trigger custom event for real-time sync (consistent with other functions)
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'immunizationAdded', data: entry }
    }));
  } else {
    alert("Patient not found!");
  }
};

// Add immunization proof attachment
window.addImmunizationProof = function(index) {
  const isClinicalNote = !!document.getElementById("soap-form");
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
  input.multiple = true;
  
  input.onchange = function(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    const immunization = patient.immunizations[index];
    if (!immunization.proofAttachments) {
      immunization.proofAttachments = [];
    }
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const attachment = {
          id: Date.now() + Math.random(),
          fileName: file.name,
          fileType: file.type,
          data: e.target.result,
          uploadDate: new Date().toISOString()
        };
        immunization.proofAttachments.push(attachment);
        
        // Save and refresh display
        localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        if (isClinicalNote) displayNoteImmunizations(patient.immunizations);
        else displayImmunizations(patient.immunizations);
        
        // Trigger sync event
        window.dispatchEvent(new CustomEvent('patientDataUpdated', {
          detail: { patientId, action: 'immunizationProofAdded', data: { index, attachment } }
        }));
      };
      reader.readAsDataURL(file);
    });
  };
  
  input.click();
};

// View immunization proof attachments
window.viewImmunizationProof = function(vaccineName, index) {
  const isClinicalNote = !!document.getElementById("soap-form");
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  const immunization = patient.immunizations[index];
  if (!immunization.proofAttachments || immunization.proofAttachments.length === 0) return;
  
  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 10000; display: flex; 
    align-items: center; justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 20px; border-radius: 8px; 
    max-width: 600px; max-height: 80vh; overflow-y: auto;
  `;
  
  let html = `<h3>Immunization Proof for ${vaccineName}</h3>`;
  immunization.proofAttachments.forEach(attachment => {
    html += `
      <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px;">
        <strong>${attachment.fileName}</strong><br>
        <small>Uploaded: ${new Date(attachment.uploadDate).toLocaleDateString()}</small><br>
        <button onclick="downloadImmunizationAttachment('${attachment.id}', '${attachment.fileName}')" style="background: #007bff; color: white; padding: 5px 10px; margin: 5px 5px 5px 0; border: none; border-radius: 4px;">Download</button>
        <button onclick="deleteImmunizationAttachment('${index}', '${attachment.id}')" style="background: #dc3545; color: white; padding: 5px 10px; margin: 5px; border: none; border-radius: 4px;">Delete</button>
      </div>
    `;
  });
  
  html += `<button onclick="this.closest('.modal').remove()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-top: 10px;">Close</button>`;
  
  content.innerHTML = html;
  modal.className = 'modal';
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Close on background click
  modal.onclick = function(e) {
    if (e.target === modal) modal.remove();
  };
};

// Download immunization attachment
window.downloadImmunizationAttachment = function(attachmentId, fileName) {
  const isClinicalNote = !!document.getElementById("soap-form");
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  // Find the attachment
  let attachment = null;
  for (let immunization of patient.immunizations) {
    if (immunization.proofAttachments) {
      attachment = immunization.proofAttachments.find(a => a.id === attachmentId);
      if (attachment) break;
    }
  }
  
  if (!attachment) return;
  
  const link = document.createElement('a');
  link.href = attachment.data;
  link.download = fileName;
  link.click();
};

// Delete immunization attachment
window.deleteImmunizationAttachment = async function(index, attachmentId) {
  const isClinicalNote = !!document.getElementById("soap-form");
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  
  if (!confirm('Are you sure you want to delete this attachment?')) return;
  
  // Supabase-first: Load patients from Supabase, fallback to localStorage
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  const immunization = patient.immunizations[index];
  if (immunization.proofAttachments) {
    immunization.proofAttachments = immunization.proofAttachments.filter(a => a.id !== attachmentId);
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
    } else {
      patients.push(patient);
    }
    
    // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
      // Save to localStorage as cache/fallback
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Immunization attachment deleted from Supabase and localStorage');
      
      // Refresh display
      if (isClinicalNote) displayNoteImmunizations(patient.immunizations);
      else displayImmunizations(patient.immunizations);
      
      // Refresh the modal
      const modal = document.querySelector('.modal');
      if (modal) {
        modal.remove();
        viewImmunizationProof(immunization.vaccine, index);
      }
      
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('patientDataUpdated', {
        detail: { patientId, action: 'immunizationProofDeleted', data: { index, attachmentId } }
      }));
    }).catch(error => {
      console.error('Failed to delete immunization attachment from Supabase, saving to localStorage only:', error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('Immunization attachment deleted from localStorage (Supabase unavailable)');
      
      // Refresh display
      if (isClinicalNote) displayNoteImmunizations(patient.immunizations);
      else displayImmunizations(patient.immunizations);
      
      // Refresh the modal
      const modal = document.querySelector('.modal');
      if (modal) {
        modal.remove();
        viewImmunizationProof(immunization.vaccine, index);
      }
      
      // Trigger sync event
      window.dispatchEvent(new CustomEvent('patientDataUpdated', {
        detail: { patientId, action: 'immunizationProofDeleted', data: { index, attachmentId } }
      }));
    });
  }
};

// Function to edit entry on patient-details or clinical-note
window.editEntry = function(field, index) {
  const isClinicalNote = !!document.getElementById("soap-form");
  const prefix = isClinicalNote ? 'note-' : '';
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");  // Handle both param names
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (patient) {
    const entry = patient[field][index];
    let inputMapping = {};
    let btnId = prefix + (field === 'medicalHistory' ? 'history' : field === 'diagnoses' ? 'diagnosis' : field === 'medications' ? 'medication' : field === 'allergies' ? 'allergy' : 'immunization') + '-btn';
    const btn = document.getElementById(btnId);
    btn.textContent = "Update";
    if (field === 'medicalHistory') {
      inputMapping = { date: prefix + 'history-date', event: prefix + 'history-event', notes: prefix + 'history-notes' };
      if (isClinicalNote) noteHistoryEditIndex = index;
      else historyEditIndex = index;
    } else if (field === 'diagnoses') {
      inputMapping = { date: prefix + 'diagnosis-date', diagnosis: prefix + 'diagnosis', notes: prefix + 'diagnosis-notes' };
      if (isClinicalNote) noteDiagnosisEditIndex = index;
      else diagnosisEditIndex = index;
    } else if (field === 'medications') {
      inputMapping = { name: prefix + 'med-name', dosage: prefix + 'med-dosage', startDate: prefix + 'med-start', endDate: prefix + 'med-end', notes: prefix + 'med-notes' };
      if (isClinicalNote) noteMedicationEditIndex = index;
      else medicationEditIndex = index;
    } else if (field === 'allergies') {
      inputMapping = { allergen: prefix + 'allergen', reaction: prefix + 'reaction', severity: prefix + 'severity', notes: prefix + 'allergy-notes' };
      if (isClinicalNote) noteAllergyEditIndex = index;
      else allergyEditIndex = index;
    } else if (field === 'immunizations') {
      inputMapping = { vaccine: prefix + 'vaccine', date: prefix + 'immun-date', notes: prefix + 'immun-notes' };
      if (isClinicalNote) noteImmunizationEditIndex = index;
      else immunizationEditIndex = index;
    }
    Object.keys(entry).forEach(key => {
      const inputId = inputMapping[key];
      const input = document.getElementById(inputId);
      if (input) input.value = entry[key];
    });
  }
};

// Function to delete entry on patient-details or clinical-note
window.deleteEntry = function(field, index) {
  if (!confirm("Are you sure you want to delete this entry?")) return;
  const isClinicalNote = !!document.getElementById("soap-form");
  const displayPrefix = isClinicalNote ? 'Note' : '';
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");  // Handle both param names
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  
  if (patient) {
    // Ensure the field exists and has the index
    if (!patient[field] || !patient[field][index]) {
      alert("Entry not found or already deleted.");
      return;
    }
    const deletedEntry = patient[field][index];
    patient[field].splice(index, 1);
    
    // Save to Supabase first (primary), then localStorage (fallback)
    savePatientToSupabase(patient).then(() => {
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log(`✅ ${field} entry deleted from Supabase and localStorage`);
      
    const fieldToDisplay = {
      'medicalHistory': 'History',
      'diagnoses': 'Diagnoses',
      'medications': 'Medications',
      'allergies': 'Allergies',
      'immunizations': 'Immunizations'
    }[field];
    
    // Update BOTH clinical-note AND patient-details tables for real-time sync
    const noteDisplayFunc = `displayNote${fieldToDisplay}`;
    const detailsDisplayFunc = `display${fieldToDisplay}`;
    
    // Special handling for medications - no note display function exists
    if (field === 'medications') {
      displayPatientReportedMedications(patient[field]);
      displayMedications(patient[field]);
      // Also update the unified active medications table
      if (typeof loadAllPrescriptionsForPatient === 'function') {
        loadAllPrescriptionsForPatient(patientId);
      }
    } else {
    if (window[noteDisplayFunc]) window[noteDisplayFunc](patient[field]);
    if (window[detailsDisplayFunc]) window[detailsDisplayFunc](patient[field]);
    }
    
    // Trigger custom event for real-time sync
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: `${field}Deleted`, data: deletedEntry }
    }));
    }).catch(error => {
      console.error(`Failed to delete ${field} from Supabase:`, error);
      // Fallback to localStorage only if Supabase fails
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      
      const fieldToDisplay = {
        'medicalHistory': 'History',
        'diagnoses': 'Diagnoses',
        'medications': 'Medications',
        'allergies': 'Allergies',
        'immunizations': 'Immunizations'
      }[field];
      
      // Update display even if Supabase fails
      const noteDisplayFunc = `displayNote${fieldToDisplay}`;
      const detailsDisplayFunc = `display${fieldToDisplay}`;
      
      // Special handling for medications - no note display function exists
      if (field === 'medications') {
        displayPatientReportedMedications(patient[field]);
        displayMedications(patient[field]);
      } else {
        if (window[noteDisplayFunc]) window[noteDisplayFunc](patient[field]);
        if (window[detailsDisplayFunc]) window[detailsDisplayFunc](patient[field]);
      }
    });
  }
};

// Delete vitals entry
window.deleteVitals = async function(index) {
  if (!confirm("Are you sure you want to delete this vitals entry?")) return;
  
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  
  if (!patientId) {
    alert("Missing patient ID");
    return;
  }
  
  // Load patients array first (needed for both lookup and saving)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
    console.log('🔍 deleteVitals: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id}` : 'null');
    
    // CRITICAL: If resolvePatientByIdentifier found the patient, use it directly
    // But we still need to reload patients array to ensure it's in sync
    if (patient) {
      try {
        if (typeof window.loadPatientsWithSupabasePriority === 'function') {
          patients = await window.loadPatientsWithSupabasePriority();
        } else {
          patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        }
        // Find the patient in the reloaded array to ensure we have the latest version
        const reloadedPatient = patients.find(p => 
          p.id === patient.id || 
          p.patient_id === patient.patient_id ||
          p._supabaseUuid === patient._supabaseUuid ||
          (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
        );
        if (reloadedPatient) {
          patient = reloadedPatient; // Use the version from the array for consistency
        }
      } catch (error) {
        console.warn('Error reloading patients after resolvePatientByIdentifier:', error);
        // Continue with patient from resolvePatientByIdentifier
      }
    }
  }
  
  // Fallback: If resolvePatientByIdentifier didn't work, try manual lookup
  if (!patient) {
    console.warn('⚠️ deleteVitals: resolvePatientByIdentifier returned null, trying manual lookup...');
    patient = patients.find(p => 
      p.id === patientId || 
      p.patient_id === patientId || 
      p.patientNumber === patientId ||
      p._supabaseUuid === patientId
    );
  }
  
  if (!patient || !patient.vitals) {
    console.error('❌ deleteVitals: Patient or vitals not found! Identifier:', patientId, 'Patients in array:', patients.length);
    alert("Patient or vitals not found");
    return;
  }
  
  console.log('✅ deleteVitals: Patient found:', patient.id || patient.patient_id);
  
  if (index < 0 || index >= patient.vitals.length) {
    alert("Invalid vitals entry");
    return;
  }
  
  const deletedEntry = patient.vitals[index];
  patient.vitals.splice(index, 1);
  
  // Save to Supabase first, then localStorage
  savePatientToSupabase(patient).then(() => {
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('✅ Vitals entry deleted from Supabase and localStorage');
    
    // CRITICAL: Update the patient in the patients array so it's saved to localStorage
    const patientIndex = patients.findIndex(p => 
      p.id === patient.id || 
      p.patient_id === patient.patient_id ||
      p._supabaseUuid === patient._supabaseUuid ||
      (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
    );
    if (patientIndex >= 0) {
      patients[patientIndex] = { ...patients[patientIndex], ...patient };
    } else {
      patients.push(patient);
    }
    
    // Update the display
    displayNoteVitals(patient.vitals);
    
    // Trigger custom event for real-time sync
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'vitalsDeleted', data: deletedEntry }
    }));
  }).catch(error => {
    console.error('Failed to delete vitals from Supabase:', error);
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    displayNoteVitals(patient.vitals);
  });
};

// Back to details function
window.backToDetails = async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  if (patientId) {
    // CRITICAL FIX: Normalize patient ID for URL
    let legacyId = patientId;
    if (typeof window.normalizePatientIdForUrl === 'function') {
      try {
        legacyId = await window.normalizePatientIdForUrl(patientId);
      } catch (error) {
        console.warn('⚠️ backToDetails: Error normalizing patient ID:', error);
      }
    }
    window.location.href = `/patient-details?id=${legacyId}`;
  } else {
    alert("Patient ID not found. Returning to dashboard.");
    window.location.href = "/dashboard";
  }
};

// Auto-add pending entries if at least two fields are filled
function autoAddPending(type, addFunction, fieldIds) {
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const fields = fieldIds.map(id => document.getElementById(id));
  const filledFields = fields.filter(field => field && field.value.trim() !== '');
  
  if (filledFields.length >= 2) {
    debugLog(`Auto-adding pending ${type} entry`);
    addFunction();
  }
}
// Add vital signs entry
window.addVitals = async function() {
  // addVitals called
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn : () => {};

  debugLog('🔍 addVitals: Starting...');
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  debugLog('🔍 addVitals: patientId from URL:', patientId, 'visitDate:', visitDate);
  
  if (!patientId || !visitDate) {
    alert("Missing patient ID or visit date");
    return;
  }
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    debugLog('🔍 addVitals: Using resolvePatientByIdentifier...');
    patient = await window.resolvePatientByIdentifier(patientId);
    debugLog('🔍 addVitals: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null');
  } else {
    debugWarn('⚠️ addVitals: resolvePatientByIdentifier not available, using fallback...');
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      debugWarn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId) ||
              patients.find(p => p._supabaseUuid === patientId);
    debugLog('🔍 addVitals: Fallback lookup result:', patient ? `Patient found: ${patient.id || patient.patient_id}` : 'null');
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    debugWarn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (!patient) {
    console.error('❌ addVitals: Patient not found! Identifier:', patientId, 'Patients in array:', patients.length);
    alert("Patient not found!");
    return;
  }
  
  debugLog('✅ addVitals: Patient found, proceeding with vitals entry...');
  
  // Get vital signs values
  const temp = document.getElementById("temp").value;
  const hr = document.getElementById("hr").value;
  const rr = document.getElementById("rr").value;
  const systolic = document.getElementById("systolic").value;
  const diastolic = document.getElementById("diastolic").value;
  const o2sat = document.getElementById("o2sat").value;
  const height = document.getElementById("height").value;
  const weightRaw = document.getElementById("weight").value;
  const pain = document.getElementById("pain").value;
  const notes = document.getElementById("vitals-notes").value;
  const weightKg = (weightRaw && typeof window.parseWeightInputToKg === 'function') ? window.parseWeightInputToKg(weightRaw) : (weightRaw ? parseFloat(weightRaw) : null);
  const weight = weightKg != null ? String(weightKg) : null;
  
  // Validate vital signs ranges (same as inpatient dashboard)
  const validationErrors = [];
  if (temp && temp.trim() !== '') {
    const tempVal = parseFloat(temp);
    if (isNaN(tempVal) || tempVal < 30 || tempVal > 45) {
      validationErrors.push("Temperature must be between 30-45°C");
    }
  }
  if (hr && hr.trim() !== '') {
    const hrVal = parseInt(hr);
    if (isNaN(hrVal) || hrVal < 30 || hrVal > 200) {
      validationErrors.push("Heart rate must be between 30-200 bpm");
    }
  }
  if (rr && rr.trim() !== '') {
    const rrVal = parseInt(rr);
    if (isNaN(rrVal) || rrVal < 8 || rrVal > 40) {
      validationErrors.push("Respiratory rate must be between 8-40 breaths/min");
    }
  }
  if (systolic && systolic.trim() !== '') {
    const sysVal = parseInt(systolic);
    if (isNaN(sysVal) || sysVal < 60 || sysVal > 250) {
      validationErrors.push("Systolic BP must be between 60-250 mmHg");
    }
  }
  if (diastolic && diastolic.trim() !== '') {
    const diaVal = parseInt(diastolic);
    if (isNaN(diaVal) || diaVal < 40 || diaVal > 150) {
      validationErrors.push("Diastolic BP must be between 40-150 mmHg");
    }
  }
  if (o2sat && o2sat.trim() !== '') {
    const o2Val = parseFloat(o2sat);
    if (isNaN(o2Val) || o2Val < 70 || o2Val > 100) {
      validationErrors.push("O2 saturation must be between 70-100%");
    }
  }
  if (height && height.trim() !== '') {
    const heightVal = parseFloat(height);
    if (isNaN(heightVal) || heightVal < 30 || heightVal > 250) {
      validationErrors.push("Height must be between 30-250 cm");
    }
  }
  if (weight && weight.trim() !== '') {
    const weightVal = parseFloat(weight);
    if (isNaN(weightVal) || weightVal < 1 || weightVal > 300) {
      validationErrors.push("Weight must be between 1-300 kg");
    }
  }
  if (pain && pain.trim() !== '') {
    const painVal = parseInt(pain);
    if (isNaN(painVal) || painVal < 0 || painVal > 10) {
      validationErrors.push("Pain score must be between 0-10");
    }
  }
  
  // Show validation errors if any
  if (validationErrors.length > 0) {
    alert("Please correct the following errors:\n\n" + validationErrors.join("\n"));
    return;
  }
  
  // Check if at least 2 fields are filled
  const filledFields = [temp, hr, rr, systolic, diastolic, o2sat, height, weight, pain, notes].filter(v => v && v.trim() !== '');
  if (filledFields.length < 2) {
    alert("Please enter at least two vital signs values.");
    return;
  }
  
  // Find the visit - handle case where visits might be undefined
  if (!patient.visits) {
    patient.visits = [];
  }
  let visit = patient.visits.find(v => v.date === visitDate);
  if (!visit) {
    // Create a new visit if it doesn't exist
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    visit = {
      date: visitDate,
      symptoms: '',
      diagnosis: '',
      prescription: '',
      createdBy: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        org: user.org
      },
      soap: {
        subjective: {},
        objective: {},
        assessment: {},
        plan: {}
      }
    };
    patient.visits.push(visit);
  }
  
  // Initialize SOAP structure if it doesn't exist
  if (!visit.soap) {
    visit.soap = {};
  }
  if (!visit.soap.objective) {
    visit.soap.objective = {};
  }
  if (!visit.soap.objective.vitals) {
    visit.soap.objective.vitals = [];
  }
  
  // CRITICAL: Only allow one set of vitals per clinical note (per visit)
  if (visit.soap.objective.vitals && visit.soap.objective.vitals.length > 0) {
    alert("Vital signs have already been added for this visit. Please edit or delete the existing entry.");
    return;
  }
  
  // Calculate BMI if height and weight are provided
  let bmi = null;
  if (height && weight && height.trim() !== '' && weight.trim() !== '') {
    const heightInMeters = parseFloat(height) / 100; // Convert cm to meters
    const weightInKg = parseFloat(weight);
    if (!isNaN(heightInMeters) && !isNaN(weightInKg) && heightInMeters > 0 && weightInKg > 0) {
      bmi = parseFloat((weightInKg / (heightInMeters * heightInMeters)).toFixed(1));
      debugLog('🔍 addVitals: BMI calculated:', bmi, 'from height:', height, 'cm, weight:', weight, 'kg');
    }
  }
  
  // Create vital signs entry
  const vitalsEntry = {
    temp: temp || null,
    hr: hr || null,
    rr: rr || null,
    systolic: systolic || null,
    diastolic: diastolic || null,
    o2sat: o2sat || null,
    height: height || null,
    weight: weight || null,
    bmi: bmi,
    pain: pain || null,
    notes: notes || null,
    timestamp: new Date().toISOString(),
    visitDate: visitDate // Include visitDate for proper sorting/display
  };
  
  // Add to vitals array on patient object (same as other fields)
  patient.vitals = patient.vitals || [];
  patient.vitals.push(vitalsEntry);
  
  // Also add to visit.soap.objective.vitals for visit-specific storage
  // Preserve radiology data if it exists
  if (!visit.soap) {
    visit.soap = {};
  }
  if (!visit.soap.objective) {
    visit.soap.objective = {};
  }
  if (!visit.soap.objective.vitals) {
    visit.soap.objective.vitals = [];
  }
  visit.soap.objective.vitals.push(vitalsEntry);
  
  // CRITICAL: Update the patient in the patients array so it's saved to localStorage
  const patientIndex = patients.findIndex(p => 
    p.id === patient.id || 
    p.patient_id === patient.patient_id ||
    p._supabaseUuid === patient._supabaseUuid ||
    (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
  );
  if (patientIndex >= 0) {
    patients[patientIndex] = { ...patients[patientIndex], ...patient };
  } else {
    patients.push(patient);
  }
  
  // Save to Supabase first (primary), then localStorage (fallback)
  savePatientToSupabase(patient).then(async () => {
    // Save to localStorage as cache/fallback
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('✅ Vitals saved to Supabase patients table');
    
    // CRITICAL: Also save to clinical_notes table via saveClinicalNoteToSupabase
    // This ensures vitals persist in soap_data.objective.vitals
    if (typeof window.saveClinicalNoteToSupabase === 'function') {
      try {
        await window.saveClinicalNoteToSupabase(patient);
        console.log('✅ Vitals saved to clinical_notes table');
      } catch (error) {
        console.warn('⚠️ Failed to save vitals to clinical_notes table:', error);
      }
    }
    
    // Clear form fields
    document.getElementById("temp").value = "";
    document.getElementById("hr").value = "";
    document.getElementById("rr").value = "";
    document.getElementById("systolic").value = "";
    document.getElementById("diastolic").value = "";
    document.getElementById("o2sat").value = "";
    document.getElementById("height").value = "";
    document.getElementById("weight").value = "";
    document.getElementById("pain").value = "";
    document.getElementById("vitals-notes").value = "";
    
    // Hide form - Add button will be hidden by displayNoteVitals since vitals now exist
    const vitalsForm = document.getElementById("add-vitals-div");
    const showVitalsBtn = document.getElementById("show-vitals-form-btn");
    if (vitalsForm) vitalsForm.style.display = 'none';
    
    // CRITICAL: Hide Add button immediately after adding vitals
    if (showVitalsBtn) {
      showVitalsBtn.style.display = 'none';
      showVitalsBtn.style.setProperty('display', 'none', 'important'); // Force hide with !important
      debugLog('✅ addVitals: Add button hidden immediately');
    } else {
      console.error('❌ addVitals: showVitalsBtn not found!');
    }
    
    // Refresh the vitals display - this will hide the Add button since vitals exist
    // CRITICAL: Ensure we're passing the correct vitals array
    const vitalsToDisplay = visit.soap.objective.vitals || [];
    debugLog('🔍 addVitals: Displaying vitals, count:', vitalsToDisplay.length);
    displayNoteVitals(vitalsToDisplay);
    
    console.log("Vital signs added successfully");
  }).catch(error => {
    console.error('Failed to save vitals to Supabase, saving to localStorage only:', error);
    // Fallback to localStorage only if Supabase fails
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('Vitals saved to localStorage (Supabase unavailable)');
  
  // Clear form fields
  document.getElementById("temp").value = "";
  document.getElementById("hr").value = "";
  document.getElementById("rr").value = "";
  document.getElementById("systolic").value = "";
  document.getElementById("diastolic").value = "";
  document.getElementById("o2sat").value = "";
  document.getElementById("height").value = "";
  document.getElementById("weight").value = "";
  document.getElementById("pain").value = "";
  document.getElementById("vitals-notes").value = "";
  
    // Hide form
  const vitalsForm = document.getElementById("add-vitals-div");
  const showVitalsBtn = document.getElementById("show-vitals-form-btn");
  if (vitalsForm) vitalsForm.style.display = 'none';
  
    // Display the updated vitals table
  displayNoteVitals(visit.soap.objective.vitals);
  });
};

// Edit vital signs entry
window.editVitals = async function(index) {
  // editVitals called
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  
  if (!patientId || !visitDate) {
    alert("Missing patient ID or visit date");
    return;
  }
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (!patient) {
    alert("Patient not found");
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit || !visit.soap || !visit.soap.objective || !visit.soap.objective.vitals) {
    alert("Visit or vitals not found");
    return;
  }
  
  const vitalsEntry = visit.soap.objective.vitals[index];
  if (!vitalsEntry) {
    alert("Vital signs entry not found");
    return;
  }
  
  // Store the index and entry for later use when saving
  window._editingVitalsIndex = index;
  window._editingVitalsEntry = vitalsEntry;
  
  // Populate form fields with existing values
  document.getElementById("temp").value = vitalsEntry.temp || "";
  document.getElementById("hr").value = vitalsEntry.hr || "";
  document.getElementById("rr").value = vitalsEntry.rr || "";
  document.getElementById("systolic").value = vitalsEntry.systolic || "";
  document.getElementById("diastolic").value = vitalsEntry.diastolic || "";
  document.getElementById("o2sat").value = vitalsEntry.o2sat || "";
  document.getElementById("height").value = vitalsEntry.height || "";
  const weightDisplay = (typeof window.getWeightForInputDisplay === 'function') ? window.getWeightForInputDisplay(vitalsEntry.weight) : vitalsEntry.weight;
  document.getElementById("weight").value = weightDisplay !== undefined && weightDisplay !== null && weightDisplay !== '' ? weightDisplay : "";
  document.getElementById("pain").value = vitalsEntry.pain || "";
  document.getElementById("vitals-notes").value = vitalsEntry.notes || "";
  
  // Show the form and hide the Add button
  const vitalsForm = document.getElementById("add-vitals-div");
  const showVitalsBtn = document.getElementById("show-vitals-form-btn");
  const vitalsBtn = document.getElementById("vitals-btn");
  
  if (vitalsForm) vitalsForm.style.display = 'block';
  if (showVitalsBtn) showVitalsBtn.style.display = 'none';
  if (typeof window.updateClinicalWeightConfig === 'function') window.updateClinicalWeightConfig();
  
  // Change button text to "Update" instead of "Add"
  if (vitalsBtn) {
    vitalsBtn.textContent = 'Update';
    vitalsBtn.onclick = function() { updateVitals(); };
  }
  
  console.log("Vital signs entry loaded for editing");
};

// Update vital signs entry (called when editing)
window.updateVitals = async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  
  if (!patientId || !visitDate) {
    alert("Missing patient ID or visit date");
    return;
  }
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
  }
  
  // Load patients array for saving
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (!patient) {
    alert("Patient not found");
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit || !visit.soap || !visit.soap.objective || !visit.soap.objective.vitals) {
    alert("Visit or vitals not found");
    return;
  }
  
  // Get updated values from form
  const temp = document.getElementById("temp").value;
  const hr = document.getElementById("hr").value;
  const rr = document.getElementById("rr").value;
  const systolic = document.getElementById("systolic").value;
  const diastolic = document.getElementById("diastolic").value;
  const o2sat = document.getElementById("o2sat").value;
  const height = document.getElementById("height").value;
  const weightRaw = document.getElementById("weight").value;
  const weightKg = (weightRaw && typeof window.parseWeightInputToKg === 'function') ? window.parseWeightInputToKg(weightRaw) : (weightRaw ? parseFloat(weightRaw) : null);
  const weight = (weightKg != null ? String(weightKg) : null);
  const pain = document.getElementById("pain").value;
  const notes = document.getElementById("vitals-notes").value;
  
  // Validate vital signs ranges (same as inpatient dashboard)
  const validationErrors = [];
  if (temp && temp.trim() !== '') {
    const tempVal = parseFloat(temp);
    if (isNaN(tempVal) || tempVal < 30 || tempVal > 45) {
      validationErrors.push("Temperature must be between 30-45°C");
    }
  }
  if (hr && hr.trim() !== '') {
    const hrVal = parseInt(hr);
    if (isNaN(hrVal) || hrVal < 30 || hrVal > 200) {
      validationErrors.push("Heart rate must be between 30-200 bpm");
    }
  }
  if (rr && rr.trim() !== '') {
    const rrVal = parseInt(rr);
    if (isNaN(rrVal) || rrVal < 8 || rrVal > 40) {
      validationErrors.push("Respiratory rate must be between 8-40 breaths/min");
    }
  }
  if (systolic && systolic.trim() !== '') {
    const sysVal = parseInt(systolic);
    if (isNaN(sysVal) || sysVal < 60 || sysVal > 250) {
      validationErrors.push("Systolic BP must be between 60-250 mmHg");
    }
  }
  if (diastolic && diastolic.trim() !== '') {
    const diaVal = parseInt(diastolic);
    if (isNaN(diaVal) || diaVal < 40 || diaVal > 150) {
      validationErrors.push("Diastolic BP must be between 40-150 mmHg");
    }
  }
  if (o2sat && o2sat.trim() !== '') {
    const o2Val = parseFloat(o2sat);
    if (isNaN(o2Val) || o2Val < 70 || o2Val > 100) {
      validationErrors.push("O2 saturation must be between 70-100%");
    }
  }
  if (height && height.trim() !== '') {
    const heightVal = parseFloat(height);
    if (isNaN(heightVal) || heightVal < 30 || heightVal > 250) {
      validationErrors.push("Height must be between 30-250 cm");
    }
  }
  if (weight && weight.trim() !== '') {
    const weightVal = parseFloat(weight);
    if (isNaN(weightVal) || weightVal < 1 || weightVal > 300) {
      validationErrors.push("Weight must be between 1-300 kg");
    }
  }
  if (pain && pain.trim() !== '') {
    const painVal = parseInt(pain);
    if (isNaN(painVal) || painVal < 0 || painVal > 10) {
      validationErrors.push("Pain score must be between 0-10");
    }
  }
  
  // Show validation errors if any
  if (validationErrors.length > 0) {
    alert("Please correct the following errors:\n\n" + validationErrors.join("\n"));
    return;
  }
  
  // Check if at least 2 fields are filled
  const filledFields = [temp, hr, rr, systolic, diastolic, o2sat, height, weight, pain, notes].filter(v => v && v.trim() !== '');
  if (filledFields.length < 2) {
    alert("Please enter at least two vital signs values.");
    return;
  }
  
  // Calculate BMI if height and weight are provided
  let bmi = null;
  if (height && weight && height.trim() !== '' && weight.trim() !== '') {
    const heightInMeters = parseFloat(height) / 100; // Convert cm to meters
    const weightInKg = parseFloat(weight);
    if (!isNaN(heightInMeters) && !isNaN(weightInKg) && heightInMeters > 0 && weightInKg > 0) {
      bmi = parseFloat((weightInKg / (heightInMeters * heightInMeters)).toFixed(1));
      console.log('🔍 updateVitals: BMI calculated:', bmi, 'from height:', height, 'cm, weight:', weight, 'kg');
    }
  }
  
  // Update the existing entry
  const editIndex = window._editingVitalsIndex;
  if (editIndex !== undefined && editIndex >= 0 && editIndex < visit.soap.objective.vitals.length) {
    const updatedEntry = {
      temp: temp || null,
      hr: hr || null,
      rr: rr || null,
      systolic: systolic || null,
      diastolic: diastolic || null,
      o2sat: o2sat || null,
      height: height || null,
      weight: weight || null,
      bmi: bmi,
      pain: pain || null,
      notes: notes || null,
      timestamp: visit.soap.objective.vitals[editIndex].timestamp || new Date().toISOString(),
      visitDate: visitDate
    };
    
    // Update in visit vitals
    visit.soap.objective.vitals[editIndex] = updatedEntry;
    
    // Also update in patient.vitals array if it exists
    if (patient.vitals && Array.isArray(patient.vitals) && visit.soap.objective.vitals[editIndex].timestamp) {
      const vitalsIndex = patient.vitals.findIndex(v => v.timestamp === visit.soap.objective.vitals[editIndex].timestamp);
    if (vitalsIndex !== -1) {
        patient.vitals[vitalsIndex] = updatedEntry;
      }
    }
  }
  
  // Update patient in patients array
  const patientIndex = patients.findIndex(p => 
    p.id === patient.id || 
    p.patient_id === patient.patient_id ||
    p._supabaseUuid === patient._supabaseUuid ||
    (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
  );
  if (patientIndex >= 0) {
    patients[patientIndex] = { ...patients[patientIndex], ...patient };
  } else {
    patients.push(patient);
  }
  
  // Save to Supabase first (primary), then localStorage (fallback)
  savePatientToSupabase(patient).then(async () => {
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('✅ Vitals updated in Supabase and localStorage');
    
    // CRITICAL: Also save to clinical_notes table via saveClinicalNoteToSupabase
    if (typeof window.saveClinicalNoteToSupabase === 'function') {
      try {
        await window.saveClinicalNoteToSupabase(patient);
        console.log('✅ Updated vitals saved to clinical_notes table');
      } catch (error) {
        console.warn('⚠️ Failed to save updated vitals to clinical_notes table:', error);
      }
    }
    
    // Clear form fields
    document.getElementById("temp").value = "";
    document.getElementById("hr").value = "";
    document.getElementById("rr").value = "";
    document.getElementById("systolic").value = "";
    document.getElementById("diastolic").value = "";
    document.getElementById("o2sat").value = "";
    document.getElementById("height").value = "";
    document.getElementById("weight").value = "";
    document.getElementById("pain").value = "";
    document.getElementById("vitals-notes").value = "";
    
    // Hide form
    const vitalsForm = document.getElementById("add-vitals-div");
    const vitalsBtn = document.getElementById("vitals-btn");
    if (vitalsForm) vitalsForm.style.display = 'none';
    if (vitalsBtn) {
      vitalsBtn.textContent = 'Add';
      vitalsBtn.onclick = function() { addVitals(); };
    }
    
    // Clear editing state
    window._editingVitalsIndex = undefined;
    window._editingVitalsEntry = undefined;
    
    // Refresh display
    displayNoteVitals(visit.soap.objective.vitals);
  }).catch(error => {
    console.error('Failed to update vitals in Supabase, saving to localStorage only:', error);
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    
    // Clear form fields
    document.getElementById("temp").value = "";
    document.getElementById("hr").value = "";
    document.getElementById("rr").value = "";
    document.getElementById("systolic").value = "";
    document.getElementById("diastolic").value = "";
    document.getElementById("o2sat").value = "";
    document.getElementById("height").value = "";
    document.getElementById("weight").value = "";
    document.getElementById("pain").value = "";
    document.getElementById("vitals-notes").value = "";
    
    // Hide form
    const vitalsForm = document.getElementById("add-vitals-div");
    const vitalsBtn = document.getElementById("vitals-btn");
    if (vitalsForm) vitalsForm.style.display = 'none';
    if (vitalsBtn) {
      vitalsBtn.textContent = 'Add';
      vitalsBtn.onclick = function() { addVitals(); };
    }
    
    // Clear editing state
    window._editingVitalsIndex = undefined;
    window._editingVitalsEntry = undefined;
    
    // Refresh display
    displayNoteVitals(visit.soap.objective.vitals);
  });
  
  console.log("Vital signs updated successfully");
};

// Cancel vital signs form
window.cancelVitalsForm = function() {
  // Clear form fields
  document.getElementById("temp").value = "";
  document.getElementById("hr").value = "";
  document.getElementById("rr").value = "";
  document.getElementById("systolic").value = "";
  document.getElementById("diastolic").value = "";
  document.getElementById("o2sat").value = "";
  document.getElementById("height").value = "";
  document.getElementById("weight").value = "";
  document.getElementById("pain").value = "";
  document.getElementById("vitals-notes").value = "";
  
  // Hide form
  const vitalsForm = document.getElementById("add-vitals-div");
  const showVitalsBtn = document.getElementById("show-vitals-form-btn");
  const vitalsBtn = document.getElementById("vitals-btn");
  
  if (vitalsForm) vitalsForm.style.display = 'none';
  if (showVitalsBtn) showVitalsBtn.style.display = 'inline-block';
  
  // Reset button text and onclick if it was in edit mode
  if (vitalsBtn) {
    vitalsBtn.textContent = 'Add';
    vitalsBtn.onclick = function() { addVitals(); };
  }
  
  // Clear editing state
  window._editingVitalsIndex = undefined;
  window._editingVitalsEntry = undefined;
};

// Delete vital signs entry
window.deleteVitals = async function(index) {
  if (!confirm("Are you sure you want to delete this vital signs entry?")) {
    return;
  }
  
  // deleteVitals called
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  
  if (!patientId || !visitDate) {
    alert("Missing patient ID or visit date");
    return;
  }
  
  // Use resolvePatientByIdentifier to handle both UUID and display ID lookups
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(patientId);
  } else {
    // Fallback: Try to find patient manually
    let patients = [];
    try {
      if (typeof window.loadPatientsWithSupabasePriority === 'function') {
        patients = await window.loadPatientsWithSupabasePriority();
      } else {
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } catch (error) {
      console.warn('Error loading patients, using localStorage fallback:', error);
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
  }
  
  // Load patients array for saving (needed later)
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  if (!patient) {
    alert("Patient not found");
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit || !visit.soap || !visit.soap.objective || !visit.soap.objective.vitals) {
    alert("Visit or vitals not found");
    return;
  }
  
  // Also remove from patient.vitals array if it exists
  if (patient.vitals && Array.isArray(patient.vitals)) {
    const deletedEntry = visit.soap.objective.vitals[index];
    if (deletedEntry && deletedEntry.timestamp) {
      const vitalsIndex = patient.vitals.findIndex(v => v.timestamp === deletedEntry.timestamp);
      if (vitalsIndex !== -1) {
        patient.vitals.splice(vitalsIndex, 1);
      }
    }
  }
  
  // Remove the entry from visit vitals
  const deletedEntry = visit.soap.objective.vitals[index];
  visit.soap.objective.vitals.splice(index, 1);
  
  // CRITICAL: Update the patient in the patients array so it's saved to localStorage
  const patientIndex = patients.findIndex(p => 
    p.id === patient.id || 
    p.patient_id === patient.patient_id ||
    p._supabaseUuid === patient._supabaseUuid ||
    (patient._supabaseUuid && p._supabaseUuid === patient._supabaseUuid)
  );
  if (patientIndex >= 0) {
    patients[patientIndex] = { ...patients[patientIndex], ...patient };
  } else {
    patients.push(patient);
  }
  
  // HYBRID ARCHITECTURE: Save to Supabase first (primary), then localStorage (fallback)
  savePatientToSupabase(patient).then(async () => {
    // Save to localStorage as cache/fallback
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('✅ Vitals entry deleted from Supabase patients table');
    
    // CRITICAL: Also save to clinical_notes table via saveClinicalNoteToSupabase
    // This ensures vitals deletion persists in soap_data.objective.vitals
    if (typeof window.saveClinicalNoteToSupabase === 'function') {
      try {
        await window.saveClinicalNoteToSupabase(patient);
        console.log('✅ Vitals deletion saved to clinical_notes table');
      } catch (error) {
        console.warn('⚠️ Failed to save vitals deletion to clinical_notes table:', error);
      }
    }
    
    // Refresh display - this will show Add button if no vitals remain
    displayNoteVitals(visit.soap.objective.vitals || []);
    
    // Trigger custom event for real-time sync
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'vitalsDeleted', data: { visitDate, deletedEntry } }
    }));
  }).catch(error => {
    console.error('Failed to delete vitals from Supabase, saving to localStorage only:', error);
    // Fallback to localStorage only if Supabase fails
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log('Vitals entry deleted from localStorage (Supabase unavailable)');
    
    // Refresh display - this will show Add button if no vitals remain
    displayNoteVitals(visit.soap.objective.vitals || []);
    
    // Trigger custom event for real-time sync
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId, action: 'vitalsDeleted', data: { visitDate, deletedEntry } }
    }));
  });
};

// Auto-add pending vitals entry
function autoAddPendingVitals() {
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const vitalsFields = [
    'temp', 'hr', 'rr', 'systolic', 'diastolic', 'o2sat', 
    'height', 'weight', 'pain', 'vitals-notes'
  ];
  const fields = vitalsFields.map(id => document.getElementById(id));
  const filledFields = fields.filter(field => field && field.value.trim() !== '');
  
  if (filledFields.length >= 2) {
    debugLog('Auto-adding pending vitals entry');
    addVitals();
  }
}

/** Drop null / non-object slots so .filter / .map never throw (corrupt JSON arrays). */
function compactPatientListEntries(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(p => p != null && typeof p === 'object');
}

/** Visible recovery if note load throws—does not delete data. */
function showClinicalNoteLoadFailureBanner(err) {
  const id = 'clinical-note-load-failure-banner';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'alert');
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;padding:12px 16px;background:#721c24;color:#fff;font-size:14px;text-align:center;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2);';
    if (document.body) document.body.insertBefore(el, document.body.firstChild);
    else document.documentElement.appendChild(el);
  }
  const msg = err && err.message ? String(err.message) : 'Unknown error';
  el.innerHTML =
    '<strong>Note could not finish loading.</strong> Your chart data was not deleted. Try a hard refresh (Ctrl+Shift+R). If this persists, check the console. Technical detail: <code style="opacity:.9">' +
    msg.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
    '</code>';
}

window.showClinicalNoteLoadFailureBanner = showClinicalNoteLoadFailureBanner;
window.compactPatientListEntries = compactPatientListEntries;

// Load clinical note form
async function loadClinicalNote() {
  try {
  const debugLog = window.__DEBUG_LOGS ? console.log : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn : () => {};

  debugWarn('🔍 [loadClinicalNote] START - Function called');
  
  // Get patient identifier and visit date to check if we're loading a different note
  const urlParams = new URLSearchParams(window.location.search);
  let currentPatientIdentifier =
    typeof window.getPatientIdFromUrl === 'function'
      ? window.getPatientIdFromUrl(urlParams)
      : urlParams.get('patientId') || urlParams.get('patient_id') || urlParams.get('id');
  if (typeof window.ensurePatientIdQueryParam === 'function') {
    window.ensurePatientIdQueryParam();
  }
  debugWarn('🔍 [loadClinicalNote] URL params - patientId:', currentPatientIdentifier, 'visitDate:', urlParams.get("visitDate"));
  const currentVisitDate = urlParams.get("visitDate");
  
  // CRITICAL FIX: If URL has UUID, resolve to legacy ID and redirect for consistency
  if (currentPatientIdentifier && isUuidLike(currentPatientIdentifier)) {
    // It's a UUID, resolve to legacy ID and redirect
    if (typeof window.normalizePatientIdForUrl === 'function') {
      try {
        const legacyId = await window.normalizePatientIdForUrl(currentPatientIdentifier);
        if (legacyId && legacyId !== 'Unknown ID' && !isUuidLike(legacyId)) {
          // Redirect to legacy ID URL for consistency
          const newUrl = new URL(window.location);
          newUrl.searchParams.set('patientId', legacyId);
          window.history.replaceState({}, '', newUrl);
          currentPatientIdentifier = legacyId; // Use legacy ID going forward
          debugLog('✅ URL normalized: UUID -> Legacy ID:', legacyId);
        }
      } catch (error) {
        debugWarn('Could not normalize UUID to legacy ID, continuing with UUID:', error);
      }
    } else if (typeof window.resolvePatientByIdentifier === 'function') {
      try {
        const patient = await window.resolvePatientByIdentifier(currentPatientIdentifier);
        if (patient) {
          const legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id);
          if (legacyId && legacyId !== 'Unknown ID' && !isUuidLike(legacyId)) {
            // Redirect to legacy ID URL for consistency
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('patientId', legacyId);
            window.history.replaceState({}, '', newUrl);
            currentPatientIdentifier = legacyId; // Use legacy ID going forward
            debugLog('✅ URL normalized: UUID -> Legacy ID:', legacyId);
          }
        }
      } catch (error) {
        debugWarn('Could not resolve UUID to legacy ID, continuing with UUID:', error);
      }
    }
  }
  
  // Check if radiology template is active - if so, don't load SOAP form
  const radiologyTemplate = document.getElementById('radiology-template');
  if (radiologyTemplate && radiologyTemplate.style.display !== 'none') {
    debugLog("Radiology template is active, skipping SOAP form load");
    return;
  }
  
  // Check if we should skip form loading to preserve user input
  if (window._skipFormReload) {
    debugLog("Skipping form reload to preserve user input");
    window._skipFormReload = false;
    return;
  }
  
  // Always allow form reload when page loads (user might be returning to page)
  // Reset _formLoaded flag on page load to ensure data is loaded
  if (window._shouldReloadForm) {
    window._formLoaded = false; // Reset to allow reload
    window._shouldReloadForm = false;
  }
  
  // Check if form is already loaded for the SAME patient and visit date
  // If patient or visit date changed, we MUST reload
  const isSameNote = window._formLoaded && 
                     window._lastLoadedPatientId === currentPatientIdentifier && 
                     window._lastLoadedVisitDate === currentVisitDate &&
                     !window._shouldReloadForm;
  
  // CRITICAL: Always reload when navigating back from another page (check referrer)
  const isNavigatingBack = document.referrer && (
    document.referrer.includes('select-lab-orders') ||
    document.referrer.includes('select-imaging-orders') ||
    document.referrer.includes('select-referrals') ||
    document.referrer.includes('prescription')
  );
  
  if (isSameNote && !isNavigatingBack) {
    console.warn("[PERSISTENCE] Form already loaded for this patient/visit, skipping to preserve user input");
    return;
  }
  
  // CRITICAL: Don't reload if data was just saved (within last 3 seconds) - prevents overwriting user input
  // BUT: If navigating back, always reload to get latest data
  if (!isNavigatingBack && window._lastSaveTimestamp && (Date.now() - window._lastSaveTimestamp < 3000)) {
    console.warn(`[PERSISTENCE] Skipping form reload - data was just saved ${Date.now() - window._lastSaveTimestamp}ms ago`);
    return;
  }
  
  if (isNavigatingBack) {
    console.warn("[PERSISTENCE] Navigating back from order/referral page - forcing form reload");
    // Clear form loaded flag to force reload
    window._formLoaded = false;
  }
  
  // Reset flags after checking
  window._formLoaded = true;
  window._shouldReloadForm = false;
  window._lastLoadedPatientId = currentPatientIdentifier;
  window._lastLoadedVisitDate = currentVisitDate;
  
  console.warn("[PERSISTENCE] Loading clinical note data into form fields...");
  
  // Temporarily disable auto-save during form loading
  window._skipAutoSave = true;
  
  // Clear cache to ensure fresh data
  window._patientsCache = null;
  window._saveTimeout = null;
  
  // patientIdentifier and visitDate already retrieved above
  const patientIdentifier = currentPatientIdentifier; // Can be UUID or patient ID (e.g., MEC006)
  const visitDate = currentVisitDate;
  
  // Define patientId early for use throughout the function - will be updated when patient is resolved
  let patientId = patientIdentifier;
  // Loading clinical note (patient ID and visit date removed for privacy)
  if (!patientIdentifier || !visitDate) {
    alert("No patient ID or visit date provided. Redirecting to patients list.");
    window.location.href = "/patients";
    return;
  }
  
  // Resolve patient identifier (UUID or patient ID) to patient object
  let patient = await resolvePatientByIdentifier(patientIdentifier);
  
  // VALIDATION: Ensure patient.id is always legacy ID, never UUID
  if (patient) {
    const isUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
    if (isUuid) {
      console.error('❌ CRITICAL: patient.id is a UUID after resolvePatientByIdentifier! This should never happen.');
      console.error('❌ patient.id:', patient.id, 'patient.patient_id:', patient.patient_id, 'patient._supabaseUuid:', patient._supabaseUuid);
      // Fix it: use patient_id or patientNumber if available
      if (patient.patient_id && !patient.patient_id.includes('-')) {
        console.warn('🔧 FIXING: Using patient.patient_id as patient.id:', patient.patient_id);
        patient.id = patient.patient_id;
      } else if (patient.patientNumber && !patient.patientNumber.includes('-')) {
        console.warn('🔧 FIXING: Using patient.patientNumber as patient.id:', patient.patientNumber);
        patient.id = patient.patientNumber;
      } else {
        console.error('❌ CRITICAL: Cannot fix patient.id - no valid legacy ID found!');
      }
    } else {
      console.log('✅ VALIDATION: patient.id is legacy ID format:', patient.id);
    }
  }
  
  // Fallback: If resolver didn't work, try direct lookup
  if (!patient) {
    // Use Supabase data loader if available, fallback to localStorage (same as loadPatientDetails)
    let patients = [];
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      try {
        console.log('Using Supabase data loader for clinical note...');
        patients = await window.loadPatientsWithSupabasePriority();
      } catch (error) {
        console.error('Supabase data loader failed, falling back to localStorage:', error);
        patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      }
    } else {
      console.log('Supabase data loader not available, using localStorage...');
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    patients = compactPatientListEntries(patients);
    // Patients loaded (data removed for privacy)
    // New migration: Set hasDiabetes to false if undefined for any patient
    let changed = false;
    patients = patients.map(p => {
      if (!p || typeof p !== 'object') return p;
      if (p.hasDiabetes === undefined) {
        p.hasDiabetes = false;
        changed = true;
      }
      return p;
    });
    if (changed) {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    }
    patient = patients.find(
      p =>
        p &&
        (p.id === patientIdentifier || p.patient_id === patientIdentifier || p.patientNumber === patientIdentifier)
    );
    
    // VALIDATION: Ensure patient.id is legacy ID if found from localStorage
    if (patient) {
      const isUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
      if (isUuid) {
        console.warn('⚠️ WARNING: patient.id from localStorage is UUID. Fixing to use patient_id or patientNumber.');
        if (patient.patient_id && !patient.patient_id.includes('-')) {
          console.warn('🔧 FIXING: Using patient.patient_id as patient.id:', patient.patient_id);
          patient.id = patient.patient_id;
        } else if (patient.patientNumber && !patient.patientNumber.includes('-')) {
          console.warn('🔧 FIXING: Using patient.patientNumber as patient.id:', patient.patientNumber);
          patient.id = patient.patientNumber;
        }
      }
    }
  }
  
  // VALIDATION: Final check before proceeding - ensure patient.id is always legacy ID
  if (patient && patient.id) {
    const isUuid = patient.id.includes('-') && patient.id.length === 36;
    if (isUuid) {
      console.error('❌ CRITICAL ERROR: patient.id is still UUID after all fixes! This indicates a bug in patient data structure.');
      console.error('❌ patient object:', { id: patient.id, patient_id: patient.patient_id, patientNumber: patient.patientNumber, _supabaseUuid: patient._supabaseUuid });
      // Last resort: Try to generate temporary ID from UUID if available
      if (patient._supabaseUuid && patient._supabaseUuid.includes('-')) {
        const uuidDigits = patient._supabaseUuid.replace(/-/g, '').substring(28, 32).toUpperCase();
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const orgId = user.organizationId || user.organization_id;
        let orgPrefix = 'MEC';
        
        // Try to get org prefix synchronously from localStorage
        if (orgId) {
          try {
            const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
            const orgData = Object.values(orgs).find(org => org.id === orgId);
            if (orgData?.name) {
              orgPrefix = orgData.name.substring(0, 3).toUpperCase();
            }
          } catch (e) {
            // Use default MEC prefix
          }
        }
        
        patient.id = `${orgPrefix}${uuidDigits}`;
        console.warn('🔧 LAST RESORT FIX: Generated temporary ID from UUID:', patient.id);
      } else {
        // Fallback to patient_id or patientNumber, or set to Unknown ID
        patient.id = (patient.patient_id && !patient.patient_id.includes('-') ? patient.patient_id : null) ||
                     (patient.patientNumber && !patient.patientNumber.includes('-') ? patient.patientNumber : null) ||
                     'Unknown ID';
      console.warn('🔧 LAST RESORT FIX: Set patient.id to:', patient.id);
      }
    } else {
      console.log('✅ FINAL VALIDATION: patient.id is correctly set to legacy ID:', patient.id);
    }
  }
  
  // Supabase-first: If patient not found OR missing demographic data, query Supabase directly
  if ((!patient || !patient.patient_id || !patient.addressLine1 || !patient.maritalStatus) && typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
    try {
      console.log('Patient not found or missing demographics, querying Supabase directly...');
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const orgId = user.organizationId || (user.org ? JSON.parse(localStorage.getItem("organizations") || "{}")[user.org]?.id : null);
      
      if (orgId) {
        // Try by UUID first
        let { data: supabasePatient, error } = await window.supabaseClient
          .from('patients')
          .select('*')
          .eq('id', patientIdentifier)
          .eq('organization_id', orgId)
          .single();
        
        // If not found and identifier doesn't look like UUID, try by patient_id
        if (error && !patientIdentifier.includes('-')) {
          const { data: patientById, error: errorById } = await window.supabaseClient
            .from('patients')
            .select('*')
            .eq('patient_id', patientIdentifier)
            .eq('organization_id', orgId)
            .single();
          if (!errorById && patientById) {
            supabasePatient = patientById;
            error = null;
          }
        }
        
        if (!error && supabasePatient) {
          // Helper to safely parse JSON fields from Supabase
          const parseJSONField = (field, defaultValue = []) => {
            if (!field) return defaultValue;
            if (Array.isArray(field)) return field;
            if (typeof field === 'string') {
              try {
                const parsed = JSON.parse(field);
                return Array.isArray(parsed) ? parsed : defaultValue;
              } catch (e) {
                return defaultValue;
              }
            }
            return defaultValue;
          };
          
          // Convert Supabase format to localStorage format (complete conversion including all fields)
          // CRITICAL: Store UUID in _supabaseUuid, and use patient_id (display ID) for id field
          // NEVER use UUID as display ID - if patient_id doesn't exist, use a placeholder
          const displayId = supabasePatient.patient_id || 'Unknown ID';
          patient = {
            id: displayId, // ALWAYS use legacy ID, never UUID
            _supabaseUuid: supabasePatient.id, // Actual UUID for database operations
            patient_id: supabasePatient.patient_id,
            patientNumber: supabasePatient.patient_number,
            firstName: supabasePatient.first_name,
            middleName: supabasePatient.middle_name || '',
            lastName: supabasePatient.last_name,
            dob: supabasePatient.date_of_birth,
            phone: supabasePatient.phone,
            email: supabasePatient.email || '',
            address: supabasePatient.address || '',
            addressLine1: supabasePatient.address_line1 || supabasePatient.address || '',
            addressLine2: supabasePatient.address_line2 || '',
            city: supabasePatient.city || '',
            state: supabasePatient.state || '',
            country: supabasePatient.country || '',
            gender: supabasePatient.gender || 'Male',
            maritalStatus: supabasePatient.marital_status || '',
            race: supabasePatient.race || '',
            organizationId: supabasePatient.organization_id,
            medicalHistory: parseJSONField(supabasePatient.medical_history, []),
            diagnoses: parseJSONField(supabasePatient.diagnoses, []),
            immunizations: parseJSONField(supabasePatient.immunizations, []),
            allergies: parseJSONField(supabasePatient.allergies, []),
            vitals: parseJSONField(supabasePatient.vitals, []),
            medications: parseJSONField(supabasePatient.medications, []),
            visits: parseJSONField(supabasePatient.visits, []),
            prescriptions: parseJSONField(supabasePatient.prescriptions, []),
            hasDiabetes: supabasePatient.has_diabetes || false,
            // Emergency contact fields
            emergencyFirstName: supabasePatient.emergency_contact_name ? supabasePatient.emergency_contact_name.split(' ')[0] : '',
            emergencyLastName: supabasePatient.emergency_contact_name ? supabasePatient.emergency_contact_name.split(' ').slice(1).join(' ') : '',
            emergencyPhone: supabasePatient.emergency_contact_phone || '',
            emergencyEmail: supabasePatient.emergency_contact_email || '',
            emergencyRelationship: supabasePatient.emergency_contact_relationship || '',
            emergencyAddressLine1: supabasePatient.emergency_address_line1 || '',
            emergencyAddressLine2: supabasePatient.emergency_address_line2 || '',
            emergencyCity: supabasePatient.emergency_city || '',
            emergencyState: supabasePatient.emergency_state || '',
            emergencyCountry: supabasePatient.emergency_country || ''
          };
          
          // VALIDATION: Ensure patient.id is legacy ID before caching
          const isUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
          if (isUuid) {
            console.error('❌ CRITICAL: patient.id is UUID after Supabase direct query! This should not happen with the fix above.');
            patient.id = patient.patient_id || patient.patientNumber || 'Unknown ID';
            console.warn('🔧 FIXED: Set patient.id to:', patient.id);
          }
          
          // Add to patients array and cache to localStorage
          patients.push(patient);
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          console.log('✅ Patient loaded from Supabase and cached to localStorage with legacy ID:', patient.id);
        }
      }
    } catch (error) {
      console.error('Error querying Supabase for patient by ID:', error);
    }
  }
  
  if (!patient) {
    alert(`Patient not found with ID: ${patientIdentifier}. Please ensure the patient exists and the ID is correct.`);
    return;
  }
  // Ensure hasDiabetes is set if undefined for this patient
  if (patient.hasDiabetes === undefined) {
    patient.hasDiabetes = false;
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  }
  
  // Ensure all array fields exist and are arrays (handle JSON strings from Supabase)
  const ensureArray = (field, defaultValue = []) => {
    if (!field) return defaultValue;
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    }
    return defaultValue;
  };
  
  patient.medicalHistory = ensureArray(patient.medicalHistory, []);
  patient.diagnoses = ensureArray(patient.diagnoses, []);
  patient.immunizations = ensureArray(patient.immunizations, []);
  patient.allergies = ensureArray(patient.allergies, []);
  patient.vitals = ensureArray(patient.vitals, []);
  patient.medications = ensureArray(patient.medications, []);
  patient.visits = ensureArray(patient.visits, []);
  patient.prescriptions = ensureArray(patient.prescriptions, []);
  let visit = (patient.visits || []).find(v => v.date === visitDate);
  
  // CRITICAL DATA RECOVERY: If current visit has empty SOAP data, check multiple sources
  // 1. Check other visits in localStorage
  // 2. Check Supabase patients table visits JSON column
  let recoveredSoapData = null;
  const hasVisitSoap = visit && visit.soap;
  if (hasVisitSoap) {
    const currentSoap = visit.soap;
    const hasEmptyData = !currentSoap.subjective?.cc && !currentSoap.subjective?.hpi && 
                         !currentSoap.subjective?.fh && !currentSoap.subjective?.sh && 
                         !currentSoap.subjective?.ros;
    
    if (hasEmptyData && patient.visits && patient.visits.length > 0) {
      // Look for the most recent visit with SOAP data in localStorage
      const visitsWithData = patient.visits
        .filter(v => v.soap && (
          v.soap.subjective?.cc || v.soap.subjective?.hpi || v.soap.subjective?.fh ||
          v.soap.subjective?.sh || v.soap.subjective?.ros
        ))
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first
      
      if (visitsWithData.length > 0) {
        recoveredSoapData = visitsWithData[0].soap;
        console.warn('🔍 [DATA RECOVERY] Found SOAP data in localStorage visit:', visitsWithData[0].date, '- Attempting recovery');
      }
    }

    // CRITICAL: Check localStorage for the same patient stored under a different identifier
    if (!recoveredSoapData && hasEmptyData) {
      const allPatients = compactPatientListEntries(
        JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]")
      );
      const candidateIds = new Set([
        patient.id,
        patient.patient_id,
        patient.patientNumber,
        patient._supabaseUuid
      ].filter(Boolean));

      const matchingPatients = allPatients.filter(p => p && (
        candidateIds.has(p.id) ||
        candidateIds.has(p.patient_id) ||
        candidateIds.has(p.patientNumber) ||
        candidateIds.has(p._supabaseUuid)
      ));

      const matchingVisits = matchingPatients
        .flatMap(p => (p.visits || []).map(v => ({ visit: v, owner: p })))
        .filter(({ visit }) => visit?.date === visitDate && visit.soap && (
          visit.soap.subjective?.cc || visit.soap.subjective?.hpi || visit.soap.subjective?.fh ||
          visit.soap.subjective?.sh || visit.soap.subjective?.ros
        ));

      if (matchingVisits.length > 0) {
        const bestMatch = matchingVisits.sort((a, b) => {
          const aScore = [a.visit.soap.subjective?.cc, a.visit.soap.subjective?.hpi, a.visit.soap.subjective?.fh, a.visit.soap.subjective?.sh, a.visit.soap.subjective?.ros]
            .filter(Boolean).length;
          const bScore = [b.visit.soap.subjective?.cc, b.visit.soap.subjective?.hpi, b.visit.soap.subjective?.fh, b.visit.soap.subjective?.sh, b.visit.soap.subjective?.ros]
            .filter(Boolean).length;
          return bScore - aScore;
        })[0];

        recoveredSoapData = bestMatch.visit.soap;
        console.warn('🔍 [DATA RECOVERY] Found SOAP data in localStorage under alternate identifier for visit:', visitDate);
      }
    }
    
    // CRITICAL: Also check Supabase patients table visits JSON column if localStorage is empty
    const allowVisitsRecovery = window.__DEBUG_LOGS === true || localStorage.getItem('enableVisitsRecovery') === 'true';
    if (!recoveredSoapData && hasEmptyData && window.supabaseClient && allowVisitsRecovery) {
      try {
        if (localStorage.getItem('patients_visits_column_missing') === 'true') {
          throw new Error('visits column missing (cached)');
        }
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        let orgId = user.organizationId || user.organization_id || user.org;
        if (orgId && !orgId.includes('-')) {
          orgId = '576522cc-e769-4fb4-9487-3d150857d970';
        }
        if (!orgId) {
          orgId = '576522cc-e769-4fb4-9487-3d150857d970';
        }
        
        const queryPatientId = patient._supabaseUuid || patient.id;
        let supabasePatient = null;
        let error = null;
        const idResult = await window.supabaseClient
          .from('patients')
          .select('visits')
          .eq('id', queryPatientId)
          .eq('organization_id', orgId)
          .maybeSingle();
        supabasePatient = idResult.data;
        error = idResult.error;

        if (!supabasePatient && (patient.patient_id || patient.id)) {
          const legacyId = patient.patient_id || patient.id;
          const legacyResult = await window.supabaseClient
            .from('patients')
            .select('visits')
            .eq('patient_id', legacyId)
            .eq('organization_id', orgId)
            .maybeSingle();
          if (legacyResult.data) {
            supabasePatient = legacyResult.data;
            error = legacyResult.error;
          }
        }

        if (error) {
          const msg = String(error?.message || '').toLowerCase();
          if (error?.code === '42703' || msg.includes('visits') || msg.includes('column')) {
            localStorage.setItem('patients_visits_column_missing', 'true');
            throw new Error('visits column missing');
          }
        }
        
        if (!error && supabasePatient && supabasePatient.visits) {
          const visits = typeof supabasePatient.visits === 'string' 
            ? JSON.parse(supabasePatient.visits) 
            : supabasePatient.visits;
          
          if (Array.isArray(visits) && visits.length > 0) {
            // Find visit with SOAP data
            const visitWithData = visits
              .filter(v => v.soap && (
                v.soap.subjective?.cc || v.soap.subjective?.hpi || v.soap.subjective?.fh ||
                v.soap.subjective?.sh || v.soap.subjective?.ros
              ))
              .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            
            if (visitWithData && visitWithData.soap) {
              recoveredSoapData = visitWithData.soap;
              console.warn('🔍 [DATA RECOVERY] Found SOAP data in Supabase patients.visits for visit:', visitWithData.date, '- Attempting recovery');
            }
          }
        }
      } catch (recoveryError) {
        if (window.__DEBUG_LOGS && String(recoveryError?.message || '').indexOf('visits column missing') === -1) {
          console.warn('[DATA RECOVERY] Error checking Supabase patients table:', recoveryError);
        }
      }
    }
  }
  
  if (!visit) {
    // CRITICAL: If visit is missing, attempt to recover from localStorage using alternate identifiers
    const allPatients = compactPatientListEntries(
      JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]")
    );
    const candidateIds = new Set([
      patient.id,
      patient.patient_id,
      patient.patientNumber,
      patient._supabaseUuid
    ].filter(Boolean));

    const matchingPatients = allPatients.filter(p => p && (
      candidateIds.has(p.id) ||
      candidateIds.has(p.patient_id) ||
      candidateIds.has(p.patientNumber) ||
      candidateIds.has(p._supabaseUuid)
    ));

    const matchingVisit = matchingPatients
      .flatMap(p => (p.visits || []).map(v => ({ visit: v, owner: p })))
      .find(({ visit }) => visit?.date === visitDate && visit.soap && (
        visit.soap.subjective?.cc || visit.soap.subjective?.hpi || visit.soap.subjective?.fh ||
        visit.soap.subjective?.sh || visit.soap.subjective?.ros
      ));

    if (matchingVisit?.visit?.soap) {
      recoveredSoapData = recoveredSoapData || matchingVisit.visit.soap;
      console.warn('🔍 [DATA RECOVERY] Restoring missing visit SOAP data from localStorage for date:', visitDate);
    }

    const user = JSON.parse(localStorage.getItem("user"));
    visit = {
      date: visitDate,
      symptoms: '',
      diagnosis: '',
      prescription: '',
      createdBy: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        org: user.org,
        orgAddressLine1: user.orgAddressLine1,
        orgAddressLine2: user.orgAddressLine2,
        orgCity: user.orgCity,
        orgState: user.orgState,
        orgCountry: user.orgCountry,
        orgPhone: user.orgPhone,
        email: user.email
      },
      soap: {
        subjective: {},
        objective: {},
        assessment: {},
        plan: {}
      }
    };
    // Ensure visits array exists before pushing
    if (!Array.isArray(patient.visits)) {
      patient.visits = [];
    }
    patient.visits.push(visit);
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  }
  
  // CRITICAL: Use recovered data if current visit is empty
  const soap = recoveredSoapData && !visit.soap?.subjective?.cc ? recoveredSoapData : visit.soap;
  if (recoveredSoapData && !visit.soap?.subjective?.cc) {
    console.warn('✅ [DATA RECOVERY] Using recovered SOAP data from another visit');
    // Merge recovered data into current visit
    if (!visit.soap) visit.soap = {};
    if (!visit.soap.subjective) visit.soap.subjective = {};
    if (!visit.soap.objective) visit.soap.objective = {};
    if (!visit.soap.assessment) visit.soap.assessment = {};
    if (!visit.soap.plan) visit.soap.plan = {};
    
    Object.assign(visit.soap.subjective, recoveredSoapData.subjective || {});
    Object.assign(visit.soap.objective, recoveredSoapData.objective || {});
    Object.assign(visit.soap.assessment, recoveredSoapData.assessment || {});
    Object.assign(visit.soap.plan, recoveredSoapData.plan || {});
    
    // Save recovered data back
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  }
  const user = JSON.parse(localStorage.getItem("user"));

  // Always load form values from saved data (overwrite any existing values)
  // This ensures data persists when user navigates away and returns
  const ccValue = soap.subjective?.cc || '';
  const hpiValue = soap.subjective?.hpi || '';
  const fhValue = soap.subjective?.fh || '';
  const shValue = soap.subjective?.sh || '';
  const rosValue = soap.subjective?.ros || '';
  const physicalValue = soap.objective?.physical || '';
  const labsValue = soap.objective?.labs || '';
  const differentialValue = soap.assessment?.differential || '';
  const statusValue = soap.assessment?.status || '';
  const medicationsValue = soap.plan?.medications || '';
  const treatmentsValue = soap.plan?.treatments || '';
  const testingValue = soap.plan?.testing || '';
  const educationValue = soap.plan?.education || '';
  const followupValue = soap.plan?.followup || soap.plan?.followUp || '';
  
  // TRACE LOG: Log what's being loaded (using console.warn so it's not filtered)
  console.warn('[PERSISTENCE] Loading saved freeform field values:', {
    cc: ccValue.substring(0, 50) + (ccValue.length > 50 ? '...' : ''),
    hpi: hpiValue.substring(0, 50) + (hpiValue.length > 50 ? '...' : ''),
    fh: fhValue.substring(0, 50) + (fhValue.length > 50 ? '...' : ''),
    sh: shValue.substring(0, 50) + (shValue.length > 50 ? '...' : ''),
    ros: rosValue.substring(0, 50) + (rosValue.length > 50 ? '...' : ''),
    physical: physicalValue.substring(0, 50) + (physicalValue.length > 50 ? '...' : ''),
    labs: labsValue.substring(0, 50) + (labsValue.length > 50 ? '...' : ''),
    status: statusValue.substring(0, 50) + (statusValue.length > 50 ? '...' : ''),
    treatments: treatmentsValue.substring(0, 50) + (treatmentsValue.length > 50 ? '...' : ''),
    testing: testingValue.substring(0, 50) + (testingValue.length > 50 ? '...' : ''),
    education: educationValue.substring(0, 50) + (educationValue.length > 50 ? '...' : ''),
    followup: followupValue.substring(0, 50) + (followupValue.length > 50 ? '...' : ''),
    patientId: patientId,
    visitDate: visitDate
  });
  
  // SUPABASE-FIRST: Load clinical note SOAP data from clinical_notes table FIRST (Supabase-first)
  await loadClinicalNoteSOAPFromSupabase(patient, visitDate);
  
  // CRITICAL: After Supabase SOAP load, patient object has been updated with SOAP data
  // Use patient object directly (has Supabase-loaded SOAP data) - don't reload from localStorage yet
  // We'll reload from localStorage after loadClinicalNoteDataFromSupabase to merge orders
  // But preserve the Supabase-loaded SOAP data
  let refreshedVisit = patient.visits ? patient.visits.find(v => v.date === visitDate) : null;
  if (!refreshedVisit && visit) {
    refreshedVisit = visit; // Fallback to original visit
  }
  
  // AFTER Supabase load, get the latest SOAP data (may have been updated by Supabase)
  // CRITICAL: If Supabase data is empty, fall back to localStorage data (for existing data that wasn't synced)
  const finalSoap = refreshedVisit && refreshedVisit.soap ? refreshedVisit.soap : soap;
  
  // CRITICAL: Check if form fields have user input (current values) - preserve user input over saved data
  // This prevents overwriting user input when loadClinicalNote runs while user is typing
  const currentCcValue = document.getElementById("cc")?.value || '';
  const currentHpiValue = document.getElementById("hpi")?.value || '';
  const currentPhysicalValue = document.getElementById("physical")?.value || '';
  const currentTreatmentsValue = document.getElementById("treatments")?.value || '';
  
  // Check if user has entered data in form fields (preserve user input)
  const formHasUserInput = currentCcValue || currentHpiValue || currentPhysicalValue || currentTreatmentsValue;
  
  // HYBRID ARCHITECTURE: Supabase-first - use Supabase data if query succeeded (even if empty)
  // Only check localStorage if Supabase query failed (error), not if Supabase returned empty data
  // Priority: User input > Supabase data (always, if query succeeded) > localStorage (only if Supabase query failed)
  
  // Check if localStorage has data that Supabase doesn't have (for one-time sync)
  const localStorageCc = (ccValue || '').trim();
  const localStorageHpi = (hpiValue || '').trim();
  const localStorageFh = (fhValue || '').trim();
  const localStorageSh = (shValue || '').trim();
  const localStorageRos = (rosValue || '').trim();
  const localStoragePhysical = (physicalValue || '').trim();
  const localStorageLabs = (labsValue || '').trim();
  const localStorageDifferential = (differentialValue || '').trim();
  const localStorageStatus = (statusValue || '').trim();
  const localStorageMedications = (medicationsValue || '').trim();
  const localStorageTreatments = (treatmentsValue || '').trim();
  const localStorageTesting = (testingValue || '').trim();
  const localStorageEducation = (educationValue || '').trim();
  const localStorageFollowup = (followupValue || '').trim();
  const localStorageHasRealData = localStorageCc || localStorageHpi || localStorageFh || localStorageSh || 
    localStorageRos || localStoragePhysical || localStorageLabs || localStorageDifferential || 
    localStorageStatus || localStorageMedications || localStorageTreatments || localStorageTesting || 
    localStorageEducation || localStorageFollowup;
  
  const supabaseCc = (finalSoap.subjective?.cc || '').trim();
  const supabaseHpi = (finalSoap.subjective?.hpi || '').trim();
  const supabaseFh = (finalSoap.subjective?.fh || '').trim();
  const supabaseSh = (finalSoap.subjective?.sh || '').trim();
  const supabaseRos = (finalSoap.subjective?.ros || '').trim();
  const supabasePhysical = (finalSoap.objective?.physical || '').trim();
  const supabaseLabs = (finalSoap.objective?.labs || '').trim();
  const supabaseDifferential = (finalSoap.assessment?.differential || '').trim();
  const supabaseStatus = (finalSoap.assessment?.status || '').trim();
  const supabaseMedications = (finalSoap.plan?.medications || '').trim();
  const supabaseTreatments = (finalSoap.plan?.treatments || '').trim();
  const supabaseTesting = (finalSoap.plan?.testing || '').trim();
  const supabaseEducation = (finalSoap.plan?.education || '').trim();
  const supabaseFollowup = (finalSoap.plan?.followup || finalSoap.plan?.followUp || '').trim();
  const supabaseHasRealData = supabaseCc || supabaseHpi || supabaseFh || supabaseSh || supabaseRos || 
    supabasePhysical || supabaseLabs || supabaseDifferential || supabaseStatus || 
    supabaseMedications || supabaseTreatments || supabaseTesting || supabaseEducation || supabaseFollowup;
  
  console.warn('[PERSISTENCE] Data source check (Supabase-first):', {
    supabaseQuerySucceeded: !!finalSoap,
    supabaseHasRealData,
    localStorageHasRealData,
    supabaseCc: supabaseCc.substring(0, 30),
    localStorageCc: localStorageCc.substring(0, 30),
    supabaseHpi: supabaseHpi.substring(0, 30),
    localStorageHpi: localStorageHpi.substring(0, 30)
  });
  
  // HYBRID ARCHITECTURE: Supabase-first, localStorage fallback
  // Priority: User input > Supabase (if has real data) > localStorage (if Supabase empty but localStorage has data) > Empty (if both are empty)
  // CRITICAL FIX: If Supabase has empty strings, treat it as "no data" and fall back to localStorage
  // This prevents empty Supabase records from blocking localStorage data
  const supabaseActuallyHasData = supabaseHasRealData && 
    (supabaseCc.length > 0 || supabaseHpi.length > 0 || supabaseFh.length > 0 || 
     supabaseSh.length > 0 || supabaseRos.length > 0);
  
  console.warn('[PERSISTENCE] Data source decision:', {
    supabaseQuerySucceeded: !!finalSoap,
    supabaseHasRealData,
    supabaseActuallyHasData,
    localStorageHasRealData,
    willUseSupabase: supabaseActuallyHasData,
    willUseLocalStorage: !supabaseActuallyHasData && localStorageHasRealData
  });
  
  const finalCcValue = formHasUserInput ? currentCcValue : 
    (supabaseActuallyHasData && supabaseCc ? supabaseCc : 
     (localStorageHasRealData && localStorageCc ? localStorageCc : 
      (ccValue || '')));
  const finalHpiValue = formHasUserInput ? currentHpiValue : 
    (supabaseActuallyHasData && supabaseHpi ? supabaseHpi : 
     (localStorageHasRealData && localStorageHpi ? localStorageHpi : 
      (hpiValue || '')));
  const finalFhValue = formHasUserInput ? (document.getElementById("fh")?.value || '') : 
    (supabaseActuallyHasData && supabaseFh ? supabaseFh : 
     (localStorageHasRealData && localStorageFh ? localStorageFh : 
      (fhValue || '')));
  const finalShValue = formHasUserInput ? (document.getElementById("sh")?.value || '') : 
    (supabaseActuallyHasData && supabaseSh ? supabaseSh : 
     (localStorageHasRealData && localStorageSh ? localStorageSh : 
      (shValue || '')));
  const finalRosValue = formHasUserInput ? (document.getElementById("ros")?.value || '') : 
    (supabaseActuallyHasData && supabaseRos ? supabaseRos : 
     (localStorageHasRealData && localStorageRos ? localStorageRos : 
      (rosValue || '')));
  const finalPhysicalValue = formHasUserInput ? currentPhysicalValue : 
    (supabaseActuallyHasData && supabasePhysical ? supabasePhysical : 
     (localStorageHasRealData && localStoragePhysical ? localStoragePhysical : 
      (physicalValue || '')));
  const finalLabsValue = formHasUserInput ? (document.getElementById("labs")?.value || '') : 
    (supabaseActuallyHasData && supabaseLabs ? supabaseLabs : 
     (localStorageHasRealData && localStorageLabs ? localStorageLabs : 
      (labsValue || '')));
  const finalDifferentialValue = formHasUserInput ? (document.getElementById("differential")?.value || '') : 
    (supabaseActuallyHasData && supabaseDifferential ? supabaseDifferential : 
     (localStorageHasRealData && localStorageDifferential ? localStorageDifferential : 
      (differentialValue || '')));
  const finalStatusValue = formHasUserInput ? (document.getElementById("status")?.value || '') : 
    (supabaseActuallyHasData && supabaseStatus ? supabaseStatus : 
     (localStorageHasRealData && localStorageStatus ? localStorageStatus : 
      (statusValue || '')));
  const finalMedicationsValue = formHasUserInput ? (document.getElementById("medications")?.value || '') : 
    (supabaseActuallyHasData && supabaseMedications ? supabaseMedications : 
     (localStorageHasRealData && localStorageMedications ? localStorageMedications : 
      (medicationsValue || '')));
  const finalTreatmentsValue = formHasUserInput ? currentTreatmentsValue : 
    (supabaseActuallyHasData && supabaseTreatments ? supabaseTreatments : 
     (localStorageHasRealData && localStorageTreatments ? localStorageTreatments : 
      (treatmentsValue || '')));
  const finalTestingValue = formHasUserInput ? (document.getElementById("testing")?.value || '') : 
    (supabaseActuallyHasData && supabaseTesting ? supabaseTesting : 
     (localStorageHasRealData && localStorageTesting ? localStorageTesting : 
      (testingValue || '')));
  const finalEducationValue = formHasUserInput ? (document.getElementById("education")?.value || '') : 
    (supabaseActuallyHasData && supabaseEducation ? supabaseEducation : 
     (localStorageHasRealData && localStorageEducation ? localStorageEducation : 
      (educationValue || '')));
  const finalFollowupValue = formHasUserInput ? (document.getElementById("followUp")?.value || document.getElementById("followup")?.value || '') : 
    (supabaseActuallyHasData && supabaseFollowup ? supabaseFollowup : 
     (localStorageHasRealData && localStorageFollowup ? localStorageFollowup : 
      (followupValue || '')));
  
  // CRITICAL: If localStorage has data but Supabase is empty, sync localStorage data to Supabase immediately
  // This is a one-time migration - after sync, Supabase will be the source of truth
  if (localStorageHasRealData && !supabaseHasRealData && finalSoap) {
    console.warn('[PERSISTENCE] ⚠️ localStorage has data but Supabase is empty - syncing to Supabase now');
    // Update the visit object with localStorage data so it gets saved to Supabase
    if (refreshedVisit && refreshedVisit.soap) {
      refreshedVisit.soap.subjective = refreshedVisit.soap.subjective || {};
      refreshedVisit.soap.objective = refreshedVisit.soap.objective || {};
      refreshedVisit.soap.assessment = refreshedVisit.soap.assessment || {};
      refreshedVisit.soap.plan = refreshedVisit.soap.plan || {};
      
      // Use localStorage values (they have the real data)
      refreshedVisit.soap.subjective.cc = localStorageCc || ccValue || '';
      refreshedVisit.soap.subjective.hpi = localStorageHpi || hpiValue || '';
      refreshedVisit.soap.subjective.fh = fhValue || '';
      refreshedVisit.soap.subjective.sh = shValue || '';
      refreshedVisit.soap.subjective.ros = rosValue || '';
      refreshedVisit.soap.objective.physical = localStoragePhysical || physicalValue || '';
      refreshedVisit.soap.objective.labs = labsValue || '';
      refreshedVisit.soap.assessment.differential = differentialValue || '';
      refreshedVisit.soap.assessment.status = statusValue || '';
      refreshedVisit.soap.plan.medications = medicationsValue || '';
      refreshedVisit.soap.plan.treatments = localStorageTreatments || treatmentsValue || '';
      refreshedVisit.soap.plan.testing = testingValue || '';
      refreshedVisit.soap.plan.education = educationValue || '';
      refreshedVisit.soap.plan.followup = followupValue || '';
      refreshedVisit.soap.plan.followUp = followupValue || '';
      
      // Update patient object
      const visitIndex = patient.visits ? patient.visits.findIndex(v => v.date === visitDate) : -1;
      if (visitIndex >= 0) {
        patient.visits[visitIndex] = refreshedVisit;
      }
      
      // Trigger immediate save to Supabase to sync localStorage data
      if (window.supabaseClient) {
        setTimeout(async () => {
          try {
            console.warn('[PERSISTENCE] 🔄 Syncing localStorage data to Supabase...');
            // Dispatch event to trigger save from clinical-note.html
            window.dispatchEvent(new CustomEvent('syncLocalStorageToSupabase', {
              detail: { patient: patient, visitDate: visitDate }
            }));
            // Also try direct call if function is available
            if (typeof window.saveClinicalNoteToSupabase === 'function') {
              await window.saveClinicalNoteToSupabase(patient);
            }
            console.warn('[PERSISTENCE] ✅ Successfully synced localStorage data to Supabase');
          } catch (error) {
            console.error('[PERSISTENCE] ❌ Failed to sync localStorage data to Supabase:', error);
          }
        }, 500); // Small delay to avoid blocking UI
      }
      
      // Update finalSoap with localStorage data for display (temporary, until Supabase sync completes)
      finalSoap.subjective = finalSoap.subjective || {};
      finalSoap.objective = finalSoap.objective || {};
      finalSoap.assessment = finalSoap.assessment || {};
      finalSoap.plan = finalSoap.plan || {};
      finalSoap.subjective.cc = localStorageCc || ccValue || '';
      finalSoap.subjective.hpi = localStorageHpi || hpiValue || '';
      finalSoap.subjective.fh = fhValue || '';
      finalSoap.subjective.sh = shValue || '';
      finalSoap.subjective.ros = rosValue || '';
      finalSoap.objective.physical = localStoragePhysical || physicalValue || '';
      finalSoap.objective.labs = labsValue || '';
      finalSoap.assessment.differential = differentialValue || '';
      finalSoap.assessment.status = statusValue || '';
      finalSoap.plan.medications = medicationsValue || '';
      finalSoap.plan.treatments = localStorageTreatments || treatmentsValue || '';
      finalSoap.plan.testing = testingValue || '';
      finalSoap.plan.education = educationValue || '';
      finalSoap.plan.followup = followupValue || '';
      finalSoap.plan.followUp = followupValue || '';
    }
  }
  
  // HYBRID ARCHITECTURE: Supabase-first for vitals
  // Use Supabase vitals if query succeeded (even if empty array)
  // Only use localStorage if Supabase query failed (error)
  let finalVitals = [];
  const supabaseVitals = finalSoap && finalSoap.objective ? finalSoap.objective.vitals : null;
  const localStorageVitals = visit && visit.soap && visit.soap.objective ? visit.soap.objective.vitals : null;
  
  const supabaseVitalsHasData = supabaseVitals && Array.isArray(supabaseVitals) && supabaseVitals.length > 0;
  const localStorageVitalsHasData = localStorageVitals && Array.isArray(localStorageVitals) && localStorageVitals.length > 0;
  
  // SUPABASE-FIRST: Use Supabase vitals if query succeeded (even if empty)
  if (finalSoap && finalSoap.objective) {
    // Supabase query succeeded - use Supabase vitals (even if empty array)
    finalVitals = Array.isArray(supabaseVitals) ? supabaseVitals : [];
    console.warn('[PERSISTENCE] Using Supabase vitals (Supabase-first):', finalVitals.length);
    
    // CRITICAL: If localStorage has vitals but Supabase doesn't, sync to Supabase
    if (localStorageVitalsHasData && !supabaseVitalsHasData) {
      console.warn('[PERSISTENCE] ⚠️ localStorage has vitals but Supabase is empty - syncing to Supabase');
      finalVitals = localStorageVitals; // Use localStorage temporarily
      
      // Update visit object and sync to Supabase
      if (refreshedVisit && refreshedVisit.soap && refreshedVisit.soap.objective) {
        refreshedVisit.soap.objective.vitals = finalVitals;
        finalSoap.objective.vitals = finalVitals; // Update finalSoap for display
        
        // Update patient object
        const visitIndex = patient.visits ? patient.visits.findIndex(v => v.date === visitDate) : -1;
        if (visitIndex >= 0) {
          patient.visits[visitIndex] = refreshedVisit;
        }
        
        // Trigger save to Supabase
        if (window.supabaseClient) {
          setTimeout(async () => {
            try {
              console.warn('[PERSISTENCE] 🔄 Syncing localStorage vitals to Supabase...');
              window.dispatchEvent(new CustomEvent('syncLocalStorageToSupabase', {
                detail: { patient: patient, visitDate: visitDate }
              }));
              if (typeof window.saveClinicalNoteToSupabase === 'function') {
                await window.saveClinicalNoteToSupabase(patient);
              }
              console.warn('[PERSISTENCE] ✅ Successfully synced localStorage vitals to Supabase');
            } catch (error) {
              console.error('[PERSISTENCE] ❌ Failed to sync localStorage vitals to Supabase:', error);
            }
          }, 500);
        }
      }
    }
  } else {
    // Supabase query failed - fallback to localStorage
    finalVitals = localStorageVitalsHasData ? localStorageVitals : [];
    console.warn('[PERSISTENCE] Using localStorage vitals (Supabase query failed, fallback):', finalVitals.length);
  }
  
  // TRACE LOG: Log what's being loaded (using console.warn so it's not filtered)
  console.warn('[PERSISTENCE] Loading saved freeform field values (after Supabase load):', {
    cc: finalCcValue.substring(0, 50) + (finalCcValue.length > 50 ? '...' : ''),
    hpi: finalHpiValue.substring(0, 50) + (finalHpiValue.length > 50 ? '...' : ''),
    fh: finalFhValue.substring(0, 50) + (finalFhValue.length > 50 ? '...' : ''),
    sh: finalShValue.substring(0, 50) + (finalShValue.length > 50 ? '...' : ''),
    ros: finalRosValue.substring(0, 50) + (finalRosValue.length > 50 ? '...' : ''),
    physical: finalPhysicalValue.substring(0, 50) + (finalPhysicalValue.length > 50 ? '...' : ''),
    labs: finalLabsValue.substring(0, 50) + (finalLabsValue.length > 50 ? '...' : ''),
    status: finalStatusValue.substring(0, 50) + (finalStatusValue.length > 50 ? '...' : ''),
    treatments: finalTreatmentsValue.substring(0, 50) + (finalTreatmentsValue.length > 50 ? '...' : ''),
    testing: finalTestingValue.substring(0, 50) + (finalTestingValue.length > 50 ? '...' : ''),
    education: finalEducationValue.substring(0, 50) + (finalEducationValue.length > 50 ? '...' : ''),
    followup: finalFollowupValue.substring(0, 50) + (finalFollowupValue.length > 50 ? '...' : ''),
    vitalsCount: finalVitals.length,
    patientId: patientId,
    visitDate: visitDate
  });
  
  // Load all form fields with final values (Supabase-first)
  // CRITICAL: Set values with retry logic to ensure they persist even if DOM manipulation happens
  const setFieldValue = (fieldId, value, retries = 3) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = value || '';
      // Force a reflow to ensure value is set
      field.offsetHeight;
      // Verify value was set
      if (field.value !== (value || '') && retries > 0) {
        if (window.__DEBUG_LOGS) {
          console.warn(`⚠️ [FIELD SET] Value mismatch for ${fieldId}, retrying... (${retries} retries left)`);
        }
        setTimeout(() => setFieldValue(fieldId, value, retries - 1), 100);
      }
      return;
    }

    if (retries > 0) {
      if (window.__DEBUG_LOGS) {
        console.warn(`⚠️ [FIELD SET] Field ${fieldId} not found, retrying... (${retries} retries left)`);
      }
      setTimeout(() => setFieldValue(fieldId, value, retries - 1), 200);
    }
  };
  
  // Set all freeform fields with retry logic
  setFieldValue("cc", finalCcValue);
  setFieldValue("hpi", finalHpiValue);
  setFieldValue("fh", finalFhValue);
  setFieldValue("sh", finalShValue);
  setFieldValue("ros", finalRosValue);
  
  // Set remaining fields with retry logic
  setFieldValue("physical", finalPhysicalValue);
  setFieldValue("labs", finalLabsValue);
  setFieldValue("differential", finalDifferentialValue);
  setFieldValue("status", finalStatusValue);
  setFieldValue("medications", finalMedicationsValue);
  setFieldValue("treatments", finalTreatmentsValue);
  setFieldValue("testing", finalTestingValue);
  setFieldValue("education", finalEducationValue);
  setFieldValue("followup", finalFollowupValue);
  setFieldValue("followUp", finalFollowupValue);
  
  // CRITICAL: Force a final check and set after a delay to catch any DOM manipulation
  setTimeout(() => {
    const finalCcField = document.getElementById("cc");
    const finalHpiField = document.getElementById("hpi");
    if (finalCcField && finalCcField.value !== finalCcValue) {
      if (window.__DEBUG_LOGS) {
        console.warn('⚠️ [FINAL CHECK] CC field value was changed, restoring:', finalCcValue);
      }
      finalCcField.value = finalCcValue;
    }
    if (finalHpiField && finalHpiField.value !== finalHpiValue) {
      if (window.__DEBUG_LOGS) {
        console.warn('⚠️ [FINAL CHECK] HPI field value was changed, restoring:', finalHpiValue);
      }
      finalHpiField.value = finalHpiValue;
    }
  }, 500);
  
  // CRITICAL: Display vitals AFTER Supabase data is loaded
  displayNoteVitals(finalVitals);
  
  console.warn('[PERSISTENCE] All freeform fields and vitals loaded into form (Supabase-first)');

  // Load clinical note data from Supabase if available
  await loadClinicalNoteDataFromSupabase(patient, visitDate);
  
  // CRITICAL: After Supabase load, patient object has been updated with Supabase data
  // Use patient object directly (has Supabase-loaded medicalHistory, diagnoses, allergies, medications, vitals)
  // Only reload from localStorage to merge orders, but preserve all Supabase-loaded clinical data
  const freshPatients = compactPatientListEntries(
    JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]")
  );
  const freshPatient = freshPatients.find(
    p =>
      p &&
      (p.id === patient.id ||
        p.patient_id === patient.patient_id ||
        p._supabaseUuid === patient._supabaseUuid)
  );
  
  // CRITICAL: Use patient object directly (has Supabase data) - don't overwrite with localStorage
  // Only merge orders from localStorage, but preserve all Supabase-loaded clinical data
  let patientDataToUse = patient; // Start with patient object (has Supabase data)
  
  // CRITICAL: Preserve Supabase-loaded clinical data before merging orders
  const supabaseMedicalHistory = patient.medicalHistory || [];
  const supabaseDiagnoses = patient.diagnoses || [];
  const supabaseAllergies = patient.allergies || [];
  const supabaseImmunizations = patient.immunizations || [];
  const supabasePatientMedications = patient.medications || [];
  const supabasePatientVitals = patient.vitals || [];
  
  if (freshPatient) {
    // Merge orders from fresh patient (localStorage) into patientDataToUse
    if (freshPatient.visits) {
      const freshVisit = freshPatient.visits.find(v => v.date === visitDate);
      if (freshVisit && freshVisit.orders) {
        if (!patientDataToUse.visits) {
          patientDataToUse.visits = [];
        }
        let targetVisit = patientDataToUse.visits.find(v => v.date === visitDate);
        if (!targetVisit) {
          targetVisit = { ...freshVisit };
          patientDataToUse.visits.push(targetVisit);
        } else {
          targetVisit.orders = freshVisit.orders;
        }
      }
    }
  }
  
  // CRITICAL: Restore Supabase-loaded clinical data (in case it was overwritten)
  patientDataToUse.medicalHistory = supabaseMedicalHistory;
  patientDataToUse.diagnoses = supabaseDiagnoses;
  patientDataToUse.allergies = supabaseAllergies;
  patientDataToUse.immunizations = supabaseImmunizations;
  patientDataToUse.medications = supabasePatientMedications;
  patientDataToUse.vitals = supabasePatientVitals;
  
  // CRITICAL: Ensure we're using the patient object that was updated by loadClinicalNoteDataFromSupabase
  // This ensures medicalHistory, diagnoses, allergies, medications, vitals from Supabase are used
  debugWarn('[PERSISTENCE] Displaying patient data (Supabase-first):', {
    medicalHistory: patientDataToUse.medicalHistory?.length || 0,
    diagnoses: patientDataToUse.diagnoses?.length || 0,
    allergies: patientDataToUse.allergies?.length || 0,
    immunizations: patientDataToUse.immunizations?.length || 0,
    medications: patientDataToUse.medications?.length || 0,
    vitals: patientDataToUse.vitals?.length || 0
  });
  
  // Load tables from patient data (use Supabase-loaded data)
  displayNoteHistory(patientDataToUse.medicalHistory || []);
  displayNoteDiagnoses(patientDataToUse.diagnoses || []);
  // Display patient-reported medications (historical)
  displayMedications(patientDataToUse.medications || []);
  displayNoteAllergies(patientDataToUse.allergies || []);
  displayNoteImmunizations(patientDataToUse.immunizations || []);
  
  // Load vitals from visit-specific data if available, otherwise from patient object
  // CRITICAL: Use refreshedVisit (has Supabase-loaded SOAP data) or fallback to patient.vitals
  let visitVitals = [];
  if (refreshedVisit && refreshedVisit.soap && refreshedVisit.soap.objective && refreshedVisit.soap.objective.vitals) {
    visitVitals = refreshedVisit.soap.objective.vitals;
    debugLog('🔍 loadClinicalNote: Loaded vitals from refreshedVisit.soap.objective.vitals:', visitVitals.length);
  } else if (patientDataToUse.vitals && Array.isArray(patientDataToUse.vitals)) {
    // Filter patient.vitals by visitDate
    visitVitals = visitDate ? patientDataToUse.vitals.filter(v => v.visitDate === visitDate) : patientDataToUse.vitals;
    debugLog('🔍 loadClinicalNote: Loaded vitals from patient.vitals (filtered by visitDate):', visitVitals.length);
  }
  // If no visit-scoped vitals found, fall back to any patient vitals to avoid empty table
  if ((!visitVitals || visitVitals.length === 0) && patientDataToUse.vitals && Array.isArray(patientDataToUse.vitals) && patientDataToUse.vitals.length > 0) {
    visitVitals = patientDataToUse.vitals;
    debugLog('🔍 loadClinicalNote: Fallback to patient.vitals (unfiltered):', visitVitals.length);
  }
  debugLog('🔍 loadClinicalNote: Final visitVitals to display:', visitVitals.length);
  displayNoteVitals(visitVitals);
  
  // Display generated orders and referrals (reload fresh data to ensure orders are shown)
  displayGeneratedOrders(patientDataToUse);
  // Only show referrals for the current visit
  displayGeneratedReferrals(patientDataToUse, visitDate);

  // Display preventive gaps
  if (typeof displayGaps === 'function') {
    await displayGaps(patientId, "preventive-gaps-list");
  }

  // Set title and metadata — canonical MRN for UI (maps legacy MIN → MFA-MC/MFA-SC)
  const displayPatientId =
    typeof window.patientMrnDisplay === 'function'
      ? window.patientMrnDisplay(patient, patientId)
      : getPatientIdentifier(patient) || patient.patient_id || patient.patientNumber || 'Unknown ID';
  
  document.getElementById("note-title").innerHTML = `Clinical Note for ${patient.firstName} ${patient.lastName} (ID: ${displayPatientId}) on ${visitDate}`;
  
  // Update metadata with organization name
  async function updateMetadataWithOrgName() {
  // console.log('🔧 TRACE: updateMetadataWithOrgName called');
    // Get organization ID - prioritize UUID fields over name
    let orgId = user.organizationId || user.organization_id;
    
    // If orgId is not set, try to get it from user.org
    if (!orgId && user.org) {
      // Check if user.org is a UUID or a name
      if (user.org.includes('-') && user.org.length > 30) {
        // It's a UUID
        orgId = user.org;
      } else {
        // It's a name - try to find the UUID
        if (user.org.toLowerCase().includes('mecure')) {
          orgId = '576522cc-e769-4fb4-9487-3d150857d970';
        }
      }
    }
    
    // Fallback: use known org ID if still not found
    if (!orgId) {
      orgId = '576522cc-e769-4fb4-9487-3d150857d970';
    }
    
    // Get organization name
    let orgName = 'Unknown Organization';
    
    // First, try to use the name directly if user.org is already a name
    if (user.org && !user.org.includes('-')) {
      orgName = user.org;
    } else if (typeof getOrganizationName === 'function' && window.supabaseClient) {
      // Try to fetch from Supabase
      try {
        orgName = await getOrganizationName(orgId);
      } catch (error) {
        console.warn('Error fetching org name, using fallback:', error);
        orgName = user.org || 'Unknown Organization';
      }
    } else {
      // Fallback: use user.org if it's a name, or known mapping
      if (user.org && !user.org.includes('-')) {
        orgName = user.org;
      } else {
        // Use known mapping
        const orgMapping = {
          '576522cc-e769-4fb4-9487-3d150857d970': 'Mecure Clinics'
        };
        orgName = orgMapping[orgId] || user.org || 'Unknown Organization';
      }
    }
  // console.log('🔧 TRACE: Metadata org name:', orgName);
    const metadataElement = document.getElementById("metadata");
  // console.log('🔧 TRACE: Metadata element:', metadataElement);
    
    if (metadataElement) {
      metadataElement.innerHTML = `<p>Author: ${user.username} (${user.role}) from ${orgName}</p>`;
    // console.log('🔧 TRACE: Metadata updated successfully');
    } else {
    // console.error('🔧 TRACE: Metadata element not found!');
    }
  }
  updateMetadataWithOrgName();
  
  // Load prescriptions for this visit
  loadPrescriptionsForVisit(patientId, visitDate);
  // SOAP form submit to save free form fields and lab selections
  const soapForm = document.getElementById("soap-form");
  if (soapForm && !soapForm.dataset.listener) {
    soapForm.dataset.listener = 'true';
    soapForm.addEventListener("submit", function(e) {
      e.preventDefault();
      // Auto-add pending entries if at least two fields filled
      autoAddPending('history', addHistory, ["note-history-date", "note-history-event", "note-history-notes"]);
      autoAddPending('diagnosis', addDiagnosis, ["note-diagnosis-date", "note-diagnosis", "note-diagnosis-notes"]);
      // Note: Medication entries now handled through prescription system
      autoAddPending('allergy', addAllergy, ["note-allergy-notes"]);
      autoAddPending('immunization', addImmunization, ["note-vaccine", "note-immun-date", "note-immun-notes"]);
      autoAddPendingVitals();  // New for vitals

      // Save current form values to avoid losing user input
      const currentValues = {
        cc: document.getElementById("cc").value,
        hpi: document.getElementById("hpi").value,
        fh: document.getElementById("fh").value,
        sh: document.getElementById("sh").value,
        ros: document.getElementById("ros").value,
        physical: document.getElementById("physical").value,
        labs: document.getElementById("labs").value,
        differential: document.getElementById("differential").value,
        status: document.getElementById("status").value,
        treatments: document.getElementById("treatments").value,
        testing: document.getElementById("testing").value,
        education: document.getElementById("education").value,
        followup: document.getElementById("followup").value
      };

      // Reload fresh patients to avoid stale data
      const freshPatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      const freshPatient = freshPatients.find(p => p.id === patientId);
      
      // Safety check: ensure patient and visit exist before proceeding
      if (!freshPatient) {
        console.error('Patient not found for prescription:', patientId);
        return;
      }
      
      if (!freshPatient.visits) {
        console.error('No visits found for patient:', patientId);
        return;
      }
      
      const freshVisit = freshPatient.visits.find(v => v.date === visitDate);
      if (!freshVisit) {
        console.error('Visit not found for date:', visitDate);
        return;
      }
      
      if (!freshVisit.soap) {
        console.error('No SOAP data found for visit:', visitDate);
        return;
      }
      
      const freshSoap = freshVisit.soap;

      // Save current form values (preserve user input)
      freshSoap.subjective.cc = currentValues.cc;
      freshSoap.subjective.hpi = currentValues.hpi;
      freshSoap.subjective.fh = currentValues.fh;
      freshSoap.subjective.sh = currentValues.sh;
      freshSoap.subjective.ros = currentValues.ros;
      freshSoap.objective.physical = currentValues.physical;
      freshSoap.objective.labs = currentValues.labs;
      freshSoap.assessment.differential = currentValues.differential;
      freshSoap.assessment.status = currentValues.status;
      freshSoap.plan.treatments = currentValues.treatments;
      freshSoap.plan.testing = currentValues.testing;
      freshSoap.plan.education = currentValues.education;
      freshSoap.plan.followup = currentValues.followup;

      // Save lab selections (with null check)
      const noLabsElement = document.getElementById("no-labs");
      const noLabs = noLabsElement ? noLabsElement.checked : false;
      freshSoap.objective.noLabs = noLabs;
      freshSoap.objective.labOrders = noLabs ? [] : Array.from(document.querySelectorAll(".lab-check:checked")).map(cb => cb.value);

      // Save imaging selections (with null check)
      const noImagingElement = document.getElementById("no-imaging");
      const noImaging = noImagingElement ? noImagingElement.checked : false;
      freshSoap.objective.noImaging = noImaging;
      freshSoap.objective.imagingOrders = noImaging ? [] : Array.from(document.querySelectorAll(".imaging-check:checked")).map(cb => cb.value);

      localStorage.setItem(getDataKey("patients"), JSON.stringify(freshPatients));
      console.log("Note saved!"); // Log instead of alert to avoid popup
    });
  }

  // New: Event for "No lab tests" checkbox
  const noLabsCheckbox = document.getElementById("no-labs");
  const labDetails = document.getElementById("lab-details");
  if (noLabsCheckbox && labDetails) {
    noLabsCheckbox.addEventListener("change", function() {
      labDetails.style.display = this.checked ? "none" : "block";
      if (this.checked) {
        // Clear all checkboxes if "No labs" is checked
        document.querySelectorAll(".lab-check:checked").forEach(cb => cb.checked = false);
      }
    });
  }

  // New: Event for "No imaging tests" checkbox
  const noImagingCheckbox = document.getElementById("no-imaging");
  const imagingDetails = document.getElementById("imaging-details");
  if (noImagingCheckbox && imagingDetails) {
    noImagingCheckbox.addEventListener("change", function() {
      imagingDetails.style.display = this.checked ? "none" : "block";
      if (this.checked) {
        // Clear all checkboxes if "No imaging" is checked
        document.querySelectorAll(".imaging-check:checked").forEach(cb => cb.checked = false);
      }
    });
  }

  // Load saved lab selections if any (with null checks)
  soap.objective = soap.objective || {};
  const savedLabOrders = soap.objective.labOrders || [];
  const savedNoLabs = soap.objective.noLabs || false;
  const noLabsElement = document.getElementById("no-labs");
  if (noLabsElement) {
    noLabsElement.checked = savedNoLabs;
  }
  if (labDetails) {
    labDetails.style.display = savedNoLabs ? "none" : "block";
  }
  document.querySelectorAll(".lab-check").forEach(cb => {
    if (cb) {
      cb.checked = savedLabOrders.includes(cb.value);
    }
  });

  // Load saved imaging selections if any (with null checks)
  const savedImagingOrders = soap.objective.imagingOrders || [];
  const savedNoImaging = soap.objective.noImaging || false;
  const noImagingElement = document.getElementById("no-imaging");
  if (noImagingElement) {
    noImagingElement.checked = savedNoImaging;
  }
  if (imagingDetails) {
    imagingDetails.style.display = savedNoImaging ? "none" : "block";
  }
  document.querySelectorAll(".imaging-check").forEach(cb => {
    if (cb) {
      cb.checked = savedImagingOrders.includes(cb.value);
    }
  });

  // Referral workflow moved to select-referrals.html

  // New: Populate lab and imaging tables
  populateLabTable();
  populateImagingTable();

  // Set up auto-save for all form fields
  setupAutoSave();
  
  // Re-enable auto-save after form is loaded
  setTimeout(() => {
    window._skipAutoSave = false;
    console.log("Auto-save re-enabled after form load");
  }, 500);
  
  // Restore saved form values (moved before auto-save setup to avoid conflicts)
  // restoreFormValues(); // Disabled - causing conflicts with auto-save

  // Clean up any invalid orders first (async to avoid blocking)
  setTimeout(async () => {
    cleanupInvalidOrders();
    // Display generated orders and referrals after cleanup
    await displayGeneratedOrders(patient);
    // Only show referrals for the current visit
    const urlParams = new URLSearchParams(window.location.search);
    const currentVisitDate = urlParams.get("visitDate");
    displayGeneratedReferrals(patient, currentVisitDate);
  }, 0);

  // New: Event for generate lab order
  const generateLabOrderBtn = document.getElementById("generate-lab-order");
  
  // Use window.console to bypass log filters
  if (window.console && window.console.log) {
    window.console.log('🔍 [CLINICAL-NOTE] Looking for generate-lab-order button:', {
      found: !!generateLabOrderBtn,
      buttonId: generateLabOrderBtn?.id,
      buttonElement: generateLabOrderBtn
    });
  }
  
  if (generateLabOrderBtn) {
    generateLabOrderBtn.addEventListener("click", async function(e) {
      // Use multiple console methods to ensure visibility
      window.console.log('🔍🔍🔍 [CLINICAL-NOTE] GENERATE LAB ORDER BUTTON CLICKED! 🔍🔍🔍');
      window.console.warn('🔍🔍🔍 [CLINICAL-NOTE] GENERATE LAB ORDER BUTTON CLICKED! 🔍🔍🔍');
      window.console.error('🔍🔍🔍 [CLINICAL-NOTE] GENERATE LAB ORDER BUTTON CLICKED! 🔍🔍🔍');
      
      // Also alert to ensure visibility (remove after testing)
      // window.alert('Generate Lab Order button clicked!');
      
      const selectedLabs = Array.from(document.querySelectorAll(".lab-check:checked")).map(cb => cb.value);
      const noLabsElement = document.getElementById("no-labs");
      const noLabsChecked = noLabsElement ? noLabsElement.checked : false;
      
      console.log('🔍 [CLINICAL-NOTE] Selected labs:', {
        count: selectedLabs.length,
        labs: selectedLabs,
        noLabsChecked
      });
      
      if (selectedLabs.length === 0 && !noLabsChecked) {
        alert("Please select at least one lab test or check 'No lab tests required'.");
        return;
      }
      
      // Save selections to SOAP before navigating
      const freshPatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      const freshPatient = freshPatients.find(p => p.id === patientId);
      if (!freshPatient) {
        alert("Patient not found. Please try again.");
        return;
      }
      const freshVisit = freshPatient.visits ? freshPatient.visits.find(v => v.date === visitDate) : null;
      if (!freshVisit) {
        alert("Visit not found. Please try again.");
        return;
      }
      
      // Initialize SOAP structure if it doesn't exist
      if (!freshVisit.soap) {
        freshVisit.soap = { subjective: {}, objective: {}, assessment: {}, plan: {} };
      }
      if (!freshVisit.soap.objective) {
        freshVisit.soap.objective = {};
      }
      
      // Save the actual checkbox state and selections
      freshVisit.soap.objective.noLabs = noLabsChecked;
      freshVisit.soap.objective.labOrders = selectedLabs;
      
      localStorage.setItem(getDataKey("patients"), JSON.stringify(freshPatients));

      sessionStorage.setItem("selectedLabs", JSON.stringify(selectedLabs));
      
      console.log('🔍 [CLINICAL-NOTE] Generating lab order...', {
        patientId,
        visitDate,
        selectedLabs,
        noLabsChecked
      });
      
      // Automatically save the order to patient chart as backup
      console.log('🔍 [CLINICAL-NOTE] Calling saveGeneratedOrderToChart...');
      await saveGeneratedOrderToChart('lab', selectedLabs, noLabsChecked, patientId, visitDate);
      console.log('✅ [CLINICAL-NOTE] saveGeneratedOrderToChart completed');
      
      // Audit log: Lab order generated
      if (typeof logAuditEvent !== 'undefined') {
        logAuditEvent('lab_order_generated', {
          patientId: patientId,
          visitDate: visitDate,
          testCount: selectedLabs.length,
          tests: selectedLabs.join(', ') || 'No labs required'
        });
      }
      
      // Trigger custom event for real-time sync
      window.dispatchEvent(new CustomEvent('patientDataUpdated', {
        detail: { patientId, action: 'labOrdersUpdated', data: { selectedLabs, noLabsChecked, visitDate } }
      }));
      
      console.log('🔍 [CLINICAL-NOTE] Redirecting to lab-order.html...');
      window.location.href = `/lab-order?patientId=${patientId}&visitDate=${visitDate}`;
    });
  }

  // New: Event for generate imaging order
  const generateImagingOrderBtn = document.getElementById("generate-imaging-order");
  if (generateImagingOrderBtn) {
    generateImagingOrderBtn.addEventListener("click", async function() {
      const selectedImaging = Array.from(document.querySelectorAll(".imaging-check:checked")).map(cb => cb.value);
      const noImagingElement = document.getElementById("no-imaging");
      const noImagingChecked = noImagingElement ? noImagingElement.checked : false;
      
      if (selectedImaging.length === 0 && !noImagingChecked) {
        alert("Please select at least one imaging test or check 'No imaging tests required'.");
        return;
      }
      
      // Save selections to SOAP before navigating
      const freshPatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      const freshPatient = freshPatients.find(p => p.id === patientId);
      if (!freshPatient) {
        alert("Patient not found. Please try again.");
        return;
      }
      const freshVisit = freshPatient.visits ? freshPatient.visits.find(v => v.date === visitDate) : null;
      if (!freshVisit) {
        alert("Visit not found. Please try again.");
        return;
      }
      
      // Initialize SOAP structure if it doesn't exist
      if (!freshVisit.soap) {
        freshVisit.soap = { subjective: {}, objective: {}, assessment: {}, plan: {} };
      }
      if (!freshVisit.soap.objective) {
        freshVisit.soap.objective = {};
      }
      
      // Save the actual checkbox state and selections
      freshVisit.soap.objective.noImaging = noImagingChecked;
      freshVisit.soap.objective.imagingOrders = selectedImaging;
      
      localStorage.setItem(getDataKey("patients"), JSON.stringify(freshPatients));

      sessionStorage.setItem("selectedImaging", JSON.stringify(selectedImaging));
      
      // Automatically save the order to patient chart as backup
      await saveGeneratedOrderToChart('imaging', selectedImaging, noImagingChecked, patientId, visitDate);
      
      // Audit log: Imaging order generated
      if (typeof logAuditEvent !== 'undefined') {
        logAuditEvent('imaging_order_generated', {
          patientId: patientId,
          visitDate: visitDate,
          testCount: selectedImaging.length,
          tests: selectedImaging.join(', ') || 'No imaging required'
        });
      }
      
      // Trigger custom event for real-time sync
      window.dispatchEvent(new CustomEvent('patientDataUpdated', {
        detail: { patientId, action: 'imagingOrdersUpdated', data: { selectedImaging, noImagingChecked, visitDate } }
      }));
      
      window.location.href = `/imaging-order?patientId=${patientId}&visitDate=${visitDate}`;
    });
  }
  } catch (err) {
    console.error('[loadClinicalNote] Load error—patient data was not deleted:', err);
    try {
      window._skipAutoSave = false;
    } catch (_) {}
    showClinicalNoteLoadFailureBanner(err);
    throw err;
  }
}
// Global function for generating orders (exposed to window for use in select-lab-orders.html)
window.generateOrder = async function(orderType, selectedItems, noItemsChecked, patientId, visitDate, htmlContent) {
  return await saveGeneratedOrderToChart(orderType, selectedItems, noItemsChecked, patientId, visitDate, htmlContent);
};

// Save generated order to patient chart as backup
async function saveGeneratedOrderToChart(orderType, selectedItems, noItemsChecked, patientId, visitDate, htmlContent = '') {
  
  // Don't save orders if no items are selected and "no items" is not checked
  if (selectedItems.length === 0 && !noItemsChecked) {
    console.log(`${orderType} order not saved - no items selected and no "no items" checkbox checked`);
    return;
  }

  // Store the user's selection as-is (e.g. "Hepatitis B Profile", "Hormonal Profile (Panel)") so Generated Orders and lab dashboard show panel names, not expanded sub-tests
  const itemsToStore = selectedItems;
  
  // Get patient and visit data
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  
  if (!patient) {
    console.log(`❌ Patient not found: ${patientId}`);
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit) {
    console.log(`❌ Visit not found: ${visitDate} for patient ${patientId}`);
    return;
  }
  
  console.log(`✅ Patient and visit found, proceeding with order save`);
  
  // Initialize orders array if it doesn't exist
  if (!visit.orders) {
    visit.orders = [];
  }
  
  // Generate PDF-ready HTML content for the order if not provided
  if (!htmlContent) {
    if (orderType === 'lab') {
      htmlContent = generateLabOrderPDF({
        type: orderType,
        selectedItems: itemsToStore,
        noItemsChecked: noItemsChecked,
        timestamp: new Date().toISOString(),
        patientId: patientId,
        visitDate: visitDate,
        status: 'Generated'
      }, patient, JSON.parse(localStorage.getItem("user")), visitDate);
    } else if (orderType === 'imaging') {
      htmlContent = generateImagingOrderPDF({
        type: orderType,
        selectedItems: selectedItems,
        noItemsChecked: noItemsChecked,
        timestamp: new Date().toISOString(),
        patientId: patientId,
        visitDate: visitDate,
        status: 'Generated'
      }, patient, JSON.parse(localStorage.getItem("user")), visitDate);
    }
  }

  // Generate organization-wide sequential order serial number (e.g., LAB-MEC-001, IMG-MEC-002)
  // Format: {ORDER_TYPE}-{ORG_PREFIX}-{SEQUENTIAL_NUMBER}
  // This ensures consistent numbering across all patients and visits
  // Expose globally for use in select-lab-orders.html, lab-order.html, etc.
  window.generateOrderSerialNumber = async function(orderType) {
    // Helper function to get organization prefix
    async function getOrgPrefix(orgId, supabase) {
      let orgPrefix = 'ORG'; // Default fallback
      
      // Try localStorage first (faster)
      try {
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = Object.values(organizations).find(org => org.id === orgId);
        if (orgData?.name) {
          orgPrefix = orgData.name.substring(0, 3).toUpperCase();
          return orgPrefix;
        }
      } catch (e) {
        // Continue to Supabase query
      }
      
      // Try Supabase if localStorage doesn't have it
      if (supabase && orgId) {
        try {
          const { data: org, error } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', orgId)
            .maybeSingle();
          
          if (!error && org?.name) {
            orgPrefix = org.name.substring(0, 3).toUpperCase();
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch organization name from Supabase:', e);
        }
      }
      
      return orgPrefix;
    }
    
    try {
      const supabase = window.supabaseClient || supabaseClient;
      
      // Get organization ID
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      let orgId = user.organizationId || user.organization_id;
      
      if (!orgId && user.org) {
        if (user.org.includes('-') && user.org.length === 36) {
          orgId = user.org;
        } else {
          // Try to resolve from Supabase
          if (supabase) {
          const { data: userData } = await supabase
            .from('users')
            .select('organization_id')
            .eq('username', user.username)
            .maybeSingle();
          if (userData?.organization_id) {
            orgId = userData.organization_id;
            }
          }
        }
      }
      
      // Get organization prefix
      const orgPrefix = orgId ? await getOrgPrefix(orgId, supabase) : 'ORG';
      
      if (!supabase) {
        // Fallback: count all orders of this type in localStorage if Supabase unavailable
        try {
          const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          let totalOrderCount = 0;
          patients.forEach(p => {
            if (p.visits) {
              p.visits.forEach(v => {
                if (v.orders) {
                  const typeOrders = v.orders.filter(o => o.type === orderType);
                  totalOrderCount += typeOrders.length;
                }
              });
            }
          });
          const orderNumber = (totalOrderCount + 1).toString().padStart(3, '0');
          return `${orderType.toUpperCase()}-${orgPrefix}-${orderNumber}`;
        } catch (e) {
          // Last resort: use timestamp-based fallback
          const orderNumber = Math.floor(Math.random() * 999 + 1).toString().padStart(3, '0');
          return `${orderType.toUpperCase()}-${orgPrefix}-${orderNumber}`;
        }
      }
      
      if (!orgId) {
        // Fallback if org ID not found - count all orders of this type in localStorage
        try {
          const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          let totalOrderCount = 0;
          patients.forEach(p => {
            if (p.visits) {
              p.visits.forEach(v => {
                if (v.orders) {
                  const typeOrders = v.orders.filter(o => o.type === orderType);
                  totalOrderCount += typeOrders.length;
                }
              });
            }
          });
          const orderNumber = (totalOrderCount + 1).toString().padStart(3, '0');
          return `${orderType.toUpperCase()}-${orgPrefix}-${orderNumber}`;
        } catch (e) {
          // Last resort: use timestamp-based fallback
          const orderNumber = Math.floor(Math.random() * 999 + 1).toString().padStart(3, '0');
          return `${orderType.toUpperCase()}-${orgPrefix}-${orderNumber}`;
        }
      }
      
      // Query Supabase for the highest order number for this organization and type
      const { data: orders, error } = await supabase
        .from('orders')
        .select('serial_number')
        .eq('organization_id', orgId)
        .eq('type', orderType)
        .is('deleted_at', null)
        .order('serial_number', { ascending: false })
        .limit(100);
      
      if (error) {
        console.warn('⚠️ Error fetching orders for serial number generation:', error);
        // Fallback: count all orders of this type in localStorage
        try {
          const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          let totalOrderCount = 0;
          patients.forEach(p => {
            if (p.visits) {
              p.visits.forEach(v => {
                if (v.orders) {
                  const typeOrders = v.orders.filter(o => o.type === orderType);
                  totalOrderCount += typeOrders.length;
                }
              });
            }
          });
          const orderNumber = (totalOrderCount + 1).toString().padStart(3, '0');
          return `${orderType.toUpperCase()}-${orgPrefix}-${orderNumber}`;
        } catch (e) {
          // Last resort: use timestamp-based fallback
          const orderNumber = Math.floor(Math.random() * 999 + 1).toString().padStart(3, '0');
          return `${orderType.toUpperCase()}-${orgPrefix}-${orderNumber}`;
        }
      }
      
      // Extract the highest number from existing serial numbers
      // Handle formats:
      // - New format: LAB-MEC-001, IMG-MEC-002
      // - Old format without org: LAB-001, IMG-002
      // - Old long format: LAB-MEC0006-1767378043043-if5wean
      let maxNumber = 0;
      if (orders && orders.length > 0) {
        orders.forEach(order => {
          const serialNum = order.serial_number || '';
          const orderTypeUpper = orderType.toUpperCase();
          
          // Try new format with org prefix: LAB-MEC-001
          const newFormatWithOrgMatch = serialNum.match(new RegExp(`^${orderTypeUpper}-${orgPrefix}-(\\d+)$`));
          if (newFormatWithOrgMatch) {
            const num = parseInt(newFormatWithOrgMatch[1]);
            if (num > maxNumber) {
              maxNumber = num;
            }
            return; // Found match, skip other patterns
          }
          
          // Try new format without org prefix: LAB-001 (backward compatibility)
          const newFormatMatch = serialNum.match(new RegExp(`^${orderTypeUpper}-(\\d+)$`));
          if (newFormatMatch) {
            const num = parseInt(newFormatMatch[1]);
            if (num > maxNumber) {
              maxNumber = num;
            }
            return; // Found match, skip other patterns
          }
          
          // Old long format detected - log but don't use for numbering
          if (serialNum.includes('-') && serialNum.split('-').length > 2) {
            console.log('ℹ️ Found old format serial number:', serialNum);
          }
        });
      }
      
      // Generate next sequential number with org prefix
      const nextNumber = maxNumber + 1;
      const orderSerialNumber = `${orderType.toUpperCase()}-${orgPrefix}-${nextNumber.toString().padStart(3, '0')}`;
      
      console.log(`✅ Generated order serial number: ${orderSerialNumber} (organization-wide)`);
      return orderSerialNumber;
    } catch (error) {
      console.error('❌ Error generating order serial number:', error);
      // Fallback: get org prefix and count all orders of this type in localStorage
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const orgId = user.organizationId || user.organization_id;
        const supabase = window.supabaseClient || supabaseClient;
        const orgPrefix = orgId ? await getOrgPrefix(orgId, supabase) : 'ORG';
        
        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        let totalOrderCount = 0;
        patients.forEach(p => {
          if (p.visits) {
            p.visits.forEach(v => {
              if (v.orders) {
                const typeOrders = v.orders.filter(o => o.type === orderType);
                totalOrderCount += typeOrders.length;
              }
            });
          }
        });
        const orderNumber = (totalOrderCount + 1).toString().padStart(3, '0');
        return `${orderType.toUpperCase()}-${orgPrefix}-${orderNumber}`;
      } catch (e) {
        // Last resort: use timestamp-based fallback
        const orderNumber = Math.floor(Math.random() * 999 + 1).toString().padStart(3, '0');
        return `${orderType.toUpperCase()}-ORG-${orderNumber}`;
      }
    }
  }
  
  // Generate order serial number (await if async)
  const orderSerialNumber = await generateOrderSerialNumber(orderType);
  
  // Create order data
  const orderData = {
    type: orderType,
    serialNumber: orderSerialNumber,
    selectedItems: itemsToStore,
    noItemsChecked: noItemsChecked,
    timestamp: new Date().toISOString(),
    patientId: patientId,
    visitDate: visitDate,
    status: 'Generated',
    htmlContent: htmlContent,
    createdAt: new Date().toISOString(),
    createdBy: JSON.parse(localStorage.getItem("user") || "{}").username || 'unknown'
  };
  
  // Ensure orders array exists and add the order
  if (!visit.orders) {
    visit.orders = [];
  }
  
  visit.orders.push(orderData);
  
  // Ensure the patient.visits array is properly structured
  if (!patient.visits) {
    patient.visits = [];
  }
  const visitIndex = patient.visits.findIndex(v => v.date === visitDate);
  if (visitIndex >= 0) {
    patient.visits[visitIndex] = visit;
  } else {
    patient.visits.push(visit);
  }
  
  // Save back to localStorage
  try {
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  } catch (error) {
    console.error('❌ Error saving order to localStorage:', error);
    return false;
  }
  
  console.log(`✅ [ORDER-SAVE] ${orderType} order saved: ${orderSerialNumber}`, {
    orderType,
    serialNumber: orderSerialNumber,
    patientId,
    visitDate,
    selectedItemsCount: itemsToStore.length
  });
  
  // CRITICAL: Save patient to Supabase to persist order immediately
  try {
    if (typeof savePatientToSupabase === 'function') {
      await savePatientToSupabase(patient);
      console.log('✅ [ORDER-SAVE] Patient saved to Supabase with new order');
    }
  } catch (error) {
    console.error('❌ [ORDER-SAVE] Error saving patient to Supabase:', error);
    // Continue even if Supabase save fails - order is in localStorage
  }
  
  // Refresh display if we're on clinical-note or patient-details page
  if (typeof displayGeneratedOrders === 'function') {
    displayGeneratedOrders(patient);
  }
  
  // Dispatch real-time sync event for cross-page updates
  window.dispatchEvent(new CustomEvent('patientDataUpdated', {
    detail: { 
      patientId, 
      action: 'orderGenerated', 
      data: { 
        orderType, 
        visitDate, 
        timestamp: orderData.timestamp,
        serialNumber: orderData.serialNumber,
        selectedItems: selectedItems,
        noItemsChecked: noItemsChecked
      } 
    }
  }));
  
  // Sync order to Supabase orders table if available
  console.log('🔍 [ORDER-SAVE] Starting Supabase order sync...');
  syncOrderToSupabase(orderData, patient, visit).then(() => {
    console.log('✅ [ORDER-SAVE] Supabase order sync promise resolved');
  }).catch(err => {
    console.error('❌ [ORDER-SAVE] Supabase order sync promise rejected:', err);
  });
}

// Sync order to Supabase for cross-device consistency
async function syncOrderToSupabase(orderData, patient, visit) {
  console.log('🔍 [SYNC-ORDER] syncOrderToSupabase called', {
    orderType: orderData.type,
    serialNumber: orderData.serialNumber,
    patientId: orderData.patientId
  });
  
  const supabase = window.supabaseClient || supabaseClient;
  
  if (!supabase) {
    console.warn('⚠️ [SYNC-ORDER] Supabase not available, skipping order sync');
    return;
  }
  
  console.log('✅ [SYNC-ORDER] Supabase client available');
  
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    console.log('🔍 [SYNC-ORDER] User data:', {
      username: user.username,
      hasOrgId: !!user.organizationId,
      hasOrg: !!user.org
    });
    
    // Try multiple methods to get organization ID
    let orgId = user.organizationId || user.organization_id;
    
    // If not found, try to get from Supabase users table
    if (!orgId && user.username) {
      console.log('🔍 [SYNC-ORDER] Fetching organization_id from Supabase users table...');
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('organization_id')
          .eq('username', user.username)
          .maybeSingle();
        
        if (!userError && userData?.organization_id) {
          orgId = userData.organization_id;
          console.log('✅ [SYNC-ORDER] Retrieved organization_id from Supabase users table:', orgId);
        } else if (userError) {
          console.warn('⚠️ [SYNC-ORDER] Error fetching organization_id:', userError);
        }
      } catch (err) {
        console.warn('⚠️ [SYNC-ORDER] Exception fetching organization_id from Supabase:', err);
      }
    }
    
    // Fallback: Try localStorage organizations
    if (!orgId && user.org) {
      console.log('🔍 [SYNC-ORDER] Trying localStorage organizations...');
      const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
      orgId = orgs[user.org]?.id;
      if (orgId) {
        console.log('✅ [SYNC-ORDER] Found organization_id in localStorage:', orgId);
      }
    }
    
    if (!orgId) {
      console.error('❌ [SYNC-ORDER] No organization ID found, skipping order sync', {
        user: user.username,
        hasOrg: !!user.org,
        hasOrgId: !!user.organizationId
      });
      return;
    }
    
    console.log('✅ [SYNC-ORDER] Using organization_id for order sync:', orgId);
    
    // Check if order already exists in Supabase
    const { data: existingOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id, serial_number, status')
      .eq('serial_number', orderData.serialNumber)
      .eq('organization_id', orgId);
    
    if (fetchError) {
      console.error('❌ Error fetching existing orders:', fetchError);
      // Don't return - might be RLS issue, try to insert anyway
    }
    
    if (existingOrders && existingOrders.length > 0) {
      console.log('✅ Order already exists in Supabase:', orderData.serialNumber);
      // Update the existing order instead of skipping
      const existingOrder = existingOrders[0];
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          selected_items: orderData.selectedItems,
          html_content: orderData.htmlContent,
          status: orderData.status || 'Generated',
          results: orderData.results || {},
          timestamp: orderData.timestamp || new Date().toISOString()
        })
        .eq('id', existingOrder.id);
      
      if (updateError) {
        console.error('❌ Error updating existing order:', updateError);
      } else {
        console.log('✅ Updated existing order in Supabase');
      }
      return;
    }
    
    // Insert new order with explicit status 'Generated' for lab orders
    const orderStatus = orderData.status || 'Generated';
    
    // Ensure selected_items and results are proper JSONB (objects/arrays, not strings)
    let selectedItems = orderData.selectedItems;
    if (typeof selectedItems === 'string') {
      try {
        selectedItems = JSON.parse(selectedItems);
      } catch (e) {
        console.warn('⚠️ [SYNC-ORDER] Failed to parse selectedItems, using empty array:', e);
        selectedItems = [];
      }
    }
    if (!Array.isArray(selectedItems)) {
      selectedItems = [];
    }
    
    let results = orderData.results || {};
    if (typeof results === 'string') {
      try {
        results = JSON.parse(results);
      } catch (e) {
        console.warn('⚠️ [SYNC-ORDER] Failed to parse results, using empty object:', e);
        results = {};
      }
    }
    if (typeof results !== 'object' || results === null) {
      results = {};
    }
    
    const insertData = {
      serial_number: orderData.serialNumber,
      type: orderData.type,
      patient_id: orderData.patientId,
      visit_date: orderData.visitDate,
      selected_items: selectedItems, // JSONB - ensure it's an array
      no_items_checked: orderData.noItemsChecked || false,
      status: orderStatus, // Explicitly set to 'Generated' for lab scientist dashboard
      html_content: orderData.htmlContent,
      created_by: orderData.createdBy || user.username,
      organization_id: orgId,
      timestamp: orderData.timestamp || new Date().toISOString(),
      results: results // JSONB - ensure it's an object
    };
    
    // Only include created_at if provided (let database use default)
    if (orderData.createdAt) {
      insertData.created_at = orderData.createdAt;
    }
    
    const { data, error } = await supabase
      .from('orders')
      .insert([insertData])
      .select('id, serial_number, status');
    
    if (error) {
      console.error('❌ Error syncing order to Supabase:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        orderType: orderData.type,
        serialNumber: orderData.serialNumber,
        orgId: orgId,
        insertData: insertData
      });
      throw error; // Re-throw to be caught by caller
    } else {
      console.log('✅ Order synced to Supabase successfully:', {
        id: data?.[0]?.id,
        serialNumber: data?.[0]?.serial_number,
        status: data?.[0]?.status,
        type: orderData.type
      });
    }
  } catch (error) {
    console.error('❌ Error in syncOrderToSupabase:', error);
  }
}

// Sync appointments to patient visits
function syncAppointmentsToVisits(patient) {
  // Get appointments for this patient
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  
  const patientAppointments = appointments.filter(appt => {
    // Try to match by patient name or ID
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    return appt.patientName === patientName || appt.patientId === patient.id;
  });
  
  // Ensure patient.visits exists
  if (!patient.visits) {
    patient.visits = [];
  }
  
  // Create visits for appointments that don't have corresponding visits
  patientAppointments.forEach(appointment => {
    const existingVisit = patient.visits.find(visit => visit.date === appointment.date);
    
    if (!existingVisit) {
      // Create a new visit entry
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const newVisit = {
        date: appointment.date,
        time: appointment.time,
        status: appointment.checkInTime ? (appointment.checkOutTime ? 'Completed' : 'In Progress') : 'Scheduled',
        appointmentId: appointment.id,
        checkInTime: appointment.checkInTime,
        checkOutTime: appointment.checkOutTime,
        symptoms: '',
        diagnosis: '',
        prescription: '',
        soap: {
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
          locked: false,
          auditTrail: []
        },
        orders: [],
        referrals: [],
        createdBy: {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          org: user.org,
          orgAddressLine1: user.orgAddressLine1,
          orgAddressLine2: user.orgAddressLine2,
          orgCity: user.orgCity,
          orgState: user.orgState,
          orgCountry: user.orgCountry,
          orgPostalCode: user.orgPostalCode,
          orgPhone: user.orgPhone,
          orgEmail: user.orgEmail
        },
        createdAt: new Date().toISOString()
      };
      
      patient.visits.push(newVisit);
    } else {
      // Update existing visit with appointment data if needed
      if (appointment.checkInTime && !existingVisit.checkInTime) {
        existingVisit.checkInTime = appointment.checkInTime;
        existingVisit.status = appointment.checkOutTime ? 'Completed' : 'In Progress';
      }
      if (appointment.checkOutTime && !existingVisit.checkOutTime) {
        existingVisit.checkOutTime = appointment.checkOutTime;
        existingVisit.status = 'Completed';
      }
    }
  });
  
  // Save updated patient data
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patientIndex = patients.findIndex(p => p.id === patient.id);
  if (patientIndex !== -1) {
    patients[patientIndex] = patient;
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  }
}


// Clean up invalid orders (no items selected and no "no items" checkbox)
function cleanupInvalidOrders() {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  let hasChanges = false;
  
  patients.forEach(patient => {
    if (patient.visits && Array.isArray(patient.visits)) {
      patient.visits.forEach(visit => {
      if (visit.orders && visit.orders.length > 0) {
        const originalLength = visit.orders.length;
        
        visit.orders = visit.orders.filter(order => {
          // Keep orders that have selected items OR have "no items" checked
          // Also keep orders that have a timestamp (legacy orders might not have selectedItems)
          const hasItems = order.selectedItems && order.selectedItems.length > 0;
          const noItemsChecked = order.noItemsChecked === true;
          const hasTimestamp = order.timestamp; // Keep orders with timestamps as they're likely valid
          
          return hasItems || noItemsChecked || hasTimestamp;
        });
        
        if (visit.orders.length !== originalLength) {
          hasChanges = true;
        }
        
        // Also fix status capitalization
        visit.orders.forEach(order => {
          if (order.status === 'generated') {
            order.status = 'Generated';
            hasChanges = true;
          }
        });
      }
    });
    }
  });
  
  if (hasChanges) {
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  }
}

// New: Populate lab table with checkboxes
function populateLabTable() {
  const labTable = document.getElementById("lab-table");
  if (!labTable) {
    return;
  }
  labTable.innerHTML = `<thead><tr><th>Select</th><th>Name</th></tr></thead><tbody></tbody>`;
  const tbody = labTable.querySelector("tbody");
  
  // Get saved lab selections
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  let savedLabOrders = [];
  let noLabsChecked = false;
  
  if (patientId && visitDate) {
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      const visit = patient.visits.find(v => v.date === visitDate);
      if (visit && visit.soap && visit.soap.objective) {
        savedLabOrders = visit.soap.objective.labOrders || [];
        noLabsChecked = visit.soap.objective.noLabs || false;
      }
    }
  }
  
  const tests = window.LAB_TESTS || LAB_TESTS || [];
  if (!tests || tests.length === 0) {
    console.error('❌ LAB_TESTS is not defined or empty!');
    return;
  }
  tests.forEach(test => {
    const row = document.createElement("tr");
    const isChecked = savedLabOrders.includes(test.name);
    row.innerHTML = `
      <td><input type="checkbox" class="lab-check" value="${test.name}" ${isChecked ? 'checked' : ''}></td>
      <td>${test.name}</td>
    `;
    tbody.appendChild(row);
  });
  
  // Restore "No labs" checkbox state
  const noLabsCheckbox = document.getElementById("no-labs");
  if (noLabsCheckbox) {
    noLabsCheckbox.checked = noLabsChecked;
  }
  
  // Add auto-save event listeners
  tbody.querySelectorAll(".lab-check").forEach(checkbox => {
    checkbox.addEventListener("change", autoSaveClinicalNote);
  });
  
  if (noLabsCheckbox) {
    noLabsCheckbox.addEventListener("change", autoSaveClinicalNote);
  }
}

// New: Populate imaging table with checkboxes
function populateImagingTable() {
  const imagingTable = document.getElementById("imaging-table");
  if (!imagingTable) {
    return;
  }
  imagingTable.innerHTML = `<thead><tr><th>Select</th><th>Name</th></tr></thead><tbody></tbody>`;
  const tbody = imagingTable.querySelector("tbody");
  
  // Get saved imaging selections
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  let savedImagingOrders = [];
  let noImagingChecked = false;
  
  if (patientId && visitDate) {
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      const visit = patient.visits.find(v => v.date === visitDate);
      if (visit && visit.soap && visit.soap.objective) {
        savedImagingOrders = visit.soap.objective.imagingOrders || [];
        noImagingChecked = visit.soap.objective.noImaging || false;
      }
    }
  }
  
  const tests = window.IMAGING_TESTS || IMAGING_TESTS || [];
  if (!tests || tests.length === 0) {
    console.error('❌ IMAGING_TESTS is not defined or empty!');
    return;
  }
  tests.forEach(test => {
    const row = document.createElement("tr");
    const isChecked = savedImagingOrders.includes(test.name);
    row.innerHTML = `
      <td><input type="checkbox" class="imaging-check" value="${test.name}" ${isChecked ? 'checked' : ''}></td>
      <td>${test.name}</td>
    `;
    tbody.appendChild(row);
  });
  
  // Restore "No imaging" checkbox state
  const noImagingCheckbox = document.getElementById("no-imaging");
  if (noImagingCheckbox) {
    noImagingCheckbox.checked = noImagingChecked;
  }
  
  // Add auto-save event listeners
  tbody.querySelectorAll(".imaging-check").forEach(checkbox => {
    checkbox.addEventListener("change", autoSaveClinicalNote);
  });
  
  if (noImagingCheckbox) {
    noImagingCheckbox.addEventListener("change", autoSaveClinicalNote);
  }
}

// Restore saved form values
function restoreFormValues() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  
  if (!patientId || !visitDate) return;
  
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit || !visit.soap) return;
  
  // Restore textarea values
  const textareas = document.querySelectorAll("textarea");
  textareas.forEach(textarea => {
    if (textarea.id) {
      // Determine which section this field belongs to
      let section = "subjective";
      if (textarea.id.includes("objective") || textarea.closest("h2")?.textContent.includes("Objective")) {
        section = "objective";
      } else if (textarea.id.includes("assessment") || textarea.closest("h2")?.textContent.includes("Assessment")) {
        section = "assessment";
      } else if (textarea.id.includes("plan") || textarea.closest("h2")?.textContent.includes("Plan")) {
        section = "plan";
      }
      
      if (visit.soap[section] && visit.soap[section][textarea.id]) {
        textarea.value = visit.soap[section][textarea.id];
      }
    }
  });
  
  // Restore input values
  const inputs = document.querySelectorAll("input[type='text'], input[type='date']");
  inputs.forEach(input => {
    if (input.id && !input.id.includes("note-")) { // Exclude temporary note inputs
      // Determine section based on ID or position
      let section = "subjective";
      if (input.id.includes("objective") || input.closest("h2")?.textContent.includes("Objective")) {
        section = "objective";
      } else if (input.id.includes("assessment") || input.closest("h2")?.textContent.includes("Assessment")) {
        section = "assessment";
      } else if (input.id.includes("plan") || input.closest("h2")?.textContent.includes("Plan")) {
        section = "plan";
      }
      
      if (visit.soap[section] && visit.soap[section][input.id]) {
        input.value = visit.soap[section][input.id];
      }
    }
  });
  
  // Restore checkbox values (except lab and imaging which are handled separately)
  const checkboxes = document.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(checkbox => {
    if (!checkbox.classList.contains("lab-check") && !checkbox.classList.contains("imaging-check") && 
        !checkbox.id.includes("no-labs") && !checkbox.id.includes("no-imaging")) {
      // Determine section based on ID or position
      let section = "subjective";
      if (checkbox.id.includes("objective") || checkbox.closest("h2")?.textContent.includes("Objective")) {
        section = "objective";
      } else if (checkbox.id.includes("assessment") || checkbox.closest("h2")?.textContent.includes("Assessment")) {
        section = "assessment";
      } else if (checkbox.id.includes("plan") || checkbox.closest("h2")?.textContent.includes("Plan")) {
        section = "plan";
      }
      
      if (visit.soap[section] && visit.soap[section][checkbox.id] !== undefined) {
        checkbox.checked = visit.soap[section][checkbox.id];
      }
    }
  });
  
  // Restore select values
  const selects = document.querySelectorAll("select");
  selects.forEach(select => {
    if (select.id) {
      // Determine section based on ID or position
      let section = "subjective";
      if (select.id.includes("objective") || select.closest("h2")?.textContent.includes("Objective")) {
        section = "objective";
      } else if (select.id.includes("assessment") || select.closest("h2")?.textContent.includes("Assessment")) {
        section = "assessment";
      } else if (select.id.includes("plan") || select.closest("h2")?.textContent.includes("Plan")) {
        section = "plan";
      }
      
      if (visit.soap[section] && visit.soap[section][select.id]) {
        select.value = visit.soap[section][select.id];
      }
    }
  });
  
  console.log("Form values restored from saved data");
}

// Set up auto-save for all form fields
function setupAutoSave() {
  // Use event delegation for better performance
  const soapForm = document.getElementById("soap-form");
  if (!soapForm) return;
  
  soapForm.addEventListener("change", debounce(autoSaveClinicalNote, 500));
  
  console.log("Auto-save setup completed for clinical note");
  
  // Setup auto-expanding textareas
  setupAutoExpandingTextareas();
  
  // Setup note locking functionality
  setupNoteLocking();
}

// Make loadClinicalNote globally available
window.loadClinicalNote = loadClinicalNote;
// resolvePatientByIdentifier already defined on window above

// Setup auto-expanding textareas
function setupAutoExpandingTextareas() {
  // Use event delegation for better performance
  const soapForm = document.getElementById("soap-form");
  if (!soapForm) return;
  
  // Set initial heights for existing textareas
  const textareas = soapForm.querySelectorAll('textarea');
  textareas.forEach(textarea => {
    const content = textarea.value;
    if (content.trim() === '') {
      textarea.style.height = '40px';
    } else {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px';
    }
  });
  
  // Single event listener for all textarea events (consolidated with auto-save)
  soapForm.addEventListener('input', function(e) {
    if (e.target.tagName === 'TEXTAREA') {
      // Auto-expand functionality
      e.target.style.height = 'auto';
      e.target.style.height = Math.max(40, e.target.scrollHeight) + 'px';
      
      // Auto-save functionality (immediate for textareas)
      setTimeout(autoSaveClinicalNote, 50);
    } else {
      // Debounced save for other inputs
      debounce(autoSaveClinicalNote, 500)();
    }
  });
  
  soapForm.addEventListener('focus', function(e) {
    if (e.target.tagName === 'TEXTAREA' && e.target.value.trim() === '') {
      e.target.style.minHeight = '80px';
    }
  }, true);
  
  soapForm.addEventListener('blur', function(e) {
    if (e.target.tagName === 'TEXTAREA' && e.target.value.trim() === '') {
      e.target.style.minHeight = '40px';
      e.target.style.height = '40px';
    }
  }, true);
}

// Setup note locking functionality
function setupNoteLocking() {
  const user = JSON.parse(localStorage.getItem("user"));
  const lockBtn = document.getElementById("lock-note-btn");
  const unlockBtn = document.getElementById("unlock-note-btn");
  const radLockBtn = document.getElementById("rad-lock-note-btn");
  const radUnlockBtn = document.getElementById("rad-unlock-note-btn");
  const electronicSignature = document.getElementById("electronic-signature");
  const isDoctor = user && user.role === "Doctor";

  function attachLockHandler(button) {
    if (!button || button.dataset.lockHandlerAttached === "true") return;
    button.dataset.lockHandlerAttached = "true";
    button.addEventListener("click", function() {
      showLockConfirmationModal();
    });
  }

  function attachUnlockHandler(button) {
    if (!button || button.dataset.unlockHandlerAttached === "true") return;
    button.dataset.unlockHandlerAttached = "true";
    button.addEventListener("click", function() {
      unlockClinicalNote();
    });
  }

  const lockButtons = [lockBtn, radLockBtn];
  const unlockButtons = [unlockBtn, radUnlockBtn];
  const noteLockTabBtn = document.getElementById("note-lock-tab-btn");
  const noteLockTab = document.getElementById("tab-note-lock");

  if (isDoctor) {
    lockButtons.forEach(btn => {
      if (!btn) return;
      btn.style.display = "inline-block";
      attachLockHandler(btn);
    });

    unlockButtons.forEach(btn => {
      if (!btn) return;
      attachUnlockHandler(btn);
    });
    if (noteLockTabBtn) {
      noteLockTabBtn.style.display = "inline-flex";
    }
    if (noteLockTab) {
      noteLockTab.style.display = "";
    }
  } else {
    lockButtons.concat(unlockButtons).forEach(btn => {
      if (!btn) return;
      btn.style.display = "none";
    });
    if (noteLockTabBtn) {
      noteLockTabBtn.style.display = "none";
    }
    if (noteLockTab) {
      noteLockTab.style.display = "none";
      if (noteLockTab.classList.contains("active") && typeof window.switchClinicalTab === "function") {
        window.switchClinicalTab("subjective");
      }
    }
  }

  // Check if note is already locked and display signature
  checkNoteLockStatus();
}
// Check if clinical note is locked and display signature
function checkNoteLockStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  
  if (!patientId || !visitDate) return;
  
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  const visit = (patient.visits || []).find(v => v.date === visitDate);
  if (!visit || !visit.soap) return;
  
  // Check if note is locked
  if (visit.soap.locked && visit.soap.lockedBy && visit.soap.lockedAt) {
    displayElectronicSignature(visit.soap.lockedBy, visit.soap.lockedAt, visit.soap.signature, visit.soap.auditTrail);
    disableFormEditing();
    showUnlockButton();
  } else {
    enableFormEditing();
    hideUnlockButton();
  }
}

// Display electronic signature
function displayElectronicSignature(lockedBy, lockedAt, storedSignature = null, auditTrail = []) {
  const electronicSignature = document.getElementById("electronic-signature");
  const signatureDetails = document.getElementById("signature-details");
  const signatureStatus = document.getElementById("signature-status");
  const auditTrailContent = document.getElementById("audit-trail-content");
  const lockBtn = document.getElementById("lock-note-btn");
  
  if (electronicSignature && signatureDetails) {
    const lockDate = new Date(lockedAt);
    const formattedDate = lockDate.toLocaleDateString();
    const formattedTime = lockDate.toLocaleTimeString();
    
    // Use stored signature if available, otherwise check current user's signature
    let signatureData = storedSignature;
    if (!signatureData) {
      const user = JSON.parse(localStorage.getItem("user"));
      signatureData = user ? user.signature : null;
    }
    
    let signatureHTML = '';
    
    if (signatureData) {
      if (signatureData.type === 'image/png') {
        signatureHTML = `
          <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; background: white; text-align: center;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Digital Signature:</p>
            <img src="${signatureData.data}" style="max-width: 300px; max-height: 150px; border: 1px solid #ccc;" alt="Doctor's Signature">
          </div>
        `;
      } else if (signatureData.type === 'application/pdf') {
        signatureHTML = `
          <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; background: white; text-align: center;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Digital Signature:</p>
            <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9; display: inline-block;">
              <p style="margin: 0; font-weight: bold; color: #333;">PDF Signature</p>
              <p style="margin: 5px 0; font-size: 12px; color: #666;">${signatureData.name}</p>
              <button onclick="viewSignaturePDF('${signatureData.data}')" style="background-color: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 5px;">View PDF</button>
            </div>
          </div>
        `;
      }
    }
    
    // Set status message
    if (signatureStatus) {
      signatureStatus.innerHTML = "This clinical note has been electronically signed and locked.";
    }
    
    // Get the full name of the user who locked the note
    let fullName = lockedBy; // Default fallback
    
    // Try to find the user who locked the note in the users list
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    console.log("Looking for user who locked note:", lockedBy);
    console.log("Available users:", users.map(u => ({ username: u.username, firstName: u.firstName, lastName: u.lastName })));
    
    const userWhoLocked = users.find(u => {
      // Check if lockedBy matches username, or if it's already a full name
      return u.username === lockedBy || 
             (u.firstName && u.lastName && `${u.firstName} ${u.lastName}` === lockedBy);
    });
    
    console.log("Found user who locked:", userWhoLocked);
    
    if (userWhoLocked && userWhoLocked.firstName && userWhoLocked.lastName) {
      fullName = `${userWhoLocked.firstName} ${userWhoLocked.lastName}`;
      console.log("Using full name:", fullName);
    } else if (userWhoLocked) {
      console.log("User found but no firstName/lastName, using username:", lockedBy);
      // Show a helpful message for users without full names
      fullName = `${lockedBy} (Update your profile to show full name)`;
    } else {
      console.log("User not found, using stored value:", lockedBy);
      fullName = lockedBy;
    }
    
    signatureDetails.innerHTML = `
      <strong>Electronically signed by:</strong> ${fullName}<br>
      <strong>Date:</strong> ${formattedDate}<br>
      <strong>Time:</strong> ${formattedTime}
      ${signatureHTML}
    `;
    
    // Display audit trail (sorted by most recent first)
    if (auditTrailContent && auditTrail && auditTrail.length > 0) {
      let auditHTML = '';
      
      // Sort audit trail by timestamp (most recent first)
      const sortedAuditTrail = [...auditTrail].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      sortedAuditTrail.forEach((entry, index) => {
        const entryDate = new Date(entry.timestamp);
        const formattedEntryDate = entryDate.toLocaleDateString();
        const formattedEntryTime = entryDate.toLocaleTimeString();
        const actionColor = entry.action === 'locked' ? '#dc3545' : '#ffc107';
        const actionIcon = entry.action === 'locked' ? '🔒' : '🔓';
        
        // Look up the full name for the user in this audit entry
        let entryUserName = entry.user; // Default fallback
        const entryUser = users.find(u => {
          return u.username === entry.user || 
                 (u.firstName && u.lastName && `${u.firstName} ${u.lastName}` === entry.user);
        });
        
        if (entryUser && entryUser.firstName && entryUser.lastName) {
          entryUserName = `${entryUser.firstName} ${entryUser.lastName}`;
        } else if (entryUser) {
          entryUserName = `${entry.user} (Update profile for full name)`;
        }
        
        auditHTML += `
          <div style="margin: 8px 0; padding: 8px; border-left: 3px solid ${actionColor}; background-color: #f8f9fa;">
            <strong>${actionIcon} ${entry.action.toUpperCase()}</strong> by ${entryUserName}<br>
            <span style="font-size: 12px; color: #666;">
              ${formattedEntryDate} at ${formattedEntryTime}
              ${entry.reason ? `<br><em>Reason: ${entry.reason}</em>` : ''}
            </span>
          </div>
        `;
      });
      auditTrailContent.innerHTML = auditHTML;
    } else if (auditTrailContent) {
      auditTrailContent.innerHTML = '<em>No audit trail available</em>';
    }
    
    electronicSignature.style.display = "block";
  }
  
  // Hide lock button if note is already locked
  if (lockBtn) {
    lockBtn.style.display = "none";
  }
}

// Lock clinical note (Supabase-first)
async function lockClinicalNote() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  const user = JSON.parse(localStorage.getItem("user"));
  
  if (!patientId || !visitDate || !user) {
    alert("Unable to lock note. Missing required information.");
    return;
  }
  
  // Only Doctors can lock notes
  if (user.role !== "Doctor") {
    alert("Only Doctors can lock clinical notes.");
    return;
  }
  
  // Supabase-first: Load patients from Supabase, fallback to localStorage
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  const patient = patients.find(p => p.id === patientId);
  if (!patient) {
    alert("Patient not found.");
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit) {
    alert("Visit not found.");
    return;
  }
  
  // Initialize SOAP if it doesn't exist
  if (!visit.soap) {
    visit.soap = { subjective: {}, objective: {}, assessment: {}, plan: {} };
  }
  
  // Initialize audit trail if it doesn't exist
  if (!visit.soap.auditTrail) {
    visit.soap.auditTrail = [];
  }
  
  // Add lock entry to audit trail
  const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
  visit.soap.auditTrail.push({
    action: 'locked',
    user: fullName,
    timestamp: new Date().toISOString(),
    reason: null
  });
  
  // Lock the note
  visit.soap.locked = true;
  visit.soap.lockedBy = fullName;
  visit.soap.lockedAt = new Date().toISOString();
  
  // Audit log: Clinical note locked
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('clinical_note_locked', {
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      visitDate: visitDate,
      lockedBy: fullName
    });
  }
  
  // Store signature data if available
  if (user.signature) {
    visit.soap.signature = {
      data: user.signature.data,
      type: user.signature.type,
      name: user.signature.name,
      uploadedAt: user.signature.uploadedAt
    };
  }
  
  // Supabase-first: Save to Supabase, then localStorage as cache
  try {
    if (typeof savePatientToSupabase === 'function') {
      await savePatientToSupabase(patient);
      console.log('✅ Clinical note locked and saved to Supabase');
    }
  } catch (error) {
    console.error('Failed to save to Supabase, saving to localStorage only:', error);
  }
  
  // Save to localStorage as cache/fallback
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  
  // Display electronic signature
  displayElectronicSignature(user.username, visit.soap.lockedAt, visit.soap.signature, visit.soap.auditTrail);
  
  // Disable form editing
  disableFormEditing();
  showUnlockButton();
  
  // Trigger sync event
  window.dispatchEvent(new CustomEvent('patientDataUpdated', {
    detail: { patientId, action: 'clinicalNoteLocked', data: { visitDate, lockedBy: user.username, lockedAt: visit.soap.lockedAt } }
  }));
  
  // Show non-blocking success notification
  showNotification("Clinical note has been locked and electronically signed.", "success");
}

// Disable form editing when note is locked
function disableFormEditing() {
  const protectedIds = new Set(["lock-note-btn", "unlock-note-btn", "rad-lock-note-btn", "rad-unlock-note-btn"]);
  const forms = [
    document.getElementById("soap-form"),
    document.getElementById("radiology-form")
  ].filter(Boolean);

  forms.forEach(form => {
    const formElements = form.querySelectorAll("input, textarea, select, button");
    formElements.forEach(element => {
      if (protectedIds.has(element.id)) {
        return;
      }
      element.disabled = true;
      element.style.backgroundColor = "#f8f9fa";
      element.style.cursor = "not-allowed";
    });
  });

  console.log('Disabling form editing...');

  // Disable all action buttons in tables
  const actionButtons = document.querySelectorAll("button[onclick*='addNote'], button[onclick*='editEntry'], button[onclick*='deleteEntry']");
  actionButtons.forEach(button => {
    button.disabled = true;
    button.style.backgroundColor = "#f8f9fa";
    button.style.cursor = "not-allowed";
  });

  // Disable lab, imaging, and invoice buttons
  const orderButtons = document.querySelectorAll("#generate-lab-order, #generate-imaging-order, #generate-invoice-btn, #rad-generate-invoice-btn");
  orderButtons.forEach(button => {
    button.disabled = true;
    button.style.backgroundColor = "#f8f9fa";
    button.style.cursor = "not-allowed";
  });

  // Disable preventive care gap buttons
  const gapButtons = document.querySelectorAll("button[onclick*='markGapAddressed']");
  gapButtons.forEach(button => {
    button.disabled = true;
    button.style.backgroundColor = "#f8f9fa";
    button.style.cursor = "not-allowed";
  });
}

// Unlock clinical note
function unlockClinicalNote() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  const user = JSON.parse(localStorage.getItem("user"));
  
  if (!patientId || !visitDate || !user) {
    alert("Unable to unlock note. Missing required information.");
    return;
  }
  
  // Only Doctors can unlock notes
  if (user.role !== "Doctor") {
    alert("Only Doctors can unlock clinical notes.");
    return;
  }
  
  // Show reason input modal
  showUnlockReasonModal();
}

// Show lock confirmation modal
function showLockConfirmationModal() {
  // Remove any existing modal
  const existingModal = document.getElementById("lock-confirmation-modal");
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal
  const modal = document.createElement("div");
  modal.id = "lock-confirmation-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
    ">
      <h3 style="margin-top: 0; color: #333;">Lock Clinical Note</h3>
      <p style="color: #666; margin-bottom: 20px;">
        Are you sure you want to lock this clinical note? Once locked, it cannot be edited.
      </p>
      <div style="text-align: right;">
        <button id="cancel-lock" style="
          background-color: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
        ">Cancel</button>
        <button id="confirm-lock" style="
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Lock Note</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById("cancel-lock").addEventListener("click", () => {
    modal.remove();
  });
  
  document.getElementById("confirm-lock").addEventListener("click", () => {
    modal.remove();
    lockClinicalNote();
  });
  
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
  
  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  });
}

// Show unlock reason modal
function showUnlockReasonModal() {
  // Remove any existing modal
  const existingModal = document.getElementById("unlock-reason-modal");
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal
  const modal = document.createElement("div");
  modal.id = "unlock-reason-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
    ">
      <h3 style="margin-top: 0; color: #333;">Unlock Clinical Note</h3>
      <p style="color: #666; margin-bottom: 20px;">
        Please provide a reason for unlocking this clinical note:
      </p>
      <textarea id="unlock-reason-input" placeholder="Enter reason for unlocking..." style="
        width: 100%;
        height: 100px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        resize: vertical;
        box-sizing: border-box;
        margin-bottom: 20px;
      "></textarea>
      <div style="text-align: right;">
        <button id="cancel-unlock" style="
          background-color: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
        ">Cancel</button>
        <button id="confirm-unlock" style="
          background-color: #ffc107;
          color: black;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Unlock Note</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus on textarea immediately (use requestAnimationFrame for better performance)
  requestAnimationFrame(() => {
    const textarea = document.getElementById("unlock-reason-input");
    if (textarea) {
      textarea.focus();
      textarea.select(); // Select all text for easy replacement
    }
  });
  
  // Event listeners
  document.getElementById("cancel-unlock").addEventListener("click", () => {
    modal.remove();
  });
  
  document.getElementById("confirm-unlock").addEventListener("click", () => {
    console.log("Unlock Note button clicked");
    const textarea = document.getElementById("unlock-reason-input");
    if (!textarea) {
      console.error("Unable to find unlock-reason-input textarea");
      showNotification("Unable to access reason input.", "error");
      return;
    }
    
    const reason = textarea.value.trim();
    console.log("Unlock reason entered:", reason);
    if (!reason) {
      showNotification("Please provide a reason for unlocking the note.", "error");
      return;
    }
    
    console.log("Processing unlock note with reason:", reason);
    modal.remove();
    processUnlockNote(reason);
  });
  
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
  
  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  });
}

// Process unlock note with reason (Supabase-first)
async function processUnlockNote(reason) {
  console.log("processUnlockNote called with reason:", reason);
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  const user = JSON.parse(localStorage.getItem("user"));
  
  console.log("Unlock parameters:", { patientId, visitDate, user: user?.username });
  
  // Only Doctors can unlock notes
  if (user.role !== "Doctor") {
    alert("Only Doctors can unlock clinical notes.");
    return;
  }
  
  // Supabase-first: Load patients from Supabase, fallback to localStorage
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  const patient = patients.find(p => p.id === patientId);
  if (!patient) {
    showNotification("Patient not found.", "error");
    return;
  }
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit) {
    showNotification("Visit not found.", "error");
    return;
  }
  
  if (!visit.soap || !visit.soap.locked) {
    showNotification("This note is not currently locked.", "error");
    return;
  }
  
  // Add unlock entry to audit trail
  if (!visit.soap.auditTrail) {
    visit.soap.auditTrail = [];
  }
  
  const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
  visit.soap.auditTrail.push({
    action: 'unlocked',
    user: fullName,
    timestamp: new Date().toISOString(),
    reason: reason
  });
  
  // Unlock the note
  visit.soap.locked = false;
  // Keep the original lock information for audit purposes
  // visit.soap.lockedBy and visit.soap.lockedAt remain for historical reference
  
  // Audit log: Clinical note unlocked
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('clinical_note_unlocked', {
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      visitDate: visitDate,
      unlockedBy: fullName,
      reason: reason
    });
  }
  
  // Supabase-first: Save to Supabase, then localStorage as cache
  try {
    if (typeof savePatientToSupabase === 'function') {
      await savePatientToSupabase(patient);
      console.log('✅ Clinical note unlocked and saved to Supabase');
    }
  } catch (error) {
    console.error('Failed to save to Supabase, saving to localStorage only:', error);
  }
  
  // Save to localStorage as cache/fallback
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  console.log("Note unlocked and saved to localStorage");
  
  // Enable form editing
  enableFormEditing();
  console.log("Form editing enabled");
  hideUnlockButton();
  showLockButton();
  console.log("Buttons updated");
  
  // IMPORTANT: Do NOT reload the form after unlock to preserve user's current input
  // The form fields should retain their current values
  window._skipFormReload = true;
  window._skipAutoSave = true; // Temporarily disable auto-save to prevent conflicts
  
  // Hide electronic signature section
  const electronicSignature = document.getElementById("electronic-signature");
  if (electronicSignature) {
    electronicSignature.style.display = "none";
    console.log("Electronic signature section hidden");
  }
  
  // Trigger sync event
  window.dispatchEvent(new CustomEvent('patientDataUpdated', {
    detail: { patientId, action: 'clinicalNoteUnlocked', data: { visitDate, unlockedBy: user.username, reason: reason } }
  }));
  console.log("Sync event triggered");
  
  // Show non-blocking success notification
  showNotification("Clinical note has been unlocked. You can now make edits.", "success");
  console.log("Unlock process completed successfully");
  
  // Re-enable auto-save after a short delay to prevent conflicts
  setTimeout(() => {
    window._skipAutoSave = false;
    console.log("Auto-save re-enabled");
  }, 1000);
}

// Show unlock button
function showUnlockButton() {
  const buttons = [
    document.getElementById("unlock-note-btn"),
    document.getElementById("rad-unlock-note-btn")
  ];

  buttons.forEach(btn => {
    if (!btn) return;
    btn.style.display = "inline-block";
    btn.disabled = false;
    btn.style.backgroundColor = "#ffc107";
    btn.style.cursor = "pointer";
  });
}

// Hide unlock button
function hideUnlockButton() {
  const buttons = [
    document.getElementById("unlock-note-btn"),
    document.getElementById("rad-unlock-note-btn")
  ];

  buttons.forEach(btn => {
    if (!btn) return;
    btn.style.display = "none";
    btn.disabled = true;
  });
}

// Show lock button
function showLockButton() {
  const buttons = [
    document.getElementById("lock-note-btn"),
    document.getElementById("rad-lock-note-btn")
  ];

  buttons.forEach(btn => {
    if (!btn) return;
    btn.style.display = "inline-block";
    btn.disabled = false;
    btn.style.backgroundColor = "#dc3545";
    btn.style.cursor = "pointer";
  });
}

// Enable form editing
function enableFormEditing() {
  const protectedIds = new Set(["lock-note-btn", "unlock-note-btn", "rad-lock-note-btn", "rad-unlock-note-btn"]);
  const forms = [
    document.getElementById("soap-form"),
    document.getElementById("radiology-form")
  ].filter(Boolean);

  console.log('Enabling form editing...');

  forms.forEach(form => {
    const formElements = form.querySelectorAll("input, textarea, select, button");
    formElements.forEach(element => {
      if (protectedIds.has(element.id)) {
        return;
      }
      element.disabled = false;
      element.style.backgroundColor = "";
      element.style.cursor = "";
    });
  });

  // Enable all action buttons in tables
  const actionButtons = document.querySelectorAll("button[onclick*='addNote'], button[onclick*='editEntry'], button[onclick*='deleteEntry']");
  actionButtons.forEach(button => {
    button.disabled = false;
    button.style.backgroundColor = "";
    button.style.cursor = "";
  });

  // Enable lab, imaging, and invoice buttons
  const orderButtons = document.querySelectorAll("#generate-lab-order, #generate-imaging-order, #generate-invoice-btn, #rad-generate-invoice-btn");
  orderButtons.forEach(button => {
    button.disabled = false;
    button.style.backgroundColor = "";
    button.style.cursor = "";
  });

  // Enable preventive care gap buttons
  const gapButtons = document.querySelectorAll("button[onclick*='markGapAddressed']");
  gapButtons.forEach(button => {
    button.disabled = false;
    button.style.backgroundColor = "";
    button.style.cursor = "";
  });
}
// Hide unlock button
function hideUnlockButton() {
  const buttons = [
    document.getElementById("unlock-note-btn"),
    document.getElementById("rad-unlock-note-btn")
  ];

  buttons.forEach(btn => {
    if (!btn) return;
    btn.style.display = "none";
    btn.disabled = true;
  });
}

// Show lock button
function showLockButton() {
  const buttons = [
    document.getElementById("lock-note-btn"),
    document.getElementById("rad-lock-note-btn")
  ];

  buttons.forEach(btn => {
    if (!btn) return;
    btn.style.display = "inline-block";
    btn.disabled = false;
    btn.style.backgroundColor = "#dc3545";
    btn.style.cursor = "pointer";
  });
}

// Enable form editing
function enableFormEditing() {
  const protectedIds = new Set(["lock-note-btn", "unlock-note-btn", "rad-lock-note-btn", "rad-unlock-note-btn"]);
  const forms = [
    document.getElementById("soap-form"),
    document.getElementById("radiology-form")
  ].filter(Boolean);

  console.log('Enabling form editing...');

  forms.forEach(form => {
    const formElements = form.querySelectorAll("input, textarea, select, button");
    formElements.forEach(element => {
      if (protectedIds.has(element.id)) {
        return;
      }
      element.disabled = false;
      element.style.backgroundColor = "";
      element.style.cursor = "";
    });
  });

  // Enable all action buttons in tables
  const actionButtons = document.querySelectorAll("button[onclick*='addNote'], button[onclick*='editEntry'], button[onclick*='deleteEntry']");
  actionButtons.forEach(button => {
    button.disabled = false;
    button.style.backgroundColor = "";
    button.style.cursor = "";
  });

  // Enable lab, imaging, and invoice buttons
  const orderButtons = document.querySelectorAll("#generate-lab-order, #generate-imaging-order, #generate-invoice-btn, #rad-generate-invoice-btn");
  orderButtons.forEach(button => {
    button.disabled = false;
    button.style.backgroundColor = "";
    button.style.cursor = "";
  });

  // Enable preventive care gap buttons
  const gapButtons = document.querySelectorAll("button[onclick*='markGapAddressed']");
  gapButtons.forEach(button => {
    button.disabled = false;
    button.style.backgroundColor = "";
    button.style.cursor = "";
  });
}

// Normalize visit date for comparison (e.g. 2026-02-10 vs 2/10/2026)
function normalizeVisitDateForCompare(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Save generated referral to patient's chart
function saveGeneratedReferralToChart(referralData, patientId, visitDate) {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patientIdStr = String(patientId || '').trim();
  const patient = patients.find(p =>
    p.id === patientIdStr ||
    (p.patient_id && String(p.patient_id) === patientIdStr) ||
    (p.patientNumber && String(p.patientNumber) === patientIdStr) ||
    (p._supabaseUuid && p._supabaseUuid === patientIdStr)
  );
  if (!patient) {
    console.warn("saveGeneratedReferralToChart: Patient not found for id:", patientIdStr);
    return;
  }

  if (!patient.visits || !Array.isArray(patient.visits)) {
    patient.visits = [];
  }

  const visitDateNorm = normalizeVisitDateForCompare(visitDate);
  let visit = patient.visits.find(v => {
    const vNorm = normalizeVisitDateForCompare(v.date);
    return v.date === visitDate || vNorm === visitDateNorm || vNorm === visitDate;
  });

  if (!visit) {
    visit = { date: visitDate, referrals: [] };
    patient.visits.push(visit);
  }

  if (!visit.referrals) {
    visit.referrals = [];
  }

  const referralRecord = {
    type: 'referral',
    specialistId: referralData.specialistId,
    specialistName: referralData.specialistName,
    diagnoses: referralData.diagnoses,
    note: referralData.note,
    urgency: referralData.urgency,
    timestamp: referralData.timestamp,
    status: 'Generated',
    attachments: []
  };

  visit.referrals.push(referralRecord);
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));

  if (typeof window.savePatientToSupabase === 'function') {
    window.savePatientToSupabase(patient).catch(err => console.warn('Referral saved locally; Supabase sync failed:', err));
  }

  console.log("Referral saved to visit.referrals:", referralRecord);
  console.log("Visit referrals count:", visit.referrals.length);
}

// Display patient-reported medications in the table
function displayPatientMedications(patient) {
  const tableBody = document.querySelector('.patient-medications-table tbody');
  if (!tableBody) {
    // Patient medications table body not found
    return;
  }
  
  // Clear existing rows
  tableBody.innerHTML = '';
  
  if (!patient.medications || patient.medications.length === 0) {
    // Don't add placeholder text inside the table - let the placeholder div below handle it
    const placeholder = document.getElementById('patient-medications-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
    }
    return;
  }
  
  // Hide placeholder when medications exist
  const placeholder = document.getElementById('patient-medications-placeholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
  
  // Add medication rows
  patient.medications.forEach(med => {
    const row = tableBody.insertRow();
    row.insertCell(0).textContent = med.name || 'N/A';
    row.insertCell(1).textContent = med.dosage || 'N/A';
    row.insertCell(2).textContent = med.startDate || med.dateAdded || 'N/A';
    row.insertCell(3).textContent = med.endDate || 'N/A';
    row.insertCell(4).textContent = med.notes || 'N/A';
    row.insertCell(5).innerHTML = '<button onclick="deleteMedication(\'' + med.id + '\')">Delete</button>';
  });
  
  // Patient medications displayed
}

// Migrate existing referrals from SOAP plan to visit referrals
function migrateExistingReferrals(patient) {
  let needsUpdate = false;
  
  // Safety check for patient.visits
  if (!patient.visits || !Array.isArray(patient.visits)) {
    // Patient visits initialized as empty array
    patient.visits = [];
    return false;
  }
  
  patient.visits.forEach(visit => {
    if (visit.soap && visit.soap.plan && visit.soap.plan.referrals && visit.soap.plan.referrals.length > 0) {
      // Initialize visit.referrals if it doesn't exist
      if (!visit.referrals) {
        visit.referrals = [];
      }
      
      // Check if referrals need to be migrated
      visit.soap.plan.referrals.forEach(soapReferral => {
        const existsInVisitReferrals = visit.referrals.some(visitReferral => 
          visitReferral.specialistId === soapReferral.specialistId && 
          visitReferral.timestamp === soapReferral.timestamp
        );
        
        if (!existsInVisitReferrals) {
          // Migrate the referral
          const migratedReferral = {
            type: 'referral',
            specialistId: soapReferral.specialistId,
            specialistName: soapReferral.specialistName,
            diagnoses: soapReferral.diagnoses,
            note: soapReferral.note,
            urgency: soapReferral.urgency || 'routine',
            timestamp: soapReferral.timestamp,
            status: 'Generated'
          };
          
          visit.referrals.push(migratedReferral);
          needsUpdate = true;
        }
      });
    }
  });
  
  if (needsUpdate) {
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patientIndex = patients.findIndex(p => p.id === patient.id);
    if (patientIndex !== -1) {
      patients[patientIndex] = patient;
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log("Migrated existing referrals for patient:", patient.id);
    }
  }
}

// Display generated referrals
function displayGeneratedReferrals(patient, visitDate = null) {
  const tbody = document.getElementById("generated-referrals-list");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  const allReferrals = [];
  
  console.log("Displaying referrals for patient:", patient.id, visitDate ? `for visit: ${visitDate}` : "for all visits");
  
  // First, migrate any existing referrals
  migrateExistingReferrals(patient);
  
  patient.visits.forEach(visit => {
    // If visitDate is specified, only process referrals for that visit
    if (visitDate && visit.date !== visitDate) {
      return;
    }
    
    console.log("Checking visit:", visit.date);
    
    // Check both visit.referrals and visit.soap.plan.referrals
    const visitReferrals = visit.referrals || [];
    const soapReferrals = (visit.soap && visit.soap.plan && visit.soap.plan.referrals) ? visit.soap.plan.referrals : [];
    
    console.log("Visit referrals:", visitReferrals.length);
    console.log("SOAP referrals:", soapReferrals.length);
    
    // Add referrals from visit.referrals
    visitReferrals.forEach(referral => {
      allReferrals.push({
        ...referral,
        visitDate: visit.date
      });
    });
    
    // Add referrals from visit.soap.plan.referrals (if not already added)
    soapReferrals.forEach(referral => {
      // Check if this referral is already in allReferrals (avoid duplicates)
      const isDuplicate = allReferrals.some(existing => 
        existing.specialistId === referral.specialistId && 
        existing.timestamp === referral.timestamp
      );
      
      if (!isDuplicate) {
        allReferrals.push({
          ...referral,
          visitDate: visit.date,
          status: referral.status || 'Generated'
        });
      }
    });
  });
  
  console.log("Total referrals found:", allReferrals.length);
  
  allReferrals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (allReferrals.length === 0) {
    // Show placeholder below table instead of inside it
    const placeholder = document.getElementById('referrals-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
    }
    return;
  }
  
  allReferrals.forEach(referral => {
    const row = document.createElement("tr");
    const date = new Date(referral.timestamp).toLocaleDateString();
    const diagnoses = referral.diagnoses ? referral.diagnoses.join(", ") : "No diagnoses";
    const status = referral.status || 'Generated';
    const attachments = referral.attachments || [];
    const attachCount = attachments.length;
    const tsEscaped = String(referral.timestamp).replace(/'/g, "\\'");
    const visitDateEscaped = String(referral.visitDate || '').replace(/'/g, "\\'");
    const patientIdEscaped = String(patient.id || '').replace(/'/g, "\\'");

    row.innerHTML = `
      <td>${date}</td>
      <td>${referral.specialistName}</td>
      <td>${diagnoses}</td>
      <td>${status}</td>
      <td>
        <button type="button" class="attach-referral-btn btn-small" data-patient-id="${patient.id}" data-visit-date="${referral.visitDate}" data-referral-timestamp="${referral.timestamp}">📎 Attach</button>
        <button type="button" class="view-referral-attachments-btn btn-small" data-patient-id="${patient.id}" data-visit-date="${referral.visitDate}" data-referral-timestamp="${referral.timestamp}" ${attachCount === 0 ? 'disabled' : ''}>📂 View (${attachCount})</button>
      </td>
      <td>
        <button type="button" class="view-details-btn" onclick="viewReferralDetails('${patientIdEscaped}', '${visitDateEscaped}', '${tsEscaped}')">
          View Details
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Delegated handlers for Attach / View attachments (avoid inline timestamp escaping)
  const section = document.getElementById("generated-referrals-section");
  if (section) {
    section.querySelectorAll(".attach-referral-btn").forEach(btn => {
      btn.onclick = function() {
        const pid = this.getAttribute("data-patient-id");
        const vd = this.getAttribute("data-visit-date");
        const ts = this.getAttribute("data-referral-timestamp");
        if (pid && vd && ts) window.addReferralAttachment(pid, vd, ts);
      };
    });
    section.querySelectorAll(".view-referral-attachments-btn").forEach(btn => {
      btn.onclick = function() {
        if (btn.disabled) return;
        const pid = this.getAttribute("data-patient-id");
        const vd = this.getAttribute("data-visit-date");
        const ts = this.getAttribute("data-referral-timestamp");
        if (pid && vd && ts) window.viewReferralAttachments(pid, vd, ts);
      };
    });
  }
}

// View referral details in modal
function viewReferralDetails(patientId, visitDate, timestamp) {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  const visit = patient.visits.find(v => v.date === visitDate);
  if (!visit || !visit.referrals) return;
  
  const referral = visit.referrals.find(r => r.timestamp === timestamp);
  if (!referral) return;
  
  const user = JSON.parse(localStorage.getItem("user"));
  createReferralModal(referral, patient, user, visitDate);
}

// Add external medical record (e.g. specialist note) to a referral; stored in referral.attachments and in patient documents / Referral Notes folder
window.addReferralAttachment = function(patientId, visitDate, timestamp) {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p =>
    p.id === patientId || (p.patient_id && String(p.patient_id) === patientId) ||
    (p.patientNumber && String(p.patientNumber) === patientId) || (p._supabaseUuid && p._supabaseUuid === patientId)
  );
  if (!patient) return;
  const visit = (patient.visits || []).find(v => v.date === visitDate);
  if (!visit || !visit.referrals) return;
  const referral = visit.referrals.find(r => String(r.timestamp) === String(timestamp));
  if (!referral) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt";
  input.multiple = true;
  input.onchange = function(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!referral.attachments) referral.attachments = [];
    let processed = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(ev) {
        referral.attachments.push({
          id: "ref_" + Date.now() + "_" + Math.random().toString(36).slice(2),
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          data: ev.target.result,
          uploadDate: new Date().toISOString()
        });
        processed++;
        if (processed === files.length) {
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          if (typeof window.savePatientToSupabase === "function") {
            window.savePatientToSupabase(patient).catch(function() {});
          }
          if (typeof displayGeneratedReferrals === "function") {
            displayGeneratedReferrals(patient, visitDate);
          }
          window.dispatchEvent(new CustomEvent("patientDataUpdated", { detail: { patientId: patient.id, action: "referralAttachmentAdded" } }));
        }
      };
      reader.readAsDataURL(file);
    });
  };
  input.click();
};

// View referral attachments (external medical records) in a modal; view/download each
window.viewReferralAttachments = function(patientId, visitDate, timestamp) {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p =>
    p.id === patientId || (p.patient_id && String(p.patient_id) === patientId) ||
    (p.patientNumber && String(p.patientNumber) === patientId) || (p._supabaseUuid && p._supabaseUuid === patientId)
  );
  if (!patient) return;
  const visit = (patient.visits || []).find(v => v.date === visitDate);
  if (!visit || !visit.referrals) return;
  const referral = visit.referrals.find(r => String(r.timestamp) === String(timestamp));
  if (!referral || !referral.attachments || referral.attachments.length === 0) return;

  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;";
  const content = document.createElement("div");
  content.style.cssText = "background:white;padding:20px;border-radius:8px;max-width:560px;max-height:85vh;overflow-y:auto;";
  content.innerHTML = "<h3 style=\"margin-top:0;\">Referral attachments – " + (referral.specialistName || "Specialist") + "</h3>";
  referral.attachments.forEach(function(att) {
    const div = document.createElement("div");
    div.style.cssText = "border:1px solid #ddd;padding:10px;margin:8px 0;border-radius:4px;";
    const label = (att.fileName || "Document").replace(/</g, "&lt;");
    const up = att.uploadDate ? new Date(att.uploadDate).toLocaleDateString() : "";
    div.innerHTML = "<strong>" + label + "</strong><br><small>Uploaded: " + up + "</small><br>";
    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.type = "button";
    viewBtn.style.cssText = "background:#007bff;color:white;padding:5px 10px;margin:4px 4px 4px 0;border:none;border-radius:4px;cursor:pointer;";
    viewBtn.onclick = function() {
      if (!att.data) return;
      const w = window.open("", "_blank");
      if (att.fileType && att.fileType.indexOf("pdf") !== -1) {
        w.document.write("<iframe src=\"" + att.data + "\" style=\"width:100%;height:100%;border:0;\"></iframe>");
      } else if (att.fileType && att.fileType.indexOf("image") !== -1) {
        w.document.write("<img src=\"" + att.data + "\" style=\"max-width:100%;\" />");
      } else {
        w.location.href = att.data;
      }
    };
    const downloadLink = document.createElement("a");
    downloadLink.href = att.data || "#";
    downloadLink.download = att.fileName || "document";
    downloadLink.textContent = "Download";
    downloadLink.style.cssText = "background:#28a745;color:white;padding:5px 10px;margin:4px;border-radius:4px;text-decoration:none;display:inline-block;";
    div.appendChild(viewBtn);
    div.appendChild(downloadLink);
    content.appendChild(div);
  });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = "margin-top:12px;background:#6c757d;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;";
  closeBtn.onclick = function() { modal.remove(); };
  content.appendChild(closeBtn);
  modal.appendChild(content);
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};

// Create referral modal
function createReferralModal(referral, patient, user, visitDate) {
  // Remove any existing modal
  const existingModal = document.getElementById("referral-modal");
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement("div");
  modal.id = "referral-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  const referralHTML = generateReferralHTML(referral, patient, user, visitDate);
  
  modal.innerHTML = `
    <div style="
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 800px;
      width: 90%;
      max-height: 90%;
      overflow-y: auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #333;">Referral Letter</h2>
        <div>
          <button onclick="printReferralModal()" style="
            background-color: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
          ">Print</button>
          <button onclick="closeReferralModal()" style="
            background-color: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          ">Close</button>
        </div>
      </div>
      <div id="referral-content">
        ${referralHTML}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Generate referral HTML
function generateReferralHTML(referral, patient, user, visitDate) {
  const currentDate = new Date().toLocaleDateString();
  const diagnoses = referral.diagnoses.join(", ");
  
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">REFERRAL LETTER</h1>
        <p style="color: #666; font-size: 14px;">Date: ${currentDate}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p><strong>To:</strong> ${referral.specialistName}</p>
        <p><strong>From:</strong> ${user.username} (${user.role})</p>
        <p><strong>Organization:</strong> ${user.org}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">Patient Information</h3>
        <p><strong>Name:</strong> ${patient.firstName} ${patient.middleName || ''} ${patient.lastName}</p>
        <p><strong>Date of Birth:</strong> ${patient.dob}</p>
        <p><strong>Gender:</strong> ${patient.gender}</p>
        <p><strong>Patient ID:</strong> ${typeof window.patientMrnDisplay === 'function' ? window.patientMrnDisplay(patient, patientId) : (getPatientIdentifier(patient) || patient.patient_id || patient.patientNumber || 'Unknown ID')}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">Referral Details</h3>
        <p><strong>Visit Date:</strong> ${visitDate}</p>
        <p><strong>Diagnoses for Referral:</strong> ${diagnoses}</p>
        <p><strong>Referral Note:</strong></p>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 10px 0;">
          ${referral.note}
        </div>
      </div>
      
      <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
        <p>This referral was generated electronically on ${currentDate}</p>
        <p>Generated by: ${user.username} (${user.role})</p>
      </div>
    </div>
  `;
}

// Close referral modal
function closeReferralModal() {
  const modal = document.getElementById("referral-modal");
  if (modal) {
    modal.remove();
  }
}

// Print referral modal
function printReferralModal() {
  const content = document.getElementById("referral-content");
  if (content) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Referral Letter</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}

// Show non-blocking notification
function showNotification(message, type = "info") {
  // Remove any existing notifications
  const existingNotification = document.getElementById("notification");
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement("div");
  notification.id = "notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `;
  
  // Set background color based on type
  switch (type) {
    case "success":
      notification.style.backgroundColor = "#28a745";
      break;
    case "error":
      notification.style.backgroundColor = "#dc3545";
      break;
    case "warning":
      notification.style.backgroundColor = "#ffc107";
      notification.style.color = "#000";
      break;
    default:
      notification.style.backgroundColor = "#007bff";
  }
  
  notification.textContent = message;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.style.animation = "slideOut 0.3s ease-in";
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 4000);
  
  // Add click to dismiss
  notification.addEventListener("click", () => {
    if (notification && notification.parentNode) {
      notification.style.animation = "slideOut 0.3s ease-in";
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  });
}

// View PDF signature in new window
function viewSignaturePDF(signatureData) {
  const newWindow = window.open('', '_blank', 'width=800,height=600');
  newWindow.document.write(`
    <html>
      <head>
        <title>Doctor's Signature</title>
        <style>
          body { margin: 0; padding: 20px; text-align: center; background-color: #f5f5f5; }
          .signature-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: inline-block; }
          h1 { color: #333; margin-bottom: 20px; }
          iframe { border: 1px solid #ddd; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="signature-container">
          <h1>Doctor's Digital Signature</h1>
          <iframe src="${signatureData}" width="600" height="400"></iframe>
          <p style="margin-top: 15px; color: #666; font-size: 14px;">
            This is the doctor's handwritten signature used for electronic signing of clinical notes.
          </p>
        </div>
      </body>
    </html>
  `);
  newWindow.document.close();
}

// Debounce function for auto-save
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
// Auto-save function for clinical note
function autoSaveClinicalNote() {
  // Prevent auto-save if we're in the middle of unlocking or form reload
  if (window._skipAutoSave) {
    console.log("Skipping auto-save to prevent conflicts");
    return;
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  const visitDate = urlParams.get("visitDate");
  
  if (!patientId || !visitDate) return;
  
  // Get current patient and visit data (cache to avoid repeated parsing)
  if (!window._patientsCache) {
    window._patientsCache = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  const patients = window._patientsCache;
  
  // Find patient by UUID, patient_id, or display ID
  const patient = patients.find(p => 
    p.id === patientId || 
    p.patient_id === patientId || 
    p._supabaseUuid === patientId ||
    (p.id && p.id.includes('-') && p.id.length === 36 && patientId.includes('-') && patientId.length === 36 && p.id === patientId)
  );
  
  if (!patient) {
    console.warn('Auto-save: Patient not found for ID:', patientId);
    return;
  }
  
  const visit = (patient.visits || []).find(v => v.date === visitDate);
  if (!visit) return;
  
  // Initialize SOAP if it doesn't exist
  if (!visit.soap) {
    visit.soap = { subjective: {}, objective: {}, assessment: {}, plan: {} };
  }
  if (!visit.soap.objective) {
    visit.soap.objective = {};
  }
  
  // Save lab selections
  const selectedLabs = Array.from(document.querySelectorAll(".lab-check:checked")).map(cb => cb.value);
  const noLabsCheckbox = document.getElementById("no-labs");
  const noLabs = noLabsCheckbox ? noLabsCheckbox.checked : false;
  visit.soap.objective.labOrders = selectedLabs;
  visit.soap.objective.noLabs = noLabs;
  
  // Save imaging selections
  const selectedImaging = Array.from(document.querySelectorAll(".imaging-check:checked")).map(cb => cb.value);
  const noImagingCheckbox = document.getElementById("no-imaging");
  const noImaging = noImagingCheckbox ? noImagingCheckbox.checked : false;
  visit.soap.objective.imagingOrders = selectedImaging;
  visit.soap.objective.noImaging = noImaging;
  
  // Save all form fields
  const form = document.getElementById("soap-form");
  if (form) {
    // Initialize SOAP sections
    if (!visit.soap.subjective) visit.soap.subjective = {};
    if (!visit.soap.objective) visit.soap.objective = {};
    if (!visit.soap.assessment) visit.soap.assessment = {};
    if (!visit.soap.plan) visit.soap.plan = {};
    
    // Explicit field-to-section mapping for accurate persistence
    const fieldSectionMap = {
      // Subjective fields
      'cc': 'subjective',
      'hpi': 'subjective',
      'fh': 'subjective',
      'sh': 'subjective',
      'ros': 'subjective',
      // Objective fields
      'physical': 'objective',
      'labs': 'objective',
      // Assessment fields
      'differential': 'assessment',
      'status': 'assessment',
      // Plan fields
      'treatments': 'plan',
      'testing': 'plan',
      'education': 'plan',
      'followup': 'plan',
      'followUp': 'plan'
    };
    
    // Save textarea values with explicit section mapping
    const textareas = form.querySelectorAll("textarea");
    textareas.forEach(textarea => {
      if (textarea.id) {
        // Use explicit mapping if available, otherwise fall back to DOM-based detection
        let section = fieldSectionMap[textarea.id];
        
        if (!section) {
          // Fallback: Determine section based on ID or position
          section = "subjective";
          if (textarea.id.includes("objective") || textarea.closest("h2")?.textContent.includes("Objective")) {
            section = "objective";
          } else if (textarea.id.includes("assessment") || textarea.closest("h2")?.textContent.includes("Assessment")) {
            section = "assessment";
          } else if (textarea.id.includes("plan") || textarea.closest("h2")?.textContent.includes("Plan")) {
            section = "plan";
          }
        }
        
        visit.soap[section][textarea.id] = textarea.value;
        
        // Special handling for follow-up field
        if (textarea.id === 'followup' || textarea.id === 'followUp') {
          // Also save to followUp for backward compatibility
          visit.soap.plan.followup = textarea.value;
          visit.soap.plan.followUp = textarea.value;
          // Force immediate save for follow-up field
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        }
      }
    });
    
    // Save input values (excluding temporary note inputs)
    const inputs = form.querySelectorAll("input[type='text'], input[type='date']");
    inputs.forEach(input => {
      if (input.id && !input.id.includes("note-")) {
        // Use explicit mapping if available
        let section = fieldSectionMap[input.id];
        
        if (!section) {
          // Fallback: Determine section based on ID or position
          section = "subjective";
          if (input.id.includes("objective") || input.closest("h2")?.textContent.includes("Objective")) {
            section = "objective";
          } else if (input.id.includes("assessment") || input.closest("h2")?.textContent.includes("Assessment")) {
            section = "assessment";
          } else if (input.id.includes("plan") || input.closest("h2")?.textContent.includes("Plan")) {
            section = "plan";
          }
        }
        
        visit.soap[section][input.id] = input.value;
      }
    });
  }
  
  // HYBRID ARCHITECTURE: Save to Supabase first, then localStorage (debounced to avoid excessive writes)
  if (!window._saveTimeout) {
    window._saveTimeout = setTimeout(async () => {
      // HYBRID ARCHITECTURE STEP 1: Try Supabase first
      if (typeof window.savePatientToSupabase === 'function' && window.supabaseClient) {
        try {
          // Save to Supabase first (non-blocking, async)
          await window.savePatientToSupabase(patient);
          // Success - data saved to Supabase, continue to cache in localStorage
        } catch (error) {
          // Supabase save failed - fall through to localStorage fallback
          console.warn('⚠️ Auto-save: Supabase save failed, using localStorage fallback:', error);
        }
      }
      
      // HYBRID ARCHITECTURE STEP 2: Always cache to localStorage (fallback or cache)
      // Check if this is the first time the note has meaningful content (created vs updated)
      const isNewNote = !visit.soap._noteCreated && (
        visit.soap.subjective.cc || visit.soap.subjective.hpi || 
        visit.soap.assessment.differential || visit.soap.plan.treatments
      );
      
      // Mark as created
      if (isNewNote) {
        visit.soap._noteCreated = true;
        
        // Audit log: Clinical note created
        if (typeof logAuditEvent !== 'undefined') {
          logAuditEvent('clinical_note_created', {
            patientId: patientId,
            patientName: patient.firstName + ' ' + patient.lastName,
            visitDate: visitDate
          });
        }
      }
      
      // Cache to localStorage (always done - either as fallback or after Supabase success)
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      
      // Clear cache to ensure fresh data on next load
      window._patientsCache = null;
      window._saveTimeout = null;
      
      // Trigger custom event for real-time sync
      window.dispatchEvent(new CustomEvent('patientDataUpdated', {
        detail: { patientId, action: 'clinicalNoteUpdated', data: { visitDate } }
      }));
      
      console.log("Clinical note auto-saved to localStorage and Supabase");
    }, 100); // 100ms debounce for localStorage writes
  }
}

// Run on page load
window.addEventListener('load', function() {
  // Migrate existing patients to include payment source
  migratePatientPaymentSource();
  // Global load event triggered
  if (document.getElementById("patient-list")) {
    // On patients.html, calling migratePatientIds and loadPatients
    migratePatientIds(); // Migrate existing patients to new ID format
    loadPatients();
  }
  if (document.getElementById("patient-info")) {
    // Only load patient details if we're on patient-details.html (has "id" parameter)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("id")) {
      // loadPatientDetails already calls displayGaps internally, so no need to call it again here
    loadPatientDetails();  // For patient-details.html
    }
  }
  if (document.getElementById("edit-patient-form")) {
    loadEditForm();  // For edit-patient.html
  }
  if (document.getElementById("add-patient-form")) {
    setupIcdSearch();  // For add-patient.html
  }
  if (document.getElementById("deleted-list")) {
    loadDeletedPatients();  // For deleted-patients.html
  }
  if (document.getElementById("soap-form")) {
    loadClinicalNote();  // For clinical-note.html
  }
});

// New: Edit referral on clinical-note
window.editReferral = function(index) {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  const visit = patient.visits.find(v => v.date === visitDate);
  const referral = visit.soap.plan.referrals[index];
  document.getElementById("referral-specialist").value = referral.specialistId;
  document.getElementById("referral-note").value = referral.note;
  document.getElementById("referral-urgency").value = referral.urgency || 'routine';
  const checkboxes = document.getElementById("referral-diagnoses").querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(cb => {
    cb.checked = referral.diagnoses.includes(cb.value);
  });
  // Change button to "Update Referral"
  document.getElementById("generate-referral").textContent = "Update Referral";
  // Set a flag or data attribute for update mode
  document.getElementById("generate-referral").dataset.editIndex = index;
};

// New: Delete referral on clinical-note
window.deleteReferral = function(index) {
  if (!confirm("Are you sure you want to delete this referral?")) return;
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  const visit = patient.visits.find(v => v.date === visitDate);
  visit.soap.plan.referrals.splice(index, 1);
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  
  // Update referrals display without reloading the entire form
  // Only show referrals for the current visit
  if (patient) {
    displayGeneratedReferrals(patient, visitDate);
  }
};

// New: Redirect to add-appointment.html with patient pre-selected
window.addNewVisit = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("id");
  if (patientId) {
    window.location.href = `/add-appointment?patientId=${patientId}`;
  } else {
    alert("Patient ID not found.");
  }
};

window.backToPatients = function() {
  window.location.href = "/patients";
};

window.backToDashboard = function() {
    window.location.href = "/dashboard";
};

window.viewPatientDocuments = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("id");
  if (patientId) {
    window.location.href = `/patient-documents?patientId=${patientId}`;
  } else {
    alert("Patient ID not found. Please ensure you're on a valid patient page.");
  }
};

// Non-Visit Encounters Functions
window.viewAllEncounters = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("id");
  window.location.href = `/patient-encounters?patientId=${patientId}`;
};

window.addPatientEncounter = function() {
  console.log("addPatientEncounter function called");
  const urlParams = new URLSearchParams(window.location.search);
  // Check for both parameter names for compatibility
  const patientId = urlParams.get("patientId") || urlParams.get("id");
  console.log("addPatientEncounter - Current URL:", window.location.href);
  console.log("addPatientEncounter - Patient ID from URL:", patientId);
  
  if (!patientId) {
    console.error("No patient ID found, cannot navigate to encounters page");
    alert("Patient ID not found. Please refresh the page and try again.");
    return;
  }
  
  console.log("Navigating to patient encounters page...");
  window.location.href = `/patient-encounters?patientId=${patientId}`;
};

function displayEncountersSummary(encounters) {
  const tbody = document.getElementById("encounters-list");
  if (!tbody) return;

  tbody.innerHTML = "";
  
  if (!encounters || encounters.length === 0) {
    tbody.innerHTML = ''; // Empty table body, footnote will show message
    return;
  }

  // Show only the 5 most recent encounters
  const recentEncounters = encounters.slice(-5).reverse();
  
  recentEncounters.forEach((encounter, index) => {
    const row = document.createElement("tr");
    const statusColor = encounter.status === 'Resolved' ? 'green' : encounter.status === 'Pending' ? 'orange' : 'red';
    
    row.innerHTML = `
      <td>${encounter.date}</td>
      <td>${encounter.reason}</td>
      <td>${encounter.assignedDoctor || 'Unassigned'}</td>
      <td style="color: ${statusColor}; font-weight: bold;">${encounter.status || 'Open'}</td>
      <td>
        <div style="display: flex; gap: 1px; flex-wrap: nowrap; align-items: center;">
          <button type="button" onclick="viewEncounterSummary('${encounter.id}')">View</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.viewEncounterSummary = function(encounterId) {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("id");
  
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  const encounter = patient.encounters.find(e => e.id == encounterId);

  if (!encounter) {
    alert("Encounter not found.");
    return;
  }

  let responsesHtml = "";
  if (encounter.responses && encounter.responses.length > 0) {
    responsesHtml = `
      <h4>Responses (${encounter.responses.length}):</h4>
      <div style="max-height: 200px; overflow-y: auto;">
        ${encounter.responses.map(response => `
          <div style="background: #f8f9fa; padding: 8px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #4CAF50;">
            <div style="font-weight: bold; color: #333; font-size: 12px;">${response.doctor} - ${response.date}</div>
            <div style="margin-top: 3px; font-size: 12px;">${response.message}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  const modalHtml = `
    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 600px; margin: 20px auto;">
      <h3>${encounter.reason}</h3>
      <p><strong>Date:</strong> ${encounter.date}</p>
      <p><strong>Assigned Doctor:</strong> ${encounter.assignedDoctor || 'Unassigned'}</p>
      <p><strong>Status:</strong> <span style="color: ${encounter.status === 'Resolved' ? 'green' : encounter.status === 'Pending' ? 'orange' : 'red'};">${encounter.status || 'Open'}</span></p>
      
      <div style="margin: 15px 0;">
        <h4>Message:</h4>
        <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; white-space: pre-wrap; font-size: 14px;">${encounter.message}</div>
      </div>
      
      ${responsesHtml}
      
      <div style="margin-top: 20px; text-align: center;">
        <button onclick="closeEncounterSummaryModal()" style="background: #6c757d; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">Close</button>
        <button onclick="viewAllEncounters()" style="background: #4CAF50; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">View All Encounters</button>
      </div>
    </div>
  `;

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'encounter-summary-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  modal.innerHTML = modalHtml;
  document.body.appendChild(modal);
}

window.closeEncounterSummaryModal = function() {
  const modal = document.getElementById('encounter-summary-modal');
  if (modal) {
    modal.remove();
  }
}

// CSV export function
function exportPatientsToCSV() {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  let csv = "ID,Name,DOB,Gender\n";  // Updated headers
  patients.forEach(p => {
    // CRITICAL: Always use legacy ID, never UUID
    const displayId = window.getLegacyPatientId ? window.getLegacyPatientId(p) : (window.getPatientIdentifier ? window.getPatientIdentifier(p) : (p.patient_id || p.patientNumber || 'TEMP0001'));
    csv += `${displayId},${p.firstName} ${p.lastName},${p.dob},${p.gender}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "patients.csv";
  a.click();
}

// Attach export button listener
const exportBtn = document.getElementById("export-btn");
if (exportBtn) {
  exportBtn.addEventListener("click", exportPatientsToCSV);
}

// New: Display upcoming appointments
function displayUpcomingAppointments(patientId) {
  const tbody = document.getElementById("upcoming-appointments");
  if (!tbody) {
    console.log('upcoming-appointments element not found, skipping display');
    return;
  }
  
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  
  if (!patient) {
    tbody.innerHTML = ""; // Empty table body, footnote will show message
    return;
  }
  
  const fullName = `${patient.firstName} ${patient.lastName}`;
  const upcoming = appointments.filter(appt => appt.patientName === fullName && new Date(appt.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  tbody.innerHTML = "";
  upcoming.forEach(appt => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${appt.date}</td>
      <td>${appt.time}</td>
      <td>${appt.doctor || 'N/A'}</td>
      <td>${appt.notes || 'N/A'}</td>
    `;
    tbody.appendChild(row);
  });
  if (upcoming.length === 0) {
    tbody.innerHTML = ""; // Empty table body, footnote will show message
  }
};

// New: Open patient summary page from patients list
window.openPatientSummaryFromList = function(patientId) {
  if (patientId) {
    window.open(`patient-summary?patientId=${patientId}&source=patients`, '_blank');
  } else {
    alert('No patient ID found.');
  }
};

// New: Print patient summary using jsPDF
window.printPatientSummary = function() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("id");
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  doc.text("Patient Summary", 10, 10);
  doc.text(`Name: ${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`, 10, 20);
  doc.text(`DOB: ${patient.dob}`, 10, 30);
  doc.text(`Gender: ${patient.gender}`, 10, 40);
  doc.text(`Phone: ${patient.phone}`, 10, 50);

  doc.text("Medical History:", 10, 60);
  patient.medicalHistory.forEach((h, i) => {
    doc.text(`${i+1}. Date: ${h.date}, Event: ${h.event}, Notes: ${h.notes}`, 10, 70 + i*10);
  });

  doc.text("Preventive Gaps:", 10, 70 + patient.medicalHistory.length*10 + 10);
  const gaps = computeGaps(patient);
  gaps.forEach((g, i) => {
    doc.text(`${i+1}. ${g.intervention}: ${g.addressed ? 'Addressed' : 'Unaddressed'} (${g.frequency})`, 10, 80 + patient.medicalHistory.length*10 + i*10);
  });

  doc.save("patient_summary.pdf");
};

// Vital Signs Analysis Functions

// Extract all vital signs from patient's clinical notes
function extractVitalSigns(patient) {
  const vitalSigns = [];
  
  // First, check patient.vitals array (direct storage from addVitals)
  if (patient.vitals && Array.isArray(patient.vitals)) {
    patient.vitals.forEach((vital, index) => {
      vitalSigns.push({
        ...vital,
        visitDate: vital.visitDate || vital.date || vital.timestamp || new Date().toISOString().split('T')[0]
      });
    });
  }
  
  // Also check visit.soap.objective.vitals (stored per visit)
  if (patient.visits) {
    patient.visits.forEach(visit => {
      if (visit.soap && visit.soap.objective && visit.soap.objective.vitals) {
        if (Array.isArray(visit.soap.objective.vitals)) {
          visit.soap.objective.vitals.forEach(vital => {
            vitalSigns.push({
              ...vital,
              visitDate: visit.date || vital.visitDate || vital.date || vital.timestamp || new Date().toISOString().split('T')[0]
            });
          });
        }
      }
    });
  }
  
  // Remove duplicates (same timestamp/date) and sort
  const uniqueVitals = [];
  const seen = new Set();
  vitalSigns.forEach(vital => {
    const key = `${vital.visitDate}-${vital.timestamp || vital.date || ''}-${vital.temp || ''}-${vital.hr || ''}-${vital.systolic || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueVitals.push(vital);
    }
  });
  
  return uniqueVitals.sort((a, b) => {
    const dateA = new Date(a.visitDate || a.timestamp || a.date || 0);
    const dateB = new Date(b.visitDate || b.timestamp || b.date || 0);
    return dateB - dateA; // Most recent first
  });
}

// Calculate trend for a vital sign
function calculateTrend(values) {
  if (values.length < 2) return 'stable';
  
  const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (numericValues.length < 2) return 'stable';
  
  const firstHalf = numericValues.slice(0, Math.floor(numericValues.length / 2));
  const secondHalf = numericValues.slice(Math.floor(numericValues.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
  
  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
}
// Display vital signs summary on patient details page
function displayVitalSignsSummary(patient) {
  const container = document.getElementById('vital-signs-content');
  if (!container) return;
  
  const vitalSigns = extractVitalSigns(patient);
  
  if (vitalSigns.length === 0) {
    container.innerHTML = '<div class="no-data">No vital signs data available.</div>';
    // Show placeholder below table instead of inside it
    const placeholder = document.getElementById('vitals-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
    }
    return;
  }
  
  // Hide placeholder if we have data
  const placeholder = document.getElementById('vitals-placeholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
  
  // Get the most recent readings for each vital sign
  const latestReadings = {};
  const trends = {};
  
  // Process each vital sign type - map from stored field names to display names
  const vitalMappings = [
    { stored: 'systolic', display: 'systolic' },
    { stored: 'diastolic', display: 'diastolic' },
    { stored: 'hr', display: 'heartRate' },
    { stored: 'temp', display: 'temperature' },
    { stored: 'rr', display: 'respiratoryRate' },
    { stored: 'o2sat', display: 'oxygenSaturation' },
    { stored: 'weight', display: 'weight' },
    { stored: 'height', display: 'height' },
    { stored: 'pain', display: 'pain' }
  ];
  
  vitalMappings.forEach(mapping => {
    const readings = vitalSigns
      .filter(v => v[mapping.stored] !== null && v[mapping.stored] !== undefined && v[mapping.stored] !== '')
      .map(v => ({ value: v[mapping.stored], date: v.visitDate || v.timestamp || v.date }));
    
    if (readings.length > 0) {
      latestReadings[mapping.display] = readings[0]; // Most recent first (already sorted)
      trends[mapping.display] = calculateTrend(readings.map(r => parseFloat(r.value)).filter(v => !isNaN(v)));
    }
  });
  
  // Generate HTML for vital signs grid
  let vitalSignsHTML = '<div class="vital-signs-grid">';
  
  // Helper function to format date safely
  const formatVitalDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString();
    } catch (e) {
      return dateStr;
    }
  };
  
  // Blood Pressure
  if (latestReadings.systolic && latestReadings.diastolic) {
    const trendClass = trends.systolic || trends.diastolic || 'stable';
    const trendText = trendClass === 'up' ? '↗' : trendClass === 'down' ? '↘' : '→';
    const date = latestReadings.systolic.date || latestReadings.diastolic.date;
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Blood Pressure</div>
        <div class="vital-sign-value">
          ${latestReadings.systolic.value}/${latestReadings.diastolic.value} mmHg
          <span class="vital-sign-trend trend-${trendClass}">${trendText}</span>
        </div>
        <div class="vital-sign-date">${formatVitalDate(date)}</div>
      </div>
    `;
  }
  
  // Heart Rate
  if (latestReadings.heartRate) {
    const trendClass = trends.heartRate || 'stable';
    const trendText = trendClass === 'up' ? '↗' : trendClass === 'down' ? '↘' : '→';
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Heart Rate</div>
        <div class="vital-sign-value">
          ${latestReadings.heartRate.value} bpm
          <span class="vital-sign-trend trend-${trendClass}">${trendText}</span>
        </div>
        <div class="vital-sign-date">${formatVitalDate(latestReadings.heartRate.date)}</div>
      </div>
    `;
  }
  
  // Temperature
  if (latestReadings.temperature) {
    const trendClass = trends.temperature || 'stable';
    const trendText = trendClass === 'up' ? '↗' : trendClass === 'down' ? '↘' : '→';
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Temperature</div>
        <div class="vital-sign-value">
          ${latestReadings.temperature.value}°C
          <span class="vital-sign-trend trend-${trendClass}">${trendText}</span>
        </div>
        <div class="vital-sign-date">${formatVitalDate(latestReadings.temperature.date)}</div>
      </div>
    `;
  }
  
  // Respiratory Rate
  if (latestReadings.respiratoryRate) {
    const trendClass = trends.respiratoryRate || 'stable';
    const trendText = trendClass === 'up' ? '↗' : trendClass === 'down' ? '↘' : '→';
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Respiratory Rate</div>
        <div class="vital-sign-value">
          ${latestReadings.respiratoryRate.value} /min
          <span class="vital-sign-trend trend-${trendClass}">${trendText}</span>
        </div>
        <div class="vital-sign-date">${formatVitalDate(latestReadings.respiratoryRate.date)}</div>
      </div>
    `;
  }
  
  // Oxygen Saturation
  if (latestReadings.oxygenSaturation) {
    const trendClass = trends.oxygenSaturation || 'stable';
    const trendText = trendClass === 'up' ? '↗' : trendClass === 'down' ? '↘' : '→';
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Oxygen Saturation</div>
        <div class="vital-sign-value">
          ${latestReadings.oxygenSaturation.value}%
          <span class="vital-sign-trend trend-${trendClass}">${trendText}</span>
        </div>
        <div class="vital-sign-date">${formatVitalDate(latestReadings.oxygenSaturation.date)}</div>
      </div>
    `;
  }
  
  // Weight
  if (latestReadings.weight) {
    const trendClass = trends.weight || 'stable';
    const trendText = trendClass === 'up' ? '↗' : trendClass === 'down' ? '↘' : '→';
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Weight</div>
        <div class="vital-sign-value">
          ${latestReadings.weight.value} kg
          <span class="vital-sign-trend trend-${trendClass}">${trendText}</span>
        </div>
        <div class="vital-sign-date">${formatVitalDate(latestReadings.weight.date)}</div>
      </div>
    `;
  }
  
  // Height
  if (latestReadings.height) {
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Height</div>
        <div class="vital-sign-value">
          ${latestReadings.height.value} cm
        </div>
        <div class="vital-sign-date">${formatVitalDate(latestReadings.height.date)}</div>
      </div>
    `;
  }
  
  // Pain Score
  if (latestReadings.pain) {
    vitalSignsHTML += `
      <div class="vital-sign-item">
        <div class="vital-sign-label">Pain Score</div>
        <div class="vital-sign-value">
          ${latestReadings.pain.value}/10
        </div>
        <div class="vital-sign-date">${formatVitalDate(latestReadings.pain.date)}</div>
      </div>
    `;
  }
  
  vitalSignsHTML += '</div>';
  
  // Add summary statistics
  vitalSignsHTML += `
    <div class="vital-signs-insights">
      <h5>Summary</h5>
      <div class="insight-item">
        <strong>Total Readings:</strong> ${vitalSigns.length} across ${new Set(vitalSigns.map(v => v.visitDate)).size} visits
      </div>
      <div class="insight-item">
        <strong>Date Range:</strong> ${new Date(vitalSigns[0].visitDate).toLocaleDateString()} - ${new Date(vitalSigns[vitalSigns.length - 1].visitDate).toLocaleDateString()}
      </div>
    </div>
  `;
  
  container.innerHTML = vitalSignsHTML;
}

// Open detailed vital signs analysis page
function openVitalSignsAnalysis() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id');
  
  if (patientId) {
    window.open(`vital-signs-analysis?id=${patientId}`, '_blank');
  } else {
    alert('Patient ID not found');
  }
}

// Handle file upload for insurance cards
function handleFileUpload(fileInput) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    return "";
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();
  
  return new Promise((resolve) => {
    reader.onload = function(e) {
      resolve(e.target.result);
    };
    reader.readAsDataURL(file);
  });
}

// Migrate existing patients to include payment source
function migratePatientPaymentSource() {
  const raw = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patients = Array.isArray(raw)
    ? raw.filter(p => p != null && typeof p === 'object')
    : [];
  let needsMigration = raw.length !== patients.length;

  patients.forEach(patient => {
    if (!patient.paymentSource) {
      patient.paymentSource = "Cash";
      patient.insuranceName = "";
      patient.insurancePolicyGroupNumber = "";
      patient.insuranceMemberNumber = "";
      patient.insuranceCardFront = "";
      patient.insuranceCardBack = "";
      needsMigration = true;
    }
  });

  if (needsMigration) {
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    console.log("Migrated existing patients to include payment source information");
  }
}

// Load edit form with patient data
async function loadEditForm() {
  if (window._editFormLoaded) {
    console.warn('⚠️ [EDIT-PATIENT] loadEditForm called more than once; skipping duplicate run.');
    return;
  }
  window._editFormLoaded = true;
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("id");
  
  if (!patientId) {
    console.error('No patient ID found in URL');
    return;
  }
  
  // HYBRID ARCHITECTURE: Supabase-first, localStorage fallback
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  const patient = patients.find(p => p.id === patientId || p.patient_id === patientId);
  
  if (!patient) {
    console.error('Patient not found:', patientId);
    alert('Patient not found. Please go back to the patient list.');
    return;
  }
  
  // DEBUG: Log patient data to see what fields are available
  console.log('🔍 [EDIT-PATIENT] Patient data loaded:', {
    id: patient.id,
    paymentSource: patient.paymentSource || patient.payment_source,
    phoneCountryCode: patient.phoneCountryCode,
    emergencyPhoneCountryCode: patient.emergencyPhoneCountryCode,
    emergencyCountry: patient.emergencyCountry,
    emergencyState: patient.emergencyState,
    phone: patient.phone,
    emergencyPhone: patient.emergencyPhone,
    emergencyAddressCombined: patient.emergencyAddressCombined || patient.emergency_contact_address,
    allKeys: Object.keys(patient)
  });
  
  // Update page title to include Patient ID (use user-friendly ID)
  const displayPatientId = getPatientIdentifier(patient) || patient.patient_id || patient.patientNumber || patientId || 'Unknown ID';
  const pageTitle = document.getElementById("page-title");
  if (pageTitle) {
    pageTitle.innerHTML = `Edit Patient - ${patient.firstName || ''} ${patient.lastName || ''} (ID: ${displayPatientId})`;
  }
  
  // Initialize dropdowns FIRST before populating values
  // Initialize country dropdowns (populate with patient's country if available)
  if (typeof window.populateCountryDropdown === 'function') {
    await window.populateCountryDropdown('country', patient.country);
    await window.populateCountryDropdown('emergencyCountry', patient.emergencyCountry);
  }
  
  // Initialize country code dropdowns
  // First, try to use saved phone country codes (if they exist)
  let phoneCountryCode = patient.phoneCountryCode || '';
  let emergencyPhoneCountryCode = patient.emergencyPhoneCountryCode || '';
  
  // Handle different field name variations (phone vs phone_number, emergencyPhone vs emergency_contact_phone)
  let phoneNumber = patient.phone || patient.phone_number || '';
  let emergencyPhoneNumber = patient.emergencyPhone || patient.emergency_contact_phone || patient.emergencyPhoneNumber || '';
  
  console.log('🔍 [EDIT-PATIENT] Phone extraction - before:', {
    phoneCountryCode: phoneCountryCode,
    phoneNumber: phoneNumber,
    emergencyPhoneCountryCode: emergencyPhoneCountryCode,
    emergencyPhoneNumber: emergencyPhoneNumber
  });
  
  // If phone country codes weren't saved separately, try to extract from phone numbers
  // Handle formats like: "+234 1234567890" or "+2341234567890"
  if ((!phoneCountryCode || phoneCountryCode === '') && phoneNumber && typeof phoneNumber === 'string') {
    if (phoneNumber.startsWith('+')) {
      // First, try to get country code from patient's country if available
      if (patient.country && typeof COUNTRIES_DATA !== 'undefined' && COUNTRIES_DATA[patient.country]) {
        const countryData = COUNTRIES_DATA[patient.country];
        if (countryData.phoneCode) {
          const expectedCode = countryData.phoneCode;
          // Check if phone number starts with this code
          if (phoneNumber.startsWith(expectedCode)) {
            phoneCountryCode = expectedCode;
            phoneNumber = phoneNumber.substring(expectedCode.length).trim();
            console.log('✅ [EDIT-PATIENT] Extracted phone code from country data:', expectedCode, 'remaining:', phoneNumber);
          }
        }
      }
      
      // If still not extracted, try regex matching
      if (!phoneCountryCode || phoneCountryCode === '') {
        // Try with space first: "+234 8033558877"
        let phoneMatch = phoneNumber.match(/^(\+\d{1,3})(?:\s+)(.*)$/);
        if (phoneMatch && phoneMatch[1]) {
          phoneCountryCode = phoneMatch[1];
          phoneNumber = phoneMatch[2] ? phoneMatch[2].trim() : '';
        } else {
          // Try without space - be smart about country codes
          // Common codes: +1 (US/Canada), +44 (UK), +234 (Nigeria), +233 (Ghana), etc.
          // Try 3 digits first (most African countries)
          phoneMatch = phoneNumber.match(/^(\+\d{3})(\d+)$/);
          if (phoneMatch && phoneMatch[1]) {
            const code = phoneMatch[1];
            // Check if this is a known country code
            const knownCodes = ['+234', '+233', '+254', '+255', '+256', '+260', '+263', '+27'];
            if (knownCodes.includes(code) || phoneMatch[2].length >= 7) {
              phoneCountryCode = code;
              phoneNumber = phoneMatch[2] || '';
            } else {
              // Try 2 digits (UK, etc.)
              const codeMatch2 = phoneNumber.match(/^(\+\d{2})(\d+)$/);
              if (codeMatch2 && codeMatch2[2].length >= 8) {
                phoneCountryCode = codeMatch2[1];
                phoneNumber = codeMatch2[2] || '';
              } else {
                // Try 1 digit (US/Canada)
                const codeMatch1 = phoneNumber.match(/^(\+\d{1})(\d+)$/);
                if (codeMatch1 && codeMatch1[2].length >= 10) {
                  phoneCountryCode = codeMatch1[1];
                  phoneNumber = codeMatch1[2] || '';
                }
              }
            }
          }
        }
      }
    }
  }
  
  // If still no phone country code, try to get from country field
  if ((!phoneCountryCode || phoneCountryCode === '') && patient.country && typeof COUNTRIES_DATA !== 'undefined' && COUNTRIES_DATA[patient.country]) {
    const countryData = COUNTRIES_DATA[patient.country];
    if (countryData.phoneCode) {
      phoneCountryCode = countryData.phoneCode;
    }
  }
  
  // Default to +234 if still empty
  if (!phoneCountryCode || phoneCountryCode === '') {
    phoneCountryCode = '+1';
  }
  
  // Extract emergency phone country code - use same logic as phone
  if ((!emergencyPhoneCountryCode || emergencyPhoneCountryCode === '') && emergencyPhoneNumber && typeof emergencyPhoneNumber === 'string') {
    if (emergencyPhoneNumber.startsWith('+')) {
      // First, try to get from emergency country if available
      const emergencyCountryForPhone = patient.emergencyCountry || patient.emergency_country || '';
      if (emergencyCountryForPhone && typeof COUNTRIES_DATA !== 'undefined' && COUNTRIES_DATA[emergencyCountryForPhone]) {
        const countryData = COUNTRIES_DATA[emergencyCountryForPhone];
        if (countryData.phoneCode) {
          const expectedCode = countryData.phoneCode;
          if (emergencyPhoneNumber.startsWith(expectedCode)) {
            emergencyPhoneCountryCode = expectedCode;
            emergencyPhoneNumber = emergencyPhoneNumber.substring(expectedCode.length).trim();
            console.log('✅ [EDIT-PATIENT] Extracted emergency phone code from country data:', expectedCode, 'remaining:', emergencyPhoneNumber);
          }
        }
      }
      
      // If still not extracted, use same regex logic as phone
      if (!emergencyPhoneCountryCode || emergencyPhoneCountryCode === '') {
        let emergencyMatch = emergencyPhoneNumber.match(/^(\+\d{3})(\d+)$/);
        if (emergencyMatch && emergencyMatch[1]) {
          const code = emergencyMatch[1];
          const knownCodes = ['+234', '+233', '+254', '+255', '+256', '+260', '+263', '+27'];
          if (knownCodes.includes(code) || emergencyMatch[2].length >= 7) {
            emergencyPhoneCountryCode = code;
            emergencyPhoneNumber = emergencyMatch[2] || '';
          }
        }
      }
    }
  }
  
  // Get emergency country value (we'll parse it below, but need it here for phone code)
  // This will be updated after we parse the combined address
  let emergencyCountryValueForPhone = patient.emergencyCountry || patient.emergency_country || '';
  
  // If still no emergency phone country code, try to get from emergency country field
  if ((!emergencyPhoneCountryCode || emergencyPhoneCountryCode === '') && emergencyCountryValueForPhone && typeof COUNTRIES_DATA !== 'undefined' && COUNTRIES_DATA[emergencyCountryValueForPhone]) {
    const countryData = COUNTRIES_DATA[emergencyCountryValueForPhone];
    if (countryData.phoneCode) {
      emergencyPhoneCountryCode = countryData.phoneCode;
    }
  }
  
  // If still no emergency phone country code, use same as phone country code
  if (!emergencyPhoneCountryCode || emergencyPhoneCountryCode === '') {
    emergencyPhoneCountryCode = phoneCountryCode;
  }
  
  console.log('🔍 [EDIT-PATIENT] Phone extraction - after:', {
    phoneCountryCode: phoneCountryCode,
    phoneNumber: phoneNumber,
    emergencyPhoneCountryCode: emergencyPhoneCountryCode,
    emergencyPhoneNumber: emergencyPhoneNumber
  });
  
  // Initialize country code dropdowns with extracted codes
  if (typeof window.populateCountryCodeDropdown === 'function') {
    await window.populateCountryCodeDropdown('phoneCountryCode', phoneCountryCode, true, patient.country || 'Canada');
    await window.populateCountryCodeDropdown('emergencyPhoneCountryCode', emergencyPhoneCountryCode, true, emergencyCountryValueForPhone || patient.country || 'Canada');
  }
  
  // Explicitly set phone country code values after dropdowns are populated
  // This ensures values are set even if dropdown population had issues
  await new Promise(resolve => setTimeout(resolve, 200)); // Wait for dropdowns to be populated
  const phoneCountryCodeSelect = document.getElementById('phoneCountryCode');
  const emergencyPhoneCountryCodeSelect = document.getElementById('emergencyPhoneCountryCode');
  
  if (phoneCountryCodeSelect && phoneCountryCode) {
    // Fix: If we extracted +2348, it should be +234 (Nigeria's code)
    let correctedPhoneCountryCode = phoneCountryCode;
    if (phoneCountryCode === '+2348' || phoneCountryCode.startsWith('+2348')) {
      correctedPhoneCountryCode = '+1';
    }
    if (typeof window.setPhoneCountryCodeForAddressCountry === 'function') {
      window.setPhoneCountryCodeForAddressCountry(phoneCountryCodeSelect, patient.country || 'Canada', correctedPhoneCountryCode);
    } else {
      phoneCountryCodeSelect.value = correctedPhoneCountryCode;
    }
    console.log('✅ [EDIT-PATIENT] Set phoneCountryCode to:', correctedPhoneCountryCode, '(was:', phoneCountryCode, ')');
  } else {
    console.warn('⚠️ [EDIT-PATIENT] phoneCountryCodeSelect not found or phoneCountryCode empty');
  }
  
  if (emergencyPhoneCountryCodeSelect && emergencyPhoneCountryCode) {
    // Fix: If we extracted +2348, it should be +234 (Nigeria's code)
    let correctedEmergencyPhoneCountryCode = emergencyPhoneCountryCode;
    if (emergencyPhoneCountryCode === '+2348' || emergencyPhoneCountryCode.startsWith('+2348')) {
      correctedEmergencyPhoneCountryCode = '+234';
    }
    emergencyPhoneCountryCodeSelect.value = correctedEmergencyPhoneCountryCode;
    console.log('✅ [EDIT-PATIENT] Set emergencyPhoneCountryCode to:', correctedEmergencyPhoneCountryCode, '(was:', emergencyPhoneCountryCode, ')');
  } else {
    console.warn('⚠️ [EDIT-PATIENT] emergencyPhoneCountryCodeSelect not found or emergencyPhoneCountryCode empty');
  }
  
  // Populate all form fields
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== null && value !== undefined) {
      el.value = value || "";
    }
  };
  
  const setChecked = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.checked = checked || false;
  };
  
  // Handle field name variations (camelCase vs snake_case)
  setValue("firstName", patient.firstName || patient.first_name || '');
  setValue("middleName", patient.middleName || patient.middle_name || '');
  setValue("lastName", patient.lastName || patient.last_name || '');
  setValue("customPatientId", getPatientIdentifier(patient) || patient.patient_id || patient.id || patient.patientNumber || '');
  setValue("dob", patient.dob || patient.date_of_birth || patient.dateOfBirth || '');
  setValue("gender", patient.gender || '');
  setValue("maritalStatus", patient.maritalStatus || patient.marital_status || '');
  
  const raceValue = (typeof window.normalizePatientRaceForLoad === 'function'
    ? window.normalizePatientRaceForLoad(patient)
    : (patient.race || ''));
  if (typeof window.populatePatientRaceSelect === 'function') {
    window.populatePatientRaceSelect(document.getElementById('race'), raceValue);
  } else {
    setValue("race", raceValue);
  }

    setValue("email", patient.email);
  setValue("phone", phoneNumber); // Phone number without country code
  setValue("addressLine1", patient.addressLine1 || patient.address_line1 || patient.address || '');
  setValue("addressLine2", patient.addressLine2 || patient.address_line2 || '');
  const savedCity = patient.city || '';
  const savedPostal = patient.postalCode || patient.postal_code || '';
  if (patient.country && typeof window.updatePostalCodeField === 'function') {
    window.updatePostalCodeField(patient.country, 'postalCode', 'postal-code-label');
  }
  setValue("country", patient.country || '');
  // Handle emergency contact name (might be stored as single field or split)
  const emergencyName = patient.emergencyContactName || patient.emergency_contact_name || '';
  if (emergencyName) {
    const nameParts = emergencyName.split(' ');
    setValue("emergencyFirstName", nameParts[0] || patient.emergencyFirstName || patient.emergency_first_name || '');
    setValue("emergencyLastName", nameParts.slice(1).join(' ') || patient.emergencyLastName || patient.emergency_last_name || '');
  } else {
    setValue("emergencyFirstName", patient.emergencyFirstName || patient.emergency_first_name || '');
    setValue("emergencyLastName", patient.emergencyLastName || patient.emergency_last_name || '');
  }
  
  setValue("emergencyRelationship", patient.emergencyRelationship || patient.emergency_contact_relationship || patient.emergencyContactRelationship || '');
  setValue("emergencyPhone", emergencyPhoneNumber); // Emergency phone without country code
  setValue("emergencyEmail", patient.emergencyEmail || patient.emergency_contact_email || patient.emergencyContactEmail || '');
  // Compute emergency address fields (support combined address fallback)
  let emergencyLine1Value = patient.emergencyAddressLine1 || patient.emergency_address_line1 || '';
  let emergencyLine2Value = patient.emergencyAddressLine2 || patient.emergency_address_line2 || '';
  let emergencyCityValue = patient.emergencyCity || patient.emergency_city || '';

  // Get emergency country and state - check multiple field name variations
  // First try separate fields, then try to parse from combined address
  let emergencyStateValue = patient.emergencyState || patient.emergency_state || '';
  let emergencyCountryValue = patient.emergencyCountry || patient.emergency_country || '';
  
  // If fields are empty, try to parse from combined emergency address
  if ((!emergencyStateValue || emergencyStateValue === '') && (!emergencyCountryValue || emergencyCountryValue === '')) {
    const emergencyCombined = patient.emergencyAddressCombined || patient.emergency_contact_address || '';
    if (emergencyCombined && typeof emergencyCombined === 'string') {
      // Parse format: "Address Line 1, City, State, Country" or "Address Line 1, Address Line 2, City, State, Country"
      const parts = emergencyCombined.split(',').map(p => p.trim()).filter(Boolean);
      console.log('🔍 [EDIT-PATIENT] Parsing emergency address:', {
        combined: emergencyCombined,
        parts: parts,
        partsLength: parts.length
      });
      
      // Typically: [Address1, City, State, Country] or [Address1, Address2, City, State, Country]
      if (parts.length >= 4) {
        // Format: Address1, City, State, Country (or Address1, Address2, City, State, Country)
        // State is second-to-last, Country is last
        emergencyStateValue = parts[parts.length - 2] || '';
        emergencyCountryValue = parts[parts.length - 1] || '';
        if (!emergencyLine1Value) emergencyLine1Value = parts[0] || '';
        if (!emergencyCityValue) emergencyCityValue = parts.length === 4 ? (parts[1] || '') : (parts[2] || '');
        if (!emergencyLine2Value && parts.length >= 5) emergencyLine2Value = parts[1] || '';
      } else if (parts.length === 3) {
        // Could be: Address1, City, State/Country
        // Or: City, State, Country
        // Try to identify: if last part looks like a country name, use it
        const lastPart = parts[parts.length - 1] || '';
        // Common country names
        const countryNames = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe'];
        if (countryNames.some(c => lastPart.includes(c))) {
          emergencyCountryValue = lastPart;
          emergencyStateValue = parts[parts.length - 2] || '';
          if (!emergencyLine1Value) emergencyLine1Value = parts[0] || '';
          if (!emergencyCityValue) emergencyCityValue = parts[1] || '';
        } else {
          // Assume last is state, second-to-last might be city
          emergencyStateValue = lastPart;
          if (!emergencyLine1Value) emergencyLine1Value = parts[0] || '';
          if (!emergencyCityValue) emergencyCityValue = parts[1] || '';
        }
      } else if (parts.length === 2) {
        // Could be [City, State] or [State, Country]
        // Check if second part is a known country
        const secondPart = parts[1] || '';
        const countryNames = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe'];
        if (countryNames.some(c => secondPart.includes(c))) {
          emergencyCountryValue = secondPart;
          emergencyStateValue = parts[0] || '';
          if (!emergencyLine1Value) emergencyLine1Value = parts[0] || '';
        } else {
          emergencyStateValue = parts[0] || '';
          emergencyCountryValue = parts[1] || '';
          if (!emergencyLine1Value) emergencyLine1Value = parts[0] || '';
        }
      }
      
      console.log('🔍 [EDIT-PATIENT] Parsed from combined address:', {
        emergencyStateValue: emergencyStateValue,
        emergencyCountryValue: emergencyCountryValue
      });
    }
  }
  
  // If we still don't have emergency country but have emergency state that looks like a country, swap them
  if ((!emergencyCountryValue || emergencyCountryValue === '') && emergencyStateValue) {
    const countryNames = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe'];
    if (countryNames.some(c => emergencyStateValue.includes(c))) {
      // State value is actually a country name, swap them
      emergencyCountryValue = emergencyStateValue;
      emergencyStateValue = ''; // Clear state since we don't know it
      console.log('🔍 [EDIT-PATIENT] Swapped - state was actually country:', {
        emergencyCountryValue: emergencyCountryValue,
        emergencyStateValue: emergencyStateValue
      });
    }
  }
  
  // Also check if we have emergencyCity but need to get state/country from main address
  if ((!emergencyStateValue || emergencyStateValue === '') && patient.emergencyCity) {
    // If emergency city matches main city, use main state/country
    if (patient.city === patient.emergencyCity) {
      emergencyStateValue = patient.state || '';
      emergencyCountryValue = patient.country || '';
      console.log('🔍 [EDIT-PATIENT] Using main address state/country for emergency (same city)');
    }
  }
  
  console.log('🔍 [EDIT-PATIENT] Final emergency fields:', {
    emergencyState: emergencyStateValue,
    emergencyCountry: emergencyCountryValue,
    patientEmergencyState: patient.emergencyState,
    patientEmergency_state: patient.emergency_state,
    patientEmergencyCountry: patient.emergencyCountry,
    patientEmergency_country: patient.emergency_country,
    emergencyAddressCombined: patient.emergencyAddressCombined || patient.emergency_contact_address
  });
  
  setValue("emergencyAddressLine1", emergencyLine1Value);
  setValue("emergencyAddressLine2", emergencyLine2Value);
  setValue("emergencyCity", emergencyCityValue);
  setValue("emergencyState", emergencyStateValue);
  setValue("emergencyCountry", emergencyCountryValue);
  setChecked("hasDiabetes", patient.hasDiabetes);
  
  // Populate payment and insurance fields (normalize legacy values)
  const rawPaymentSource = patient.paymentSource || patient.payment_source || "self_pay";
  const normalize = window.MediForgePaymentSourceFields?.normalizePaymentSource;
  const normalizedPaymentSource = typeof normalize === "function"
    ? normalize(rawPaymentSource)
    : (() => {
      const value = String(rawPaymentSource || "").toLowerCase();
      if (value.includes("insur")) return "private_insurance";
      if (value.includes("cash") || value.includes("self")) return "self_pay";
      if (value.includes("provincial") || value.includes("ohip")) return "provincial";
      if (value.includes("wcb") || value.includes("workers")) return "wcb";
      return rawPaymentSource || "self_pay";
    })();
  setValue("paymentSource", normalizedPaymentSource);
  setValue("preferredPaymentMethod", patient.preferredPaymentMethod || patient.preferred_payment_method || "cash");
  setValue("patientProvince", patient.province || patient.state || "ON");
  setValue("healthCardNumber", patient.healthCardNumber || patient.phn || patient.health_card_number || "");
  setValue("healthCardVersion", patient.healthCardVersion || patient.health_card_version || "");
  setValue("wcbClaimNumber", patient.wcbClaimNumber || patient.wcb_claim_number || patient.metadata?.wcbClaimNumber || "");
  setValue("insuranceName", patient.insuranceName);
  setValue("insurancePolicyGroupNumber", patient.insurancePolicyGroupNumber);
  setValue("insuranceMemberNumber", patient.insuranceMemberNumber);

  if (typeof window.MediForgePaymentSourceFields !== "undefined") {
    window.MediForgePaymentSourceFields.update(document.getElementById("paymentSource"));
  } else {
    const insuranceFields = document.getElementById("insuranceFields");
    if (insuranceFields) {
      insuranceFields.style.display = (normalizedPaymentSource === "private_insurance") ? "block" : "none";
    }
  }
  
  // Show current document upload status
  const currentIdentificationCard = document.getElementById("currentIdentificationCard");
  if (currentIdentificationCard && patient.identificationCard) {
    currentIdentificationCard.textContent = "Current identification card: ✓ Uploaded";
  }
  const currentInsuranceCard = document.getElementById("currentInsuranceCard");
  if (currentInsuranceCard && (patient.insuranceCard || patient.insuranceCardFront)) {
    currentInsuranceCard.textContent = "Current insurance card: ✓ Uploaded";
  }
  const currentCardFront = document.getElementById("currentCardFront");
  if (currentCardFront && patient.insuranceCardFront && !patient.insuranceCard) {
    currentCardFront.textContent = "Legacy insurance card front: ✓ Uploaded";
  }
  const currentCardBack = document.getElementById("currentCardBack");
  if (currentCardBack && patient.insuranceCardBack) {
    currentCardBack.textContent = "Current card back: ✓ Uploaded";
  }
  
  // Populate state dropdowns AFTER country is set
  if (patient.country && typeof window.populateStateDropdown === 'function') {
    await window.populateStateDropdown('state', patient.country, patient.state);
    if (patient.state) {
      const stateSelect = document.getElementById('state');
      if (stateSelect) {
        stateSelect.value = patient.state;
      }
    }
    if (typeof window.handleAddressStateChange === 'function') {
      window.handleAddressStateChange('country', 'state', 'city', 'postalCode', savedCity);
    } else if (typeof window.populateCityDropdown === 'function' && patient.state) {
      window.populateCityDropdown('city', patient.country, patient.state, savedCity);
      const citySelect = document.getElementById('city');
      if (citySelect) citySelect.disabled = false;
    }
    if (savedCity && typeof window.populatePostalCodeDropdown === 'function') {
      window.populatePostalCodeDropdown('postalCode', patient.country, patient.state, savedCity, savedPostal);
    }
    setValue('city', savedCity);
    setValue('postalCode', savedPostal);
  } else if (patient.country) {
    // Fallback: Try to set state value directly if dropdown already populated
    const stateSelect = document.getElementById('state');
    if (stateSelect && patient.state) {
      stateSelect.value = patient.state;
    }
  }
  
  // CRITICAL: Set emergency country dropdown FIRST before trying to populate state
  // Make sure the emergency country is actually set in the dropdown
  if (emergencyCountryValue) {
    const emergencyCountrySelect = document.getElementById('emergencyCountry');
    if (emergencyCountrySelect) {
      emergencyCountrySelect.value = emergencyCountryValue;
      console.log('✅ [EDIT-PATIENT] Set emergencyCountry dropdown to:', emergencyCountryValue);
      // Trigger change event to populate state dropdown
      if (typeof handleEditEmergencyCountryChange === 'function') {
        handleEditEmergencyCountryChange();
      }
    }
  }
  
  // Populate emergency state dropdown AFTER emergency country is set
  // Use the values we extracted (they may have been parsed from combined address)
  // Re-get the values from the form fields we just set
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait for country dropdown to be set and state dropdown to populate
  const finalEmergencyCountryEl = document.getElementById('emergencyCountry');
  const finalEmergencyCountry = finalEmergencyCountryEl ? finalEmergencyCountryEl.value : (emergencyCountryValue || '');
  const finalEmergencyState = emergencyStateValue || '';
  
  console.log('🔍 [EDIT-PATIENT] Populating emergency state dropdown:', {
    finalEmergencyCountry: finalEmergencyCountry,
    finalEmergencyState: finalEmergencyState,
    emergencyCountryValue: emergencyCountryValue,
    emergencyStateValue: emergencyStateValue,
    emergencyCountrySelectValue: finalEmergencyCountryEl ? finalEmergencyCountryEl.value : 'NOT FOUND'
  });
  
  if (finalEmergencyCountry && typeof window.populateStateDropdown === 'function') {
    await window.populateStateDropdown('emergencyState', finalEmergencyCountry, finalEmergencyState);
    // Explicitly set emergency state value after dropdown is populated
    if (finalEmergencyState) {
      // Wait a bit more for dropdown to fully populate
      await new Promise(resolve => setTimeout(resolve, 300));
      const emergencyStateSelect = document.getElementById('emergencyState');
      if (emergencyStateSelect) {
        emergencyStateSelect.value = finalEmergencyState;
        console.log('✅ [EDIT-PATIENT] Set emergencyState to:', finalEmergencyState);
      } else {
        console.warn('⚠️ [EDIT-PATIENT] emergencyStateSelect not found');
      }
    } else {
      console.warn('⚠️ [EDIT-PATIENT] finalEmergencyState is empty:', finalEmergencyState);
    }
  } else if (finalEmergencyCountry) {
    // Fallback: Try to set emergency state value directly
    await new Promise(resolve => setTimeout(resolve, 300));
    const emergencyStateSelect = document.getElementById('emergencyState');
    if (emergencyStateSelect && finalEmergencyState) {
      emergencyStateSelect.value = finalEmergencyState;
      console.log('✅ [EDIT-PATIENT] Set emergencyState (fallback) to:', finalEmergencyState);
    } else {
      console.warn('⚠️ [EDIT-PATIENT] emergencyStateSelect not found or value empty:', {
        selectExists: !!emergencyStateSelect,
        value: finalEmergencyState
      });
    }
  } else {
    console.warn('⚠️ [EDIT-PATIENT] finalEmergencyCountry is empty, cannot populate emergency state dropdown');
  }
  
  // Now update emergency phone country code based on the final emergency country
  if (finalEmergencyCountry && typeof COUNTRIES_DATA !== 'undefined' && COUNTRIES_DATA[finalEmergencyCountry]) {
    const countryData = COUNTRIES_DATA[finalEmergencyCountry];
    if (countryData.phoneCode) {
      const newEmergencyPhoneCountryCode = countryData.phoneCode;
      // Update the dropdown
      const emergencyPhoneCountryCodeSelect = document.getElementById('emergencyPhoneCountryCode');
      if (emergencyPhoneCountryCodeSelect) {
        emergencyPhoneCountryCodeSelect.value = newEmergencyPhoneCountryCode;
        console.log('✅ [EDIT-PATIENT] Updated emergencyPhoneCountryCode to:', newEmergencyPhoneCountryCode);
      }
    }
  }

  // Persist "Same as Patient Address" on edit when emergency address matches
  const applyEditSelections = (delay = 0) => {
    setTimeout(() => {
      const sameAsContact = document.getElementById('sameAsContact');
      if (sameAsContact) {
        const normalize = value => (value || '').toString().trim().toLowerCase();
        const patientAddress = {
          line1: normalize(patient.addressLine1 || patient.address_line1 || ''),
          line2: normalize(patient.addressLine2 || patient.address_line2 || ''),
          city: normalize(patient.city || ''),
          state: normalize(patient.state || ''),
          country: normalize(patient.country || '')
        };
        const emergencyAddress = {
          line1: normalize(document.getElementById('emergencyAddressLine1')?.value || emergencyLine1Value || ''),
          line2: normalize(document.getElementById('emergencyAddressLine2')?.value || emergencyLine2Value || ''),
          city: normalize(document.getElementById('emergencyCity')?.value || emergencyCityValue || ''),
          state: normalize(document.getElementById('emergencyState')?.value || emergencyStateValue || ''),
          country: normalize(document.getElementById('emergencyCountry')?.value || emergencyCountryValue || '')
        };
        const patientCombined = [patientAddress.line1, patientAddress.line2, patientAddress.city, patientAddress.state, patientAddress.country]
          .filter(Boolean)
          .join(', ');
        const emergencyCombined = normalize(
          patient.emergencyAddressCombined ||
          patient.emergency_contact_address ||
          [emergencyAddress.line1, emergencyAddress.line2, emergencyAddress.city, emergencyAddress.state, emergencyAddress.country].filter(Boolean).join(', ')
        );

        const hasEmergencyData = Boolean(
          emergencyAddress.line1 ||
          emergencyAddress.line2 ||
          emergencyAddress.city ||
          emergencyAddress.state ||
          emergencyAddress.country ||
          emergencyCombined
        );

        const matchesDirect =
          patientAddress.line1 &&
          patientAddress.city &&
          patientAddress.country &&
          patientAddress.line1 === emergencyAddress.line1 &&
          patientAddress.line2 === emergencyAddress.line2 &&
          patientAddress.city === emergencyAddress.city &&
          patientAddress.state === emergencyAddress.state &&
          patientAddress.country === emergencyAddress.country;
        const matchesCombined = patientCombined && emergencyCombined && patientCombined === emergencyCombined;
        const shouldCheck = (matchesDirect || matchesCombined) || (!hasEmergencyData && patientCombined);

        sameAsContact.checked = shouldCheck;
        // Trigger the same handler used by the checkbox to update required fields/visibility
        sameAsContact.dispatchEvent(new Event('change'));
      }

      const raceVal = (typeof window.normalizePatientRaceForLoad === 'function'
        ? window.normalizePatientRaceForLoad(patient)
        : (patient.race || ''));
      if (raceVal && typeof window.populatePatientRaceSelect === 'function') {
        window.populatePatientRaceSelect(document.getElementById('race'), raceVal);
      } else if (raceVal) {
        const raceSelect = document.getElementById('race');
        if (raceSelect) raceSelect.value = raceVal;
      }

      // Re-apply payment source (ensure select matches normalized value)
      const paymentSelect = document.getElementById('paymentSource');
      if (paymentSelect) {
        paymentSelect.value = normalizedPaymentSource;
        paymentSelect.dispatchEvent(new Event('change'));
      }
    }, delay);
  };

  applyEditSelections(0);
  applyEditSelections(600);
  applyEditSelections(1500);

  // Trace final DOM values after all async setters
  setTimeout(() => {
    console.log('🔍 [EDIT-PATIENT] DOM values after apply:', {
      race: document.getElementById('race')?.value || '',
      paymentSource: document.getElementById('paymentSource')?.value || '',
      sameAsContact: document.getElementById('sameAsContact')?.checked,
      emergencyCountry: document.getElementById('emergencyCountry')?.value || '',
      emergencyState: document.getElementById('emergencyState')?.value || '',
      emergencyLine1: document.getElementById('emergencyAddressLine1')?.value || '',
      emergencyCity: document.getElementById('emergencyCity')?.value || ''
    });
  }, 1800);
  
  // Final verification: Ensure all critical fields are set
  // This is a safety net to catch any fields that might have been missed
  console.log('🔍 [EDIT-PATIENT] Field verification:', {
    race: document.getElementById('race')?.value || 'NOT SET',
    phoneCountryCode: document.getElementById('phoneCountryCode')?.value || 'NOT SET',
    emergencyCountry: document.getElementById('emergencyCountry')?.value || 'NOT SET',
    emergencyState: document.getElementById('emergencyState')?.value || 'NOT SET',
    emergencyPhoneCountryCode: document.getElementById('emergencyPhoneCountryCode')?.value || 'NOT SET'
  });
  
  // Update phone placeholders
  if (typeof updatePhonePlaceholder === 'function') {
    updatePhonePlaceholder();
  }
  if (typeof updateEmergencyPhonePlaceholder === 'function') {
    updateEmergencyPhonePlaceholder();
  }
  
  console.log('✅ [LOAD-EDIT-FORM] Patient data loaded:', {
    patientId: patient.id,
    maritalStatus: patient.maritalStatus,
    phoneCountryCode: phoneCountryCode,
    phoneNumber: phoneNumber,
    country: patient.country,
    state: patient.state
  });
}

// Generate discharge summary for clinical note
function generateDischargeSummary() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  
  if (!patientId || !visitDate) {
    alert("Unable to generate discharge summary. Missing patient or visit information.");
    return;
  }
  
  // Open discharge summary page in new window
  const dischargeUrl = `discharge-summary?patientId=${patientId}&visitDate=${visitDate}`;
  window.open(dischargeUrl, '_blank', 'width=1000,height=800,scrollbars=yes,resizable=yes');
}

// Open prescription form from clinical note or patient details
window.openPrescriptionForm = function() {
  const urlParams = new URLSearchParams(window.location.search);
  let patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  
  // For patient-details.html, get patientId from id parameter
  if (!patientId) {
    patientId = urlParams.get("id");
  }
  
  if (!patientId) {
    alert("Patient ID not found. Please ensure you're on a valid patient page.");
    return;
  }
  
  // Check if user has Doctor role for prescription creation
  const user = JSON.parse(localStorage.getItem("user"));
  // Only Doctor, Nurse, and Physician Assistant can write prescriptions
  const canWritePrescriptions = user && (user.role === "Doctor" || user.role === "Nurse" || user.role === "Physician Assistant");
  if (!canWritePrescriptions) {
    alert("Only doctors, nurses, and physician assistants can create prescriptions. Please contact a licensed prescriber to prescribe medications.");
    return;
  }
  
  // Temporarily disable auto-save to prevent unwanted popup when opening prescription form
  const wasAutoSaveEnabled = !window._skipAutoSave;
  window._skipAutoSave = true;
  
  // Save current form data silently (but not on clinical-note.html)
  const currentPage = window.location.pathname;
  if (!currentPage.includes('clinical-note')) {
    autoSaveClinicalNote();
  }
  
  // Open prescription form in new window
  console.log('Opening prescription form in new window for patient:', patientId, 'visit:', visitDate);
  
  // Open prescription page in new window instead of iframe to avoid X-Frame-Options issues
  const prescriptionUrl = visitDate ? 
    `prescription?patientId=${patientId}&visitDate=${visitDate}` :
    `prescription?patientId=${patientId}`;
  
  // Open in new window with proper dimensions
  const prescriptionWindow = window.open(
    prescriptionUrl, 
    'prescription', 
    'width=1400,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
  );
  
  if (!prescriptionWindow) {
    alert('Popup blocked! Please allow popups for this site and try again.');
    return;
  }
  
  // Focus the new window
  prescriptionWindow.focus();
  
  console.log('Prescription window opened successfully');
};

// Helper: get org id for prescriptions fetch
function getPrescriptionsOrgId() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  let orgId = user.organizationId || user.organization_id;
  if (orgId && !orgId.includes('-') && orgId.toLowerCase().includes('mecure')) {
    orgId = '576522cc-e769-4fb4-9487-3d150857d970';
  }
  if (!orgId) {
    orgId = '576522cc-e769-4fb4-9487-3d150857d970';
  }
  return orgId;
}

// Helper: fetch prescriptions from Supabase for a patient (latest pharmacy_status and per-line status)
async function fetchPrescriptionsFromSupabaseForPatient(patientId, patient) {
  let client = null;
  if (typeof window.getSupabaseClient === 'function') {
    try {
      client = await window.getSupabaseClient();
    } catch (_) {
      client = null;
    }
  }
  if (!client) client = window.supabaseClient;
  if (!client) return null;
  try {
    const orgId = getPrescriptionsOrgId();
    const ids = [patientId];
    if (patient) {
      if (patient.patient_id && !ids.includes(patient.patient_id)) ids.push(patient.patient_id);
      if (patient.id && !ids.includes(patient.id)) ids.push(patient.id);
      if (patient._supabaseUuid && !ids.includes(patient._supabaseUuid)) ids.push(patient._supabaseUuid);
    }
    const { data, error } = await client
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .in('patient_id', ids);
    if (error) {
      console.warn('Supabase prescriptions fetch error:', error);
      return null;
    }
    return data || [];
  } catch (e) {
    console.warn('fetchPrescriptionsFromSupabaseForPatient:', e);
    return null;
  }
}

// Convert Supabase prescription row to local format (includes pharmacy_status and medications with pharmacy_line_status)
function convertSupabasePrescriptionToLocal(presc) {
  let meds = [];
  if (presc.medications != null) {
    if (typeof presc.medications === 'string') {
      try {
        meds = JSON.parse(presc.medications);
      } catch (e) {
        console.warn('convertSupabasePrescriptionToLocal: invalid medications JSON for prescription', presc.id, e);
        meds = [];
      }
    } else if (Array.isArray(presc.medications)) {
      meds = presc.medications;
    }
  }
  const rawPn = presc.prescription_number ?? presc.prescriptionNumber;
  const pn =
    rawPn != null && String(rawPn).trim() !== ''
      ? String(rawPn).trim()
      : null;
  const out = {
    id: presc.id,
    _supabaseId: presc.id,
    prescription_number: pn,
    date: presc.prescription_date || presc.date || presc.created_at,
    visitDate: presc.prescription_date || presc.date || presc.created_at,
    encounterDate: presc.prescription_date || presc.date || presc.created_at,
    medications: meds,
    diagnosis: presc.diagnosis || '',
    status: presc.status || 'draft',
    pharmacy_status: presc.pharmacy_status || null,
    filled_at: presc.filled_at || null,
    sent_to_pharmacy_at: presc.sent_to_pharmacy_at || null,
    prescriber: presc.prescriber || {},
    patient: presc.patient || {}
  };
  if (typeof window.normalizePrescriptionRecord === 'function') window.normalizePrescriptionRecord(out);
  return out;
}

/** Client-generated RX + digits ids (RX123456…); used for merge + stripping orphans after Supabase sync. */
function isLegacyRxNumericId(id) {
  if (id == null) return false;
  const s = String(id).trim();
  return /^RX\d{6,}$/i.test(s);
}

function isUuidPrescriptionId(id) {
  if (id == null) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id).trim());
}

/** When Supabase rows match by UUID, legacy RX rows with the same meds were left in the array; remove them. */
function dedupeLegacyRxAfterSupabaseMerge(list) {
  if (!list || list.length < 2) return list;
  const drop = new Set();
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!isLegacyRxNumericId(p.id)) continue;
    const fp = prescriptionMedicationNamesFingerprint(p);
    if (!fp) continue;
    for (let j = 0; j < list.length; j++) {
      if (i === j || drop.has(j)) continue;
      const q = list[j];
      if (!isUuidPrescriptionId(q.id)) continue;
      if (prescriptionMedicationNamesFingerprint(q) !== fp) continue;
      drop.add(i);
      break;
    }
  }
  if (drop.size === 0) return list;
  return list.filter((_, i) => !drop.has(i));
}

function prescriptionMedicationNamesFingerprint(presc) {
  const meds = presc && presc.medications;
  if (!Array.isArray(meds) || meds.length === 0) return '';
  return [...meds.map(m => String(m && m.name != null ? m.name : '').toLowerCase().trim())].sort().join('\u0001');
}

// Merge Supabase prescriptions into existing list (upgrade legacy RX-only rows when prescription_number or id matches)
function mergePrescriptionsFromSupabase(existingPrescriptions, supabaseRows) {
  if (!supabaseRows || supabaseRows.length === 0) return existingPrescriptions || [];
  const list = [...(existingPrescriptions || [])];
  supabaseRows.forEach(presc => {
    const converted = convertSupabasePrescriptionToLocal(presc);
    const src = presc.source_prescription_id != null && String(presc.source_prescription_id).trim() !== ''
      ? String(presc.source_prescription_id).trim()
      : null;
    let idx = list.findIndex(
      p =>
        p &&
        (p.id === presc.id ||
        p._supabaseId === presc.id ||
        (src != null && String(p.id) === src))
    );
    if (idx === -1 && converted.prescription_number) {
      idx = list.findIndex(p => p && p.prescription_number === converted.prescription_number);
    }
    if (idx === -1) {
      const fp = prescriptionMedicationNamesFingerprint(converted);
      if (fp) {
        idx = list.findIndex(
          p => p && isLegacyRxNumericId(p.id) && prescriptionMedicationNamesFingerprint(p) === fp
        );
      }
    }
    if (idx !== -1) {
      list[idx] = { ...(list[idx] && typeof list[idx] === 'object' ? list[idx] : {}), ...converted };
    } else {
      list.push(converted);
    }
  });
  const deduped = dedupeLegacyRxAfterSupabaseMerge(list);
  const seenIds = new Set(
    deduped.filter(Boolean).map(p => String(p.id || '').trim()).filter(Boolean)
  );
  supabaseRows.forEach(presc => {
    const sid = String(presc.id || '').trim();
    if (!sid || seenIds.has(sid)) return;
    deduped.push(convertSupabasePrescriptionToLocal(presc));
    seenIds.add(sid);
  });
  return deduped;
}

// For patient-encounters etc.: refresh prescriptions from Supabase and return merged list
window.refreshPatientPrescriptionsFromSupabase = async function(patientId, patient) {
  const fromSupabase = await fetchPrescriptionsFromSupabaseForPatient(patientId, patient);
  if (!fromSupabase || fromSupabase.length === 0) return patient.prescriptions || [];
  const merged = mergePrescriptionsFromSupabase(patient.prescriptions, fromSupabase);
  if (typeof window.hydratePrescriptionMnemonicsFromSupabase === 'function') {
    await window.hydratePrescriptionMnemonicsFromSupabase(merged);
  }
  return merged;
};

// Load prescriptions for the current visit
async function loadPrescriptionsForVisit(patientId, visitDate) {
  console.log('🔍 loadPrescriptionsForVisit: Loading prescriptions for patient:', patientId, 'visit:', visitDate);
  
  // Use resolvePatientByIdentifier to handle UUID and display IDs
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    console.log('🔍 loadPrescriptionsForVisit: Using resolvePatientByIdentifier...');
    patient = await window.resolvePatientByIdentifier(patientId);
    console.log('🔍 loadPrescriptionsForVisit: Patient found:', patient ? `${patient.id || patient.patient_id}` : 'null');
  } else {
    console.warn('⚠️ loadPrescriptionsForVisit: resolvePatientByIdentifier not available, using fallback...');
    let patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p._supabaseUuid === patientId) ||
              patients.find(p => p.patient_id === patientId);
  }
  
  if (!patient) {
    console.error('❌ loadPrescriptionsForVisit: Patient not found! Identifier:', patientId);
    return;
  }
  
  // Reload patients array to ensure we have latest data
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
      const freshPatientIndex = patients.findIndex(p => 
        p.id === patient.id || 
        p._supabaseUuid === patient._supabaseUuid ||
        (patient._supabaseUuid && p.id === patient._supabaseUuid) ||
        (patient.patient_id && p.patient_id === patient.patient_id)
      );
      if (freshPatientIndex !== -1) {
        patient = patients[freshPatientIndex];
      }
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using stored patient:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  // Always refresh prescriptions from Supabase when available (latest pharmacy_status and per-line status)
  try {
    const supabasePrescriptions = await fetchPrescriptionsFromSupabaseForPatient(patientId, patient);
    if (supabasePrescriptions && supabasePrescriptions.length > 0) {
      patient.prescriptions = mergePrescriptionsFromSupabase(patient.prescriptions, supabasePrescriptions);
      patients = patients.map(p => (p.id === patient.id || p.patient_id === patient.patient_id || p._supabaseUuid === patient._supabaseUuid) ? patient : p);
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
      console.log('✅ Refreshed prescriptions from Supabase (pharmacy status up to date)');
    }
  } catch (error) {
    console.warn('⚠️ Exception refreshing prescriptions from Supabase:', error);
  }
  
  // If still no prescriptions and Supabase wasn't used, try legacy one-off fetch (e.g. different patient_id format)
  if ((!patient.prescriptions || patient.prescriptions.length === 0)) {
    let client = null;
    if (typeof window.getSupabaseClient === 'function') {
      try {
        client = await window.getSupabaseClient();
      } catch (_) {
        client = null;
      }
    }
    if (!client) client = window.supabaseClient;
    if (client) {
    try {
      const orgId = getPrescriptionsOrgId();
      const { data: supabasePrescriptions, error } = await client
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .eq('organization_id', orgId);
      if (!error && supabasePrescriptions && supabasePrescriptions.length > 0) {
        if (!patient.prescriptions) patient.prescriptions = [];
        supabasePrescriptions.forEach(presc => {
          if (!patient.prescriptions.find(p => p.id === presc.id)) {
            patient.prescriptions.push(convertSupabasePrescriptionToLocal(presc));
          }
        });
        patients = patients.map(p => p.id === patientId ? patient : p);
        localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        console.log('✅ Synced prescriptions from Supabase to localStorage');
      }
    } catch (error) {
      console.warn('⚠️ Exception loading prescriptions from Supabase:', error);
    }
    }
  }

  const _rxDedupBefore = (patient.prescriptions || []).length;
  patient.prescriptions = dedupeLegacyRxAfterSupabaseMerge(patient.prescriptions || []);
  if (patient.prescriptions.length !== _rxDedupBefore && patients.length > 0) {
    try {
      patients = patients.map(p =>
        (p.id === patient.id || p.patient_id === patient.patient_id || p._supabaseUuid === patient._supabaseUuid)
          ? patient
          : p
      );
      localStorage.setItem(getDataKey('patients'), JSON.stringify(patients));
    } catch (e) {
      console.warn('Could not persist deduped prescriptions:', e);
    }
  }

  const _mnSnap = (patient.prescriptions || [])
    .map(p => `${p.id}:${typeof window.getPrescriptionMnemonic === 'function' ? window.getPrescriptionMnemonic(p) : p.prescription_number || ''}`)
    .join('|');
  if (typeof window.hydratePrescriptionMnemonicsFromSupabase === 'function') {
    await window.hydratePrescriptionMnemonicsFromSupabase(patient.prescriptions || []);
  }
  const _mnSnap2 = (patient.prescriptions || [])
    .map(p => `${p.id}:${typeof window.getPrescriptionMnemonic === 'function' ? window.getPrescriptionMnemonic(p) : p.prescription_number || ''}`)
    .join('|');
  if (_mnSnap !== _mnSnap2 && patients.length > 0) {
    try {
      patients = patients.map(p =>
        (p.id === patient.id || p.patient_id === patient.patient_id || p._supabaseUuid === patient._supabaseUuid)
          ? patient
          : p
      );
      localStorage.setItem(getDataKey('patients'), JSON.stringify(patients));
    } catch (e) {
      console.warn('Could not persist hydrated prescription mnemonics:', e);
    }
  }
  
  // Show all prescriptions for the patient (not filtered by visit date)
  // Filter prescriptions by visit date if visitDate is provided
  let visitPrescriptions = patient.prescriptions || [];
  
  if (visitDate) {
    console.log('🔍 Filtering prescriptions by visit date:', visitDate);
    visitPrescriptions = visitPrescriptions.filter(p => {
      const prescriptionVisitDate = p.visitDate || p.date || p.encounterDate;
      // Normalize dates for comparison (remove time if present)
      const normalizedVisitDate = visitDate.split('T')[0];
      const normalizedPrescriptionDate = prescriptionVisitDate ? prescriptionVisitDate.split('T')[0] : null;
      const matches = normalizedPrescriptionDate === normalizedVisitDate;
      if (matches) {
        console.log(`✅ Prescription ${p.id} matches visit date: ${prescriptionVisitDate}`);
      }
      return matches;
    });
    console.log(`✅ Found ${visitPrescriptions.length} prescriptions for visit date ${visitDate} (out of ${patient.prescriptions?.length || 0} total)`);
  } else {
    console.log('⚠️ No visit date provided, showing all prescriptions:', visitPrescriptions.length);
  }
  
  console.log('📋 Displaying prescriptions:', visitPrescriptions.length, 'prescriptions');
  console.log('About to call displayPrescriptionsSummary with:', visitPrescriptions);
  
  // Display prescriptions summary (visit-specific - shows prescriptions for this visit only)
  try {
  displayPrescriptionsSummary(visitPrescriptions);
    console.log('displayPrescriptionsSummary called successfully');
  } catch (error) {
    console.error('Error calling displayPrescriptionsSummary:', error);
  }
  
  // Display medications from prescriptions
  // CRITICAL FIX: Show ALL prescriptions (not filtered by visit date) to match patient-details and patient-encounters behavior
  // This ensures all existing medications are visible, not just those from the current visit
  try {
    // Use all prescriptions, not just visit-specific ones
    const allPrescriptions = patient.prescriptions || [];
    console.log('📋 Displaying medications from ALL prescriptions:', allPrescriptions.length, 'prescriptions (not filtered by visit date)');
    await displayMedicationsFromPrescriptions(allPrescriptions);
    console.log('displayMedicationsFromPrescriptions called successfully');
  } catch (error) {
    console.error('Error calling displayMedicationsFromPrescriptions:', error);
  }
}

// Load all prescriptions for a patient (for patient-details.html)
async function loadAllPrescriptionsForPatient(patientId) {
  console.log('🔍 loadAllPrescriptionsForPatient: Loading prescriptions for patient:', patientId);
  
  // Use resolvePatientByIdentifier to handle UUID and display IDs
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    console.log('🔍 loadAllPrescriptionsForPatient: Using resolvePatientByIdentifier...');
    patient = await window.resolvePatientByIdentifier(patientId);
    console.log('🔍 loadAllPrescriptionsForPatient: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null');
  } else {
    console.warn('⚠️ loadAllPrescriptionsForPatient: resolvePatientByIdentifier not available, using fallback...');
    // Fallback: Try both localStorage keys if patient not found
    let patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p._supabaseUuid === patientId) ||
              patients.find(p => p.patient_id === patientId);
    
    // If not found, try with different key organization
    if (!patient) {
      console.log('🔍 Patient not found in primary key, trying all localStorage keys...');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('patients')) {
          try {
            const testPatients = JSON.parse(localStorage.getItem(key) || "[]");
            patient = testPatients.find(p => p.id === patientId) ||
                      testPatients.find(p => p._supabaseUuid === patientId) ||
                      testPatients.find(p => p.patient_id === patientId);
            if (patient) {
              console.log('✅ Found patient in key:', key);
              break;
            }
          } catch (e) {
            console.log('Error parsing', key);
          }
        }
      }
    }
  }
  
  if (!patient) {
    console.error('❌ loadAllPrescriptionsForPatient: Patient not found! Identifier:', patientId);
    return;
  }
  
  // Always refresh prescriptions from Supabase when available (latest pharmacy_status and per-line status)
  let allPrescriptions = patient.prescriptions || [];
  try {
    const supabasePrescriptions = await fetchPrescriptionsFromSupabaseForPatient(patientId, patient);
    if (supabasePrescriptions && supabasePrescriptions.length > 0) {
      allPrescriptions = mergePrescriptionsFromSupabase(patient.prescriptions, supabasePrescriptions);
      patient.prescriptions = allPrescriptions;
      const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      const updated = patients.map(p => (p.id === patient.id || p.patient_id === patient.patient_id || p._supabaseUuid === patient._supabaseUuid) ? patient : p);
      localStorage.setItem(getDataKey("patients"), JSON.stringify(updated));
      console.log('✅ Refreshed prescriptions from Supabase for patient-details');
    }
  } catch (error) {
    console.warn('⚠️ Exception refreshing prescriptions from Supabase:', error);
  }

  const _pdRxBefore = (patient.prescriptions || []).length;
  patient.prescriptions = dedupeLegacyRxAfterSupabaseMerge(patient.prescriptions || []);
  allPrescriptions = patient.prescriptions || [];
  if (patient.prescriptions.length !== _pdRxBefore) {
    try {
      const patients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
      const updated = patients.map(p =>
        (p.id === patient.id || p.patient_id === patient.patient_id || p._supabaseUuid === patient._supabaseUuid)
          ? patient
          : p
      );
      localStorage.setItem(getDataKey('patients'), JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not persist deduped prescriptions (patient-details):', e);
    }
  }

  const _pdMnSnap = (patient.prescriptions || [])
    .map(p => `${p.id}:${typeof window.getPrescriptionMnemonic === 'function' ? window.getPrescriptionMnemonic(p) : p.prescription_number || ''}`)
    .join('|');
  if (typeof window.hydratePrescriptionMnemonicsFromSupabase === 'function') {
    await window.hydratePrescriptionMnemonicsFromSupabase(patient.prescriptions || []);
  }
  allPrescriptions = patient.prescriptions || [];
  const _pdMnSnap2 = (patient.prescriptions || [])
    .map(p => `${p.id}:${typeof window.getPrescriptionMnemonic === 'function' ? window.getPrescriptionMnemonic(p) : p.prescription_number || ''}`)
    .join('|');
  if (_pdMnSnap !== _pdMnSnap2) {
    try {
      const patients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
      const updated = patients.map(p =>
        (p.id === patient.id || p.patient_id === patient.patient_id || p._supabaseUuid === patient._supabaseUuid)
          ? patient
          : p
      );
      localStorage.setItem(getDataKey('patients'), JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not persist hydrated mnemonics (patient-details):', e);
    }
  }
  
  console.log('Found all prescriptions for patient:', allPrescriptions.length);
  
  // Display all prescriptions summary
  displayAllPrescriptionsSummary(allPrescriptions);
  
  // Display active medications from prescriptions
  await displayActiveMedicationsFromPrescriptions(allPrescriptions);
  
  // Show/hide prescription button based on user role
  const user = JSON.parse(localStorage.getItem("user"));
  const prescriptionBtn = document.getElementById('new-prescription-btn');
  if (prescriptionBtn) {
    // Only Doctor, Nurse, and Physician Assistant can write prescriptions
    const canWritePrescriptions = user && (user.role === "Doctor" || user.role === "Nurse" || user.role === "Physician Assistant");
    prescriptionBtn.style.display = canWritePrescriptions ? 'block' : 'none';
  }
}
// Display prescriptions summary table
function displayPrescriptionsSummary(prescriptions) {
  console.log('displayPrescriptionsSummary called with:', prescriptions);
  
  // Wait for DOM to be ready if elements don't exist yet
  if (!document.getElementById('prescriptions-list') || !document.getElementById('no-prescriptions-message-clinical')) {
    console.log('DOM elements not ready, retrying in 100ms...');
    setTimeout(() => displayPrescriptionsSummary(prescriptions), 100);
    return;
  }
  
  const prescriptionsList = document.getElementById('prescriptions-list');
  const noPrescriptionsMessage = document.getElementById('no-prescriptions-message-clinical');
  
  console.log('Found elements - prescriptionsList:', prescriptionsList, 'noPrescriptionsMessage:', noPrescriptionsMessage);
  
  if (!prescriptionsList) {
    console.log('prescriptionsList not found, returning');
    return;
  }
  
  if (prescriptions.length === 0) {
    console.log('No prescriptions found, clearing table and showing message');
    prescriptionsList.innerHTML = ''; // Clear the table
    if (noPrescriptionsMessage) {
      // Show the footnote with proper styling
      noPrescriptionsMessage.style.display = 'block';
      noPrescriptionsMessage.style.visibility = 'visible';
      noPrescriptionsMessage.style.opacity = '1';
      noPrescriptionsMessage.style.position = 'relative';
      noPrescriptionsMessage.style.zIndex = '100';
      noPrescriptionsMessage.style.marginTop = '20px';
      noPrescriptionsMessage.style.backgroundColor = '#f8f9fa';
      noPrescriptionsMessage.style.border = '2px solid #28a745';
      noPrescriptionsMessage.style.borderRadius = '8px';
      noPrescriptionsMessage.style.padding = '20px';
      console.log('No prescriptions message displayed');
      
      // Also ensure the button is visible
      const button = noPrescriptionsMessage.querySelector('#new-prescription-btn');
      if (button) {
        button.style.display = 'block';
        button.style.visibility = 'visible';
        button.style.opacity = '1';
      }
    } else {
      console.log('No prescriptions message element not found');
    }
    return;
  }
  
  // Keep the footnote visible even when prescriptions exist (for "Add New Prescription" button)
  if (noPrescriptionsMessage) {
    // Change the message text to indicate additional prescriptions can be added
    const messageElement = noPrescriptionsMessage.querySelector('p');
    if (messageElement) {
      messageElement.textContent = 'Add another prescription:';
      messageElement.style.fontStyle = 'normal';
      messageElement.style.fontWeight = '600';
      messageElement.style.color = '#333';
      messageElement.style.marginBottom = '15px';
    }
    
    // Ensure the footnote is visible
    noPrescriptionsMessage.style.display = 'block';
    noPrescriptionsMessage.style.visibility = 'visible';
    noPrescriptionsMessage.style.opacity = '1';
    noPrescriptionsMessage.style.position = 'relative';
    noPrescriptionsMessage.style.zIndex = '100';
    noPrescriptionsMessage.style.marginTop = '20px';
    noPrescriptionsMessage.style.backgroundColor = '#f8f9fa';
    noPrescriptionsMessage.style.border = '2px solid #28a745';
    noPrescriptionsMessage.style.borderRadius = '8px';
    noPrescriptionsMessage.style.padding = '20px';
    
    // Ensure the button is visible
    const button = noPrescriptionsMessage.querySelector('#new-prescription-btn');
    if (button) {
      button.style.display = 'block';
      button.style.visibility = 'visible';
      button.style.opacity = '1';
    }
    
    console.log('Add New Prescription button kept visible');
  }
  
  function pharmacyStatusLabel(s) {
    if (!s) return '—';
    const labels = { pending: 'Pending', 'approved_by_pharmacist': 'Approved', 'in-process': 'In process', filled: 'Filled', completed: 'Completed', rejected: 'Rejected', sent_out: 'Sent out', cancelled: 'Cancelled', external: 'External' };
    return labels[s] || s;
  }
  function pharmacyStatusBg(s) {
    if (!s) return '#f0f0f0';
    const colors = { pending: '#fff3cd', 'approved_by_pharmacist': '#cce5ff', 'in-process': '#d1ecf1', filled: '#d4edda', completed: '#d4edda', rejected: '#f8d7da', sent_out: '#e2d5f1', cancelled: '#e2e3e5', external: '#e2d5f1' };
    return colors[s] || '#f0f0f0';
  }
  prescriptionsList.innerHTML = prescriptions.flatMap(prescription => 
    prescription.medications ? prescription.medications.map(medication => {
      const lineStatus = medication.pharmacy_line_status || prescription.pharmacy_status || '';
      const ps = lineStatus || prescription.pharmacy_status || '';
      return `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.name || ''}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.dosage || ''}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.route || ''}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.frequency || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">
          <span style="background: ${medication.status === 'Active' ? '#d4edda' : '#fff3cd'}; 
                       color: ${medication.status === 'Active' ? '#155724' : '#856404'}; 
                     padding: 4px 8px; border-radius: 12px; font-size: 12px;">
            ${medication.status || 'Active'}
        </span>
      </td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <span style="background:${pharmacyStatusBg(ps)};color:#333;padding:4px 8px;border-radius:12px;font-size:12px;">${pharmacyStatusLabel(ps)}</span>
      </td>
      <td style="border: 1px solid #ddd; padding: 8px;">
          <div style="display: flex; gap: 2px; flex-wrap: nowrap; align-items: center;">
        <button onclick="viewPrescription('${prescription.id}')" 
                    style="background: linear-gradient(135deg, #4169E1 0%, #1E90FF 100%); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px; box-shadow: 0 2px 4px rgba(65, 105, 225, 0.3);">
              View
        </button>
        <button onclick="editPrescription('${prescription.id}')" 
                    style="background: linear-gradient(135deg, #FF8C00 0%, #CD7F32 100%); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px; box-shadow: 0 2px 4px rgba(255, 140, 0, 0.3);">
              Edit
        </button>
        <button onclick="printPrescription('${prescription.id}')" 
                    style="background: linear-gradient(135deg, #FFD700 0%, #B8860B 100%); color: #36454F; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px; box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);">
              Print
        </button>
          </div>
      </td>
    </tr>
    `;
    }) : []
  ).join('');
}

// Display medications from prescriptions (hydrates mnemonics from DB when possible)
async function displayMedicationsFromPrescriptions(prescriptions) {
  console.log('displayMedicationsFromPrescriptions called with:', prescriptions.length, 'prescriptions');

  if (typeof window.hydratePrescriptionMnemonicsFromSupabase === 'function' && prescriptions && prescriptions.length > 0) {
    await window.hydratePrescriptionMnemonicsFromSupabase(prescriptions);
  }
  
  // Wait for DOM to be ready if elements don't exist yet
  if (!document.getElementById('medications-from-prescriptions') || !document.getElementById('no-medications-message-clinical')) {
    console.log('DOM elements not ready, retrying in 100ms...');
    setTimeout(() => { void displayMedicationsFromPrescriptions(prescriptions); }, 100);
    return;
  }
  
  const medicationsList = document.getElementById('medications-from-prescriptions');
  const noMedicationsMessage = document.getElementById('no-medications-message-clinical');
  
  console.log('Found DOM elements:', {
    medicationsList: !!medicationsList,
    noMedicationsMessage: !!noMedicationsMessage
  });
  
  if (!medicationsList) {
    console.error('medications-from-prescriptions element not found!');
    return;
  }
  
  if (prescriptions.length === 0) {
    // Don't clear the table if there are patient-reported medications already displayed
    const existingRows = medicationsList.querySelectorAll('tr');
    if (existingRows.length === 0) {
      medicationsList.innerHTML = ''; // Only clear if table is empty
    if (noMedicationsMessage) {
      noMedicationsMessage.style.display = 'block'; // Show the footnote
      }
    }
    return;
  }
  
  // Hide the footnote if medications exist
  if (noMedicationsMessage) {
    noMedicationsMessage.style.display = 'none';
  }
  
  // Flatten all medications from all prescriptions
  const allMedications = [];
  const seenMedications = new Set(); // Track seen medications to prevent duplicates
  
  console.log('Processing prescriptions for medications:', prescriptions);
  
  prescriptions.forEach((prescription, index) => {
    console.log(`Processing prescription ${index + 1}:`, prescription);
    if (prescription.medications && prescription.medications.length > 0) {
      console.log(`Found ${prescription.medications.length} medications in prescription ${prescription.id}`);
      prescription.medications.forEach((med, medIndex) => {
        console.log(`Processing medication ${medIndex + 1}:`, med);
        // Create a unique key for this medication to prevent duplicates
        const medicationKey = `${prescription.id}-${med.name}-${med.strength}-${med.form}`;
        
        if (!seenMedications.has(medicationKey)) {
          seenMedications.add(medicationKey);
          const mnemonic =
            (typeof window.getPrescriptionMnemonic === 'function'
              ? window.getPrescriptionMnemonic(prescription)
              : '') ||
            prescription.prescription_number ||
            prescription.prescriptionNumber ||
            null;
          const medicationWithId = {
          ...med,
          prescriptionId: prescription.id,
          prescriptionNumber: mnemonic,
          _parentPrescription: prescription
          };
          allMedications.push(medicationWithId);
          console.log('Added medication to list:', medicationWithId);
        } else {
          console.log('Skipped duplicate medication:', medicationKey);
        }
      });
    } else {
      console.log(`No medications found in prescription ${prescription.id}`);
    }
  });
  
  console.log('Total medications to display:', allMedications.length, allMedications);
  
  if (allMedications.length === 0) {
    console.log('No medications to display, showing empty message');
    medicationsList.innerHTML = `
      <tr>
        <td colspan="7" style="border: 1px solid #ddd; padding: 15px; text-align: center; color: #666; font-style: italic;">
          No medications found in prescriptions.
        </td>
      </tr>
    `;
    return;
  }
  
  // Check if user is a doctor to show delete buttons
  const user = JSON.parse(localStorage.getItem("user"));
  const isDoctor = user && user.role === "Doctor";
  
  // Update table header to include Actions column for doctors
  const table = medicationsList.closest('table');
  if (table && isDoctor) {
    const thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('th:last-child').textContent.includes('Actions')) {
      thead.innerHTML += '<th>Actions</th>';
    }
  }
  
  // Generate HTML with Nigerian Heritage theme - minimal inline styles to allow CSS classes to work
  const htmlContent = allMedications.map(med => {
    const prescForLabel = med._parentPrescription || {
      id: med.prescriptionId,
      prescription_number: med.prescriptionNumber,
      prescriptionNumber: med.prescriptionNumber
    };
    const label =
      typeof window.getPrescriptionDisplayLabel === 'function'
        ? window.getPrescriptionDisplayLabel(prescForLabel)
        : med.prescriptionId || '';
    const tipRaw =
      typeof window.getPrescriptionDisplayTitle === 'function'
        ? window.getPrescriptionDisplayTitle(prescForLabel)
        : String(med.prescriptionId || '');
    const tip = tipRaw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `
    <tr>
      <td style="padding: 8px 6px; font-weight: 500;">${med.name || ''}</td>
      <td style="padding: 8px 6px;">${med.strength || ''} ${med.form || ''}</td>
      <td style="padding: 8px 6px;">${med.directions || ''}</td>
      <td style="padding: 8px 6px; text-align: center;">${med.quantity || ''}</td>
      <td style="padding: 8px 6px; text-align: center;">${med.duration || ''} days</td>
      <td style="padding: 8px 6px; text-align: center;">${med.refills || ''}</td>
      <td style="padding: 8px 6px; font-weight: 600; color: #333; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis;" title="${tip}">${label}</td>
      ${isDoctor ? `<td style="padding: 8px 6px; overflow: visible !important; white-space: nowrap !important;">
        <button onclick="deletePrescription('${med.prescriptionId}')" 
                class="btn-danger"
                style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%) !important; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 100px; white-space: nowrap !important; overflow: visible !important; box-shadow: 0 2px 5px rgba(220, 53, 69, 0.3); display: inline-block;"
                title="Delete Prescription">
          🗑️ Delete
        </button>
      </td>` : ''}
    </tr>
  `;
  }).join('');
  
  console.log('Generated HTML content for medications table:', htmlContent);
  console.log('Setting innerHTML on element:', medicationsList);
  
  medicationsList.innerHTML = htmlContent;
  
  console.log('Medications table updated. Current innerHTML:', medicationsList.innerHTML);
}

// Format date as YYYY-MM-DD (local)
function formatDate(date) {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Delete prescription function (doctors only)
window.deletePrescription = function(prescriptionId) {
  // Check if user is a doctor
  const user = JSON.parse(localStorage.getItem("user"));
  // Only Doctor, Nurse, and Physician Assistant can write prescriptions
  const canWritePrescriptions = user && (user.role === "Doctor" || user.role === "Nurse" || user.role === "Physician Assistant");
  if (!canWritePrescriptions) {
    alert("Only doctors, nurses, and physician assistants can delete prescriptions.");
    return;
  }
  
  // Confirm deletion
  if (!confirm(`Are you sure you want to delete prescription ${prescriptionId}? This action cannot be undone.`)) {
    return;
  }
  
  // Get current patient ID
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  
  if (!patientId) {
    alert("Patient ID not found.");
    return;
  }
  
  // Load patients data
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);
  
  if (!patient) {
    alert("Patient not found.");
    return;
  }
  
  // Remove prescription from patient's prescriptions and/or master list (either may hold the record)
  let removedPatient = false;
  if (patient.prescriptions) {
    const initialCount = patient.prescriptions.length;
    patient.prescriptions = patient.prescriptions.filter(p => !prescriptionRecordMatches(p, prescriptionId));
    removedPatient = patient.prescriptions.length < initialCount;
  }
  
  const prescriptions = JSON.parse(localStorage.getItem(getDataKey("prescriptions")) || "[]");
  const initialPrescriptionCount = prescriptions.length;
  const filteredPrescriptions = prescriptions.filter(p => !prescriptionRecordMatches(p, prescriptionId));
  const removedMaster = filteredPrescriptions.length < initialPrescriptionCount;
  
  if (!removedPatient && !removedMaster) {
    alert("Prescription not found.");
    return;
  }
  
  // Save updated data
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  localStorage.setItem(getDataKey("prescriptions"), JSON.stringify(filteredPrescriptions));
  
  // Audit log: Prescription deleted
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('prescription_deleted', {
      prescriptionId: prescriptionId,
      patientId: patientId,
      patientName: patient.firstName + ' ' + patient.lastName
    });
  }
  
  // Show success message
  alert(`Prescription ${prescriptionId} has been deleted successfully.`);
  
  // Refresh the display
  loadPrescriptionsForVisit(patientId, urlParams.get("visitDate"));
  
  // Dispatch event for other components to refresh
  window.dispatchEvent(new CustomEvent('patientDataUpdated', {
    detail: { patientId, action: 'prescriptionDeleted', prescriptionId }
  }));
  
  console.log(`Prescription ${prescriptionId} deleted by doctor ${user.name}`);
};

// Display all prescriptions summary for patient-details.html
function displayAllPrescriptionsSummary(prescriptions) {
  const prescriptionsList = document.getElementById('all-prescriptions-list');
  
  if (!prescriptionsList) return;
  
  if (prescriptions.length === 0) {
    prescriptionsList.innerHTML = ''; // Clear the table
    // Show the no prescriptions message
    const noPrescriptionsMessage = document.getElementById('no-prescriptions-message');
    if (noPrescriptionsMessage) {
      noPrescriptionsMessage.style.display = 'block';
    }
    return;
  }
  
  // Keep the no prescriptions message visible even when prescriptions exist (for "Add New Prescription" button)
  const noPrescriptionsMessage = document.getElementById('no-prescriptions-message');
  if (noPrescriptionsMessage) {
    // Change the message text to indicate additional prescriptions can be added
    const messageElement = noPrescriptionsMessage.querySelector('p');
    if (messageElement) {
      messageElement.textContent = 'Add another prescription:';
      messageElement.style.fontStyle = 'normal';
      messageElement.style.fontWeight = '600';
      messageElement.style.color = '#333';
      messageElement.style.marginBottom = '15px';
    }
    
    // Ensure the message is visible
    noPrescriptionsMessage.style.display = 'block';
    noPrescriptionsMessage.style.visibility = 'visible';
    noPrescriptionsMessage.style.opacity = '1';
    noPrescriptionsMessage.style.position = 'relative';
    noPrescriptionsMessage.style.zIndex = '100';
    noPrescriptionsMessage.style.marginTop = '20px';
    noPrescriptionsMessage.style.backgroundColor = '#f8f9fa';
    noPrescriptionsMessage.style.border = '2px solid #28a745';
    noPrescriptionsMessage.style.borderRadius = '8px';
    noPrescriptionsMessage.style.padding = '20px';
    
    // Ensure the button is visible
    const button = noPrescriptionsMessage.querySelector('#new-prescription-btn');
    if (button) {
      button.style.display = 'block';
      button.style.visibility = 'visible';
      button.style.opacity = '1';
    }
  }
  
  // Sort prescriptions by date (newest first)
  const sortedPrescriptions = prescriptions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  function pharmacyStatusLabel(s) {
    if (!s) return '—';
    const labels = { pending: 'Pending', 'approved_by_pharmacist': 'Approved', 'in-process': 'In process', filled: 'Filled', completed: 'Completed', rejected: 'Rejected', sent_out: 'Sent out', cancelled: 'Cancelled', external: 'External' };
    return labels[s] || s;
  }
  function pharmacyStatusBg(s) {
    if (!s) return '#f0f0f0';
    const colors = { pending: '#fff3cd', 'approved_by_pharmacist': '#cce5ff', 'in-process': '#d1ecf1', filled: '#d4edda', completed: '#d4edda', rejected: '#f8d7da', sent_out: '#e2d5f1', cancelled: '#e2e3e5', external: '#e2d5f1' };
    return colors[s] || '#f0f0f0';
  }
  prescriptionsList.innerHTML = sortedPrescriptions.flatMap(prescription => 
    prescription.medications ? prescription.medications.map(medication => {
      const ps = prescription.pharmacy_status || '';
      return `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.name || ''}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.dosage || ''}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.route || ''}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${medication.frequency || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">
          <span style="background: ${medication.status === 'Active' ? '#d4edda' : '#fff3cd'}; 
                       color: ${medication.status === 'Active' ? '#155724' : '#856404'}; 
                     padding: 4px 8px; border-radius: 12px; font-size: 12px;">
            ${medication.status || 'Active'}
        </span>
      </td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <span style="background:${pharmacyStatusBg(ps)};color:#333;padding:4px 8px;border-radius:12px;font-size:12px;">${pharmacyStatusLabel(ps)}</span>
      </td>
      <td style="border: 1px solid #ddd; padding: 8px;">
          <div style="display: flex; gap: 2px; flex-wrap: nowrap; align-items: center;">
        <button onclick="viewPrescription('${prescription.id}')" 
                    style="background: linear-gradient(135deg, #4169E1 0%, #1E90FF 100%); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px; box-shadow: 0 2px 4px rgba(65, 105, 225, 0.3);">
              View
        </button>
        <button onclick="editPrescription('${prescription.id}')" 
                    style="background: linear-gradient(135deg, #FF8C00 0%, #CD7F32 100%); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px; box-shadow: 0 2px 4px rgba(255, 140, 0, 0.3);">
              Edit
        </button>
        <button onclick="printPrescription('${prescription.id}')" 
                    style="background: linear-gradient(135deg, #FFD700 0%, #B8860B 100%); color: #36454F; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px; box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);">
              Print
        </button>
          </div>
      </td>
    </tr>
    `;
    }) : []
  ).join('');
}

// Display active medications from prescriptions for patient-details.html
async function displayActiveMedicationsFromPrescriptions(prescriptions) {
  const medicationsList = document.getElementById('active-medications-list');
  
  if (!medicationsList) return;
  
  // Get the no active medications message div
  const noActiveMedsMessage = document.getElementById('no-active-medications-message');
  
  // Get patient-reported medications
  const urlParams = new URLSearchParams(window.location.search);
  let patientId = urlParams.get("patientId") || urlParams.get("id");
  
  // CRITICAL FIX: Use resolvePatientByIdentifier to handle both UUIDs and legacy IDs
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    try {
      patient = await window.resolvePatientByIdentifier(patientId);
      // If resolved, update patientId to legacy ID for consistency
      if (patient) {
        const legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id);
        if (legacyId && !legacyId.includes('-')) {
          patientId = legacyId;
        }
      }
    } catch (error) {
      console.warn('Error resolving patient identifier in displayActiveMedicationsFromPrescriptions:', error);
    }
  }
  
  // Fallback: Load from Supabase-first priority if resolvePatientByIdentifier didn't work
  if (!patient) {
    // Use Supabase-first priority loader
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      try {
        const patients = await window.loadPatientsWithSupabasePriority();
        if (patients && Array.isArray(patients)) {
          patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);
        }
      } catch (error) {
        console.warn('Error loading patients with Supabase priority:', error);
      }
    }
    
    // Final fallback to localStorage
    if (!patient) {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);
    }
  }
  
  const patientMedications = patient?.medications || [];
  
  // Get all medications from signed prescriptions
  const prescriptionMedications = [];
  prescriptions.forEach(prescription => {
    if (prescription.status === 'signed' && prescription.medications && prescription.medications.length > 0) {
      prescription.medications.forEach(med => {
        prescriptionMedications.push({
          ...med,
          source: 'Doctor-Prescribed',
          prescriptionId: prescription.id,
          prescribedDate: prescription.date,
          prescriber: prescription.prescriber?.name || 'Unknown'
        });
      });
    }
  });
  
  // Mark patient-reported medications
  const markedPatientMedications = patientMedications.map(med => ({
    ...med,
    source: 'Patient-Reported'
  }));
  
  // Combine both sources
  const allActiveMedications = [...markedPatientMedications, ...prescriptionMedications];
  
  if (allActiveMedications.length === 0) {
    medicationsList.innerHTML = `
      <tr>
        <td colspan="6" style="border: 1px solid #ddd; padding: 15px; text-align: center; color: #666; font-style: italic;">
          No active medications found. Add patient-reported medications or create signed prescriptions to see them here.
        </td>
      </tr>
    `;
    // Show the no active medications message
    if (noActiveMedsMessage) {
      noActiveMedsMessage.style.display = 'block';
    }
    return;
  }
  
  // Hide the no active medications message if we have medications
  if (noActiveMedsMessage) {
    noActiveMedsMessage.style.display = 'none';
  }
  
  // Display with 6-column structure: Medication Name, Dosage, Route, Frequency, Status, Actions
  medicationsList.innerHTML = allActiveMedications.map((med, index) => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px; font-weight: 500;">
        ${med.name || ''}
        <br><small style="color: #666; font-size: 11px;">${med.source}</small>
      </td>
      <td style="border: 1px solid #ddd; padding: 8px;">${med.dosage || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${med.route || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${med.frequency || ''}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <span style="background: ${med.status === 'Active' ? '#d4edda' : '#fff3cd'}; 
                     color: ${med.status === 'Active' ? '#155724' : '#856404'}; 
                     padding: 4px 8px; border-radius: 12px; font-size: 12px;">
          ${med.status || 'Active'}
        </span>
      </td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <div style="display: flex; gap: 2px; flex-wrap: nowrap; align-items: center;">
          ${med.source === 'Patient-Reported' ? `
            <button type="button" onclick="editEntry('medications', ${patientMedications.findIndex(pm => pm === med)})" 
                    style="background: #ffc107; color: black; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px;">
              Edit
            </button>
            <button type="button" onclick="deleteEntry('medications', ${patientMedications.findIndex(pm => pm === med)})" 
                    style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px;">
              Delete
            </button>
          ` : `
            <button onclick="viewPrescription('${med.prescriptionId}')" 
                    style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px;">
              View
            </button>
            <button onclick="editPrescription('${med.prescriptionId}')" 
                    style="background: #ffc107; color: black; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px; min-width: 50px;">
              Edit
            </button>
          `}
        </div>
      </td>
    </tr>
  `).join('');
}

/** Locate a prescription in master list or any patient's embedded list (by id, Supabase id, or prescription_number). */
function findPrescriptionRecord(prescriptionId) {
  const pid = prescriptionId;
  if (pid == null || pid === '') return null;
  try {
    const master = JSON.parse(localStorage.getItem(getDataKey('prescriptions')) || '[]');
    let p = master.find(
      x =>
        x.id === pid ||
        x._supabaseId === pid ||
        x.prescription_number === pid ||
        x.prescriptionNumber === pid
    );
    if (p) return p;
    const patients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
    for (let i = 0; i < patients.length; i++) {
      const pat = patients[i];
      if (!pat || !pat.prescriptions) continue;
      p = pat.prescriptions.find(
        x =>
          x.id === pid ||
          x._supabaseId === pid ||
          x.prescription_number === pid ||
          x.prescriptionNumber === pid
      );
      if (p) return p;
    }
  } catch (e) {
    console.warn('findPrescriptionRecord:', e);
  }
  return null;
}

function prescriptionRecordMatches(p, prescriptionId) {
  const pid = prescriptionId;
  return (
    !!p &&
    (p.id === pid ||
      p._supabaseId === pid ||
      p.prescription_number === pid ||
      p.prescriptionNumber === pid)
  );
}

// View prescription details
window.viewPrescription = async function(prescriptionId) {
  // Temporarily disable auto-save to prevent popup
  const wasAutoSaveEnabled = !window._skipAutoSave;
  window._skipAutoSave = true;
  
  let prescription = findPrescriptionRecord(prescriptionId);
  
  if (!prescription) {
    alert('Prescription not found');
    // Re-enable auto-save
    window._skipAutoSave = !wasAutoSaveEnabled;
    return;
  }

  if (typeof window.hydratePrescriptionMnemonicsFromSupabase === 'function') {
    await window.hydratePrescriptionMnemonicsFromSupabase([prescription]);
  }
  if (typeof window.normalizePrescriptionRecord === 'function') {
    window.normalizePrescriptionRecord(prescription);
  }

  const headerLabel = typeof window.getPrescriptionDisplayLabel === 'function'
    ? window.getPrescriptionDisplayLabel(prescription)
    : (prescription.id || '');
  
  // Create view modal
  const modal = document.createElement('div');
  modal.id = 'prescription-view-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    width: 95%;
    max-width: 1200px;
    max-height: 90%;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;
  
  const modalHeader = document.createElement('div');
  modalHeader.style.cssText = `
    padding: 15px 20px;
    background: #007bff;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  `;
  modalHeader.innerHTML = `
    <h2 style="margin: 0; font-size: 20px;">📋 Prescription Details - ${headerLabel}</h2>
    <button onclick="closePrescriptionViewModal()" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 16px;">✕ Close</button>
  `;
  
  const modalBody = document.createElement('div');
  modalBody.style.cssText = `
    flex: 1;
    overflow: auto;
    padding: 20px;
  `;
  modalBody.innerHTML = generatePrescriptionViewContent(prescription);
  
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Add close function to global scope
  window.closePrescriptionViewModal = function() {
    const modal = document.getElementById('prescription-view-modal');
    if (modal) {
      modal.remove();
    }
    // Re-enable auto-save after modal is closed
    window._skipAutoSave = !wasAutoSaveEnabled;
  };
  
  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      window.closePrescriptionViewModal();
    }
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('prescription-view-modal')) {
      window.closePrescriptionViewModal();
    }
  });
};
// Print prescription
window.printPrescription = async function(prescriptionId) {
  // Temporarily disable auto-save to prevent popup
  const wasAutoSaveEnabled = !window._skipAutoSave;
  window._skipAutoSave = true;
  
  let prescription = findPrescriptionRecord(prescriptionId);
  
  if (!prescription) {
    alert('Prescription not found');
    // Re-enable auto-save
    window._skipAutoSave = !wasAutoSaveEnabled;
    return;
  }

  if (typeof window.hydratePrescriptionMnemonicsFromSupabase === 'function') {
    await window.hydratePrescriptionMnemonicsFromSupabase([prescription]);
  }
  if (typeof window.normalizePrescriptionRecord === 'function') {
    window.normalizePrescriptionRecord(prescription);
  }
  
  // Generate print content
  const printContent = generatePrescriptionPrintContent(prescription);
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Prescription - ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(prescription) : (window.getPrescriptionMnemonic(prescription) || prescription.id)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .prescription-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .prescription-body { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .prescription-footer { border-top: 2px solid #333; padding-top: 20px; text-align: center; }
          .medication-item { border: 1px solid #333; padding: 15px; margin: 10px 0; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${printContent}
      </body>
    </html>
  `);
  
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = function() {
    setTimeout(() => {
  printWindow.print();
    }, 100);
  };
  
  // Re-enable auto-save after a short delay
  setTimeout(() => {
    window._skipAutoSave = !wasAutoSaveEnabled;
  }, 1000);
};

// Edit prescription
window.editPrescription = function(prescriptionId) {
  // Check if user is a doctor
  const user = JSON.parse(localStorage.getItem("user"));
  // Only Doctor, Nurse, and Physician Assistant can write prescriptions
  const canWritePrescriptions = user && (user.role === "Doctor" || user.role === "Nurse" || user.role === "Physician Assistant");
  if (!canWritePrescriptions) {
    alert("Only doctors, nurses, and physician assistants can edit prescriptions.");
    return;
  }
  
  // Prevent auto-save from triggering on clinical-note.html
  const wasAutoSaveEnabled = !window._skipAutoSave;
  window._skipAutoSave = true;
  
  // Get current patient and visit information
  const urlParams = new URLSearchParams(window.location.search);
  let patientId = urlParams.get("patientId");
  const visitDate = urlParams.get("visitDate");
  
  // For patient-details.html, get patientId from id parameter
  if (!patientId) {
    patientId = urlParams.get("id");
  }
  
  if (!patientId) {
    alert("Patient ID not found. Please ensure you're on a valid patient page.");
    // Re-enable auto-save
    window._skipAutoSave = !wasAutoSaveEnabled;
    return;
  }
  
  // Load patients data and find the prescription in patient's prescriptions array
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);
  
  if (!patient) {
    alert("Patient not found");
    // Re-enable auto-save
    window._skipAutoSave = !wasAutoSaveEnabled;
    return;
  }
  
  const prescription = (patient.prescriptions || []).find(p => prescriptionRecordMatches(p, prescriptionId));
  
  if (!prescription) {
    alert('Prescription not found');
    // Re-enable auto-save
    window._skipAutoSave = !wasAutoSaveEnabled;
    return;
  }
  
  // Store prescription data temporarily in localStorage for the form to load
  localStorage.setItem('_editingPrescription', JSON.stringify(prescription));
  
  // Open prescription.html in a new window with the prescription ID
  const prescriptionUrl = visitDate ? 
    `prescription?patientId=${patientId}&visitDate=${visitDate}&editId=${prescriptionId}` :
    `prescription?patientId=${patientId}&editId=${prescriptionId}`;
  
  console.log('Opening prescription form in edit mode:', prescriptionUrl);
  
  window.open(prescriptionUrl, '_blank');
  
  // Re-enable auto-save after a short delay (if it was enabled before)
  if (wasAutoSaveEnabled) {
    setTimeout(() => {
      window._skipAutoSave = false;
    }, 500);
  }
};

// Global message handler for prescription updates (add only once)
if (!window._prescriptionMessageHandlerAdded) {
  window.addEventListener('message', function(event) {
    // Global prescription message handler - message received (data removed for privacy)
    
    if (event.data.type === 'prescriptionSaved') {
      const refreshPrescriptionDisplays = async (patientId, visitDate) => {
        // Clear any cached patient data to force fresh reload
        window._patientsCache = null;

        if (patientId && typeof loadPrescriptionsForVisit === 'function' && visitDate) {
          loadPrescriptionsForVisit(patientId, visitDate);
        } else if (patientId && typeof loadAllPrescriptionsForPatient === 'function') {
          loadAllPrescriptionsForPatient(patientId);
        }

        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        const patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);

        if (patient && patient.prescriptions) {
          if (typeof displayMedicationsFromPrescriptions === 'function' && window.location.pathname.includes('clinical-note.html')) {
            await displayMedicationsFromPrescriptions(patient.prescriptions || []);
          }
          if (typeof displayActiveMedicationsFromPrescriptions === 'function' && window.location.pathname.includes('patient-details.html')) {
            await displayActiveMedicationsFromPrescriptions(patient.prescriptions);
          }
        }
      };

      // Handle prescription updates with edit context
      if (window._currentEditContext) {
      const { prescriptionId, patientId, visitDate } = window._currentEditContext;
      
      if (event.data.prescriptionId === prescriptionId) {
        console.log('Prescription updated, refreshing prescription display for prescriptionId:', prescriptionId);
        
        // Add a small delay to ensure localStorage is updated
        setTimeout(async () => {
          // Clear any cached patient data to force fresh reload
          window._patientsCache = null;
          
          // Refresh prescription display in the parent window
          if (visitDate) {
            loadPrescriptionsForVisit(patientId, visitDate);
          } else {
            loadAllPrescriptionsForPatient(patientId);
          }
          
          // Force refresh medications tables on both pages with fresh data
          const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          const patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);
          
          console.log('Refreshing medications - Patient found:', !!patient, 'Prescriptions count:', patient?.prescriptions?.length);
          
          if (patient && patient.prescriptions) {
            // For clinical-note.html - refresh visit-specific medications
            if (visitDate) {
              // Show all prescriptions for the patient (not filtered by visit date)
              const visitPrescriptions = patient.prescriptions || [];
              console.log('All prescriptions for refresh:', visitPrescriptions.length, visitPrescriptions);
              await displayMedicationsFromPrescriptions(visitPrescriptions);
            }
            
            // For patient-details.html - refresh all active medications
            console.log('All prescriptions for refresh:', patient.prescriptions.length, patient.prescriptions);
            await displayActiveMedicationsFromPrescriptions(patient.prescriptions);
          }
          
          console.log('Medications tables refreshed after prescription update');
          
          // Dispatch a custom event to notify other components
          window.dispatchEvent(new CustomEvent('prescriptionUpdated', {
            detail: { 
              patientId, 
              prescriptionId, 
              visitDate,
              action: 'updated' 
            }
          }));
        }, 250); // Increased delay to ensure localStorage write is complete
        
        // Close the modal
        if (window.closePrescriptionEditModal) {
          window.closePrescriptionEditModal();
        }
        
        // Clear the edit context
        window._currentEditContext = null;
      }
      } else {
        // Handle new prescriptions (no edit context)
        console.log('New prescription saved, refreshing related pages');
        const urlParams = new URLSearchParams(window.location.search);
        const patientId = event.data.patientId || urlParams.get('patientId') || urlParams.get('id');
        const visitDate = urlParams.get('visitDate');
        
        // Check if we're on patient-encounters.html and refresh the page
        if (window.location.pathname.includes('patient-encounters.html')) {
          console.log('On patient-encounters page, refreshing encounters and prescriptions');
          
          // Small delay to ensure localStorage is updated
          setTimeout(() => {
            // Clear any cached patient data to force fresh reload
            window._patientsCache = null;
            
            // Reload patient encounters if the function exists
            if (typeof loadPatientEncounters === 'function') {
              loadPatientEncounters();
            }
            
            // Dispatch a custom event to notify other components
            window.dispatchEvent(new CustomEvent('prescriptionSaved', {
              detail: { 
                prescriptionId: event.data.prescriptionId,
                action: 'created' 
              }
            }));
          }, 250);
        }

        // Refresh clinical-note/patient-details displays when present
        if (patientId) {
          setTimeout(() => {
            refreshPrescriptionDisplays(patientId, visitDate);
          }, 250);
        }
      }
    }
  });
  
  window._prescriptionMessageHandlerAdded = true;
  // Global prescription message handler added
}

// Storage-based cross-tab refresh for prescriptions
if (!window._prescriptionStorageHandlerAdded) {
  window.addEventListener('storage', function(event) {
    if (event.key !== 'patientDataSync' || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue);
      if (payload.type !== 'prescriptionSaved') return;

      const urlParams = new URLSearchParams(window.location.search);
      const patientId = payload.patientId || urlParams.get('patientId') || urlParams.get('id');
      const visitDate = urlParams.get('visitDate');

      if (!patientId) return;

      setTimeout(async () => {
        window._patientsCache = null;
        if (typeof loadPrescriptionsForVisit === 'function' && visitDate) {
          loadPrescriptionsForVisit(patientId, visitDate);
        } else if (typeof loadAllPrescriptionsForPatient === 'function') {
          loadAllPrescriptionsForPatient(patientId);
        }

        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        const patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);

        if (patient && patient.prescriptions) {
          if (typeof displayMedicationsFromPrescriptions === 'function' && window.location.pathname.includes('clinical-note.html')) {
            await displayMedicationsFromPrescriptions(patient.prescriptions || []);
          }
          if (typeof displayActiveMedicationsFromPrescriptions === 'function' && window.location.pathname.includes('patient-details.html')) {
            await displayActiveMedicationsFromPrescriptions(patient.prescriptions);
          }
        }
      }, 250);
    } catch (e) {
      console.warn('Failed to parse patientDataSync payload:', e);
    }
  });
  window._prescriptionStorageHandlerAdded = true;
}

// Generate prescription view content for modal
function generatePrescriptionViewContent(prescription) {
  return `
    <div style="max-width: 800px; margin: 0 auto; font-family: Arial, sans-serif;">
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0;">
        <h1 style="color: #333; margin-bottom: 10px;">PRESCRIPTION</h1>
        <h2 style="color: #007bff; margin-bottom: 10px;">${prescription.prescriber.org || 'Medical Clinic'}</h2>
        <p style="margin: 5px 0; color: #666;">${prescription.prescriber.address}</p>
        <p style="margin: 5px 0; color: #666;">Phone: ${prescription.prescriber.phone} | Email: ${prescription.prescriber.email}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div>
          <h3 style="color: #333; margin-bottom: 15px;">Patient Information</h3>
          <p><strong>Name:</strong> ${prescription.patient.firstName} ${prescription.patient.lastName}</p>
          <p><strong>Date of Birth:</strong> ${prescription.patient.dateOfBirth}</p>
          <p><strong>Gender:</strong> ${prescription.patient.gender}</p>
          <p><strong>Patient ID:</strong> ${typeof window.patientMrnDisplay === 'function' ? window.patientMrnDisplay(prescription.patient, prescription.patient_id || prescription.patient?.patient_id) : '—'}</p>
          ${prescription.patient.address ? `<p><strong>Address:</strong> ${prescription.patient.address}</p>` : ''}
          ${prescription.patient.phone ? `<p><strong>Phone:</strong> ${prescription.patient.phone}</p>` : ''}
        </div>
        
        <div>
          <h3 style="color: #333; margin-bottom: 15px;">Prescriber Information</h3>
          <p><strong>Name:</strong> ${prescription.prescriber.name}</p>
          <p><strong>License:</strong> ${prescription.prescriber.license}</p>
          <p><strong>Specialty:</strong> ${prescription.prescriber.specialty || 'General Practice'}</p>
          <p><strong>Organization:</strong> ${prescription.prescriber.org}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #333; margin-bottom: 15px;">Prescription Details</h3>
        <p><strong>Prescription #:</strong> ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(prescription) : (prescription.id || '')}</p>
        <p style="color: #666; font-size: 13px;"><strong>Record ID:</strong> ${prescription.id}</p>
        <p><strong>Date:</strong> ${formatDate(prescription.date)}</p>
        <p><strong>Diagnosis/Indication:</strong> ${prescription.diagnosis}</p>
        <p><strong>Status:</strong> <span style="background: ${prescription.status === 'signed' ? '#d4edda' : '#fff3cd'}; color: ${prescription.status === 'signed' ? '#155724' : '#856404'}; padding: 4px 8px; border-radius: 12px; font-size: 12px;">${prescription.status === 'signed' ? '✓ Signed' : '📝 Draft'}</span></p>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #333; margin-bottom: 15px;">Medications</h3>
        ${prescription.medications && prescription.medications.length > 0 ? 
          prescription.medications.map((med, index) => `
            <div style="border: 1px solid #e0e0e0; padding: 15px; margin: 10px 0; border-radius: 8px; background: #f8f9fa;">
              <h4 style="color: #007bff; margin-bottom: 10px;">Medication #${index + 1}</h4>
              <p><strong>Name:</strong> ${med.name}</p>
              <p><strong>Strength:</strong> ${med.strength}</p>
              <p><strong>Form:</strong> ${med.form}</p>
              <p><strong>Route:</strong> ${med.route}</p>
              <p><strong>Quantity:</strong> ${med.quantity}</p>
              <p><strong>Duration:</strong> ${med.duration} days</p>
              <p><strong>Refills:</strong> ${med.refills}</p>
              <p><strong>Directions:</strong> ${med.directions}</p>
              ${med.warnings ? `<p><strong>Warnings:</strong> ${med.warnings}</p>` : ''}
            </div>
          `).join('') : 
          '<p style="color: #666; font-style: italic;">No medications found in this prescription.</p>'
        }
      </div>
      
      ${prescription.signature ? `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; margin-bottom: 15px;">Electronic Signature</h3>
          <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 8px; background: #f8f9fa;">
            <img src="${prescription.signature}" alt="Doctor's Signature" style="max-width: 200px; height: auto; border: 1px solid #ddd;">
            <p style="margin-top: 10px; color: #666;">Signed by: ${prescription.prescriber.name}</p>
            <p style="color: #666;">Date: ${prescription.signatureDate ? formatDate(prescription.signatureDate) : 'Not specified'}</p>
          </div>
        </div>
      ` : ''}
      
      <div style="text-align: center; padding-top: 20px; border-top: 2px solid #e0e0e0; color: #666; font-size: 12px;">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>Prescription: ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(prescription) : (window.getPrescriptionMnemonic(prescription) || prescription.id)}</p>
      </div>
    </div>
  `;
}

// Generate prescription print content
function generatePrescriptionPrintContent(prescription) {
  return `
    <div class="prescription-header">
      <h1>PRESCRIPTION</h1>
      <h2>${prescription.prescriber.org || 'Medical Clinic'}</h2>
      <p>${prescription.prescriber.address}</p>
      <p>Phone: ${prescription.prescriber.phone} | Email: ${prescription.prescriber.email}</p>
    </div>
    
    <div class="prescription-body">
      <div>
        <h3>PRESCRIBER INFORMATION</h3>
        <p><strong>Name:</strong> ${prescription.prescriber.name}</p>
        <p><strong>License:</strong> ${prescription.prescriber.license}</p>
        <p><strong>Specialty:</strong> ${prescription.prescriber.specialty}</p>
      </div>
      
      <div>
        <h3>PATIENT INFORMATION</h3>
        <p><strong>Name:</strong> ${prescription.patient.name}</p>
        <p><strong>DOB:</strong> ${prescription.patient.dob}</p>
        <p><strong>Gender:</strong> ${prescription.patient.gender || 'Not specified'}</p>
        <p><strong>Patient ID:</strong> ${typeof window.patientMrnDisplay === 'function' ? window.patientMrnDisplay(prescription.patient, prescription.patient_id || prescription.patient?.patient_id) : (getPatientIdentifier(prescription.patient) || prescription.patient.patient_id || prescription.patient.patientNumber || prescription.patient.id || 'Unknown ID')}</p>
      </div>
    </div>
    
    <div style="margin: 30px 0;">
      <h3>PRESCRIPTION DETAILS</h3>
      <p><strong>Date:</strong> ${prescription.date}</p>
        <p><strong>Prescription:</strong> ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(prescription) : (window.getPrescriptionMnemonic(prescription) || prescription.id)}</p>
        <p style="color:#666;font-size:12px;"><strong>Record ID:</strong> ${prescription.id}</p>
      <p><strong>Diagnosis/Indication:</strong> ${prescription.diagnosis}</p>
    </div>
    
    <div style="margin: 30px 0;">
      <h3>MEDICATIONS</h3>
      ${prescription.medications.map((med, index) => `
        <div class="medication-item">
          <h4>Medication #${index + 1}</h4>
          <p><strong>Name:</strong> ${med.name}</p>
          <p><strong>Strength:</strong> ${med.strength}</p>
          <p><strong>Form:</strong> ${med.form}</p>
          <p><strong>Route:</strong> ${med.route}</p>
          <p><strong>Quantity:</strong> ${med.quantity}</p>
          <p><strong>Duration:</strong> ${med.duration} days</p>
          <p><strong>Refills:</strong> ${med.refills}</p>
          <p><strong>Directions:</strong> ${med.directions}</p>
          ${med.warnings ? `<p><strong>Warnings:</strong> ${med.warnings}</p>` : ''}
        </div>
      `).join('')}
    </div>
    
    <div class="prescription-footer">
      <div style="border: 1px solid #333; height: 60px; margin: 20px 0; padding: 10px;">
        <p>Electronic Signature: ${prescription.prescriber.name}</p>
        <p>Date: ${new Date(prescription.signatureDate).toLocaleString()}</p>
      </div>
      
      <div style="margin-top: 20px; font-size: 12px; color: #666;">
        <p>Prescription: ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(prescription) : (window.getPrescriptionMnemonic(prescription) || prescription.id)}</p>
        <p>Generated on: ${new Date(prescription.savedAt).toLocaleString()}</p>
      </div>
    </div>
  `;
}

// Open clinical note by patient ID (for patient-details.html)
window.openClinicalNoteById = function(patientId, visitDate) {
  console.log('Opening clinical note for patient ID:', patientId, 'visit date:', visitDate);
  
  // Validate inputs
  if (!patientId || !visitDate) {
    alert("Missing patient ID or visit date.");
    return;
  }
  
  // Check if patient exists (match UUID, display patient_id, or legacy id)
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p =>
    p.id === patientId || p._supabaseUuid === patientId || p.patient_id === patientId || p.patientNumber === patientId
  );
  
  if (!patient) {
    alert("Patient not found.");
    return;
  }
  
  // Navigate to clinical note page - use patient ID if available, otherwise use UUID
  const patientIdForUrl = patient ? getPatientIdentifier(patient) : patientId;
  window.location.href = `/clinical-note?patientId=${patientIdForUrl}&visitDate=${visitDate}`;
};

// Open radiology note by patient ID (for patient-details.html)
// Note: This now goes to the same clinical-note.html page, which will auto-detect specialty
window.openRadiologyNoteById = async function(patientId, visitDate) {
  console.log('Opening radiology note for patient ID:', patientId, 'visit date:', visitDate);
  
  // Validate inputs
  if (!patientId || !visitDate) {
    alert("Missing patient ID or visit date.");
    return;
  }
  
  // CRITICAL FIX: Resolve UUID to legacy ID for URLs
  if (patientId && patientId.includes('-') && patientId.length === 36 && typeof window.resolvePatientByIdentifier === 'function') {
    try {
      const patient = await window.resolvePatientByIdentifier(patientId);
      if (patient) {
        const legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id);
        if (legacyId && !isUuidLike(legacyId)) {
          patientId = legacyId; // Use legacy ID for URL (hyphenated MFA-MC ids allowed)
        }
      }
    } catch (error) {
      console.warn('Could not resolve UUID to legacy ID, trying fallback:', error);
    }
  }
  
  // Fallback: Check if patient exists in localStorage
  if (!patientId.includes('-') || patientId.length !== 36) {
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patient = patients.find(p => p.id === patientId || p.patient_id === patientId);
    if (patient) {
      const legacyId = getPatientIdentifier(patient);
      if (legacyId) patientId = legacyId;
    }
  }
  
  // Navigate to clinical note page (same page, will auto-detect specialty and show radiology template) - always use legacy ID
  window.location.href = `/clinical-note?patientId=${patientId}&visitDate=${visitDate}`;
};

// Function to sync all patients from localStorage to Supabase
async function syncAllPatientsToSupabase() {
  // DO NOT sync on add-patient or edit-patient pages - would cause errors with incomplete data
  const currentPath = window.location.pathname;
  const isFormPage = currentPath.includes('add-patient') || 
                     currentPath.includes('edit-patient') ||
                     document.getElementById('add-patient-form') ||
                     document.getElementById('edit-patient-form');
  
  if (isFormPage) {
    // Silent skip on form pages to prevent errors
    return;
  }
  
  if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
    // Silent skip on pages that don't need Supabase (like order pages)
    return;
  }

  function getPatientLastUpdated(patient) {
    return patient.updated_at ||
      patient.lastModified ||
      patient.lastModifiedAt ||
      patient.last_updated ||
      patient.modified_at ||
      patient.created_at ||
      null;
  }

  function shouldSyncPatient(patient) {
    if (!patient) return false;
    const lastSynced = patient._lastSyncedAt;
    const lastUpdated = getPatientLastUpdated(patient);
    if (!lastUpdated) return !lastSynced;
    if (!lastSynced) return true;
    const updatedMs = new Date(lastUpdated).getTime();
    const syncedMs = new Date(lastSynced).getTime();
    if (Number.isNaN(updatedMs) || Number.isNaN(syncedMs)) return true;
    return updatedMs > syncedMs;
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }

  let hasSession = true;
  try {
    if (window.supabaseClient?.auth?.getSession) {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) {
        hasSession = false;
      } else {
        hasSession = !!data?.session;
      }
    }
  } catch (error) {
    hasSession = false;
  }

  if (!hasSession) {
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    
    // Get organization ID
    let orgId = user.organizationId;
    if (!orgId && user.org) {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const orgData = organizations[user.org];
      if (orgData && orgData.id) {
        orgId = orgData.id;
      }
    }
    
    // Default to Mecure Clinics org ID if no user data
    if (!orgId) {
      orgId = '576522cc-e769-4fb4-9487-3d150857d970';
    }
    
    // Get all patients from localStorage
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    // console.log(`📤 Syncing ${patients.length} patients to Supabase...`);
    
    let syncedCount = 0;
    let errorCount = 0;
    
    let stopSync = false;
    for (let i = 0; i < patients.length; i += 1) {
      const patient = patients[i];
      if (!shouldSyncPatient(patient)) {
        continue;
      }
      try {
        // Check if patient already exists in Supabase
        const { data: existing, error: checkError } = await supabaseClient
          .from('patients')
          .select('patient_id')
          .eq('patient_id', patient.id)
          .eq('organization_id', orgId);
        
        if (checkError) {
          const checkMsg = (checkError?.message || '').toLowerCase();
          if (checkMsg.includes('failed to fetch') || checkMsg.includes('network')) {
            console.warn('⚠️ Patient sync paused due to network error.');
            stopSync = true;
          }
          if (!window.CURRENT_PATIENT_ID || window.CURRENT_PATIENT_ID === patient.id) console.error('❌ Error checking existing patient:', checkError);
          errorCount++;
          continue;
        }
        
        if (existing && existing.length > 0) {
          // Patient exists, update instead of skip
          // Patient exists in Supabase, updating (ID removed for privacy)
          try {
            await window.savePatientToSupabase(patient);
            // Patient updated successfully
            syncedCount++;
            patient._lastSyncedAt = new Date().toISOString();
          } catch (updateError) {
            const updateMsg = String(updateError?.message || updateError || '').toLowerCase();
            if (updateMsg.includes('failed to fetch') || updateMsg.includes('network')) {
              console.warn('⚠️ Patient sync paused due to network error.');
              stopSync = true;
            }
            console.error('❌ Error updating patient:', updateError?.message || updateError);
            errorCount++;
          }
          continue;
        }
        
        // Insert new patient
        const { error: insertError } = await supabaseClient
          .from('patients')
          .insert({
            patient_id: patient.id,
            first_name: patient.firstName || '',
            middle_name: patient.middleName || '',
            last_name: patient.lastName || '',
            date_of_birth: patient.dob || '',
            gender: patient.gender || '',
            marital_status: patient.maritalStatus || '',
            phone: patient.phone || '',
            email: patient.email || '',
            address: patient.addressLine1 || '',
            city: patient.city || '',
            state: patient.state || '',
            country: patient.country || '',
            blood_group: patient.bloodGroup || '',
            allergies: JSON.stringify(patient.allergies || []),
            chronic_conditions: JSON.stringify(patient.conditions || []),
            emergency_contact_name: patient.emergencyFirstName && patient.emergencyLastName ? 
              `${patient.emergencyFirstName} ${patient.emergencyLastName}` : '',
            emergency_contact_phone: patient.emergencyPhone || '',
            emergency_contact_relationship: patient.emergencyRelationship || '',
            organization_id: orgId
          });
        
        if (insertError) {
          const insertMsg = (insertError?.message || '').toLowerCase();
          if (insertMsg.includes('failed to fetch') || insertMsg.includes('network')) {
            console.warn('⚠️ Patient sync paused due to network error.');
            stopSync = true;
          }
          if (!window.CURRENT_PATIENT_ID || window.CURRENT_PATIENT_ID === patient.id) {
            console.error('❌ Error inserting patient:', insertError);
          }
          errorCount++;
        } else {
          if (!window.CURRENT_PATIENT_ID || window.CURRENT_PATIENT_ID === patient.id) console.log(`✅ Synced patient: ${patient.id}`);
          syncedCount++;
          patient._lastSyncedAt = new Date().toISOString();
        }
      } catch (error) {
        const errMsg = String(error?.message || error || '').toLowerCase();
        if (errMsg.includes('failed to fetch') || errMsg.includes('network')) {
          console.warn('⚠️ Patient sync paused due to network error.');
          stopSync = true;
        }
        if (!window.CURRENT_PATIENT_ID || window.CURRENT_PATIENT_ID === patient.id) console.error('❌ Exception syncing patient:', error);
        errorCount++;
      }

      // Persist sync markers periodically and throttle to avoid network bursts
      if (i % 5 === 0) {
        try {
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        } catch (storageError) {
          console.warn('⚠️ Unable to persist patient sync markers:', storageError);
        }
        await sleep(150);
      }

      if (stopSync) {
        break;
      }
    }

    try {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    } catch (storageError) {
      console.warn('⚠️ Unable to persist patient sync markers:', storageError);
    }
    
    // console.log(`🎉 Patient sync complete: ${syncedCount} synced, ${errorCount} errors`);
    
    if (syncedCount > 0) {
      // Reload patients to get the latest data
      await loadPatients();
    }
    
  } catch (error) {
    console.error('❌ Exception in syncAllPatientsToSupabase:', error);
  }
}

// Show login prompt when organization ID is missing
async function showLoginPromptForMissingOrgId() {
  console.log('🔍 Showing login prompt for missing organization ID...');
  
  // Wait for DOM element with retries
  let patientList = document.getElementById('patient-list');
  let retries = 0;
  while (!patientList && retries < 10) {
    console.log(`⏳ Waiting for patient-list element... (attempt ${retries + 1})`);
    await new Promise(resolve => setTimeout(resolve, 200));
    patientList = document.getElementById('patient-list');
    retries++;
  }
  
  if (patientList) {
    console.log('✅ Found patient-list element, displaying login message...');
    // Set a flag to prevent other code from overwriting this message
    window._showingLoginPrompt = true;
    patientList.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
          <p style="font-size: 16px; margin-bottom: 10px;">⚠️ Unable to load patients</p>
          <p style="font-size: 14px; margin-bottom: 20px;">Your session may have expired. Please log in again to view your patients.</p>
          <a href="/login" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Go to Login</a>
        </td>
      </tr>
    `;
    return true;
  } else {
    console.error('❌ Could not find patient-list element after multiple retries');
    console.error('❌ Available elements:', Array.from(document.querySelectorAll('tbody, #patient-list')).map(el => el.id || el.tagName));
    return false;
  }
}

function getPatientDisplayName(patient) {
  if (!patient) return "Unknown Patient";
  const rawFirst = patient.firstName || patient.first_name || "";
  const rawLast = patient.lastName || patient.last_name || "";
  const combined = [rawFirst, rawLast].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  if (patient.fullName) return String(patient.fullName).trim();
  if (patient.name) return String(patient.name).trim();
  return "Unknown Patient";
}

function getPatientSortName(patient) {
  return getPatientDisplayName(patient).toLowerCase();
}

// Display patients function
async function displayPatients(patients, page) {
  // console.log('📋 Displaying patients:', patients.length, 'on page:', page);
  
  // Mobile compatibility check
  if (!patients || !Array.isArray(patients)) {
    console.error('❌ Invalid patients data:', patients);
    return;
  }
  
  // Store patients globally
  allPatients = patients;
  
  // Initialize currentSort if not defined
  if (typeof currentSort === 'undefined') {
    currentSort = { field: 'name', dir: 1 };
  }
  
  // Sort patients
  patients.sort((a, b) => {
    let valA, valB;
    if (currentSort.field === 'name') {
      valA = getPatientSortName(a);
      valB = getPatientSortName(b);
    } else if (currentSort.field === 'dob') {
      valA = new Date(a.dob);
      valB = new Date(b.dob);
    }
    return (valA > valB ? 1 : -1) * currentSort.dir;
  });

  const DISPLAY_PAGE_SIZE = 10;
  const start = (page - 1) * DISPLAY_PAGE_SIZE;
  const end = start + DISPLAY_PAGE_SIZE;
  const paginatedPatients = patients.slice(start, end);

  const tbody = document.getElementById("patient-list");
  if (tbody) {  // Only if on patients.html
    // Don't overwrite login prompt if it's being shown
    if (window._showingLoginPrompt) {
      console.log('⚠️ Skipping displayPatients - login prompt is being shown');
      return;
    }
    tbody.innerHTML = "";  // Clear old rows
    if (paginatedPatients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No patients found. Add a new patient to get started.</td></tr>';
    } else {
      // CRITICAL FIX: Resolve all patient display IDs before rendering buttons
      // This ensures buttons always have valid MEC0006 format IDs, never UUIDs
      const resolvedPatients = await Promise.all(
        paginatedPatients.map(async (patient) => {
          let displayId = getPatientIdentifier(patient);
          
          // If display ID is null or patient.id is a UUID, query Supabase to get the display ID
          const isUuid = patient.id && patient.id.includes('-') && patient.id.length === 36;
          const hasSupabaseUuid = patient._supabaseUuid && patient._supabaseUuid.includes('-') && patient._supabaseUuid.length === 36;
          
          if ((!displayId || isUuid || hasSupabaseUuid) && window.supabaseClient) {
            try {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const orgId = user.organizationId || user.organization_id;
              
              if (orgId) {
                let found = false;
                const uuidToQuery = patient._supabaseUuid || (isUuid ? patient.id : null);
                
                // Strategy 1: Query by UUID (either patient.id or _supabaseUuid) to get full patient record
                if (uuidToQuery) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id, id')
                    .eq('id', uuidToQuery)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data) {
                    // If patient_id exists in Supabase, use it
                    if (data.patient_id && !isUuidLike(data.patient_id)) {
                      displayId = data.patient_id;
                      patient.patient_id = data.patient_id;
                      found = true;
                    }
                    // If patient exists but patient_id is null, we'll generate a fallback below
                  }
                }
                
                // Strategy 2: If Strategy 1 found patient but no patient_id, try querying by patient_id field
                if (!found && patient.patient_id && !isUuidLike(patient.patient_id)) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id')
                    .eq('patient_id', patient.patient_id)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data && data.patient_id && !isUuidLike(data.patient_id)) {
                    displayId = data.patient_id;
                    found = true;
                  }
                }
                
                // Strategy 3: If still not found, try querying by name + DOB (last resort)
                if (!found && patient.firstName && patient.lastName && patient.dob) {
                  const { data, error } = await window.supabaseClient
                    .from('patients')
                    .select('patient_id')
                    .eq('first_name', patient.firstName)
                    .eq('last_name', patient.lastName)
                    .eq('date_of_birth', patient.dob)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!error && data && data.patient_id && !isUuidLike(data.patient_id)) {
                    displayId = data.patient_id;
                    patient.patient_id = data.patient_id;
                    found = true;
                  }
                }
              }
            } catch (error) {
              console.warn('⚠️ Could not resolve patient ID from Supabase:', error);
            }
          }
          
          // CRITICAL: Never use UUID as display ID - always generate a temporary one if needed
          if (!displayId || isUuidLike(displayId) || displayId.length >= 36) {
            // Generate temporary ID from UUID if needed
            const uuid = patient._supabaseUuid || patient.id;
            if (uuid && uuid.includes('-')) {
              const user = JSON.parse(localStorage.getItem("user") || "{}");
              const orgId = user.organizationId || user.organization_id;
              let orgPrefix = 'MEC';
              
              if (orgId && window.supabaseClient) {
                try {
                  const { data: org } = await window.supabaseClient
                    .from('organizations')
                    .select('name')
                    .eq('id', orgId)
                    .single();
                  if (org?.name) {
                    orgPrefix = org.name.substring(0, 3).toUpperCase();
                  }
                } catch (error) {
                  // Use default MEC prefix
                }
              }
              
              const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
              displayId = `${orgPrefix}${uuidDigits}`;
              console.warn('⚠️ Using temporary patient_id:', displayId, '- Run SQL script for proper sequential ID');
            } else {
              displayId = 'TEMP0001'; // Last resort
            }
          }
          return { patient, displayId };
        })
      );
      
      // Filter out null entries (patients without valid display IDs)
      const validResolvedPatients = resolvedPatients.filter(p => p !== null);
      
      validResolvedPatients.forEach(({ patient, displayId }) => {
        const displayName = getPatientDisplayName(patient);
        const row = document.createElement("tr");  // Create new table row
        // Row created for patient (name removed for privacy)
        // CRITICAL: Use displayId (MEC0006 format) for all URLs, never UUID
        row.innerHTML = `
          <td>${displayName}</td>
          <td>${patient.dob}</td>  <!-- Display DOB instead of age -->
          <td>${patient.gender}</td>
          <td>
            <button class="action-btn" onclick="window.location.href='/patient-details?id=${displayId}'">View</button>
            <button class="action-btn" onclick="window.location.href='/edit-patient?id=${displayId}'">Edit</button>
            <button class="action-btn" onclick="deletePatient('${displayId}')">Delete</button>
            <button class="action-btn" onclick="window.location.href='/patient-encounters?patientId=${displayId}'">Add New Encounter</button>
            <button class="action-btn" onclick="window.location.href='/add-appointment?patientId=${displayId}'">Add Appointment</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
  }
  
  // Update pagination controls
  updatePagination(patients.length, page);
}

// Display patients from universal data loader
async function displayPatientsFromUniversalLoader(patients, page) {
  // console.log('📋 Displaying patients from universal data loader:', patients.length);
  
  // Store patients globally
  allPatients = patients;
  
  // Display the patients using existing logic
  await displayPatients(patients, page);
}
// Mobile-compatible initialization
async function initializePatientsPage() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }
  
  // Wait for all scripts to load (mobile compatibility)
  let retryCount = 0;
  const maxRetries = 20;
  
  while (retryCount < maxRetries && (
    typeof window.supabaseClient === 'undefined' || 
    typeof window.loadPatientsWithSupabasePriority === 'undefined' ||
    typeof displayPatients === 'undefined'
  )) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retryCount++;
  }
  
  // Universal data sync: Process sync queue if no patients found (same behavior on all devices)
  if (typeof window.processSyncQueue === 'function') {
    try {
      await window.processSyncQueue();
    } catch (error) {
      console.error('❌ Sync queue processing failed:', error);
    }
  }
  
  // Load patients first
  await loadPatients();
  
  // Then sync any localStorage patients to Supabase
  setTimeout(async () => {
    await syncAllPatientsToSupabase();
  }, 2000);
}

// Initialize patients page only on patient listing pages
  // PATIENTS.JS LOADED
window.addEventListener('load', function() {
  // Only initialize on pages that need patient listing functionality
  const currentPage = window.location.pathname.split('/').pop() || '';
  const isPatientPage = currentPage === 'patients.html' || 
                        currentPage === 'patient-encounters.html' ||
                        currentPage === '' || // index.html
                        currentPage === 'index.html' ||
                        document.getElementById('patient-list') ||  // Fixed: was 'patients-list'
                        document.getElementById('patients-list') ||  // Keep for backwards compatibility
                        document.getElementById('patient-encounters-list');
  
  if (isPatientPage) {
    initializePatientsPage();
  }
  // DO NOT sync on other pages - sync should only happen on patients.html page
  // Sync on add-patient/edit-patient pages would cause errors with incomplete data
});

// Migration function moved to main.js for global availability

// Navigation functions
window.backToPatients = function() {
  window.location.href = 'patients.html';
};

window.backToDashboard = function() {
  window.location.href = 'dashboard.html';
};

// Note: loadPatientDetails function is already defined above (around line 4228)
// This function loads and displays patient data on patient-details.html
// Do not override it - it's the correct implementation
// Do not override it - it's the correct implementation