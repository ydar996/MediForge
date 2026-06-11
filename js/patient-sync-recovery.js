/**
 * Patient Sync Recovery Service
 * Purpose: Automatically sync patients from localStorage to Supabase
 * This recovers patients that were saved locally but failed to sync to Supabase
 */

(function() {
  'use strict';

  // Patient Sync Recovery Service initialized

  // Helper to get organization UUID properly (same logic as patients.js)
  async function getOrganizationUUID() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = user.organizationId || user.organization_id;
    
    // If not a UUID, look it up
    if (!orgId || (orgId && !orgId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
      if (user.org) {
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = organizations[user.org];
        if (orgData && orgData.id && orgData.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          orgId = orgData.id;
        } else if (window.supabaseClient && user.org) {
          try {
            const { data: orgResult, error: orgError } = await window.supabaseClient
              .from('organizations')
              .select('id')
              .eq('name', user.org)
              .single();
            
            if (!orgError && orgResult && orgResult.id) {
              orgId = orgResult.id;
              user.organizationId = orgId;
              user.organization_id = orgId;
              localStorage.setItem("user", JSON.stringify(user));
            }
          } catch (lookupError) {
            console.error('❌ Error looking up organization:', lookupError);
          }
        }
      }
    }
    
    return orgId;
  }

  // Check if patient exists in Supabase
  async function patientExistsInSupabase(patientId, orgId) {
    if (!window.supabaseClient || !orgId) return false;
    
    // Skip if patientId is invalid
    if (!patientId || patientId === undefined || patientId === null || patientId === '') {
      return false;
    }
    
    try {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .select('id')
        .eq('patient_id', patientId)
        .eq('organization_id', orgId)
        .maybeSingle(); // Use maybeSingle to avoid 406 errors
      
      return !error && data;
    } catch (err) {
      return false;
    }
  }

  // Sync a single patient from localStorage to Supabase
  async function syncPatientToSupabase(patient, orgId) {
    if (!window.supabaseClient || !orgId) {
      console.warn('⚠️ Cannot sync patient - Supabase or organization ID not available');
      return { success: false, error: 'Supabase or organization ID not available' };
    }

    try {
      // Validate patient has required fields
      if (!patient || !patient.id || patient.id === undefined || patient.id === null || patient.id === '') {
        return { success: false, error: 'Patient missing valid ID' };
      }
      
      // VALIDATION: Skip patients with missing required fields
      if (!patient.firstName || !patient.lastName || !patient.dob) {
        return { success: false, error: 'Patient missing required fields (firstName, lastName, dob)' };
      }
      
      // Convert localStorage patient format to Supabase format
      const supabasePatient = {
        patient_id: patient.id,
        first_name: patient.firstName,
        last_name: patient.lastName,
        middle_name: patient.middleName || null,
        gender: patient.gender,
        date_of_birth: patient.dob || null,
        phone: patient.phone || null,
        email: patient.email || null,
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
        tribe: patient.tribe || null,
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

      const { data, error } = await window.supabaseClient
        .from('patients')
        .insert(supabasePatient)
        .select()
        .single();

      if (error) {
        // If error is duplicate (patient already exists), that's okay
        if (error.code === '23505') {
          // Patient already exists in Supabase (ID removed for privacy)
          return { success: true, alreadyExists: true };
        }
        console.error('❌ Error syncing patient:', error.message || error);
        return { success: false, error: error.message };
      }

      // Successfully synced patient to Supabase
      return { success: true, data };
    } catch (err) {
      console.error('❌ Exception syncing patient:', err.message || err);
      return { success: false, error: err.message };
    }
  }

  // Sync all patients from localStorage that don't exist in Supabase
  window.syncLocalPatientsToSupabase = async function() {
    // Starting patient sync recovery
    
    if (!window.supabaseClient) {
      console.warn('⚠️ Supabase client not available - cannot sync');
      return { success: false, error: 'Supabase client not available' };
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.org) {
      console.warn('⚠️ No organization found - cannot sync');
      return { success: false, error: 'No organization found' };
    }

    // Get organization UUID
    const orgId = await getOrganizationUUID();
    if (!orgId) {
      console.error('❌ Could not determine organization UUID');
      return { success: false, error: 'Could not determine organization UUID' };
    }

    // Organization UUID resolved (UUID removed for privacy)

    // Get all patients from localStorage
    function getDataKey(key) {
      const user = JSON.parse(localStorage.getItem("user") || '{}');
      return user && user.org ? `${user.org}_${key}` : key;
    }

    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    // Found patients in localStorage (count removed for privacy)

    if (patients.length === 0) {
      return { success: true, synced: 0, skipped: 0, errors: 0 };
    }

    // Check each patient and sync if missing
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];

    for (const patient of patients) {
      try {
        // Skip patients without valid IDs (corrupted data)
        if (!patient || !patient.id) {
          skipped++;
          continue;
        }
        
        // Skip patients with invalid patient_id (undefined, null, or empty string)
        if (patient.id === undefined || patient.id === null || patient.id === '') {
          skipped++;
          continue;
        }
        
        // Check if patient exists in Supabase
        const exists = await patientExistsInSupabase(patient.id, orgId);
        
        if (exists) {
          // Patient already exists in Supabase - skipping (ID removed for privacy)
          skipped++;
        } else {
          // Syncing patient to Supabase (ID removed for privacy)
          const result = await syncPatientToSupabase(patient, orgId);
          
          if (result.success) {
            synced++;
            // Small delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            errors++;
            errorsList.push({ patientId: patient.id, error: result.error });
          }
        }
      } catch (err) {
        console.error('❌ Error processing patient:', err.message || err);
        errors++;
        errorsList.push({ patientId: patient?.id || 'unknown', error: err.message });
      }
    }

    const summary = {
      success: errors === 0,
      total: patients.length,
      synced,
      skipped,
      errors,
      errorsList
    };

    // Patient sync recovery complete (summary removed for privacy)
    return summary;
  };

  // Auto-sync function - can be called multiple times safely
  async function triggerAutoSync() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.username && user.org && window.supabaseClient) {
      try {
        const syncResult = await window.syncLocalPatientsToSupabase();
        if (syncResult && syncResult.synced > 0) {
          // Auto-synced patients from localStorage to Supabase (count removed for privacy)
        }
        return syncResult;
      } catch (err) {
        console.warn('⚠️ Auto-sync failed (non-critical):', err);
        return null;
      }
    }
    return null;
  }

  // Track if sync has been triggered to prevent duplicate syncs
  let autoSyncTriggered = false;
  const SYNC_COOLDOWN = 30000; // 30 seconds cooldown between syncs
  let lastAutoSync = 0;

  // Safe auto-sync function with cooldown
  async function safeTriggerAutoSync() {
    const now = Date.now();
    if (autoSyncTriggered && (now - lastAutoSync < SYNC_COOLDOWN)) {
      // Auto-sync skipped (cooldown active)
      return;
    }
    
    lastAutoSync = now;
    autoSyncTriggered = true;
    await triggerAutoSync();
    
    // Reset flag after cooldown to allow future syncs
    setTimeout(() => {
      autoSyncTriggered = false;
    }, SYNC_COOLDOWN);
  }

  // Auto-sync on page load (if user is logged in) - BUT NOT on add-patient or edit-patient pages
  // Skip sync on form pages to avoid errors with incomplete data
  const currentPath = window.location.pathname;
  const isFormPage = currentPath.includes('add-patient') || 
                     currentPath.includes('edit-patient') ||
                     document.getElementById('add-patient-form') ||
                     document.getElementById('edit-patient-form');
  
  if (!isFormPage) {
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', function() {
        setTimeout(safeTriggerAutoSync, 2000); // Wait 2 seconds for page to load
      });
    } else {
      // DOM already loaded (user already on page) - trigger immediately
      setTimeout(safeTriggerAutoSync, 2000);
    }

    // Also sync when user explicitly loads patients page (even if already logged in)
    if (currentPath.includes('patients.html') || currentPath.includes('/patients')) {
      setTimeout(safeTriggerAutoSync, 3000); // Give extra time for page to fully initialize
    }
  }

  // Also sync when page becomes visible again (user switches back to tab)
  // Only trigger once per visibility change to prevent excessive syncing
  let lastVisibilitySync = 0;
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.location.pathname.includes('patients')) {
      const now = Date.now();
      // Only sync if at least 5 seconds have passed since last visibility sync
      if (now - lastVisibilitySync > 5000) {
        lastVisibilitySync = now;
        // User switched back to patients page - sync again in case they were away
        setTimeout(triggerAutoSync, 1000);
      }
    }
  });

  // Make triggerAutoSync available globally so it can be called manually if needed
  window.triggerPatientSync = triggerAutoSync;

})();

