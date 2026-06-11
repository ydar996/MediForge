// Manual Patient Numbering Management
// Purpose: When enabled, staff may optionally override the auto patient number on applicable forms.
// Default remains the org auto scheme (e.g. MFA-SC#### for MFA Staff Clinic) when the field is left blank.

/**
 * Get the current organization's manual patient numbering setting
 * @returns {Promise<boolean>} True if manual numbering is enabled
 */
async function getManualPatientNumberingEnabled() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = user.organizationId || user.organization_id;
    
    // If orgId is not a UUID, try to resolve it from organization name
    if (!orgId || !orgId.includes('-')) {
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
      console.warn('⚠️ [MANUAL-PATIENT-NUMBERING] No organization ID found');
      return false; // Default to disabled
    }
    
    if (!window.supabaseClient) {
      console.warn('⚠️ [MANUAL-PATIENT-NUMBERING] Supabase not available, checking localStorage');
      // Fallback to localStorage
      const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      const orgName = user.org || user.organization;
      const orgData = orgs[orgName];
      if (orgData && orgData.settings && orgData.settings.manual_patient_numbering_enabled) {
        return orgData.settings.manual_patient_numbering_enabled === true;
      }
      return false;
    }
    
    // Supabase-first: Try Supabase first
    const { data, error } = await window.supabaseClient
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();
    
    if (error) {
      console.warn('⚠️ [MANUAL-PATIENT-NUMBERING] Error fetching from Supabase:', error);
      // Fallback to localStorage
      const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      const orgName = user.org || user.organization;
      const orgData = orgs[orgName];
      if (orgData && orgData.settings && orgData.settings.manual_patient_numbering_enabled) {
        return orgData.settings.manual_patient_numbering_enabled === true;
      }
      return false;
    }
    
    // Check Supabase settings
    if (data && data.settings && data.settings.manual_patient_numbering_enabled === true) {
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ [MANUAL-PATIENT-NUMBERING] Exception getting setting:', error);
    return false; // Default to disabled on error
  }
}

/**
 * Set the manual patient numbering setting for current organization
 * @param {boolean} enabled - True to enable manual numbering
 * @returns {Promise<boolean>} True if update succeeded
 */
async function setManualPatientNumberingEnabled(enabled) {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = user.organizationId || user.organization_id;
    const orgName = user.org || user.organization;
    
    // If orgId is not a UUID, try to resolve it
    if (!orgId || !orgId.includes('-')) {
      if (orgName && typeof getAllOrganizations === 'function') {
        const orgs = await getAllOrganizations();
        const orgData = orgs[orgName];
        if (orgData && orgData.id) {
          orgId = orgData.id;
        }
      }
    }
    
    if (!orgId) {
      console.error('❌ [MANUAL-PATIENT-NUMBERING] No organization ID found');
      return false;
    }
    
    // Get current settings
    let currentSettings = {};
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from('organizations')
        .select('settings')
        .eq('id', orgId)
        .single();
      
      if (!error && data && data.settings) {
        currentSettings = data.settings;
      }
    }
    
    // Update settings
    currentSettings.manual_patient_numbering_enabled = enabled;
    
    // Supabase-first: Write to Supabase first
    if (window.supabaseClient) {
      const { error } = await window.supabaseClient
        .from('organizations')
        .update({ 
          settings: currentSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgId);
      
      if (error) {
        console.error('❌ [MANUAL-PATIENT-NUMBERING] Error updating Supabase:', error);
        // Fallback: Update localStorage
        const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
        if (orgs[orgName]) {
          orgs[orgName].settings = currentSettings;
          localStorage.setItem('organizations', JSON.stringify(orgs));
        }
        return false;
      }
      
      // Cache to localStorage after successful Supabase write
      const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      if (orgs[orgName]) {
        orgs[orgName].settings = currentSettings;
        localStorage.setItem('organizations', JSON.stringify(orgs));
      }
      
      console.log(`✅ [MANUAL-PATIENT-NUMBERING] Setting updated: ${enabled ? 'ENABLED' : 'DISABLED'}`);
      return true;
    } else {
      // Fallback: localStorage only
      const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      if (orgs[orgName]) {
        orgs[orgName].settings = currentSettings;
        localStorage.setItem('organizations', JSON.stringify(orgs));
        return true;
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ [MANUAL-PATIENT-NUMBERING] Exception setting toggle:', error);
    return false;
  }
}

/**
 * Toggle the manual patient numbering setting
 * Called from dashboard button
 */
async function toggleManualPatientNumbering() {
  try {
    const currentState = await getManualPatientNumberingEnabled();
    const newState = !currentState;
    
    const confirmed = confirm(
      `Are you sure you want to ${newState ? 'ENABLE' : 'DISABLE'} manual patient numbering?\n\n` +
      `${newState ? 'When ON: new patients still get the organization default auto number (e.g. MFA-SC####) if you leave Patient/File Number blank. Fill that field only when you want to override.' : ''}` +
      `${newState ? '\n\n' : ''}` +
      `${newState ? 'ENABLED' : 'DISABLED'}: Staff can ${newState ? 'optionally enter a custom' : 'only use auto-generated'} patient number on applicable forms.\n\n` +
      `This does not change existing patients.`
    );
    
    if (!confirmed) {
      return;
    }
    
    const success = await setManualPatientNumberingEnabled(newState);
    
    if (success) {
      alert(`✅ Manual patient numbering has been ${newState ? 'ENABLED' : 'DISABLED'}.\n\n` +
            `${newState ? 'Optional Patient/File Number: leave blank for the next auto number (org default, e.g. MFA-SC####), or type a value to override.' : 'Patient numbers will be auto-generated when the field is not shown or left blank.'}`);
      
      // Update button text immediately
      await updateManualPatientNumberingButton();
    } else {
      alert('❌ Failed to update setting. Please try again.');
      // Refresh button to show correct state even on error
      await updateManualPatientNumberingButton();
    }
    
  } catch (error) {
    console.error('❌ Error toggling manual patient numbering:', error);
    alert('❌ Error: ' + error.message);
  }
}

/**
 * Update the dashboard button text based on current state
 */
async function updateManualPatientNumberingButton() {
  const btn = document.getElementById('manual-patient-numbering-btn');
  if (!btn) return;
  
  const enabled = await getManualPatientNumberingEnabled();
  
  // Clear status indicator with visual distinction
  if (enabled) {
    btn.textContent = '🔢 Manual Patient Numbering: ON';
    btn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
    btn.style.border = '2px solid #2e7d32';
    btn.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
  } else {
    btn.textContent = '🔢 Manual Patient Numbering: OFF';
    btn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    btn.style.border = '2px solid #5a67d8';
    btn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
  }
}

// Initialize button state on page load
if (typeof window !== 'undefined') {
  // Update immediately if DOM is ready
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', function() {
      updateManualPatientNumberingButton();
    });
  } else {
    // DOM already loaded
    updateManualPatientNumberingButton();
  }
  
  // Also update after full page load (in case of async data)
  window.addEventListener('load', function() {
    setTimeout(updateManualPatientNumberingButton, 500);
  });
}

// Export functions for use in other files
if (typeof window !== 'undefined') {
  window.getManualPatientNumberingEnabled = getManualPatientNumberingEnabled;
  window.setManualPatientNumberingEnabled = setManualPatientNumberingEnabled;
  window.toggleManualPatientNumbering = toggleManualPatientNumbering;
  window.updateManualPatientNumberingButton = updateManualPatientNumberingButton;
}

