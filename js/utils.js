/**
 * MediForge Utility Functions
 * Centralized utilities for consistent behavior across the application
 */

// Mute known non-app console noise (browser extensions / injected scripts)
(() => {
  if (window.__ehrConsoleFilterApplied) return;
  window.__ehrConsoleFilterApplied = true;

  const verboseEnabled = localStorage.getItem('enableVerboseLogs') === 'true';
  window.__DEBUG_LOGS = verboseEnabled;

  const blockedPatterns = [
    /Blue\\s*Prism/i,
    /bluePrismPlugin/i,
    /ContentMain/i,
    /ContentService/i
  ];

  const noisyMarkers = [
    'TRACE',
    '🔍',
    '✅',
    '⚠️',
    '[PERSISTENCE]'
  ];

  const sensitiveKeys = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'apikey',
    'api_key',
    'service_role_key',
    'supabase_service_role_key',
    'supabase_key'
  ];

  const REDACTED = '[REDACTED]';
  const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const BEARER_REGEX = /\b(bearer\s+)[^\s]+/gi;

  const shouldBlock = (args) => {
    try {
      const text = args
        .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
        .join(' ');
      if (!verboseEnabled && noisyMarkers.some(marker => text.includes(marker))) {
        return true;
      }
      return blockedPatterns.some(pattern => pattern.test(text));
    } catch (error) {
      return false;
    }
  };

  const sanitizeString = (value) => {
    if (!value) return value;
    let sanitized = value.replace(EMAIL_REGEX, REDACTED);
    sanitized = sanitized.replace(BEARER_REGEX, `$1${REDACTED}`);
    return sanitized;
  };

  const sanitizeObject = (value) => {
    if (!value || typeof value !== 'object') return value;
    const copy = Array.isArray(value) ? [...value] : { ...value };
    Object.keys(copy).forEach((key) => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        copy[key] = REDACTED;
        return;
      }
      if (typeof copy[key] === 'string') {
        copy[key] = sanitizeString(copy[key]);
      }
    });
    return copy;
  };

  const sanitizeArgs = (args) => args.map((arg) => {
    if (typeof arg === 'string') return sanitizeString(arg);
    if (arg && typeof arg === 'object') return sanitizeObject(arg);
    return arg;
  });

  ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
    const original = console[method];
    if (typeof original !== 'function') return;
    console[method] = (...args) => {
      const sanitizedArgs = sanitizeArgs(args);
      if (shouldBlock(sanitizedArgs)) return;
      original.apply(console, sanitizedArgs);
    };
  });
})();

/**
 * Standardized Organization ID Resolution
 * Handles all organization ID resolution patterns consistently
 * @returns {Promise<string|null>} Organization ID (UUID) or null if not found
 */
window.resolveOrganizationId = async function() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isOrgUuid =
    typeof window.isOrganizationUuid === 'function'
      ? window.isOrganizationUuid
      : function (s) {
          return (
            s &&
            typeof s === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())
          );
        };
  
  // Method 1: Check if user.org is already a UUID
  if (isOrgUuid(user.org)) {
    return user.org;
  }
  
  // Method 2: Check organizationId or organization_id (must be UUID, not org name)
  if (isOrgUuid(user.organizationId)) {
    return user.organizationId;
  }
  if (isOrgUuid(user.organization_id)) {
    return user.organization_id;
  }
  
  // Method 3: Resolve from organizations localStorage object
  if (user.org) {
    const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
    const orgData = organizations[user.org];
    if (orgData && orgData.id && isOrgUuid(orgData.id)) {
      // Update user object for future use
      user.organizationId = orgData.id;
      user.organization_id = orgData.id;
      localStorage.setItem("user", JSON.stringify(user));
      return orgData.id;
    }
  }
  
  // Method 4: Query Supabase by organization name
  if (user.org && window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('organizations')
        .select('id')
        .ilike('name', user.org)
        .limit(1)
        .maybeSingle();
      
      if (!error && data && data.id) {
        // Update user object and organizations cache (merge: preserve settings)
        user.organizationId = data.id;
        user.organization_id = data.id;
        localStorage.setItem("user", JSON.stringify(user));
        
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        organizations[user.org] = {
          ...(organizations[user.org] || {}),
          id: data.id,
          name: user.org
        };
        localStorage.setItem("organizations", JSON.stringify(organizations));
        
        return data.id;
      }
    } catch (error) {
      console.warn('⚠️ Failed to resolve organization ID from Supabase:', error);
    }
  }
  
  return null;
};

