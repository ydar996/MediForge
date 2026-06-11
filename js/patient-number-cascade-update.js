// Patient Number Cascade Update
// Purpose: When a patient number is updated, cascade the update to all related records
// Maintains hybrid architecture: Supabase-first with localStorage fallback

/**
 * Cascade update patient number across all related tables
 * @param {string} oldPatientId - The old patient ID
 * @param {string} newPatientId - The new patient ID
 * @param {string} organizationId - The organization ID
 * @returns {Promise<{success: boolean, updated: object, errors: array}>}
 */
async function cascadeUpdatePatientNumber(oldPatientId, newPatientId, organizationId) {
  const results = {
    success: true,
    updated: {},
    errors: []
  };
  
  if (!oldPatientId || !newPatientId || !organizationId) {
    results.success = false;
    results.errors.push('Missing required parameters: oldPatientId, newPatientId, or organizationId');
    return results;
  }
  
  if (oldPatientId === newPatientId) {
    // No change needed
    return results;
  }
  
  console.log(`🔄 [CASCADE-UPDATE] Updating patient number from "${oldPatientId}" to "${newPatientId}"`);
  
  // List of tables that reference patient_id
  const tablesToUpdate = [
    'appointments',
    'clinical_notes',
    'patient_encounters',
    'lab_results',
    'lab_orders',
    'prescriptions',
    'billing_invoices',
    'payments',
    'patient_documents',
    'referral_details',
    'preventive_care',
    'patient_intake_approvals'
  ];
  
  // Supabase-first: Update Supabase tables
  if (window.supabaseClient) {
    for (const tableName of tablesToUpdate) {
      try {
        // Check if table exists and has patient_id column
        const { data, error } = await window.supabaseClient
          .from(tableName)
          .update({ patient_id: newPatientId })
          .eq('patient_id', oldPatientId)
          .eq('organization_id', organizationId)
          .select();
        
        if (error) {
          // Check if it's a "table doesn't exist" error (code 42P01)
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            console.log(`ℹ️ [CASCADE-UPDATE] Table "${tableName}" does not exist, skipping`);
            continue;
          }
          
          // Check if it's a "column doesn't exist" error
          if (error.code === '42703' || error.message.includes('column') && error.message.includes('does not exist')) {
            console.log(`ℹ️ [CASCADE-UPDATE] Column "patient_id" does not exist in "${tableName}", skipping`);
            continue;
          }
          
          console.warn(`⚠️ [CASCADE-UPDATE] Error updating ${tableName}:`, error);
          results.errors.push({ table: tableName, error: error.message });
        } else if (data && data.length > 0) {
          results.updated[tableName] = data.length;
          console.log(`✅ [CASCADE-UPDATE] Updated ${data.length} record(s) in ${tableName}`);
        }
      } catch (error) {
        console.error(`❌ [CASCADE-UPDATE] Exception updating ${tableName}:`, error);
        results.errors.push({ table: tableName, error: error.message });
      }
    }
  }
  
  // Fallback: Update localStorage (for offline support)
  try {
    // Update appointments
    const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
    let appointmentsUpdated = 0;
    appointments.forEach(apt => {
      if (apt.patientId === oldPatientId || apt.patient_id === oldPatientId) {
        apt.patientId = newPatientId;
        apt.patient_id = newPatientId;
        appointmentsUpdated++;
      }
    });
    if (appointmentsUpdated > 0) {
      localStorage.setItem(getDataKey("appointments"), JSON.stringify(appointments));
      results.updated['appointments_localStorage'] = appointmentsUpdated;
    }
    
    // Update other localStorage data structures as needed
    // Note: Most clinical data is stored in the patients table itself,
    // so we don't need to update separate localStorage entries for those
    
  } catch (error) {
    console.warn('⚠️ [CASCADE-UPDATE] Error updating localStorage:', error);
    results.errors.push({ source: 'localStorage', error: error.message });
  }
  
  if (results.errors.length > 0) {
    results.success = false;
  }
  
  console.log(`✅ [CASCADE-UPDATE] Cascade update completed. Updated:`, results.updated);
  if (results.errors.length > 0) {
    console.warn(`⚠️ [CASCADE-UPDATE] Errors encountered:`, results.errors);
  }
  
  return results;
}

/**
 * Update patient number (with cascade)
 * @param {string} patientId - Current patient ID
 * @param {string} newPatientId - New patient ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updatePatientNumber(patientId, newPatientId) {
  try {
    // Get organization ID
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = user.organizationId || user.organization_id;
    
    if (!orgId) {
      const orgName = user.org || user.organization;
      if (orgName && typeof getAllOrganizations === 'function') {
        const orgs = await getAllOrganizations();
        const orgData = orgs[orgName];
        if (orgData && orgData.id) {
          orgId = orgData.id;
        }
      }
    }
    
    if (!orgId) {
      return { success: false, error: 'Organization ID not found' };
    }
    
    // Validate new patient ID uniqueness
    if (window.supabaseClient) {
      const { data: existing, error: checkError } = await window.supabaseClient
        .from('patients')
        .select('patient_id')
        .eq('organization_id', orgId)
        .eq('patient_id', newPatientId)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        return { success: false, error: 'Error checking patient ID uniqueness: ' + checkError.message };
      }
      
      if (existing && existing.patient_id !== patientId) {
        return { success: false, error: `Patient number "${newPatientId}" already exists. Please choose a different number.` };
      }
    }
    
    // Update patient record in Supabase
    if (window.supabaseClient) {
      const { error: updateError } = await window.supabaseClient
        .from('patients')
        .update({ patient_id: newPatientId, updated_at: new Date().toISOString() })
        .eq('patient_id', patientId)
        .eq('organization_id', orgId);
      
      if (updateError) {
        return { success: false, error: 'Error updating patient: ' + updateError.message };
      }
    }
    
    // Cascade update to related tables
    const cascadeResult = await cascadeUpdatePatientNumber(patientId, newPatientId, orgId);
    
    if (!cascadeResult.success) {
      console.warn('⚠️ Some cascade updates failed:', cascadeResult.errors);
      // Still return success if patient record was updated
    }
    
    // Update localStorage
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patientIndex = patients.findIndex(p => p.id === patientId || p.patient_id === patientId);
    if (patientIndex !== -1) {
      patients[patientIndex].id = newPatientId;
      patients[patientIndex].patient_id = newPatientId;
      localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    }
    
    return { 
      success: true, 
      cascadeResults: cascadeResult,
      message: `Patient number updated successfully. Updated ${Object.keys(cascadeResult.updated).length} related table(s).`
    };
    
  } catch (error) {
    console.error('❌ [UPDATE-PATIENT-NUMBER] Exception:', error);
    return { success: false, error: error.message };
  }
}

// Export functions
if (typeof window !== 'undefined') {
  window.cascadeUpdatePatientNumber = cascadeUpdatePatientNumber;
  window.updatePatientNumber = updatePatientNumber;
}




















