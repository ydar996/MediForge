// Purpose: Manages all patient-related actions using Supabase - MIGRATED FROM localStorage
// Version: 1.0 - Complete Supabase migration

// Supabase Configuration
const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');

let supabase = null;

// Initialize Supabase client
function initSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ [PATIENTS] Supabase client initialized');
    return true;
  }
  console.error('❌ [PATIENTS] Supabase not available');
  return false;
}

// Get current user's organization ID
async function getCurrentOrgId() {
  // CRITICAL: Try multiple sources to get org ID consistently across devices
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  
  // Priority 1: organizationId (most reliable)
  if (user.organizationId && user.organizationId.includes('-')) {
    return user.organizationId;
  }
  
  // Priority 2: organization_id (alternative field name)
  if (user.organization_id && user.organization_id.includes('-')) {
    return user.organization_id;
  }
  
  // Priority 3: org field if it's a UUID
  if (user.org && user.org.includes('-')) {
    return user.org;
  }
  
  // Priority 4: Try to get from Supabase users table (most reliable across devices)
  if (user.auth_user_id || user.username) {
    const supabaseClient = window.supabaseClient || supabase;
    if (!supabaseClient) {
    if (!initSupabase()) return null;
      // Try again after init
      const retryClient = window.supabaseClient || supabase;
      if (!retryClient) return null;
  }
  
  try {
      const client = window.supabaseClient || supabase;
      const query = client
        .from('users')
        .select('organization_id');
      
      if (user.auth_user_id) {
        query.eq('auth_user_id', user.auth_user_id);
      } else if (user.username) {
        query.eq('username', user.username);
      }
      
      const { data: userData, error: userError } = await query.maybeSingle();
      
      if (!userError && userData && userData.organization_id) {
        console.log('✅ [PATIENTS] Got org ID from users table:', userData.organization_id);
        return userData.organization_id;
      }
    } catch (err) {
      console.warn('⚠️ [PATIENTS] Could not get org ID from users table:', err);
    }
  }
  
  // Priority 5: It's a name, need to get UUID from Supabase organizations table
  if (user.org && !user.org.includes('-')) {
    const supabaseClient = window.supabaseClient || supabase;
    if (!supabaseClient) {
      if (!initSupabase()) return null;
      // Try again after init
      const retryClient = window.supabaseClient || supabase;
      if (!retryClient) return null;
    }
    
    try {
      const client = window.supabaseClient || supabase;
      const { data, error } = await client
      .from('organizations')
      .select('id')
      .eq('name', user.org)
        .maybeSingle();
    
      if (!error && data && data.id) {
        console.log('✅ [PATIENTS] Got org ID from organizations table:', data.id);
    return data.id;
      }
  } catch (error) {
    console.error('❌ [PATIENTS] Exception getting organization ID:', error);
  }
  }
  
  console.error('❌ [PATIENTS] Could not determine organization ID');
  return null;
}

// Generate sequential patient ID for current organization (full MRN including prefix)
async function generatePatientId() {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('❌ [PATIENTS] Cannot generate patient ID - no organization');
    return null;
  }

  if (typeof window.generateSupabasePatientId !== 'function') {
    console.error('❌ [PATIENTS] generateSupabasePatientId not loaded');
    return null;
  }

  try {
    return await window.generateSupabasePatientId(orgId);
  } catch (e) {
    console.error('❌ [PATIENTS] generateSupabasePatientId failed:', e);
    return null;
  }
}

