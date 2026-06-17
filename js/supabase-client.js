/**
 * MediForge Supabase Client Setup
 *
 * Browser key: legacy anon JWT (fallback) or sb_publishable_... from js/supabase-env.js
 * (written at Netlify build from SUPABASE_PUBLISHABLE_KEY per site).
 */

// No hardcoded fallback: the real values come from js/supabase-env.js
// (paste your Supabase URL + publishable key there, or let the Netlify build inject them).
const DEFAULT_SUPABASE_URL = '';
const DEFAULT_SUPABASE_ANON_KEY = '';

const CONFIG_ALIASES = {
  url: ['url'],
  'anon-key': ['anonKey', 'anon-key', 'publishableKey', 'publishable-key']
};

function resolveSupabaseConfig(key, fallback) {
  try {
    if (typeof window !== 'undefined') {
      const cfg = window.__SUPABASE_CONFIG__;
      if (cfg) {
        for (const alias of CONFIG_ALIASES[key] || [key]) {
          if (typeof cfg[alias] === 'string' && cfg[alias].trim()) {
            return cfg[alias].trim();
          }
        }
      }
      const meta = document.querySelector(`meta[name="supabase-${key}"]`);
      if (meta && typeof meta.content === 'string' && meta.content.trim()) {
        return meta.content.trim();
      }
    }
  } catch (metaError) {
    console.warn(`Unable to resolve Supabase ${key} from config`, metaError);
  }
  return fallback;
}

function loadSupabaseEnvScript() {
  return new Promise(function (resolve) {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }
    var existing = document.querySelector('script[data-supabase-env="true"]');
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', function () { resolve(); });
      existing.addEventListener('error', function () { resolve(); });
      return;
    }
    var script = document.createElement('script');
    script.src = '/js/supabase-env.js';
    script.setAttribute('data-supabase-env', 'true');
    script.onload = function () {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = function () { resolve(); };
    document.head.appendChild(script);
  });
}

var SUPABASE_URL = DEFAULT_SUPABASE_URL;
var SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;

function applySupabaseConfigFromWindow() {
  SUPABASE_URL = resolveSupabaseConfig('url', DEFAULT_SUPABASE_URL);
  SUPABASE_ANON_KEY = resolveSupabaseConfig('anon-key', DEFAULT_SUPABASE_ANON_KEY);
  if (typeof window !== 'undefined') {
    window.__SUPABASE_CONFIG__ = Object.assign({}, window.__SUPABASE_CONFIG__ || {}, {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY
    });
  }
}

// Initialize Supabase client
// Use var instead of let to allow redeclaration (makes script safe if loaded multiple times due to caching)
// This prevents "Identifier 'supabase' has already been declared" errors
var supabase = typeof supabase !== 'undefined' ? supabase : null;
// Check if already declared to prevent const redeclaration errors
var SECURE_PROXY_ENDPOINT = typeof SECURE_PROXY_ENDPOINT !== 'undefined' ? SECURE_PROXY_ENDPOINT : '/.netlify/functions/secure-supabase';