/**
 * Restore Supabase auth from localStorage and refresh the staff user profile (org ID, etc.).
 * Call on page load before cloud saves. Does not redirect unless redirectOnFailure is true.
 * @returns {Promise<{ok: boolean, orgId?: string|null, reason?: string, user?: object}>}
 */
window.ensureStaffSession = async function ensureStaffSession(options = {}) {
  const { redirectOnFailure = false } = options;
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  if (!storedUser.username && !storedUser.email) {
    if (redirectOnFailure) {
      window.location.href = '/login';
    }
    return { ok: false, reason: 'no_user' };
  }

  if (typeof window.waitForSupabaseClient === 'function') {
    try {
      await window.waitForSupabaseClient();
    } catch (e) {
      /* client may still initialize */
    }
  }

  const sb = window.supabaseClient;
  if (sb?.auth) {
    let session = null;
    try {
      const { data: sessionData } = await sb.auth.getSession();
      session = sessionData?.session || null;
    } catch (e) {
      /* continue to restore attempt */
    }

    if (!session) {
      const raw = localStorage.getItem('supabase_session');
      if (raw) {
        try {
          const stored = JSON.parse(raw);
          if (stored.refresh_token) {
            const { data, error } = await sb.auth.refreshSession({ refresh_token: stored.refresh_token });
            if (!error && data?.session) {
              session = data.session;
            }
          }
          if (!session && stored.access_token && stored.refresh_token) {
            const { data, error } = await sb.auth.setSession({
              access_token: stored.access_token,
              refresh_token: stored.refresh_token
            });
            if (!error && data?.session) {
              session = data.session;
            }
          }
        } catch (e) {
          console.warn('Could not restore Supabase session:', e);
        }
      }
    }

    if (session) {
      localStorage.setItem('supabase_session', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at
      }));
    } else if (redirectOnFailure) {
      localStorage.removeItem('user');
      localStorage.removeItem('supabase_session');
      window.location.href = '/login?reason=session_expired';
      return { ok: false, reason: 'no_supabase_session' };
    }
  }

  let orgId = typeof window.resolveOrganizationId === 'function'
    ? await window.resolveOrganizationId()
    : null;

  if (!orgId && typeof window.restoreUserContextFromSupabase === 'function') {
    await window.restoreUserContextFromSupabase();
    orgId = typeof window.resolveOrganizationId === 'function'
      ? await window.resolveOrganizationId()
      : null;
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  localStorage.setItem('lastActivity', Date.now().toString());

  const ok = !!(user.username || user.email);
  return { ok, orgId, user, reason: ok ? undefined : 'no_user' };
};

/**
 * Re-validate session on every full page navigation (including browser back).
 */
(function staffSessionNavigationGuard() {
  function isPublicAuthPage() {
    const path = (window.location.pathname || '').toLowerCase();
    return path.includes('/login') ||
      path.includes('/register') ||
      path.includes('/platform-login') ||
      path === '/' ||
      path.endsWith('/index.html');
  }

  async function restoreOnNavigation() {
    if (isPublicAuthPage()) return;
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!storedUser.username && !storedUser.email) return;
    if (typeof window.ensureStaffSession !== 'function') return;
    try {
      await window.ensureStaffSession({ redirectOnFailure: false });
    } catch (err) {
      console.warn('Session restore on navigation failed:', err);
    }
  }

  window.addEventListener('pageshow', function() {
    void restoreOnNavigation();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      void restoreOnNavigation();
    });
  } else {
    void restoreOnNavigation();
  }
})();

