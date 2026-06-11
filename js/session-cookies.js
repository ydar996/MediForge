// Purpose: Secure session management using httpOnly cookies with localStorage fallback
// Provides enhanced security while maintaining backward compatibility

/**
 * Cookie helper functions with httpOnly-like security
 * Note: True httpOnly cookies require server-side setting, but we can use secure cookies
 * with SameSite and Secure flags for enhanced protection
 */

const SESSION_CONFIG = {
  cookieName: 'mediforge_session',
  cookieNameLegacy: 'mediforge_session_token',
  maxAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  sameSite: 'Strict', // 'Strict', 'Lax', or 'None'
  secure: window.location.protocol === 'https:' // Only set Secure flag on HTTPS
};

/**
 * Set a secure cookie (as secure as possible in client-side JS)
 * Note: True httpOnly requires server-side, but we use SameSite and Secure flags
 */
function setSecureCookie(name, value, maxAge = SESSION_CONFIG.maxAge) {
  try {
    const expires = new Date(Date.now() + maxAge).toUTCString();
    let cookieString = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
    
    // Add SameSite attribute for CSRF protection
    cookieString += `; SameSite=${SESSION_CONFIG.sameSite}`;
    
    // Add Secure flag if on HTTPS
    if (SESSION_CONFIG.secure) {
      cookieString += '; Secure';
    }
    
    document.cookie = cookieString;
    return true;
  } catch (error) {
    console.warn('⚠️ Failed to set secure cookie (falling back to localStorage):', error);
    return false;
  }
}

/**
 * Get cookie value
 */
function getCookie(name) {
  try {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Failed to read cookie:', error);
    return null;
  }
}

/**
 * Delete cookie
 */
function deleteCookie(name) {
  try {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=${SESSION_CONFIG.sameSite}`;
    if (SESSION_CONFIG.secure) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=${SESSION_CONFIG.sameSite}; Secure`;
    }
    return true;
  } catch (error) {
    console.warn('⚠️ Failed to delete cookie:', error);
    return false;
  }
}

/**
 * Store session token in secure cookie (with localStorage fallback)
 * Uses dual storage for backward compatibility
 */
window.storeSessionToken = function(token) {
  try {
    // Try to store in secure cookie first
    const cookieStored = setSecureCookie(SESSION_CONFIG.cookieName, token);
    
    // Also store in localStorage as fallback (for backward compatibility)
    // This ensures the app still works if cookies are blocked
    localStorage.setItem('sessionToken', token);
    localStorage.setItem('sessionTokenStorageMethod', cookieStored ? 'cookie' : 'localStorage');
    
    if (cookieStored) {
      console.log('✅ Session token stored in secure cookie');
    } else {
      console.warn('⚠️ Session token stored in localStorage (cookies may be blocked)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to store session token:', error);
    // Fallback to localStorage only
    localStorage.setItem('sessionToken', token);
    return false;
  }
};

/**
 * Retrieve session token (cookie first, then localStorage fallback)
 */
window.getSessionToken = function() {
  try {
    // Try cookie first (more secure)
    const cookieToken = getCookie(SESSION_CONFIG.cookieName);
    if (cookieToken) {
      return cookieToken;
    }
    
    // Fallback to localStorage (backward compatibility)
    const localStorageToken = localStorage.getItem('sessionToken');
    if (localStorageToken) {
      // Try to migrate to cookie
      setSecureCookie(SESSION_CONFIG.cookieName, localStorageToken);
      return localStorageToken;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to get session token:', error);
    // Fallback to localStorage
    return localStorage.getItem('sessionToken');
  }
};

/**
 * Clear session token from both cookie and localStorage
 */
window.clearSessionToken = function() {
  try {
    // Clear cookie
    deleteCookie(SESSION_CONFIG.cookieName);
    deleteCookie(SESSION_CONFIG.cookieNameLegacy);
    
    // Clear localStorage (backward compatibility)
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('sessionTokenStorageMethod');
    
    console.log('✅ Session token cleared from cookie and localStorage');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear session token:', error);
    // Fallback: at least clear localStorage
    localStorage.removeItem('sessionToken');
    return false;
  }
};

/**
 * Check if cookies are enabled (for testing/debugging)
 */
window.areCookiesEnabled = function() {
  try {
    const testCookie = 'mediforge_cookie_test';
    setSecureCookie(testCookie, 'test', 1000);
    const result = getCookie(testCookie) === 'test';
    deleteCookie(testCookie);
    return result;
  } catch (error) {
    return false;
  }
};

console.log('✅ Secure session cookie management loaded');
console.log('   Cookies enabled:', window.areCookiesEnabled ? window.areCookiesEnabled() : 'unknown');