// Get all patients for current organization
// CRITICAL: Loads from BOTH Supabase AND localStorage to ensure all patients are visible
async function getAllPatients() {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('❌ [PATIENTS] Cannot get patients - no organization');
    return [];
  }
  
  const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                         typeof getDataKey === 'function' ? getDataKey :
                         (key) => key;
  
  // Step 1: Load from Supabase (primary source)
  let supabasePatients = [];
  const supabaseClient = window.supabaseClient || supabase;
  if (supabaseClient) {
  try {
      const client = window.supabaseClient || supabase;
      const { data, error } = await client
      .from('patients')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
      if (!error && data) {
        supabasePatients = data || [];
        console.log(`✅ [PATIENTS] Loaded ${supabasePatients.length} patients from Supabase`);
      } else if (error) {
        console.warn('⚠️ [PATIENTS] Error fetching from Supabase (will use localStorage):', error.message);
      }
    } catch (error) {
      console.warn('⚠️ [PATIENTS] Exception fetching from Supabase (will use localStorage):', error.message);
    }
  }
  
  // Step 2: Load from localStorage (for patients not yet synced)
  let localPatients = [];
  try {
    const localData = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
    // Filter to only patients for this organization
    localPatients = localData.filter(p => {
      // Check if patient belongs to current org
      if (p.organization_id === orgId) return true;
      // Also check if patient was created by current user (might not have org_id set yet)
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (p.created_by === user.username) return true;
      return false;
    });
    
    // Convert localStorage format to Supabase format for consistency
    localPatients = localPatients.map(p => ({
      id: p.id || p.patient_id,
      patient_id: p.patient_id || p.id,
      first_name: p.firstName || p.first_name,
      last_name: p.lastName || p.last_name,
      middle_name: p.middleName || p.middle_name || '',
      date_of_birth: p.dob || p.date_of_birth,
      gender: p.gender,
      phone: p.phone || '',
      email: p.email || '',
      address_line1: p.addressLine1 || p.address_line1 || '',
      address_line2: p.addressLine2 || p.address_line2 || '',
      city: p.city || '',
      state: p.state || '',
      country: p.country || '',
      emergency_contact_name: p.emergencyContactName || p.emergency_contact_name || '',
      emergency_contact_phone: p.emergencyContactPhone || p.emergency_contact_phone || '',
      emergency_contact_relationship: p.emergencyContactRelationship || p.emergency_contact_relationship || '',
      medical_history: typeof p.medicalHistory === 'string' ? p.medicalHistory : JSON.stringify(p.medicalHistory || []),
      allergies: typeof p.allergies === 'string' ? p.allergies : JSON.stringify(p.allergies || []),
      medications: typeof p.medications === 'string' ? p.medications : JSON.stringify(p.medications || []),
      immunizations: typeof p.immunizations === 'string' ? p.immunizations : JSON.stringify(p.immunizations || []),
      notes: p.notes || '',
      created_at: p.created_at || new Date().toISOString(),
      created_by: p.created_by || 'Unknown',
      organization_id: p.organization_id || orgId,
      _fromLocalStorage: true, // Mark as from localStorage
      _synced: p._synced || false
    }));
    
    if (localPatients.length > 0) {
      console.log(`✅ [PATIENTS] Loaded ${localPatients.length} patients from localStorage`);
    }
  } catch (error) {
    console.warn('⚠️ [PATIENTS] Error loading from localStorage:', error);
  }
  
  // Step 3: Merge results, removing duplicates (prefer Supabase data)
  const patientMap = new Map();
  
  // Add Supabase patients first (these are authoritative)
  supabasePatients.forEach(p => {
    const key = p.patient_id || p.id;
    if (key) {
      patientMap.set(key, p);
    }
  });
  
  // Add localStorage patients only if they don't exist in Supabase
  localPatients.forEach(p => {
    const key = p.patient_id || p.id;
    if (key && !patientMap.has(key)) {
      patientMap.set(key, p);
      console.log(`📱 [PATIENTS] Including unsynced patient from localStorage: ${p.patient_id}`);
    }
  });
  
  const allPatients = Array.from(patientMap.values());
  console.log(`✅ [PATIENTS] Total patients loaded: ${allPatients.length} (${supabasePatients.length} from Supabase, ${localPatients.length} from localStorage, ${allPatients.length - supabasePatients.length} unique from localStorage)`);
  
  // Sort by created_at descending
  allPatients.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });
  
  return allPatients;
}

