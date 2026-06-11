/**
 * User Sync Recovery Service
 * 
 * Automatically syncs users from localStorage to Supabase if they were not saved correctly.
 * This acts as a recovery mechanism for previously "lost" users.
 * 
 * Similar to patient-sync-recovery.js, but for users.
 */

console.log('🔄 User Sync Recovery Service initialized');

// Track if auto-sync has been triggered to prevent excessive syncing
let autoSyncTriggered = false;
let lastAutoSyncTime = 0;
const AUTO_SYNC_COOLDOWN = 30000; // 30 seconds

/**
 * Check if a user exists in Supabase
 */
async function userExistsInSupabase(username, orgId) {
  if (!window.supabaseClient || !orgId) {
    return false;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from('users')
      .select('id, username')
      .eq('username', username)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('⚠️ Error checking user in Supabase:', error.message);
      return false;
    }

    return !!data;
  } catch (err) {
    console.warn('⚠️ Exception checking user in Supabase:', err.message);
    return false;
  }
}

/**
 * Sync a single user to Supabase
 */
async function syncUserToSupabase(user, orgId) {
  if (!window.supabaseClient || !orgId) {
    console.warn('⚠️ Cannot sync user - Supabase or organization ID not available');
    return { success: false, error: 'Supabase or organization ID not available' };
  }

  try {
    // Check if user already exists
    const exists = await userExistsInSupabase(user.username, orgId);
    if (exists) {
      return { success: true, alreadyExists: true };
    }

    // Register user in Supabase
    if (typeof window.registerWithSupabase === 'function') {
      const registrationResult = await window.registerWithSupabase({
        username: user.username,
        password: 'TempPassword123!',  // Temporary password - user will need to reset
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        gender: user.gender || 'Male',
        role: user.role || 'Doctor',
        organizationId: orgId,
        medicalLicenseNumber: user.medicalLicenseNumber || ''
      });

      if (registrationResult.success) {
        // Mark user as synced in localStorage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const userIndex = users.findIndex(u => u.username === user.username && u.org === user.org);
        if (userIndex >= 0) {
          users[userIndex].syncedToSupabase = true;
          localStorage.setItem('users', JSON.stringify(users));
        }
        return { success: true, data: registrationResult.user };
      } else {
        return { success: false, error: registrationResult.error };
      }
    } else {
      return { success: false, error: 'registerWithSupabase function not available' };
    }
  } catch (err) {
    console.error('❌ Exception syncing user:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sync all local users to Supabase
 */
async function syncLocalUsersToSupabase() {
  if (!window.supabaseClient) {
    console.warn('⚠️ Supabase client not available - skipping user sync');
    return { success: false, error: 'Supabase client not available' };
  }

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let orgId = user.organizationId || user.organization_id;
    const orgName = user.org;

    // If no orgId, try to get it from organization name
    if (!orgId && orgName) {
      const { data: orgData, error: orgError } = await window.supabaseClient
        .from('organizations')
        .select('id')
        .eq('name', orgName)
        .maybeSingle();

      if (!orgError && orgData && orgData.id) {
        orgId = orgData.id;
      }
    }

    if (!orgId) {
      console.warn('⚠️ Cannot determine organization ID - skipping user sync');
      return { success: false, error: 'Cannot determine organization ID' };
    }

    // Get all users from localStorage
    const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const orgUsers = localUsers.filter(u => u.org === orgName);

    if (orgUsers.length === 0) {
      return { success: true, synced: 0, skipped: 0, errors: 0 };
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const localUser of orgUsers) {
      // Skip if already synced
      if (localUser.syncedToSupabase) {
        skipped++;
        continue;
      }

      // Check if user exists in Supabase
      const exists = await userExistsInSupabase(localUser.username, orgId);
      if (exists) {
        // Mark as synced
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const userIndex = users.findIndex(u => u.username === localUser.username && u.org === localUser.org);
        if (userIndex >= 0) {
          users[userIndex].syncedToSupabase = true;
          localStorage.setItem('users', JSON.stringify(users));
        }
        skipped++;
        continue;
      }

      // Sync user to Supabase
      const result = await syncUserToSupabase(localUser, orgId);
      if (result.success) {
        synced++;
      } else {
        errors++;
        console.warn(`⚠️ Failed to sync user ${localUser.username}:`, result.error);
      }
    }

    if (synced > 0) {
      console.log(`✅ Synced ${synced} users to Supabase`);
    }

    return { success: true, synced, skipped, errors };
  } catch (err) {
    console.error('❌ Exception syncing users:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger auto-sync with cooldown
 */
function safeTriggerAutoSync() {
  const now = Date.now();
  if (autoSyncTriggered && (now - lastAutoSyncTime) < AUTO_SYNC_COOLDOWN) {
    return; // Skip if recently triggered
  }

  autoSyncTriggered = true;
  lastAutoSyncTime = now;

  // Run sync in background
  syncLocalUsersToSupabase().then(result => {
    if (result.success && result.synced > 0) {
      console.log(`✅ Auto-synced ${result.synced} users to Supabase`);
    }
    autoSyncTriggered = false;
  }).catch(err => {
    console.error('❌ Auto-sync error:', err);
    autoSyncTriggered = false;
  });
}

// Make functions globally available
if (typeof window !== 'undefined') {
  window.userExistsInSupabase = userExistsInSupabase;
  window.syncUserToSupabase = syncUserToSupabase;
  window.syncLocalUsersToSupabase = syncLocalUsersToSupabase;
}

// Auto-sync on page load (for relevant pages)
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Only sync on relevant pages
    const relevantPages = ['dashboard', 'org-user-management', 'platform-dashboard'];
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    
    if (relevantPages.includes(currentPage) || window.location.pathname.includes('dashboard')) {
      // Small delay to ensure Supabase is initialized
      setTimeout(safeTriggerAutoSync, 2000);
    }
  });

  // Also sync when page becomes visible (user switches tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if ((now - lastAutoSyncTime) > 5000) { // 5 second cooldown for visibility change
        safeTriggerAutoSync();
      }
    }
  });
}








