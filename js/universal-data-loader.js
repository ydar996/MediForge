// Universal Data Loader
// Purpose: Ensure all pages prioritize Supabase data over localStorage
// Version: v=1 - Universal data loading with Supabase priority

// Central validation module (app-wide) - load first if not present
(function ensureValidation() {
  if (typeof window.Validation !== 'undefined') return;
  var UUID_R = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var EMAIL_R = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  function sanitizeStr(v, max) {
    if (v == null) return v;
    if (typeof v !== 'string') return String(v);
    var s = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').trim();
    return (max && s.length > max) ? s.slice(0, max) : s;
  }
  function sanitizeVal(v, max) {
    if (Array.isArray(v)) return v.map(function(x) { return sanitizeVal(x, max); });
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      return Object.keys(v).reduce(function(a, k) { a[k] = sanitizeVal(v[k], max); return a; }, {});
    }
    return sanitizeStr(v, max);
  }
  window.Validation = {
    sanitizeString: sanitizeStr,
    sanitizeValue: sanitizeVal,
    validateUUID: function(v) { return typeof v === 'string' && UUID_R.test((v || '').trim()); },
    validateEmail: function(v) { return v && typeof v === 'string' && v.length <= 254 && EMAIL_R.test(v.trim()); },
    validateStringLength: function(v, min, max) {
      var s = v == null ? '' : String(v);
      if (min != null && s.length < min) return { valid: false, error: 'Must be at least ' + min + ' characters' };
      if (max != null && s.length > max) return { valid: false, error: 'Must be at most ' + max + ' characters' };
      return { valid: true };
    },
    validateRequired: function(v, name) {
      if (v == null || (typeof v === 'string' && !v.trim())) return { valid: false, error: (name || 'Field') + ' is required' };
      return { valid: true };
    },
    validateInteger: function(v, min, max) {
      var n = parseInt(v, 10);
      if (isNaN(n)) return { valid: false, error: 'Must be a valid number' };
      if (min != null && n < min) return { valid: false, error: 'Must be at least ' + min };
      if (max != null && n > max) return { valid: false, error: 'Must be at most ' + max };
      return { valid: true };
    },
    validateNumber: function(v, min, max) {
      var n = parseFloat(v);
      if (isNaN(n)) return { valid: false, error: 'Must be a valid number' };
      if (min != null && n < min) return { valid: false, error: 'Must be at least ' + min };
      if (max != null && n > max) return { valid: false, error: 'Must be at most ' + max };
      return { valid: true };
    }
  };
})();

