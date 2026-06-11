// Logout Button Component
// Provides consistent logout functionality across all pages
// ALWAYS displays as a small button in the top right corner

/**
 * Handle logout action
 */
async function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  try {
    // Try Supabase logout first
    if (typeof window.logoutFromSupabase === 'function') {
      const result = await window.logoutFromSupabase();
      if (result && result.success) {
        console.log('✅ Logged out from Supabase');
      }
    } else if (typeof window.supabaseLogout === 'function') {
      const result = await window.supabaseLogout();
      if (result && result.success) {
        console.log('✅ Logged out from Supabase');
      }
    }
    
    // Clear localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('organizations');
    
    // Clear encryption key if available
    if (typeof window.encryptionService !== 'undefined' && window.encryptionService) {
      window.encryptionService.clearKey();
    }
    
    // Redirect to login
    window.location.href = '/login';
    
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Still clear localStorage and redirect
    localStorage.removeItem('user');
    localStorage.removeItem('supabase_session');
    window.location.href = '/login';
  }
}

/**
 * Add logout button to page - ALWAYS in top right corner
 * This function ensures consistent placement across all pages
 */
function addLogoutButton() {
  // Check if user is logged in
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user || (!user.email && !user.username)) {
    // Not logged in, don't show logout button
    return;
  }
  
  // Skip login/register pages
  const isLoginPage = window.location.pathname.includes('login') || 
                      window.location.pathname.includes('register') ||
                      window.location.pathname.includes('index.html');
  if (isLoginPage) {
    return;
  }
  
  // Check if logout button already exists
  if (document.getElementById('global-logout-button')) {
    return;
  }
  
  // Create logout button - ALWAYS fixed position in top right
  const logoutButton = document.createElement('button');
  logoutButton.id = 'global-logout-button';
  logoutButton.setAttribute('onclick', 'handleLogout()');
  logoutButton.setAttribute('title', 'Logout');
  logoutButton.setAttribute('aria-label', 'Logout');
  
  // Power off icon
  logoutButton.innerHTML = '⏻ Logout';
  
  // CRITICAL: Always use fixed positioning in top right corner
  // Small, compact button that doesn't interfere with page content
  // Use individual style properties to override any CSS that might affect buttons
  logoutButton.style.position = 'fixed';
  logoutButton.style.top = '20px';
  logoutButton.style.right = '20px';
  logoutButton.style.zIndex = '99999';
  logoutButton.style.background = 'linear-gradient(135deg, #8B0000 0%, #DC143C 100%)';
  logoutButton.style.color = '#FFFFFF';
  logoutButton.style.border = '2px solid #8B0000';
  logoutButton.style.padding = '8px 14px';
  logoutButton.style.borderRadius = '6px';
  logoutButton.style.cursor = 'pointer';
  logoutButton.style.fontWeight = '700';
  logoutButton.style.fontSize = '13px';
  logoutButton.style.transition = 'all 0.3s ease';
  logoutButton.style.boxShadow = '0 3px 10px rgba(139, 0, 0, 0.4)';
  logoutButton.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
  logoutButton.style.whiteSpace = 'nowrap';
  logoutButton.style.display = 'inline-flex';
  logoutButton.style.alignItems = 'center';
  logoutButton.style.gap = '6px';
  logoutButton.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  logoutButton.style.lineHeight = '1';
  logoutButton.style.minWidth = 'auto';
  logoutButton.style.maxWidth = 'none';
  logoutButton.style.width = 'auto';
  logoutButton.style.margin = '0';
  logoutButton.style.flex = 'none';
  logoutButton.style.flexGrow = '0';
  logoutButton.style.flexShrink = '0';
  logoutButton.style.flexBasis = 'auto';
  
  // Hover effects
  logoutButton.addEventListener('mouseenter', function() {
    this.style.background = 'linear-gradient(135deg, #DC143C 0%, #8B0000 100%) !important';
    this.style.transform = 'translateY(-2px)';
    this.style.boxShadow = '0 5px 15px rgba(139, 0, 0, 0.5) !important';
  });
  
  logoutButton.addEventListener('mouseleave', function() {
    this.style.background = 'linear-gradient(135deg, #8B0000 0%, #DC143C 100%) !important';
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 3px 10px rgba(139, 0, 0, 0.4) !important';
  });
  
  // Add to body
  document.body.appendChild(logoutButton);
}

// Auto-add logout button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addLogoutButton);
} else {
  addLogoutButton();
}

// Also try after a short delay to catch dynamically loaded pages
setTimeout(addLogoutButton, 500);

// Make functions globally available
window.handleLogout = handleLogout;
window.addLogoutButton = addLogoutButton;
