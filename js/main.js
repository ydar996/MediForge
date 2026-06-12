// Console filtering to suppress noisy logs by default.
// Enable only with ?debugLogs=true in the URL.
(function setupConsoleFiltering() {
  if (window.__consoleFilteringApplied) {
    return;
  }
  window.__consoleFilteringApplied = true;

  const urlParams = new URLSearchParams(window.location.search);
  const debugEnabled = urlParams.get('debugLogs') === 'true';
  window.__DEBUG_LOGS = debugEnabled;
  window.ENABLE_VERBOSE_LOGS = debugEnabled;

  const SENSITIVE_KEYS = [
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
      if (SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))) {
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

  const wrapConsoleMethod = (method) => {
    if (!console || typeof console[method] !== 'function') return;
    const original = console[method].bind(console);
    console[method] = (...args) => {
      const sanitizedArgs = sanitizeArgs(args);
      if (!debugEnabled && method !== 'error') {
        return;
      }
      original(...sanitizedArgs);
    };
  };

  wrapConsoleMethod('log');
  wrapConsoleMethod('info');
  wrapConsoleMethod('debug');
  wrapConsoleMethod('warn');
  wrapConsoleMethod('error');
})();

const MAIN_VERBOSE = window.__DEBUG_LOGS === true;
const mainLog = (...args) => { if (MAIN_VERBOSE) console.log(...args); };
const mainWarn = (...args) => { if (MAIN_VERBOSE) console.warn(...args); };

// Register service worker for offline and provide data key prefix for multi-org.
mainLog('🔧 MAIN.JS LOADED - Version with migration function v=20251019043800');

// Register Service Worker with cache busting - DISABLED to prevent mobile refresh loops
/*
if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js?v=20251019043800")
    .then(registration => {
      mainLog("Offline support enabled");
      
      // Check for version mismatch and force update
      const currentVersion = '20251019043800';
      const lastVersion = localStorage.getItem('appVersion');
      
      if (lastVersion !== currentVersion) {
        mainLog('🔄 Version mismatch detected, forcing service worker update');
        localStorage.setItem('appVersion', currentVersion);
        
        // Clear all caches and force update
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              caches.delete(cacheName);
              mainLog(`Cleared cache: ${cacheName}`);
            });
          });
        }
        
        // Force service worker update
        registration.update();
        
        // Unregister and re-register to ensure clean state
        registration.unregister().then(() => {
          // DISABLED: navigator.serviceWorker.register("/service-worker.js?v=20251019043800");
        });
      } else {
        // Normal update
        registration.update();
      }
    })
    .catch(err => console.error("Offline setup failed", err));
}
*/

// Auto-load organization address sync if available
if (typeof window.addEventListener !== 'undefined') {
  window.addEventListener('load', function() {
    // Load organization address sync script if not already loaded
    if (typeof window.syncOrganizationAddresses !== 'function') {
      const script = document.createElement('script');
      script.src = 'js/organization-address-sync.js?v=20260520';
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

// Get prefixed key for data isolation per organization
window.getDataKey = function(key) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.org ? `${user.org}_${key}` : key;  // Fallback to no prefix if no org
};

// Check if logged in but org missing/empty, redirect to edit profile (exclude login/register/edit pages to avoid loop)
// TEMPORARILY DISABLED FOR PLATFORM ADMIN VIEW TESTING
/*
const mainCurrentPage = window.location.pathname.split('/').pop();
if (mainCurrentPage !== 'login.html' && mainCurrentPage !== 'register.html' && mainCurrentPage !== 'edit-profile.html') {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const platformAdminContext = JSON.parse(localStorage.getItem("platformAdminContext") || "{}");
  
  // Skip organization check for platform admin view mode or if platform admin context exists
  const isPlatformAdminView = user.platformAdminView || user._isPlatformView || platformAdminContext.returnUrl;
  
  if (user.username && (!user.org || user.org.trim() === '') && !isPlatformAdminView) {
    alert("Your profile is missing organization details. Redirecting to edit profile.");
   window.location.href = "/edit-profile";
  }
  
}
*/

// Global migration for hasDiabetes on all patients (skip null holes in stored JSON arrays)
const _patientsRaw = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
const patients = Array.isArray(_patientsRaw)
  ? _patientsRaw.filter(p => p != null && typeof p === 'object')
  : [];
let changed = _patientsRaw.length !== patients.length;
patients.forEach(p => {
  if (p.hasDiabetes === undefined) {
    p.hasDiabetes = false;
    changed = true;
  }
});
if (changed) {
  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
}

// Cache clearing function for development
window.clearCache = function() {
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
        mainLog('Deleted cache:', name);
      });
    });
  }
  mainLog('Cache cleared. Please refresh the page.');
};