// Get patient by ID
async function getPatientById(patientId) {
  if (!supabase) {
    if (!initSupabase()) return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();
    
    if (error) {
      console.error('❌ [PATIENTS] Error fetching patient:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ [PATIENTS] Exception fetching patient:', error);
    return null;
  }
}

// Create new patient
async function createPatient(patientData) {
  if (typeof window.MediForgeRegistrationCase !== 'undefined') {
    patientData = window.MediForgeRegistrationCase.normalizePatientRecord({ ...patientData });
  }
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('❌ [PATIENTS] Cannot create patient - no organization');
    return null;
  }
  
  // Use global supabaseClient
  const supabaseClient = window.supabaseClient || supabase;
  if (!supabaseClient) {
    if (!initSupabase()) return null;
    // Try again after init
    const retryClient = window.supabaseClient || supabase;
    if (!retryClient) {
      console.error('❌ [PATIENTS] Supabase client not available');
      return null;
    }
  }
  
  try {
    // Use custom patient ID when provided (e.g. Existing Old Patient or manual numbering)
    let patientId;
    if (patientData.customPatientId) {
      // Use custom patient ID if provided
      patientId = patientData.customPatientId.trim();
      
      // Validate uniqueness (Supabase-first)
      const client = window.supabaseClient || supabase;
      if (client) {
        const { data: existing, error: checkError } = await client
          .from('patients')
          .select('patient_id')
          .eq('organization_id', orgId)
          .eq('patient_id', patientId)
          .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.error('❌ [PATIENTS] Error checking patient ID uniqueness:', checkError);
          return null;
        }
        
        if (existing) {
          console.error(`❌ [PATIENTS] Patient ID "${patientId}" already exists`);
          return null;
        }
      } else {
        // Fallback: Check localStorage
        const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                               typeof getDataKey === 'function' ? getDataKey :
                               (key) => key; // Fallback if not available
        const patients = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
        const exists = patients.some(p => p.id === patientId || p.patient_id === patientId);
        if (exists) {
          console.error(`❌ [PATIENTS] Patient ID "${patientId}" already exists in localStorage`);
          return null;
        }
      }
    } else {
      // Auto-generate patient ID
      patientId = await generatePatientId();
      if (!patientId) {
        console.error('❌ [PATIENTS] Cannot generate patient ID');
        return null;
      }
    }
    
    const patient = {
      patient_id: patientId,
      organization_id: orgId,
      first_name: patientData.firstName,
      last_name: patientData.lastName,
      middle_name: patientData.middleName || '',
      date_of_birth: patientData.dateOfBirth,
      gender: patientData.gender,
      phone: patientData.phone || '',
      email: patientData.email || '',
      address_line1: patientData.addressLine1 || '',
      address_line2: patientData.addressLine2 || '',
      city: patientData.city || '',
      state: patientData.state || '',
      country: patientData.country || '',
      emergency_contact_name: patientData.emergencyContactName || '',
      emergency_contact_phone: patientData.emergencyContactPhone || '',
      emergency_contact_relationship: patientData.emergencyContactRelationship || '',
      medical_history: JSON.stringify(patientData.medicalHistory || []),
      allergies: JSON.stringify(patientData.allergies || []),
      medications: JSON.stringify(patientData.medications || []),
      immunizations: JSON.stringify(patientData.immunizations || []),
      notes: patientData.notes || '',
      created_by: getCurrentUsername(),
      created_at: new Date().toISOString()
    };
    
    // HYBRID ARCHITECTURE: Supabase-first, localStorage fallback
    // Always try Supabase first, fallback to localStorage if Supabase fails
    const supabaseClient = window.supabaseClient || supabase;
    let data = null;
    let error = null;
    
    // STEP 1: Try Supabase FIRST (hybrid architecture principle)
    if (supabaseClient && orgId) {
      try {
        console.log('🔍 [PATIENTS] Attempting to save patient to Supabase (Supabase-first):', {
          patient_id: patient.patient_id,
          organization_id: orgId,
          first_name: patient.first_name,
          last_name: patient.last_name
        });
        
        const result = await supabaseClient
      .from('patients')
      .insert([patient])
      .select()
      .single();
    
        data = result.data;
        error = result.error;
        
    if (error) {
          console.error('❌ [PATIENTS] Error creating patient in Supabase:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          // Fall through to localStorage fallback
        } else {
          console.log('✅ [PATIENTS] Patient successfully created in Supabase:', data.patient_id);
        }
      } catch (supabaseError) {
        console.error('❌ [PATIENTS] Exception creating patient in Supabase:', supabaseError);
        error = supabaseError;
      }
    } else {
      if (!supabaseClient) {
        console.warn('⚠️ [PATIENTS] Supabase client not available, will use localStorage fallback');
        error = new Error('Supabase client not available');
      }
      if (!orgId) {
        console.error('❌ [PATIENTS] Cannot create patient - organization ID is missing');
        error = new Error('Organization ID not found. Please ensure you are logged in.');
      }
    }
    
    // STEP 2: If Supabase failed, fallback to localStorage
    const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                           typeof getDataKey === 'function' ? getDataKey :
                           (key) => key; // Fallback if not available
    
    if (error || !data) {
      console.warn('⚠️ [PATIENTS] Supabase save failed, using localStorage fallback');
      
      // Save to localStorage as fallback
      const patients = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
      const localPatient = {
        id: patient.patient_id,
        patient_id: patient.patient_id,
        firstName: patient.first_name,
        lastName: patient.last_name,
        middleName: patient.middle_name || '',
        dob: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone || '',
        email: patient.email || '',
        addressLine1: patient.address_line1 || '',
        addressLine2: patient.address_line2 || '',
        city: patient.city || '',
        state: patient.state || '',
        country: patient.country || '',
        emergencyContactName: patient.emergency_contact_name || '',
        emergencyContactPhone: patient.emergency_contact_phone || '',
        emergencyContactRelationship: patient.emergency_contact_relationship || '',
        medicalHistory: JSON.parse(patient.medical_history || '[]'),
        allergies: JSON.parse(patient.allergies || '[]'),
        medications: JSON.parse(patient.medications || '[]'),
        immunizations: JSON.parse(patient.immunizations || '[]'),
        notes: patient.notes || '',
        created_at: patient.created_at,
        created_by: patient.created_by,
        organization_id: patient.organization_id,
        _fromLocalStorage: true, // Mark as from localStorage
        _synced: false // Mark as not yet synced
      };
      
      patients.push(localPatient);
      localStorage.setItem(getDataKeyFunc("patients"), JSON.stringify(patients));
      
      // Queue for sync when connection is available
      if (typeof window.queueForSync === 'function') {
        try {
          await window.queueForSync('patients', localPatient, 'create');
          console.log('✅ [PATIENTS] Patient queued for sync');
        } catch (queueError) {
          console.warn('⚠️ [PATIENTS] Could not queue for sync:', queueError);
        }
      }
      
      // Try immediate background sync (non-blocking)
      if (supabaseClient && orgId) {
        (async () => {
          try {
            console.log('🔄 [PATIENTS] Attempting immediate background sync...');
            const syncResult = await supabaseClient
              .from('patients')
              .insert([patient])
              .select()
              .single();
            
            if (syncResult.data && !syncResult.error) {
              console.log('✅ [PATIENTS] Background sync successful!');
              // Update localStorage with Supabase data
              const updatedPatients = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
              const patientIndex = updatedPatients.findIndex(p => p.id === patient.patient_id || p.patient_id === patient.patient_id);
              if (patientIndex >= 0) {
                updatedPatients[patientIndex]._synced = true;
                updatedPatients[patientIndex]._fromLocalStorage = false;
                localStorage.setItem(getDataKeyFunc("patients"), JSON.stringify(updatedPatients));
              }
            }
          } catch (syncError) {
            console.warn('⚠️ [PATIENTS] Background sync failed (will retry later):', syncError);
          }
        })();
      }
      
      // Return local patient for fallback
      return {
        patient_id: patient.patient_id,
        id: patient.patient_id,
        ...localPatient
      };
    }
    
    // STEP 3: Success - patient saved to Supabase, also cache to localStorage
    console.log('✅ [PATIENTS] Patient created in Supabase:', data.patient_id);
    
    // Also save to localStorage as cache (Supabase is authoritative)
    try {
      const patients = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
      const localPatient = {
        id: data.patient_id,
        patient_id: data.patient_id,
        firstName: data.first_name,
        lastName: data.last_name,
        middleName: data.middle_name || '',
        dob: data.date_of_birth,
        gender: data.gender,
        phone: data.phone || '',
        email: data.email || '',
        addressLine1: data.address_line1 || '',
        addressLine2: data.address_line2 || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        emergencyContactName: data.emergency_contact_name || '',
        emergencyContactPhone: data.emergency_contact_phone || '',
        emergencyContactRelationship: data.emergency_contact_relationship || '',
        medicalHistory: JSON.parse(data.medical_history || '[]'),
        allergies: JSON.parse(data.allergies || '[]'),
        medications: JSON.parse(data.medications || '[]'),
        immunizations: JSON.parse(data.immunizations || '[]'),
        notes: data.notes || '',
        created_at: data.created_at,
        created_by: data.created_by,
        organization_id: data.organization_id,
        _synced: true,
        _fromLocalStorage: false
      };
      
      // Check if patient already exists in localStorage (avoid duplicates)
      const existingIndex = patients.findIndex(p => p.id === data.patient_id || p.patient_id === data.patient_id);
      if (existingIndex >= 0) {
        patients[existingIndex] = localPatient;
      } else {
        patients.push(localPatient);
      }
      
      localStorage.setItem(getDataKeyFunc("patients"), JSON.stringify(patients));
      console.log('✅ [PATIENTS] Patient also cached to localStorage');
    } catch (cacheError) {
      console.warn('⚠️ [PATIENTS] Could not cache patient to localStorage (non-critical):', cacheError);
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_created', {
        patientId: data.patient_id,
        patientName: `${data.first_name} ${data.last_name}`,
        patientIdNumber: data.patient_id
      });
    }
    
    console.log('✅ [PATIENTS] Patient created:', data.patient_id);
    return data;
  } catch (error) {
    console.error('❌ [PATIENTS] Exception creating patient:', error);
    return null;
  }
}

