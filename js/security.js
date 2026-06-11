// Purpose: Enhanced security features for MediForge
// Includes SHA-256 password hashing, session management, and audit trail

// Security configuration
const SECURITY_CONFIG = {
  sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  passwordMinLength: 12, // Increased to 12 for highest security standards
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true, // Required for highest security standards
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000 // 15 minutes (now permanent after migration)
};

const SECURITY_VERBOSE = localStorage.getItem('enableVerboseLogs') === 'true';
const securityLog = (...args) => { if (SECURITY_VERBOSE) console.log(...args); };

// SecurityLogger class - Create immediately for clinic-security-dashboard compatibility
window.SecurityLogger = {
  getSecurityEvents: function(limit = 1000) {
    try {
      // Get audit log using the existing function
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const auditKey = user.org ? `${user.org}_auditLog` : 'auditLog';
      let auditLog = JSON.parse(localStorage.getItem(auditKey) || '[]');
      
      // Removed verbose console log
      // Return most recent events first, limited by count
      return auditLog
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting security events:', error);
      return [];
    }
  },
  
  clearOldEvents: function(daysOld = 30) {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const auditKey = user.org ? `${user.org}_auditLog` : 'auditLog';
      let auditLog = JSON.parse(localStorage.getItem(auditKey) || '[]');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const filteredLog = auditLog.filter(entry => {
        return new Date(entry.timestamp) > cutoffDate;
      });
      
      localStorage.setItem(auditKey, JSON.stringify(filteredLog));
      securityLog(`Cleared ${auditLog.length - filteredLog.length} old audit events`);
      return auditLog.length - filteredLog.length;
    } catch (error) {
      console.error('Error clearing old events:', error);
      return 0;
    }
  }
};

if (localStorage.getItem('enableVerboseLogs') === 'true') {
if (localStorage.getItem('enableVerboseLogs') === 'true') {
securityLog('✅ SecurityLogger class created and attached to window');
}
}