// Migration function for patient demographics - Available globally
window.migratePatientDemographics = async function() {
    mainLog('🔄 Starting patient demographics migration...');
    
    try {
        // Get current user and organization
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        mainLog('👤 User:', user);
        
        // Get organization ID with fallback mechanism
        let orgId = user.organizationId;
        if (!orgId && user.org) {
            // For Mecure Clinics, use the known org ID
            if (user.org.toLowerCase().includes('mecure')) {
                orgId = '576522cc-e769-4fb4-9487-3d150857d970';
            } else {
                // Try to get from organizations storage
                const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
                const orgData = organizations[user.org];
                if (orgData && orgData.id) {
                    orgId = orgData.id;
                }
            }
        }
        
        if (!orgId) {
            throw new Error('No organization ID found. Please log in first.');
        }
        
        mainLog(`🏥 Organization ID: ${orgId}`);
        
        // Load local patients
        const patientsKey = `patients_${orgId}`;
        const localPatients = JSON.parse(localStorage.getItem(patientsKey) || "[]");
        mainLog(`📱 Local patients: ${localPatients.length}`);
        
        // Load Supabase patients
        const { data: supabasePatients, error } = await window.supabaseClient
            .from('patients')
            .select('*')
            .eq('organization_id', orgId);
        
        if (error) {
            throw new Error(`Supabase error: ${error.message}`);
        }
        
        mainLog(`☁️ Supabase patients: ${supabasePatients.length}`);
        
        // Analyze what needs migration
        let needsMigration = 0;
        let hasAllData = 0;
        
        for (const localPatient of localPatients) {
            const supabasePatient = supabasePatients.find(sp => sp.patient_id === localPatient.id);
            
            if (supabasePatient) {
                // Check if demographic fields are missing
                const hasAddress = supabasePatient.address_line1 || supabasePatient.city || supabasePatient.state;
                const hasEmergency = supabasePatient.emergency_contact_name || supabasePatient.emergency_contact_phone;
                const hasDemographics = supabasePatient.email || supabasePatient.race || supabasePatient.marital_status;
                
                if (!hasAddress || !hasEmergency || !hasDemographics) {
                    needsMigration++;
                } else {
                    hasAllData++;
                }
            } else {
                needsMigration++;
            }
        }
        
        mainLog(`✅ Patients with complete data: ${hasAllData}`);
        mainWarn(`⚠️ Patients needing migration: ${needsMigration}`);
        
        if (needsMigration === 0) {
            alert('✅ All patients already have complete demographic data in Supabase!');
            return;
        }
        
        // Ask for confirmation
        const confirmMessage = `Found ${needsMigration} patients that need demographic data migration.\n\nThis will update their Supabase records with:\n- Address information\n- Emergency contact details\n- Demographics (email, race, etc.)\n\nDo you want to proceed?`;
        
        if (!confirm(confirmMessage)) {
            mainWarn('Migration cancelled by user');
            return;
        }
        
        // Run migration
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (let i = 0; i < localPatients.length; i++) {
            const patient = localPatients[i];
            mainLog(`📝 Migrating patient ${i + 1}/${localPatients.length}: ${patient.firstName} ${patient.lastName}`);
            
            try {
                const result = await migrateSinglePatient(patient, orgId);
                if (result.success) {
                    successCount++;
                    mainLog(`✅ Success: ${patient.firstName} ${patient.lastName}`);
                } else {
                    errorCount++;
                    errors.push(`${patient.firstName} ${patient.lastName}: ${result.error}`);
                    mainWarn(`❌ Failed: ${patient.firstName} ${patient.lastName} - ${result.error}`);
                }
            } catch (error) {
                errorCount++;
                errors.push(`${patient.firstName} ${patient.lastName}: ${error.message}`);
                mainWarn(`❌ Error: ${patient.firstName} ${patient.lastName} - ${error.message}`);
            }
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Show results
        const resultMessage = `Migration completed!\n\n✅ Successful: ${successCount}\n❌ Failed: ${errorCount}`;
        alert(resultMessage);
        
        if (errors.length > 0) {
            mainWarn('Migration errors:', errors);
        }
        
        mainLog(`🏁 Migration completed. Success: ${successCount}, Errors: ${errorCount}`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        alert(`❌ Migration failed: ${error.message}`);
    }
};

// Helper function to migrate a single patient
async function migrateSinglePatient(localPatient, orgId) {
    // Check if patient exists in Supabase
    const { data: existingPatient, error: fetchError } = await window.supabaseClient
        .from('patients')
        .select('*')
        .eq('patient_id', localPatient.id)
        .eq('organization_id', orgId)
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch patient: ${fetchError.message}`);
    }
    
    // Prepare update data
    const updateData = {
        first_name: localPatient.firstName,
        last_name: localPatient.lastName,
        middle_name: localPatient.middleName || null,
        gender: localPatient.gender,
        date_of_birth: localPatient.dob || null,
        phone: localPatient.phone,
        email: localPatient.email || null,
        address_line1: localPatient.addressLine1 || null,
        address_line2: localPatient.addressLine2 || null,
        city: localPatient.city || null,
        state: localPatient.state || null,
        country: localPatient.country || null,
        postal_code: localPatient.postalCode || null,
        emergency_contact_name: localPatient.emergencyFirstName && localPatient.emergencyLastName ? 
            `${localPatient.emergencyFirstName} ${localPatient.emergencyLastName}` : null,
        emergency_contact_relationship: localPatient.emergencyRelationship || null,
        emergency_contact_phone: localPatient.emergencyPhone || null,
        emergency_contact_email: localPatient.emergencyEmail || null,
        emergency_contact_address: localPatient.emergencyAddressLine1 ? 
            `${localPatient.emergencyAddressLine1}${localPatient.emergencyAddressLine2 ? ', ' + localPatient.emergencyAddressLine2 : ''}, ${localPatient.emergencyCity || ''}, ${localPatient.emergencyState || ''}, ${localPatient.emergencyCountry || ''}` : null,
        blood_group: localPatient.bloodGroup || null,
        genotype: localPatient.genotype || null,
        race: localPatient.race || null,
        occupation: localPatient.occupation || null,
        marital_status: localPatient.maritalStatus || null,
        allergies: localPatient.allergies ? JSON.stringify(localPatient.allergies) : '[]',
        chronic_conditions: localPatient.conditions ? JSON.stringify(localPatient.conditions) : '[]',
        medications: localPatient.medications ? JSON.stringify(localPatient.medications) : '[]',
        medical_history: localPatient.medicalHistory ? JSON.stringify(localPatient.medicalHistory) : '[]',
        diagnoses: localPatient.diagnoses ? JSON.stringify(localPatient.diagnoses) : '[]',
        payment_source: localPatient.paymentSource || 'Self Pay',
        insurance_name: localPatient.insuranceName || null,
        insurance_policy_number: localPatient.insurancePolicyNumber || null,
        insurance_member_number: localPatient.insuranceMemberNumber || null
    };
    
    let result;
    const updatedFields = [];
    
    if (existingPatient) {
        // Update existing patient
        const { data, error } = await window.supabaseClient
            .from('patients')
            .update(updateData)
            .eq('patient_id', localPatient.id)
            .eq('organization_id', orgId)
            .select()
            .single();
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        result = data;
        
        // Track which fields were updated
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== null && updateData[key] !== existingPatient[key]) {
                updatedFields.push(key);
            }
        });
        
    } else {
        // Insert new patient
        const insertData = {
            ...updateData,
            patient_id: localPatient.id,
            organization_id: orgId
        };
        
        const { data, error } = await window.supabaseClient
            .from('patients')
            .insert(insertData)
            .select()
            .single();
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        result = data;
        updatedFields.push('new_patient_created');
    }
    
    return { 
        success: true, 
        data: result, 
        updatedFields: updatedFields,
        wasNew: !existingPatient
    };
}

// ============================================================================
// UNIVERSAL SYNC MANAGER - Works on ALL pages to ensure cross-browser sync
// ============================================================================
// This ensures Edge, mobile, and all browsers sync with Supabase (Chrome's data)
// Loaded via main.js which is included on most pages

(function() {
  'use strict';

  mainLog('📡 Universal Sync Manager initialized (via main.js)');

  // Check if we're on a login/index page
  function isLoginPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('login') || path.includes('index') || path.includes('register');
  }

  // Get user from localStorage safely
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch (e) {
      return {};
    }
  }

  // Force sync with Supabase (uses forceSyncWithSupabase if available, otherwise manual)
  window.performUniversalSync = async function(options = {}) {
    const {
      clearStaleLocalStorage = true,
      showProgress = true,
      showNotification = true
    } = options || {};

    if (showProgress) {
      mainLog('🔄 Universal Sync Manager: Starting force sync...');
    }

    // Try to use the existing forceSyncWithSupabase if available (from universal-data-loader.js)
    if (typeof window.forceSyncWithSupabase === 'function') {
      if (showProgress) {
        mainLog('✅ Using existing forceSyncWithSupabase function');
      }
      return await window.forceSyncWithSupabase({ clearStaleLocalStorage, showProgress });
    }

    // Fallback: Manual sync if universal-data-loader.js not loaded
    if (showProgress) {
      mainWarn('⚠️ forceSyncWithSupabase not available, performing manual sync');
    }

    const user = getUser();
    // User is considered logged in if they have username OR email
    const isLoggedIn = user && (user.username || user.email);
    if (!isLoggedIn) {
      return { success: false, error: 'No user logged in' };
    }

    if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
      return { success: false, error: 'Supabase not available' };
    }

    try {
      // Get organization ID
      let orgId = user.organizationId;
      if (!orgId && user.org) {
        const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = orgs[user.org];
        orgId = orgData?.id;
        
        // For Mecure Clinics, use known ID
        if (!orgId && user.org.toLowerCase().includes('mecure')) {
          orgId = '576522cc-e769-4fb4-9487-3d150857d970';
        }
      }

      if (!orgId) {
        return { success: false, error: 'No organization ID found' };
      }

      // Clear stale localStorage if requested
      if (clearStaleLocalStorage) {
        const orgPrefix = user.org ? `${user.org}_` : '';
        const dataKeys = [
          `${orgPrefix}patients`, 
          `${orgPrefix}appointments`, 
          `${orgPrefix}_billing_invoices`,
          `${orgPrefix}_billing_payments`,
          'patients', 
          'appointments'
        ];
        dataKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            if (showProgress) mainLog(`🗑️ Cleared: ${key}`);
          }
        });
      }

      // Load fresh data from Supabase
      const { data: patients, error: patientsError } = await window.supabaseClient
        .from('patients')
        .select('*')
        .eq('organization_id', orgId);

      if (patientsError) {
        throw new Error(`Supabase error: ${patientsError.message}`);
      }

      // Convert and save to localStorage using FULL conversion (matching universal-data-loader.js)
      if (patients && patients.length > 0) {
        const convertedPatients = patients.map(patient => {
          // Parse address fields
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

          // Parse emergency contact address
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

          // Safely parse JSON fields
          let allergies = [];
          let conditions = [];
          let diagnoses = [];
          let immunizations = [];
          let medicalHistory = [];
          let vitals = [];
          let medications = [];
          let prescriptions = [];
          
          try {
            if (patient.allergies && patient.allergies.trim() && patient.allergies !== 'null' && patient.allergies !== 'NULL') {
              allergies = JSON.parse(patient.allergies);
            }
          } catch (e) { allergies = []; }
          
          try {
            if (patient.chronic_conditions && patient.chronic_conditions.trim() && patient.chronic_conditions !== 'null' && patient.chronic_conditions !== 'NULL') {
              conditions = JSON.parse(patient.chronic_conditions);
            }
          } catch (e) { conditions = []; }
          
          try {
            if (patient.diagnoses && patient.diagnoses.trim() && patient.diagnoses !== 'null' && patient.diagnoses !== 'NULL') {
              diagnoses = JSON.parse(patient.diagnoses);
            }
          } catch (e) { diagnoses = []; }
          
          try {
            if (patient.immunizations && patient.immunizations.trim() && patient.immunizations !== 'null' && patient.immunizations !== 'NULL') {
              immunizations = JSON.parse(patient.immunizations);
            }
          } catch (e) { immunizations = []; }
          
          try {
            if (patient.medical_history && patient.medical_history.trim() && patient.medical_history !== 'null' && patient.medical_history !== 'NULL') {
              medicalHistory = JSON.parse(patient.medical_history);
            }
          } catch (e) { medicalHistory = []; }
          
          try {
            if (patient.vitals && patient.vitals.trim() && patient.vitals !== 'null' && patient.vitals !== 'NULL') {
              vitals = JSON.parse(patient.vitals);
            }
          } catch (e) { vitals = []; }
          
          try {
            if (patient.medications && patient.medications.trim() && patient.medications !== 'null' && patient.medications !== 'NULL') {
              medications = JSON.parse(patient.medications);
            }
          } catch (e) { medications = []; }
          
          try {
            if (patient.prescriptions && patient.prescriptions.trim() && patient.prescriptions !== 'null' && patient.prescriptions !== 'NULL') {
              prescriptions = JSON.parse(patient.prescriptions);
            }
          } catch (e) { prescriptions = []; }

          return {
            id: patient.patient_id,
            firstName: patient.first_name || '',
            middleName: patient.middle_name || '',
            lastName: patient.last_name || '',
            dob: patient.date_of_birth,
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
            diagnoses: diagnoses,
            immunizations: immunizations,
            medicalHistory: medicalHistory,
            vitals: vitals,
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
            medications: medications,
            prescriptions: prescriptions,
            organizationId: patient.organization_id,
            visits: [], // Preserved from localStorage if exists
            hasDiabetes: false
          };
        });
        
        // CRITICAL: Merge visits from localStorage before saving (preserve visit data)
        const existingPatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        convertedPatients.forEach(supabasePatient => {
          const existingPatient = existingPatients.find(p => p.id === supabasePatient.id);
          if (existingPatient && existingPatient.visits) {
            supabasePatient.visits = existingPatient.visits;
          } else {
            supabasePatient.visits = [];
          }
        });

        const patientsKey = getDataKey("patients");
        localStorage.setItem(patientsKey, JSON.stringify(convertedPatients));
        if (showProgress) mainLog(`✅ Synced ${convertedPatients.length} patients with FULL data conversion`);
      } else {
        // No patients - clear localStorage for this organization
        const patientsKey = getDataKey("patients");
        localStorage.setItem(patientsKey, JSON.stringify([]));
        if (showProgress) mainLog('📋 No patients found - cleared localStorage');
      }
      
      // Also sync appointments
      try {
        const { data: appointments, error: appointmentsError } = await window.supabaseClient
          .from('appointments')
          .select('*')
          .eq('organization_id', orgId);
          
        if (!appointmentsError && appointments) {
          const convertedAppointments = appointments.map(sa => ({
            id: sa.appointment_id || `${sa.appointment_date}_${sa.appointment_time?.replace(':', '')}`,
            patientId: sa.patient_id,
            patientName: sa.patient_name || 'Unknown Patient',
            date: sa.appointment_date,
            time: sa.appointment_time,
            duration: sa.duration || 30,
            visitType: sa.visit_type || 'General',
            doctor: sa.doctor_name || 'Dr. Smith',
            appointment_type: sa.appointment_type || 'General Consultation', // CRITICAL: Include appointment type
            appointment_type_id: sa.appointment_type_id || '', // Include appointment type ID if available
            status: sa.status || 'Scheduled',
            notes: sa.notes || '',
            organizationId: sa.organization_id
          }));
          
          const appointmentsKey = getDataKey("appointments");
          localStorage.setItem(appointmentsKey, JSON.stringify(convertedAppointments));
          if (showProgress) mainLog(`✅ Synced ${convertedAppointments.length} appointments`);
        }
      } catch (error) {
        mainWarn('⚠️ Could not sync appointments:', error);
      }
      
      // Also sync INVOICES (critical for billing dashboard)
      try {
        const { data: invoices, error: invoicesError } = await window.supabaseClient
          .from('invoices')
          .select('*')
          .eq('organization_id', orgId);
          
        if (!invoicesError && invoices) {
          // Use getBillingKey if available, otherwise construct it
          const billingKey = typeof getBillingKey === 'function' 
            ? getBillingKey('invoices')
            : `${user.org}_billing_invoices`;
          
          const convertedInvoices = invoices.map(si => ({
            id: si.invoice_id,
            invoiceNumber: si.invoice_number,
            patientId: si.patient_id,
            patientName: si.patient_name || 'Unknown Patient',
            date: si.invoice_date,
            dueDate: si.due_date,
            services: si.services || [],
            subtotal: parseFloat(si.subtotal) || 0,
            tax: parseFloat(si.tax) || 0,
            discount: parseFloat(si.discount) || 0,
            total: parseFloat(si.total) || 0,
            amountPaid: parseFloat(si.amount_paid) || 0,
            amountDue: parseFloat(si.amount_due) || 0,
            status: si.status || 'pending',
            currency: si.currency || 'USD',
            notes: si.notes || '',
            organizationId: si.organization_id
          }));
          
          localStorage.setItem(billingKey, JSON.stringify(convertedInvoices));
          if (showProgress) mainLog(`✅ Synced ${convertedInvoices.length} invoices`);
        }
      } catch (error) {
        mainWarn('⚠️ Could not sync invoices:', error);
      }
      
      // Also sync PAYMENTS (critical for billing dashboard)
      try {
        const { data: payments, error: paymentsError } = await window.supabaseClient
          .from('payments')
          .select('*')
          .eq('organization_id', orgId);
          
        if (!paymentsError && payments) {
          // Use getBillingKey if available, otherwise construct it
          const billingPaymentsKey = typeof getBillingKey === 'function' 
            ? getBillingKey('payments')
            : `${user.org}_billing_payments`;
          
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
            currency: sp.currency || 'USD',
            organizationId: sp.organization_id
          }));
          
          localStorage.setItem(billingPaymentsKey, JSON.stringify(convertedPayments));
          if (showProgress) mainLog(`✅ Synced ${convertedPayments.length} payments`);
        }
      } catch (error) {
        mainWarn('⚠️ Could not sync payments:', error);
      }

      // Show notification
      if (showNotification) {
        showSyncNotification('✅ Data synced successfully!', 'success');
      }

      // Dispatch sync event for pages to refresh
      window.dispatchEvent(new CustomEvent('universalSyncComplete', {
        detail: { patients: patients?.length || 0, organization: user.org }
      }));

      return {
        success: true,
        patients: patients?.length || 0,
        organization: user.org
      };

    } catch (error) {
      console.error('❌ Universal Sync Manager: Sync failed:', error);
      if (showNotification) {
        showSyncNotification('❌ Sync failed: ' + error.message, 'error');
      }
      return { success: false, error: error.message };
    }
  };

  // Show sync notification
  function showSyncNotification(message, type = 'info') {
    const existing = document.getElementById('universal-sync-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'universal-sync-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-weight: bold;
      max-width: 300px;
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  // Create sync button in the UI (appears on all pages)
  function createSyncButton() {
    mainLog('📡 Universal Sync: Attempting to create sync button...');
    
    if (document.getElementById('universal-sync-button')) {
      mainLog('📡 Universal Sync: Button already exists');
      return;
    }
    
    if (isLoginPage()) {
      mainLog('📡 Universal Sync: Login page detected, skipping button');
      return;
    }

    const user = getUser();
    // User is considered logged in if they have username OR email (different login methods use different fields)
    const isLoggedIn = user && (user.username || user.email);
    mainLog('📡 Universal Sync: User check:', { 
      hasUser: !!user, 
      username: user?.username, 
      email: user?.email,
      isLoggedIn: isLoggedIn
    });
    
    if (!isLoggedIn) {
      mainLog('📡 Universal Sync: No user logged in, skipping button');
      return;
    }
    
    mainLog('📡 Universal Sync: Creating button for user:', user.username || user.email || 'Unknown');

    const button = document.createElement('button');
    button.id = 'universal-sync-button';
    button.innerHTML = '🔄 Sync Data';
    button.title = 'Force sync with Supabase to get latest data (works across all browsers/devices)';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: 2px solid #667eea;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 3px 10px rgba(102, 126, 234, 0.4);
      z-index: 9999;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1;
      min-width: auto;
      max-width: none;
      width: auto;
      margin: 0;
    `;
    
    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = 'linear-gradient(135deg, #764ba2, #667eea)';
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 5px 15px rgba(102, 126, 234, 0.5)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 3px 10px rgba(102, 126, 234, 0.4)';
    });

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.innerHTML = '⏳ Syncing...';
      button.style.opacity = '0.7';

      const result = await window.performUniversalSync({
        clearStaleLocalStorage: true,
        showProgress: true,
        showNotification: true
      });

      if (result.success) {
        button.innerHTML = '✅ Synced';
        mainLog('✅ Sync successful! Reloading page to show updated data...');
        // Auto-reload after sync to ensure data is displayed
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        button.innerHTML = '❌ Failed';
        setTimeout(() => {
          button.innerHTML = '🔄 Sync Data';
          button.disabled = false;
          button.style.opacity = '1';
        }, 2000);
      }
    });

    document.body.appendChild(button);
    mainLog('✅ Universal Sync: Button created and added to page');
  }

  // Handle URL parameter for automatic sync
  function handleUrlSync() {
    const urlParams = new URLSearchParams(window.location.search);
    const forceSyncParam = urlParams.get('forcesync') === '1' || urlParams.get('forcesync') === 'true';
    
    if (forceSyncParam && !isLoginPage()) {
      const user = getUser();
      if (user && user.username) {
        setTimeout(async () => {
          await window.performUniversalSync({
            clearStaleLocalStorage: true,
            showProgress: true,
            showNotification: true
          });
          
          // Remove URL parameter
          if (window.history && window.history.replaceState) {
            urlParams.delete('forcesync');
            urlParams.delete('clearstale');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
          }
        }, 1000);
      }
    }
  }

  // Initialize on page load
  function init() {
    mainLog('📡 Universal Sync: Initializing...');
    mainLog('📡 Universal Sync: Document ready state:', document.readyState);
    mainLog('📡 Universal Sync: Body exists:', !!document.body);
    
    setTimeout(() => {
      mainLog('📡 Universal Sync: Running initialization after delay...');
      try {
        createSyncButton();
        handleUrlSync();
        mainLog('✅ Universal Sync: Initialization complete');
      } catch (error) {
        console.error('❌ Universal Sync: Initialization error:', error);
      }
    }, 1000);
  }

  // Try multiple initialization strategies to ensure it runs
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    mainLog('📡 Universal Sync: Waiting for DOMContentLoaded');
  } else {
    mainLog('📡 Universal Sync: DOM already ready, initializing immediately');
    init();
  }
  
  // Also try on window load as backup
  window.addEventListener('load', () => {
    mainLog('📡 Universal Sync: Window load event fired');
    setTimeout(() => {
      if (!document.getElementById('universal-sync-button')) {
        mainLog('📡 Universal Sync: Button missing after load, retrying...');
        createSyncButton();
      }
    }, 2000);
  });

})();
// ============================================================================