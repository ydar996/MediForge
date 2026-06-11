/**
 * Mobile Session Fix
 * Fixes login loop issues on mobile devices
 */

console.log('🔧 Mobile session fix loaded');

// Override session management for mobile devices
if (window.initializeSessionManagement) {
  // Store original function
  const originalInitSession = window.initializeSessionManagement;
  
  // Override with mobile-friendly version
  window.initializeSessionManagement = function() {
    console.log('🔧 Mobile session management initialized');
    
    // Skip on login and register pages
    const currentPage = window.location.pathname.split('/').pop();
    const excludedPages = [
      'login', 
      'register', 
      'index', 
      'platform-login',
      'platform-dashboard',
      'manage-clinics',
      'clinic-details',
      'platform-analytics',
      'platform-audit-log',
      'register-clinic',
      'platform-settings',
      'platform-subscriptions'
    ];
    
    if (excludedPages.includes(currentPage)) {
      console.log('🔧 Skipping session management on excluded page:', currentPage);
      return;
    }
    
    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.username) {
      console.log('🔧 No user found, skipping session management');
      return;
    }
    
    console.log('🔧 User found, initializing mobile-friendly session management');
    
    // Mobile-friendly session timeout (much longer for mobile)
    const MOBILE_SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours for mobile
    let lastActivity = Date.now();
    let sessionCheckInterval = null;
    
    // Update activity on user interaction
    const updateActivity = () => {
      lastActivity = Date.now();
      console.log('🔧 Activity updated:', new Date(lastActivity).toLocaleTimeString());
    };
    
    // Add event listeners for user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });
    
    // Check session timeout
    const checkSessionTimeout = () => {
      const timeSinceActivity = Date.now() - lastActivity;
      console.log('🔧 Time since activity:', Math.round(timeSinceActivity / 1000), 'seconds');
      
      if (timeSinceActivity > MOBILE_SESSION_TIMEOUT) {
        console.log('🔧 Session expired, clearing session');
        clearInterval(sessionCheckInterval);
        
        // Clear session data
        localStorage.removeItem('user');
        
        // Show mobile-friendly message
        if (confirm('Your session has expired due to inactivity. Would you like to login again?')) {
          window.location.href = 'login';
        } else {
          // User chose not to login, stay on current page but clear session
          console.log('🔧 User chose not to login, session cleared');
        }
      }
    };
    
    // Start session checking (check every 30 minutes to reduce false timeouts)
    sessionCheckInterval = setInterval(checkSessionTimeout, 30 * 60 * 1000);
    
    console.log('🔧 Mobile session management started');
  };
}

// Fix for mobile devices that might have cached session issues
if (navigator.userAgent.match(/Mobile|Android|iPhone|iPad/)) {
  console.log('🔧 Mobile device detected, applying mobile fixes');
  
  // Clear any problematic cached data on mobile
  const clearMobileCache = () => {
    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('mediforge-cache')) {
            caches.delete(name);
            console.log('🔧 Cleared cache:', name);
          }
        });
      });
    }
  };
  
  // Clear cache on page load for mobile
  clearMobileCache();
  
  // Also clear cache when user logs out
  const originalLogout = window.logout;
  if (originalLogout) {
    window.logout = function() {
      console.log('🔧 Mobile logout - clearing cache');
      clearMobileCache();
      localStorage.removeItem("user");
      window.location.href = "login";
    };
  }
}

console.log('🔧 Mobile session fix completed');