/** True when s is a Supabase organization row UUID (not a human-readable org name). */
window.isOrganizationUuid = function (s) {
  return (
    s &&
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())
  );
};

/**
 * Human-readable organization name for display (admission form, headers, etc.)
 */
window.resolveOrganizationDisplayName = async function (organizationId) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!organizationId) {
    return user.org && !window.isOrganizationUuid(user.org) ? user.org : 'Unknown Organization';
  }
  if (!window.isOrganizationUuid(organizationId)) {
    return String(organizationId);
  }
  if (typeof window.getOrganizationName === 'function') {
    try {
      const name = await window.getOrganizationName(organizationId);
      if (name && name !== 'Unknown Organization' && !String(name).startsWith('Organization ID:')) {
        return name;
      }
    } catch (e) {
      /* fall through */
    }
  }
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle();
      if (!error && data && data.name) return data.name;
    } catch (e) {
      /* fall through */
    }
  }
  if (user.org && !window.isOrganizationUuid(user.org)) return user.org;
  const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
  for (const key of Object.keys(organizations)) {
    const o = organizations[key];
    if (o && o.id === organizationId && (o.name || key)) return o.name || key;
  }
  return user.org && !window.isOrganizationUuid(user.org) ? user.org : 'Unknown Organization';
};

/** Merge org settings into localStorage (and user.settings) without wiping other keys. */
window.cacheOrganizationSettingsLocal = function (organizationId, settingsPatch) {
  if (!settingsPatch || typeof settingsPatch !== 'object') return;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
  const cacheKeys = [...new Set([user.org, organizationId, user.organizationId, user.organization_id].filter(Boolean))];
  let orgData = null;
  for (let i = 0; i < cacheKeys.length; i++) {
    if (organizations[cacheKeys[i]]) {
      orgData = { ...organizations[cacheKeys[i]] };
      break;
    }
  }
  if (!orgData) {
    orgData = { id: organizationId, name: user.org || organizationId };
  }
  orgData.settings = { ...(orgData.settings || {}), ...settingsPatch };
  cacheKeys.forEach(function (key) {
    organizations[key] = {
      ...(organizations[key] || {}),
      ...orgData,
      settings: orgData.settings
    };
  });
  localStorage.setItem('organizations', JSON.stringify(organizations));
  user.settings = { ...(user.settings || {}), ...settingsPatch };
  localStorage.setItem('user', JSON.stringify(user));
};

/**
 * Persist one organizations.settings key locally first, then Supabase.
 * @returns {{ local: boolean, remote: boolean, error?: Error }}
 */
window.saveOrganizationSetting = async function (organizationId, settingKey, value) {
  const patch = { [settingKey]: value };
  window.cacheOrganizationSettingsLocal(organizationId, patch);
  if (!window.supabaseClient || !organizationId || !window.isOrganizationUuid(organizationId)) {
    return { local: true, remote: false };
  }
  try {
    const { data: orgData, error: fetchError } = await window.supabaseClient
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .maybeSingle();
    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
    const updatedSettings = { ...(orgData?.settings || {}), ...patch };
    const { error: updateError } = await window.supabaseClient
      .from('organizations')
      .update({ settings: updatedSettings })
      .eq('id', organizationId);
    if (updateError) throw updateError;
    return { local: true, remote: true };
  } catch (err) {
    console.warn('saveOrganizationSetting: Supabase update failed', err);
    return { local: true, remote: false, error: err };
  }
};

/**
 * Parse organizations.settings.in_patient_services (boolean, "true", 1, etc.)
 */
window.parseInPatientServicesFlag = function(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
};

/**
 * True when in-patient services are enabled for an org.
 * Matches dashboard: Supabase first, then localStorage (organizations cache keyed by org name or UUID).
 */