// Update patient
async function updatePatient(patientId, updates) {
  if (!supabase) {
    if (!initSupabase()) return null;
  }
  
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: getCurrentUsername()
    };
    
    const { data, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', patientId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [PATIENTS] Error updating patient:', error);
      return null;
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_updated', {
        patientId: data.id,
        patientName: `${data.first_name} ${data.last_name}`,
        patientIdNumber: data.patient_id
      });
    }
    
    console.log('✅ [PATIENTS] Patient updated:', data.patient_id);
    return data;
  } catch (error) {
    console.error('❌ [PATIENTS] Exception updating patient:', error);
    return null;
  }
}

// Delete patient
async function deletePatient(patientId) {
  if (!supabase) {
    if (!initSupabase()) return false;
  }
  
  try {
    // Get patient info for audit log
    const patient = await getPatientById(patientId);
    
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', patientId);
    
    if (error) {
      console.error('❌ [PATIENTS] Error deleting patient:', error);
      return false;
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function' && patient) {
      logAuditEvent('patient_deleted', {
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        patientIdNumber: patient.patient_id
      });
    }
    
    console.log('✅ [PATIENTS] Patient deleted:', patientId);
    return true;
  } catch (error) {
    console.error('❌ [PATIENTS] Exception deleting patient:', error);
    return false;
  }
}

