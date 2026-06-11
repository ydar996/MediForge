/**
 * Supabase Client Readiness Guarantee
 * Ensures Supabase client is ready before use, regardless of device or script loading order
 * This eliminates device-specific behavior by providing a consistent initialization guarantee
 */

/**
 * Wait for Supabase client to be ready
 * This function guarantees the client is initialized before proceeding
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 10000)
 * @returns {Promise<boolean>} - True if client is ready, false if timeout
 */
async function ensureSupabaseClientReady(maxWaitMs = 10000) {
  // If already ready, return immediately
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    return true;
  }

  const startTime = Date.now();
  const checkInterval = 100; // Check every 100ms
  
  while (Date.now() - startTime < maxWaitMs) {
    // Check if Supabase library is loaded
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      continue;
    }

    // Check if client exists and is functional
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      return true;
    }

    // If client doesn't exist but library is ready, initialize it
    // This handles cases where supabase-client.js hasn't run yet
    if (!window.supabaseClient && typeof window.supabase.createClient === 'function') {
      try {
        // Use the same initialization as supabase-client.js
        const SUPABASE_URL = window.__SUPABASE_CONFIG__?.url || ((window.__SUPABASE_CONFIG__||{}).url||'');
        const SUPABASE_ANON_KEY = window.__SUPABASE_CONFIG__?.anonKey || ((window.__SUPABASE_CONFIG__||{}).anonKey||'');
        
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          },
          global: {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Content-Type': 'application/json'
            }
          },
          db: {
            schema: 'public'
          }
        });
        
        // Verify it's functional
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
          return true;
        }
      } catch (error) {
        console.warn('⚠️ Failed to initialize Supabase client:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.error('❌ Supabase client not ready after', maxWaitMs, 'ms');
  return false;
}

/**
 * Get Supabase client with readiness guarantee
 * @returns {Promise<object|null>} - Supabase client or null if not ready
 */
async function getSupabaseClient() {
  const isReady = await ensureSupabaseClientReady();
  return isReady ? window.supabaseClient : null;
}

/**
 * Execute a function with guaranteed Supabase client readiness
 * @param {Function} callback - Function to execute with client as parameter
 * @returns {Promise<any>} - Result of callback execution
 */
async function withSupabaseClient(callback) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not available. Please refresh the page.');
  }
  return callback(client);
}

// Export for global use
if (typeof window !== 'undefined') {
  window.ensureSupabaseClientReady = ensureSupabaseClientReady;
  window.getSupabaseClient = getSupabaseClient;
  window.withSupabaseClient = withSupabaseClient;
  
  // Also expose as a ready promise for advanced usage
  window.supabaseClientReady = ensureSupabaseClientReady();
}






