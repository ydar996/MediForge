// Purpose: Account Management Module for Platform Admins and Org-Level Admins
// Provides unlock account and password reset functionality

/**
 * Unlock a permanently locked account (Platform Admin and Org Admin)
 * @param {string} identifier - Username or email
 * @param {string} unlockedBy - Admin who is unlocking
 * @param {string} reason - Optional reason for unlock
 * @returns {Promise<{success: boolean, error?: string}>}
 */
window.unlockAccount = async function(identifier, unlockedBy, reason = null) {
  try {
    if (typeof window.secureSupabaseRpc !== 'function') {
      throw new Error('secureSupabaseRpc helper is unavailable');
    }

    const result = await window.secureSupabaseRpc('unlock_account', {
      p_identifier: identifier,
      p_unlocked_by: unlockedBy,
      p_reason: reason || 'Unlocked by administrator'
    });

    // Parse result
    let parsedResult = result;
    if (typeof result === 'string') {
      parsedResult = JSON.parse(result);
    }

    if (parsedResult.success) {
      // CRITICAL: Clear localStorage lockout on all devices when account is unlocked
      // This ensures consistency across devices
      // Note: localStorage clear only affects current browser, but Supabase unlock is cross-device
      // When user tries to log in on their device, rate limiter will check Supabase and clear their localStorage
      try {
        if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
          // Use clearAllVariations if available (clears username/email variations)
          if (window.rateLimiter.clearAllVariations) {
            window.rateLimiter.clearAllVariations('login', identifier);
          } else if (window.rateLimiter.clearLocalStorageLockout) {
            // Fallback to individual clear
            window.rateLimiter.clearLocalStorageLockout('login', identifier);
            
            // Clear variations manually
            if (identifier.includes('@')) {
              const username = identifier.split('@')[0];
              window.rateLimiter.clearLocalStorageLockout('login', username);
            } else {
              const email = `${identifier}@mediforge.app`;
              window.rateLimiter.clearLocalStorageLockout('login', email);
            }
          }
        }
        
        // Also manually clear common variations
        const variations = [identifier];
        if (identifier.includes('@')) {
          variations.push(identifier.split('@')[0]);
        } else {
          variations.push(`${identifier}@mediforge.app`);
        }
        
        // Add lowercase variations
        variations.forEach(v => {
          if (v.toLowerCase() !== v) variations.push(v.toLowerCase());
        });
        
        variations.forEach(variation => {
          const lockoutKey = `rate_limit_lockout_login_${variation}`;
          const storageKey = `rate_limit_login_${variation}`;
          localStorage.removeItem(lockoutKey);
          localStorage.removeItem(storageKey);
        });
        
        console.log('✅ Cleared localStorage lockout for:', identifier, `(${variations.length} variations)`);
      } catch (clearError) {
        console.warn('⚠️ Could not clear localStorage lockout (non-critical):', clearError);
      }
      
      // Log unlock action
      if (typeof window.logAuditEvent === 'function') {
        await window.logAuditEvent('account_unlocked', {
          identifier: identifier,
          unlocked_by: unlockedBy,
          reason: reason || 'Unlocked by administrator'
        });
      }

      return { success: true, result: parsedResult };
    } else {
      return { success: false, error: parsedResult.error || 'Failed to unlock account' };
    }
  } catch (error) {
    console.error('❌ Error unlocking account:', error);
    return { success: false, error: error.message || 'Failed to unlock account' };
  }
};

/**
 * Get all locked accounts (Platform Admin and Org Admin)
 * @param {string} organizationId - Optional organization ID to filter
 * @returns {Promise<Array>}
 */
window.getLockedAccounts = async function(organizationId = null) {
  try {
    if (typeof window.secureSupabaseRpc !== 'function') {
      throw new Error('secureSupabaseRpc helper is unavailable');
    }

    const result = await window.secureSupabaseRpc('get_locked_accounts', {
      p_organization_id: organizationId || null
    });

    // Parse result
    let accounts = result;
    if (typeof result === 'string') {
      accounts = JSON.parse(result);
    }

    if (!Array.isArray(accounts)) {
      accounts = accounts.data || [];
    }

    return accounts;
  } catch (error) {
    console.error('❌ Error getting locked accounts:', error);
    return [];
  }
};