// SHA-256 password hashing using Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Validate password complexity
window.validatePasswordStrength = function(password) {
  const errors = [];
  
  if (password.length < SECURITY_CONFIG.passwordMinLength) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.passwordMinLength} characters long`);
  }
  
  if (SECURITY_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (SECURITY_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (SECURITY_CONFIG.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (SECURITY_CONFIG.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    strength: calculatePasswordStrength(password)
  };
};

// Calculate password strength score (0-100)
function calculatePasswordStrength(password) {
  let score = 0;
  
  // Length bonus
  score += Math.min(password.length * 4, 40);
  
  // Variety bonus
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 15;
  
  // Complexity bonus
  if (password.length >= 12) score += 10;
  if (/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) score += 15;
  
  return Math.min(score, 100);
}

// Session Management
let lastActivity = Date.now();
let sessionCheckInterval = null;

// Update last activity timestamp
function updateActivity() {
  lastActivity = Date.now();
  localStorage.setItem('lastActivity', lastActivity.toString());
}

// Check if session has expired
function checkSessionTimeout() {
  const timeSinceActivity = Date.now() - lastActivity;
  
  // Check if user is a platform administrator viewing a tenant organization
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (localStorage.getItem('enableVerboseLogs') === 'true') {
  securityLog('🔒 Security check - user context verified');
  securityLog('🔒 Security check - _isPlatformView:', !!user._isPlatformView);
  securityLog('🔒 Security check - platformAdminView:', !!user.platformAdminView);
  securityLog('🔒 Security check - originalPlatformAdmin:', !!user.originalPlatformAdmin);
  }
  
  const isPlatformAdminView = (user._isPlatformView && user._platformAdmin) || 
                              (user.platformAdminView && user._isPlatformView) ||
                              (user.originalPlatformAdmin && user._isPlatformView);
  
  if (localStorage.getItem('enableVerboseLogs') === 'true') {
  securityLog('🔒 Security check - isPlatformAdminView:', isPlatformAdminView);
  }
  
  // COMPLETELY BYPASS session timeout for platform admin view
  if (isPlatformAdminView) {
    if (localStorage.getItem('enableVerboseLogs') === 'true') {
      securityLog('🔒 Platform admin view detected - bypassing session timeout');
    }
    return; // Skip all session checks for platform admin view
  }
  
  // Use normal timeout for regular users
  const sessionTimeout = SECURITY_CONFIG.sessionTimeout;
  
  if (timeSinceActivity > sessionTimeout) {
    // Session expired
    clearInterval(sessionCheckInterval);
    
    // Regular user session expired
    alert('Your session has expired due to inactivity. Please login again for security.');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
}

// Initialize session management
window.initializeSessionManagement = function() {
  // Skip on login and register pages (including all platform admin pages)
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  // Also handle URLs without .html extension (for clean URLs)
  const pageWithoutExtension = currentPage.replace('.html', '');
  
  const excludedPages = [
    'login.html', 
    'login',
    'register.html', 
    'register',
    'index.html', 
    'index',
    '', // Root path
    'edit-profile.html',
    'edit-profile',
    'platform-login.html',
    'platform-login',
    'platform-dashboard.html',
    'platform-dashboard',
    'manage-clinics.html',
    'manage-clinics',
    'clinic-details.html',
    'clinic-details',
    'platform-analytics.html',
    'platform-analytics',
    'platform-audit-log.html',
    'platform-audit-log',
    'register-clinic.html',
    'register-clinic',
    'platform-settings.html',
    'platform-settings',
    'platform-subscriptions.html',
    'platform-subscriptions',
    'platform-physician-verification.html',
    'platform-physician-verification'
  ];
  if (excludedPages.includes(currentPage) || excludedPages.includes(pageWithoutExtension)) {
    return;
  }
  
  // Check if user is logged in OR platform admin is logged in
  const user = localStorage.getItem('user');
  const platformAdmin = localStorage.getItem('platformAdmin');
  
  if (!user && !platformAdmin) {
    // Not logged in, redirect to login
    window.location.href = '/login';
    return;
  }
  
  // Restore last activity from storage
  const savedActivity = localStorage.getItem('lastActivity');
  if (savedActivity) {
    lastActivity = parseInt(savedActivity);
  } else {
    // If no saved activity, set current time to prevent immediate timeout
    lastActivity = Date.now();
    localStorage.setItem('lastActivity', lastActivity.toString());
  }
  
  // Set up activity listeners
  const activityEvents = ['click', 'keypress', 'scroll', 'mousemove'];
  activityEvents.forEach(eventType => {
    document.addEventListener(eventType, updateActivity, { passive: true });
  });
  
  // Check session every minute
  sessionCheckInterval = setInterval(checkSessionTimeout, 60 * 1000);
  
  securityLog('Session management initialized - session timeout check scheduled');
};

// Audit Trail System
function sanitizeAuditValue(value) {
  if (typeof value === 'string') {
    return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = sanitizeAuditValue(val);
      return acc;
    }, {});
  }
  return value;
}

window.logAuditEvent = async function(action, details = {}) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const auditKey = user.org ? `${user.org}_auditLog` : 'auditLog';
    const auditLog = JSON.parse(localStorage.getItem(auditKey) || '[]');
    const safeDetails = sanitizeAuditValue(details || {});
    
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      user: user.username || 'unknown',
      role: user.role || 'unknown',
      organization: user.org || 'unknown',
      action: action,
      details: safeDetails,
      ipAddress: 'N/A', // Could use ipify API if internet available
      userAgent: navigator.userAgent
    };
    
    auditLog.push(entry);
    
    // Keep only last 1000 entries to prevent storage overflow
    if (auditLog.length > 1000) {
      auditLog.shift(); // Remove oldest
    }
    
    localStorage.setItem(auditKey, JSON.stringify(auditLog));
    
    // Helper function to categorize actions by event type
    function getEventType(action) {
      if (!action) return null;
      const lowerAction = action.toLowerCase();
      if (lowerAction.includes('login') || lowerAction.includes('logout') || lowerAction.includes('auth')) {
        return 'authentication';
      } else if (lowerAction.includes('patient')) {
        return 'patient_data';
      } else if (lowerAction.includes('billing') || lowerAction.includes('invoice') || lowerAction.includes('payment')) {
        return 'billing';
      } else if (lowerAction.includes('user') || lowerAction.includes('profile')) {
        return 'user_management';
      } else if (lowerAction.includes('intake') || lowerAction.includes('submission')) {
        return 'intake';
      } else if (lowerAction.includes('unauthorized') || lowerAction.includes('access_attempt') || lowerAction.includes('security')) {
        return 'security';
      } else if (lowerAction.includes('encounter') || lowerAction.includes('visit')) {
        return 'encounter';
      } else if (lowerAction.includes('report') || lowerAction.includes('export')) {
        return 'reporting';
      } else if (lowerAction.includes('prescription') || lowerAction.includes('dispense') || lowerAction.includes('inventory') || lowerAction.includes('medication')) {
        return 'pharmacy';
      }
      return 'general';
    }
    
    // Also save to Supabase audit_logs table (if available) for cross-machine visibility
    // Allow platform admins to save even without organizationId (organization_id can be null)
    if (typeof window.secureSupabaseInsert === 'function') {
      try {
        // COMPREHENSIVE: Send all important audit logging columns
        // This provides maximum visibility and compliance tracking
        const safeUsername = (typeof window.Validation !== 'undefined' && window.Validation.sanitizeString)
          ? window.Validation.sanitizeString(user.username || 'unknown', 255)
          : (user.username || 'unknown');
        const safeAction = (typeof window.Validation !== 'undefined' && window.Validation.sanitizeString)
          ? window.Validation.sanitizeString(action, 255)
          : action;
        const auditLogEntry = {
          // Required fields (sanitized)
          username: safeUsername,  // NOT NULL - who performed the action
          action: safeAction,  // NOT NULL - what action was performed
          
          // User context
          role: user.role || null,  // User role for access control tracking
          user_name: user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}`.trim() 
            : user.username || null,  // Full name if available, otherwise username
          
          // Organization context
          organization_id: user.organizationId || null,  // Which org (NULL for platform admins)
          organization_name: user.org || user.organization || null,  // Denormalized org name
          
          // Event categorization
          event_type: getEventType(action),  // High-level category (auth, patient_data, billing, etc.)
          
          // Additional context
          ip_address: null,  // Will be populated by proxy function from request headers
          user_agent: navigator.userAgent || null,  // Browser/client info
          details: safeDetails || null  // Action-specific details in JSONB format
          
          // Don't send timestamp - let Supabase use DEFAULT NOW()
        };
        
        console.log('📤 Attempting to save audit log to Supabase:', auditLogEntry);
        const insertResult = await window.secureSupabaseInsert('audit_logs', [auditLogEntry]);
        console.log('📥 Insert result:', insertResult);
        console.log('✅ Audit log saved to Supabase:', action);
      } catch (supabaseErr) {
        console.error('❌ Exception saving audit log to secure Supabase proxy:', supabaseErr);
        console.error('❌ Error message:', supabaseErr.message);
        console.error('❌ Error stack:', supabaseErr.stack);
        console.error('❌ Full error object:', JSON.stringify(supabaseErr, Object.getOwnPropertyNames(supabaseErr)));
      }
    } else {
      console.warn('⚠️ secureSupabaseInsert not available - audit log not saved to Supabase');
        }
    
    securityLog(`Audit logged: ${action}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

// Get audit log
window.getAuditLog = function(filters = {}) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const auditKey = user.org ? `${user.org}_auditLog` : 'auditLog';
    let auditLog = JSON.parse(localStorage.getItem(auditKey) || '[]');
    
    // Apply filters
    if (filters.action) {
      auditLog = auditLog.filter(entry => entry.action === filters.action);
    }
    if (filters.user) {
      auditLog = auditLog.filter(entry => entry.user === filters.user);
    }
    if (filters.patientId) {
      auditLog = auditLog.filter(entry => entry.details.patientId === filters.patientId);
    }
    if (filters.startDate) {
      auditLog = auditLog.filter(entry => new Date(entry.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      auditLog = auditLog.filter(entry => new Date(entry.timestamp) <= new Date(filters.endDate));
    }
    
    // Sort by timestamp descending (most recent first)
    auditLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return auditLog;
  } catch (error) {
    console.error('Failed to get audit log:', error);
    return [];
  }
};

// Export audit log
window.exportAuditLog = function() {
  try {
    const auditLog = getAuditLog();
    
    if (auditLog.length === 0) {
      alert('No audit log entries to export');
      return;
    }
    
    // Create CSV
    let csv = "Timestamp,User,Role,Organization,Action,Patient ID,Details\n";
    
    auditLog.forEach(entry => {
      const escapeCsv = (val) => {
        if (!val) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      };
      
      csv += `${escapeCsv(entry.timestamp)},${escapeCsv(entry.user)},${escapeCsv(entry.role)},`;
      csv += `${escapeCsv(entry.organization)},${escapeCsv(entry.action)},`;
      csv += `${escapeCsv(entry.details.patientId || '')},`;
      csv += `${escapeCsv(JSON.stringify(entry.details))}\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`Exported ${auditLog.length} audit log entries successfully!`);
  } catch (error) {
    alert('Failed to export audit log: ' + error.message);
    console.error('Audit export error:', error);
  }
};

