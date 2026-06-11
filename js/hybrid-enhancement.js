// Purpose: Non-breaking hybrid enhancement - adds offline backup to existing Supabase functions
// Version: 1.0 - Safe enhancement that doesn't break existing functionality

console.log('🔄 [HYBRID-ENHANCEMENT] Starting hybrid enhancement initialization');

// This module enhances existing functions without breaking them
// It adds localStorage backup as a safety net

// Supabase Configuration (same as existing)
const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');

let supabase = null;
let isOnline = navigator.onLine;

console.log('🌐 [HYBRID-ENHANCEMENT] Initial online status:', isOnline);

// Initialize Supabase client (same as existing)
function initSupabase() {
  console.log('🔧 [HYBRID-ENHANCEMENT] Initializing Supabase client...');
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ [HYBRID-ENHANCEMENT] Supabase client initialized successfully');
    return true;
  }
  console.error('❌ [HYBRID-ENHANCEMENT] Supabase not available');
  return false;
}

// Get current user's organization ID (same as existing)
async function getCurrentOrgId() {
  console.log('🔍 [HYBRID-ENHANCEMENT] Getting current organization ID...');
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  console.log('👤 [HYBRID-ENHANCEMENT] Current user:', user.username);
  
  if (user.org && user.org.includes('-')) {
    console.log('✅ [HYBRID-ENHANCEMENT] Organization ID is UUID:', user.org);
    return user.org;
  }
  
  if (!supabase) {
    if (!initSupabase()) return null;
  }
  
  try {
    console.log('🔍 [HYBRID-ENHANCEMENT] Looking up organization by name:', user.org);
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', user.org)
      .single();
    
    if (error) {
      console.error('❌ [HYBRID-ENHANCEMENT] Error getting organization ID:', error);
      return null;
    }
    
    console.log('✅ [HYBRID-ENHANCEMENT] Organization ID found:', data.id);
    return data.id;
  } catch (error) {
    console.error('❌ [HYBRID-ENHANCEMENT] Exception getting organization ID:', error);
    return null;
  }
}

// Check online status
function checkOnlineStatus() {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;
  
  if (wasOnline !== isOnline) {
    console.log('🌐 [HYBRID-ENHANCEMENT] Online status changed:', wasOnline, '→', isOnline);
    updateOnlineStatusIndicator();
  }
  
  return isOnline;
}

// Update online status indicator
function updateOnlineStatusIndicator() {
  const indicator = document.getElementById('online-status-indicator');
  if (indicator) {
    if (isOnline) {
      indicator.innerHTML = '🟢 Online';
      indicator.style.color = 'green';
    } else {
      indicator.innerHTML = '🔴 Offline';
      indicator.style.color = 'red';
    }
  }
}

// Create online status indicator (non-intrusive)
function createOnlineStatusIndicator() {
  console.log('🖥️ [HYBRID-ENHANCEMENT] Creating online status indicator...');
  
  // Remove existing indicator if any
  const existing = document.getElementById('online-status-indicator');
  if (existing) {
    existing.remove();
  }
  
  // Create new indicator (small and unobtrusive)
  const indicator = document.createElement('div');
  indicator.id = 'online-status-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: bold;
    z-index: 10000;
    font-family: Arial, sans-serif;
    opacity: 0.7;
  `;
  
  document.body.appendChild(indicator);
  updateOnlineStatusIndicator();
  
  console.log('✅ [HYBRID-ENHANCEMENT] Online status indicator created');
}

// Safe localStorage backup function
function safeLocalStorageBackup(type, data) {
  console.log('💾 [HYBRID-ENHANCEMENT] Safe backup to localStorage:', type);
  
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const orgKey = user.org || "default";
    const key = `${orgKey}_${type}_backup`;
    
    // Only backup if we have valid data
    if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
      localStorage.setItem(key, JSON.stringify({
        data: data,
        timestamp: Date.now(),
        source: 'hybrid-backup'
      }));
      console.log('✅ [HYBRID-ENHANCEMENT] Safe backup successful:', key);
    } else {
      console.log('⚠️ [HYBRID-ENHANCEMENT] No data to backup for:', type);
    }
  } catch (error) {
    console.error('❌ [HYBRID-ENHANCEMENT] Safe backup failed:', error);
  }
}

// Safe localStorage load function
function safeLocalStorageLoad(type) {
  console.log('📖 [HYBRID-ENHANCEMENT] Safe load from localStorage:', type);
  
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const orgKey = user.org || "default";
    const key = `${orgKey}_${type}_backup`;
    
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.data) {
        console.log('✅ [HYBRID-ENHANCEMENT] Safe load successful:', key);
        return parsed.data;
      }
    }
    
    console.log('📭 [HYBRID-ENHANCEMENT] No backup data found:', key);
    return null;
  } catch (error) {
    console.error('❌ [HYBRID-ENHANCEMENT] Safe load failed:', error);
    return null;
  }
}

// Enhancement wrapper for existing functions
function enhanceWithBackup(originalFunction, type) {
  console.log('🔧 [HYBRID-ENHANCEMENT] Enhancing function with backup:', type);
  
  return async function(...args) {
    try {
      // Call original function
      const result = await originalFunction.apply(this, args);
      
      // If successful and online, backup to localStorage
      if (result && isOnline) {
        console.log('💾 [HYBRID-ENHANCEMENT] Backing up successful result for:', type);
        safeLocalStorageBackup(type, result);
      }
      
      return result;
    } catch (error) {
      console.log('⚠️ [HYBRID-ENHANCEMENT] Original function failed, checking backup for:', type);
      
      // If original function fails, try to load from backup
      const backupData = safeLocalStorageLoad(type);
      if (backupData) {
        console.log('✅ [HYBRID-ENHANCEMENT] Using backup data for:', type);
        return backupData;
      }
      
      // If no backup, re-throw the original error
      throw error;
    }
  };
}

// Initialize hybrid enhancement
function initializeHybridEnhancement() {
  console.log('🚀 [HYBRID-ENHANCEMENT] Initializing hybrid enhancement...');
  
  // Initialize Supabase
  initSupabase();
  
  // Set up online/offline listeners
  window.addEventListener('online', () => {
    console.log('🌐 [HYBRID-ENHANCEMENT] Online event detected');
    checkOnlineStatus();
  });
  
  window.addEventListener('offline', () => {
    console.log('📱 [HYBRID-ENHANCEMENT] Offline event detected');
    checkOnlineStatus();
  });
  
  // Create online status indicator (only if not already present)
  if (!document.getElementById('online-status-indicator')) {
    createOnlineStatusIndicator();
  }
  
  console.log('✅ [HYBRID-ENHANCEMENT] Hybrid enhancement initialized successfully');
}

// Export functions for global use (non-intrusive)
window.hybridEnhancement = {
  init: initializeHybridEnhancement,
  enhanceWithBackup: enhanceWithBackup,
  safeBackup: safeLocalStorageBackup,
  safeLoad: safeLocalStorageLoad,
  checkOnlineStatus: checkOnlineStatus,
  getCurrentOrgId: getCurrentOrgId
};

// Initialize on load (non-intrusive)
document.addEventListener('DOMContentLoaded', initializeHybridEnhancement);

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  console.log('⏳ [HYBRID-ENHANCEMENT] DOM still loading, waiting for DOMContentLoaded...');
} else {
  console.log('⚡ [HYBRID-ENHANCEMENT] DOM already loaded, initializing immediately...');
  initializeHybridEnhancement();
}

console.log('✅ [HYBRID-ENHANCEMENT] Hybrid enhancement module loaded');