// Wait for Supabase library to be available
function initializeSupabaseClient() {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    try {
      // Create Supabase client with consistent settings for ALL devices
      // No device-specific code - same behavior everywhere
      const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
          // Removed device-specific settings - same for all devices
        },
        db: {
          schema: 'public'
        }
      });
      
      const verboseLogging = localStorage.getItem('enableVerboseLogs') === 'true';
      const logVerbose = (...args) => { if (verboseLogging) console.log(...args); };
      const warnVerbose = (...args) => { if (verboseLogging) console.warn(...args); };

      logVerbose('🔍 TRACE: Client options applied with explicit headers');
      
      // Store in a different variable to avoid conflict with library name
      supabase = supabaseClient;
      
      // Also store in window for global access
      window.supabaseClient = supabaseClient;
      
      function persistSupabaseSession(session) {
        if (!session) return;
        localStorage.setItem('supabase_session', JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at
        }));
      }

      try {
        const storedSessionRaw = localStorage.getItem('supabase_session');
        if (storedSessionRaw) {
          const storedSession = JSON.parse(storedSessionRaw);
          if (storedSession?.access_token && storedSession?.refresh_token) {
            supabaseClient.auth
              .setSession({
                access_token: storedSession.access_token,
                refresh_token: storedSession.refresh_token
              })
              .then(async ({ data, error }) => {
                if (error || !data?.session) {
                  const { data: current } = await supabaseClient.auth.getSession();
                  if (current?.session) {
                    persistSupabaseSession(current.session);
                  } else {
                    warnVerbose('Stored Supabase session could not be restored from cache.');
                  }
                } else {
                  persistSupabaseSession(data.session);
                }
              })
              .catch(async (err) => {
                warnVerbose('Failed to restore Supabase session from cache.', err);
                try {
                  const { data: current } = await supabaseClient.auth.getSession();
                  if (current?.session) {
                    persistSupabaseSession(current.session);
                  }
                } catch (e) {
                  /* ignore */
                }
              });
          }
        }
      } catch (sessionError) {
        warnVerbose('Unable to parse stored Supabase session.', sessionError);
      }

      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
          persistSupabaseSession(session);
        } else if (event === 'SIGNED_OUT') {
          // Only clear on explicit sign-out — not on INITIAL_SESSION races during page load
          localStorage.removeItem('supabase_session');
        }

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
          queueMicrotask(function () {
            if (typeof window.ensurePhysicianVerificationFromAuthSession === 'function') {
              window.ensurePhysicianVerificationFromAuthSession().catch(function () {});
            }
          });
        }
      });
      
      logVerbose('🔍 TRACE: Stored in window.supabaseClient:', !!window.supabaseClient);
      logVerbose('✅ Supabase client initialized successfully');
      logVerbose('   URL:', SUPABASE_URL);
    
      if (verboseLogging && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        // Test connection only when verbose logging is enabled
        supabase.from('organizations').select('id', { count: 'exact' })
          .then(({ data, count, error }) => {
            if (error) {
              warnVerbose('⚠️ Supabase connection test failed:', error.message);
              warnVerbose('   Error code:', error.code);
              warnVerbose('   This might be normal if RLS policies are enabled or if there are no rows yet');
              
              // If it's an API key issue, try to reinitialize
              if (error.message.includes('No API key found') || error.message.includes('401')) {
                logVerbose('🔧 API key issue detected, attempting to reinitialize...');
                // The client should already have the API key, this might be a timing issue
              }
            } else {
              logVerbose('✅ Supabase connection test successful');
              logVerbose(`   Organizations in database: ${count || 0}`);
            }
          })
          .catch(err => {
            warnVerbose('⚠️ Could not test Supabase connection:', err.message);
            warnVerbose('   Full error:', err);
          });
      }
      
    } catch (error) {
      console.error('❌ Error initializing Supabase client:', error);
      console.error('   Check that your credentials are correct');
    }
  } else {
    if (localStorage.getItem('enableVerboseLogs') === 'true') {
    console.warn('⚠️ Supabase library not ready, retrying in 100ms...');
    }
    setTimeout(initializeSupabaseClient, 100);
  }
}

function isValidSupabaseUrl(url) {
  return (
    typeof url === 'string' &&
    url.startsWith('https://') &&
    !url.includes('*') &&
    url.includes('.supabase.co')
  );
}

async function fetchSupabaseConfigFromServer() {
  const res = await fetch('/.netlify/functions/get-supabase-browser-config');
  if (!res.ok) {
    throw new Error('Supabase config endpoint returned ' + res.status);
  }
  const cfg = await res.json();
  if (!cfg || !isValidSupabaseUrl(cfg.url) || !cfg.anonKey) {
    throw new Error('Supabase config endpoint returned invalid data');
  }
  SUPABASE_URL = cfg.url;
  SUPABASE_ANON_KEY = cfg.anonKey;
  if (typeof window !== 'undefined') {
    window.__SUPABASE_CONFIG__ = Object.assign({}, window.__SUPABASE_CONFIG__ || {}, {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
    });
  }
}

async function ensureSupabaseConfig() {
  await loadSupabaseEnvScript();
  applySupabaseConfigFromWindow();
  if (isValidSupabaseUrl(SUPABASE_URL) && SUPABASE_ANON_KEY) {
    return;
  }
  await fetchSupabaseConfigFromServer();
}

var supabaseInitResolve;
var supabaseInitReject;
if (typeof window !== 'undefined') {
  window.__supabaseInitPromise = new Promise(function (resolve, reject) {
    supabaseInitResolve = resolve;
    supabaseInitReject = reject;
  });
  window.waitForSupabaseClient = function () {
    return window.__supabaseInitPromise;
  };
}

