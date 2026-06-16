/**
 * Supabase Authentication Helper
 * 
 * This module handles all authentication operations using Supabase Auth.
 * It replaces the old localStorage-based authentication.
 * 
 * Features:
 * - Login via Supabase Auth
 * - Logout and session management
 * - Get current user info
 * - Check authentication status
 * - Link to user profile in public.users table
 */

// ============================================
// LOGIN FUNCTION
// ============================================

async function kickoffPhysicianVerificationClock(profileData) {
  if (!profileData || !profileData.id || !profileData.organization_id) return;
  if (typeof window.ensurePhysicianVerificationRecordForProfile === 'function') {
    await window.ensurePhysicianVerificationRecordForProfile(profileData);
  }
}

/** Build localStorage session from public.users row (keeps phone + license in sync). */
function buildUserSessionFromProfile(profileData, authUser) {
  const org = profileData.organizations;
  return {
    authUserId: authUser?.id || profileData.auth_user_id,
    email: authUser?.email || profileData.email,
    firstName: profileData.first_name,
    lastName: profileData.last_name,
    username: profileData.username,
    gender: profileData.gender,
    role: profileData.role,
    org: org?.name || 'Platform',
    organizationId: profileData.organization_id,
    phone: profileData.phone || '',
    medicalLicenseNumber: profileData.license_number || profileData.medical_license_number || '',
    orgAddressLine1: org?.address_line1 || '',
    orgAddressLine2: org?.address_line2 || '',
    orgCity: org?.city || '',
    orgState: org?.state || '',
    orgCountry: org?.country || '',
    orgPhone: org?.phone || '',
    afterHoursPhone: org?.after_hours_phone || ''
  };
}

