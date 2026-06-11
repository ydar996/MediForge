/**
 * Registration-Specific Supabase Auth Helper
 * Separates registration from login to prevent rate limit conflicts
 * 
 * This ensures registration attempts never trigger login rate limits
 */

/**
 * Sign in during registration (for orphaned user recovery)
 * This is NOT a login attempt - it's part of registration recovery
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {boolean} isRegistrationContext - True if this is part of registration
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
async function signInForRegistration(email, password, isRegistrationContext = true) {
  try {
    if (!window.supabaseClient) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    // CRITICAL: Do NOT check rate limits for registration recovery
    // This is not a login attempt - it's part of the registration process
    
    console.log('🔐 Registration recovery: Signing in to recover orphaned Auth user:', email);

    // Sign in with Supabase Auth (bypasses login rate limiting)
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error('❌ Registration recovery sign-in failed:', error);
      return { 
        success: false, 
        error: error.message,
        isRegistrationContext: true // Flag to indicate this is registration, not login
      };
    }

    if (!data?.user) {
      return { 
        success: false, 
        error: 'Failed to sign in during registration recovery',
        isRegistrationContext: true
      };
    }

    console.log('✅ Registration recovery: Successfully signed in to recover Auth user');
    return { 
      success: true, 
      user: data.user,
      session: data.session,
      isRegistrationContext: true
    };

  } catch (error) {
    console.error('❌ Registration recovery sign-in exception:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error during registration recovery',
      isRegistrationContext: true
    };
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.signInForRegistration = signInForRegistration;
}






