// Universal Sync Status Indicator
// Purpose: Display connection status to online data repository on all pages
// Version: v=3 - Added to ALL pages in the application for comprehensive sync verification

(function() {
  'use strict';
  
  // Create sync status indicator
  function createSyncStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'sync-status-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      max-width: 200px;
      text-align: center;
    `;
    
    return indicator;
  }
  
  // Check Supabase connection status
  async function checkSupabaseStatus() {
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        // Test connection with a simple query
        const { data, error } = await supabaseClient
          .from('organizations')
          .select('id')
          .limit(1);
        
        if (error) {
          console.warn('⚠️ Supabase connection test failed:', error.message);
          return { connected: false, error: error.message };
        } else {
          console.log('✅ Supabase connection test successful');
          return { connected: true, error: null };
        }
      } else {
        console.warn('⚠️ Supabase client not available');
        return { connected: false, error: 'Supabase client not loaded' };
      }
    } catch (error) {
      console.error('❌ Supabase connection test exception:', error);
      return { connected: false, error: error.message };
    }
  }
  
  // Update sync status indicator
  async function updateSyncStatus() {
    const indicator = document.getElementById('sync-status-indicator');
    if (!indicator) return;
    
    const status = await checkSupabaseStatus();
    
    if (status.connected) {
      indicator.innerHTML = '🟢 Connected to online data repository';
      indicator.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
      indicator.style.color = 'white';
      indicator.style.border = '1px solid #4CAF50';
    } else {
      indicator.innerHTML = `🔴 Offline mode<br><small>${status.error || 'No connection'}</small>`;
      indicator.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
      indicator.style.color = 'white';
      indicator.style.border = '1px solid #f44336';
    }
    
    // Add click handler for more details
    indicator.onclick = function() {
      const details = status.connected 
        ? '✅ Connected to Supabase\n🔄 Real-time synchronization active\n📱 Data synced across all devices'
        : `❌ Connection failed\n⚠️ Using offline mode\n🔧 Error: ${status.error || 'Unknown'}\n📱 Data saved locally only`;
      
      alert(details);
    };
    
    // Log status for debugging
    console.log('📡 Sync Status:', status.connected ? 'Connected' : 'Offline', status.error || '');
    console.log('🔄 TRACE: Sync status updated - v=3 comprehensive deployment verification');
    console.log('🌐 Page:', window.location.pathname, '| Status:', status.connected ? 'ONLINE' : 'OFFLINE');
  }
  
  // Initialize sync status indicator
  function initSyncStatusIndicator() {
    // Skip on login and register pages
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const excludedPages = ['login.html', 'login', 'register.html', 'register', 'index.html', 'index', ''];
    
    if (excludedPages.includes(currentPage) || excludedPages.includes(currentPage.replace('.html', ''))) {
      return;
    }
    
    // Create and add indicator
    const indicator = createSyncStatusIndicator();
    document.body.appendChild(indicator);
    
    // Initial status check
    updateSyncStatus();
    
    // Update status every 30 seconds
    setInterval(updateSyncStatus, 30000);
    
    // Update status when page becomes visible
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        updateSyncStatus();
      }
    });
    
    console.log('📡 Sync status indicator initialized - v=3 comprehensive deployment');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSyncStatusIndicator);
  } else {
    initSyncStatusIndicator();
  }
  
  // Expose functions globally for debugging
  window.updateSyncStatus = updateSyncStatus;
  window.checkSupabaseStatus = checkSupabaseStatus;
  
})();