/**
 * Log in a user with Supabase Auth
 * @param {string} email - User's email (format: username@temp.ehrapp.local)
 * @param {string} password - User's password
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
async function loginWithSupabase(email, password) {
  console.log('🔍 TRACE: loginWithSupabase called with email:', email);
  console.log('🔍 TRACE: supabaseClient exists:', !!supabaseClient);
  console.log('🔍 TRACE: supabaseClient type:', typeof supabaseClient);
  console.log('🔍 TRACE: supabaseClient.auth exists:', !!supabaseClient?.auth);
  console.log('🔍 TRACE: supabaseClient.auth.signInWithPassword exists:', !!supabaseClient?.auth?.signInWithPassword);
  
  try {
    if (!supabaseClient) {
      console.log('🔍 TRACE: Supabase client not initialized - returning error');
      return { success: false, error: 'Supabase client not initialized' };
    }

    // Check rate limit before attempting login
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      const rateLimitCheck = await window.rateLimiter.checkRateLimit('login', email);
      
      if (!rateLimitCheck.allowed) {
        let errorMsg;
        
        if (rateLimitCheck.permanentLock) {
          errorMsg = 'Account permanently locked due to too many failed login attempts. Please contact your administrator to unlock your account.';
        } else if (rateLimitCheck.locked) {
          errorMsg = `Account temporarily locked due to too many failed login attempts. Please try again in ${Math.ceil((rateLimitCheck.resetAt - new Date()) / (1000 * 60))} minutes.`;
        } else {
          errorMsg = `Too many login attempts. Please try again after ${Math.ceil((rateLimitCheck.resetAt - new Date()) / (1000 * 60))} minutes.`;
        }
        
        console.warn('⚠️ Login rate limit exceeded for:', email, 'Permanent lock:', rateLimitCheck.permanentLock);
        
        // Log rate limit violation with IP address
        if (typeof window.logAuditEvent === 'function') {
          window.logAuditEvent('rate_limit_exceeded', {
            type: 'login',
            identifier: email,
            locked: rateLimitCheck.locked,
            permanent_lock: rateLimitCheck.permanentLock,
            locked_at: rateLimitCheck.lockedAt ? rateLimitCheck.lockedAt.toISOString() : null,
            locked_by: rateLimitCheck.lockedBy || null
          });
        }
        
        return { success: false, error: errorMsg, rateLimited: true, permanentLock: rateLimitCheck.permanentLock };
      }
    }

    console.log('🔍 TRACE: Supabase client available, attempting login...');
    console.log('Attempting login for:', email);

    // Sign in with Supabase Auth
    console.log('🔍 TRACE: Calling signInWithPassword...');
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    console.log('🔍 TRACE: signInWithPassword response received');
    console.log('🔍 TRACE: data:', data);
    console.log('🔍 TRACE: error:', error);

    if (error) {
      console.error('Supabase Auth error:', error);
      
      // CRITICAL FIX: Check if this might be a temporary password
      // If Supabase Auth login fails, check if password matches temp_password in users table
      // This allows username-only login with temporary passwords
      if (error.message && (error.message.includes('Invalid login credentials') || error.message.includes('Invalid'))) {
        try {
          // Look up user by email to check for temp_password
          let userData = null;
          let userError = null;
          if (typeof window.lookupUserPublicLogin === 'function') {
            const r = await window.lookupUserPublicLogin(supabaseClient, email, 'email', null);
            userData = r.data;
            userError = r.error;
          } else {
            const res = await supabaseClient.rpc('lookup_user_public_login', {
              p_identifier: email,
              p_type: 'email',
              p_role: null
            });
            userError = res.error;
            userData = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
          }
          
          if (!userError && userData && userData.temp_password && password === userData.temp_password) {
            console.log('✅ Temporary password matches - authenticating user');
            
            // Temporary password is correct - we need to sign them in
            // Try to sign in with temp password (it should work if it was set in Auth)
            // If that fails, we'll need to use a different approach
            
            // First, try to sign in with the temp password directly
            const { data: tempAuthData, error: tempAuthError } = await supabaseClient.auth.signInWithPassword({
              email: email,
              password: userData.temp_password
            });
            
            if (!tempAuthError && tempAuthData) {
              console.log('✅ Successfully authenticated with temporary password');
              // Continue with normal login flow below
              // We'll set passwordResetRequired flag
              const profileData = userData;
              profileData.password_reset_required = true;
              
              // Get full profile
              const { data: fullProfile, error: profileError } = await supabaseClient
                .from('users')
                .select(`
                  *,
                  organizations (
                    id,
                    name,
                    country,
                    currency,
                    org_code
                  )
                `)
                .eq('auth_user_id', tempAuthData.user.id)
                .single();
              
              if (!profileError && fullProfile) {
                const userSession = {
                  ...buildUserSessionFromProfile(fullProfile, tempAuthData.user),
                  id: fullProfile.id,
                  passwordResetRequired: true
                };
                
                localStorage.setItem('user', JSON.stringify(userSession));
                localStorage.setItem('lastActivity', Date.now().toString());
                localStorage.setItem('supabase_session', JSON.stringify(tempAuthData.session));

                await kickoffPhysicianVerificationClock(fullProfile);
                
                // Clear rate limit
                if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
                  await window.rateLimiter.clearRateLimit('login', email);
                }
                
                return {
                  success: true,
                  user: userSession,
                  session: tempAuthData.session,
                  passwordResetRequired: true
                };
              }
            } else {
              console.warn('⚠️ Temp password matches in DB but Supabase Auth login failed:', tempAuthError);
              // Password might not be set in Supabase Auth yet
              // This is a known limitation - admin needs to use server-side function
              // For now, we'll show a helpful error
              return {
                success: false,
                error: 'Temporary password found, but authentication failed. Please contact your administrator to ensure the password was properly set in the system.'
              };
            }
          }
        } catch (tempPasswordCheckError) {
          console.warn('⚠️ Error checking temporary password:', tempPasswordCheckError);
          // Continue with normal error handling
        }
      }
      
      // Record failed login attempt for rate limiting
      if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
        await window.rateLimiter.recordFailedAttempt('login', email);
      }
      
      // Get attempt count from rate limiter before logging
      let attemptCount = null;
      let rateLimitCheck = null;
      if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
        try {
          rateLimitCheck = await window.rateLimiter.checkRateLimit('login', email);
          attemptCount = 5 - (rateLimitCheck.remaining || 0); // Calculate attempts made
        } catch (err) {
          // Ignore errors
        }
      }
      
      // Log failed login attempt with detailed information
      if (typeof window.logAuditEvent === 'function') {
        window.logAuditEvent('login_failed', {
          email: email,
          error: error.message,
          attempt_count: attemptCount,
          ip_address: null, // Will be populated by proxy
          user_agent: navigator.userAgent
        });
        
               // Alert platform admins if account gets locked
               if (rateLimitCheck && rateLimitCheck.permanentLock) {
                 if (typeof window.alertAccountLockout === 'function') {
                   await window.alertAccountLockout(email, attemptCount || 5);
                 }
                 // Optional email notification (additive - gracefully fails if not configured)
                 if (typeof window.sendSecurityEmail === 'function') {
                   try {
                     await window.sendSecurityEmail('account_lockout', {
                       identifier: email,
                       attempt_count: attemptCount || 5,
                       timestamp: new Date().toISOString(),
                       ip_address: null, // Will be populated by proxy if available
                       lockout_type: 'permanent'
                     }, 'high');
                   } catch (emailError) {
                     // Don't fail if email fails - email is optional
                     console.warn('⚠️ Email notification failed (non-critical):', emailError);
                   }
                 }
               }
      }
      
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'No user data returned' };
    }

    console.log('Supabase Auth successful for:', data.user.email);

    // CRITICAL: Clear rate limit on successful login (syncs across all devices)
    // This ensures that successful login clears lockout on Supabase AND localStorage
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      await window.rateLimiter.clearRateLimit('login', email);
      // Also clear for username format if email was used
      if (email.includes('@')) {
        const username = email.split('@')[0];
        await window.rateLimiter.clearRateLimit('login', username);
      }
    }

    // Get user profile from public.users table
    const { data: profileData, error: profileError } = await supabaseClient
      .from('users')
      .select(`
        *,
        organizations (
          id,
          name,
          country,
          currency,
          org_code
        )
      `)
      .eq('auth_user_id', data.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return { 
        success: false, 
        error: 'Could not load user profile. Please contact administrator.' 
      };
    }

    if (!profileData) {
      return { 
        success: false, 
        error: 'User profile not found. Please contact administrator.' 
      };
    }

    console.log('User profile loaded:', profileData);

    const userSession = buildUserSessionFromProfile(profileData, data.user);

    // Check if password reset is required (after getting profile data)
    if (profileData.password_reset_required) {
      // Store session with password reset flag
      userSession.passwordResetRequired = true;
      localStorage.setItem('user', JSON.stringify(userSession));
      localStorage.setItem('lastActivity', Date.now().toString());
      localStorage.setItem('supabase_session', JSON.stringify(data.session));
      
      // Store session token in secure cookie (with localStorage fallback)
      if (typeof window.storeSessionToken === 'function') {
        const sessionToken = data.session?.access_token || data.user?.id || Date.now().toString();
        window.storeSessionToken(sessionToken);
      }
      
      // Clear rate limit on successful login
      if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
        await window.rateLimiter.clearRateLimit('login', email);
      }
      
      // Log audit event
      if (typeof logAuditEvent !== 'undefined') {
        logAuditEvent('user_login_supabase_password_reset_required', {
          username: profileData.username,
          role: profileData.role,
          org: profileData.organizations?.name || 'Platform',
          authMethod: 'supabase',
          requires_password_change: true
        });
      }

      await kickoffPhysicianVerificationClock(profileData);
      
      return { 
        success: true, 
        user: userSession,
        session: data.session,
        passwordResetRequired: true
      };
    }

    // Store session
    localStorage.setItem('user', JSON.stringify(userSession));
    localStorage.setItem('lastActivity', Date.now().toString());
    localStorage.setItem('supabase_session', JSON.stringify(data.session));
    
    // Store session token in secure cookie (with localStorage fallback)
    // This provides enhanced security while maintaining backward compatibility
    if (typeof window.storeSessionToken === 'function') {
      const sessionToken = data.session?.access_token || data.user?.id || Date.now().toString();
      window.storeSessionToken(sessionToken);
    }

    // Clear rate limit on successful login
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      await window.rateLimiter.clearRateLimit('login', email);
    }

    // Log audit event
    if (typeof logAuditEvent !== 'undefined') {
      logAuditEvent('user_login_supabase', {
        username: profileData.username,
        role: profileData.role,
        org: profileData.organizations?.name || 'Platform',
        authMethod: 'supabase'
      });
    }

    await kickoffPhysicianVerificationClock(profileData);

    return { 
      success: true, 
      user: userSession,
      session: data.session
    };

  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred during login' 
    };
  }
}

// ============================================
// LOGOUT FUNCTION
// ============================================

/**
 * Log out the current user
 */
