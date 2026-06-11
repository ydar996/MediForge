// Universal Sync Manager
// Purpose: Ensures ALL pages can sync with Supabase, regardless of whether they load universal-data-loader.js
// Version: 1.0 - Universal cross-page sync solution
// This script works independently and can be included on ANY page

(function() {
  'use strict';

  console.log('📡 Universal Sync Manager initialized - All-page sync enabled');

  // Check if we're on a login/index page
  function isLoginPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('login') || path.includes('index') || path.includes('register');
  }

  // Get user from localStorage safely
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch (e) {
      return {};
    }
  }

  // Get organization-specific data key
  function getDataKey(key) {
    const user = getUser();
    return user && user.org ? `${user.org}_${key}` : key;
  }

  // Check if Supabase is available
  function isSupabaseAvailable() {
    return typeof window.supabaseClient !== 'undefined' && window.supabaseClient;
  }

  // Detect stale data by comparing localStorage timestamps with Supabase
  async function detectStaleData() {
    const user = getUser();
    if (!user || !user.username) {
      return { isStale: false, reason: 'No user logged in' };
    }

    if (!isSupabaseAvailable()) {
      return { isStale: false, reason: 'Supabase not available' };
    }

    try {
      // Check if we have localStorage data
      const patientsKey = getDataKey("patients");
      const localPatients = JSON.parse(localStorage.getItem(patientsKey) || "[]");
      
      if (localPatients.length === 0) {
        return { isStale: false, reason: 'No local data to check' };
      }

      // Get organization ID
      let orgId = user.organizationId;
      if (!orgId && user.org) {
        const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = orgs[user.org];
        orgId = orgData?.id;
      }

      if (!orgId) {
        return { isStale: false, reason: 'No organization ID found' };
      }

      // Quick check: Count patients in Supabase vs localStorage
      const { count: supabaseCount } = await window.supabaseClient
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const localCount = localPatients.length;

      if (supabaseCount !== localCount) {
        return {
          isStale: true,
          reason: `Count mismatch: Supabase has ${supabaseCount}, localStorage has ${localCount}`,
          supabaseCount,
          localCount
        };
      }

      return { isStale: false, reason: 'Data appears fresh' };
    } catch (error) {
      console.warn('⚠️ Error detecting stale data:', error);
      return { isStale: false, reason: 'Error during check', error: error.message };
    }
  }

  // Force sync with Supabase (uses forceSyncWithSupabase if available, otherwise does it manually)
  async function performForceSync(options = {}) {
    const {
      clearStaleLocalStorage = true,
      showProgress = true,
      showNotification = true
    } = options;

    if (showProgress) {
      console.log('🔄 Universal Sync Manager: Starting force sync...');
    }

    // Try to use the existing forceSyncWithSupabase if available
    if (typeof window.forceSyncWithSupabase === 'function') {
      if (showProgress) {
        console.log('✅ Using existing forceSyncWithSupabase function');
      }
      return await window.forceSyncWithSupabase({ clearStaleLocalStorage, showProgress });
    }

    // Fallback: Manual sync if forceSyncWithSupabase not available
    if (showProgress) {
      console.log('⚠️ forceSyncWithSupabase not available, performing manual sync');
    }

    const user = getUser();
    if (!user || !user.username) {
      return { success: false, error: 'No user logged in' };
    }

    if (!isSupabaseAvailable()) {
      return { success: false, error: 'Supabase not available' };
    }

    try {
      // Get organization ID
      let orgId = user.organizationId;
      if (!orgId && user.org) {
        const orgs = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = orgs[user.org];
        orgId = orgData?.id;
      }

      if (!orgId) {
        return { success: false, error: 'No organization ID found' };
      }

      // Clear stale localStorage if requested
      if (clearStaleLocalStorage) {
        const orgPrefix = user.org ? `${user.org}_` : '';
        const dataKeys = [`${orgPrefix}patients`, `${orgPrefix}appointments`, 'patients', 'appointments'];
        dataKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            if (showProgress) console.log(`🗑️ Cleared: ${key}`);
          }
        });
      }

      // Load fresh data from Supabase
      const { data: patients, error: patientsError } = await window.supabaseClient
        .from('patients')
        .select('*')
        .eq('organization_id', orgId);

      if (patientsError) {
        throw new Error(`Supabase error: ${patientsError.message}`);
      }

      // Convert and save to localStorage
      if (patients && patients.length > 0) {
        const convertedPatients = patients.map(p => ({
          id: p.patient_id,
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          // Add other fields as needed
        }));

        localStorage.setItem(getDataKey("patients"), JSON.stringify(convertedPatients));
        if (showProgress) console.log(`✅ Synced ${convertedPatients.length} patients`);
      }

      // Show notification if requested
      if (showNotification) {
        showSyncNotification('✅ Data synced successfully!', 'success');
      }

      return {
        success: true,
        patients: patients?.length || 0,
        organization: user.org
      };

    } catch (error) {
      console.error('❌ Universal Sync Manager: Sync failed:', error);
      if (showNotification) {
        showSyncNotification('❌ Sync failed: ' + error.message, 'error');
      }
      return { success: false, error: error.message };
    }
  }

  // Show sync notification
  function showSyncNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('universal-sync-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'universal-sync-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-weight: bold;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    if (!document.getElementById('universal-sync-animations')) {
      style.id = 'universal-sync-animations';
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  // Create sync button in the UI
  function createSyncButton() {
    // Check if button already exists
    if (document.getElementById('universal-sync-button')) {
      return;
    }

    // Don't show on login pages
    if (isLoginPage()) {
      return;
    }

    const user = getUser();
    if (!user || !user.username) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'universal-sync-button';
    button.innerHTML = '🔄 Sync Data';
    button.title = 'Force sync with Supabase to get latest data';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: 2px solid #667eea;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 3px 10px rgba(102, 126, 234, 0.4);
      z-index: 9999;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1;
      min-width: auto;
      max-width: none;
      width: auto;
      margin: 0;
    `;

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.background = 'linear-gradient(135deg, #764ba2, #667eea)';
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 5px 15px rgba(102, 126, 234, 0.5)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 3px 10px rgba(102, 126, 234, 0.4)';
    });

    // Click handler
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.innerHTML = '⏳ Syncing...';
      button.style.opacity = '0.7';

      const result = await performForceSync({
        clearStaleLocalStorage: true,
        showProgress: true,
        showNotification: true
      });

      // Reload page data if sync successful
      if (result.success) {
        // Dispatch event for pages to refresh
        window.dispatchEvent(new CustomEvent('universalSyncComplete', {
          detail: result
        }));

        // Reload page if on a data-heavy page (optional)
        const shouldReload = confirm('✅ Sync complete! Reload page to see updated data?');
        if (shouldReload) {
          window.location.reload();
        } else {
          button.innerHTML = '✅ Synced';
          setTimeout(() => {
            button.innerHTML = '🔄 Sync Data';
            button.disabled = false;
            button.style.opacity = '1';
          }, 2000);
        }
      } else {
        button.innerHTML = '❌ Failed';
        setTimeout(() => {
          button.innerHTML = '🔄 Sync Data';
          button.disabled = false;
          button.style.opacity = '1';
        }, 2000);
      }
    });

    document.body.appendChild(button);
  }

  // Auto-detect stale data and prompt user
  async function autoDetectAndPrompt() {
    if (isLoginPage()) {
      return;
    }

    const user = getUser();
    if (!user || !user.username) {
      return;
    }

    // Only check once per session
    const lastCheck = sessionStorage.getItem('universalSyncLastCheck');
    const now = Date.now();
    if (lastCheck && (now - parseInt(lastCheck)) < 60000) { // Check max once per minute
      return;
    }
    sessionStorage.setItem('universalSyncLastCheck', now.toString());

    try {
      const staleCheck = await detectStaleData();
      
      if (staleCheck.isStale) {
        console.warn('⚠️ Stale data detected:', staleCheck.reason);
        
        // Show subtle notification (not intrusive)
        const notification = document.createElement('div');
        notification.innerHTML = `
          <div style="padding: 12px; border-left: 4px solid #FF9800;">
            <strong>⚠️ Data may be outdated</strong><br>
            <span style="font-size: 12px;">Your local data may not match the latest changes. 
            <button onclick="window.performUniversalSync()" style="margin-left: 8px; padding: 4px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Sync Now
            </button></span>
          </div>
        `;
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 9998;
          max-width: 500px;
          animation: slideDown 0.3s ease;
        `;

        // Add animation
        if (!document.getElementById('universal-sync-animations')) {
          const style = document.createElement('style');
          style.id = 'universal-sync-animations';
          style.textContent = `
            @keyframes slideDown {
              from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          `;
          document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
          }
        }, 10000);
      }
    } catch (error) {
      console.warn('⚠️ Error in auto-detect:', error);
    }
  }

  // Expose functions globally
  window.performUniversalSync = performForceSync;
  window.detectUniversalStaleData = detectStaleData;

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        createSyncButton();
        // Auto-detect stale data after a delay (don't block page load)
        setTimeout(autoDetectAndPrompt, 3000);
      }, 1000);
    });
  } else {
    setTimeout(() => {
      createSyncButton();
      setTimeout(autoDetectAndPrompt, 3000);
    }, 1000);
  }

  // Handle URL parameter for automatic sync
  window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const forceSyncParam = urlParams.get('forcesync') === '1' || urlParams.get('forcesync') === 'true';
    
    if (forceSyncParam && !isLoginPage()) {
      const user = getUser();
      if (user && user.username) {
        setTimeout(async () => {
          await performForceSync({
            clearStaleLocalStorage: true,
            showProgress: true,
            showNotification: true
          });
          
          // Remove URL parameter
          if (window.history && window.history.replaceState) {
            urlParams.delete('forcesync');
            urlParams.delete('clearstale');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
          }
        }, 1000);
      }
    }
  });

})();

