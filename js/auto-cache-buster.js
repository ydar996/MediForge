/**
 * DISABLED: Auto Cache Buster for Mobile Browsers
 * 
 * This script was causing endless refresh loops on mobile devices.
 * DISABLED to prevent registration and other form interactions from breaking.
 */

(function() {
  'use strict';
  
  console.log('🔄 Auto cache buster loaded with smart loop prevention');
  
  // ALL CODE BELOW IS DISABLED TO PREVENT REFRESH LOOPS
  
  // Check if we're on mobile
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  
  if (!isMobile) {
    console.log('📱 Desktop detected - skipping auto cache bust');
    return;
  }
  
  console.log('📱 Mobile detected - checking for cache issues');
  
  // Get current version from script tags
  const currentVersion = getCurrentVersion();
  const storedVersion = localStorage.getItem('appVersion');
  
  console.log('Current version:', currentVersion);
  console.log('Stored version:', storedVersion);
  
  // Check for cache issues with loop prevention
  const hasCacheIssues = checkForCacheIssues();
  
  if (hasCacheIssues) {
    // LOOP PREVENTION: Check if we recently refreshed
    const lastRefresh = localStorage.getItem('lastAutoCacheRefresh');
    const now = Date.now();
    if (lastRefresh && (now - parseInt(lastRefresh)) < 15000) { // 15 seconds cooldown
      console.log('⚠️ Cache issues detected but refresh cooldown active');
      return;
    }
    
    console.log('⚠️ Cache issues detected - performing smart refresh');
    localStorage.setItem('lastAutoCacheRefresh', now.toString());
    forceMobileRefresh();
    return;
  }
  
  // Update stored version
  if (currentVersion) {
    localStorage.setItem('appVersion', currentVersion);
  }
  
  function getCurrentVersion() {
    // Try to get version from script tags
    const scripts = document.querySelectorAll('script[src*="v="]');
    for (const script of scripts) {
      const match = script.src.match(/[?&]v=([^&]+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Fallback: generate timestamp-based version
    return new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  }
  
  function checkForCacheIssues() {
    // Check for old version patterns
    const scripts = document.querySelectorAll('script[src*="v="]');
    for (const script of scripts) {
      if (script.src.includes('v=20251019043800')) {
        console.log('⚠️ Old version detected:', script.src);
        return true;
      }
    }
    
    // Check for missing organization ID (indicates cache issues)
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.username && !user.organizationId) {
      console.log('⚠️ Missing organization ID - likely cache issue');
      return true;
    }
    
    return false;
  }
  
  function forceMobileRefresh() {
    console.log('🚀 Forcing mobile refresh...');
    
    // Clear problematic caches
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
          console.log('✅ Cleared cache:', cacheName);
        });
      });
    }
    
    // Update version
    const newVersion = Date.now().toString();
    localStorage.setItem('appVersion', newVersion);
    localStorage.setItem('cacheBustVersion', newVersion);
    
    // Force reload with cache busting
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('cb', newVersion);
    currentUrl.searchParams.set('v', newVersion);
    currentUrl.searchParams.set('refresh', '1');
    currentUrl.searchParams.set('mobile', '1');
    
    console.log('🔄 Redirecting to:', currentUrl.toString());
    
    // Small delay to ensure logs are visible
    setTimeout(() => {
      window.location.href = currentUrl.toString();
    }, 1000);
  }
  
  function showCacheWarning() {
    // Only show warning if not already shown
    if (localStorage.getItem('cacheWarningShown')) {
      return;
    }
    
    console.log('⚠️ Showing cache warning to user');
    localStorage.setItem('cacheWarningShown', 'true');
    
    // Show a subtle notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      font-size: 14px;
    `;
    notification.innerHTML = `
      <strong>🔄 Cache Issue Detected</strong><br>
      <button onclick="this.parentElement.remove(); window.location.reload();" 
              style="background: white; color: #ff6b6b; border: none; padding: 5px 10px; border-radius: 4px; margin-top: 10px; cursor: pointer;">
        Refresh Page
      </button>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }
  
})();
