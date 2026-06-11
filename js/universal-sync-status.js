// Universal Sync Status Indicator
// Purpose: Provide consistent sync status display across all pages
// Version: v=1 - Universal sync status for all pages

(function() {
  'use strict';
  const debugLog = window.__DEBUG_LOGS ? console.log.bind(console) : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn.bind(console) : () => {};

  // Create sync status indicator
  function createSyncStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'sync-status';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      z-index: 1000;
      transition: all 0.3s ease;
    `;
    
    indicator.innerHTML = `
      <span id="sync-icon">🔄</span>
      <span id="sync-text">Checking connection...</span>
    `;
    
    return indicator;
  }

  // Update sync status indicator
  function updateSyncStatus(status, message, isOnline = true) {
    const syncStatus = document.getElementById('sync-status');
    const syncIcon = document.getElementById('sync-icon');
    const syncText = document.getElementById('sync-text');
    
    if (!syncStatus) return;
    
    // Update text
    syncText.textContent = message;
    
    // Update styling based on status
    switch(status) {
      case 'online':
        syncStatus.style.background = '#d4edda';
        syncStatus.style.color = '#155724';
        syncStatus.style.border = '1px solid #c3e6cb';
        syncIcon.textContent = '✅';
        break;
      case 'offline':
        syncStatus.style.background = '#f8d7da';
        syncStatus.style.color = '#721c24';
        syncStatus.style.border = '1px solid #f5c6cb';
        syncIcon.textContent = '❌';
        break;
      case 'syncing':
        syncStatus.style.background = '#fff3cd';
        syncStatus.style.color = '#856404';
        syncStatus.style.border = '1px solid #ffeaa7';
        syncIcon.textContent = '🔄';
        break;
      case 'error':
        syncStatus.style.background = '#f8d7da';
        syncStatus.style.color = '#721c24';
        syncStatus.style.border = '1px solid #f5c6cb';
        syncIcon.textContent = '⚠️';
        break;
      default:
        syncStatus.style.background = '#e2e3e5';
        syncStatus.style.color = '#383d41';
        syncStatus.style.border = '1px solid #d6d8db';
        syncIcon.textContent = '❓';
    }
  }

  function getCachedSupabaseSession() {
    try {
      const raw = localStorage.getItem('supabase_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.access_token) return null;
      if (parsed.expires_at && Date.now() / 1000 > parsed.expires_at) {
        return null;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  }

  // Check Supabase connection (lightweight, no network query)
  async function checkSupabaseConnection() {
    updateSyncStatus('syncing', 'Checking Supabase...');
    
    try {
      if (!navigator.onLine) {
        updateSyncStatus('offline', 'No internet connection');
        return;
      }
      const cachedSession = getCachedSupabaseSession();
      if (cachedSession) {
        updateSyncStatus('online', 'Connected to online data repository');
        return;
      }
      if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
        // Use session presence as a lightweight readiness signal
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error) {
          debugWarn('Supabase session check failed:', error.message);
          updateSyncStatus('offline', 'Online data repository offline - using local storage');
        } else if (data && data.session) {
          debugLog('Supabase session detected');
          updateSyncStatus('online', 'Connected to online data repository');
        } else {
          updateSyncStatus('offline', 'No active session - using local storage');
        }
      } else {
        updateSyncStatus('offline', 'Online data client not available - using local storage');
      }
    } catch (err) {
      debugWarn('Connection check failed:', err);
      updateSyncStatus('error', 'Connection error - using local storage');
    }
  }

  // Check online/offline status
  function checkOnlineStatus() {
    if (navigator.onLine) {
      checkSupabaseConnection();
    } else {
      updateSyncStatus('offline', 'No internet connection');
    }
  }

  // Initialize sync status indicator
  function initSyncStatusIndicator() {
    // Skip on login and register pages
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const excludedPages = ['login.html', 'login', 'register.html', 'register', 'index.html', 'index', ''];

    if (excludedPages.includes(currentPage) || excludedPages.includes(currentPage.replace('.html', ''))) {
      return;
    }

    // Check if sync status already exists (don't duplicate)
    if (document.getElementById('sync-status')) {
      return;
    }

    // Create and add indicator
    const indicator = createSyncStatusIndicator();
    document.body.appendChild(indicator);

    // Initial status check with auto-hide
    checkOnlineStatusWithAutoHide();

    // Listen for online/offline events
    window.addEventListener('online', () => {
      debugLog('Internet connection restored');
      checkSupabaseConnectionWithAutoHide();
    });
    
    window.addEventListener('offline', () => {
      debugLog('Internet connection lost');
      updateSyncStatus('offline', 'No internet connection');
      // Don't auto-hide offline status
    });

    // Check connection when page becomes visible
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        checkSupabaseConnectionWithAutoHide();
      }
    });

    debugLog('📡 Universal sync status indicator initialized');
  }

  // Check online status with auto-hide
  function checkOnlineStatusWithAutoHide() {
    if (navigator.onLine) {
      checkSupabaseConnectionWithAutoHide();
    } else {
      updateSyncStatus('offline', 'No internet connection');
    }
  }

  // Check Supabase connection with auto-hide
  async function checkSupabaseConnectionWithAutoHide() {
    updateSyncStatus('syncing', 'Checking Supabase...');
    
    try {
      if (!navigator.onLine) {
        updateSyncStatus('offline', 'No internet connection');
        return;
      }
      const cachedSession = getCachedSupabaseSession();
      if (cachedSession) {
        updateSyncStatus('online', 'Connected to online data repository');
        return;
      }
      // Wait for Supabase client to be available (mobile compatibility)
      let retryCount = 0;
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      const maxRetries = isMobile ? 5 : 3;
      const retryDelay = isMobile ? 1000 : 500;
      
      while (retryCount < maxRetries && (typeof window.supabaseClient === 'undefined' || !window.supabaseClient)) {
        debugLog(`⏳ Waiting for Supabase client... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryCount++;
      }
      
      if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error) {
          debugWarn('Supabase session check failed:', error.message);
          updateSyncStatus('offline', 'Online data repository offline - using local storage');
        } else if (data && data.session) {
          debugLog('Supabase session detected');
          updateSyncStatus('online', 'Connected to online data repository');
        } else {
          updateSyncStatus('offline', 'No active session - using local storage');
        }
      } else {
        updateSyncStatus('offline', 'Online data client not available - using local storage');
      }
    } catch (err) {
      debugWarn('Connection check failed:', err);
      updateSyncStatus('error', 'Connection error - using local storage');
    } finally {
      // Auto-hide after 2-3 seconds depending on state
      const hideDelay = document.getElementById('sync-status')?.textContent?.includes('Connected') ? 2000 : 3000;
      setTimeout(() => {
        const indicator = document.getElementById('sync-status');
        if (indicator) indicator.style.display = 'none';
      }, hideDelay || 3000);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncStatusIndicator);
  } else {
    initSyncStatusIndicator();
  }

  // Expose functions globally for debugging
  window.updateSyncStatus = updateSyncStatus;
  window.checkSupabaseConnection = checkSupabaseConnection;

})();
