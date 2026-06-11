/**
 * Mobile Login Fix
 * 
 * This script specifically fixes the "No API key found in request" error
 * on mobile browsers by ensuring the latest Supabase client is loaded.
 */

(function() {
  'use strict';
  
  console.log('🔧 Mobile login fix loaded');
  
  // Check if we're on mobile
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  
  if (!isMobile) {
    console.log('📱 Desktop detected - skipping mobile login fix');
    return;
  }
  
  console.log('📱 Mobile detected - applying login fix');
  
  // Check for the specific "No API key found" error
  function checkForAPIKeyError() {
    // Check if Supabase client is properly initialized
    if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
      console.log('⚠️ Supabase client not available - fixing...');
      return true;
    }
    
    // Check if we're on login page and have old version
    if (window.location.pathname.includes('login') || window.location.pathname.includes('index')) {
      const scripts = document.querySelectorAll('script[src*="v="]');
      for (const script of scripts) {
        if (script.src.includes('v=20251019043800')) {
          console.log('⚠️ Old version detected on login page - fixing...');
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Force reload with fresh files
  function forceMobileLoginFix() {
    console.log('🚀 Forcing mobile login fix...');
    
    // Clear all caches
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
    localStorage.setItem('mobileLoginFix', newVersion);
    
    // Force reload with cache busting
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('cb', newVersion);
    currentUrl.searchParams.set('v', newVersion);
    currentUrl.searchParams.set('mobile', '1');
    currentUrl.searchParams.set('fix', '1');
    
    console.log('🔄 Redirecting to:', currentUrl.toString());
    
    // Immediate redirect
    window.location.href = currentUrl.toString();
  }
  
  // Only fix once per session to avoid refresh loops
  const fixApplied = sessionStorage.getItem('mobileLoginFixApplied');
  
  if (fixApplied) {
    console.log('📱 Mobile login fix already applied this session - skipping');
    return;
  }
  
  // Check for issues and fix only once
  if (checkForAPIKeyError()) {
    console.log('🔧 API key error detected - applying fix ONCE');
    sessionStorage.setItem('mobileLoginFixApplied', 'true');
    forceMobileLoginFix();
    return;
  }
  
  // Mark as checked to avoid repeated checks
  sessionStorage.setItem('mobileLoginFixApplied', 'true');
  
})();