window.isInPatientServicesEnabled = async function(organizationId) {
  if (!organizationId) return false;

  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('organizations')
        .select('settings')
        .eq('id', organizationId)
        .maybeSingle();
      if (!error && data && data.settings && window.parseInPatientServicesFlag(data.settings.in_patient_services)) {
        return true;
      }
    } catch (err) {
      console.warn('isInPatientServicesEnabled: Supabase check failed', err);
    }
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.settings && window.parseInPatientServicesFlag(user.settings.in_patient_services)) {
    return true;
  }
  const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
  const keys = [user.org, organizationId, user.organizationId, user.organization_id].filter(Boolean);
  for (let i = 0; i < keys.length; i++) {
    const orgData = organizations[keys[i]];
    if (orgData && orgData.settings && window.parseInPatientServicesFlag(orgData.settings.in_patient_services)) {
      return true;
    }
  }
  const firstKey = Object.keys(organizations)[0];
  if (firstKey) {
    const orgData = organizations[firstKey];
    if (orgData && orgData.settings && window.parseInPatientServicesFlag(orgData.settings.in_patient_services)) {
      return true;
    }
  }
  return false;
};

/**
 * Standardized Role Checking Utility
 * @param {string|Array<string>} allowedRoles - Role(s) to check against
 * @param {object} user - User object (optional, will get from localStorage if not provided)
 * @returns {boolean} True if user has allowed role
 */
window.hasRole = function(allowedRoles, user = null) {
  if (!user) {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  }
  
  if (!user || !user.role) {
    return false;
  }
  
  const userRole = (user.role || '').toLowerCase().trim();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return roles.some(role => {
    const normalizedRole = role.toLowerCase().trim();
    return userRole === normalizedRole || userRole.includes(normalizedRole);
  });
};

/**
 * Check if user is a Doctor
 */
window.isDoctor = function(user = null) {
  return window.hasRole(['doctor', 'physician'], user);
};

/**
 * Check if user is a Medical Lab Scientist
 */
window.isLabScientist = function(user = null) {
  return window.hasRole(['medical lab scientist', 'lab scientist', 'laboratory scientist'], user);
};

/**
 * Check if user is a Nurse
 */
window.isNurse = function(user = null) {
  return window.hasRole(['nurse'], user);
};

/**
 * Check if user is a Pharmacist
 */
window.isPharmacist = function(user = null) {
  return window.hasRole(['pharmacist'], user);
};

/**
 * Admission ID compacting utilities
 * - Compact UUID admission IDs for display/URLs
 * - Expand compact IDs back to UUID for lookups
 */
(() => {
  const ADMISSION_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ADMISSION_ID_BASE = BigInt(ADMISSION_ID_ALPHABET.length);
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value.trim());
  const uuidToBigInt = (uuid) => {
    if (!isUuid(uuid)) return null;
    const hex = uuid.replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(hex)) return null;
    return BigInt(`0x${hex}`);
  };
  const bigIntToUuid = (value) => {
    if (value === null || value === undefined) return null;
    const hex = value.toString(16).padStart(32, '0');
    if (!/^[0-9a-f]{32}$/.test(hex)) return null;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const base62Encode = (value) => {
    if (value === null || value === undefined) return null;
    if (value === 0n) return '0';
    let num = value;
    let encoded = '';
    while (num > 0) {
      const remainder = num % ADMISSION_ID_BASE;
      encoded = ADMISSION_ID_ALPHABET[Number(remainder)] + encoded;
      num = num / ADMISSION_ID_BASE;
    }
    return encoded;
  };
  const base62Decode = (text) => {
    if (!text || typeof text !== 'string') return null;
    let num = 0n;
    for (const char of text.trim()) {
      const index = ADMISSION_ID_ALPHABET.indexOf(char);
      if (index === -1) return null;
      num = num * ADMISSION_ID_BASE + BigInt(index);
    }
    return num;
  };

  window.isUuid = window.isUuid || isUuid;

  window.compactAdmissionId = function(admissionId) {
    if (!admissionId || !isUuid(admissionId)) return admissionId;
    const numeric = uuidToBigInt(admissionId);
    if (numeric === null) return admissionId;
    return base62Encode(numeric);
  };

  window.expandAdmissionId = function(compactId) {
    if (!compactId || isUuid(compactId)) return compactId;
    const numeric = base62Decode(compactId);
    if (numeric === null) return compactId;
    const uuid = bigIntToUuid(numeric);
    return isUuid(uuid) ? uuid : compactId;
  };

  window.normalizeAdmissionId = function(admissionId) {
    if (!admissionId) return admissionId;
    const expanded = window.expandAdmissionId(admissionId);
    return isUuid(expanded) ? expanded : admissionId;
  };

  window.formatAdmissionIdForDisplay = function(admissionId) {
    if (!admissionId) return admissionId;
    const normalized = window.normalizeAdmissionId(admissionId);
    return window.compactAdmissionId(normalized);
  };
})();