async function logoutFromSupabase() {
  try {
    if (!supabaseClient) {
      console.warn('Supabase client not initialized');
      // Still clear local session
      localStorage.removeItem('user');
      localStorage.removeItem('supabase_session');
      localStorage.removeItem('lastActivity');
      return { success: true };
    }

    // Get current user for audit log
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Sign out from Supabase
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error('Supabase logout error:', error);
    }

    // Log audit event
    if (typeof logAuditEvent !== 'undefined' && currentUser.username) {
      logAuditEvent('user_logout_supabase', {
        username: currentUser.username,
        authMethod: 'supabase'
      });
    }

    // Clear encryption key from memory (security)
    if (typeof window.encryptionService !== 'undefined' && window.encryptionService) {
      window.encryptionService.clearKey();
    }

    // Clear all session data
    localStorage.removeItem('user');
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('lastActivity');

    console.log('Logged out successfully');

    return { success: true };

  } catch (error) {
    console.error('Logout error:', error);
    // Clear encryption key from memory (security)
    if (typeof window.encryptionService !== 'undefined' && window.encryptionService) {
      window.encryptionService.clearKey();
    }

    // Clear local session anyway
    localStorage.removeItem('user');
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('lastActivity');
    return { success: true }; // Always return success for logout
  }
}

// ============================================
// CHECK AUTHENTICATION STATUS
// ============================================

/**
 * Check if user is currently authenticated
 * @returns {Promise<{authenticated: boolean, user?: object}>}
 */
async function checkAuthentication() {
  try {
    if (!supabaseClient) {
      console.warn('Supabase client not initialized');
      return { authenticated: false };
    }

    // Get current session from Supabase
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error('Error checking session:', error);
      return { authenticated: false };
    }

    if (!session) {
      console.log('No active session');
      return { authenticated: false };
    }

    // Session exists and is valid
    console.log('Active session found for:', session.user.email);

    // Get user from localStorage (faster than DB query)
    const userSession = JSON.parse(localStorage.getItem('user') || 'null');

    if (userSession) {
      return { 
        authenticated: true, 
        user: userSession,
        session: session
      };
    }

    // If no localStorage session but Supabase session exists, refresh user data
    const { data: profileData, error: profileError } = await supabaseClient
      .from('users')
      .select(`
        *,
        organizations (
          id,
          name,
          country,
          currency
        )
      `)
      .eq('auth_user_id', session.user.id)
      .single();

    if (profileError || !profileData) {
      console.error('Error loading user profile:', profileError);
      return { authenticated: false };
    }

    const userSessionData = buildUserSessionFromProfile(profileData, session.user);

    localStorage.setItem('user', JSON.stringify(userSessionData));

    await kickoffPhysicianVerificationClock(profileData);

    return { 
      authenticated: true, 
      user: userSessionData,
      session: session
    };

  } catch (error) {
    console.error('Error checking authentication:', error);
    return { authenticated: false };
  }
}

// ============================================
// GET CURRENT USER
// ============================================

/**
 * Get the currently logged-in user
 * @returns {object|null} User object or null if not logged in
 */
function getCurrentUser() {
  const userSession = localStorage.getItem('user');
  if (!userSession) return null;
  
  try {
    return JSON.parse(userSession);
  } catch (error) {
    console.error('Error parsing user session:', error);
    return null;
  }
}

// ============================================
// REGISTER NEW USER
// ============================================

function regTraceStep(step, data) {
  if (typeof window.RegTrace !== 'undefined') window.RegTrace.step(step, data);
}
function regTraceOk(step, data) {
  if (typeof window.RegTrace !== 'undefined') window.RegTrace.ok(step, data);
}
function regTraceFail(step, err, data) {
  if (typeof window.RegTrace !== 'undefined') window.RegTrace.fail(step, err, data);
}

