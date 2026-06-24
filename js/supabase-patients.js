// Purpose: Supabase-based patient management system to replace localStorage
// Version: 1.0

// Initialize Supabase client
const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');

let supabase = null;

// Initialize Supabase client
function initSupabase() {
  if (!supabase && typeof window.supabase !== 'undefined') {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ [SUPABASE-PATIENTS] Client initialized');
      return true;
    } catch (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error initializing client:', error);
      return false;
    }
  }
  return supabase !== null;
}

/** Prefer the logged-in session client (RLS); anon fallback for rare tooling-only loads. */
function getActiveSupabaseClient() {
  if (typeof window !== 'undefined' && window.supabaseClient) {
    return window.supabaseClient;
  }
  return initSupabase() ? supabase : null;
}

// ===== PATIENT MANAGEMENT =====

// Get all patients for current organization
window.getSupabasePatients = async function() {
  console.log('👥 [SUPABASE-PATIENTS] Getting patients for current organization');
  
  if (!getActiveSupabaseClient()) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  const db = getActiveSupabaseClient();
  
  try {
    const orgId = await getCurrentUserOrganizationId();
    if (!orgId) {
      return { success: false, error: 'No organization ID found' };
    }
    
    const { data, error } = await db
      .from('patients')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error fetching patients:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ [SUPABASE-PATIENTS] Found ${data.length} patients`);
    return { success: true, patients: data };
    
  } catch (e) {
    console.error('❌ [SUPABASE-PATIENTS] Exception fetching patients:', e.message);
    return { success: false, error: e.message };
  }
};

// Create new patient
window.createSupabasePatient = async function(patientData) {
  console.log('👥 [SUPABASE-PATIENTS] Creating new patient:', patientData.firstName, patientData.lastName);
  
  const db = getActiveSupabaseClient();
  if (!db) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const orgId = await getCurrentUserOrganizationId();
    if (!orgId) {
      return { success: false, error: 'No organization ID found' };
    }
    
    // Use custom patient ID when provided (e.g. Existing Old Patient or manual numbering)
    let patientId;
    if (patientData.customPatientId) {
      // Use custom patient ID if provided
      patientId = patientData.customPatientId.trim();
      
      // Validate uniqueness - check patient_id column (legacy ID), not id (UUID)
      const { data: existing, error: checkError } = await db
        .from('patients')
        .select('patient_id')
        .eq('organization_id', orgId)
        .eq('patient_id', patientId)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        return { success: false, error: 'Error checking patient ID uniqueness: ' + checkError.message };
      }
      
      if (existing) {
        return { success: false, error: `Patient number "${patientId}" already exists. Please choose a different number.` };
      }
    } else {
      // Auto-generate patient ID
      patientId = await generateSupabasePatientId(orgId);
    }
    
    // CRITICAL FIX: Set patient_id (legacy ID like MEC0016), NOT id (UUID)
    // Supabase will auto-generate UUID for id field
    const patientRecord = {
      ...patientData,
      patient_id: patientId,  // Legacy ID (MEC0016 format)
      // DO NOT set id - let Supabase auto-generate UUID
      organization_id: orgId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Remove customPatientId from record (it's not a database field)
    delete patientRecord.customPatientId;
    
    const { data, error } = await db
      .from('patients')
      .insert([patientRecord])
      .select()
      .single();
    
    if (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error creating patient:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [SUPABASE-PATIENTS] Patient created:', data.id);
    return { success: true, patient: data };
    
  } catch (e) {
    console.error('❌ [SUPABASE-PATIENTS] Exception creating patient:', e.message);
    return { success: false, error: e.message };
  }
};

// Update patient
window.updateSupabasePatient = async function(patientId, updates) {
  console.log('👥 [SUPABASE-PATIENTS] Updating patient:', patientId);
  
  const db = getActiveSupabaseClient();
  if (!db) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const orgId = await getCurrentUserOrganizationId();
    if (!orgId) {
      return { success: false, error: 'No organization ID found' };
    }
    
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await db
      .from('patients')
      .update(updateData)
      .eq('id', patientId)
      .eq('organization_id', orgId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error updating patient:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [SUPABASE-PATIENTS] Patient updated:', data.id);
    return { success: true, patient: data };
    
  } catch (e) {
    console.error('❌ [SUPABASE-PATIENTS] Exception updating patient:', e.message);
    return { success: false, error: e.message };
  }
};

// Delete patient
window.deleteSupabasePatient = async function(patientId) {
  console.log('👥 [SUPABASE-PATIENTS] Deleting patient:', patientId);
  
  const db = getActiveSupabaseClient();
  if (!db) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const orgId = await getCurrentUserOrganizationId();
    if (!orgId) {
      return { success: false, error: 'No organization ID found' };
    }
    
    const { error } = await db
      .from('patients')
      .delete()
      .eq('id', patientId)
      .eq('organization_id', orgId);
    
    if (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error deleting patient:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [SUPABASE-PATIENTS] Patient deleted:', patientId);
    return { success: true };
    
  } catch (e) {
    console.error('❌ [SUPABASE-PATIENTS] Exception deleting patient:', e.message);
    return { success: false, error: e.message };
  }
};

// Get patient by ID
window.getSupabasePatient = async function(patientId) {
  console.log('👥 [SUPABASE-PATIENTS] Getting patient:', patientId);
  
  const db = getActiveSupabaseClient();
  if (!db) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const orgId = await getCurrentUserOrganizationId();
    if (!orgId) {
      return { success: false, error: 'No organization ID found' };
    }
    
    const { data, error } = await db
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('organization_id', orgId)
      .single();
    
    if (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error fetching patient:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [SUPABASE-PATIENTS] Patient found:', data.id);
    return { success: true, patient: data };
    
  } catch (e) {
    console.error('❌ [SUPABASE-PATIENTS] Exception fetching patient:', e.message);
    return { success: false, error: e.message };
  }
};

// ===== PATIENT ID GENERATION =====

/** MFA Staff Clinic: must not fall back to first 3 letters of org name ("MIN"). */
const MFASC_ORGANIZATION_ID = '94534e80-06a8-468f-b8a2-ece3f07697c4';

// Generate sequential patient ID for organization
// EXPORT: Make available globally for use in resolvePatientByIdentifier
window.generateSupabasePatientId = async function(organizationId) {
  console.log('🔢 [SUPABASE-PATIENTS] Generating patient ID for organization:', organizationId);

  try {
    const client = getActiveSupabaseClient();
    if (!client) {
      console.error('❌ [SUPABASE-PATIENTS] No Supabase client');
      return organizationId === MFASC_ORGANIZATION_ID ? 'MFA-SC0001' : 'ORG0001';
    }

    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('name, settings')
      .eq('id', organizationId)
      .single();

    let orgPrefix;
    if (typeof window.mfResolveDefaultPatientIdPrefix === 'function') {
      orgPrefix = window.mfResolveDefaultPatientIdPrefix(organizationId, org, {
        orgFetchFailed: !!(orgError || !org)
      });
    } else if (orgError || !org) {
      console.warn('⚠️ [SUPABASE-PATIENTS] Could not get organization, using default prefix');
      orgPrefix = organizationId === MFASC_ORGANIZATION_ID ? 'MFA-SC' : 'ORG';
    } else if (org.settings && org.settings.patient_id_prefix && typeof org.settings.patient_id_prefix === 'string') {
      orgPrefix = org.settings.patient_id_prefix.trim().toUpperCase();
      console.log('🔢 [SUPABASE-PATIENTS] Using org settings.patient_id_prefix:', orgPrefix);
    } else if (organizationId === MFASC_ORGANIZATION_ID) {
      orgPrefix = 'MFA-SC';
      console.log('🔢 [SUPABASE-PATIENTS] MFASC org with no settings prefix; using MFA-SC');
    } else {
      orgPrefix = (org.name || '').substring(0, 3).toUpperCase();
    }

    const { data: patients, error } = await client
      .from('patients')
      .select('patient_id')
      .eq('organization_id', organizationId)
      .not('patient_id', 'is', null);

    if (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error getting patient IDs:', error.message);
      return typeof window.mfFormatPatientMrn === 'function'
        ? window.mfFormatPatientMrn(orgPrefix, 1)
        : `${orgPrefix}0001`;
    }

    let maxNumber =
      typeof window.mfMaxPatientMrnNumericSuffix === 'function'
        ? window.mfMaxPatientMrnNumericSuffix(patients)
        : 0;
    if (typeof window.mfMaxPatientMrnNumericSuffix !== 'function') {
      const stemPatterns = [
        /^MIN([0-9]{4})$/i,
        /^MFA([0-9]{4})$/i,
        /^MFA-MC([0-9]{4})$/i,
        /^MFA-SC([0-9]{4})$/i
      ];
      (patients || []).forEach((patient) => {
        const pid = patient.patient_id;
        if (!pid) return;
        let n = NaN;
        for (let i = 0; i < stemPatterns.length; i++) {
          const m = pid.trim().match(stemPatterns[i]);
          if (m) {
            n = parseInt(m[1], 10);
            break;
          }
        }
        if (Number.isNaN(n)) {
          const tail = pid.match(/(\d{4})$/);
          if (tail) n = parseInt(tail[1], 10);
        }
        if (!Number.isNaN(n) && n > maxNumber) maxNumber = n;
      });
    }

    const nextNumber = maxNumber + 1;
    const patientId =
      typeof window.mfFormatPatientMrn === 'function'
        ? window.mfFormatPatientMrn(orgPrefix, nextNumber)
        : `${orgPrefix}${nextNumber.toString().padStart(4, '0')}`;

    console.log('✅ [SUPABASE-PATIENTS] Generated patient ID:', patientId);
    return patientId;
  } catch (e) {
    console.error('❌ [SUPABASE-PATIENTS] Exception generating patient ID:', e.message);
    return organizationId === MFASC_ORGANIZATION_ID ? 'MFA-SC0001' : 'ORG0001';
  }
};

// Also export as non-window function for backward compatibility
async function generateSupabasePatientId(organizationId) {
  return await window.generateSupabasePatientId(organizationId);
}

// ===== SEARCH AND FILTER =====

// Search patients
window.searchSupabasePatients = async function(query) {
  console.log('🔍 [SUPABASE-PATIENTS] Searching patients with query:', query);
  
  const db = getActiveSupabaseClient();
  if (!db) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const orgId = await getCurrentUserOrganizationId();
    if (!orgId) {
      return { success: false, error: 'No organization ID found' };
    }
    
    const { data, error } = await db
      .from('patients')
      .select('*')
      .eq('organization_id', orgId)
      .or(`firstName.ilike.%${query}%,lastName.ilike.%${query}%,id.ilike.%${query}%`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [SUPABASE-PATIENTS] Error searching patients:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ [SUPABASE-PATIENTS] Found ${data.length} patients matching query`);
    return { success: true, patients: data };
    
  } catch (e) {
    console.error('❌ [SUPABASE-PATIENTS] Exception searching patients:', e.message);
    return { success: false, error: e.message };
  }
};

