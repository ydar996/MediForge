// ============================================
// PATIENT ID NORMALIZATION SYSTEM
// ============================================
/** True if s is a display / org patient_id (not a Supabase UUID). Hyphenated ids (e.g. MFA-MC9810) are valid. */
function isDisplayPatientIdString(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (t === 'Unknown ID') return false;
  if (typeof window.isUuidLike === 'function') return !window.isUuidLike(t);
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}
// Purpose: Centralized system to ensure ALL patient IDs are normalized to legacy format (MECXXXX)
//          UUIDs are ONLY used internally for database operations
//          Legacy IDs are ALWAYS used for: URLs, displays, reports, user-facing operations
// ============================================

/**
 * Normalizes a patient identifier to legacy ID format (MECXXXX)
 * This is the SINGLE SOURCE OF TRUTH for patient ID normalization
 * 
 * @param {string|object} identifier - Can be:
 *   - UUID string (e.g., "88aaa7f4-e119-4985-96ca-cbdb9922bd5d")
 *   - Legacy ID string (e.g., "MEC0017")
 *   - Patient object with id, patient_id, or _supabaseUuid fields
 * @returns {Promise<string|null>} Legacy ID (MECXXXX format) or null if not found
 */
window.normalizePatientId = async function(identifier) {
  if (!identifier) return null;
  
  // If it's already a legacy ID (MECXXXX format), return it
  if (typeof identifier === 'string') {
    // Check if it's already a display patient id (MEC0017, MFA-SC0001, MFA-MC0001, etc.)
    if (isDisplayPatientIdString(identifier)) {
      return identifier.trim();
    }
    
    // If it's a UUID, we need to resolve it
    if (isUuidLike(identifier)) {
      // It's a UUID - resolve to legacy ID
      if (typeof window.resolvePatientByIdentifier === 'function') {
        try {
          const patient = await window.resolvePatientByIdentifier(identifier);
          if (patient) {
            return window.getPatientIdentifier(patient);
          }
        } catch (error) {
          console.error('❌ normalizePatientId: Error resolving UUID:', error);
        }
      }
      return null; // Could not resolve UUID
    }
    
    // If it's not a UUID and not a legacy ID, return as-is (might be a custom ID)
    return identifier;
  }
  
  // If it's a patient object, extract the legacy ID
  if (typeof identifier === 'object' && identifier !== null) {
    return window.getPatientIdentifier(identifier);
  }
  
  return null;
};

/**
 * Synchronous version that works with patient objects only
 * Use this when you already have the patient object
 * NEVER returns UUID - always returns legacy ID or generates temporary one
 * 
 * @param {object} patient - Patient object
 * @returns {string} Legacy ID (MECXXXX format) - never null, never UUID
 */
window.getLegacyPatientId = function(patient) {
  if (!patient) return 'TEMP0001';
  
  const legacyId = window.getPatientIdentifier(patient);
  if (legacyId && isDisplayPatientIdString(legacyId) && legacyId.length < 36) {
    return legacyId;
  }
  
  // Generate temporary ID from UUID if available
  const uuid = patient._supabaseUuid || patient.id;
  if (uuid && uuid.includes('-') && uuid.length === 36) {
    const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const orgId = user.organizationId || user.organization_id;
    let orgPrefix = 'MEC';
    
    // Try to get org prefix synchronously from localStorage
    if (orgId) {
      try {
        const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = Object.values(orgs).find(org => org && org.id === orgId) ||
          (user.org ? orgs[user.org] : null);
        if (typeof window.mfResolveDefaultPatientIdPrefix === 'function') {
          orgPrefix = window.mfResolveDefaultPatientIdPrefix(
            orgId,
            orgData ? { name: orgData.name, settings: orgData.settings } : null,
            {}
          );
        } else if (orgData?.name) {
          orgPrefix = orgData.name.substring(0, 3).toUpperCase();
        }
      } catch (e) {
        // Use default MEC prefix
      }
    }
    
    return `${orgPrefix}${uuidDigits}`;
  }
  
  return 'TEMP0001'; // Last resort
};

/**
 * Ensures a patient object has a valid legacy ID
 * If patient_id is missing, generates one and updates Supabase
 * 
 * @param {object} patient - Patient object
 * @returns {Promise<object>} Patient object with guaranteed legacy ID
 */
