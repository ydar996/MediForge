// Platform Read-Only Mode
// Purpose: Make all forms and data read-only when platform admin is viewing a clinic
// Platform admins can VIEW but not EDIT clinic data

(function() {
  'use strict';
  const debugLog = window.__DEBUG_LOGS ? console.log.bind(console) : () => {};
  
  // Check if current session is platform admin viewing a clinic
  window.isPlatformViewMode = function() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user && user._isPlatformView === true && user.role === 'PlatformOwner';
  };
  
  // Exit organization view function (fallback if not defined in platform-admin.js)
  if (typeof window.exitOrganizationView === 'undefined') {
    window.exitOrganizationView = function() {
      debugLog('🔄 exitOrganizationView called from platform-readonly.js');
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user._isPlatformView) {
        debugLog('🔄 Exiting platform view, returning to platform dashboard');
        
        // Clear the temporary user context
        localStorage.removeItem("user");
        
        // Restore platform admin session if it was preserved
        if (user._originalPlatformAdmin) {
          localStorage.setItem("platformAdmin", JSON.stringify(user._originalPlatformAdmin));
        }
        
        window.location.href = "/platform-dashboard";
      } else {
        debugLog('❌ Not in platform view mode');
      }
    };
  }
  
  // Make all form inputs read-only
  window.enableReadOnlyMode = function() {
    if (!isPlatformViewMode()) {
      return; // Not in platform view mode
    }
    
    debugLog('Platform View Mode: Making page read-only');
    
    // Disable all form inputs
    const inputs = document.querySelectorAll('input:not([type="button"]):not([type="submit"]), textarea, select');
    inputs.forEach(input => {
      input.disabled = true;
      input.style.background = '#f5f5f5';
      input.style.cursor = 'not-allowed';
    });
    
    // Disable all buttons except navigation buttons
    const buttons = document.querySelectorAll('button[type="submit"], button[onclick*="save"], button[onclick*="add"], button[onclick*="delete"], button[onclick*="update"], button[onclick*="create"]');
    buttons.forEach(button => {
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      button.title = 'Read-only mode - Platform admin cannot edit clinic data';
    });
    
    // Add read-only banner at top of page
    const banner = document.createElement('div');
    banner.id = 'readonly-banner';
    banner.style.cssText = `
      background: linear-gradient(135deg, #FF9800, #F57C00);
      color: white;
      padding: 15px 20px;
      text-align: center;
      font-weight: 600;
      font-size: 16px;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    banner.innerHTML = `
      👁️ READ-ONLY MODE: You are viewing this clinic as Platform Administrator. You cannot edit data.
      <button onclick="exitOrganizationView()" style="background: white; color: #FF9800; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; margin-left: 20px;">
        ← Return to Platform Dashboard
      </button>
    `;
    
    // Insert banner at top of body
    if (document.body && !document.getElementById('readonly-banner')) {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  };
  
  // Auto-enable read-only mode on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(enableReadOnlyMode, 100);
    });
  } else {
    setTimeout(enableReadOnlyMode, 100);
  }
  
  debugLog('Platform read-only mode module loaded');
})();