// ===== BACKWARD COMPATIBILITY =====

// Legacy function for backward compatibility
window.loadPatients = async function(page = 1, pageSize = 10) {
  console.log('🔄 [SUPABASE-PATIENTS] Legacy loadPatients called');
  
  const result = await getSupabasePatients();
  if (result.success) {
    // Implement pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPatients = result.patients.slice(startIndex, endIndex);
    
    return {
      success: true,
      patients: paginatedPatients,
      total: result.patients.length,
      page: page,
      pageSize: pageSize
    };
  }
  
  return result;
};

// Legacy function for backward compatibility
window.addPatient = async function(patientData) {
  console.log('🔄 [SUPABASE-PATIENTS] Legacy addPatient called');
  return await createSupabasePatient(patientData);
};

// Legacy function for backward compatibility
window.updatePatient = async function(patientId, updates) {
  console.log('🔄 [SUPABASE-PATIENTS] Legacy updatePatient called');
  return await updateSupabasePatient(patientId, updates);
};

// Legacy function for backward compatibility
window.deletePatient = async function(patientId) {
  console.log('🔄 [SUPABASE-PATIENTS] Legacy deletePatient called');
  return await deleteSupabasePatient(patientId);
};

console.log('✅ [SUPABASE-PATIENTS] Patient management system loaded');