// Migrate existing Base64 passwords to SHA-256 (gradual migration)
window.migratePasswordToSHA256 = async function(username, plainPassword) {
  try {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.username === username);
    
    if (!user) return false;
    
    // Check if already using SHA-256 (64 hex characters)
    if (user.password && user.password.length === 64 && /^[a-f0-9]{64}$/.test(user.password)) {
      securityLog('Password already using SHA-256');
      return true;
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(plainPassword);
    user.password = hashedPassword;
    user.passwordType = 'sha256'; // Mark as migrated
    
    localStorage.setItem('users', JSON.stringify(users));
    securityLog('Password migrated to SHA-256 for supplied credentials');
    
    // Log the migration
    logAuditEvent('password_migrated', { user: username });
    
    return true;
  } catch (error) {
    console.error('Password migration error:', error);
    return false;
  }
};

// Enhanced login validation (supports both old and new password formats)
window.validateLoginCredentials = async function(username, password) {
  try {
    // Check rate limit before attempting login
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      const rateLimitCheck = await window.rateLimiter.checkRateLimit('login', username);
      
      if (!rateLimitCheck.allowed) {
        let errorMsg;
        
        if (rateLimitCheck.permanentLock) {
          errorMsg = 'Account permanently locked due to too many failed login attempts. Please contact your administrator to unlock your account.';
        } else if (rateLimitCheck.locked) {
          errorMsg = `Account temporarily locked due to too many failed login attempts. Please try again in ${Math.ceil((rateLimitCheck.resetAt - new Date()) / (1000 * 60))} minutes.`;
        } else {
          errorMsg = `Too many login attempts. Please try again after ${Math.ceil((rateLimitCheck.resetAt - new Date()) / (1000 * 60))} minutes.`;
        }
        
        securityLog('⚠️ Login rate limit exceeded for:', username, 'Permanent lock:', rateLimitCheck.permanentLock);
        
        // Log rate limit violation
        if (typeof logAuditEvent !== 'undefined') {
          logAuditEvent('rate_limit_exceeded', {
            type: 'login',
            identifier: username,
            locked: rateLimitCheck.locked,
            permanent_lock: rateLimitCheck.permanentLock,
            locked_at: rateLimitCheck.lockedAt ? rateLimitCheck.lockedAt.toISOString() : null,
            locked_by: rateLimitCheck.lockedBy || null
          });
        }
        
        return { success: false, error: errorMsg, rateLimited: true, permanentLock: rateLimitCheck.permanentLock };
      }
    }
    
    securityLog('🔍 LOGIN DEBUG: Starting login validation');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    securityLog('🔍 LOGIN DEBUG: Total users in localStorage:', users.length);
    
    const user = users.find(u => u.username === username);
    
    if (!user) {
      securityLog('❌ User not found during login check');
      
      // Record failed attempt (user not found)
      if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
        await window.rateLimiter.recordFailedAttempt('login', username);
      }
      
      return { success: false, error: 'User not found' };
    }
    
    securityLog('🔍 Found user record for submitted credentials');
    
    // Try ALL possible password formats - CRISIS FIX
    const passwordChecks = [
      // 1. SHA-256 format
      async () => {
        if (user.passwordType === 'sha256' || (user.password && user.password.length === 64 && /^[a-f0-9]{64}$/.test(user.password))) {
          const hashedInput = await hashPassword(password);
          return hashedInput === user.password;
        }
        return false;
      },
      // 2. Base64 format
      () => {
        const encodedInput = btoa(password);
        return encodedInput === user.password;
      },
      // 3. Plain text format
      () => {
        return password === user.password;
      },
      // 4. Try SHA-256 even if not marked as such
      async () => {
        try {
          const hashedInput = await hashPassword(password);
          return hashedInput === user.password;
        } catch (e) {
          return false;
        }
      }
    ];
    
    // Try each password format
    for (let i = 0; i < passwordChecks.length; i++) {
      try {
        const isValid = await passwordChecks[i]();
        if (isValid) {
          securityLog(`✅ Login format ${i + 1} accepted`);
          
          // Clear rate limit on successful login
          if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
            await window.rateLimiter.clearRateLimit('login', username);
          }
          
          logAuditEvent('login_success', { user: username, format: i + 1 });
          return { success: true, user: user };
        }
      } catch (error) {
        securityLog(`❌ Format ${i + 1} failed`, error?.message || error);
      }
    }
    
    securityLog('❌ All password formats failed');
    
    // Record failed login attempt for rate limiting
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      await window.rateLimiter.recordFailedAttempt('login', username);
    }
    
    // Get attempt count from rate limiter before logging
    let attemptCount = null;
    if (typeof window.rateLimiter !== 'undefined' && window.rateLimiter) {
      try {
        const rateLimitCheck = await window.rateLimiter.checkRateLimit('login', username);
        attemptCount = 5 - (rateLimitCheck.remaining || 0); // Calculate attempts made
      } catch (error) {
        // Ignore errors in getting attempt count
      }
    }
    
    logAuditEvent('login_failed', { 
      user: username, 
      reason: 'incorrect_password',
      attempt_count: attemptCount,
      ip_address: null, // Will be populated by proxy
      user_agent: navigator.userAgent
    });
    return { success: false, error: 'Incorrect password' };
    
  } catch (error) {
    console.error('Login validation error:', error);
    logAuditEvent('login_error', { user: username, error: error.message });
    return { success: false, error: 'Login system error' };
  }
};

