/**
 * Enhanced Security Logging Module
 * Adds comprehensive security event tracking without affecting existing functionality
 * Version: 1.0
 */

// Enhanced security event logging
window.SecurityLogger = {
    // Log security events with enhanced details
    logSecurityEvent: function(eventType, details = {}) {
        const securityEvent = {
            timestamp: new Date().toISOString(),
            eventType: eventType,
            details: details,
            user: this.getCurrentUserInfo(),
            session: this.getSessionInfo(),
            browser: this.getBrowserInfo(),
            location: this.getLocationInfo()
        };

        // Log to console for debugging
        console.log('🔒 SECURITY EVENT:', securityEvent);

        // Store in localStorage for offline access
        this.storeSecurityEvent(securityEvent);

        // Send to Supabase if available
        this.sendToSupabase(securityEvent);
    },

    // Get current user information safely
    getCurrentUserInfo: function() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return {
                id: user.id || 'unknown',
                username: user.username || 'unknown',
                role: user.role || 'unknown',
                organization: user.org || 'unknown'
            };
    } catch (error) {
            return { error: 'Unable to get user info' };
        }
    },

    // Get session information
    getSessionInfo: function() {
        return {
            sessionId: this.generateSessionId(),
            loginTime: localStorage.getItem('loginTime') || 'unknown',
            lastActivity: new Date().toISOString()
        };
    },

    // Get browser information
    getBrowserInfo: function() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        };
    },

    // Get location information (IP, timezone)
    getLocationInfo: function() {
        return {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: new Date().toISOString()
        };
    },

    // Generate unique session ID
    generateSessionId: function() {
        let sessionId = localStorage.getItem('securitySessionId');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('securitySessionId', sessionId);
        }
        return sessionId;
    },

    // Store security event in localStorage
    storeSecurityEvent: function(event) {
        try {
            const events = JSON.parse(localStorage.getItem('securityEvents') || '[]');
            events.push(event);
            
            // Keep only last 1000 events to prevent storage bloat
            if (events.length > 1000) {
                events.splice(0, events.length - 1000);
            }
            
            localStorage.setItem('securityEvents', JSON.stringify(events));
        } catch (error) {
            console.error('Failed to store security event:', error);
        }
    },

    // Send to Supabase if available
    sendToSupabase: function(event) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            supabaseClient
                .from('security_events')
                .insert([{
                    event_type: event.eventType,
                    details: event.details,
                    user_info: event.user,
                    session_info: event.session,
                    browser_info: event.browser,
                    location_info: event.location,
                    timestamp: event.timestamp
                }])
                .then(result => {
                    if (result.error) {
                        console.log('Security event logged locally (Supabase unavailable)');
                    } else {
                        console.log('Security event logged to Supabase');
                    }
                })
                .catch(error => {
                    console.log('Security event logged locally (Supabase error)');
                });
        }
    },

    // Get security events for review
    getSecurityEvents: function(limit = 100) {
        try {
            const events = JSON.parse(localStorage.getItem('securityEvents') || '[]');
            return events.slice(-limit);
    } catch (error) {
            return [];
        }
    },

    // Clear old security events
    clearOldEvents: function(daysOld = 30) {
        try {
            const events = JSON.parse(localStorage.getItem('securityEvents') || '[]');
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            const filteredEvents = events.filter(event => {
                return new Date(event.timestamp) > cutoffDate;
            });
            
            localStorage.setItem('securityEvents', JSON.stringify(filteredEvents));
            console.log(`Cleared security events older than ${daysOld} days`);
    } catch (error) {
            console.error('Failed to clear old security events:', error);
        }
    }
};

// Enhanced login monitoring
window.LoginMonitor = {
    // Track login attempts
    trackLoginAttempt: function(username, success, details = {}) {
        SecurityLogger.logSecurityEvent('login_attempt', {
            username: username,
            success: success,
            details: details,
            timestamp: new Date().toISOString()
        });
    },

    // Track failed login attempts
    trackFailedLogin: function(username, reason) {
        SecurityLogger.logSecurityEvent('failed_login', {
            username: username,
            reason: reason,
            timestamp: new Date().toISOString()
        });
    },

    // Track successful login
    trackSuccessfulLogin: function(username, userInfo) {
        SecurityLogger.logSecurityEvent('successful_login', {
            username: username,
            userInfo: userInfo,
            timestamp: new Date().toISOString()
        });
    },

    // Track logout
    trackLogout: function(username, sessionDuration) {
        SecurityLogger.logSecurityEvent('logout', {
            username: username,
            sessionDuration: sessionDuration,
            timestamp: new Date().toISOString()
        });
    }
};

// Data access monitoring
window.DataAccessMonitor = {
    // Track patient data access
    trackPatientAccess: function(patientId, action, details = {}) {
        SecurityLogger.logSecurityEvent('patient_data_access', {
            patientId: patientId,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        });
    },

    // Track sensitive data modifications
    trackDataModification: function(dataType, recordId, changes) {
        SecurityLogger.logSecurityEvent('data_modification', {
            dataType: dataType,
            recordId: recordId,
            changes: changes,
            timestamp: new Date().toISOString()
        });
    },

    // Track data exports
    trackDataExport: function(dataType, recordCount, format) {
        SecurityLogger.logSecurityEvent('data_export', {
            dataType: dataType,
            recordCount: recordCount,
            format: format,
            timestamp: new Date().toISOString()
        });
    }
};

// System monitoring
window.SystemMonitor = {
    // Track system errors
    trackSystemError: function(error, context = {}) {
        SecurityLogger.logSecurityEvent('system_error', {
            error: error.message || error,
            stack: error.stack || 'No stack trace',
            context: context,
            timestamp: new Date().toISOString()
        });
    },

    // Track performance issues
    trackPerformanceIssue: function(metric, value, threshold) {
        SecurityLogger.logSecurityEvent('performance_issue', {
            metric: metric,
            value: value,
            threshold: threshold,
            timestamp: new Date().toISOString()
        });
    }
};

// Initialize security monitoring
function initializeSecurityMonitoring() {
    console.log('🔒 Enhanced security monitoring initialized');
    
    // Track page loads
    SecurityLogger.logSecurityEvent('page_load', {
        page: window.location.pathname,
        referrer: document.referrer,
        timestamp: new Date().toISOString()
    });

    // Track page unloads
    window.addEventListener('beforeunload', function() {
        SecurityLogger.logSecurityEvent('page_unload', {
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        });
    });

    // Track errors
    window.addEventListener('error', function(event) {
        SystemMonitor.trackSystemError(event.error, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    // Clean up old events weekly
    setInterval(function() {
        SecurityLogger.clearOldEvents(30);
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SecurityLogger,
        LoginMonitor,
        DataAccessMonitor,
        SystemMonitor,
        initializeSecurityMonitoring
    };
}

// Auto-initialize if loaded in browser
if (typeof window !== 'undefined') {
    window.SecurityLogger = SecurityLogger;
    window.LoginMonitor = LoginMonitor;
    window.DataAccessMonitor = DataAccessMonitor;
    window.SystemMonitor = SystemMonitor;
    
    // Initialize when DOM is ready
if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSecurityMonitoring);
} else {
        initializeSecurityMonitoring();
    }
}