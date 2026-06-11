// Patient Authentication Functions
// Handles patient login, registration, and password management

/**
 * Patient login function
 * @param {string} username - Username or email
 * @param {string} password - Password (can be temporary password)
 * @returns {Promise<{success: boolean, error?: string, passwordResetRequired?: boolean}>}
 */
window.patientLogin = async function(username, password) {
  // Sanitize identifier for rate limit key (defense in depth if validation.js not loaded)
  const identifier = (typeof window.Validation !== 'undefined' && window.Validation.sanitizeString)
    ? window.Validation.sanitizeString((username || '').trim().toLowerCase(), 254)
    : (username || '').trim().toLowerCase();
  try {
    if (!window.supabaseClient) {
      throw new Error('Database connection not available');
    }

    // Check rate limit before attempting login
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      const rateLimitCheck = await window.rateLimiter.checkRateLimit('patient_login', identifier);
      if (!rateLimitCheck.allowed) {
        const msg = rateLimitCheck.locked
          ? `Too many failed attempts. Please try again in ${Math.ceil((rateLimitCheck.resetAt - new Date()) / (1000 * 60))} minutes.`
          : `Too many login attempts. Please try again after ${Math.ceil((rateLimitCheck.resetAt - new Date()) / (1000 * 60))} minutes.`;
        if (typeof logAuditEvent === 'function') {
          logAuditEvent('rate_limit_exceeded', { type: 'patient_login', identifier });
        }
        return { success: false, error: msg };
      }
    }

    let user = null;
    let userError = null;
    const idTrim = (username || '').trim();
    const looksLikeEmail = idTrim.includes('@');

    if (typeof window.lookupUserPublicLogin === 'function') {
      const tryUser = async (type) =>
        window.lookupUserPublicLogin(window.supabaseClient, idTrim, type, 'Patient');
      if (looksLikeEmail) {
        const e1 = await tryUser('email');
        user = e1.data;
        userError = e1.error;
        if (!user && !userError) {
          const e2 = await tryUser('username');
          user = e2.data;
          userError = e2.error;
        }
      } else {
        const u1 = await tryUser('username');
        user = u1.data;
        userError = u1.error;
        if (!user && !userError) {
          const u2 = await tryUser('email');
          user = u2.data;
          userError = u2.error;
        }
      }
    } else {
      const rpc = async (type) => {
        const res = await window.supabaseClient.rpc('lookup_user_public_login', {
          p_identifier: idTrim,
          p_type: type,
          p_role: 'Patient'
        });
        if (res.error) return { data: null, error: res.error };
        const row = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
        return { data: row, error: null };
      };
      const first = looksLikeEmail ? await rpc('email') : await rpc('username');
      user = first.data;
      userError = first.error;
      if (!user && !userError && !looksLikeEmail) {
        const second = await rpc('email');
        user = second.data;
        userError = second.error;
      } else if (!user && !userError && looksLikeEmail) {
        const second = await rpc('username');
        user = second.data;
        userError = second.error;
      }
    }

    if (userError) {
      console.error('Error finding patient user:', userError);
      if (typeof window.rateLimiter !== 'undefined') {
        await window.rateLimiter.recordFailedAttempt('patient_login', identifier);
      }
      throw new Error('Login failed. Please try again.');
    }

    if (!user) {
      if (typeof window.rateLimiter !== 'undefined') {
        await window.rateLimiter.recordFailedAttempt('patient_login', identifier);
      }
      throw new Error('Invalid username or password');
    }

    // Check if user has a patient_id (required for patient portal)
    if (!user.patient_id) {
      if (typeof window.rateLimiter !== 'undefined') {
        await window.rateLimiter.recordFailedAttempt('patient_login', identifier);
      }
      throw new Error('Patient account not properly linked. Please contact your clinic.');
    }

    // Verify password via Supabase Auth
    // Get user's email (from userData or construct it)
    const userEmail = user.email || `${user.username}@patient.ehrapp.local`;
    
    // Try to sign in with Supabase Auth
    const { data: authData, error: authError } = await window.supabaseClient.auth.signInWithPassword({
      email: userEmail,
      password: password
    });

    if (authError) {
      // If auth fails, check if it's a temp_password (for first login)
      if (user.temp_password && password === user.temp_password) {
        // Temporary password used - authenticate with it
        const { data: tempAuthData, error: tempAuthError } = await window.supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: user.temp_password
        });

        if (tempAuthError) {
          if (typeof window.rateLimiter !== 'undefined') {
            await window.rateLimiter.recordFailedAttempt('patient_login', identifier);
          }
          throw new Error('Invalid username or password');
        }

        // Success with temp password - clear rate limit
        if (typeof window.rateLimiter !== 'undefined') {
          await window.rateLimiter.clearRateLimit('patient_login', identifier);
        }

        // Mark as requiring reset
        await window.supabaseClient
          .from('users')
          .update({ password_reset_required: true })
          .eq('id', user.id);
        
        // Set user session
        const userData = {
          id: user.id,
          username: user.username,
          email: user.email || userEmail,
          role: 'Patient',  // Use capitalized 'Patient' to match CHECK constraint
          patientId: user.patient_id,
          passwordResetRequired: true
        };
        
        localStorage.setItem('user', JSON.stringify(userData));
        
        return {
          success: true,
          passwordResetRequired: true
        };
      } else {
        if (typeof window.rateLimiter !== 'undefined') {
          await window.rateLimiter.recordFailedAttempt('patient_login', identifier);
        }
        throw new Error('Invalid username or password');
      }
    }

    // Successfully authenticated with Supabase Auth - clear rate limit
    if (typeof window.rateLimiter !== 'undefined') {
      await window.rateLimiter.clearRateLimit('patient_login', identifier);
    }

    // Successfully authenticated with Supabase Auth
    // authData.user and authData.session are now available

    // Check if password reset is required
    if (user.password_reset_required) {
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: 'Patient',  // Use capitalized 'Patient' to match CHECK constraint
        patientId: user.patient_id,
        passwordResetRequired: true
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      
      return {
        success: true,
        passwordResetRequired: true
      };
    }

    // Successful login - set user session
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: 'Patient',  // Use capitalized 'Patient' to match CHECK constraint
      patientId: user.patient_id,
      passwordResetRequired: false
    };
    
    localStorage.setItem('user', JSON.stringify(userData));

    // Update last_login
    await window.supabaseClient
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_portal_login', {
        patientId: user.patient_id,
        username: user.username
      });
    }

    return {
      success: true,
      passwordResetRequired: false
    };

  } catch (error) {
    console.error('Patient login error:', error);
    return {
      success: false,
      error: error.message || 'Login failed'
    };
  }
};