(function() {
  'use strict';

  const UDL_VERBOSE = localStorage.getItem('enableVerboseLogs') === 'true';
  const udlLog = (...args) => { if (UDL_VERBOSE) console.log(...args); };

  // Get data key with organization prefix
  function getDataKey(key) {
    const user = JSON.parse(localStorage.getItem("user") || '{}');
    return user && user.org ? `${user.org}_${key}` : key;
  }

  // Cache for loaded data to avoid repeated API calls
  const dataCache = {
    patients: null,
    appointments: null,
    lastLoad: {
      patients: 0,
      appointments: 0
    }
  };

  // Cache duration (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

  // CRITICAL FIX: Function to clear patient cache (called after patient creation)
  window.clearPatientCache = function() {
    dataCache.patients = null;
    dataCache.lastLoad.patients = 0;
    console.log('🔄 [UDL] Patient cache cleared');
  };
  
  // CRITICAL FIX: Function to clear appointments cache (called after appointment update)
  window.clearAppointmentsCache = function() {
    dataCache.appointments = null;
    dataCache.lastLoad.appointments = 0;
    console.log('🔄 [UDL] Appointments cache cleared');
  };
  
  // CRITICAL FIX: Function to remove duplicate patients (keeps oldest, removes ones from last hour)
  window.removeDuplicatePatients = async function() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.org && !user.organizationId && !user.organization_id) {
        console.warn('⚠️ [UDL] Cannot remove duplicates - no organization info');
        return { removed: 0, errors: 0 };
      }
      
      // Get organization ID
      let orgId = user.organizationId || user.organization_id;
      if (!orgId && user.org) {
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = organizations[user.org];
        if (orgData && orgData.id) {
          orgId = orgData.id;
        }
      }
      
      if (!orgId) {
        console.warn('⚠️ [UDL] Cannot remove duplicates - organization ID not found');
        return { removed: 0, errors: 0 };
      }
      
      const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                             typeof getDataKey === 'function' ? getDataKey :
                             (key) => key;
      
      // Load existing patients
      const patientsRaw = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
      const patients = await decryptPatientsArray(patientsRaw);
      
      // Filter by organization
      const orgPatients = patients.filter(p => {
        if (p.organization_id === orgId || p.organizationId === orgId) return true;
        if (p.created_by === user.username) return true;
        return false;
      });
      
      // Group by name + DOB
      const patientGroups = new Map();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      orgPatients.forEach(patient => {
        const firstName = (patient.firstName || patient.first_name || '').toLowerCase().trim();
        const lastName = (patient.lastName || patient.last_name || '').toLowerCase().trim();
        const dob = patient.dob || patient.date_of_birth || '';
        const key = `${firstName}_${lastName}_${dob}`;
        
        if (!key || !dob) return; // Skip if no key or DOB
        
        if (!patientGroups.has(key)) {
          patientGroups.set(key, []);
        }
        patientGroups.get(key).push(patient);
      });
      
      // For each group, keep the oldest, remove duplicates from last hour
      let removedCount = 0;
      const keptPatients = [];
      const seenKeys = new Set();
      
      patientGroups.forEach((group, key) => {
        if (group.length <= 1) {
          // No duplicates, keep it
          group.forEach(p => {
            const displayId = p.patient_id || p.id;
            if (displayId && !seenKeys.has(displayId)) {
              keptPatients.push(p);
              seenKeys.add(displayId);
            }
          });
          return;
        }
        
        // Sort by created_at (oldest first)
        group.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });
        
        // Keep the oldest one
        const oldest = group[0];
        const oldestDisplayId = oldest.patient_id || oldest.id;
        if (oldestDisplayId && !seenKeys.has(oldestDisplayId)) {
          keptPatients.push(oldest);
          seenKeys.add(oldestDisplayId);
        }
        
        // Remove duplicates created in the last hour
        for (let i = 1; i < group.length; i++) {
          const duplicate = group[i];
          const duplicateDate = duplicate.created_at ? new Date(duplicate.created_at).getTime() : Date.now();
          
          if (duplicateDate > oneHourAgo) {
            // Created in last hour, remove it
            removedCount++;
            console.log(`🗑️ [UDL] Removing duplicate patient created in last hour: ${duplicate.patient_id || duplicate.id}`);
          } else {
            // Older than 1 hour, but still a duplicate - keep it but log
            const dupDisplayId = duplicate.patient_id || duplicate.id;
            if (dupDisplayId && !seenKeys.has(dupDisplayId)) {
              keptPatients.push(duplicate);
              seenKeys.add(dupDisplayId);
              console.log(`⚠️ [UDL] Keeping older duplicate (not from last hour): ${dupDisplayId}`);
            }
          }
        }
      });
      
      // Also add patients that don't have name+DOB duplicates
      orgPatients.forEach(patient => {
        const displayId = patient.patient_id || patient.id;
        if (displayId && !seenKeys.has(displayId)) {
          keptPatients.push(patient);
          seenKeys.add(displayId);
        }
      });
      
      // Save deduplicated patients back to localStorage
      if (removedCount > 0) {
        try {
          const encryptedKeptPatients = await encryptPatientsArray(keptPatients);
          localStorage.setItem(getDataKeyFunc("patients"), JSON.stringify(encryptedKeptPatients));
          console.log(`✅ [UDL] Removed ${removedCount} duplicate patients from last hour`);
          
          // Clear cache to force refresh
          window.clearPatientCache();
        } catch (saveError) {
          console.error('❌ [UDL] Error saving deduplicated patients:', saveError);
          return { removed: 0, errors: 1 };
        }
      }
      
      return { removed: removedCount, errors: 0 };
    } catch (error) {
      console.error('❌ [UDL] Error removing duplicate patients:', error);
      return { removed: 0, errors: 1 };
    }
  };
  
  // DEPRECATED: Old recovery function - replaced with removeDuplicatePatients
  window.recoverExistingPatients = async function() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.org && !user.organizationId && !user.organization_id) {
        console.warn('⚠️ [UDL] Cannot recover patients - no organization info');
        return { fixed: 0, errors: 0 };
      }
      
      // Get organization ID
      let orgId = user.organizationId || user.organization_id;
      if (!orgId && user.org) {
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = organizations[user.org];
        if (orgData && orgData.id) {
          orgId = orgData.id;
        }
      }
      
      if (!orgId) {
        console.warn('⚠️ [UDL] Cannot recover patients - organization ID not found');
        return { fixed: 0, errors: 0 };
      }
      
      const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                             typeof getDataKey === 'function' ? getDataKey :
                             (key) => key;
      
      // Load existing patients
      const patientsRaw = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
      const patients = await decryptPatientsArray(patientsRaw);
      
      let fixedCount = 0;
      let errorCount = 0;
      
      // Fix each patient that's missing organization_id or created_by
      const fixedPatients = patients.map(patient => {
        let needsFix = false;
        const fixedPatient = { ...patient };
        
        // Fix missing organization_id
        if (!fixedPatient.organization_id && !fixedPatient.organizationId) {
          fixedPatient.organization_id = orgId;
          fixedPatient.organizationId = orgId;
          needsFix = true;
        }
        
        // Fix missing created_by (for patients created by current user)
        if (!fixedPatient.created_by && user.username) {
          fixedPatient.created_by = user.username;
          needsFix = true;
        }
        
        // Ensure both id and patient_id are set for proper matching
        if (!fixedPatient.patient_id && fixedPatient.id && !fixedPatient.id.includes('-')) {
          fixedPatient.patient_id = fixedPatient.id;
          needsFix = true;
        }
        
        if (needsFix) {
          fixedCount++;
          console.log(`🔧 [UDL] Fixed patient: ${fixedPatient.patient_id || fixedPatient.id}`, {
            addedOrgId: !patient.organization_id,
            addedCreatedBy: !patient.created_by
          });
        }
        
        return fixedPatient;
      });
      
      // Save fixed patients back to localStorage
      if (fixedCount > 0) {
        try {
          const encryptedFixedPatients = await encryptPatientsArray(fixedPatients);
          localStorage.setItem(getDataKeyFunc("patients"), JSON.stringify(encryptedFixedPatients));
          console.log(`✅ [UDL] Recovered ${fixedCount} patients in localStorage`);
          
          // Clear cache to force refresh
          window.clearPatientCache();
        } catch (saveError) {
          console.error('❌ [UDL] Error saving recovered patients:', saveError);
          errorCount++;
        }
      }
      
      return { fixed: fixedCount, errors: errorCount };
    } catch (error) {
      console.error('❌ [UDL] Error recovering patients:', error);
      return { fixed: 0, errors: 1 };
    }
  };

  // ==================== ENCRYPTION HELPERS (Backward Compatible) ====================
  
  /**
   * Encrypt patient data before saving to localStorage
   * Backward compatible: Returns original data if encryption not initialized
   */
  async function encryptPatientData(patient) {
    // Check if encryption service is available and initialized
    if (typeof window.encryptionService === 'undefined' || !window.encryptionService.isInitialized) {
      return patient; // Return unencrypted (backward compatible)
    }

    try {
      // Define sensitive fields to encrypt
      const sensitiveFields = [
        'firstName', 'middleName', 'lastName', 'dob', 'phone', 'email',
        'address', 'addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode',
        'insurance', 'insuranceProvider', 'insurancePolicyNumber',
        'emergencyContact', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactAddress',
        'medicalHistory', 'allergies', 'conditions', 'diagnoses'
      ];

      // Encrypt sensitive fields
      const encryptedPatient = await window.encryptionService.encryptFields(patient, sensitiveFields);
      
      return encryptedPatient;
    } catch (error) {
      console.warn('⚠️ Encryption failed for patient data, storing unencrypted:', error);
      return patient; // Fallback: return unencrypted (backward compatible)
    }
  }

  /**
   * Decrypt patient data after loading from localStorage
   * Backward compatible: Returns original data if not encrypted or encryption not initialized
   */
  async function decryptPatientData(patient) {
    // Check if data is encrypted
    if (!patient._encrypted) {
      return patient; // Not encrypted, return as-is (backward compatible)
    }

    // Check if encryption service is available and initialized
    if (typeof window.encryptionService === 'undefined' || !window.encryptionService.isInitialized) {
      console.warn('⚠️ Encrypted patient data but encryption not initialized - returning as-is');
      return patient; // Return as-is (can't decrypt, but won't break)
    }

    try {
      // Define sensitive fields to decrypt
      const sensitiveFields = [
        'firstName', 'middleName', 'lastName', 'dob', 'phone', 'email',
        'address', 'addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode',
        'insurance', 'insuranceProvider', 'insurancePolicyNumber',
        'emergencyContact', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactAddress',
        'medicalHistory', 'allergies', 'conditions', 'diagnoses'
      ];

      // Decrypt sensitive fields
      const decryptedPatient = await window.encryptionService.decryptFields(patient, sensitiveFields);
      
      return decryptedPatient;
    } catch (error) {
      console.warn('⚠️ Decryption failed for patient data, returning as-is:', error);
      return patient; // Fallback: return as-is (backward compatible)
    }
  }

  /**
   * Encrypt array of patients before saving
   */
  async function encryptPatientsArray(patients) {
    if (!Array.isArray(patients)) {
      return patients;
    }

    // Check if encryption is initialized
    if (typeof window.encryptionService === 'undefined' || !window.encryptionService.isInitialized) {
      return patients; // Return unencrypted (backward compatible)
    }

    try {
      // Encrypt each patient
      const encryptedPatients = await Promise.all(
        patients.map(patient => encryptPatientData(patient))
      );
      return encryptedPatients;
    } catch (error) {
      console.warn('⚠️ Encryption failed for patients array, storing unencrypted:', error);
      return patients; // Fallback: return unencrypted
    }
  }

  /**
   * Decrypt array of patients after loading
   */
  async function decryptPatientsArray(patients) {
    if (!Array.isArray(patients)) {
      return patients;
    }

    // Check if any patients are encrypted
    const hasEncrypted = patients.some(p => p._encrypted);
    if (!hasEncrypted) {
      return patients; // Not encrypted, return as-is (backward compatible)
    }

    // Check if encryption is initialized
    if (typeof window.encryptionService === 'undefined' || !window.encryptionService.isInitialized) {
      console.warn('⚠️ Encrypted patients but encryption not initialized - returning as-is');
      return patients; // Return as-is (can't decrypt, but won't break)
    }

    try {
      // Decrypt each patient
      const decryptedPatients = await Promise.all(
        patients.map(patient => decryptPatientData(patient))
      );
      return decryptedPatients;
    } catch (error) {
      console.warn('⚠️ Decryption failed for patients array, returning as-is:', error);
      return patients; // Fallback: return as-is
    }
  }

  // ==================== END ENCRYPTION HELPERS ====================

  // Get organization ID
  async   function getOrganizationId() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (!user) {
      return null;
    }
    
    // Don't require username - some users might not have it but still have org info
    
    // Method 1: Try from user object
    if (user.organizationId) {
      return user.organizationId;
    }
    
    // Method 2: Try from user.org (fallback)
    if (user.org) {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const orgData = organizations[user.org];
      if (orgData && orgData.id) {
        udlLog(`✅ Found organization ID for ${user.org}`);
        user.organizationId = orgData.id;
        user.organization_id = orgData.id;
        localStorage.setItem("user", JSON.stringify(user));
        udlLog('✅ Updated user object with organization ID');
        return orgData.id;
      }
      
      // For Mecure Clinics, use the known org ID
      if (user.org.toLowerCase().includes('mecure')) {
        udlLog('✅ Using Mecure Clinics organization ID');
        return '576522cc-e769-4fb4-9487-3d150857d970';
      }
    }
    
    // Method 3: CRITICAL SECURITY FIX - Only use user's specific organization
    if (user.org) {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const userOrgData = organizations[user.org];
      if (userOrgData && userOrgData.id) {
        udlLog(`✅ Found organization ID for ${user.org}`);
        
        // Update user object with organization ID for future use
        user.organizationId = userOrgData.id;
        user.organization_id = userOrgData.id;
        localStorage.setItem("user", JSON.stringify(user));
        udlLog('✅ Updated user object with organization ID');
        
        return userOrgData.id;
      }
    }
    
    // Method 4: Try getCurrentOrgId() from patients-supabase.js (more robust fallback)
    if (typeof window.getCurrentOrgId === 'function') {
      try {
        const orgId = await window.getCurrentOrgId();
        if (orgId) {
          udlLog('✅ Found organization ID via getCurrentOrgId()');
          // Update user object for future use
          user.organizationId = orgId;
          user.organization_id = orgId;
          localStorage.setItem("user", JSON.stringify(user));
          return orgId;
        }
      } catch (error) {
        udlLog('⚠️ getCurrentOrgId() failed:', error);
      }
    }
    
    // Method 5: No default org ID - return null to prevent data leakage
    // No organization ID found - this is normal for some users
    return null;
  }

  async function restoreUserContextFromSupabase() {
    if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
      return null;
    }
    
    try {
      const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getUser();
      if (sessionError || !sessionData?.user) {
        return null;
      }
      
      const authUser = sessionData.user;
      if (!authUser?.id) {
        return null;
      }
      
      const { data: profile, error: profileError } = await window.supabaseClient
        .from('users')
        .select('username, first_name, last_name, gender, role, organization_id, phone, email')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      
      if (profileError) {
        console.error('❌ Error restoring user context from Supabase:', profileError);
        return null;
      }
      
      if (!profile) {
        console.warn('⚠️ No user profile found in Supabase for auth user:', authUser.id);
        return null;
      }
      
      // Get organization name from organizations table if organization_id exists
      let orgName = null;
      let orgCode = null;
      if (profile.organization_id) {
        try {
          const { data: orgData, error: orgError } = await window.supabaseClient
            .from('organizations')
            .select('name, org_code')
            .eq('id', profile.organization_id)
            .maybeSingle();
          
          if (!orgError && orgData) {
            orgName = orgData.name;
            orgCode = orgData.org_code;
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch organization name:', error);
        }
      }
      
      const existingUser = JSON.parse(localStorage.getItem("user") || "{}");
      const resolvedUser = {
        ...existingUser,
        username: profile.username || existingUser.username || authUser.email || authUser.user_metadata?.username || "",
        firstName: profile.first_name || existingUser.firstName || "",
        lastName: profile.last_name || existingUser.lastName || "",
        gender: profile.gender || existingUser.gender || "Male",
        role: profile.role || existingUser.role || "Doctor",
        org: orgName || existingUser.org || "",
        organization: orgName || existingUser.organization || "",
        orgCode: orgCode || existingUser.orgCode || "",
        organizationId: profile.organization_id || existingUser.organizationId || "",
        organization_id: profile.organization_id || existingUser.organization_id || "",
        phone: profile.phone || existingUser.phone || "",
        email: profile.email || existingUser.email || authUser.email || ""
      };
      
      localStorage.setItem("user", JSON.stringify(resolvedUser));
      
      if (resolvedUser.org && resolvedUser.organizationId) {
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        organizations[resolvedUser.org] = {
          ...(organizations[resolvedUser.org] || {}),
          id: resolvedUser.organizationId,
          name: resolvedUser.org,
          code: resolvedUser.orgCode || organizations[resolvedUser.org]?.code
        };
        localStorage.setItem("organizations", JSON.stringify(organizations));
      }
      
      return resolvedUser;
    } catch (error) {
      return null;
    }
  }

  // CRITICAL SECURITY: Clean up any leaked data from localStorage
  // Made async to support encryption/decryption
  async function cleanupLeakedData() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.org) {
      return;
    }
    
    // Note: getOrganizationId is now async, but cleanupLeakedData is called from async context
    // For now, use synchronous version for this function
    const userOrgId = user.organizationId || user.organization_id;
    if (!userOrgId) {
      return;
    }
    
    // Clean up patients data (decrypt first if encrypted)
    const patientsRaw = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patients = await decryptPatientsArray(patientsRaw);
    const validPatients = patients.filter(patient => {
      // Check if patient belongs to current organization
      if (patient.organization_id && patient.organization_id !== userOrgId) {
        console.warn('🚨 SECURITY: Removing leaked patient data for mismatched organization');
        return false;
      }
      // Also check for patients with EKO prefix that don't belong to current org
      if (patient.id && patient.id.startsWith('EKO') && userOrgId !== 'e9f8c7d6-1234-5678-9abc-def012345678') {
        console.warn('🚨 SECURITY: Removing Eko Clinics patient data assigned to another organization');
        return false;
      }
      return true;
    });
    
    if (validPatients.length !== patients.length) {
      console.warn('🚨 SECURITY: Cleaned up', patients.length - validPatients.length, 'leaked patient records');
      // Encrypt before saving (if encryption enabled)
      const encryptedValidPatients = await encryptPatientsArray(validPatients);
      localStorage.setItem(getDataKey("patients"), JSON.stringify(encryptedValidPatients));
    }
    
    // Clean up appointments data
    const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
    const validAppointments = appointments.filter(appointment => {
      if (appointment.organization_id && appointment.organization_id !== userOrgId) {
        console.warn('🚨 SECURITY: Removing leaked appointment data:', appointment.id);
        return false;
      }
      return true;
    });
    
    if (validAppointments.length !== appointments.length) {
      console.warn('🚨 SECURITY: Cleaned up', appointments.length - validAppointments.length, 'leaked appointment records');
      localStorage.setItem(getDataKey("appointments"), JSON.stringify(validAppointments));
    }
  }

  // Load patients with Supabase priority
  async function loadPatientsWithSupabasePriority(forceRefresh = false) {
    // CRITICAL SECURITY: Clean up any leaked data first
    await cleanupLeakedData();

    function escapeRegexForPid(s) {
      return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /** When org migrated MIN#### -> MFA-MC####, treat both forms as one patient for merge/dedup */
    function equivalentPatientDisplayIds(pid, prevPrefix, newPrefix) {
      const out = new Set();
      if (pid != null && pid !== '') out.add(String(pid));
      const prev = prevPrefix ? String(prevPrefix).trim() : '';
      const neu = newPrefix ? String(newPrefix).trim() : '';
      if (!prev || !neu) return [...out];
      const p = String(pid).trim().toUpperCase();
      let m = p.match(new RegExp('^' + escapeRegexForPid(prev.toUpperCase()) + '(\\d{4})$', 'i'));
      if (m) out.add(neu.toUpperCase() + m[1]);
      const hyphenSafe = neu.toUpperCase().replace(/-/g, '\\-');
      m = p.match(new RegExp('^' + hyphenSafe + '(\\d{4})$', 'i'));
      if (m) out.add(prev.toUpperCase() + m[1]);
      return [...out];
    }
    function seenHasDisplayAlias(seenKeys, displayId, prevPrefix, newPrefix) {
      return equivalentPatientDisplayIds(displayId, prevPrefix, newPrefix).some((id) =>
        seenKeys.has(`display:${String(id)}`)
      );
    }
    
    const now = Date.now();
    
    // Check for version mismatch and force refresh if needed
    const currentVersion = '20260416183000-merge-min-mfa-alias';
    const lastVersion = localStorage.getItem('appVersion');
    const versionMismatch = lastVersion !== currentVersion;
    
    if (versionMismatch) {
      udlLog('🔄 VERSION MISMATCH DETECTED: Clearing cache and forcing refresh');
      udlLog(`Previous version: ${lastVersion}, Current version: ${currentVersion}`);
      forceRefresh = true;
      dataCache.patients = null; // Clear cache
      localStorage.setItem('appVersion', currentVersion);
    }
    
    // Check for forced refresh parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlForceRefresh = urlParams.get('refresh') === '1' || urlParams.get('sync') === 'forced';
    forceRefresh = forceRefresh || urlForceRefresh;
    
    // Return cached data if still fresh (unless forced refresh)
    if (!forceRefresh && dataCache.patients && (now - dataCache.lastLoad.patients) < CACHE_DURATION) {
      udlLog('📋 Using cached patients data');
      return dataCache.patients;
    }
    
    if (forceRefresh) {
      udlLog('🔄 FORCED REFRESH: Bypassing cache for fresh data');
      dataCache.patients = null; // Clear cache
    }

    udlLog('🔄 Loading patients with Supabase priority...');
    
    // Wait for Supabase client to be available (mobile compatibility)
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries && (typeof window.supabaseClient === 'undefined' || !window.supabaseClient)) {
      udlLog(`⏳ Waiting for Supabase client... (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 500));
      retryCount++;
    }
    
    // STEP 1: Try Supabase first (PRIORITY)
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      try {
        // Check if user is platform admin first - if so, skip silently without logging
        const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin") || "null");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const isPlatformAdmin = platformAdmin !== null || 
                               user.username === 'platform_admin' || 
                               user.role === 'Platform Admin' ||
                               user.role === 'PlatformOwner' ||
                               (user.email && user.email === 'admin@mediforge.com');
        
        let orgId = await getOrganizationId();
        if (!orgId) {
          // Try to restore user context from Supabase
          const restoredUser = await restoreUserContextFromSupabase();
          if (restoredUser) {
            orgId = await getOrganizationId();
          }
        }
        
        // Final fallback: If still no orgId and user has org name, try to get it from Supabase
        if (!orgId) {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          if (user.org && window.supabaseClient) {
            try {
              const { data: orgData, error: orgError } = await window.supabaseClient
                .from('organizations')
                .select('id')
                .eq('name', user.org)
                .maybeSingle();
              
              if (!orgError && orgData && orgData.id) {
                orgId = orgData.id;
                // Update user object
                user.organizationId = orgId;
                user.organization_id = orgId;
                localStorage.setItem("user", JSON.stringify(user));
                console.log(`✅ Retrieved organization ID from Supabase: ${orgId}`);
              }
            } catch (error) {
              console.warn('⚠️ Could not get organization ID from Supabase:', error);
            }
          }
        }
        
        // Only log if not platform admin
        if (!isPlatformAdmin) {
          udlLog('Using resolved organization ID for current user');
        }
        
        // CRITICAL: Don't load data if no organization ID (prevents data leakage)
        if (!orgId) {
          // Try to restore user context from Supabase if available
          if (typeof window.restoreUserContextFromSupabase === 'function') {
            try {
              await window.restoreUserContextFromSupabase();
              // Retry getting org ID after restoration
              orgId = await getOrganizationId();
            } catch (restoreError) {
              console.warn('⚠️ Could not restore user context:', restoreError);
            }
          }
          
          // Try getCurrentOrgId as additional fallback
          if (!orgId && typeof window.getCurrentOrgId === 'function') {
            try {
              orgId = await window.getCurrentOrgId();
            } catch (getOrgError) {
              console.warn('⚠️ Could not get org ID from getCurrentOrgId:', getOrgError);
            }
          }
          
          // If still no org ID, throw error but with helpful message
          if (!orgId) {
            // Silently skip for platform admin - this is expected behavior
            if (!isPlatformAdmin) {
              console.warn('⚠️ No organization ID - skipping Supabase load to prevent data leakage');
              console.warn('💡 TIP: If you just cleared cache, you may need to log in again.');
              console.warn('💡 The organization ID is required to load patients from Supabase.');
            }
            throw new Error('No organization ID found - please log in to restore your session');
          }
        }
        
        // CRITICAL SECURITY: Validate organization ID belongs to current user
        if (!isPlatformAdmin) {
          udlLog(`🔒 SECURITY: Validating organization ID for user "${user.org}"`);
        }
        let orgPatientPrevPrefix = null;
        let orgPatientNewPrefix = null;

        if (user.org) {
          const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
          const userOrgData = organizations[user.org];
          udlLog(`🔒 SECURITY: Organization record located: ${userOrgData ? 'yes' : 'no'}`);
          
          // Check if user's organization ID matches the one we're using
          const userOrgId = user.organizationId;
          udlLog('🔒 SECURITY: Comparing stored organization IDs for consistency');
          
          if (userOrgId && userOrgId !== orgId) {
            console.error('🚨 SECURITY ALERT: Organization ID mismatch!');
            console.error('🚨 User org:', user.org, 'User org ID:', userOrgId, 'Got org ID:', orgId);
            throw new Error('Organization ID security validation failed');
          }
          udlLog('🔒 SECURITY: Organization ID validation passed');
        }

        // Cache invalidation: if org migrated patient_id prefix (e.g. MIN->MFA), clear stale cache
        if (window.supabaseClient && orgId) {
          try {
            const { data: org } = await window.supabaseClient.from('organizations').select('settings').eq('id', orgId).maybeSingle();
            if (org?.settings) {
              orgPatientPrevPrefix = org.settings.patient_id_previous_prefix || null;
              orgPatientNewPrefix = org.settings.patient_id_prefix || null;
            }
            if (org?.settings?.patient_id_previous_prefix) {
              const patientsKey = getDataKey("patients");
              const cached = localStorage.getItem(patientsKey);
              if (cached) {
                try {
                  const parsed = JSON.parse(cached);
                  const arr = Array.isArray(parsed) ? parsed : (parsed?.data ? (Array.isArray(parsed.data) ? parsed.data : []) : []);
                  const prev = String(org.settings.patient_id_previous_prefix).toUpperCase();
                  const hasStale = arr.some(p => (p.patient_id || '').toUpperCase().startsWith(prev) || (p.patientNumber || '').toUpperCase().startsWith(prev));
                  if (hasStale) {
                    localStorage.removeItem(patientsKey);
                    dataCache.patients = null;
                    dataCache.lastLoad.patients = 0;
                    udlLog('🔄 Cleared stale patient cache (org migrated patient_id prefix)');
                  }
                } catch (e) { /* ignore */ }
              }
            }
          } catch (e) { /* ignore */ }
        }
        
        let supabasePatients = [];
        
        try {
          if (typeof window.secureSupabaseRpc !== 'function') {
            throw new Error('secureSupabaseRpc helper is unavailable');
          }
          
          const rpcData = await window.secureSupabaseRpc(
            'get_patients_for_org',
            { p_org_id: orgId }
          );
          
          if (Array.isArray(rpcData)) {
            supabasePatients = rpcData;
          }
        } catch (rpcError) {
          console.error('❌ Error loading patients via secure Supabase proxy:', rpcError);
          throw rpcError;
        }
        
        // CRITICAL SECURITY: Additional validation to prevent data leakage
        if (supabasePatients && supabasePatients.length > 0) {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          const userOrg = user.org;
          
          // Filter out any patients that don't belong to this organization
          const validPatients = supabasePatients.filter(patient => {
            // Check if patient ID matches organization pattern
            if (patient.patient_id && patient.patient_id.startsWith('EKO') && userOrg !== 'Eko Clinics') {
              console.warn('🚨 SECURITY: Blocking Eko Clinics patient from non-Eko organization:', patient.patient_id);
              return false;
            }
            if (patient.patient_id && patient.patient_id.startsWith('AXIOM') && userOrg !== 'Axiom Medical') {
              console.warn('🚨 SECURITY: Blocking Axiom Medical patient from non-Axiom organization:', patient.patient_id);
              return false;
            }
            if (patient.patient_id && patient.patient_id.startsWith('MECURE') && userOrg !== 'Mecure Clinics') {
              console.warn('🚨 SECURITY: Blocking Mecure patient from non-Mecure organization:', patient.patient_id);
              return false;
            }
            return true;
          });
          
          if (validPatients.length !== supabasePatients.length) {
            console.warn('🚨 SECURITY: Filtered out', supabasePatients.length - validPatients.length, 'patients with wrong organization_id');
            // Update the supabasePatients array with filtered results
            supabasePatients.splice(0, supabasePatients.length, ...validPatients);
          }
        }
        
        // CRITICAL FIX: No fallback to other organizations - this prevents data leakage
        if (!supabasePatients || supabasePatients.length === 0) {
          udlLog('📋 No patients found for organization', orgId, '- this is normal for new organizations');
          // supabasePatients is already empty, no need to reassign
        }
        
        udlLog('✅ Loaded', supabasePatients?.length || 0, 'patients from Supabase');
        
        // CRITICAL: Load existing localStorage patients FIRST to preserve legacy IDs
        const existingPatientsRaw = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        let existingPatients = [];
        try {
          existingPatients = await decryptPatientsArray(existingPatientsRaw);
        } catch (e) {
          existingPatients = [];
        }
        
        // Convert Supabase format to localStorage format
        let patients = [];
        const patientsToUpdate = []; // Collect patients that need Supabase updates
        const asyncOperations = []; // Collect async operations to run after map
        if (supabasePatients && supabasePatients.length > 0) {
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

            // CRITICAL FIX: Use separate emergency address fields FIRST, then fallback to combined address
            let emergencyAddr1 = patient.emergency_address_line1 || '';
            let emergencyAddr2 = patient.emergency_address_line2 || '';
            let emergencyCity = patient.emergency_city || '';
            let emergencyState = patient.emergency_state || '';
            let emergencyCountry = patient.emergency_country || '';
            
            // Fallback to parsing combined address only if separate fields are not available
            if (!emergencyAddr1 && !emergencyCity && !emergencyState && !emergencyCountry) {
            const emergencyCombined = (patient.emergency_contact_address || '').trim();
            if (emergencyCombined) {
              const eparts = emergencyCombined.split(',').map(p => p.trim()).filter(Boolean);
              if (eparts.length > 0) emergencyAddr1 = eparts[0];
              if (eparts.length > 1) emergencyCity = eparts[1];
              if (eparts.length > 2) emergencyState = eparts[2];
              if (eparts.length > 3) emergencyCountry = eparts[3];
              }
            }
            // Safely handle JSON fields
            const parseJsonField = value => {
              if (!value) return [];
              if (Array.isArray(value)) return value;
              if (typeof value === 'object') return value;
              if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed || trimmed === 'null' || trimmed === 'NULL') return [];
                try {
                  return JSON.parse(trimmed);
                } catch (_) {
                  return [];
                }
              }
              return [];
            };

            let allergies = [];
            let conditions = [];
            let diagnoses = [];
            let immunizations = [];
            let medicalHistory = [];
            let vitals = [];
            let medications = [];
            let prescriptions = [];
            let encounters = [];
            
            try {
              allergies = parseJsonField(patient.allergies);
            } catch (e) {
              allergies = [];
            }
            
            try {
              conditions = parseJsonField(patient.chronic_conditions);
            } catch (e) {
              conditions = [];
            }
            
            try {
              diagnoses = parseJsonField(patient.diagnoses);
            } catch (e) {
              diagnoses = [];
            }
            
            try {
              immunizations = parseJsonField(patient.immunizations);
            } catch (e) {
              immunizations = [];
            }
            
            try {
              medicalHistory = parseJsonField(patient.medical_history);
            } catch (e) {
              medicalHistory = [];
            }
            
            try {
              vitals = parseJsonField(patient.vitals);
            } catch (e) {
              vitals = [];
            }
            
            try {
              medications = parseJsonField(patient.medications);
            } catch (e) {
              medications = [];
            }
            
            try {
              prescriptions = parseJsonField(patient.prescriptions);
            } catch (e) {
              prescriptions = [];
              if (e.message && !e.message.includes('Unexpected end')) {
                console.error('❌ Error parsing prescriptions for patient', patient.patient_id, ':', e.message);
              }
            }

            
            try {
              // Try both 'encounters' and 'non_visit_encounters' column names
              encounters = parseJsonField(patient.encounters || patient.non_visit_encounters);
            } catch (e) {
              encounters = [];
              if (e.message && !e.message.includes('Unexpected end')) {
                console.error('❌ Error parsing encounters for patient', patient.patient_id, ':', e.message);
              }
            }
            
            let unstructuredRecords = [];
            try {
              unstructuredRecords = parseJsonField(patient.unstructured_records);
            } catch (e) {
              unstructuredRecords = [];
              if (e.message && !e.message.includes('Unexpected end')) {
                console.error('❌ Error parsing unstructured_records for patient', patient.patient_id, ':', e.message);
              }
            }
            
            // Use patient_id from Supabase - that's it. Simple.
            const displayId = patient.patient_id;
            
            return {
              id: displayId, // Display ID (MEC0013 format) - LEGACY SYSTEM
              patient_id: displayId, // Also set patient_id explicitly for compatibility
              firstName: patient.first_name || '',
              middleName: patient.middle_name || '',
              lastName: patient.last_name || '',
              dob: patient.date_of_birth,
              gender: patient.gender || '',
              maritalStatus: patient.marital_status || '',
              race: patient.race || '',
              occupation: patient.occupation || '',
              phone: patient.phone || '',
              phoneCountryCode: patient.phone_country_code || '',
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
              diagnoses: diagnoses,
              immunizations: immunizations,
              medicalHistory: medicalHistory,
              vitals: vitals,
              emergencyFirstName: patient.emergency_contact_name ? patient.emergency_contact_name.split(' ')[0] : '',
              emergencyLastName: patient.emergency_contact_name ? patient.emergency_contact_name.split(' ').slice(1).join(' ') : '',
              emergencyPhone: patient.emergency_contact_phone || '',
              emergencyPhoneCountryCode: patient.emergency_phone_country_code || '',
              emergencyRelationship: patient.emergency_contact_relationship || '',
              emergencyEmail: patient.emergency_contact_email || '',
              emergencyAddressCombined: patient.emergency_contact_address || '',
              emergencyAddressLine1: emergencyAddr1,
              emergencyAddressLine2: emergencyAddr2,
              emergencyCity: emergencyCity,
              emergencyState: emergencyState,
              emergencyCountry: emergencyCountry,
              medications: medications,
              prescriptions: prescriptions,
              encounters: encounters,
              unstructuredRecords: unstructuredRecords,
              organizationId: patient.organization_id,
              _supabaseUuid: patient.id // Store the actual Supabase UUID separately for database operations
            };
          });

          // Preserve local prescriptions only when Supabase has none
          if (Array.isArray(existingPatients) && existingPatients.length) {
            const localPrescriptionsByKey = new Map();
            existingPatients.forEach(localPatient => {
              if (Array.isArray(localPatient?.prescriptions) && localPatient.prescriptions.length) {
                const keyCandidates = [
                  localPatient.patient_id,
                  localPatient.id,
                  localPatient._supabaseUuid
                ].filter(Boolean);
                keyCandidates.forEach(key => {
                  if (!localPrescriptionsByKey.has(key)) {
                    localPrescriptionsByKey.set(key, localPatient.prescriptions);
                  }
                });
              }
            });

            patients.forEach(loadedPatient => {
              if (Array.isArray(loadedPatient.prescriptions) && loadedPatient.prescriptions.length) return;
              const keyCandidates = [
                loadedPatient.patient_id,
                loadedPatient.id,
                loadedPatient._supabaseUuid
              ].filter(Boolean);
              let matchedPrescriptions = null;
              for (const key of keyCandidates) {
                if (localPrescriptionsByKey.has(key)) {
                  matchedPrescriptions = localPrescriptionsByKey.get(key);
                  break;
                }
              }
              if (!matchedPrescriptions) {
                const matchByNameDob = existingPatients.find(localPatient =>
                  localPatient?.firstName &&
                  localPatient?.lastName &&
                  localPatient?.dob &&
                  localPatient.firstName === loadedPatient.firstName &&
                  localPatient.lastName === loadedPatient.lastName &&
                  localPatient.dob === loadedPatient.dob &&
                  Array.isArray(localPatient.prescriptions) &&
                  localPatient.prescriptions.length
                );
                if (matchByNameDob) {
                  matchedPrescriptions = matchByNameDob.prescriptions;
                }
              }
              if (matchedPrescriptions) {
                loadedPatient.prescriptions = matchedPrescriptions;
              }
            });
          }
          
          // SUPABASE-FIRST: Update Supabase with legacy IDs found in localStorage
          // This makes Supabase authoritative for patient_id values
          if (patientsToUpdate.length > 0 && window.supabaseClient) {
            console.log(`🔄 Updating ${patientsToUpdate.length} patients in Supabase with legacy IDs...`);
            // Update in parallel (non-blocking)
            Promise.all(patientsToUpdate.map(async ({ uuid, displayId, orgId, name }) => {
              try {
                await window.supabaseClient
                  .from('patients')
                  .update({ patient_id: displayId })
                  .eq('id', uuid)
                  .eq('organization_id', orgId);
                console.log(`✅ Updated Supabase patient_id to ${displayId} for ${name}`);
              } catch (updateError) {
                console.warn(`⚠️ Could not update Supabase patient_id for ${name}:`, updateError);
                // Non-critical - continue
              }
            })).catch(err => {
              console.warn('⚠️ Some Supabase updates failed (non-critical):', err);
            });
          }
          
          // HYBRID ARCHITECTURE: Merge Supabase and localStorage patients
          // 1. Reuse existing localStorage patients loaded above
          const existingPatientsForMerge = Array.isArray(existingPatients) ? existingPatients : [];
          
          // 2. Filter localStorage patients by organization (security)
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          const filteredLocalPatients = existingPatientsForMerge.filter(localPatient => {
            // Check if patient belongs to current org
            if (localPatient.organizationId === orgId || localPatient.organization_id === orgId) return true;
            // Also check if patient was created by current user (might not have org_id set yet)
            if (localPatient.created_by === user.username) return true;
            return false;
          });
          
          // 3. Create a map of Supabase patients (authoritative for synced patients)
          // CRITICAL FIX: Match by BOTH UUID (id) and display ID (patient_id) for proper merging
          const supabasePatientMap = new Map();
          const supabasePatientIdMap = new Map(); // Map by patient_id (display ID) for matching
          
          patients.forEach(supabasePatient => {
            // Mapped rows use _supabaseUuid for DB UUID; id/patient_id are display IDs only.
            const uuidKey =
              supabasePatient._supabaseUuid ||
              (supabasePatient.id &&
              String(supabasePatient.id).includes('-') &&
              String(supabasePatient.id).length >= 36
                ? supabasePatient.id
                : null);
            const displayIdKey =
              supabasePatient.patient_id ||
              (supabasePatient.id && !String(supabasePatient.id).includes('-') ? supabasePatient.id : null);
            
            if (uuidKey) {
              supabasePatientMap.set(uuidKey, supabasePatient);
            }
            if (displayIdKey) {
              supabasePatientIdMap.set(displayIdKey, supabasePatient);
              equivalentPatientDisplayIds(displayIdKey, orgPatientPrevPrefix, orgPatientNewPrefix).forEach((aliasId) => {
                supabasePatientIdMap.set(aliasId, supabasePatient);
              });
            }
            
            // Merge visits/orders from localStorage if they exist
            const existingPatient = filteredLocalPatients.find(p => {
              const pUuid =
                p._supabaseUuid ||
                (p.id && String(p.id).includes('-') && String(p.id).length >= 36 ? p.id : null);
              const pDisplayId = p.patient_id || (p.id && !String(p.id).includes('-') ? p.id : null);
              const uuidMatch = Boolean(pUuid && uuidKey && pUuid === uuidKey);
              if (uuidMatch) return true;
              if (!pDisplayId || !displayIdKey) return false;
              const setP = new Set(
                equivalentPatientDisplayIds(pDisplayId, orgPatientPrevPrefix, orgPatientNewPrefix).map((x) =>
                  String(x).toUpperCase()
                )
              );
              const setS = new Set(
                equivalentPatientDisplayIds(displayIdKey, orgPatientPrevPrefix, orgPatientNewPrefix).map((x) =>
                  String(x).toUpperCase()
                )
              );
              for (const x of setP) {
                if (setS.has(x)) return true;
              }
              return pDisplayId === displayIdKey;
            });
            if (existingPatient && existingPatient.visits) {
              supabasePatient.visits = existingPatient.visits;
            } else {
              supabasePatient.visits = [];
            }
            // CRITICAL: Merge vitals from localStorage (BP check readings may exist only locally until synced)
            if (existingPatient && Array.isArray(existingPatient.vitals) && existingPatient.vitals.length) {
              const supabaseVitals = Array.isArray(supabasePatient.vitals) ? supabasePatient.vitals : [];
              const localVitals = existingPatient.vitals;
              const seenKeys = new Set(supabaseVitals.map(v => String(v.timestamp || v.visitDate || '')));
              const toAdd = localVitals.filter(v => {
                const ts = String(v.timestamp || v.visitDate || '');
                if (!ts || seenKeys.has(ts)) return false;
                seenKeys.add(ts);
                return true;
              });
              supabasePatient.vitals = [...supabaseVitals, ...toAdd].sort((a, b) => {
                const ta = new Date(a.timestamp || a.visitDate || 0).getTime();
                const tb = new Date(b.timestamp || b.visitDate || 0).getTime();
                return tb - ta;
              });
            }
          });
          
          // 4. Add unsynced patients from localStorage (not yet in Supabase)
          // CRITICAL FIX: Match by both UUID and display ID to avoid duplicates
          // Also deduplicate by name + DOB to prevent true duplicates
          const mergedPatients = [...patients]; // Start with Supabase patients
          const seenKeys = new Set(); // Track seen patients by key
          
          // Add all Supabase patients to seen set
          patients.forEach(supabasePatient => {
            const uuidKey =
              supabasePatient._supabaseUuid ||
              (supabasePatient.id &&
              String(supabasePatient.id).includes('-') &&
              String(supabasePatient.id).length >= 36
                ? supabasePatient.id
                : null);
            const displayIdKey =
              supabasePatient.patient_id ||
              (supabasePatient.id && !String(supabasePatient.id).includes('-') ? supabasePatient.id : null);
            if (uuidKey) seenKeys.add(`uuid:${uuidKey}`);
            if (displayIdKey) {
              equivalentPatientDisplayIds(displayIdKey, orgPatientPrevPrefix, orgPatientNewPrefix).forEach((aliasId) => {
                seenKeys.add(`display:${aliasId}`);
              });
            }
            const fn = (supabasePatient.firstName || supabasePatient.first_name || '').toLowerCase();
            const ln = (supabasePatient.lastName || supabasePatient.last_name || '').toLowerCase();
            const dobVal = supabasePatient.dob || supabasePatient.date_of_birth || '';
            const nameDobKey = `${fn}_${ln}_${dobVal}`;
            if (nameDobKey && dobVal) seenKeys.add(`nameDob:${nameDobKey}`);
          });
          
          filteredLocalPatients.forEach(localPatient => {
            // localStorage stores: id (display ID), patient_id (display ID)
            const localDisplayId = localPatient.patient_id || (localPatient.id && !localPatient.id.includes('-') ? localPatient.id : null);
            const localUuid =
              localPatient._supabaseUuid ||
              (localPatient.id && localPatient.id.includes('-') && localPatient.id.length >= 36 ? localPatient.id : null);
            
            // Check if patient already exists in Supabase by either UUID or display ID
            const existsByUuid = localUuid && seenKeys.has(`uuid:${localUuid}`);
            const existsByDisplayId =
              localDisplayId &&
              seenHasDisplayAlias(seenKeys, localDisplayId, orgPatientPrevPrefix, orgPatientNewPrefix);
            
            // Also check by name+DOB for true duplicates
            const localFirstName = (localPatient.firstName || localPatient.first_name || '').toLowerCase();
            const localLastName = (localPatient.lastName || localPatient.last_name || '').toLowerCase();
            const localDob = localPatient.dob || localPatient.date_of_birth || '';
            const nameDobKey = `${localFirstName}_${localLastName}_${localDob}`;
            const existsByNameDob = nameDobKey && localDob && seenKeys.has(`nameDob:${nameDobKey}`);
            
            // Only include if NOT already in Supabase (unsynced patient) and not a duplicate by name+DOB
            if (!existsByUuid && !existsByDisplayId && !existsByNameDob && (localDisplayId || localUuid)) {
              // Mark as unsynced for visibility
              localPatient._fromLocalStorage = true;
              localPatient._synced = false;
              mergedPatients.push(localPatient);
              // Add to seen set
              if (localDisplayId) {
                equivalentPatientDisplayIds(localDisplayId, orgPatientPrevPrefix, orgPatientNewPrefix).forEach((aliasId) => {
                  seenKeys.add(`display:${aliasId}`);
                });
              }
              if (localUuid) seenKeys.add(`uuid:${localUuid}`);
              if (nameDobKey && localDob) seenKeys.add(`nameDob:${nameDobKey}`);
              udlLog(`📱 Including unsynced patient from localStorage: ${localDisplayId || localUuid}`);
            } else if (existsByNameDob && !existsByUuid && !existsByDisplayId) {
              udlLog(`⚠️ Skipping duplicate patient by name+DOB: ${localDisplayId || localUuid}`);
            }
          });
          
          // 4. Deduplicate merged patients by name+DOB (final safety check)
          const finalPatients = [];
          const finalSeenKeys = new Set();
          
          mergedPatients.forEach(patient => {
            const firstName = (patient.firstName || patient.first_name || '').toLowerCase().trim();
            const lastName = (patient.lastName || patient.last_name || '').toLowerCase().trim();
            const dob = patient.dob || patient.date_of_birth || '';
            const nameDobKey = `${firstName}_${lastName}_${dob}`;
            const displayId = patient.patient_id || patient.id;
            
            // Check if we've already seen this patient by name+DOB or display ID
            const seenByNameDob = nameDobKey && dob && finalSeenKeys.has(`nameDob:${nameDobKey}`);
            const seenByDisplayId =
              displayId &&
              seenHasDisplayAlias(finalSeenKeys, displayId, orgPatientPrevPrefix, orgPatientNewPrefix);
            
            if (!seenByNameDob && !seenByDisplayId) {
              finalPatients.push(patient);
              if (nameDobKey && dob) finalSeenKeys.add(`nameDob:${nameDobKey}`);
              if (displayId) {
                equivalentPatientDisplayIds(displayId, orgPatientPrevPrefix, orgPatientNewPrefix).forEach((aliasId) => {
                  finalSeenKeys.add(`display:${aliasId}`);
                });
              }
            } else {
              udlLog(`⚠️ Final deduplication: Skipping duplicate patient: ${displayId || nameDobKey}`);
            }
          });
          
          // 5. Save merged data back to localStorage (preserves unsynced patients, no duplicates)
          const encryptedMergedPatients = await encryptPatientsArray(finalPatients);
          localStorage.setItem(getDataKey("patients"), JSON.stringify(encryptedMergedPatients));
        
          // 6. Update cache and return deduplicated list
          dataCache.patients = finalPatients;
        dataCache.lastLoad.patients = now;
        
          udlLog(`✅ Loaded ${patients.length} from Supabase, ${finalPatients.length - patients.length} unsynced from localStorage, ${mergedPatients.length - finalPatients.length} duplicates removed, total: ${finalPatients.length}`);
          return finalPatients;
        } else {
          // No Supabase patients, but still load from localStorage (filtered by org)
          udlLog('📋 No patients in Supabase, checking localStorage for unsynced patients');
          const existingPatientsRaw = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
          const existingPatients = await decryptPatientsArray(existingPatientsRaw);
          
          // Filter by organization (security)
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          const filteredLocalPatients = existingPatients.filter(localPatient => {
            // Check if patient belongs to current org
            if (localPatient.organizationId === orgId || localPatient.organization_id === orgId) return true;
            // Also check if patient was created by current user (might not have org_id set yet)
            if (localPatient.created_by === user.username) return true;
            return false;
          });
          
          // Mark all as from localStorage
          filteredLocalPatients.forEach(p => {
            p._fromLocalStorage = true;
            p._synced = false;
          });
          
          dataCache.patients = filteredLocalPatients;
          dataCache.lastLoad.patients = now;
          
          udlLog(`✅ Loaded ${filteredLocalPatients.length} unsynced patients from localStorage`);
          return filteredLocalPatients;
        }
        
      } catch (error) {
        // Only log as error if it's not the expected "No organization ID" error for platform admin
        const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin") || "null");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const isPlatformAdmin = platformAdmin !== null || 
                               user.username === 'platform_admin' || 
                               user.role === 'Platform Admin' ||
                               user.role === 'PlatformOwner' ||
                               (user.email && user.email === 'admin@mediforge.com');
        
        if (!isPlatformAdmin || !error.message.includes('No organization ID found')) {
          console.error('❌ Exception loading patients from Supabase:', error);
        }
        // Fall through to localStorage fallback
      }
    } else {
      console.warn('⚠️ Supabase client not available');
    }
    
    // STEP 2: Fallback to localStorage
    udlLog('📱 Falling back to localStorage for patients');
    let patientsRaw = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    // Decrypt if encrypted (backward compatible)
    let patients = await decryptPatientsArray(patientsRaw);
    
    // CRITICAL FIX: No fallback to other organization's data - this prevents data leakage
    if (patients.length === 0) {
      udlLog('📋 No patients found in localStorage for organization - this is normal for new organizations');
    }
    
    // Cache the data
    dataCache.patients = patients;
    dataCache.lastLoad.patients = now;
    
    return patients;
  }

  // Load appointments with Supabase priority
  async function loadAppointmentsWithSupabasePriority(forceRefresh = false) {
    const now = Date.now();
    
    // Check for version mismatch and force refresh if needed
    const currentVersion = '20260416183000-merge-min-mfa-alias';
    const lastVersion = localStorage.getItem('appVersion');
    const versionMismatch = lastVersion !== currentVersion;
    
    if (versionMismatch) {
      udlLog('🔄 VERSION MISMATCH DETECTED: Clearing appointments cache');
      forceRefresh = true;
      dataCache.appointments = null; // Clear cache
    }
    
    // Check for forced refresh parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlForceRefresh = urlParams.get('refresh') === '1' || urlParams.get('sync') === 'forced';
    forceRefresh = forceRefresh || urlForceRefresh;
    
    // Return cached data if still fresh (unless forced refresh)
    if (!forceRefresh && dataCache.appointments && (now - dataCache.lastLoad.appointments) < CACHE_DURATION) {
      udlLog('📅 Using cached appointments data');
      return dataCache.appointments;
    }
    
    if (forceRefresh) {
      udlLog('🔄 FORCED REFRESH: Bypassing appointments cache for fresh data');
      dataCache.appointments = null; // Clear cache
    }

    udlLog('🔄 Loading appointments with Supabase priority...');
    
    // Wait for Supabase client to be available (mobile compatibility)
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries && (typeof window.supabaseClient === 'undefined' || !window.supabaseClient)) {
      udlLog(`⏳ Waiting for Supabase client... (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 500));
      retryCount++;
    }
    
    // STEP 1: Try Supabase first (PRIORITY)
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      try {
        // Check if user is platform admin first - if so, skip silently without logging
        const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin") || "null");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const isPlatformAdmin = platformAdmin !== null || 
                               user.username === 'platform_admin' || 
                               user.role === 'Platform Admin' ||
                               user.role === 'PlatformOwner' ||
                               (user.email && user.email === 'admin@mediforge.com');
        
        // Try to get organization ID - restore from Supabase if needed (SUPABASE-FIRST)
        let orgId = await getOrganizationId();
        if (!orgId) {
          udlLog('⚠️ Organization ID not found, attempting to restore from Supabase...');
          await restoreUserContextFromSupabase();
          orgId = await getOrganizationId();
        }
        
        // Only log if not platform admin
        if (!isPlatformAdmin) {
          udlLog('Using resolved organization ID for current user');
        }
        
        // CRITICAL: Don't load data if no organization ID (prevents data leakage)
        // This is a security measure - we cannot query Supabase without knowing which org
        if (!orgId) {
          // Silently skip for platform admin - this is expected behavior
          if (!isPlatformAdmin) {
            console.warn('⚠️ No organization ID - cannot load from Supabase (security: prevents data leakage)');
            console.warn('⚠️ Falling back to localStorage for appointments');
          }
          throw new Error('No organization ID found - Supabase query blocked for security');
        }
        
        // CRITICAL SECURITY: Validate organization ID belongs to current user
        if (user.org) {
          const userOrgId = user.organizationId;
          if (userOrgId && userOrgId !== orgId) {
            console.error('🚨 SECURITY ALERT: Organization ID mismatch for appointments!');
            console.error('🚨 User org:', user.org, 'User org ID:', userOrgId, 'Got ID:', orgId);
            throw new Error('Organization ID security validation failed');
          }
        }
        
        let supabaseAppointments = null;
        let appointmentsError = null;

        // Platform admin clinic view: same path as patients (secure proxy / service role)
        if (user._isPlatformView && typeof window.secureSupabaseRpc === 'function') {
          try {
            const rpcRows = await window.secureSupabaseRpc('get_appointments_for_org', { p_org_id: orgId });
            supabaseAppointments = Array.isArray(rpcRows) ? rpcRows : [];
            udlLog('✅ Loaded', supabaseAppointments.length, 'appointments via get_appointments_for_org');
          } catch (rpcErr) {
            appointmentsError = rpcErr;
            console.error('❌ Error loading appointments via secure RPC:', rpcErr);
          }
        }

        if (supabaseAppointments === null) {
          const { data, error } = await window.supabaseClient
            .from('appointments')
            .select('*')
            .eq('organization_id', orgId);
          supabaseAppointments = data;
          appointmentsError = error;
        }
        
        if (appointmentsError) {
          console.error('❌ Error loading appointments from Supabase:', appointmentsError);
          throw new Error(`Supabase error: ${appointmentsError.message || appointmentsError}`);
        }
        
        udlLog('✅ Loaded', supabaseAppointments?.length || 0, 'appointments from Supabase');
        
        // Convert Supabase format to localStorage format
        let appointments = [];
        if (supabaseAppointments && supabaseAppointments.length > 0) {
          const mapped = supabaseAppointments.map(sa => ({
            id: sa.appointment_id || `${sa.appointment_date}_${sa.appointment_time?.replace(':', '')}`,
            supabaseId: sa.id,
            patientId: sa.patient_id,
            patientName: sa.patient_name || 'Unknown Patient',
            date: sa.appointment_date,
            time: sa.appointment_time,
            duration: sa.duration || 30,
            visitType: sa.visit_type || 'General',
            doctor: sa.doctor_name || sa.doctor || 'Dr. Smith',
            appointment_type: sa.appointment_type || 'General Consultation',
            appointment_type_id: sa.appointment_type_id || '',
            status: sa.status || 'Scheduled',
            notes: sa.notes || '',
            organizationId: sa.organization_id,
            organization_id: sa.organization_id,
            checkInTime: sa.checked_in_at ? new Date(sa.checked_in_at).getTime() : null,
            checkOutTime: sa.checked_out_at ? new Date(sa.checked_out_at).getTime() : null
          }));
          // Deduplicate by (patientId, date, time): keep one per slot (prefer row with specific type over General Consultation)
          const slotKey = (a) => `${a.patientId}|${a.date}|${a.time}`;
          const bySlot = new Map();
          for (const a of mapped) {
            const key = slotKey(a);
            const existing = bySlot.get(key);
            const preferThis = !existing ||
              ((a.appointment_type && a.appointment_type !== 'General Consultation') && (!existing.appointment_type || existing.appointment_type === 'General Consultation'));
            if (preferThis) bySlot.set(key, a);
          }
          appointments = Array.from(bySlot.values());
          localStorage.setItem(getDataKey("appointments"), JSON.stringify(appointments));
        }
        
        // Cache the data
        dataCache.appointments = appointments;
        dataCache.lastLoad.appointments = now;
        
        return appointments;
        
      } catch (error) {
        // Only log as error if it's not the expected "No organization ID" error for platform admin
        const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin") || "null");
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const isPlatformAdmin = platformAdmin !== null || 
                               user.username === 'platform_admin' || 
                               user.role === 'Platform Admin' ||
                               user.role === 'PlatformOwner' ||
                               (user.email && user.email === 'admin@mediforge.com');
        
        if (!isPlatformAdmin || !error.message.includes('No organization ID found')) {
          console.error('❌ Exception loading appointments from Supabase:', error);
        }
        // Fall through to localStorage fallback
      }
    } else {
      console.warn('⚠️ Supabase client not available');
    }
    
    // STEP 2: Fallback to localStorage
  udlLog('📱 Falling back to localStorage for appointments');
    
    // Try to get appointments from localStorage - use getDataKey if available, otherwise try both prefixed and non-prefixed keys
    let appointments = [];
    try {
      const dataKey = getDataKey("appointments");
      appointments = JSON.parse(localStorage.getItem(dataKey) || "[]");
      
      // If no appointments found with org prefix, try without prefix as fallback
      if (!appointments || appointments.length === 0) {
        const fallbackAppointments = JSON.parse(localStorage.getItem("appointments") || "[]");
        if (fallbackAppointments && fallbackAppointments.length > 0) {
          udlLog('📱 Found appointments in localStorage without org prefix, using those');
          appointments = fallbackAppointments;
        }
      }
    } catch (error) {
      console.error('❌ Error loading appointments from localStorage:', error);
      appointments = [];
    }
    
    // Cache the data
    dataCache.appointments = appointments;
    dataCache.lastLoad.appointments = now;
    
    udlLog(`✅ Loaded ${appointments.length} appointments from localStorage fallback`);
    return appointments;
  }

  // Get patient by ID with Supabase priority
  async function getPatientById(patientId) {
    const patients = await loadPatientsWithSupabasePriority();
    return patients.find(p => p.id === patientId);
  }

  // Get patient name by ID with Supabase priority
  async function getPatientNameById(patientId) {
    const patient = await getPatientById(patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
  }

  // Clear cache (useful for forcing fresh data)
  function clearDataCache() {
    dataCache.patients = null;
    dataCache.appointments = null;
    dataCache.lastLoad.patients = 0;
    dataCache.lastLoad.appointments = 0;
    udlLog('🗑️ Data cache cleared');
  }

  // CRITICAL SECURITY: Database cleanup function to fix data leakage
  async function cleanupDatabaseLeakage() {
    udlLog('🔒 SECURITY: Starting database leakage cleanup...');
    
    if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
      console.error('❌ Supabase client not available for database cleanup');
      return;
    }

    try {
      // Get all organizations and their correct IDs
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (!currentUser.org) {
        return;
      }
      
      // Note: cleanupLeakedData is called from async context, but getOrganizationId is now async
      // Use synchronous check for this function
      const userOrgId = currentUser.organizationId || currentUser.organization_id;
      if (!userOrgId) {
        return;
      }

      // Find and fix patients with wrong organization_id
      const { data: allPatients, error: fetchError } = await window.supabaseClient
        .from('patients')
        .select('*');

      if (fetchError) {
        console.error('❌ Error fetching patients for cleanup:', fetchError);
        return;
      }

      let fixedCount = 0;
      for (const patient of allPatients) {
        let shouldFix = false;
        let correctOrgId = null;

        // Check if patient ID matches organization pattern
        if (patient.patient_id && patient.patient_id.startsWith('EKO') && patient.organization_id !== 'e9f8c7d6-1234-5678-9abc-def012345678') {
          // For Eko patients, we need to find the correct Eko organization ID from the database
          const { data: ekoOrg } = await window.supabaseClient
            .from('organizations')
            .select('id')
            .ilike('name', '%Eko%')
            .limit(1);
          
          if (ekoOrg && ekoOrg.length > 0) {
            shouldFix = true;
            correctOrgId = ekoOrg[0].id;
          }
        } else if (patient.patient_id && patient.patient_id.startsWith('AXIOM') && patient.organization_id !== userOrgId) {
          shouldFix = true;
          correctOrgId = userOrgId; // Current user's organization
        } else if (patient.patient_id && patient.patient_id.startsWith('MECURE') && patient.organization_id !== '576522cc-e769-4fb4-9487-3d150857d970') {
          // For Mecure patients, find the correct Mecure organization ID
          const { data: mecurOrg } = await window.supabaseClient
            .from('organizations')
            .select('id')
            .ilike('name', '%Mecure%')
            .limit(1);
          
          if (mecurOrg && mecurOrg.length > 0) {
            shouldFix = true;
            correctOrgId = mecurOrg[0].id;
          }
        }

        if (shouldFix && correctOrgId && patient.organization_id !== correctOrgId) {
          udlLog('🔒 SECURITY: Correcting mismatched patient organization assignment');
          
          const { error: updateError } = await window.supabaseClient
            .from('patients')
            .update({ organization_id: correctOrgId })
            .eq('patient_id', patient.patient_id);

          if (updateError) {
            console.error('❌ Error updating patient', patient.patient_id, ':', updateError);
          } else {
            fixedCount++;
            udlLog('✅ Patient organization assignment corrected');
          }
        }
      }

      if (fixedCount > 0) {
        console.warn('🔒 SECURITY: Fixed', fixedCount, 'patients with incorrect organization_id');
      }
      
    } catch (error) {
      console.error('❌ Error during database cleanup:', error);
    }
  }

  // SAFE: Force sync with Supabase - clears stale localStorage data and forces fresh Supabase load
  // This is safe because it only clears organization-specific data keys, preserves user session
  window.forceSyncWithSupabase = async function(options = {}) {
    const {
      clearStaleLocalStorage = true,  // Clear stale localStorage data before syncing
      showProgress = true,             // Show progress notifications
      preserveUserSession = true        // Always preserve user session (default true)
    } = options;

  udlLog('🔄 FORCE SYNC: Starting Supabase sync...');
  if (showProgress) {
    udlLog('📋 Options:', { clearStaleLocalStorage, preserveUserSession });
  }

    try {
      // STEP 1: Preserve critical session data
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      
      if (!user || !user.username) {
        console.warn('⚠️ No user session found - cannot sync safely');
        return { success: false, error: 'No user session found' };
      }

      // STEP 2: Clear stale organization-specific data (if requested)
      if (clearStaleLocalStorage) {
        udlLog('🗑️ Clearing stale localStorage data...');
        
        // Get organization-specific data keys
        const orgPrefix = user.org ? `${user.org}_` : '';
        const dataKeys = [
          `${orgPrefix}patients`,
          `${orgPrefix}appointments`,
          `${orgPrefix}_billing_invoices`,
          `${orgPrefix}_billing_payments`,
          'patients',  // Legacy key (if exists)
          'appointments'  // Legacy key (if exists)
        ];

        // Only clear if Supabase is available (safety check)
        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
          // Remove stale data keys
          dataKeys.forEach(key => {
            if (localStorage.getItem(key)) {
              udlLog(`🗑️ Clearing stale data: ${key}`);
              localStorage.removeItem(key);
            }
          });
        } else {
          console.warn('⚠️ Supabase not available - skipping localStorage clear for safety');
        }
      }

      // STEP 3: Clear in-memory cache
      clearDataCache();
      udlLog('🗑️ Cleared in-memory cache');

      // STEP 4: Force fresh load from Supabase
      udlLog('🔄 Loading fresh data from Supabase...');
      const patients = await loadPatientsWithSupabasePriority(true); // Force refresh
      const appointments = await loadAppointmentsWithSupabasePriority(true); // Force refresh

      // Also sync INVOICES and PAYMENTS (critical for billing pages)
      let invoicesCount = 0;
      let paymentsCount = 0;
      
      try {
        const orgId = await getOrganizationId();
        if (orgId) {
          // Sync invoices - try both 'invoices' and 'billing_invoices' tables
          let invoices = [];
          let invoicesError = null;
          
          // Try 'invoices' table first
          const invoicesResult = await window.supabaseClient
            .from('invoices')
            .select('*')
            .eq('organization_id', orgId);
          invoices = invoicesResult.data;
          invoicesError = invoicesResult.error;
          
          // If 'invoices' table doesn't exist or is empty, try 'billing_invoices'
          if (invoicesError || !invoices || invoices.length === 0) {
            const billingInvoicesResult = await window.supabaseClient
              .from('billing_invoices')
              .select('*')
              .eq('organization_id', orgId);
            if (billingInvoicesResult.data && billingInvoicesResult.data.length > 0) {
              invoices = billingInvoicesResult.data;
              invoicesError = null;
            }
          }
            
          // Define billingKey outside the if block so it's available in else block
          const billingKey = `${user.org}_billing_invoices`;
          
          if (!invoicesError && invoices && invoices.length > 0) {
            const convertedInvoices = invoices.map(si => {
              // Handle both table formats: 'invoices' and 'billing_invoices'
              const invoiceId = si.invoice_id || si.id;
              const currency = si.currency || (user.org && user.org.toLowerCase().includes('mecure') ? 'NGN' : 'CAD');
              
              return {
                id: invoiceId,
                invoiceNumber: si.invoice_number,
                patientId: si.patient_id,
                patientName: si.patient_name || 'Unknown Patient',
                date: si.invoice_date,
                dueDate: si.due_date,
                services: Array.isArray(si.services) ? si.services : [],
                subtotal: parseFloat(si.subtotal || 0),
                tax: parseFloat(si.tax || si.tax_amount || 0),
                discount: parseFloat(si.discount || si.discount_amount || 0),
                total: parseFloat(si.total || 0),
                amountPaid: parseFloat(si.amount_paid || 0),
                amountDue: parseFloat(si.amount_due || 0),
                status: si.status || 'pending',
                currency: currency,
                notes: si.notes || '',
                organizationId: si.organization_id
              };
            });
            localStorage.setItem(billingKey, JSON.stringify(convertedInvoices));
            invoicesCount = convertedInvoices.length;
            udlLog(`✅ Synced ${invoicesCount} invoices`);
            udlLog(`📊 Sample invoice currency:`, convertedInvoices[0]?.currency);
          } else {
            udlLog(`⚠️ No invoices found in Supabase (tried both 'invoices' and 'billing_invoices' tables)`);
          }
          
          // Sync payments - try both 'payments' and 'billing_payments' tables
          let payments = [];
          let paymentsError = null;
          
          // Try 'payments' table first
          const paymentsResult = await window.supabaseClient
            .from('payments')
            .select('*')
            .eq('organization_id', orgId);
          payments = paymentsResult.data;
          paymentsError = paymentsResult.error;
          
          // If 'payments' table doesn't exist or is empty, try 'billing_payments'
          if (paymentsError || !payments || payments.length === 0) {
            const billingPaymentsResult = await window.supabaseClient
              .from('billing_payments')
              .select('*')
              .eq('organization_id', orgId);
            if (billingPaymentsResult.data && billingPaymentsResult.data.length > 0) {
              payments = billingPaymentsResult.data;
              paymentsError = null;
            }
          }
            
          if (!paymentsError && payments && payments.length > 0) {
            const billingPaymentsKey = `${user.org}_billing_payments`;
            const convertedPayments = payments.map(sp => {
              // Handle both table formats: 'payments' and 'billing_payments'
              const paymentId = sp.payment_id || sp.id;
              const currency = sp.currency || (user.org && user.org.toLowerCase().includes('mecure') ? 'NGN' : 'CAD');
              
              return {
                id: paymentId,
                invoiceId: sp.invoice_id,
                patientId: sp.patient_id,
                patientName: sp.patient_name || 'Unknown Patient',
                amount: parseFloat(sp.amount || 0),
                paymentMethod: sp.payment_method || 'cash',
                paymentDate: sp.payment_date,
                reference: sp.reference || '',
                notes: sp.notes || '',
                status: sp.status || 'completed',
                currency: currency,
                organizationId: sp.organization_id
              };
            });
            localStorage.setItem(billingPaymentsKey, JSON.stringify(convertedPayments));
            paymentsCount = convertedPayments.length;
            udlLog(`✅ Synced ${paymentsCount} payments`);
          } else {
            udlLog(`⚠️ No payments found in Supabase (tried both 'payments' and 'billing_payments' tables)`);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not sync invoices/payments:', error);
      }

      udlLog('✅ FORCE SYNC COMPLETE:', {
        patients: patients.length,
        appointments: appointments.length,
        invoices: invoicesCount,
        payments: paymentsCount,
        organization: user.org || 'Unknown'
      });

      // STEP 5: Dispatch sync complete event for pages that listen
      window.dispatchEvent(new CustomEvent('supabaseSyncComplete', {
        detail: { patients, appointments, timestamp: Date.now() }
      }));

      return {
        success: true,
        patients: patients.length,
        appointments: appointments.length,
        invoices: invoicesCount,
        payments: paymentsCount,
        organization: user.org
      };

    } catch (error) {
      console.error('❌ FORCE SYNC ERROR:', error);
      
      // Restore user session if it was accidentally cleared (safety net)
      if (preserveUserSession && (!localStorage.getItem("user") || localStorage.getItem("user") === "{}")) {
        console.warn('⚠️ User session lost - attempting to restore from preserved data');
        if (user && user.username) {
          localStorage.setItem("user", JSON.stringify(user));
          udlLog('✅ User session restored');
        }
      }

      return {
        success: false,
        error: error.message
      };
    }
  };

  // Expose functions globally
  window.loadPatientsWithSupabasePriority = loadPatientsWithSupabasePriority;
  window.loadAppointmentsWithSupabasePriority = loadAppointmentsWithSupabasePriority;
  window.getPatientById = getPatientById;
  window.getPatientNameById = getPatientNameById;
  window.clearDataCache = clearDataCache;
  window.cleanupDatabaseLeakage = cleanupDatabaseLeakage;

  // Mobile compatibility: Force sync with desktop data (now uses forceSyncWithSupabase)
  window.forceMobileDataSync = async function() {
    udlLog('🔄 Forcing mobile data sync (using forceSyncWithSupabase)...');
    return await window.forceSyncWithSupabase({
      clearStaleLocalStorage: true,
      showProgress: true
    });
  };

  // Auto-sync organization addresses on page load
  async function syncOrgAddressesOnLoad() {
    try {
      if (typeof window.syncOrganizationAddresses === 'function') {
        await window.syncOrganizationAddresses();
      }
    } catch (error) {
      udlLog('⚠️ Organization address sync error:', error.message);
    }
  }
  
  // Auto-sync on page load (non-blocking) - ONLY if user is logged in AND not on login page
  window.addEventListener('load', async function() {
    // Check if we're on login page - skip sync entirely
    if (window.location.pathname.includes('login') || window.location.pathname.includes('index')) {
      udlLog('📋 Login page detected - skipping auto-sync');
      return;
    }
    
    // Check if user is logged in before attempting sync
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user || !user.username) {
      udlLog('📋 No user logged in - skipping auto-sync');
      return;
    }
    
    // Sync organization addresses first (quick operation)
    syncOrgAddressesOnLoad();
    
    // Check if user is platform admin - skip auto-sync for platform admin (no org context needed)
    const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin") || "null");
    const isPlatformAdmin = platformAdmin !== null || 
                           user.username === 'platform_admin' || 
                           user.role === 'Platform Admin' ||
                           user.role === 'PlatformOwner' ||
                           (user.email && user.email === 'admin@mediforge.com');
    
    if (isPlatformAdmin) {
      // Platform admin pages don't need org-scoped data sync - skip silently
      return;
    }
    
    // Check for forced sync via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const forceSyncParam = urlParams.get('forcesync') === '1' || urlParams.get('forcesync') === 'true';
    const clearStaleParam = urlParams.get('clearstale') === '1' || urlParams.get('clearstale') === 'true';
    
    if (forceSyncParam) {
      udlLog('🔄 FORCE SYNC DETECTED via URL parameter - performing full sync...');
      try {
        await window.forceSyncWithSupabase({
          clearStaleLocalStorage: clearStaleParam || true,  // Clear stale data if param set or default
          showProgress: true
        });
        // Remove the URL parameter after sync to prevent repeated syncing
        if (window.history && window.history.replaceState) {
          urlParams.delete('forcesync');
          urlParams.delete('clearstale');
          const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
          window.history.replaceState({}, '', newUrl);
        }
      } catch (error) {
        console.error('❌ Force sync failed:', error);
      }
      return; // Exit early after force sync
    }
    
    // Check if this is a public page (should not run data sync)
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = ['index.html', 'login.html', 'register.html', 'about-us.html', 'key-features.html'];
    const isPublicPage = publicPages.includes(currentPage.toLowerCase());
    
    // Skip data sync on public pages (user check already done above at line 1239-1243)
    if (isPublicPage) {
      udlLog('⏭️ Skipping data sync - public page detected');
      return;
    }
    
    udlLog('🔄 Auto-syncing data on page load...');
    try {
      // CRITICAL SECURITY: Clean up database leakage first
      await cleanupDatabaseLeakage();
      
      // Load data in background (non-blocking)
      await Promise.all([
        loadPatientsWithSupabasePriority(),
        loadAppointmentsWithSupabasePriority()
      ]);
      
      // Also sync invoices and payments on page load (for billing pages)
      try {
        const orgId = await getOrganizationId();
        if (orgId) {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          
          // CRITICAL: Clear stale billing data from localStorage BEFORE syncing
      // This ensures production always gets fresh data, even if old billing.js loaded first
      const billingInvoicesKey = `${user.org}_billing_invoices`;
      const billingPaymentsKey = `${user.org}_billing_payments`;
      localStorage.removeItem(billingInvoicesKey);
      localStorage.removeItem(billingPaymentsKey);
      udlLog('🧹 Cleared stale billing data from localStorage - will load fresh from Supabase');
      
          // Set default currency (skip organizations query to avoid 400 errors)
          // Use fallback logic based on organization name
          if (user.org && user.org.toLowerCase().includes('mecure')) {
            const currencyKey = `${user.org}_billing_default_currency`;
            localStorage.setItem(currencyKey, 'NGN');
            udlLog(`✅ Set default currency to NGN for Mecure Clinics`);
          }
          
          // Sync invoices - try both 'invoices' and 'billing_invoices' tables
          let invoices = [];
          let invoicesError = null;
          
          // Try 'invoices' table first
          const invoicesResult = await window.supabaseClient
            .from('invoices')
            .select('*')
            .eq('organization_id', orgId);
          invoices = invoicesResult.data;
          invoicesError = invoicesResult.error;
          
          // If 'invoices' table doesn't exist or is empty, try 'billing_invoices'
          if (invoicesError || !invoices || invoices.length === 0) {
            const billingInvoicesResult = await window.supabaseClient
              .from('billing_invoices')
              .select('*')
              .eq('organization_id', orgId);
            if (billingInvoicesResult.data && billingInvoicesResult.data.length > 0) {
              invoices = billingInvoicesResult.data;
              invoicesError = null;
            }
          }
            
          // Define billingKey outside the if block so it's available in else block
          const billingKey = `${user.org}_billing_invoices`;
          
          if (!invoicesError && invoices && invoices.length > 0) {
            const convertedInvoices = invoices.map(si => {
              // Handle both table formats: 'invoices' and 'billing_invoices'
              const invoiceId = si.invoice_id || si.id;
              const invoiceNumber = si.invoice_number;
              const invoiceDate = si.invoice_date;
              const dueDate = si.due_date;
              // Get currency from invoice or default to NGN for Mecure Clinics
              const currency = si.currency || (user.org && user.org.toLowerCase().includes('mecure') ? 'NGN' : 'CAD');
              
              return {
                id: invoiceId,
                invoiceNumber: invoiceNumber,
                patientId: si.patient_id,
                patientName: si.patient_name || 'Unknown Patient',
                date: invoiceDate,
                dueDate: dueDate,
                services: Array.isArray(si.services) ? si.services : [],
                subtotal: parseFloat(si.subtotal || 0),
                tax: parseFloat(si.tax || si.tax_amount || 0),
                discount: parseFloat(si.discount || si.discount_amount || 0),
                total: parseFloat(si.total || 0),
                amountPaid: parseFloat(si.amount_paid || 0),
                amountDue: parseFloat(si.amount_due || 0),
                status: si.status || 'pending',
                currency: currency,
                notes: si.notes || '',
                organizationId: si.organization_id
              };
            });
            localStorage.setItem(billingKey, JSON.stringify(convertedInvoices));
            udlLog(`✅ Auto-synced ${convertedInvoices.length} invoices`);
            udlLog(`📊 Sample invoice ID: ${convertedInvoices[0]?.id || 'n/a'}`);
          } else {
            // No invoices in Supabase - clear stale localStorage data
            localStorage.setItem(billingKey, JSON.stringify([]));
            if (invoicesError) {
              console.warn(`⚠️ Error loading invoices from Supabase:`, invoicesError);
            } else {
              udlLog(`⚠️ No invoices found in Supabase for org ${orgId} - cleared stale localStorage data`);
            }
          }
          
          // Sync payments - try both 'payments' and 'billing_payments' tables
          let payments = [];
          let paymentsError = null;
          
          // Try 'payments' table first
          const paymentsResult = await window.supabaseClient
            .from('payments')
            .select('*')
            .eq('organization_id', orgId);
          payments = paymentsResult.data;
          paymentsError = paymentsResult.error;
          
          // If 'payments' table doesn't exist or is empty, try 'billing_payments'
          if (paymentsError || !payments || payments.length === 0) {
            const billingPaymentsResult = await window.supabaseClient
              .from('billing_payments')
              .select('*')
              .eq('organization_id', orgId);
            if (billingPaymentsResult.data && billingPaymentsResult.data.length > 0) {
              payments = billingPaymentsResult.data;
              paymentsError = null;
            }
          }
            
          if (!paymentsError && payments && payments.length > 0) {
            const billingPaymentsKey = `${user.org}_billing_payments`;
            const convertedPayments = payments.map(sp => ({
              id: sp.payment_id,
              invoiceId: sp.invoice_id,
              patientId: sp.patient_id,
              patientName: sp.patient_name || 'Unknown Patient',
              amount: parseFloat(sp.amount) || 0,
              paymentMethod: sp.payment_method || 'cash',
              paymentDate: sp.payment_date,
              reference: sp.reference || '',
              notes: sp.notes || '',
              status: sp.status || 'completed',
              currency: sp.currency || 'CAD',
              organizationId: sp.organization_id
            }));
            localStorage.setItem(billingPaymentsKey, JSON.stringify(convertedPayments));
            udlLog(`✅ Auto-synced ${convertedPayments.length} payments`);
          } else {
            // No payments in Supabase - clear stale localStorage data
            localStorage.setItem(billingPaymentsKey, JSON.stringify([]));
            if (paymentsError) {
              console.warn(`⚠️ Error loading payments from Supabase:`, paymentsError);
            } else {
              udlLog(`⚠️ No payments found in Supabase for org ${orgId} - cleared stale localStorage data`);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Auto-sync invoices/payments failed:', error);
      }
      
      udlLog('✅ Auto-sync completed successfully');
    } catch (error) {
      console.warn('⚠️ Auto-sync failed, using localStorage fallback:', error);
    }
  });

  udlLog('📡 Universal data loader initialized - Supabase priority enabled with auto-sync');

})();