ensureSupabaseConfig()
  .then(function () {
    if (!isValidSupabaseUrl(SUPABASE_URL) || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase URL or publishable key missing after config load');
    }
    initializeSupabaseClient();
    if (supabaseInitResolve) {
      supabaseInitResolve(window.supabaseClient);
    }
  })
  .catch(function (err) {
    console.error('Failed to load Supabase configuration:', err);
    if (supabaseInitReject) {
      supabaseInitReject(err);
    }
  });

// Helper function to get current user's organization ID
async function getCurrentUserOrganizationId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No authenticated user');
      return null;
    }
    
    // Get user's organization from users table
    const { data, error } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error getting user organization:', error);
      return null;
    }
    
    return data?.organization_id || null;
  } catch (error) {
    console.error('Error in getCurrentUserOrganizationId:', error);
    return null;
  }
}

// Helper function to check if user is platform admin
async function isPlatformAdmin() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;
    
    // Check if user email matches platform admin pattern
    // Or check a platform_admins table if you create one
    const platformAdminEmails = [
      'platformadmin@ehrapp.local',
      'admin@mediforge.com'
      // Add more platform admin emails here
    ];
    
    return platformAdminEmails.includes(user.email);
  } catch (error) {
    console.error('Error checking platform admin status:', error);
    return false;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.supabaseClient = supabase; // Export as supabaseClient to avoid naming conflict
  window.getCurrentUserOrganizationId = getCurrentUserOrganizationId;
  window.isPlatformAdmin = isPlatformAdmin;
  window.getOrganizationContact = getOrganizationContact;
}

if (localStorage.getItem('enableVerboseLogs') === 'true') {
console.log('✅ Supabase client module loaded');
}

async function secureSupabaseRequest(payload, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(SECURE_PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Parse response body - always try JSON first, fallback to text
    let responseBody;
    try {
      const text = await response.text();
      try {
        responseBody = JSON.parse(text);
      } catch (parseError) {
        // If JSON parse fails, use text as-is
        responseBody = text;
      }
    } catch (readError) {
      throw new Error(`Failed to read response: ${readError.message}`);
    }

    if (!response.ok) {
      const message = typeof responseBody === 'object' && responseBody !== null
        ? (responseBody.error || responseBody.message || JSON.stringify(responseBody))
        : responseBody;
      throw new Error(message || `Secure Supabase proxy responded with ${response.status}`);
    }

    // Handle response format
    // For inserts, Supabase returns empty body or minimal response
    // For RPCs, it returns { data: result } from Netlify function
    // For selects, it returns { data: result, count: ..., total: ... } from Netlify function
    if (typeof responseBody === 'object' && responseBody !== null) {
      // For select operations, return the full object (contains data, count, total)
      // Check if this is a select response by looking for both data and count/total
      if (Object.prototype.hasOwnProperty.call(responseBody, 'data') && 
          (Object.prototype.hasOwnProperty.call(responseBody, 'count') || Object.prototype.hasOwnProperty.call(responseBody, 'total'))) {
        return responseBody; // Return full object for select operations
      }
      // For RPCs and other operations, extract just the data
      if (Object.prototype.hasOwnProperty.call(responseBody, 'data')) {
        return responseBody.data;
      }
      // If responseBody is already the result (e.g., insert returns { inserted: count })
      if (Object.prototype.hasOwnProperty.call(responseBody, 'inserted')) {
        return responseBody;
      }
    }

    // If responseBody is a string that looks like JSON, try to parse it
    if (typeof responseBody === 'string' && responseBody.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(responseBody);
        if (typeof parsed === 'object' && parsed !== null && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
          return parsed.data;
        }
        return parsed;
      } catch (e) {
        // Not valid JSON, return as string
      }
    }

    return responseBody;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('❌ Secure Supabase proxy request timed out after', timeoutMs, 'ms');
      throw new Error(`Request timeout: secure Supabase proxy did not respond within ${timeoutMs}ms`);
    }
    console.error('❌ Secure Supabase proxy request failed:', error);
    throw error;
  }
}

async function secureSupabaseRpc(functionName, parameters = {}) {
  return secureSupabaseRequest({
    kind: 'rpc',
    identifier: functionName,
    payload: parameters
  });
}