// Search patients
// CRITICAL: Searches BOTH Supabase AND localStorage to find all patients
async function searchPatients(query) {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('❌ [PATIENTS] Cannot search patients - no organization');
    return [];
  }
  
  const getDataKeyFunc = typeof window.getDataKey === 'function' ? window.getDataKey : 
                         typeof getDataKey === 'function' ? getDataKey :
                         (key) => key;
  
  const lowerQuery = query.toLowerCase();
  const results = [];
  
  // Step 1: Search Supabase
  const supabaseClient = window.supabaseClient || supabase;
  if (supabaseClient) {
    try {
      const client = window.supabaseClient || supabase;
      const { data, error } = await client
      .from('patients')
      .select('*')
      .eq('organization_id', orgId)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,patient_id.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('created_at', { ascending: false });
    
      if (!error && data) {
        results.push(...(data || []));
      }
    } catch (error) {
      console.warn('⚠️ [PATIENTS] Error searching Supabase:', error);
    }
  }
  
  // Step 2: Search localStorage
  try {
    const localData = JSON.parse(localStorage.getItem(getDataKeyFunc("patients")) || "[]");
    const localMatches = localData.filter(p => {
      if (p.organization_id !== orgId) return false;
      const fullName = `${p.firstName || p.first_name || ''} ${p.lastName || p.last_name || ''}`.toLowerCase();
      const patientId = (p.patient_id || p.id || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      return fullName.includes(lowerQuery) || 
             patientId.includes(lowerQuery) || 
             phone.includes(lowerQuery);
    });
    
    // Convert to Supabase format
    localMatches.forEach(p => {
      // Check if already in results (from Supabase)
      const exists = results.some(r => (r.patient_id || r.id) === (p.patient_id || p.id));
      if (!exists) {
        results.push({
          id: p.id || p.patient_id,
          patient_id: p.patient_id || p.id,
          first_name: p.firstName || p.first_name,
          last_name: p.lastName || p.last_name,
          middle_name: p.middleName || p.middle_name || '',
          date_of_birth: p.dob || p.date_of_birth,
          gender: p.gender,
          phone: p.phone || '',
          email: p.email || '',
          organization_id: p.organization_id || orgId,
          _fromLocalStorage: true
        });
      }
    });
  } catch (error) {
    console.warn('⚠️ [PATIENTS] Error searching localStorage:', error);
  }
  
  return results;
}

