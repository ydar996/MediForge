/**
 * Smart Mobile Cache Buster
 * 
 * This script provides intelligent cache busting for mobile browsers
 * without being aggressive or interfering with user interaction.
 */

(function() {
  'use strict';
  
  console.log('📱 Smart mobile cache buster loaded');
  
  // Check if we're on mobile
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  
  if (!isMobile) {
    console.log('📱 Desktop detected - skipping mobile cache bust');
    return;
  }
  
  console.log('📱 Mobile detected - initializing smart cache busting');
  
  // Configuration
  const CONFIG = {
    // ENABLED: Smart auto-refresh only when needed
    autoRefresh: true,
    
    // ENABLED: Show notifications for important updates
    showNotification: true,
    
    // Check for specific problematic patterns
    problematicVersions: [
      'v=20251019043800',
      'v=20251018191427',
      'v=202510220113110113111311'
    ],
    
    // Check for missing functionality
    missingFeatures: [
      'window.supabaseClient',
      'window.supabaseClient.auth',
      'window.supabaseClient.from'
    ]
  };
  
  // Check for cache issues without being aggressive
  function checkCacheIssues() {
    console.log('🔍 Checking for mobile cache issues...');
    
    const issues = [];
    
    // Check for old version patterns
    const scripts = document.querySelectorAll('script[src*="v="]');
    for (const script of scripts) {
      for (const problematicVersion of CONFIG.problematicVersions) {
        if (script.src.includes(problematicVersion)) {
          issues.push(`Old version detected: ${problematicVersion}`);
          break;
        }
      }
    }
    
    // Check for missing Supabase functionality
    if (typeof window.supabaseClient === 'undefined') {
      issues.push('Supabase client not available');
    } else if (!window.supabaseClient.auth) {
      issues.push('Supabase auth not available');
    }
    
    // Check for API key issues
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      // Test a simple request to see if API key is working
      window.supabaseClient.from('organizations').select('id').limit(1)
        .then(({ error }) => {
          if (error && error.message.includes('No API key found')) {
            issues.push('API key not working');
          }
        })
        .catch(() => {
          // Ignore errors for this check
        });
    }
    
    return issues;
  }
  
  // Show smart notification
  function showSmartNotification(issues) {
    if (!CONFIG.showNotification) return;
    
    // Don't show if already shown recently
    const lastShown = localStorage.getItem('mobileCacheNotificationShown');
    const now = Date.now();
    if (lastShown && (now - parseInt(lastShown)) < 300000) { // 5 minutes
      return;
    }
    
    console.log('📱 Showing smart cache notification');
    localStorage.setItem('mobileCacheNotificationShown', now.toString());
    
    const notification = document.createElement('div');
    notification.id = 'mobile-cache-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 320px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <span style="font-size: 18px; margin-right: 8px;">🔄</span>
        <strong>Update Available</strong>
      </div>
      <div style="margin-bottom: 15px; line-height: 1.4;">
        A newer version is available. Tap refresh to get the latest features and fixes.
      </div>
      <div style="display: flex; gap: 10px;">
        <button onclick="refreshMobileCache()" style="
          background: white;
          color: #667eea;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        ">Refresh Now</button>
        <button onclick="dismissMobileCacheNotification()" style="
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        ">Later</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (document.getElementById('mobile-cache-notification')) {
        dismissMobileCacheNotification();
      }
    }, 30000);
  }
  
  // Global functions for the notification buttons
  window.refreshMobileCache = function() {
    console.log('🔄 User requested mobile cache refresh');
    
    // Clear caches
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
          console.log('✅ Cleared cache:', cacheName);
        });
      });
    }
    
    // Set new version
    const newVersion = Date.now().toString();
    localStorage.setItem('appVersion', newVersion);
    localStorage.setItem('mobileCacheRefresh', newVersion);
    
    // Refresh with cache busting
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('cb', newVersion);
    currentUrl.searchParams.set('v', newVersion);
    currentUrl.searchParams.set('mobile', '1');
    
    console.log('🔄 Refreshing with cache busting...');
    window.location.href = currentUrl.toString();
  };
  
  window.dismissMobileCacheNotification = function() {
    const notification = document.getElementById('mobile-cache-notification');
    if (notification) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  };
  
  // Main logic - check for issues and show notification if needed
  function initializeSmartCacheBuster() {
    console.log('📱 Initializing smart mobile cache buster...');
    
    // Wait a bit for page to load
    setTimeout(() => {
      const issues = checkCacheIssues();
      
      if (issues.length > 0) {
        console.log('📱 Cache issues detected:', issues);
        showSmartNotification(issues);
      } else {
        console.log('📱 No cache issues detected');
      }
    }, 2000); // Wait 2 seconds for page to fully load
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSmartCacheBuster);
  } else {
    initializeSmartCacheBuster();
  }
  
})();