// Expose secureSupabaseRpc globally
if (typeof window !== 'undefined') {
  window.secureSupabaseRpc = secureSupabaseRpc;
}

async function secureSupabaseInsert(tableName, records) {
  try {
    console.log(`📤 secureSupabaseInsert: Inserting into ${tableName}`, records.length, 'record(s)');
    const result = await secureSupabaseRequest({
      kind: 'insert',
      identifier: tableName,
      payload: Array.isArray(records) ? records : [records]
    });
    console.log(`✅ secureSupabaseInsert: Success inserting into ${tableName}`, result);
    return result;
  } catch (error) {
    console.error(`❌ secureSupabaseInsert: Error inserting into ${tableName}:`, error);
    throw error;
  }
}

async function secureSupabaseSelect(tableName, options = {}) {
  try {
    const { select = '*', filters = {}, order = { column: 'timestamp', ascending: false }, limit = 5000, offset = 0 } = options;
    console.log(`📤 secureSupabaseSelect: Querying ${tableName}`, options);
    const result = await secureSupabaseRequest({
      kind: 'select',
      identifier: tableName,
      payload: { select, filters, order, limit, offset }
    });
    
    // secureSupabaseRequest already extracts .data, but the Netlify function returns { data, count, total }
    // So result should be the full response object
    const data = (result && result.data) ? result.data : (Array.isArray(result) ? result : []);
    console.log(`✅ secureSupabaseSelect: Success querying ${tableName}`, data.length, 'records');
    return data;
  } catch (error) {
    console.error(`❌ secureSupabaseSelect: Error querying ${tableName}:`, error);
    throw error;
  }
}

if (typeof window !== 'undefined') {
  /**
   * Send security email notification (additive feature - optional)
   * @param {string} type - Alert type (account_lockout, failed_login_attack, etc.)
   * @param {object} data - Alert data
   * @param {string} severity - Alert severity (low, medium, high, critical)
   * @returns {Promise<{success: boolean, sent?: boolean}>}
   */
  async function sendSecurityEmail(type, data, severity = 'medium') {
    try {
      // Only send for high/critical by default (can be configured)
      const allowedSeverities = ['high', 'critical'];
      if (!allowedSeverities.includes(severity.toLowerCase())) {
        return { success: true, skipped: true, reason: 'Severity not high enough for email' };
      }
      
      // Call Netlify function for email sending
      const response = await fetch('/.netlify/functions/send-security-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: type,
          data: data,
          severity: severity
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Email notification request failed (non-critical):', errorText);
        // Don't throw - email is optional
        return { success: false, sent: false, error: errorText };
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.warn('⚠️ Email notification error (non-critical):', error);
      // Don't throw - email is optional enhancement
      return { success: false, sent: false, error: error.message };
    }
  }

  window.secureSupabaseRpc = secureSupabaseRpc;
  window.secureSupabaseInsert = secureSupabaseInsert;
  window.secureSupabaseSelect = secureSupabaseSelect;
  window.sendSecurityEmail = sendSecurityEmail;
}

// Fetch organization contact details with hybrid fallback
async function getOrganizationContact() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const localContact = {
      addressLine1: user.orgAddressLine1 || '',
      addressLine2: user.orgAddressLine2 || '',
      city: user.orgCity || '',
      state: user.orgState || '',
      country: user.orgCountry || user.country || '',
      phone: user.orgPhone || ''
    };
    // Prefer local profile if present
    const hasLocal = !!(localContact.addressLine1 || localContact.city || localContact.state || localContact.country || localContact.phone);
    if (hasLocal) return localContact;
    
    if (!supabase) return localContact;
    const orgId = user.organization_id || user.orgId || user.organizationId;
    if (!orgId) return localContact;
    const { data: org, error } = await supabase
      .from('organizations')
      .select('address_line1,address_line2,city,state,country,phone')
      .eq('id', orgId)
      .single();
    if (error || !org) return localContact;
    return {
      addressLine1: org.address_line1 || '',
      addressLine2: org.address_line2 || '',
      city: org.city || '',
      state: org.state || '',
      country: org.country || '',
      phone: org.phone || ''
    };
  } catch (e) {
    return { addressLine1: '', addressLine2: '', city: '', state: '', country: '', phone: '' };
  }
}

