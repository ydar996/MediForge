// Purpose: Rate Limiting Module for Login Attempts and Intake Submissions
// Prevents brute force attacks and spam by limiting attempts per time window

// Rate limit configuration (from SECURITY_CONFIG)
const RATE_LIMIT_CONFIG = {
  login: {
    maxAttempts: 5, // Max login attempts
    windowMinutes: 15, // Time window in minutes
    lockoutMinutes: 15 // Lockout duration in minutes
  },
  platform_login: {
    maxAttempts: 3, // Stricter for platform admin
    windowMinutes: 15,
    lockoutMinutes: 30 // Temporary lockout (not permanent)
  },
  intake: {
    maxAttempts: 10, // Max intake submissions per IP
    windowMinutes: 60 // Time window in minutes (1 hour)
  },
  patient_login: {
    maxAttempts: 5, // Same as org login
    windowMinutes: 15,
    lockoutMinutes: 15 // Temporary lockout (not permanent)
  }
};

/**
 * Get client IP address (fallback to localStorage key if unavailable)
 */
function getClientIP() {
  // Try to get IP from existing audit log context
  // This will be populated by the Netlify function for server-side calls
  // For client-side, we'll use a session-based identifier
  return 'client-side'; // Client-side rate limiting will use identifier + timestamp
}

/**
 * Rate Limiter Class
 */
class RateLimiter {
  /**
   * Check if an action is rate limited
   * @param {string} type - 'login' or 'intake'
   * @param {string} identifier - Username, email, or IP address
   * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date|null, locked: boolean}>}
   */
  async checkRateLimit(type, identifier) {
    const config = RATE_LIMIT_CONFIG[type];
    if (!config) {
      console.error(`Unknown rate limit type: ${type}`);
      return { allowed: true, remaining: Infinity, resetAt: null, locked: false };
    }

    try {
      // CRITICAL: Always try Supabase first (persistent, cross-device, source of truth)
      let supabaseResult = null;
      let supabaseError = null;
      
      // Try secure RPC first
      if (typeof window.secureSupabaseRpc === 'function') {
        try {
          supabaseResult = await this.checkRateLimitSupabase(type, identifier, config);
          if (supabaseResult !== null) {
            // CRITICAL: Clear localStorage lockout if Supabase says account is unlocked
            // This ensures cross-device consistency - if unlocked in Supabase, clear local locks
            if (supabaseResult.allowed && !supabaseResult.locked && !supabaseResult.permanentLock) {
              this.clearLocalStorageLockout(type, identifier);
              // Also clear variations (username/email formats)
              this.clearAllVariations(type, identifier);
            }
            return supabaseResult;
          }
        } catch (error) {
          supabaseError = error;
          console.warn('⚠️ Supabase rate limit check failed (secure RPC):', error.message);
        }
      }
      
      // Try direct Supabase RPC if secure RPC failed
      if (supabaseResult === null && typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
        try {
          const { data, error } = await window.supabaseClient.rpc('check_rate_limit', {
            p_type: type,
            p_identifier: identifier,
            p_max_attempts: config.maxAttempts,
            p_window_minutes: config.windowMinutes
          });
          
          if (!error && data) {
            let result = data;
            if (typeof result === 'string') {
              result = JSON.parse(result);
            }
            
            supabaseResult = {
              allowed: result.allowed !== false,
              remaining: result.remaining || 0,
              resetAt: result.reset_at ? new Date(result.reset_at) : null,
              locked: result.locked === true,
              permanentLock: result.permanent_lock === true,
              lockedAt: result.locked_at ? new Date(result.locked_at) : null,
              lockedBy: result.locked_by || null
            };
            
            // CRITICAL: Clear localStorage lockout if Supabase says account is unlocked
            // This ensures cross-device consistency - if unlocked in Supabase, clear local locks
            if (supabaseResult.allowed && !supabaseResult.locked && !supabaseResult.permanentLock) {
              this.clearLocalStorageLockout(type, identifier);
              // Also clear variations (username/email formats)
              this.clearAllVariations(type, identifier);
            }
            return supabaseResult;
          } else if (error) {
            supabaseError = error;
            console.warn('⚠️ Supabase rate limit check failed (direct RPC):', error.message);
          }
        } catch (error) {
          supabaseError = error;
          console.warn('⚠️ Supabase rate limit check failed (direct RPC exception):', error.message);
        }
      }

      // Only use localStorage fallback if Supabase is completely unavailable
      // AND clear localStorage lockout if Supabase says account is not locked
      if (supabaseResult === null) {
        console.warn('⚠️ Supabase unavailable, using localStorage fallback (device-specific)');
        const localStorageResult = this.checkRateLimitLocalStorage(type, identifier, config);
        
        // If localStorage says locked but we couldn't check Supabase, warn user
        if (localStorageResult.locked) {
          console.warn('⚠️ WARNING: Using device-specific lockout. Account may not be locked on other devices.');
        }
        
        return localStorageResult;
      }
      
      // This should never be reached, but just in case
      return supabaseResult;
    } catch (error) {
      console.error('❌ Rate limit check error:', error);
      // Fail open - allow the request if rate limiting fails completely
      // But clear localStorage lockout to prevent false positives
      this.clearLocalStorageLockout(type, identifier);
      return { allowed: true, remaining: Infinity, resetAt: null, locked: false };
    }
  }
  