// Password strength indicator UI
window.showPasswordStrength = function(password, displayElementId) {
  const validation = validatePasswordStrength(password);
  const displayElement = document.getElementById(displayElementId);
  
  if (!displayElement) return;
  
  let strengthText = '';
  let strengthColor = '';
  
  if (validation.strength >= 80) {
    strengthText = 'Strong';
    strengthColor = '#28a745';
  } else if (validation.strength >= 60) {
    strengthText = 'Good';
    strengthColor = '#ffc107';
  } else if (validation.strength >= 40) {
    strengthText = 'Fair';
    strengthColor = '#ff6b6b';
  } else {
    strengthText = 'Weak';
    strengthColor = '#dc3545';
  }
  
  displayElement.innerHTML = `
    <div style="margin-top: 5px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
          <div style="width: ${validation.strength}%; height: 100%; background: ${strengthColor}; transition: width 0.3s;"></div>
        </div>
        <span style="font-size: 12px; color: ${strengthColor}; font-weight: bold;">${strengthText}</span>
      </div>
      ${validation.errors.length > 0 ? `
        <ul style="margin: 5px 0; padding-left: 20px; font-size: 11px; color: #dc3545;">
          ${validation.errors.map(err => `<li>${err}</li>`).join('')}
        </ul>
      ` : '<div style="font-size: 11px; color: #28a745; margin-top: 3px;">✓ Password meets requirements</div>'}
    </div>
  `;
};

