/**
 * Platform Admin Login - Supabase Auth only
 * Uses platform_admins table for Supabase Auth. Legacy fallback removed for security.
 * Rate limiting: 3 attempts, 30 min lockout
 */
(function() {
  const PLATFORM_LOGIN_CONFIG = { maxAttempts: 3, windowMinutes: 15 };

  async function checkPlatformRateLimit(identifier) {
    if (typeof window.rateLimiter === 'undefined') return { allowed: true };
    return window.rateLimiter.checkRateLimit('platform_login', identifier);
  }

  async function recordPlatformLoginFailure(identifier) {
    if (typeof window.rateLimiter !== 'undefined') {
      await window.rateLimiter.recordFailedAttempt('platform_login', identifier);
    }
  }

  async function clearPlatformRateLimit(identifier) {
    if (typeof window.rateLimiter !== 'undefined') {
      await window.rateLimiter.clearRateLimit('platform_login', identifier);
    }
  }

  async function getPlatformAdminByUsername(username) {
    if (typeof window.secureSupabaseRpc !== 'function') return null;
    try {
      const result = await window.secureSupabaseRpc('get_platform_admin_by_username', { p_username: username });
      return result && result.email ? result : null;
    } catch (e) {
      console.warn('get_platform_admin_by_username failed:', e.message);
      return null;
    }
  }

  window.platformLogin = async function(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Please enter both username and password' };
    }

    const identifier = username.trim();
    const identifierForRateLimit = identifier.includes('@') ? identifier : identifier + '@platform';

    // 1. Rate limit check
    const rateCheck = await checkPlatformRateLimit(identifierForRateLimit);
    if (!rateCheck.allowed) {
      const mins = rateCheck.resetAt ? Math.ceil((rateCheck.resetAt - new Date()) / 60000) : 30;
      return {
        success: false,
        error: `Too many failed login attempts. Please try again in ${mins} minutes.`,
        rateLimited: true
      };
    }

    // 2. Try Supabase Auth first (platform_admins table)
    const platformAdmin = await getPlatformAdminByUsername(identifier);
    if (platformAdmin && window.supabaseClient) {
      console.log('🔐 Platform admin found in DB, attempting Supabase Auth...');
      try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
          email: platformAdmin.email,
          password: password
        });

        if (!error && data?.user) {
          const authUserId = data.user.id;
          if (authUserId === platformAdmin.auth_user_id) {
            await clearPlatformRateLimit(identifierForRateLimit);
            localStorage.setItem('platformAdmin', JSON.stringify({
              id: platformAdmin.id,
              auth_user_id: authUserId,
              username: platformAdmin.username,
              email: platformAdmin.email,
              role: 'PlatformOwner'
            }));
            if (typeof window.logAuditEvent === 'function') {
              window.logAuditEvent('platform_admin_login', { username: platformAdmin.username, method: 'supabase_auth' });
            }
            return { success: true };
          }
        }
        // Auth failed - record for rate limit
        await recordPlatformLoginFailure(identifierForRateLimit);
      } catch (e) {
        console.warn('Supabase platform login error:', e.message);
        await recordPlatformLoginFailure(identifierForRateLimit);
      }
    }

    return { success: false, error: 'Invalid platform admin credentials' };
  };
})();