/**
 * Admission code helpers (e.g., MEC-ADM-0001)
 */
(() => {
  const ADMISSION_CODE_REGEX = /^[A-Z0-9]{2,8}-ADM-\d{3,6}$/;
  const ADMISSION_CODE_SUFFIX_REGEX = /ADM-(\d{3,6})$/;

  window.getOrganizationPrefix = function(orgNameOverride = '') {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const directPrefix = user.organization_prefix || user.orgPrefix || user.org_prefix || '';
    if (directPrefix && typeof directPrefix === 'string') {
      return directPrefix.trim().toUpperCase();
    }

    const orgName = (orgNameOverride || user.org || user.organization || user.organizationName || '').toString();
    const clean = orgName.replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length >= 3) return clean.slice(0, 3).toUpperCase();
    if (clean.length > 0) return clean.toUpperCase().padEnd(3, 'X');
    return 'ORG';
  };

  window.computeAdmissionCodeFromId = function(admissionId, orgPrefixOverride = '') {
    if (!admissionId) return null;
    const prefix = window.getOrganizationPrefix(orgPrefixOverride);
    const idString = admissionId.toString();
    const hex = idString.replace(/-/g, '').toLowerCase();
    const tail = hex.slice(-6);
    let number = Number.parseInt(tail, 16);
    if (Number.isNaN(number)) {
      let hash = 0;
      for (let i = 0; i < idString.length; i += 1) {
        hash = (hash * 31 + idString.charCodeAt(i)) % 10000;
      }
      number = hash;
    }
    return `${prefix}-ADM-${String(number % 10000).padStart(4, '0')}`;
  };

  window.formatAdmissionCode = function(admission, orgPrefixOverride = '') {
    if (!admission) return null;
    const prefix = window.getOrganizationPrefix(orgPrefixOverride);
    const raw = admission.admission_id || admission.admissionId || '';
    if (raw && ADMISSION_CODE_REGEX.test(raw)) {
      return raw;
    }
    if (raw && /^ADM-\d{3,6}$/.test(raw)) {
      return `${prefix}-${raw}`;
    }
    if (raw) {
      return raw;
    }
    return window.computeAdmissionCodeFromId(admission.id || admission.admissionId || '', prefix);
  };

  window.resolveAdmissionIdParam = async function(admissionIdParam, organizationId) {
    if (!admissionIdParam) {
      return { admissionId: null, admissionCode: null };
    }

    if (window.isUuid && window.isUuid(admissionIdParam)) {
      return { admissionId: admissionIdParam, admissionCode: null };
    }

    if (typeof window.expandAdmissionId === 'function') {
      const expanded = window.expandAdmissionId(admissionIdParam);
      if (window.isUuid && window.isUuid(expanded)) {
        return { admissionId: expanded, admissionCode: admissionIdParam };
      }
    }

    const orgPrefix = window.getOrganizationPrefix();
    const localAdmissions = organizationId
      ? JSON.parse(localStorage.getItem(`admissions_${organizationId}`) || '[]')
      : [];
    const localMatch = localAdmissions.find(adm => {
      const formatted = window.formatAdmissionCode ? window.formatAdmissionCode(adm, orgPrefix) : adm.admission_id;
      return adm.admission_id === admissionIdParam || formatted === admissionIdParam;
    });

    if (localMatch) {
      return {
        admissionId: localMatch.id,
        admissionCode: window.formatAdmissionCode ? window.formatAdmissionCode(localMatch, orgPrefix) : localMatch.admission_id
      };
    }

    if (window.supabaseClient && organizationId) {
      try {
        const { data } = await window.supabaseClient
          .from('admissions')
          .select('id, admission_id')
          .eq('organization_id', organizationId)
          .eq('admission_id', admissionIdParam)
          .maybeSingle();
        if (data) {
          return {
            admissionId: data.id,
            admissionCode: window.formatAdmissionCode ? window.formatAdmissionCode(data, orgPrefix) : data.admission_id
          };
        }
      } catch (error) {
        console.warn('Unable to resolve admission by admission_id:', error);
      }

      try {
        const { data } = await window.supabaseClient
          .from('admissions')
          .select('id, admission_id')
          .eq('organization_id', organizationId)
          .limit(250);
        const match = (data || []).find(adm => {
          const formatted = window.formatAdmissionCode ? window.formatAdmissionCode(adm, orgPrefix) : adm.admission_id;
          return formatted === admissionIdParam;
        });
        if (match) {
          return {
            admissionId: match.id,
            admissionCode: window.formatAdmissionCode ? window.formatAdmissionCode(match, orgPrefix) : match.admission_id
          };
        }
      } catch (error) {
        console.warn('Unable to scan admissions for admission code:', error);
      }
    }

    return { admissionId: admissionIdParam, admissionCode: admissionIdParam };
  };
})();