/**
 * Register a new user via Supabase Auth
 * @param {object} userData - User registration data
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
async function registerWithSupabase(userData) {
  const traceId = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  
  try {
    console.log(`🔍 [TRACE-${traceId}] registerWithSupabase START`, {
      username: userData.username,
      organizationId: userData.organizationId,
      role: userData.role,
      deviceType: deviceType,
      hasSupabaseClient: !!supabaseClient,
      timestamp: new Date().toISOString()
    });
    regTraceStep('registerWithSupabase_start', {
      username: userData.username,
      organizationId: userData.organizationId,
      role: userData.role,
      deviceType
    });
    
    if (!supabaseClient) {
      console.error(`❌ [TRACE-${traceId}] Supabase client not initialized`);
      regTraceFail('supabase_client_missing', 'Supabase client not initialized', {});
      return { success: false, error: 'Supabase client not initialized' };
    }

    console.log(`📝 [TRACE-${traceId}] Registering new user:`, userData.username);

    const normalizedUsername = String(userData.username || '').normalize('NFKC').trim().replace(/\s+/g, '');
    userData.username = normalizedUsername;

    // Generate email from username with organization context
    // Format: username-{shortOrgId}@mediforge.app
    let email;
    if (typeof window.buildMediForgeAuthEmail === 'function') {
      const built = window.buildMediForgeAuthEmail(normalizedUsername, userData.organizationId);
      if (!built.ok) {
        regTraceFail('auth_email_build_failed', built.error, { username: normalizedUsername });
        return { success: false, error: built.error };
      }
      email = built.email;
      console.log(`📧 [TRACE-${traceId}] Generated org-scoped email:`, email);
      regTraceOk('auth_email_built', { authEmail: email });
    } else if (normalizedUsername.includes('@')) {
      email = normalizedUsername;
    } else {
      const shortOrgId = String(userData.organizationId || '').replace(/-/g, '').substring(0, 8);
      email = `${normalizedUsername}-${shortOrgId}@mediforge.app`;
      console.log(`📧 [TRACE-${traceId}] Generated org-scoped email:`, email);
      regTraceOk('auth_email_built', { authEmail: email });
    }

    // CRITICAL PRE-VALIDATION: Check everything BEFORE creating Auth user
    // This prevents orphaned users by ensuring we can complete registration
    console.log(`🔍 [TRACE-${traceId}] Pre-validating registration data...`, {
      hasOrganizationId: !!userData.organizationId,
      organizationId: userData.organizationId,
      organizationIdFormat: userData.organizationId ? (userData.organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? 'valid-uuid' : 'invalid-format') : 'missing'
    });
    
    // 1. Validate organization exists and is accessible
    if (!userData.organizationId) {
      console.error(`❌ [TRACE-${traceId}] Organization ID is missing`);
      return { 
        success: false, 
        error: 'Organization ID is missing. Please verify your organization code and try again.' 
      };
    }
    
    if (!userData.organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return { 
        success: false, 
        error: 'Invalid organization ID format. Please contact support.' 
      };
    }
    
    // Organization ID format already validated. Direct SELECT is blocked for anon by RLS;
    // caller must resolve org via verify_organization_code RPC before calling this function.
    regTraceOk('organization_verified', {
      organizationId: userData.organizationId,
      method: 'trusted_uuid'
    });
    
    // 2. Check if username already exists globally (usernames must be unique across all organizations)
    try {
      const { data: existingUser, error: userCheckError } = await supabaseClient
        .from('users')
        .select('id, username, email, organization_id')
        .eq('username', userData.username)
        .maybeSingle();
      
      if (userCheckError && userCheckError.code !== 'PGRST116') {
        console.warn('⚠️ Error checking username availability:', userCheckError);
        // Continue anyway - might be RLS blocking, but we'll try
      } else if (existingUser) {
        // Username already exists globally
        return { 
          success: false, 
          error: `Username "${userData.username}" is already taken. Please choose a different username.` 
        };
      }
      
      // Check if email is already registered in users table
      // NOTE: For new organization registrations, email format includes org ID, so it should be unique
      // We check this but don't block registration - let Supabase Auth handle email uniqueness
      // If email exists in users table but Auth signup succeeds, we'll handle it in the Auth error handler
      const { data: existingEmailUser, error: emailCheckError } = await supabaseClient
        .from('users')
        .select('id, username, email, organization_id')
        .eq('email', email)
        .maybeSingle();
      
      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        console.warn(`⚠️ [TRACE-${traceId}] Error checking email availability:`, emailCheckError);
        // Continue anyway - might be RLS blocking, but we'll try
      } else if (existingEmailUser) {
        // Email exists in users table - check if it's for the same organization
        if (existingEmailUser.organization_id === userData.organizationId) {
          // Same organization - user already registered
          return { 
            success: false, 
            error: `Email "${email}" is already registered in this organization. Please log in instead.` 
          };
        } else {
          // Different organization - this shouldn't happen with org-scoped emails, but log it
          console.warn(`⚠️ [TRACE-${traceId}] Email exists for different organization - will handle in Auth signup`);
          // Continue - let Auth signup handle it (will generate alternative email if needed)
        }
      }
      
      console.log(`✅ [TRACE-${traceId}] Username and email checks passed (or non-blocking)`);
    } catch (userCheckException) {
      console.warn('⚠️ Exception checking username:', userCheckException);
      // Continue anyway - might be able to register even if check fails
    }

    // Create auth user (with retry logic for mobile/tablet network issues)
    let authData = null;
    let authError = null;
    let authUserId = null;
    let isOrphanedUser = false;
    
    // Initial Auth signup with retry logic for network issues
    const maxInitialAuthRetries = 3;
    const initialAuthRetryDelay = 1000;
    let signUpResult = null;
    
    for (let initialAuthAttempt = 1; initialAuthAttempt <= maxInitialAuthRetries; initialAuthAttempt++) {
      try {
        console.log(`🔄 [TRACE-${traceId}] Initial Auth signup attempt ${initialAuthAttempt}/${maxInitialAuthRetries}...`);
        signUpResult = await supabaseClient.auth.signUp({
          email: email,
          password: userData.password,
          options: {
            data: {
              username: userData.username,
              first_name: userData.firstName,
              last_name: userData.lastName
            }
          }
        });
        
        authData = signUpResult.data;
        authError = signUpResult.error;
        
        // If error is network-related and we have retries left, retry
        if (authError && initialAuthAttempt < maxInitialAuthRetries && (
          authError.message?.includes('network') ||
          authError.message?.includes('timeout') ||
          authError.message?.includes('fetch') ||
          authError.message?.includes('Failed to fetch')
        )) {
          console.warn(`⚠️ [TRACE-${traceId}] Network error on initial Auth signup attempt ${initialAuthAttempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, initialAuthRetryDelay * initialAuthAttempt));
          continue;
        } else {
          // Either success, non-network error, or out of retries - break
          break;
        }
      } catch (initialAuthException) {
        if (initialAuthAttempt < maxInitialAuthRetries && (
          initialAuthException.message?.includes('network') ||
          initialAuthException.message?.includes('timeout') ||
          initialAuthException.message?.includes('fetch')
        )) {
          console.warn(`⚠️ [TRACE-${traceId}] Exception on initial Auth signup attempt ${initialAuthAttempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, initialAuthRetryDelay * initialAuthAttempt));
          continue;
        } else {
          authError = initialAuthException;
          break;
        }
      }
    }

    if (authError) {
      // Check if user already exists (orphaned Auth user from previous failed registration)
      if (authError.message?.includes('already registered') || 
          authError.message?.includes('already exists') ||
          authError.message?.includes('User already registered')) {
        console.log(`⚠️ [TRACE-${traceId}] Auth user already exists for email: ${email}, checking if this is a new organization registration...`);
        
        // CRITICAL: For new organization registrations, the email format includes org ID
        // If email already exists in Auth but belongs to a different organization, we need to handle it
        // First, check if there's a profile in users table with this email
        let existingProfile = null;
        try {
          const { data: profileData, error: profileCheckError } = await supabaseClient
            .from('users')
            .select('id, username, email, organization_id, auth_user_id')
            .eq('email', email)
            .maybeSingle();

          if (profileCheckError && profileCheckError.code !== 'PGRST116') {
            console.warn(`⚠️ [TRACE-${traceId}] Error checking profile:`, profileCheckError);
          } else if (profileData) {
            existingProfile = profileData;
            console.log(`🔍 [TRACE-${traceId}] Found existing profile for email:`, existingProfile);
          }
        } catch (checkException) {
          console.warn(`⚠️ [TRACE-${traceId}] Exception checking profile:`, checkException);
        }

        // If profile exists and belongs to a different organization, this is a conflict
        // This shouldn't happen with org-scoped emails, but handle it gracefully
        if (existingProfile && existingProfile.organization_id !== userData.organizationId) {
          console.error(`❌ [TRACE-${traceId}] Email conflict: Email ${email} exists for different organization`);
          // Generate a slightly different email (add timestamp suffix to make it unique)
          const timestampSuffix = Date.now().toString().slice(-6); // Last 6 digits of timestamp
          const newEmail = `${userData.username}-${userData.organizationId.replace(/-/g, '').substring(0, 6)}-${timestampSuffix}@mediforge.app`;
          console.log(`🔄 [TRACE-${traceId}] Generating alternative email: ${newEmail}`);
          email = newEmail;
          
          // Retry Auth signup with new email (with retry logic for mobile/tablet network issues)
          let retrySignUpResult = null;
          let retrySignUpError = null;
          const maxAuthRetries = 3;
          const authRetryDelay = 1000;
          
          for (let authAttempt = 1; authAttempt <= maxAuthRetries; authAttempt++) {
            try {
              console.log(`🔄 [TRACE-${traceId}] Auth signup attempt ${authAttempt}/${maxAuthRetries} with alternative email...`);
              retrySignUpResult = await supabaseClient.auth.signUp({
                email: email,
                password: userData.password,
                options: {
                  data: {
                    username: userData.username,
                    first_name: userData.firstName,
                    last_name: userData.lastName
                  }
                }
              });
              
              if (retrySignUpResult.error) {
                retrySignUpError = retrySignUpResult.error;
                // Check if it's a network/timeout error that we should retry
                if (authAttempt < maxAuthRetries && (
                  retrySignUpResult.error.message?.includes('network') ||
                  retrySignUpResult.error.message?.includes('timeout') ||
                  retrySignUpResult.error.message?.includes('fetch') ||
                  retrySignUpResult.error.message?.includes('Failed to fetch')
                )) {
                  console.warn(`⚠️ [TRACE-${traceId}] Network error on Auth signup attempt ${authAttempt}, retrying...`);
                  await new Promise(resolve => setTimeout(resolve, authRetryDelay * authAttempt));
                  continue;
                } else {
                  console.error(`❌ [TRACE-${traceId}] Retry Auth signup failed:`, retrySignUpResult.error);
                  return { success: false, error: retrySignUpResult.error.message };
                }
              } else {
                // Success - break out of retry loop
                break;
              }
            } catch (authException) {
              retrySignUpError = authException;
              if (authAttempt < maxAuthRetries && (
                authException.message?.includes('network') ||
                authException.message?.includes('timeout') ||
                authException.message?.includes('fetch')
              )) {
                console.warn(`⚠️ [TRACE-${traceId}] Exception on Auth signup attempt ${authAttempt}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, authRetryDelay * authAttempt));
                continue;
              } else {
                console.error(`❌ [TRACE-${traceId}] Exception during Auth signup:`, authException);
                return { success: false, error: authException.message || 'Network error during registration' };
              }
            }
          }
          
          if (retrySignUpResult?.data?.user) {
            authData = retrySignUpResult.data;
            authError = null;
            authUserId = retrySignUpResult.data.user.id;
            console.log(`✅ [TRACE-${traceId}] Auth user created with alternative email:`, authUserId);
          } else {
            return { success: false, error: retrySignUpError?.message || 'Failed to create user account with alternative email' };
          }
        } else if (existingProfile && existingProfile.organization_id === userData.organizationId) {
          // Profile exists for same organization - user already registered
          console.log(`✅ [TRACE-${traceId}] Profile already exists for this organization`);
          return { 
            success: false, 
            error: 'User already registered in this organization. Please log in instead of registering again.' 
          };
        } else {
          // No profile exists - this is an orphaned Auth user, try to recover
          console.log(`⚠️ [TRACE-${traceId}] Orphaned Auth user detected - attempting recovery...`);
          
          // Try to sign in with the provided credentials to get the Auth user ID
          let signInData = null;
          let signInError = null;
          
          if (typeof window.signInForRegistration === 'function') {
            const recoveryResult = await window.signInForRegistration(email, userData.password, true);
            if (recoveryResult.success) {
              signInData = { user: recoveryResult.user, session: recoveryResult.session };
            } else {
              signInError = { message: recoveryResult.error };
            }
          } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
              email: email,
              password: userData.password
            });
            signInData = data;
            signInError = error;
          }

          if (signInError) {
            // Cannot sign in - email exists but password doesn't match
            // For new org registration, this shouldn't happen, but if it does, generate alternative email
            console.error(`❌ [TRACE-${traceId}] Cannot sign in with existing credentials. Generating alternative email...`);
            const timestampSuffix = Date.now().toString().slice(-6);
            const newEmail = `${userData.username}-${userData.organizationId.replace(/-/g, '').substring(0, 6)}-${timestampSuffix}@mediforge.app`;
            console.log(`🔄 [TRACE-${traceId}] Generating alternative email: ${newEmail}`);
            email = newEmail;
            
            // Retry Auth signup with new email (with retry logic for mobile/tablet network issues)
            let retrySignUpResult2 = null;
            let retrySignUpError2 = null;
            const maxAuthRetries2 = 3;
            const authRetryDelay2 = 1000;
            
            for (let authAttempt2 = 1; authAttempt2 <= maxAuthRetries2; authAttempt2++) {
              try {
                console.log(`🔄 [TRACE-${traceId}] Auth signup attempt ${authAttempt2}/${maxAuthRetries2} with alternative email (orphaned user recovery)...`);
                retrySignUpResult2 = await supabaseClient.auth.signUp({
                  email: email,
                  password: userData.password,
                  options: {
                    data: {
                      username: userData.username,
                      first_name: userData.firstName,
                      last_name: userData.lastName
                    }
                  }
                });
                
                if (retrySignUpResult2.error) {
                  retrySignUpError2 = retrySignUpResult2.error;
                  // Check if it's a network/timeout error that we should retry
                  if (authAttempt2 < maxAuthRetries2 && (
                    retrySignUpResult2.error.message?.includes('network') ||
                    retrySignUpResult2.error.message?.includes('timeout') ||
                    retrySignUpResult2.error.message?.includes('fetch') ||
                    retrySignUpResult2.error.message?.includes('Failed to fetch')
                  )) {
                    console.warn(`⚠️ [TRACE-${traceId}] Network error on Auth signup attempt ${authAttempt2}, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, authRetryDelay2 * authAttempt2));
                    continue;
                  } else {
                    console.error(`❌ [TRACE-${traceId}] Retry Auth signup failed:`, retrySignUpResult2.error);
                    return { success: false, error: retrySignUpResult2.error.message };
                  }
                } else {
                  // Success - break out of retry loop
                  break;
                }
              } catch (authException2) {
                retrySignUpError2 = authException2;
                if (authAttempt2 < maxAuthRetries2 && (
                  authException2.message?.includes('network') ||
                  authException2.message?.includes('timeout') ||
                  authException2.message?.includes('fetch')
                )) {
                  console.warn(`⚠️ [TRACE-${traceId}] Exception on Auth signup attempt ${authAttempt2}, retrying...`);
                  await new Promise(resolve => setTimeout(resolve, authRetryDelay2 * authAttempt2));
                  continue;
                } else {
                  console.error(`❌ [TRACE-${traceId}] Exception during Auth signup:`, authException2);
                  return { success: false, error: authException2.message || 'Network error during registration' };
                }
              }
            }
            
            if (retrySignUpResult2?.data?.user) {
              authData = retrySignUpResult2.data;
              authError = null;
              authUserId = retrySignUpResult2.data.user.id;
              console.log(`✅ [TRACE-${traceId}] Auth user created with alternative email:`, authUserId);
            } else {
              return { success: false, error: retrySignUpError2?.message || 'Failed to create user account' };
            }
          } else if (signInData?.user) {
            authUserId = signInData.user.id;
            console.log(`✅ [TRACE-${traceId}] Signed in to existing Auth user for recovery:`, authUserId);
            
            // Wait for session to be fully established
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify session is active
            const { data: { session: verifySession } } = await supabaseClient.auth.getSession();
            if (!verifySession) {
              console.error(`❌ [TRACE-${traceId}] Session not established after sign-in`);
              return { 
                success: false, 
                error: 'Session not established. Please try again or contact support.' 
              };
            }
            console.log(`✅ [TRACE-${traceId}] Session verified for orphaned user recovery`);
            isOrphanedUser = true;
          } else {
            return { 
              success: false, 
              error: 'User already registered but cannot access account. Please contact support.' 
            };
          }
        }
      } else {
        console.error(`❌ [TRACE-${traceId}] Supabase Auth registration error:`, authError);
        regTraceFail('auth_signup_failed', authError, { authEmail: email });
        const friendly = typeof window.formatMediForgeAuthError === 'function'
          ? window.formatMediForgeAuthError(authError.message, email)
          : authError.message;
        return { success: false, error: friendly };
      }
    } else if (authData?.user) {
      authUserId = authData.user.id;
      console.log('✅ Auth user created:', authUserId);
      regTraceOk('auth_signup_created', { authUserId });
    } else {
      return { success: false, error: 'Failed to create user account' };
    }

    if (!authUserId) {
      return { success: false, error: 'Failed to get Auth user ID' };
    }

    // Validate organization_id before attempting insert
    if (!userData.organizationId) {
      console.error('❌ Missing organization_id for user:', userData.username);
      // Try to clean up Auth user (only if it was just created, not orphaned)
      if (!isOrphanedUser && authUserId) {
        try {
          await supabaseClient.auth.admin.deleteUser(authUserId);
        } catch (cleanupError) {
          console.warn('Could not clean up Auth user:', cleanupError);
        }
      }
      return { 
        success: false, 
        error: 'Registration failed: Organization ID is missing. Please verify your organization code and try again.' 
      };
    }

    // Validate organization_id format (should be UUID)
    if (!userData.organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.error('❌ Invalid organization_id format:', userData.organizationId);
      return { 
        success: false, 
        error: 'Registration failed: Invalid organization ID format. Please contact support.' 
      };
    }

    // Profile INSERT uses RLS policy: authenticated + auth.uid() = auth_user_id.
    // Always establish the correct session (signUp alone often does not attach JWT to REST calls).
    {
      if (authData?.session?.user?.id === authUserId) {
        regTraceOk('profile_insert_session_from_signup', { authUserId });
      } else {
        const { data: { session: existingSession } } = await supabaseClient.auth.getSession();
        if (existingSession?.user?.id && existingSession.user.id !== authUserId) {
          regTraceStep('profile_insert_sign_out', { reason: 'stale_session', staleUserId: existingSession.user.id });
          await supabaseClient.auth.signOut();
        }

        regTraceStep('profile_insert_sign_in', { reason: 'establish_session_for_profile', authUserId });
        let signInOk = false;
        if (typeof window.signInForRegistration === 'function') {
          const signInResult = await window.signInForRegistration(email, userData.password, true);
          if (signInResult.success && signInResult.session?.user?.id === authUserId) {
            signInOk = true;
          }
        }
        if (!signInOk) {
          const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email,
            password: userData.password
          });
          if (signInErr || !signInData?.session || signInData.session.user?.id !== authUserId) {
            regTraceFail('profile_insert_no_session', signInErr || { message: 'No session after sign-in' }, { authUserId });
            return {
              success: false,
              error: 'Account created but profile setup failed. Please try logging in with your new username and password.'
            };
          }
        }
        regTraceOk('profile_insert_session_ready', { authUserId });
      }
    }

    // Create user profile in public.users table with retry logic for network issues
    // Increased retries for mobile/tablet reliability
    let profileData = null;
    let profileError = null;
    const maxRetries = 5; // Increased from 3 to 5 for better mobile reliability
    const retryDelay = 1500; // Increased from 1s to 1.5s for better network stability
    let includeEmail = true; // Start by including email, remove if column doesn't exist
    let includeLicense = true; // Start by including license_number, remove if column doesn't exist

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Creating user profile (attempt ${attempt}/${maxRetries})...`);
        
        // For orphaned users, ensure session is still active before insert
        if (isOrphanedUser && attempt === 1) {
          const { data: { session: preInsertSession } } = await supabaseClient.auth.getSession();
          if (!preInsertSession) {
            console.error('❌ Session lost before profile creation');
            return { 
              success: false, 
              error: 'Session expired. Please try registering again.' 
            };
          }
          console.log('✅ Session confirmed before profile creation');
        }
        
        // Build insert data object - start with all fields
        const insertData = {
          auth_user_id: authUserId,
          username: userData.username,
          first_name: userData.firstName,
          last_name: userData.lastName,
          gender: userData.gender || 'Male',
          role: userData.role,
          organization_id: userData.organizationId
        };
        
        // Add email only if we haven't determined it doesn't exist
        if (includeEmail) {
          insertData.email = email;
        }
        
        // Use correct field name: license_number (not medical_license_number)
        // Only include if we haven't determined the column doesn't exist
        if (includeLicense && userData.medicalLicenseNumber) {
          insertData.license_number = userData.medicalLicenseNumber;
        }
        
        // Add phone if provided
        if (userData.phone) {
          insertData.phone = userData.phone;
        }

        if (userData.specialization) {
          insertData.specialization = userData.specialization;
        }

        regTraceStep('profile_insert_attempt', {
          attempt,
          authUserId,
          organizationId: userData.organizationId,
          role: userData.role,
          fields: Object.keys(insertData)
        });

        let data = null;
        let error = null;

        if (attempt === 1) {
          const { data: rpcRow, error: rpcError } = await supabaseClient.rpc('complete_registration_user_profile', {
            p_auth_user_id: authUserId,
            p_username: userData.username,
            p_email: includeEmail ? email : `${userData.username}@mediforge.app`,
            p_first_name: userData.firstName,
            p_last_name: userData.lastName,
            p_gender: userData.gender || 'Male',
            p_role: userData.role,
            p_organization_id: userData.organizationId,
            p_phone: userData.phone || null,
            p_license_number: (includeLicense && userData.medicalLicenseNumber) ? userData.medicalLicenseNumber : null,
            p_specialization: userData.specialization || null
          });
          if (!rpcError && rpcRow) {
            data = typeof rpcRow === 'string' ? JSON.parse(rpcRow) : rpcRow;
            regTraceOk('profile_insert_rpc_created', { userId: data.id, attempt });
          } else if (rpcError && !(
            rpcError.message?.includes('complete_registration_user_profile') ||
            rpcError.code === 'PGRST202' ||
            rpcError.code === '42883'
          )) {
            error = rpcError;
          }
        }

        if (!data && !error) {
          const insertResult = await supabaseClient
            .from('users')
            .insert(insertData)
            .select()
            .single();
          data = insertResult.data;
          error = insertResult.error;
        }

        if (!error && data) {
          profileData = data;
          profileError = null;
          console.log('✅ User profile created successfully on attempt', attempt);
          regTraceOk('profile_insert_created', { userId: data.id, attempt });
          break;
        } else {
          profileError = error;
          // Log error details for debugging, but don't treat schema cache issues as critical errors
          if (error.message && (
            error.message.includes("schema cache") || 
            error.message.includes("Could not find")
          )) {
            console.log(`ℹ️ [TRACE-${traceId}] Profile creation attempt ${attempt}/${maxRetries} - Schema cache sync issue (will retry):`, {
              code: error.code,
              message: error.message.substring(0, 100) // Truncate long messages
            });
          } else {
            console.warn(`⚠️ [TRACE-${traceId}] Profile creation attempt ${attempt}/${maxRetries} failed:`, error);
          }
          
          // Schema cache sync issues - these should be rare now that we have proper migrations
          // But we keep retry logic as a safety net for edge cases
          if (error.message && (
            (error.message.includes("email") || error.message.includes("license_number")) && (
              error.message.includes("schema cache") || 
              error.message.includes("column") ||
              error.message.includes("Could not find")
            )
          )) {
            console.warn(`⚠️ [TRACE-${traceId}] Schema cache sync issue detected (attempt ${attempt}/${maxRetries})`);
            console.warn(`⚠️ [TRACE-${traceId}] This should be rare - columns should exist via migration. Retrying...`);
            
            // Remove problematic fields and retry
            if (error.message.includes("email")) {
              includeEmail = false;
            }
            if (error.message.includes("license_number")) {
              includeLicense = false;
            }
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
              continue;
            }
          }
          
          // If it's a network error or timeout, retry with exponential backoff
          if (attempt < maxRetries && (
            error.message?.includes('network') || 
            error.message?.includes('timeout') ||
            error.message?.includes('fetch') ||
            error.message?.includes('Failed to fetch') ||
            error.code === 'PGRST301' || // Connection error
            error.code === 'PGRST204' || // Not found (might be timing issue)
            !error.code // Unknown errors might be network-related
          )) {
            const backoffDelay = retryDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
            console.log(`Network error detected, retrying in ${Math.round(backoffDelay)}ms (attempt ${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          } else {
            // Non-retryable error, break
            break;
          }
        }
        } catch (insertException) {
          profileError = insertException;
          console.error(`Exception on attempt ${attempt}:`, insertException);
          if (attempt < maxRetries && (
            insertException.message?.includes('network') || 
            insertException.message?.includes('timeout') ||
            insertException.message?.includes('fetch') ||
            !insertException.code
          )) {
            const backoffDelay = retryDelay * Math.pow(1.5, attempt - 1);
            console.log(`Exception detected, retrying in ${Math.round(backoffDelay)}ms (attempt ${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
          break;
        }
      }
      
      // CRITICAL: If profile creation failed after all retries, clean up Auth user to prevent orphaned account
      if (profileError && !profileData && !isOrphanedUser) {
        console.error('❌ Profile creation failed after all retries. Cleaning up Auth user to prevent orphaned account...');
        try {
          // Try to delete the Auth user we just created
          // Note: This requires admin API which may not be available, but we try anyway
          if (supabaseClient.auth.admin && typeof supabaseClient.auth.admin.deleteUser === 'function') {
            await supabaseClient.auth.admin.deleteUser(authUserId);
            console.log('✅ Auth user cleaned up successfully');
          } else {
            console.warn('⚠️ Cannot clean up Auth user (admin API not available). User may need manual cleanup.');
          }
        } catch (cleanupError) {
          console.warn('⚠️ Could not clean up Auth user:', cleanupError);
          // Continue - we'll return error message that includes cleanup instructions
        }
      }

    if (profileError || !profileData) {
      console.error('❌ Error creating user profile after retries:', profileError);
      regTraceFail('profile_insert_failed', profileError, {
        authUserId,
        organizationId: userData.organizationId,
        attempts: maxRetries
      });
      
      // Provide detailed error information
      let errorMessage = 'Account created but profile setup failed. ';
      
      if (profileError) {
        // Check for specific error types
        if (profileError.code === '23505' || profileError.message?.includes('duplicate') || profileError.message?.includes('unique')) {
          errorMessage += 'Username or email already exists.';
        } else if (profileError.code === '23503' || profileError.message?.includes('foreign key')) {
          errorMessage += 'Organization not found. Please verify your organization code.';
        } else if (profileError.message?.includes('check constraint') || profileError.message?.includes('role')) {
          errorMessage += `Invalid role "${userData.role}". Please contact support.`;
        } else if (profileError.message?.includes('violates row-level security') || profileError.message?.includes('RLS')) {
          errorMessage += 'Permission denied. Please contact support.';
        } else {
          errorMessage += `Error: ${profileError.message || profileError}`;
        }
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      // Try to clean up Auth user if profile creation failed
      // Note: This requires admin privileges, so it may fail silently
      // Only attempt cleanup if it was a newly created user (not orphaned)
      if (!isOrphanedUser && authUserId) {
        try {
          console.log('Attempting to clean up Auth user...');
          // We can't delete Auth users without admin access, but we log it
          console.warn('⚠️ Auth user created but profile failed. Auth user ID:', authUserId);
        } catch (cleanupError) {
          console.warn('Could not clean up Auth user (this is expected without admin access):', cleanupError);
        }
      }
      
      return { 
        success: false, 
        error: errorMessage,
        authUserId: authUserId, // Include auth user ID for recovery
        details: profileError,
        isOrphaned: isOrphanedUser
      };
    }

    console.log('User profile created successfully');
    regTraceOk('registration_complete', {
      userId: profileData.id,
      username: profileData.username,
      organizationId: profileData.organization_id
    });

    // Log audit event
    if (typeof logAuditEvent !== 'undefined') {
      logAuditEvent(isOrphanedUser ? 'user_profile_recovered' : 'user_registered_supabase', {
        username: userData.username,
        role: userData.role,
        authMethod: 'supabase',
        recovered: isOrphanedUser
      });
    }

    // Get the Auth user object for response
    let authUserObj = null;
    if (isOrphanedUser) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      authUserObj = user;
    } else if (authData?.user) {
      authUserObj = authData.user;
    }

    return { 
      success: true, 
      user: profileData,
      authUser: authUserObj,
      recovered: isOrphanedUser
    };

  } catch (error) {
    console.error('Registration error:', error);
    regTraceFail('registerWithSupabase_exception', error, {});
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred during registration' 
    };
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Refresh the Supabase session
 */