// Get current username
function getCurrentUsername() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.username || 'Unknown';
}

// Global variables for pagination and sorting
let currentPatientPage = 1;
const PAGE_SIZE = 10;
let currentSort = { field: 'name', dir: 1 };

// Load and display patients in the list with pagination
async function loadPatients(page = 1) {
  console.log('🔍 [PATIENTS] Loading patients, page:', page);
  currentPatientPage = page;
  
  try {
    const patients = await getAllPatients();
    console.log('📊 [PATIENTS] Loaded patients:', patients.length);
    
    // Sort patients
    patients.sort((a, b) => {
      let valA, valB;
      if (currentSort.field === 'name') {
        valA = `${a.first_name} ${a.last_name}`.toLowerCase();
        valB = `${b.first_name} ${b.last_name}`.toLowerCase();
      } else if (currentSort.field === 'dob') {
        valA = new Date(a.date_of_birth);
        valB = new Date(b.date_of_birth);
      }
      return (valA > valB ? 1 : -1) * currentSort.dir;
    });

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pagePatients = patients.slice(start, end);
    
    displayPatients(pagePatients);
    updatePagination(patients.length, page);
    
  } catch (error) {
    console.error('❌ [PATIENTS] Error loading patients:', error);
    displayPatients([]);
  }
}