/**
 * Change patient password
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @param {string} confirmPassword - Confirm new password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
window.patientChangePassword = async function(currentPassword, newPassword, confirmPassword) {
  try {
    if (!window.supabaseClient) {
      throw new Error('Database connection not available');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.id || user.role !== 'Patient') {
      throw new Error('Not authenticated as patient');
    }

    // Get current user data from users table
    const { data: userData, error: fetchError } = await window.supabaseClient
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError || !userData) {
      throw new Error('User not found');
    }

    // Get user's email from userData or construct it
    const userEmail = userData.email || user.email || `${user.username}@patient.ehrapp.local`;

    // If password reset is required, sign in with temp_password first
    // Otherwise, verify current password via Supabase Auth
    if (userData.password_reset_required) {
      // Sign in with temp password to get an auth session
      if (userData.temp_password) {
        const { error: signInError } = await window.supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: userData.temp_password
        });

        if (signInError) {
          throw new Error(`Failed to authenticate: ${signInError.message}`);
        }
      }
    } else {
      // Verify current password by attempting to sign in
      const { error: signInError } = await window.supabaseClient.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }
    }

    // Now update password in Supabase Auth (requires authenticated session)
    const { error: authUpdateError } = await window.supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (authUpdateError) {
      throw new Error(`Failed to update password: ${authUpdateError.message}`);
    }

    // Update password_reset_required and temp_password in users table
    const { error: updateError } = await window.supabaseClient
      .from('users')
      .update({
        password_reset_required: false,
        temp_password: null
      })
      .eq('id', user.id);

    if (updateError) {
      // Password was updated in Auth, but users table update failed
      // This is not critical, but log it
      console.warn('Password updated in Auth, but users table update failed:', updateError);
    }

    // Update local user data
    user.passwordResetRequired = false;
    localStorage.setItem('user', JSON.stringify(user));

    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_password_changed', {
        patientId: user.patientId,
        username: user.username
      });
    }

    return {
      success: true
    };

  } catch (error) {
    console.error('Password change error:', error);
    return {
      success: false,
      error: error.message || 'Failed to change password'
    };
  }
};

/**
 * Get current patient user
 * @returns {Object|null}
 */
window.getCurrentPatient = function() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'Patient' && user.patientId) {
      return user;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Ensure user is authenticated as patient
 * @returns {Object}
 * @throws {Error}
 */
window.ensurePatientAccess = function() {
  const patient = window.getCurrentPatient();
  if (!patient) {
    window.location.href = '/patient-login';
    throw new Error('Patient authentication required');
  }
  return patient;
};


