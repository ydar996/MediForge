/**
 * Registration Handler for Supabase Auth
 * 
 * This script handles new user registration via Supabase Auth.
 * It creates both the auth user and the user profile.
 */

console.log('📝 Registration handler loaded');

// Global variable to track if we're in Supabase registration mode
let supabaseRegistrationEnabled = true;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, looking for register form...');
  
  // Try to find the register form (might have different IDs)
  const registerForm = document.querySelector('form[name="register-form"]') || 
                       document.getElementById('register-form') ||
                       document.querySelector('form');
  
  if (!registerForm) {
    console.log('⚠️ Register form not found on this page');
    return;
  }

  console.log('✅ Register form found:', registerForm.id || registerForm.name);

  // Check if we have Supabase client
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.error('❌ Supabase client not available!');
    console.error('Make sure supabase-client.js is loaded before this script.');
    supabaseRegistrationEnabled = false;
    return;
  }

  if (typeof registerWithSupabase === 'undefined') {
    console.error('❌ registerWithSupabase function not available!');
    console.error('Make sure supabase-auth.js is loaded before this script.');
    supabaseRegistrationEnabled = false;
    return;
  }

  console.log('✅ Supabase registration functions available');
  
  // Intercept form submission for Supabase registration
  registerForm.addEventListener('submit', async function(e) {
    // Don't prevent default yet, we might need the old handler as fallback
    
    // Only handle if Supabase is enabled
    if (!supabaseRegistrationEnabled) {
      return; // Let the old handler take over
    }
    
    // Prevent default form submission
    e.preventDefault();
    e.stopImmediatePropagation();
    
    console.log('🔐 Starting Supabase registration...');
    console.log('📋 Form ID:', registerForm.id);
    
    // Determine which form we're dealing with (new-org-form or join-org-form)
    const isNewOrgForm = registerForm.id === 'new-org-form';
    const isJoinOrgForm = registerForm.id === 'join-org-form';
    
    let username, password, firstName, lastName, gender, role, org, medicalLicenseNumber;
    let orgData = {};
    
    if (isNewOrgForm) {
      // Extract from new-org-form fields
      username = document.getElementById('new-org-username')?.value;
      password = document.getElementById('new-org-password')?.value;
      firstName = document.getElementById('new-org-first-name')?.value;
      lastName = document.getElementById('new-org-last-name')?.value;
      gender = document.getElementById('new-org-gender')?.value || 'Male';
      
      // Get role from admin-role field - respect the selected role, default to "Administrator" if empty
      const roleSelect = document.getElementById('admin-role');
      const selectedRole = roleSelect?.value || '';
      const otherRole = document.getElementById('admin-other-role')?.value?.trim() || '';
      
      // Use the selected role, or "Other" role if specified, or default to "Administrator"
      if (selectedRole === 'Other' && otherRole) {
        role = otherRole;
      } else if (selectedRole) {
        role = selectedRole;
      } else {
        role = 'Administrator'; // Default if nothing selected (matches the form default)
      }
      
      console.log('🔍 [REGISTRATION] Role selection:', {
        selectedRole: selectedRole,
        otherRole: otherRole,
        finalRole: role,
        hasRoleSelect: !!roleSelect,
        roleSelectValue: roleSelect?.value
      });
      
      org = document.getElementById('new-org-name')?.value;
      medicalLicenseNumber = document.getElementById('admin-license')?.value?.trim() || '';
      
      // Get organization details for creation
      orgData = {
        name: org,
        country: document.getElementById('new-org-country')?.value,
        state: document.getElementById('new-org-state')?.value,
        city: document.getElementById('new-org-city')?.value,
        addressLine1: document.getElementById('new-org-address1')?.value,
        addressLine2: document.getElementById('new-org-address2')?.value || '',
        phone: document.getElementById('new-org-phone')?.value || '',
        afterHoursPhone: document.getElementById('new-org-after-hours')?.value || ''
      };
    } else if (isJoinOrgForm) {
      // TRACE: Start join-org-form processing
      console.log('🔍 [TRACE] Processing join-org-form', {
        hasVerifiedOrgData: !!window.verifiedOrgData,
        verifiedOrgData: window.verifiedOrgData,
        deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });
      
      // Extract from join-org-form fields
      username = document.getElementById('join-org-username')?.value;
      password = document.getElementById('join-org-password')?.value;
      firstName = document.getElementById('join-org-first-name')?.value;
      lastName = document.getElementById('join-org-last-name')?.value;
      gender = document.getElementById('join-org-gender')?.value || 'Male';
      role = document.getElementById('join-org-role')?.value || 'Doctor';
      medicalLicenseNumber = document.getElementById('join-org-license')?.value || '';
      
      // CRITICAL FIX: Get org name AND ID from verified org data
      if (!window.verifiedOrgData) {
        console.error('❌ [TRACE] verifiedOrgData is missing! User must verify org code first.');
        alert('Please verify your organization code first by clicking the "Verify Code" button.');
        return;
      }
      
      org = window.verifiedOrgData.name;
      const verifiedOrgId = window.verifiedOrgData.id;
      
      console.log('✅ [TRACE] Using verified organization', {
        name: org,
        id: verifiedOrgId,
        org_code: window.verifiedOrgData.org_code
      });
      
      // Store organizationId for later use
      window._pendingOrgId = verifiedOrgId;
    } else {
      console.error('❌ [TRACE] Unknown form type');
      return;
    }
    
    console.log('📋 [TRACE] Registration data extracted', { 
      username, 
      firstName, 
      lastName, 
      role, 
      org,
      formType: isNewOrgForm ? 'new-org' : 'join-org',
      deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    });
    
    // Validate required fields
    if (!username || !password || !firstName || !lastName || !org) {
      alert('Please fill in all required fields');
      return;
    }
    
    // CRITICAL: Validate password strength before proceeding
    if (typeof window.validatePasswordStrength === 'function') {
      const passwordValidation = window.validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        alert('Password does not meet security requirements:\n\n' + passwordValidation.errors.join('\n') + '\n\nPlease create a stronger password.');
        return;
      }
    } else {
      // Fallback validation if function not available
      if (password.length < 12) {
        alert('Password must be at least 12 characters long.');
        return;
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        alert('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
        return;
      }
    }
    
    try {
      // First, check/create organization in Supabase
      console.log('🔍 Checking for organization:', org);
      
      const { data: existingOrg, error: orgCheckError } = await supabaseClient
        .from('organizations')
        .select('id, name')
        .eq('name', org)
        .maybeSingle();
      
      let organizationId;
      
      if (existingOrg) {
        console.log('✅ Organization found:', existingOrg.name, existingOrg.id);
        organizationId = existingOrg.id;
      } else if (isNewOrgForm) {
        // Organization doesn't exist and this is a new org registration, create it
        console.log('⚠️ Organization not found, creating:', org);
        
        // Generate org code
        const orgCode = org.substring(0, 3).toUpperCase() + '-' + 
                       new Date().getFullYear() + '-' + 
                       Math.random().toString(36).substring(2, 6).toUpperCase();
        
        // Get currency based on country
        const currencyMap = {
          'Canada': 'CAD',
          'Nigeria': 'NGN',
          'Kenya': 'KES',
          'Ghana': 'GHS',
          'South Africa': 'ZAR'
        };
        const currency = currencyMap[orgData.country] || 'CAD';
        
        const { data: newOrg, error: orgCreateError } = await supabaseClient
          .from('organizations')
          .insert({
            name: orgData.name,
            org_code: orgCode,
            country: orgData.country,
            state: orgData.state,
            city: orgData.city,
            address_line1: orgData.addressLine1,
            address_line2: orgData.addressLine2,
            phone: orgData.phone,
            after_hours_phone: orgData.afterHoursPhone,
            currency: currency
          })
          .select()
          .single();
        
        if (orgCreateError) {
          console.error('❌ Error creating organization:', orgCreateError);
          alert('Failed to create organization: ' + orgCreateError.message);
          return;
        }
        
        console.log('✅ Organization created:', newOrg.name, newOrg.id);
        console.log('🎫 Organization code:', newOrg.org_code);
        organizationId = newOrg.id;
      } else {
        // Joining an org - use verified org ID from verifiedOrgData
        if (isJoinOrgForm && window._pendingOrgId) {
          console.log('✅ [TRACE] Using verified organization ID for join-org-form:', window._pendingOrgId);
          organizationId = window._pendingOrgId;
        } else if (isJoinOrgForm && window.verifiedOrgData?.id) {
          console.log('✅ [TRACE] Using verifiedOrgData.id:', window.verifiedOrgData.id);
          organizationId = window.verifiedOrgData.id;
        } else {
          console.error('❌ [TRACE] Organization ID not found for join-org-form', {
            hasPendingOrgId: !!window._pendingOrgId,
            hasVerifiedOrgData: !!window.verifiedOrgData,
            verifiedOrgId: window.verifiedOrgData?.id
          });
          alert('Organization not found. Please verify your organization code first by clicking the "Verify Code" button.');
          return;
        }
      }
      
      // CRITICAL: Validate organizationId before proceeding
      if (!organizationId) {
        console.error('❌ [TRACE] organizationId is missing after all checks!', {
          isNewOrgForm,
          isJoinOrgForm,
          verifiedOrgData: window.verifiedOrgData
        });
        alert('Registration failed: Organization ID is missing. Please verify your organization code and try again.');
        return;
      }
      
      // Validate organizationId format (UUID)
      if (!organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error('❌ [TRACE] Invalid organizationId format:', organizationId);
        alert('Registration failed: Invalid organization ID format. Please contact support.');
        return;
      }
      
      console.log('📝 [TRACE] Registering user in Supabase...', {
        username,
        organizationId,
        role,
        deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });
      
      const result = await registerWithSupabase({
        username: username,
        password: password,
        firstName: firstName,
        lastName: lastName,
        gender: gender,
        role: role,
        organizationId: organizationId,
        medicalLicenseNumber: medicalLicenseNumber
      });
      
      console.log('📝 [TRACE] Registration result:', {
        success: result.success,
        error: result.error,
        hasUser: !!result.user
      });
      
      if (result.success) {
        console.log('✅ Registration successful!');
        
        // Show success message with org code if this was a new org registration
        if (isNewOrgForm && organizationId) {
          // Get the org code from Supabase
          const { data: orgData } = await supabaseClient
            .from('organizations')
            .select('org_code, name')
            .eq('id', organizationId)
            .single();
          
          if (orgData && orgData.org_code) {
            // Hide the form and show success message with org code
            registerForm.style.display = 'none';
            
            // Create success display
            const successDiv = document.createElement('div');
            successDiv.style.cssText = 'text-align: center; padding: 30px; background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; margin: 20px;';
            successDiv.innerHTML = `
              <h2 style="color: #0369a1; margin-bottom: 20px;">✅ Registration Successful!</h2>
              <p style="font-size: 16px; margin-bottom: 30px;">Your organization <strong>${orgData.name}</strong> has been created.</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 500px; border: 2px dashed #0ea5e9;">
                <p style="font-size: 14px; color: #64748b; margin-bottom: 10px;">Your Organization Code:</p>
                <input 
                  type="text" 
                  id="org-code-display" 
                  value="${orgData.org_code}" 
                  readonly 
                  style="font-size: 24px; font-weight: bold; font-family: monospace; text-align: center; width: 100%; padding: 15px; border: 2px solid #0ea5e9; border-radius: 6px; background: #f8fafc; color: #0369a1; cursor: text;"
                  onclick="this.select()"
                >
                <button 
                  onclick="
                    const codeInput = document.getElementById('org-code-display');
                    codeInput.select();
                    document.execCommand('copy');
                    this.textContent = '✅ Copied!';
                    setTimeout(() => this.textContent = '📋 Copy Code', 2000);
                  "
                  style="margin-top: 15px; padding: 12px 24px; background: #0ea5e9; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s;"
                  onmouseover="this.style.background='#0284c7'"
                  onmouseout="this.style.background='#0ea5e9'"
                >
                  📋 Copy Code
                </button>
              </div>
              
              <div style="background: #fffbeb; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 500px; text-align: left;">
                <p style="font-size: 14px; color: #92400e; margin: 0;">
                  <strong>📝 IMPORTANT:</strong> Save this code! Share it with staff members so they can join your organization using the "Join Existing Organization" option.
                </p>
              </div>
              
              <div style="margin-top: 30px;">
                <p style="font-size: 16px; color: #64748b; margin-bottom: 15px;">
                  You can now login with username: <strong style="color: #0369a1;">${username}</strong>
                </p>
                <button 
                  onclick="window.location.href='/login'"
                  style="padding: 14px 32px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 18px; font-weight: 600; cursor: pointer; transition: all 0.3s;"
                  onmouseover="this.style.background='#059669'"
                  onmouseout="this.style.background='#10b981'"
                >
                  Proceed to Login →
                </button>
              </div>
            `;
            
            // Insert after the form
            registerForm.parentElement.appendChild(successDiv);
            
            // Scroll to top
            window.scrollTo(0, 0);
            
            return; // Don't redirect automatically
          }
        }
        
        // For join org registration or if org code fetch failed
        alert('Registration successful! You can now login with your username and password.');
        window.location.href = '/login';
      } else {
        console.error('❌ Registration failed:', result.error);
        
        // Check if error is username-related and show a more prominent alert
        const errorMessage = result.error || 'Unknown error';
        if (errorMessage.toLowerCase().includes('username') && 
            (errorMessage.toLowerCase().includes('taken') || 
             errorMessage.toLowerCase().includes('already'))) {
          // Username taken error - show prominent alert
          alert('❌ USERNAME ALREADY TAKEN\n\n' +
                'The username "' + username + '" is already in use.\n\n' +
                'Please choose a different username and try again.');
          
          // Highlight the username field if it exists
          const usernameField = isNewOrgForm ? 
            document.getElementById('new-org-username') : 
            document.getElementById('join-org-username');
          if (usernameField) {
            usernameField.style.border = '2px solid #dc3545';
            usernameField.style.backgroundColor = '#fff5f5';
            usernameField.focus();
            usernameField.select();
            
            // Remove highlight after 5 seconds
            setTimeout(() => {
              usernameField.style.border = '';
              usernameField.style.backgroundColor = '';
            }, 5000);
          }
        } else {
          // Other errors - show standard alert
          alert('Registration failed: ' + errorMessage);
        }
      }
      
    } catch (error) {
      console.error('❌ Registration error:', error);
      alert('Registration error: ' + error.message);
    }
  }, true); // Use capture phase to run before other handlers
  
  console.log('✅ Supabase registration handler attached');
});