  /**
   * Clear localStorage lockout data (helper method)
   */
  clearLocalStorageLockout(type, identifier) {
    try {
      const lockoutKey = `rate_limit_lockout_${type}_${identifier}`;
      const storageKey = `rate_limit_${type}_${identifier}`;
      localStorage.removeItem(lockoutKey);
      localStorage.removeItem(storageKey);
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Clear all variations of an identifier (username/email formats)
   * Ensures cross-device consistency when account is unlocked
   */
  clearAllVariations(type, identifier) {
    try {
      const variations = [identifier];
      
      // If identifier is email, also clear username format
      if (identifier.includes('@')) {
        const username = identifier.split('@')[0];
        variations.push(username);
      } else {
        // If identifier is username, also clear email format
        variations.push(`${identifier}@mediforge.app`);
      }
      
      // Clear all variations
      variations.forEach(variation => {
        this.clearLocalStorageLockout(type, variation);
      });
      
      console.log(`✅ Cleared localStorage locks for ${variations.length} variation(s) of: ${identifier}`);
    } catch (error) {
      console.warn('⚠️ Error clearing variations:', error);
    }
  }

  /**
   * Check rate limit via Supabase (persistent, cross-device)
   */
  async checkRateLimitSupabase(type, identifier, config) {
    try {
      // Use secure RPC if available, otherwise direct Supabase call
      let result;
      
      if (typeof window.secureSupabaseRpc === 'function') {
        result = await window.secureSupabaseRpc('check_rate_limit', {
          p_type: type,
          p_identifier: identifier,
          p_max_attempts: config.maxAttempts,
          p_window_minutes: config.windowMinutes
        });
      } else if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
        // Direct Supabase call (less secure, but works if RPC not available)
        const { data, error } = await window.supabaseClient.rpc('check_rate_limit', {
          p_type: type,
          p_identifier: identifier,
          p_max_attempts: config.maxAttempts,
          p_window_minutes: config.windowMinutes
        });
        
        if (error) throw error;
        result = data;
      } else {
        return null; // No Supabase available, fall back to localStorage
      }

      if (!result) return null;

      // Parse result
      if (typeof result === 'string') {
        result = JSON.parse(result);
      }

      return {
        allowed: result.allowed !== false,
        remaining: result.remaining || 0,
        resetAt: result.reset_at ? new Date(result.reset_at) : null,
        locked: result.locked === true,
        permanentLock: result.permanent_lock === true,
        lockedAt: result.locked_at ? new Date(result.locked_at) : null,
        lockedBy: result.locked_by || null
      };
    } catch (error) {
      console.warn('⚠️ Supabase rate limit check error:', error.message);
      return null; // Fall back to localStorage
    }
  }

  /**
   * Check rate limit via localStorage (client-side only, not persistent across devices)
   */
  checkRateLimitLocalStorage(type, identifier, config) {
    const storageKey = `rate_limit_${type}_${identifier}`;
    const lockoutKey = `rate_limit_lockout_${type}_${identifier}`;
    
    // Check if locked out
    const lockoutData = localStorage.getItem(lockoutKey);
    if (lockoutData) {
      try {
        const lockout = JSON.parse(lockoutData);
        const lockoutUntil = new Date(lockout.until);
        
        if (new Date() < lockoutUntil) {
          const remainingMinutes = Math.ceil((lockoutUntil - new Date()) / (1000 * 60));
          return {
            allowed: false,
            remaining: 0,
            resetAt: lockoutUntil,
            locked: true,
            lockoutMinutes: remainingMinutes
          };
        } else {
          // Lockout expired, clear it
          localStorage.removeItem(lockoutKey);
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        // Invalid lockout data, clear it
        localStorage.removeItem(lockoutKey);
      }
    }

    // Get current attempts
    const attemptsData = localStorage.getItem(storageKey);
    const now = new Date();
    let attempts = [];

    if (attemptsData) {
      try {
        const parsed = JSON.parse(attemptsData);
        attempts = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        attempts = [];
      }
    }

    // Filter attempts within the time window
    const windowStart = new Date(now.getTime() - (config.windowMinutes * 60 * 1000));
    attempts = attempts.filter(timestamp => new Date(timestamp) > windowStart);

    // Check if limit exceeded
    if (attempts.length >= config.maxAttempts) {
      // Lock out if this is a login attempt (login, platform_login, patient_login)
      if (['login', 'platform_login', 'patient_login'].includes(type) && config.lockoutMinutes) {
        const lockoutUntil = new Date(now.getTime() + (config.lockoutMinutes * 60 * 1000));
        localStorage.setItem(lockoutKey, JSON.stringify({
          until: lockoutUntil.toISOString()
        }));
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: windowStart,
        locked: ['login', 'platform_login', 'patient_login'].includes(type) && config.lockoutMinutes ? true : false
      };
    }

    // Add current attempt
    attempts.push(now.toISOString());
    localStorage.setItem(storageKey, JSON.stringify(attempts));

    const remaining = config.maxAttempts - attempts.length;
    const oldestAttempt = attempts.length > 0 ? new Date(attempts[0]) : now;
    const resetAt = new Date(oldestAttempt.getTime() + (config.windowMinutes * 60 * 1000));

    return {
      allowed: true,
      remaining: remaining,
      resetAt: resetAt,
      locked: false
    };
  }

  /**
   * Record a failed attempt (increment rate limit counter)
   * @param {string} type - 'login' or 'intake'
   * @param {string} identifier - Username, email, or IP address
   * @returns {Promise<void>}
   */
  async recordFailedAttempt(type, identifier) {
    try {
      // Try Supabase first
      if (typeof window.secureSupabaseRpc === 'function') {
        try {
          await window.secureSupabaseRpc('record_rate_limit_attempt', {
            p_type: type,
            p_identifier: identifier
          });
          return; // Success
        } catch (error) {
          console.warn('⚠️ Supabase rate limit record failed, using localStorage:', error.message);
        }
      }

      // Fallback to localStorage (already handled in checkRateLimitLocalStorage)
      // Just trigger a check to increment the counter
      await this.checkRateLimit(type, identifier);
    } catch (error) {
      console.error('❌ Rate limit record error:', error);
      // Fail silently - don't break the login flow
    }
  }

  /**
   * Clear rate limit for an identifier (on successful login/intake)
   * @param {string} type - 'login' or 'intake'
   * @param {string} identifier - Username, email, or IP address
   * @returns {Promise<void>}
   */
  async clearRateLimit(type, identifier) {
    try {
      // CRITICAL: Clear from Supabase first (source of truth)
      let clearedFromSupabase = false;
      
      if (typeof window.secureSupabaseRpc === 'function') {
        try {
          await window.secureSupabaseRpc('clear_rate_limit', {
            p_type: type,
            p_identifier: identifier
          });
          clearedFromSupabase = true;
        } catch (error) {
          console.warn('⚠️ Supabase rate limit clear failed (secure RPC):', error.message);
        }
      }
      
      // Try direct Supabase RPC if secure RPC failed
      if (!clearedFromSupabase && typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
        try {
          const { error } = await window.supabaseClient.rpc('clear_rate_limit', {
            p_type: type,
            p_identifier: identifier
          });
          if (!error) {
            clearedFromSupabase = true;
          }
        } catch (error) {
          console.warn('⚠️ Supabase rate limit clear failed (direct RPC):', error.message);
        }
      }

      // Always clear from localStorage (sync with Supabase)
      this.clearLocalStorageLockout(type, identifier);
      
      if (clearedFromSupabase) {
        console.log('✅ Rate limit cleared from Supabase and localStorage for:', identifier);
      } else {
        console.warn('⚠️ Rate limit cleared from localStorage only (Supabase unavailable)');
      }
    } catch (error) {
      console.error('❌ Rate limit clear error:', error);
      // Still try to clear localStorage even if Supabase fails
      this.clearLocalStorageLockout(type, identifier);
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Export functions
if (typeof window !== 'undefined') {
  window.rateLimiter = rateLimiter;
  window.checkRateLimit = (type, identifier) => rateLimiter.checkRateLimit(type, identifier);
  window.recordFailedAttempt = (type, identifier) => rateLimiter.recordFailedAttempt(type, identifier);
  window.clearRateLimit = (type, identifier) => rateLimiter.clearRateLimit(type, identifier);
}

console.log('✅ Rate limiter module loaded');


