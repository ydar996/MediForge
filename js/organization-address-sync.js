/**
 * Automatic Organization Address Sync
 * Silently restores missing organization addresses from Supabase
 * Runs automatically on app load - no user intervention required
 */

(function() {
  'use strict';
  const debugLog = window.__DEBUG_LOGS ? console.log.bind(console) : () => {};
  const debugWarn = window.__DEBUG_LOGS ? console.warn.bind(console) : () => {};
  
  function shouldSkipAddressSync() {
    const path = (window.location.pathname || '').toLowerCase();
    return path.includes('platform-dashboard') ||
      path.includes('platform-login') ||
      path.includes('platform-audit') ||
      path.includes('platform-security') ||
      path.includes('platform-settings') ||
      path.includes('manage-clinics') ||
      path.includes('payment-receipts') ||
      path.includes('healthcare-staff') ||
      path.includes('disease-analytics');
  }

  // Sync organization addresses from Supabase to localStorage
  async function syncOrganizationAddresses() {
    try {
      if (shouldSkipAddressSync()) {
        debugLog('Skipping organization address sync on platform admin pages');
        return;
      }

      // Get Supabase client - wait for it to be initialized
      let supabase = window.supabaseClient;
      
      // Wait up to 5 seconds for Supabase client to initialize
      if (!supabase) {
        let attempts = 0;
        while (!supabase && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          supabase = window.supabaseClient;
          attempts++;
        }
      }
      
      if (!supabase) {
        debugLog('⚠️ Supabase client not available for address sync');
        return;
      }
      
      // Get current organizations from localStorage
      const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
      const orgNames = Object.keys(organizations);
      
      if (orgNames.length === 0) {
        // No organizations in localStorage, try to get user's organization
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.org) {
          orgNames.push(user.org);
        }
      }
      
      let syncedCount = 0;
      let updatedCount = 0;
      
      // Sync each organization
      for (const orgName of orgNames) {
        const localOrg = organizations[orgName] || {};
        
        // Check if address data is missing (including after-hours phone)
        const needsSync = !localOrg.addressLine1 || 
                         !localOrg.city || 
                         !localOrg.state || 
                         !localOrg.country ||
                         !localOrg.phone ||
                         !localOrg.afterHoursPhone;
        
        if (needsSync) {
          try {
            // Fetch from Supabase
            const { data: supabaseOrg, error: orgError } = await supabase
              .from('organizations')
              .select('address_line1, address_line2, city, state, country, phone, after_hours_phone')
              .eq('name', orgName)
              .maybeSingle();
            
            if (!orgError && supabaseOrg) {
              // Map Supabase snake_case to camelCase
              const updatedOrg = {
                ...localOrg,
                addressLine1: supabaseOrg.address_line1 || localOrg.addressLine1 || '',
                addressLine2: supabaseOrg.address_line2 || localOrg.addressLine2 || '',
                city: supabaseOrg.city || localOrg.city || '',
                state: supabaseOrg.state || localOrg.state || '',
                country: supabaseOrg.country || localOrg.country || '',
                phone: supabaseOrg.phone || localOrg.phone || '',
                afterHoursPhone: supabaseOrg.after_hours_phone || localOrg.afterHoursPhone || '',
                lastSynced: new Date().toISOString()
              };
              
              organizations[orgName] = updatedOrg;
              updatedCount++;
              
              // Also update user object if it has org address fields
              const user = JSON.parse(localStorage.getItem('user') || '{}');
              if (user.org === orgName) {
                const updatedUser = {
                  ...user,
                  orgAddressLine1: updatedOrg.addressLine1,
                  orgAddressLine2: updatedOrg.addressLine2,
                  orgCity: updatedOrg.city,
                  orgState: updatedOrg.state,
                  orgCountry: updatedOrg.country,
                  orgPhone: updatedOrg.phone,
                  afterHoursPhone: updatedOrg.afterHoursPhone
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));
              }
            }
          } catch (error) {
            debugWarn(`⚠️ Could not sync address for ${orgName}:`, error.message);
          }
        } else {
          syncedCount++;
        }
      }
      
      // Save updated organizations to localStorage
      if (updatedCount > 0) {
        localStorage.setItem('organizations', JSON.stringify(organizations));
        debugLog(`✅ Auto-synced ${updatedCount} organization address(es) from Supabase`);
        
        // Trigger custom event to notify pages that sync completed
        if (typeof window.dispatchEvent !== 'undefined') {
          window.dispatchEvent(new CustomEvent('organizationAddressSynced', {
            detail: { updatedCount, organizations }
          }));
        }
      }
      
      // Also sync user's current organization if not in list
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.org && !organizations[user.org] && user.org !== 'Platform Administration') {
        try {
          const { data: supabaseOrg, error: orgError } = await supabase
            .from('organizations')
            .select('address_line1, address_line2, city, state, country, phone, after_hours_phone')
            .eq('name', user.org)
            .maybeSingle();
          
          if (!orgError && supabaseOrg) {
            organizations[user.org] = {
              ...(organizations[user.org] || {}),
              name: user.org,
              addressLine1: supabaseOrg.address_line1 || '',
              addressLine2: supabaseOrg.address_line2 || '',
              city: supabaseOrg.city || '',
              state: supabaseOrg.state || '',
              country: supabaseOrg.country || '',
              phone: supabaseOrg.phone || '',
              afterHoursPhone: supabaseOrg.after_hours_phone || '',
              lastSynced: new Date().toISOString()
            };
            localStorage.setItem('organizations', JSON.stringify(organizations));
            debugLog(`✅ Auto-synced address for user's organization: ${user.org}`);
          }
        } catch (error) {
          debugWarn(`⚠️ Could not sync user's organization address:`, error.message);
        }
      }
      
    } catch (error) {
      debugWarn('⚠️ Organization address sync error:', error.message);
    }
  }
  
  // Run sync automatically when page loads
  // Wait for Supabase client to be ready
  function initializeSync() {
    // Check if we're on login/register page - skip sync
    if (window.location.pathname.includes('login') || 
        window.location.pathname.includes('register') ||
        window.location.pathname.includes('index')) {
      return;
    }
    
    // Wait for Supabase client to be available
    const checkSupabase = setInterval(() => {
      if (window.supabaseClient) {
        clearInterval(checkSupabase);
        
        // Small delay to ensure everything is initialized
        setTimeout(() => {
          syncOrganizationAddresses();
        }, 1000);
      }
    }, 500);
    
    // Stop checking after 10 seconds
    setTimeout(() => {
      clearInterval(checkSupabase);
    }, 10000);
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSync);
  } else {
    initializeSync();
  }
  
  // Also run when user logs in (if auth.js is available)
  if (typeof window.addEventListener !== 'undefined') {
    window.addEventListener('storage', function(e) {
      if (e.key === 'user' && e.newValue) {
        // User data changed, sync addresses
        setTimeout(syncOrganizationAddresses, 500);
      }
    });
  }
  
  // Expose function globally for manual trigger if needed
  window.syncOrganizationAddresses = syncOrganizationAddresses;
  
  debugLog('✅ Organization address auto-sync initialized');
})();

