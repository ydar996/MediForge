// Emergency Contact Requirements Management
// Purpose: Allow organizations to make emergency contact fields optional or required
// When disabled, emergency contact fields become optional instead of mandatory

/**
 * Get the current organization's emergency contact required setting
 * @returns {Promise<boolean>} True if emergency contact is required (default), false if optional
 */
async function getEmergencyContactRequired() {
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
      console.warn('⚠️ [EMERGENCY-CONTACT] No organization ID found, defaulting to required');
      return true; // Default to required for backward compatibility
    }
    
    if (!window.supabaseClient) {
      console.warn('⚠️ [EMERGENCY-CONTACT] Supabase not available, checking localStorage');
      // Fallback to localStorage
      const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      const orgName = user.org || user.organization;
      const orgData = orgs[orgName];
      if (orgData && orgData.settings && orgData.settings.emergency_contact_required !== undefined) {
        const settingValue = orgData.settings.emergency_contact_required;
        console.log(`🔍 [EMERGENCY-CONTACT] Read from localStorage (Supabase error fallback): ${settingValue} (${typeof settingValue})`);
        return settingValue === true || settingValue === 'true';
      }
      return true; // Default to required
    }
    
    // Supabase-first: Try Supabase first
    const { data, error } = await window.supabaseClient
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();
    
    if (error) {
      console.warn('⚠️ [EMERGENCY-CONTACT] Error fetching from Supabase:', error);
      // Fallback to localStorage
      const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      const orgName = user.org || user.organization;
      const orgData = orgs[orgName];
      if (orgData && orgData.settings && orgData.settings.emergency_contact_required !== undefined) {
        const settingValue = orgData.settings.emergency_contact_required;
        console.log(`🔍 [EMERGENCY-CONTACT] Read from localStorage (no Supabase): ${settingValue} (${typeof settingValue})`);
        return settingValue === true || settingValue === 'true';
      }
      return true; // Default to required
    }
    
    // Check Supabase settings
    if (data && data.settings) {
      // Return the actual boolean value (true = required, false = optional)
      // If explicitly set to false, return false (optional)
      // If explicitly set to true, return true (required)
      // If undefined, default to true (required for backward compatibility)
      if (data.settings.emergency_contact_required !== undefined) {
        const settingValue = data.settings.emergency_contact_required;
        console.log(`🔍 [EMERGENCY-CONTACT] Read from Supabase: ${settingValue} (${typeof settingValue})`);
        return settingValue === true || settingValue === 'true';
      }
    }
    
    return true; // Default to required for backward compatibility
    
  } catch (error) {
    console.error('❌ [EMERGENCY-CONTACT] Exception getting setting:', error);
    return true; // Default to required on error
  }
}

/**
 * Set the emergency contact required setting for current organization
 * @param {boolean} required - True to make emergency contact required, false to make it optional
 * @returns {Promise<boolean>} True if update succeeded
 */
async function setEmergencyContactRequired(required) {
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
      console.error('❌ [EMERGENCY-CONTACT] No organization ID found');
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
    
    // Update settings - explicitly set to boolean true or false
    currentSettings.emergency_contact_required = required === true;
    
    console.log(`💾 [EMERGENCY-CONTACT] Saving setting: ${required === true} (${required === true ? 'REQUIRED' : 'OPTIONAL'})`);
    console.log(`💾 [EMERGENCY-CONTACT] Full settings object:`, JSON.stringify(currentSettings, null, 2));
    
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
        console.error('❌ [EMERGENCY-CONTACT] Error updating Supabase:', error);
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
      
      console.log(`✅ [EMERGENCY-CONTACT] Setting updated in Supabase: ${required === true ? 'REQUIRED' : 'OPTIONAL'}`);
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
    console.error('❌ [EMERGENCY-CONTACT] Exception setting toggle:', error);
    return false;
  }
}

/**
 * Toggle the emergency contact required setting
 * Called from dashboard button
 */
async function toggleEmergencyContactRequired() {
  try {
    const currentState = await getEmergencyContactRequired();
    const newState = !currentState;
    
    console.log(`🔄 [EMERGENCY-CONTACT] Toggling from ${currentState ? 'REQUIRED' : 'OPTIONAL'} to ${newState ? 'REQUIRED' : 'OPTIONAL'}`);
    
    const confirmed = confirm(
      `Are you sure you want to make emergency contact fields ${newState ? 'REQUIRED' : 'OPTIONAL'}?\n\n` +
      `${newState ? 'REQUIRED' : 'OPTIONAL'}: Emergency contact information will be ${newState ? 'mandatory' : 'optional'} when adding/editing patients.\n\n` +
      `This affects:\n` +
      `- Emergency contact name (first & last)\n` +
      `- Emergency contact phone\n` +
      `- Emergency contact email\n` +
      `- Emergency contact address (country, state, city, address line 1)\n\n` +
      `This setting applies to all users in your organization.`
    );
    
    if (!confirmed) {
      return;
    }
    
    const success = await setEmergencyContactRequired(newState);
    
    if (success) {
      console.log(`✅ [EMERGENCY-CONTACT] Successfully saved setting: ${newState ? 'REQUIRED' : 'OPTIONAL'}`);
      alert(`✅ Emergency contact fields are now ${newState ? 'REQUIRED' : 'OPTIONAL'}.\n\n` +
            `${newState ? 'Users must fill in all emergency contact information when adding/editing patients.' : 'Users can skip emergency contact information when adding/editing patients.'}\n\n` +
            `Please refresh the add/edit patient pages for the change to take effect.`);
      
      // Update button text immediately
      await updateEmergencyContactRequiredButton();
    } else {
      console.error('❌ [EMERGENCY-CONTACT] Failed to save setting');
      alert('❌ Failed to update setting. Please try again.');
      // Refresh button to show correct state even on error
      await updateEmergencyContactRequiredButton();
    }
    
  } catch (error) {
    console.error('❌ Error toggling emergency contact required:', error);
    alert('❌ Error: ' + error.message);
  }
}

/**
 * Update the dashboard button text based on current state
 */
async function updateEmergencyContactRequiredButton() {
  const btn = document.getElementById('emergency-contact-required-btn');
  if (!btn) return;
  
  const required = await getEmergencyContactRequired();
  
  // Update button text and styling
  if (required) {
    btn.textContent = '📞 Emergency Contact: REQUIRED';
    btn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
    btn.style.border = '2px solid #2e7d32';
    btn.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
  } else {
    btn.textContent = '📞 Emergency Contact: OPTIONAL';
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
      updateEmergencyContactRequiredButton();
    });
  } else {
    // DOM already loaded
    updateEmergencyContactRequiredButton();
  }
  
  // Also update after full page load (in case of async data)
  window.addEventListener('load', function() {
    setTimeout(updateEmergencyContactRequiredButton, 500);
  });
}

// Export functions for use in other files
if (typeof window !== 'undefined') {
  window.getEmergencyContactRequired = getEmergencyContactRequired;
  window.setEmergencyContactRequired = setEmergencyContactRequired;
  window.toggleEmergencyContactRequired = toggleEmergencyContactRequired;
  window.updateEmergencyContactRequiredButton = updateEmergencyContactRequiredButton;
}