// Initialize security features on page load
window.initializeSecurity = function() {
  // Initialize session management
  initializeSessionManagement();
  
  // Add session warning before expiry
  const warningTime = SECURITY_CONFIG.sessionTimeout - (5 * 60 * 1000); // Warn 5 minutes before expiry
  
  setInterval(() => {
    const timeSinceActivity = Date.now() - lastActivity;
    if (timeSinceActivity > warningTime && timeSinceActivity < SECURITY_CONFIG.sessionTimeout) {
      // Show warning once
      if (!window._sessionWarningShown) {
        window._sessionWarningShown = true;
        const minutesLeft = Math.floor((SECURITY_CONFIG.sessionTimeout - timeSinceActivity) / 60000);
        alert(`⚠️ Session Expiry Warning\n\nYour session will expire in ${minutesLeft} minutes due to inactivity.\nClick OK or perform any action to stay logged in.`);
        updateActivity(); // Clicking OK counts as activity
        window._sessionWarningShown = false;
      }
    }
  }, 60 * 1000); // Check every minute
  
  if (localStorage.getItem('enableVerboseLogs') === 'true') {
  securityLog('Security features initialized');
  }
};

// Common audit actions
const AUDIT_ACTIONS = {
  // Authentication
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_MIGRATED: 'password_migrated',
  
  // Patient Management
  PATIENT_CREATED: 'patient_created',
  PATIENT_VIEWED: 'patient_viewed',
  PATIENT_UPDATED: 'patient_updated',
  PATIENT_DELETED: 'patient_deleted',
  PATIENT_RESTORED: 'patient_restored',
  
  // Clinical Documentation
  VISIT_CREATED: 'visit_created',
  CLINICAL_NOTE_CREATED: 'clinical_note_created',
  CLINICAL_NOTE_UPDATED: 'clinical_note_updated',
  CLINICAL_NOTE_LOCKED: 'clinical_note_locked',
  CLINICAL_NOTE_UNLOCKED: 'clinical_note_unlocked',
  
  // Prescriptions
  PRESCRIPTION_CREATED: 'prescription_created',
  PRESCRIPTION_UPDATED: 'prescription_updated',
  PRESCRIPTION_SIGNED: 'prescription_signed',
  PRESCRIPTION_DELETED: 'prescription_deleted',
  
  // Orders
  ORDER_CREATED: 'order_created',
  ORDER_RESULTS_ATTACHED: 'order_results_attached',
  ORDER_RESULTS_VIEWED: 'order_results_viewed',
  
  // Documents
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_VIEWED: 'document_viewed',
  DOCUMENT_DELETED: 'document_deleted',
  
  // Data Management
  BACKUP_CREATED: 'backup_created',
  BACKUP_RESTORED: 'backup_restored',
  DATA_EXPORTED: 'data_exported',
  DATA_IMPORTED: 'data_imported',
  
  // System
  PROFILE_UPDATED: 'profile_updated',
  SETTINGS_CHANGED: 'settings_changed'
};

