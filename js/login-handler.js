/**
 * Login Handler for Supabase Auth
 * 
 * This script intercepts the login form and uses Supabase Auth
 * instead of the old localStorage-based authentication.
 * 
 * It maintains backward compatibility by checking both:
 * 1. Supabase Auth (new way) - PRIMARY
 * 2. localStorage (old way) - FALLBACK for users not yet migrated
 */

console.log('🔐 Login handler loaded');

function showLoginVerifyingOverlay() {
  const existing = document.getElementById('login-verifying-overlay');
  if (existing) return;
  const overlay = document.createElement('div');
  overlay.id = 'login-verifying-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
  overlay.innerHTML = '<div style="background:white;padding:24px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);text-align:center;"><p style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:#333;">Verifying credentials and building your user experience..</p><div style="width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#008753;border-radius:50%;animation:login-verifying-spin 0.8s linear infinite;"></div></div>';
  const style = document.createElement('style');
  style.textContent = '@keyframes login-verifying-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
  document.body.appendChild(overlay);
}
function hideLoginVerifyingOverlay() {
  const overlay = document.getElementById('login-verifying-overlay');
  if (overlay) overlay.remove();
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('login-form');
  
  if (!loginForm) {
    console.log('Login form not found on this page');
    return;
  }

  console.log('Login form found, attaching Supabase handler');

  // Remove the old event listener from auth.js
  // We'll handle login ourselves now
  const newForm = loginForm.cloneNode(true);
  loginForm.parentNode.replaceChild(newForm, loginForm);

  // Attach new Supabase-based login handler
  newForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      alert('Please enter both username and password');
      return;
    }

    console.log('Login attempt for:', username);

    // Show loading state and overlay
    const submitButton = newForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Logging in...';
    submitButton.disabled = true;
    showLoginVerifyingOverlay();

    try {
      // CRITICAL: Users should ALWAYS be able to login with just their username
      // We automatically convert username to email for Supabase Auth (which requires email)
      // Users should NEVER need to know or enter their email address
      
      let email = null;
      let userProfile = null;
      
      if (!username.includes('@')) {
        // User entered a username (not an email) - this is the preferred method
        // Look up user by username to get their actual email
        // Emails are org-scoped: username-{orgId}@mediforge.app (for Supabase Auth uniqueness)
        try {
          if (window.supabaseClient) {
            let userData = null;
            let userError = null;
            if (typeof window.lookupUserPublicLogin === 'function') {
              const r = await window.lookupUserPublicLogin(window.supabaseClient, username, 'username', null);
              userData = r.data;
              userError = r.error;
            } else {
              const res = await window.supabaseClient.rpc('lookup_user_public_login', {
                p_identifier: username,
                p_type: 'username',
                p_role: null
              });
              userError = res.error;
              userData = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
            }
            
            if (!userError && userData && userData.email) {
              email = userData.email;
              userProfile = userData;
              console.log('✅ Found user by username, using email:', email);
              console.log('✅ User can login with username only - email conversion successful');
            } else if (userError) {
              console.warn('⚠️ Could not look up user by username:', userError);
            } else {
              console.warn('⚠️ User not found by username:', username);
            }
          }
        } catch (lookupError) {
          console.warn('⚠️ Error looking up user by username:', lookupError);
        }
      } else {
        // User entered an email - also supported for backward compatibility
        email = username;
        console.log('✅ User entered email directly:', email);
      }
      
      // CRITICAL: If lookup failed, we MUST get the email from database
      // Do NOT use fallback format - it causes login inconsistency across devices
      // The email MUST be the org-scoped format from the database
      if (!email) {
        // Try one more time with a direct query (in case of timing issues)
        if (window.supabaseClient && !username.includes('@')) {
          try {
            let retryUserData = null;
            let retryError = null;
            if (typeof window.lookupUserPublicLogin === 'function') {
              const r2 = await window.lookupUserPublicLogin(window.supabaseClient, username, 'username', null);
              retryUserData = r2.data;
              retryError = r2.error;
            } else {
              const res2 = await window.supabaseClient.rpc('lookup_user_public_login', {
                p_identifier: username,
                p_type: 'username',
                p_role: null
              });
              retryError = res2.error;
              retryUserData = Array.isArray(res2.data) && res2.data.length ? res2.data[0] : null;
            }
            
            if (!retryError && retryUserData && retryUserData.email) {
              email = retryUserData.email;
              userProfile = retryUserData;
              console.log('✅ Retry lookup successful, using email:', email);
            } else {
              // Last resort: Show error - user must exist in database
              console.error('❌ User not found in database:', username);
              alert('User not found. Please contact your administrator.');
              submitButton.textContent = originalButtonText;
              submitButton.disabled = false;
              return;
            }
          } catch (retryError) {
            console.error('❌ Retry lookup failed:', retryError);
            alert('Unable to verify user. Please check your connection and try again.');
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
            return;
          }
        } else if (username.includes('@')) {
          // User entered email directly
          email = username;
        } else {
          // Cannot proceed without email from database
          console.error('❌ Cannot determine email for username:', username);
          alert('User not found. Please contact your administrator.');
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
          return;
        }
      }
      
      let tryLegacyFormat = false;
      
      console.log('Trying Supabase Auth with email:', email);

      // Wait for Supabase client to be available (with timeout)
      console.log('🔍 TRACE: Checking Supabase client availability...');
      let clientReady = false;
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      while (!clientReady && attempts < maxAttempts) {
        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
          console.log('🔍 TRACE: Supabase client found after', attempts * 100, 'ms');
          clientReady = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.log('🔍 TRACE: window.supabaseClient exists:', typeof window.supabaseClient !== 'undefined');
      console.log('🔍 TRACE: window.supabaseClient truthy:', !!window.supabaseClient);
      console.log('🔍 TRACE: window.supabaseClient.auth exists:', !!window.supabaseClient?.auth);
      console.log('🔍 TRACE: window.supabaseClient.from exists:', !!window.supabaseClient?.from);
      
      if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
        console.error('❌ Supabase client not available after waiting');
        console.log('🔍 TRACE: Supabase client check failed - details:');
        console.log('🔍 TRACE: - typeof window.supabaseClient:', typeof window.supabaseClient);
        console.log('🔍 TRACE: - window.supabaseClient value:', window.supabaseClient);
        console.log('🔍 TRACE: - window.supabase exists:', typeof window.supabase !== 'undefined');
        console.log('🔍 TRACE: - window.supabase.createClient exists:', typeof window.supabase?.createClient === 'function');
        
        // Try to initialize Supabase client directly as fallback
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
          console.log('🔧 Attempting to initialize Supabase client directly...');
          try {
            const cfg = window.__SUPABASE_CONFIG__ || {};
            const SUPABASE_URL = cfg.url || ((window.__SUPABASE_CONFIG__||{}).url||'');
            const SUPABASE_ANON_KEY = cfg.anonKey || cfg['anon-key'] || '';
            if (!SUPABASE_ANON_KEY) {
              throw new Error('Supabase browser key not configured');
            }
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
              auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
              }
            });
            console.log('✅ Supabase client initialized directly');
          } catch (initError) {
            console.error('❌ Failed to initialize Supabase client:', initError);
            throw new Error('Supabase client not available');
          }
        } else {
          throw new Error('Supabase client not available');
        }
      }

      console.log('🔍 TRACE: Supabase client available, proceeding with login...');
      // Try Supabase Auth first with primary email format
      let result = await loginWithSupabase(email, password);
      
      // If login fails and username doesn't contain @, try legacy @example.com format
      if (!result.success && !username.includes('@')) {
        const legacyEmail = `${username}@example.com`;
        console.log('⚠️ Primary email format failed, trying legacy format:', legacyEmail);
        result = await loginWithSupabase(legacyEmail, password);
        if (result.success) {
          console.log('✅ Login successful with legacy email format');
        }
      }

      if (result.success) {
        console.log('✅ Supabase login successful');
        console.log('✅ Username-only login works perfectly - no email required!');
        
        // Check if password reset is required
        if (result.passwordResetRequired) {
          console.log('⚠️ Password reset required - redirecting to password change page');
          // Redirect to password change page
          window.location.href = '/change-password?firstLogin=true&required=true';
          return;
        }
        
        // Initialize session management properly
        const now = Date.now();
        localStorage.setItem('lastActivity', now.toString());
        console.log('✅ Session initialized with current timestamp');
        
        // Generate secure session token
        if (typeof SessionSecurity !== 'undefined' && SessionSecurity.generateSessionToken) {
          SessionSecurity.generateSessionToken();
          console.log('✅ Session token generated');
        }
        
        // CRITICAL: Check if user has signed legal agreements
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        let userId = userData.id; // Prefer users table ID
        
        // If we don't have users table ID, try to get it from Supabase using authUserId
        if (!userId && (userData.authUserId || userData.auth_user_id) && typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
          try {
            const authUserId = userData.authUserId || userData.auth_user_id;
            const { data: userRecord, error: userError } = await window.supabaseClient
              .from('users')
              .select('id')
              .eq('auth_user_id', authUserId)
              .maybeSingle();
            
            if (!userError && userRecord && userRecord.id) {
              userId = userRecord.id;
            }
          } catch (fetchError) {
            console.error('Error fetching user ID for legal check:', fetchError);
          }
        }
        
        // Only check legal agreements if we have a valid users table ID
        if (userId && typeof window.getUserLegalAgreements !== 'undefined') {
          try {
            // Check if user has signed agreements
            const { success, agreements } = await window.getUserLegalAgreements(userId);
            
            if (success && (!agreements || agreements.length === 0)) {
              // User hasn't signed agreements - redirect to signing page
              console.log('⚠️ User has not signed legal agreements - redirecting to signing page');
              alert('Please accept the legal agreements to continue.');
              window.location.href = '/legal-agreement-sign';
              return;
            } else if (success && agreements && agreements.length > 0) {
              // Check if both service_agreement and baa are signed
              const hasServiceAgreement = agreements.some(a => a.agreement_type === 'service_agreement');
              const hasBAA = agreements.some(a => a.agreement_type === 'baa');
              
              if (!hasServiceAgreement || !hasBAA) {
                console.log('⚠️ User has not signed all required agreements - redirecting to signing page');
                alert('Please accept all legal agreements to continue.');
                window.location.href = '/legal-agreement-sign';
                return;
              }
              
              console.log('✅ User has signed all required legal agreements');
            }
          } catch (legalCheckError) {
            console.error('⚠️ Error checking legal agreements:', legalCheckError);
            // Don't block login if check fails - allow user to proceed
            // Legal agreements check will happen on dashboard load
          }
        }
        
        hideLoginVerifyingOverlay();

        let pvLoginResult = { showed: false };
        if (typeof window.runPostLoginPhysicianVerificationPrompt === 'function') {
          try {
            pvLoginResult = (await window.runPostLoginPhysicianVerificationPrompt()) || { showed: false };
          } catch (pvErr) {
            console.warn('Physician verification login prompt:', pvErr);
          }
        }
        if (!pvLoginResult.showed) {
          alert('Login successful!');
        }

        window.location.href = '/dashboard';
        return;
      }

      // If Supabase login failed, check if it's because user not migrated yet
      console.log('Supabase login failed:', result.error);

      // Check if user exists in localStorage but not in Supabase
      const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
      const localUser = localUsers.find(u => u.username === username);

      if (localUser) {
        console.log('⚠️ User exists in localStorage but not in Supabase');
        console.log('This user needs to be migrated');
        
        // Try to validate password with old system
        let passwordValid = false;
        
        if (typeof validateLoginCredentials !== 'undefined') {
          const oldResult = await validateLoginCredentials(username, password);
          passwordValid = oldResult.success;
        } else {
          // Fallback password validation
          if (localUser.passwordType === 'sha256') {
            const hashedPassword = await hashPassword(password);
            passwordValid = hashedPassword === localUser.password;
          } else {
            passwordValid = btoa(password) === localUser.password;
          }
        }

        if (passwordValid) {
          // Password is correct - log user in with localStorage fallback
          console.log('✅ localStorage login successful');
          
          // Set user session
          localStorage.setItem('user', JSON.stringify(localUser));
          
          // Initialize session management properly
          const now = Date.now();
          localStorage.setItem('lastActivity', now.toString());
          console.log('✅ Session initialized with current timestamp');
          
          // Generate secure session token
          if (typeof SessionSecurity !== 'undefined' && SessionSecurity.generateSessionToken) {
            SessionSecurity.generateSessionToken();
            console.log('✅ Session token generated');
          }
          
          alert('Login successful!');
          window.location.href = '/dashboard';
          return;
        } else {
          // Wrong password
          alert('Incorrect password. Please try again.');
        }
      } else {
        // User doesn't exist anywhere
        // CRITICAL: Never suggest using email - username should always work
        let errorMsg = 'Login failed. ';
        if (result.error) {
          if (result.error.includes('Invalid login credentials')) {
            errorMsg += 'Invalid username or password.';
          } else if (result.error.includes('rate limit') || result.error.includes('too many')) {
            errorMsg += result.error;
          } else if (result.error.includes('permanently locked')) {
            errorMsg += 'Account is locked. Please contact your administrator.';
          } else {
            errorMsg += result.error;
          }
        } else {
          errorMsg += 'Please check your username and password.';
        }
        errorMsg += '\n\nIf you\'re a new user, please register first.';
        alert(errorMsg);
      }

    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login: ' + error.message);
    } finally {
      hideLoginVerifyingOverlay();
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
    }
  });

  console.log('✅ Supabase login handler attached');
});

// Add helper info to console
console.log('📝 Login formats supported:');
console.log('   - username (e.g., "admin") → converts to admin@mediforge.app');
console.log('   - email (e.g., "admin@mediforge.app") → uses as-is');