/**
 * Helper function to register user directly in Supabase
 * (Can be called programmatically if needed)
 */
async function registerUserInSupabase(userData) {
  try {
    console.log('Registering user in Supabase:', userData.username);

    // First, check if organization exists
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('id, name')
      .eq('name', userData.org)
      .maybeSingle();

    if (orgError) {
      console.error('Error checking organization:', orgError);
      throw new Error('Could not verify organization: ' + orgError.message);
    }

    if (!org) {
      throw new Error(
        `Organization "${userData.org}" not found in Supabase.\n\n` +
        'Please ask your administrator to create the organization first.'
      );
    }

    console.log('Organization found:', org.name, org.id);

    // Create user via Supabase Auth
    const result = await registerWithSupabase({
      username: userData.username,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      gender: userData.gender || 'Male',
      role: userData.role,
      organizationId: org.id,
      medicalLicenseNumber: userData.medicalLicenseNumber || ''
    });

    if (!result.success) {
      throw new Error(result.error || 'Registration failed');
    }

    console.log('✅ User registered successfully in Supabase');
    return { success: true, user: result.user };

  } catch (error) {
    console.error('Supabase registration error:', error);
    return { success: false, error: error.message };
  }
}

// Export for use elsewhere
if (typeof window !== 'undefined') {
  window.registerUserInSupabase = registerUserInSupabase;
}

console.log('✅ Registration handler module loaded');