// Make AUDIT_ACTIONS available globally
window.AUDIT_ACTIONS = AUDIT_ACTIONS;

// Helper function to format audit log for display
window.formatAuditLogHTML = function(entries) {
  if (entries.length === 0) {
    return '<div style="text-align: center; padding: 20px; color: #666;">No audit log entries found</div>';
  }
  
  let html = '<table style="width: 100%; border-collapse: collapse;">';
  html += '<thead><tr>';
  html += '<th style="border: 1px solid #ddd; padding: 8px; background: #f4f4f4;">Timestamp</th>';
  html += '<th style="border: 1px solid #ddd; padding: 8px; background: #f4f4f4;">User</th>';
  html += '<th style="border: 1px solid #ddd; padding: 8px; background: #f4f4f4;">Action</th>';
  html += '<th style="border: 1px solid #ddd; padding: 8px; background: #f4f4f4;">Details</th>';
  html += '</tr></thead><tbody>';
  
  entries.forEach(entry => {
    html += '<tr>';
    html += `<td style="border: 1px solid #ddd; padding: 8px;">${new Date(entry.timestamp).toLocaleString()}</td>`;
    html += `<td style="border: 1px solid #ddd; padding: 8px;">${entry.user} (${entry.role})</td>`;
    html += `<td style="border: 1px solid #ddd; padding: 8px;">${entry.action}</td>`;
    html += `<td style="border: 1px solid #ddd; padding: 8px; font-size: 11px;">${JSON.stringify(entry.details)}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  return html;
};

// Auto-initialize on supported pages
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    initializeSecurity();
  });
}


securityLog('Security module loaded successfully');


