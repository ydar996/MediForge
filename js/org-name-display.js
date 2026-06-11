/**
 * Organization Name Display Utility
 * Converts organization UUIDs to human-readable names across all pages
 */

// Initialize Supabase client
function initSupabase() {
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    return null;
  }
  
  return window.supabase.createClient(
    ((window.__SUPABASE_CONFIG__||{}).url||''),
    ((window.__SUPABASE_CONFIG__||{}).anonKey||'')
  );
}

// Get organization name from UUID
async function getOrganizationName(orgId) {
  if (!orgId) return 'Unknown Organization';
  
  // If orgId is not a UUID (it's already a readable name), return it directly
  if (orgId && (!orgId.includes('-') || orgId.length < 30 || !orgId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
    // It's a name string, not a UUID
    console.log('🔍 getOrganizationName: Using org name directly:', orgId);
    return orgId;
  }
  
  // Check if orgId is a UUID (contains hyphens and is long)
  if (orgId && orgId.includes('-') && orgId.length > 30) {
    try {
      // Try to use window.supabaseClient first (from supabase-client.js)
      const supabase = window.supabaseClient || initSupabase();
      if (!supabase) {
        console.warn('Supabase not available, using fallback');
        // Use known mapping as fallback
        const orgMapping = {
          '576522cc-e769-4fb4-9487-3d150857d970': 'Mecure Clinics'
        };
        return orgMapping[orgId] || `Organization ID: ${orgId.substring(0, 8)}...`;
      }
      
      const { data: orgData, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      
      if (error || !orgData) {
        console.warn('Could not fetch organization name:', error?.message);
        // Use known mapping as fallback
        const orgMapping = {
          '576522cc-e769-4fb4-9487-3d150857d970': 'Mecure Clinics'
        };
        return orgMapping[orgId] || `Organization ID: ${orgId.substring(0, 8)}...`;
      }
      
      return orgData.name;
    } catch (error) {
      console.error('Error fetching organization name:', error);
      // Use known mapping as fallback
      const orgMapping = {
        '576522cc-e769-4fb4-9487-3d150857d970': 'Mecure Clinics'
      };
      return orgMapping[orgId] || `Organization ID: ${orgId.substring(0, 8)}...`;
    }
  } else {
    // Use org name directly if it's not a UUID
    return orgId;
  }
}

// Update page title with organization name
async function updatePageTitle(elementId, titlePrefix = '') {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const orgId = user.org || 'Unknown Organization';
  
  const orgName = await getOrganizationName(orgId);
  const element = document.getElementById(elementId);
  
  if (element) {
    if (titlePrefix) {
      element.innerHTML = `${titlePrefix} for ${orgName}`;
    } else {
      element.innerHTML = orgName;
    }
  }
}

// Update footer with organization name
async function updateFooterInfo(elementId) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const orgId = user.org || 'Unknown Organization';
  
  if (user.username && user.role) {
    const orgName = await getOrganizationName(orgId);
    const element = document.getElementById(elementId);
    
    if (element) {
      element.innerHTML = `${user.username} (${user.role}) from ${orgName} is logged in`;
    }
  } else {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = 'Guest is logged in';
    }
  }
}

// Update org info display
async function updateOrgInfo(elementId) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const orgId = user.org || 'Unknown Organization';
  
  const orgName = await getOrganizationName(orgId);
  const element = document.getElementById(elementId);
  
  if (element) {
    element.innerHTML = orgName;
  }
}

// Wait for Supabase to load, then execute function
function waitForSupabaseAndExecute(func) {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    func();
  } else {
    setTimeout(() => waitForSupabaseAndExecute(func), 100);
  }
}

// Initialize organization name display for a page
function initOrgNameDisplay(pageTitleId, pageTitlePrefix = '', footerId = '', orgInfoId = '') {
  waitForSupabaseAndExecute(async () => {
    if (pageTitleId) {
      await updatePageTitle(pageTitleId, pageTitlePrefix);
    }
    if (footerId) {
      await updateFooterInfo(footerId);
    }
    if (orgInfoId) {
      await updateOrgInfo(orgInfoId);
    }
  });
}

// Alias for backward compatibility
const getOrgName = getOrganizationName;

console.log('✅ Organization name display utility loaded');