/**
 * Standardized Error Notification System
 * Shows user-friendly error messages
 */
window.showErrorNotification = function(message, duration = 5000) {
  // Remove existing notifications
  const existing = document.querySelectorAll('.ehr-error-notification');
  existing.forEach(el => el.remove());
  
  const notification = document.createElement('div');
  notification.className = 'ehr-error-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #dc3545;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
    z-index: 10000;
    max-width: 400px;
    font-size: 14px;
    line-height: 1.5;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 10px;">
      <span style="font-size: 20px;">⚠️</span>
      <div style="flex: 1;">
        <strong>Error</strong><br>
        ${message}
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">×</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after duration
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
  
  // Add CSS animation if not already added
  if (!document.getElementById('ehr-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'ehr-notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
};

/**
 * Standardized Success Notification System
 */
window.showSuccessNotification = function(message, duration = 3000) {
  const existing = document.querySelectorAll('.ehr-success-notification');
  existing.forEach(el => el.remove());
  
  const notification = document.createElement('div');
  notification.className = 'ehr-success-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
    z-index: 10000;
    max-width: 400px;
    font-size: 14px;
    line-height: 1.5;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 10px;">
      <span style="font-size: 20px;">✅</span>
      <div style="flex: 1;">
        <strong>Success</strong><br>
        ${message}
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">×</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
};

/**
 * Standardized Warning Notification System
 */
window.showWarningNotification = function(message, duration = 4000) {
  const existing = document.querySelectorAll('.ehr-warning-notification');
  existing.forEach(el => el.remove());
  
  const notification = document.createElement('div');
  notification.className = 'ehr-warning-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ffc107;
    color: #212529;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
    z-index: 10000;
    max-width: 400px;
    font-size: 14px;
    line-height: 1.5;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 10px;">
      <span style="font-size: 20px;">⚠️</span>
      <div style="flex: 1;">
        <strong>Warning</strong><br>
        ${message}
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #212529; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">×</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
};

/**
 * Standardized Info Notification System
 */
window.showInfoNotification = function(message, duration = 4000) {
  const existing = document.querySelectorAll('.ehr-info-notification');
  existing.forEach(el => el.remove());
  
  const notification = document.createElement('div');
  notification.className = 'ehr-info-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #17a2b8;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);
    z-index: 10000;
    max-width: 400px;
    font-size: 14px;
    line-height: 1.5;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 10px;">
      <span style="font-size: 20px;">ℹ️</span>
      <div style="flex: 1;">
        <strong>Info</strong><br>
        ${message}
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">×</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
};

/**
 * Supabase-First Save Pattern
 * Saves to Supabase first, falls back to localStorage if Supabase fails
 * @param {string} table - Supabase table name
 * @param {object} data - Data to save
 * @param {string} localStorageKey - localStorage key for fallback
 * @param {function} transformFn - Optional function to transform data for localStorage
 * @returns {Promise<{success: boolean, synced: boolean, data?: any, error?: string}>}
 */
window.supabaseFirstSave = async function(table, data, localStorageKey, transformFn = null) {
  if (!window.supabaseClient) {
    console.warn('⚠️ Supabase client not available, saving to localStorage only');
    const transformedData = transformFn ? transformFn(data) : data;
    const existing = JSON.parse(localStorage.getItem(localStorageKey) || "[]");
    existing.push(transformedData);
    localStorage.setItem(localStorageKey, JSON.stringify(existing));
    window.showWarningNotification('Saved locally. Will sync when online.');
    return { success: true, synced: false, data: transformedData };
  }
  
  try {
    // Try Supabase first
    const { data: result, error } = await window.supabaseClient
      .from(table)
      .insert(data)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Success - cache to localStorage
    if (result) {
      const transformedData = transformFn ? transformFn(result) : result;
      const existing = JSON.parse(localStorage.getItem(localStorageKey) || "[]");
      existing.push(transformedData);
      localStorage.setItem(localStorageKey, JSON.stringify(existing));
    }
    
    window.showSuccessNotification('Saved successfully');
    return { success: true, synced: true, data: result };
    
  } catch (error) {
    console.error(`❌ Supabase save failed for ${table}:`, error);
    
    // Fallback to localStorage
    const transformedData = transformFn ? transformFn(data) : data;
    const existing = JSON.parse(localStorage.getItem(localStorageKey) || "[]");
    existing.push(transformedData);
    localStorage.setItem(localStorageKey, JSON.stringify(existing));
    
    // Queue for sync
    window.queueForSync(table, data);
    
    window.showWarningNotification('Saved locally. Will sync when online.');
    return { success: true, synced: false, data: transformedData, error: error.message };
  }
};

/**
 * Sync Queue System
 * Queues failed operations for retry when online
 */
window.syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]');

window.queueForSync = function(table, data, operation = 'insert') {
  window.syncQueue.push({
    table,
    data,
    operation,
    timestamp: new Date().toISOString(),
    retries: 0
  });
  localStorage.setItem('syncQueue', JSON.stringify(window.syncQueue));
};

window.processSyncQueue = async function() {
  if (!window.supabaseClient || window.syncQueue.length === 0) {
    return;
  }
  
  const processed = [];
  const failed = [];
  
  for (const item of window.syncQueue) {
    try {
      let result;
      if (item.operation === 'insert') {
        result = await window.supabaseClient.from(item.table).insert(item.data).select().single();
      } else if (item.operation === 'update') {
        result = await window.supabaseClient.from(item.table).update(item.data.updates).eq('id', item.data.id).select().single();
      } else if (item.operation === 'delete') {
        result = await window.supabaseClient.from(item.table).delete().eq('id', item.data.id);
      }
      
      if (result && !result.error) {
        processed.push(item);
      } else {
        item.retries++;
        if (item.retries < 3) {
          failed.push(item);
        }
      }
    } catch (error) {
      item.retries++;
      if (item.retries < 3) {
        failed.push(item);
      }
    }
  }
  
  window.syncQueue = failed;
  localStorage.setItem('syncQueue', JSON.stringify(window.syncQueue));
  
  if (processed.length > 0) {
    window.showSuccessNotification(`${processed.length} item(s) synced successfully`);
  }
};

// Process sync queue when online
window.addEventListener('online', () => {
  window.processSyncQueue();
});

// Process sync queue every 5 minutes
setInterval(() => {
  if (navigator.onLine) {
    window.processSyncQueue();
  }
}, 5 * 60 * 1000);

/**
 * Weight unit preference (kg or lbs). Default: kg.
 * Stored in localStorage: weightUnitPref = 'kg' | 'lbs'
 */
window.getWeightUnit = function() {
  const pref = (localStorage.getItem('weightUnitPref') || 'kg').toLowerCase();
  return pref === 'lbs' ? 'lbs' : 'kg';
};

window.setWeightUnit = function(unit) {
  const normalized = (unit || 'kg').toLowerCase();
  localStorage.setItem('weightUnitPref', normalized === 'lbs' ? 'lbs' : 'kg');
  window.dispatchEvent(new CustomEvent('weightUnitChanged', { detail: { unit: normalized === 'lbs' ? 'lbs' : 'kg' } }));
};

/**
 * Format weight (stored in kg) for display based on user preference.
 * @param {number|string} weightKg - Weight in kg
 * @returns {string} e.g. "70 kg" or "154.3 lbs"
 */
window.formatWeightForDisplay = function(weightKg) {
  if (weightKg == null || weightKg === '' || isNaN(parseFloat(weightKg))) return '-';
  const kg = parseFloat(weightKg);
  if (window.getWeightUnit() === 'lbs') {
    return (kg * 2.20462).toFixed(1) + ' lbs';
  }
  return kg.toFixed(1) + ' kg';
};

/**
 * Parse user input to kg for storage. Input is in user's preferred unit.
 * @param {string} value - User-entered value
 * @returns {number|null} Weight in kg for storage
 */
window.parseWeightInputToKg = function(value) {
  if (value == null || value === '') return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  if (window.getWeightUnit() === 'lbs') {
    return num / 2.20462;
  }
  return num;
};

/**
 * Get weight (stored in kg) as numeric value for input pre-fill in user's preferred unit.
 * @param {number|string} weightKg - Weight in kg
 * @returns {number|string} Value to show in input
 */
window.getWeightForInputDisplay = function(weightKg) {
  if (weightKg == null || weightKg === '' || isNaN(parseFloat(weightKg))) return '';
  const kg = parseFloat(weightKg);
  if (window.getWeightUnit() === 'lbs') return (kg * 2.20462).toFixed(1);
  return kg.toFixed(1);
};

/**
 * Get weight input label and min/max for current unit.
 * @returns {{ label: string, min: number, max: number, placeholder: string }}
 */
window.getWeightInputConfig = function() {
  if (window.getWeightUnit() === 'lbs') {
    return { label: 'Weight (lbs)', min: 2.2, max: 660, placeholder: 'e.g. 154' };
  }
  return { label: 'Weight (kg)', min: 1, max: 300, placeholder: 'e.g. 70' };
};

window.toggleWeightUnit = function() {
  const current = window.getWeightUnit();
  const next = current === 'kg' ? 'lbs' : 'kg';
  window.setWeightUnit(next);
  window.updateWeightUnitButton?.();
  alert('Weight unit set to ' + next.toUpperCase() + '.\nWeight will be displayed and entered in ' + (next === 'lbs' ? 'pounds' : 'kilograms') + ' app-wide.');
};

window.updateWeightUnitButton = function() {
  const btn = document.getElementById('weight-unit-btn');
  if (!btn) return;
  const unit = window.getWeightUnit();
  if (unit === 'lbs') {
    btn.textContent = '⚖️ Toggle Weight Measurement On: lbs (Off: Kg)';
  } else {
    btn.textContent = '⚖️ Toggle Weight Measurement On: Kg (Off: lbs)';
  }
  if (unit === 'lbs') {
    btn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
    btn.style.border = '2px solid #2e7d32';
  } else {
    btn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    btn.style.border = '2px solid #5a67d8';
  }
};

// Initialize weight unit button on pages that have it (e.g. dashboard)
if (typeof window !== 'undefined') {
  const initWeightUnitBtn = () => {
    if (document.getElementById('weight-unit-btn')) {
      window.updateWeightUnitButton?.();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeightUnitBtn);
  } else {
    initWeightUnitBtn();
  }
  window.addEventListener('load', () => setTimeout(initWeightUnitBtn, 500));
}

console.log('✅ Utility functions loaded');