// Display patients in the table
function displayPatients(patients) {
  const tbody = document.getElementById('patient-list');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  patients.forEach(patient => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${patient.first_name} ${patient.last_name}</td>
      <td>${patient.date_of_birth || 'N/A'}</td>
      <td>${patient.gender || 'N/A'}</td>
      <td>
        <button onclick="viewPatient('${patient.id}')" style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-right: 5px;">View</button>
        <button onclick="editPatient('${patient.id}')" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-right: 5px;">Edit</button>
        <button onclick="deletePatientConfirm('${patient.id}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Update pagination controls
function updatePagination(totalPatients, currentPage) {
  const totalPages = Math.ceil(totalPatients / PAGE_SIZE);
  const controls = document.getElementById('pagination-controls');
  if (!controls) return;
  
  let html = '<div style="text-align: center; margin: 20px 0;">';
  
  if (currentPage > 1) {
    html += `<button onclick="loadPatients(${currentPage - 1})" style="margin: 0 5px; padding: 8px 12px; border: 1px solid #ddd; background: white; cursor: pointer;">← Previous</button>`;
  }
  
  html += `<span style="margin: 0 15px; padding: 8px 12px;">Page ${currentPage} of ${totalPages}</span>`;
  
  if (currentPage < totalPages) {
    html += `<button onclick="loadPatients(${currentPage + 1})" style="margin: 0 5px; padding: 8px 12px; border: 1px solid #ddd; background: white; cursor: pointer;">Next →</button>`;
  }
  
  html += '</div>';
  controls.innerHTML = html;
}

// Sort patients
function sortPatients(field) {
  if (currentSort.field === field) {
    currentSort.dir *= -1;
  } else {
    currentSort.field = field;
    currentSort.dir = 1;
  }
  loadPatients(currentPatientPage);
}

// Search patients
async function searchPatientsHandler() {
  const query = document.getElementById('search').value.trim();
  if (!query) {
    loadPatients(1);
    return;
  }
  
  try {
    const patients = await searchPatients(query);
    displayPatients(patients);
    
    // Hide pagination for search results
    const controls = document.getElementById('pagination-controls');
    if (controls) {
      controls.innerHTML = `<div style="text-align: center; margin: 20px 0; color: #666;">Found ${patients.length} patients matching "${query}"</div>`;
    }
  } catch (error) {
    console.error('❌ [PATIENTS] Error searching patients:', error);
  }
}

// View patient details
async function viewPatient(patientId) {
  // CRITICAL FIX: Use centralized normalizer to ensure legacy ID for URLs
  if (typeof window.normalizePatientIdForUrl === 'function') {
    try {
      const legacyId = await window.normalizePatientIdForUrl(patientId);
      window.location.href = `patient-details?id=${legacyId}`;
      return;
    } catch (error) {
      console.warn('⚠️ viewPatient: Error normalizing patient ID, using fallback:', error);
    }
  }
  
  // Fallback: Manual normalization if normalizer not available
  if (patientId && patientId.includes('-') && patientId.length === 36) {
    // It's a UUID, resolve to legacy ID
    if (typeof window.resolvePatientByIdentifier === 'function') {
      try {
        const patient = await window.resolvePatientByIdentifier(patientId);
        if (patient) {
          const legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id);
          if (legacyId && !legacyId.includes('-')) {
            patientId = legacyId; // Use legacy ID for URL
          }
        }
      } catch (error) {
        console.warn('Could not resolve UUID to legacy ID:', error);
      }
    }
  }
  window.location.href = `patient-details?id=${patientId}`;
}

// Edit patient
async function editPatient(patientId) {
  // CRITICAL FIX: Use centralized normalizer to ensure legacy ID for URLs
  if (typeof window.normalizePatientIdForUrl === 'function') {
    try {
      const legacyId = await window.normalizePatientIdForUrl(patientId);
      window.location.href = `edit-patient?id=${legacyId}`;
      return;
    } catch (error) {
      console.warn('⚠️ editPatient: Error normalizing patient ID, using fallback:', error);
    }
  }
  window.location.href = `edit-patient?id=${patientId}`;
}

// Delete patient confirmation
async function deletePatientConfirm(patientId) {
  if (!confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
    return;
  }
  
  try {
    const success = await deletePatient(patientId);
    if (success) {
      alert('Patient deleted successfully');
      loadPatients(currentPatientPage);
    } else {
      alert('Failed to delete patient');
    }
  } catch (error) {
    console.error('❌ [PATIENTS] Error deleting patient:', error);
    alert('Error deleting patient');
  }
}

// Export patients to CSV
async function exportPatientsToCSV() {
  try {
    const patients = await getAllPatients();
    
    let csv = 'Patient ID,First Name,Last Name,Date of Birth,Gender,Phone,Email,Address\n';
    
    patients.forEach(patient => {
      const row = [
        patient.patient_id || '',
        patient.first_name || '',
        patient.last_name || '',
        patient.date_of_birth || '',
        patient.gender || '',
        patient.phone || '',
        patient.email || '',
        `${patient.address_line1 || ''} ${patient.city || ''} ${patient.state || ''}`.trim()
      ].map(field => `"${field}"`).join(',');
      csv += row + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('❌ [PATIENTS] Error exporting patients:', error);
    alert('Error exporting patients');
  }
}

// Initialize page
async function initializePatientsPage() {
  console.log('🚀 [PATIENTS] Initializing patients page');
  
  // Initialize Supabase
  if (!initSupabase()) {
    console.error('❌ [PATIENTS] Failed to initialize Supabase');
    return;
  }
  
  // Set up event listeners
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', searchPatientsHandler);
  }
  
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportPatientsToCSV);
  }
  
  // Load initial patients
  await loadPatients(1);
}

// Export functions for global use
window.getAllPatients = getAllPatients;
window.getPatientById = getPatientById;
window.createPatient = createPatient;
window.updatePatient = updatePatient;
window.deletePatient = deletePatient;
window.searchPatients = searchPatients;
window.generatePatientId = generatePatientId;
window.loadPatients = loadPatients;
window.sortPatients = sortPatients;
window.viewPatient = viewPatient;
window.editPatient = editPatient;
window.deletePatientConfirm = deletePatientConfirm;
window.exportPatientsToCSV = exportPatientsToCSV;