window.ensureLegacyPatientId = async function(patient) {
  if (!patient) return null;
  
  // Check if patient already has a valid legacy ID
  const legacyId = window.getPatientIdentifier(patient);
  if (legacyId && isDisplayPatientIdString(legacyId)) {
    return patient; // Already has valid legacy ID
  }
  
  // Patient doesn't have a valid legacy ID - need to generate one
  console.warn('⚠️ ensureLegacyPatientId: Patient missing legacy ID, generating...', {
    id: patient.id,
    patient_id: patient.patient_id,
    _supabaseUuid: patient._supabaseUuid
  });
  
  // Use resolvePatientByIdentifier which will generate patient_id if missing
  const uuid = patient._supabaseUuid || patient.id;
  if (uuid && uuid.includes('-') && uuid.length === 36) {
    const resolvedPatient = await window.resolvePatientByIdentifier(uuid);
    if (resolvedPatient) {
      return resolvedPatient; // This will have patient_id generated
    }
  }
  
  return patient; // Return original if we can't resolve
};

/**
 * Normalizes patient ID for URL usage
 * ALWAYS returns legacy ID format for URLs
 * 
 * @param {string|object} identifier - Patient identifier or patient object
 * @returns {Promise<string>} Legacy ID for use in URLs
 */
window.normalizePatientIdForUrl = async function(identifier) {
  const legacyId = await window.normalizePatientId(identifier);
  return legacyId || 'Unknown ID';
};

/**
 * Normalizes patient ID for display
 * ALWAYS returns legacy ID format for display
 * NEVER returns UUID - generates temporary ID if needed
 * 
 * @param {string|object} identifier - Patient identifier or patient object
 * @returns {Promise<string>} Legacy ID for display (MECXXXX format)
 */
window.normalizePatientIdForDisplay = async function(identifier) {
  if (!identifier) return 'TEMP0001';
  
  // If it's a patient object, try getPatientIdentifier first
  if (typeof identifier === 'object' && identifier !== null) {
    const legacyId = window.getPatientIdentifier(identifier);
    if (legacyId && isDisplayPatientIdString(legacyId) && legacyId.length < 36) {
      return legacyId;
    }
    
    // If no legacy ID, try to generate one
    if (identifier._supabaseUuid || (identifier.id && identifier.id.includes('-'))) {
      const uuid = identifier._supabaseUuid || identifier.id;
      // Generate temporary ID from UUID
      const uuidDigits = uuid.replace(/-/g, '').substring(28, 32).toUpperCase();
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const orgId = user.organizationId || user.organization_id;
      let orgPrefix = 'MEC';
      
      if (orgId && window.supabaseClient) {
        try {
          const { data: org } = await window.supabaseClient
            .from('organizations')
            .select('name, settings')
            .eq('id', orgId)
            .single();
          if (typeof window.mfResolveDefaultPatientIdPrefix === 'function') {
            orgPrefix = window.mfResolveDefaultPatientIdPrefix(orgId, org, { orgFetchFailed: !org });
          } else if (org?.name) {
            orgPrefix = org.name.substring(0, 3).toUpperCase();
          }
        } catch (error) {
          // Use default MEC prefix
        }
      }
      
      return `${orgPrefix}${uuidDigits}`;
    }
  }
  
  // If it's a string, normalize it
  const legacyId = await window.normalizePatientId(identifier);
  if (legacyId && isDisplayPatientIdString(legacyId) && legacyId.length < 36) {
    return legacyId;
  }
  
  // Last resort: generate temporary ID
  if (typeof identifier === 'string' && identifier.includes('-') && identifier.length === 36) {
    const uuidDigits = identifier.replace(/-/g, '').substring(28, 32).toUpperCase();
    return `MEC${uuidDigits}`;
  }
  
  return 'TEMP0001'; // Should never happen
};

/**
 * Normalizes patient ID for database queries
 * Returns UUID if identifier is a legacy ID, otherwise returns as-is
 * Use this when you need to query Supabase by UUID
 * 
 * @param {string|object} identifier - Patient identifier or patient object
 * @returns {Promise<string>} UUID for database queries
 */
window.normalizePatientIdForQuery = async function(identifier) {
  if (!identifier) return null;
  
  // If it's already a UUID, return it
  if (typeof identifier === 'string' && identifier.includes('-') && identifier.length === 36) {
    return identifier;
  }
  
  // If it's a legacy ID or patient object, resolve to get UUID
  const patient = typeof identifier === 'object' 
    ? identifier 
    : await window.resolvePatientByIdentifier(identifier);
  
  if (patient) {
    return patient._supabaseUuid || patient.id;
  }
  
  return identifier; // Fallback to original
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizePatientId: window.normalizePatientId,
    getLegacyPatientId: window.getLegacyPatientId,
    ensureLegacyPatientId: window.ensureLegacyPatientId,
    normalizePatientIdForUrl: window.normalizePatientIdForUrl,
    normalizePatientIdForDisplay: window.normalizePatientIdForDisplay,
    normalizePatientIdForQuery: window.normalizePatientIdForQuery
  };
}