/**
 * Get comprehensive login attempt history
 * @param {string} identifier - Optional username/email to filter
 * @param {number} hours - Hours of history to retrieve (default 24)
 * @param {number} limit - Maximum number of records (default 1000)
 * @returns {Promise<Array>}
 */
window.getLoginAttemptHistory = async function(identifier = null, hours = 24, limit = 1000) {
  try {
    if (typeof window.secureSupabaseRpc !== 'function') {
      throw new Error('secureSupabaseRpc helper is unavailable');
    }

    const result = await window.secureSupabaseRpc('get_login_attempt_history', {
      p_identifier: identifier,
      p_hours: hours,
      p_limit: limit
    });

    // Parse result
    let attempts = result;
    if (typeof result === 'string') {
      attempts = JSON.parse(result);
    }

    if (!Array.isArray(attempts)) {
      attempts = attempts.data || [];
    }

    return attempts;
  } catch (error) {
    console.error('❌ Error getting login attempt history:', error);
    return [];
  }
};

/**
 * Alert system for account lockouts
 * Notifies platform admins and org admins when accounts are locked
 */
window.alertAccountLockout = async function(identifier, attemptCount) {
  try {
    // Create a notification/alert in audit log
    if (typeof window.logAuditEvent === 'function') {
      await window.logAuditEvent('account_lockout_alert', {
        identifier: identifier,
        attempt_count: attemptCount,
        lockout_type: 'permanent',
        alert_sent: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Store alert in localStorage for admin dashboard to display
    const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]');
    const alert = {
      id: Date.now(),
      type: 'account_lockout',
      severity: 'high',
      identifier: identifier,
      attempt_count: attemptCount,
      timestamp: new Date().toISOString(),
      read: false,
      message: `Account ${identifier} has been permanently locked after ${attemptCount} failed login attempts. Administrator action required.`
    };
    
    alerts.unshift(alert);
    
    // Keep only last 100 alerts
    if (alerts.length > 100) {
      alerts.pop();
    }
    
    localStorage.setItem('security_alerts', JSON.stringify(alerts));
    
    console.warn('🔔 SECURITY ALERT: Account locked:', identifier, 'Attempts:', attemptCount);
    
    // Optional: Send email notification (additive feature - gracefully fails if not configured)
    if (typeof window.sendSecurityEmail === 'function') {
      try {
        await window.sendSecurityEmail('account_lockout', {
          identifier: identifier,
          attempt_count: attemptCount,
          timestamp: new Date().toISOString(),
          ip_address: null, // Will be populated if available
          lockout_type: 'permanent'
        }, 'high');
      } catch (emailError) {
        // Don't fail alerting if email fails - email is optional
        console.warn('⚠️ Email notification failed (non-critical):', emailError);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error creating lockout alert:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get security alerts (for admin dashboards)
 */
window.getSecurityAlerts = function(limit = 50) {
  try {
    const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]');
    const unreadAlerts = alerts.filter(a => !a.read);
    const limitedAlerts = alerts.slice(0, limit);
    
    return {
      all: limitedAlerts,
      unread: unreadAlerts,
      unreadCount: unreadAlerts.length
    };
  } catch (error) {
    console.error('Error getting security alerts:', error);
    return { all: [], unread: [], unreadCount: 0 };
  }
};

/**
 * Mark alert as read
 */
window.markAlertAsRead = function(alertId) {
  try {
    const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]');
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.read = true;
      localStorage.setItem('security_alerts', JSON.stringify(alerts));
    }
  } catch (error) {
    console.error('Error marking alert as read:', error);
  }
};

console.log('✅ Account management module loaded');