async function refreshSession() {
  try {
    if (!supabaseClient) return { success: false };

    const { data, error } = await supabaseClient.auth.refreshSession();

    if (error) {
      console.error('Error refreshing session:', error);
      return { success: false };
    }

    if (data.session) {
      localStorage.setItem('supabase_session', JSON.stringify(data.session));
      localStorage.setItem('lastActivity', Date.now().toString());
      return { success: true, session: data.session };
    }

    return { success: false };
  } catch (error) {
    console.error('Session refresh error:', error);
    return { success: false };
  }
}

/**
 * Check if session is still valid and refresh if needed
 */
async function ensureValidSession() {
  const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0');
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;

  // If more than 30 minutes since last activity, check session
  if (now - lastActivity > thirtyMinutes) {
    const result = await checkAuthentication();
    if (!result.authenticated) {
      // Session expired, redirect to login
      window.location.href = '/login';
      return false;
    }
  }

  // Update last activity
  localStorage.setItem('lastActivity', now.toString());
  return true;
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

// Make functions available globally
if (typeof window !== 'undefined') {
  window.loginWithSupabase = loginWithSupabase;
  window.logoutFromSupabase = logoutFromSupabase;
  window.registerWithSupabase = registerWithSupabase;
  window.checkAuthentication = checkAuthentication;
  window.getCurrentUser = getCurrentUser;
  window.refreshSession = refreshSession;
  window.ensureValidSession = ensureValidSession;
}

console.log('✅ Supabase Auth module loaded');