// Add patient from form (for add-patient.html)
async function addPatientFromForm() {
  console.log('🚀 [PATIENTS] Adding patient from form');
  
  try {
    // Collect form data
    const customPatientIdInput = document.getElementById('customPatientId');
    const customPatientId = customPatientIdInput ? customPatientIdInput.value.trim() : '';
    
    const patientData = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      middleName: document.getElementById('middleName')?.value.trim() || '',
      dateOfBirth: document.getElementById('dob')?.value || document.getElementById('dateOfBirth')?.value,
      gender: document.getElementById('gender').value,
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      addressLine1: document.getElementById('addressLine1').value.trim(),
      addressLine2: document.getElementById('addressLine2')?.value.trim() || '',
      city: document.getElementById('city').value.trim(),
      state: document.getElementById('state').value.trim(),
      country: document.getElementById('country').value.trim(),
      emergencyContactName: (document.getElementById('emergencyFirstName').value.trim() + ' ' + document.getElementById('emergencyLastName').value.trim()).trim(),
      emergencyContactPhone: document.getElementById('emergencyPhone').value.trim(),
      emergencyContactRelationship: document.getElementById('emergencyRelationship').value.trim(),
      medicalHistory: typeof tempMedicalHistory !== 'undefined' ? tempMedicalHistory : [],
      allergies: typeof tempAllergies !== 'undefined' ? tempAllergies : [],
      medications: typeof tempMedications !== 'undefined' ? tempMedications : [],
      immunizations: typeof tempImmunizations !== 'undefined' ? tempImmunizations : [],
      notes: document.getElementById('notes')?.value.trim() || '',
      customPatientId: customPatientId // Include custom patient ID if provided
    };
    
    // Validate required fields
    if (!patientData.firstName || !patientData.lastName || !patientData.dateOfBirth || !patientData.gender) {
      alert('Please fill in all required fields (First Name, Last Name, Date of Birth, Gender)');
      return;
    }
    
    // Create patient
    const newPatient = await createPatient(patientData);
    
    if (newPatient) {
      if (typeof window.MediForgeIntegrationWorkflow !== 'undefined') {
        window.MediForgeIntegrationWorkflow.registerPatientIdentifiers(newPatient);
      }
      // Check if patient was synced to Supabase or just saved locally
      if (newPatient._queued && !newPatient._synced) {
        // Patient saved locally, will sync later
        if (typeof window.showSuccessNotification === 'function') {
          window.showSuccessNotification('✅ Patient saved locally. Will sync to cloud when connection is available.');
        } else {
          alert('✅ Patient saved locally. Will sync to cloud when connection is available.');
        }
      } else {
        // Patient saved to Supabase successfully
        if (typeof window.showSuccessNotification === 'function') {
          window.showSuccessNotification(`✅ Patient ${newPatient.first_name} ${newPatient.last_name} created successfully with ID: ${newPatient.patient_id}`);
        } else {
      alert(`Patient ${newPatient.first_name} ${newPatient.last_name} created successfully with ID: ${newPatient.patient_id}`);
        }
      }
      
      // Clear form
      document.getElementById('add-patient-form').reset();
      
      // Clear temporary arrays
      if (typeof tempMedicalHistory !== 'undefined') tempMedicalHistory = [];
      if (typeof tempAllergies !== 'undefined') tempAllergies = [];
      if (typeof tempMedications !== 'undefined') tempMedications = [];
      if (typeof tempImmunizations !== 'undefined') tempImmunizations = [];
      
      // Redirect to patients list
      window.location.href = 'patients';
    } else {
      // Show detailed error message
      const errorMsg = 'Failed to create patient. Please check:\n' +
                      '1. You are logged in\n' +
                      '2. Your organization is set\n' +
                      '3. You have internet connection\n\n' +
                      'Check browser console for details.';
      alert(errorMsg);
      console.error('❌ [PATIENTS] Patient creation failed - newPatient is null');
    }
    
  } catch (error) {
    console.error('❌ [PATIENTS] Error adding patient:', error);
    alert('Error creating patient: ' + error.message);
  }
}

// Initialize add patient page
async function initializeAddPatientPage() {
  console.log('🚀 [PATIENTS] Initializing add patient page');
  
  // Initialize Supabase
  if (!initSupabase()) {
    console.error('❌ [PATIENTS] Failed to initialize Supabase');
    return;
  }
  
  // Set up form submission
  const form = document.getElementById('add-patient-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      await addPatientFromForm();
    });
  }
}

// Initialize based on current page
function initializePage() {
  const currentPage = window.location.pathname;
  
  if (currentPage.includes('patients') && !currentPage.includes('add-patient') && !currentPage.includes('edit-patient') && !currentPage.includes('patient-details')) {
    initializePatientsPage();
  } else if (currentPage.includes('add-patient')) {
    initializeAddPatientPage();
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializePage);

// Export additional functions
window.addPatientFromForm = addPatientFromForm;

// Initialize on load
console.log('✅ [PATIENTS] Supabase patients module loaded');
