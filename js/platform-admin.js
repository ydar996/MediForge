// Purpose: Platform Admin & Multi-Tenant Monitoring for MediForge
// Allows platform owners to monitor and manage all registered clinics
// Version: 1.0

// ==================== PLATFORM ADMIN AUTHENTICATION ====================
// Platform admins now authenticate via Supabase Auth only (platform_admins table).
// Legacy hardcoded credentials removed for security.

// One-time cleanup: remove legacy platformAdmins from localStorage (no longer used)
try {
  if (localStorage.getItem('platformAdmins')) {
    localStorage.removeItem('platformAdmins');
  }
} catch (_) {}

// Check if current session is platform admin
window.isPlatformOwner = function() {
  const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin") || "null");
  return platformAdmin !== null;
};

// Platform admin logout
window.platformLogout = function() {
  localStorage.removeItem("platformAdmin");
  localStorage.removeItem("user");  // Clear any org context
  window.location.href = "/platform-login";
};

// ==================== ORGANIZATION MANAGEMENT ====================

// Cache for organizations to reduce API calls
let organizationsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds - restored to normal

// Clear organizations cache
window.clearOrganizationsCache = function() {
  console.log('🧹 Clearing organizations cache...');
  organizationsCache = null;
  cacheTimestamp = 0;
};

// Get all organizations
window.getAllOrganizations = async function(forceRefresh = false) {
  console.log('🔍 getAllOrganizations called', forceRefresh ? '(forced refresh)' : '');
  
  // Clear cache if forced refresh
  if (forceRefresh) {
    clearOrganizationsCache();
  }
  
  // Check cache first
  const now = Date.now();
  if (organizationsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('📦 Using cached organizations:', Object.keys(organizationsCache));
    return organizationsCache;
  }
  
  // Try to load from Supabase first
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    console.log('✅ Supabase client available, querying organizations via RPC...');
    try {
      if (typeof window.secureSupabaseRpc !== 'function') {
        console.warn('⚠️ secureSupabaseRpc helper is unavailable, falling back to localStorage');
        const localOrgs = JSON.parse(localStorage.getItem("organizations") || "{}");
        return localOrgs;
      }

      const orgs = await window.secureSupabaseRpc('get_organizations_with_owner');
      
      console.log('📊 RPC get_organizations_with_owner returned:', {
        type: Array.isArray(orgs) ? 'array' : typeof orgs,
        count: Array.isArray(orgs) ? orgs.length : 'N/A',
        sample: Array.isArray(orgs) && orgs.length > 0 ? orgs[0] : orgs
      });

      // Fallback: If RPC returns fewer organizations than exist in database, query directly
      let allOrgs = orgs;
      if (Array.isArray(orgs) && orgs.length > 0) {
        try {
          // Direct query to verify we're not missing any organizations
          const { data: directOrgs, error: directError } = await window.supabaseClient
            .from('organizations')
            .select('id, name, org_code, country, currency, status, created_at, updated_at')
            .order('created_at', { ascending: false });
          
          if (!directError && directOrgs && Array.isArray(directOrgs)) {
            console.log('📊 Direct organizations query returned:', directOrgs.length, 'organizations');
            
            // Check if we're missing any organizations from the RPC
            const rpcOrgIds = new Set(orgs.map(o => o.id).filter(Boolean));
            const missingOrgs = directOrgs.filter(directOrg => !rpcOrgIds.has(directOrg.id));
            
            if (missingOrgs.length > 0) {
              console.warn('⚠️ Found', missingOrgs.length, 'organizations missing from RPC result:', missingOrgs.map(o => o.name));
              
              // Add missing organizations to the result (without owner info)
              missingOrgs.forEach(missingOrg => {
                orgs.push({
                  id: missingOrg.id,
                  name: missingOrg.name,
                  org_code: missingOrg.org_code,
                  country: missingOrg.country,
                  currency: missingOrg.currency,
                  status: missingOrg.status || 'active',
                  created_at: missingOrg.created_at,
                  updated_at: missingOrg.updated_at,
                  owner_user_id: null,
                  owner_username: null,
                  owner_first_name: null,
                  owner_last_name: null,
                  owner_email: null,
                  owner_role: null,
                  owner_created_at: null
                });
              });
              
              console.log('✅ Added', missingOrgs.length, 'missing organizations to result');
              allOrgs = orgs; // Update allOrgs with the merged result
            }
          }
        } catch (fallbackError) {
          console.warn('⚠️ Fallback query failed (non-critical):', fallbackError);
          // Continue with RPC result
        }
      }

      if (Array.isArray(allOrgs) && allOrgs.length > 0) {
        const localOrgs = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgsObj = {};

        allOrgs.forEach(org => {
          const localOrg = localOrgs[org.name] || {};
          const ownerFullName = [org.owner_first_name, org.owner_last_name].filter(Boolean).join(' ').trim();
          const ownerUsername = org.owner_username || localOrg.createdByUsername || localOrg.created_by || null;
          const ownerEmail = org.owner_email || localOrg.createdByEmail || null;

          orgsObj[org.name] = {
            id: org.id,
            name: org.name,
            status: org.status || 'active',
            country: org.country,
            currency: org.currency || localOrg.defaultCurrency || 'CAD',
            defaultCurrency: org.currency || localOrg.defaultCurrency || 'CAD',
            org_code: org.org_code,
            addressLine1: localOrg.addressLine1 || org.address_line1 || '',
            addressLine2: localOrg.addressLine2 || org.address_line2 || '',
            city: localOrg.city || org.city || '',
            state: localOrg.state || org.state || '',
            phone: org.phone || localOrg.phone || '',
            createdAt: org.created_at,
            created_by: ownerUsername || 'Unknown',
            createdByName: ownerFullName || localOrg.createdByName || ownerUsername || 'Unknown',
            createdByEmail: ownerEmail,
            createdByUsername: ownerUsername,
            primaryAdminId: org.owner_user_id || null,
            primaryAdminRole: org.owner_role || null,
            primaryAdminCreatedAt: org.owner_created_at || null,
            subscription_plan: org.subscription_plan || localOrg.subscription_plan,
            subscription_status: org.subscription_status || localOrg.subscription_status,
            subscription_expires_at: org.subscription_expires_at || localOrg.subscription_expires_at,
            settings: org.settings || localOrg.settings || {},
            subscription: localOrg && localOrg.subscription ? {
              ...localOrg.subscription,
              currentPlan: org.subscription_plan || localOrg.subscription.currentPlan || 'free',
              status: org.subscription_status || localOrg.subscription.status || 'trial',
              expiryDate: org.subscription_expires_at || localOrg.subscription.expiryDate
            } : (() => {
              const subData = org.subscription_plan ? {
                currentPlan: org.subscription_plan,
                status: org.subscription_status || 'trial',
                expiryDate: org.subscription_expires_at
              } : null;

              if (subData && org.settings && org.settings.last_payment) {
                subData.lastPayment = org.settings.last_payment;
                console.log(`💳 Found lastPayment in settings for ${org.name}:`, org.settings.last_payment);
              }

              return subData;
            })()
          };
        });

        organizationsCache = orgsObj;
        cacheTimestamp = Date.now();
        localStorage.setItem("organizations", JSON.stringify(orgsObj));
        
        console.log('✅ getAllOrganizations: Successfully loaded', Object.keys(orgsObj).length, 'organizations:', Object.keys(orgsObj));
        return orgsObj;
      }

      console.log('⚠️ Supabase RPC returned no organizations or empty result');
      
      // Fallback: Try direct query if RPC returned nothing
      try {
        console.log('🔄 Attempting fallback: Direct organizations query...');
        const { data: directOrgs, error: directError } = await window.supabaseClient
          .from('organizations')
          .select('id, name, org_code, country, currency, status, created_at, updated_at')
          .order('created_at', { ascending: false });
        
        if (!directError && directOrgs && Array.isArray(directOrgs) && directOrgs.length > 0) {
          console.log('✅ Fallback query found', directOrgs.length, 'organizations');
          
          const localOrgs = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgsObj = {};
          
          directOrgs.forEach(org => {
            const localOrg = localOrgs[org.name] || {};
            orgsObj[org.name] = {
              id: org.id,
              name: org.name,
              status: org.status || 'active',
              country: org.country,
              currency: org.currency || localOrg.defaultCurrency || 'CAD',
              defaultCurrency: org.currency || localOrg.defaultCurrency || 'CAD',
              org_code: org.org_code,
              addressLine1: localOrg.addressLine1 || '',
              addressLine2: localOrg.addressLine2 || '',
              city: localOrg.city || '',
              state: localOrg.state || '',
              phone: localOrg.phone || '',
              createdAt: org.created_at,
              created_by: localOrg.created_by || 'Unknown',
              createdByName: localOrg.createdByName || localOrg.created_by || 'Unknown',
              createdByEmail: localOrg.createdByEmail,
              createdByUsername: localOrg.createdByUsername,
              primaryAdminId: null,
              primaryAdminRole: null,
              primaryAdminCreatedAt: null,
              subscription_plan: localOrg.subscription_plan,
              subscription_status: localOrg.subscription_status,
              subscription_expires_at: localOrg.subscription_expires_at,
              settings: localOrg.settings || {},
              subscription: localOrg.subscription || null
            };
          });
          
          organizationsCache = orgsObj;
          cacheTimestamp = Date.now();
          localStorage.setItem("organizations", JSON.stringify(orgsObj));
          
          console.log('✅ Fallback: Successfully loaded', Object.keys(orgsObj).length, 'organizations via direct query');
          return orgsObj;
        } else if (directError) {
          console.warn('⚠️ Fallback direct query also failed:', directError);
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback query exception (non-critical):', fallbackError);
      }
    } catch (error) {
      console.error('💥 Exception loading organizations via RPC:', error);
      console.error('💥 Error details:', error.message, error.stack);
      if (error.message && error.message.includes('timeout')) {
        console.warn('⏱️ Request timed out - this might indicate the Netlify function is slow or unreachable');
      }
      const localOrgs = JSON.parse(localStorage.getItem("organizations") || "{}");
      console.log('📦 Falling back to localStorage:', Object.keys(localOrgs));
      return localOrgs;
    }
  } else {
    console.log('❌ Supabase client not available');
  }
  
  // Fall back to localStorage if Supabase not available
  const localOrgs = JSON.parse(localStorage.getItem("organizations") || "{}");
  console.log('📦 Using localStorage fallback:', Object.keys(localOrgs));
  return localOrgs;
};

// Request queue and cache for organization stats
const statsCache = new Map();
const requestQueue = new Map();

window.clearPlatformStatsCache = function() {
  statsCache.clear();
  requestQueue.clear();
};
const REQUEST_DELAY = 200; // 200ms delay between requests to prevent network suspension
// CACHE_DURATION already declared at line 142 - reusing that constant

function isPlatformAdminSession() {
  try {
    return !!JSON.parse(localStorage.getItem('platformAdmin') || 'null');
  } catch (e) {
    return false;
  }
}

/** Count via secure-supabase (service role) — matches patient list in clinic view. */
async function privilegedOrgTableCount(orgId, tableName) {
  if (!isPlatformAdminSession() || typeof window.secureSupabaseRpc !== 'function') {
    return null;
  }
  const rpcByTable = {
    patients: ['get_patients_for_org', { p_org_id: orgId }],
    appointments: ['get_appointments_for_org', { p_org_id: orgId }],
    users: ['get_organization_users', { p_org_id: orgId }]
  };
  const spec = rpcByTable[tableName];
  if (!spec) {
    return null;
  }
  try {
    const rows = await window.secureSupabaseRpc(spec[0], spec[1]);
    return { count: Array.isArray(rows) ? rows.length : 0, error: null };
  } catch (error) {
    console.error(`❌ Privileged count failed for ${tableName} (${orgId}):`, error);
    return { count: 0, error: error.message || 'RPC error' };
  }
}

// Helper to throttle requests
async function throttledRequest(orgId, tableName, delay = REQUEST_DELAY) {
  const cacheKey = `${orgId}_${tableName}`;
  const cached = statsCache.get(cacheKey);
  
  // Return cached result if still valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  
  // Wait if request is already in progress
  if (requestQueue.has(cacheKey)) {
    return requestQueue.get(cacheKey);
  }
  
  // Create promise for this request
  const requestPromise = (async () => {
    try {
      // Add delay to prevent network suspension
      await new Promise(resolve => setTimeout(resolve, delay));

      const privileged = await privilegedOrgTableCount(orgId, tableName);
      if (privileged) {
        statsCache.set(cacheKey, {
          data: privileged,
          timestamp: Date.now()
        });
        return privileged;
      }
      
      const supabaseClient = window.supabaseClient;
      if (!supabaseClient) {
        throw new Error('Supabase client not available');
      }
      
      const { count, error } = await supabaseClient
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      
      if (error) {
        throw error;
      }
      
      const result = { count: count || 0, error: null };
      
      // Cache the result
      statsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Error fetching ${tableName} count for org ${orgId}:`, error);
      return { count: 0, error: error.message || 'Network error' };
    } finally {
      // Remove from queue after a delay
      setTimeout(() => {
        requestQueue.delete(cacheKey);
      }, 100);
    }
  })();
  
  // Add to queue
  requestQueue.set(cacheKey, requestPromise);
  return requestPromise;
}

// Get organization statistics
window.getOrganizationStats = async function(orgName) {
  let patientCount = 0;
  let appointmentCount = 0;
  let invoiceCount = 0;
  let userCount = 0;
  let totalRevenue = 0;
  let totalPaid = 0;
  let outstanding = 0;
  let auditEventCount = 0;
  let lastActivity = null;
  
  try {
    // Get organization ID from Supabase
    const orgs = await getAllOrganizations();
    const org = orgs[orgName];
    
    if (!org || !org.id) {
      console.warn(`Organization ${orgName} not found in Supabase`);
      return {
        orgName,
        patientCount: 0,
        userCount: 0,
        invoiceCount: 0,
        appointmentCount: 0,
        totalRevenue: 0,
        totalPaid: 0,
        outstanding: 0,
        auditEventCount: 0,
        lastActivity: null,
        status: await getOrganizationStatus(orgName)
      };
    }
    
    const orgId = org.id;
    
    // Fetch data from Supabase with throttling
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      // Get counts sequentially with delays to prevent network suspension
      const patientResult = await throttledRequest(orgId, 'patients', 0);
      patientCount = patientResult.count || 0;
      if (patientResult.error) {
        console.error(`❌ Error fetching patient count for ${orgName}:`, patientResult.error);
      } else {
        console.log(`✅ Patient count for ${orgName} (${orgId}):`, patientCount);
      }
      
      const appointmentResult = await throttledRequest(orgId, 'appointments', REQUEST_DELAY);
      appointmentCount = appointmentResult.count || 0;
      if (appointmentResult.error) {
        console.error(`❌ Error fetching appointment count for ${orgName}:`, appointmentResult.error);
      } else {
        console.log(`✅ Appointment count for ${orgName} (${orgId}):`, appointmentCount);
      }
      
      const userResult = await throttledRequest(orgId, 'users', REQUEST_DELAY * 2);
      userCount = userResult.count || 0;
      if (userResult.error) {
        console.error(`❌ Error fetching user count for ${orgName}:`, userResult.error);
      } else {
        console.log(`✅ User count for ${orgName} (${orgId}):`, userCount);
      }
      
      console.log(`✅ Supabase stats for ${orgName}:`, {
        patientCount,
        appointmentCount,
        userCount
      });
    } else {
      console.warn('⚠️ Supabase client not available, falling back to localStorage');
      
      // Fallback to localStorage if Supabase is not available
      const patients = JSON.parse(localStorage.getItem(`${orgName}_patients`) || "[]");
      const appointments = JSON.parse(localStorage.getItem(`${orgName}_appointments`) || "[]");
      const users = JSON.parse(localStorage.getItem("users") || "[]").filter(u => u.org === orgName);
      
      patientCount = patients.length;
      appointmentCount = appointments.length;
      userCount = users.length;
    }
    
    // For now, still get billing and audit from localStorage until we migrate those
    const invoices = JSON.parse(localStorage.getItem(`${orgName}_billing_invoices`) || "[]");
    const auditLog = JSON.parse(localStorage.getItem(`${orgName}_auditLog`) || "[]");
    
    invoiceCount = invoices.length;
    auditEventCount = auditLog.length;
    totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
    outstanding = invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
    
    const lastAudit = auditLog.length > 0 ? auditLog[auditLog.length - 1] : null;
    lastActivity = lastAudit ? new Date(lastAudit.timestamp) : null;
    
  } catch (error) {
    console.error(`Error fetching stats for ${orgName}:`, error);
  }
  
  return {
    orgName,
    patientCount,
    userCount,
    invoiceCount,
    appointmentCount,
    totalRevenue,
    totalPaid,
    outstanding,
    auditEventCount,
    lastActivity,
    status: await getOrganizationStatus(orgName)
  };
};

// Get organization status
async function getOrganizationStatus(orgName) {
  const orgs = await getAllOrganizations();
  return orgs[orgName]?.status || 'active';
}

// Update organization status
window.updateOrganizationStatus = async function(orgName, status) {
  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      // Update in Supabase
      const { error } = await supabaseClient
        .from('organizations')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('name', orgName);
      
      if (error) {
        console.error('Error updating organization status:', error);
        return false;
      }
      
      // Clear cache so fresh data is loaded
      organizationsCache = null;
      cacheTimestamp = 0;
      
      // Log status change
      if (typeof logAuditEvent !== 'undefined') {
        logAuditEvent('organization_status_changed', {
          orgName: orgName,
          newStatus: status
        });
      }
      
      console.log(`✅ Organization ${orgName} status updated to ${status} in Supabase`);
      return true;
    } else {
      console.error('Supabase client not available');
      return false;
    }
  } catch (error) {
    console.error('Exception updating organization status:', error);
    return false;
  }
};

// Get global platform statistics
window.getGlobalPlatformStats = async function(forceRefresh = false) {
  const orgs = await getAllOrganizations(forceRefresh);
  const orgNames = Object.keys(orgs);
  
  console.log('Calculating global stats for organizations:', orgNames);
  
  let totalPatients = 0;
  let totalUsers = 0;
  let totalRevenue = 0;
  let totalRevenueUSD = 0;
  let totalInvoices = 0;
  let totalAppointments = 0;
  let totalAuditEvents = 0;
  let activeOrgs = 0;
  
  // Exchange rates for USD conversion (from currency-converter.js)
  const exchangeRates = {
    "NGN": 1580, "KES": 127.50, "ZAR": 18.50, "GHS": 12.80, "TZS": 2520,
    "UGX": 3700, "RWF": 1320, "BIF": 2900, "ETB": 120, "SOS": 570,
    "XOF": 605, "LRD": 190, "SLL": 22000, "GMD": 68, "BWP": 13.50,
    "NAD": 18.50, "MWK": 1730, "ZMW": 27, "ZWL": 320, "MZN": 63.50,
    "SZL": 18.50, "LSL": 18.50, "EGP": 49, "MAD": 10, "TND": 3.15,
    "DZD": 135, "LYD": 4.85, "XAF": 605, "CDF": 2800, "AOA": 920,
    "MUR": 46, "SCR": 14, "MGA": 4600, "KMF": 455, "CVE": 102,
    "USD": 1, "EUR": 0.92, "GBP": 0.79
  };
  
  // Process organizations sequentially with delays to prevent network suspension
  for (let i = 0; i < orgNames.length; i++) {
    const orgName = orgNames[i];
    // Add delay between organization stats calls (except first one)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY * 3));
    }
    const stats = await getOrganizationStats(orgName);
    const org = orgs[orgName];
    
    console.log(`Adding ${orgName} stats:`, stats);
    totalPatients += stats.patientCount;
    totalUsers += stats.userCount;
    totalRevenue += stats.totalRevenue;
    totalInvoices += stats.invoiceCount;
    totalAppointments += stats.appointmentCount;
    totalAuditEvents += stats.auditEventCount;
    
    // Convert revenue to USD
    const billingSettings = JSON.parse(localStorage.getItem(`${orgName}_billing_settings`) || '{}');
    const orgCurrency = billingSettings.defaultCurrency || org.currency || 'CAD';
    const exchangeRate = exchangeRates[orgCurrency] || 1;
    const revenueUSD = stats.totalRevenue / exchangeRate;
    totalRevenueUSD += revenueUSD;
    
    // Check if active in last 30 days
    if (stats.lastActivity) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (stats.lastActivity > thirtyDaysAgo) {
        activeOrgs++;
      }
    }
  }
  
  const result = {
    totalClinics: orgNames.length,
    activeClinics: activeOrgs,
    totalPatients: totalPatients,
    totalUsers: totalUsers,
    totalRevenue: totalRevenue,
    totalRevenueUSD: totalRevenueUSD,
    totalInvoices: totalInvoices,
    totalAppointments: totalAppointments,
    totalAuditEvents: totalAuditEvents
  };
  
  console.log('Global platform stats:', result);
  
  return result;
};

// Get combined audit log from all organizations
window.getGlobalAuditLog = async function(filters = {}) {
  const orgs = await getAllOrganizations();
  let allLogs = [];
  
  // First, get all audit logs from localStorage (organization-scoped)
  // Check both known organizations and scan all localStorage keys for audit logs
  const orgNames = Object.keys(orgs);
  const processedOrgs = new Set();
  
  // Method 1: Get logs from known organizations
  orgNames.forEach(orgName => {
    const orgLog = JSON.parse(localStorage.getItem(`${orgName}_auditLog`) || "[]");
    processedOrgs.add(orgName);
    // Add organization name to each entry
    orgLog.forEach(entry => {
      allLogs.push({
        ...entry,
        organization: orgName
      });
    });
  });
  
  // Method 2: Scan all localStorage keys for audit logs (catch any we missed)
  // This ensures we get logs even if organization name changed or was missed
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith('_auditLog')) {
        const orgNameFromKey = key.replace('_auditLog', '');
        // Skip if we already processed this org
        if (!processedOrgs.has(orgNameFromKey)) {
          const orgLog = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(orgLog) && orgLog.length > 0) {
            console.log(`📋 Found additional audit log for ${orgNameFromKey}: ${orgLog.length} entries`);
            orgLog.forEach(entry => {
              allLogs.push({
                ...entry,
                organization: orgNameFromKey
              });
            });
            processedOrgs.add(orgNameFromKey);
          }
        }
      }
    }
  } catch (scanError) {
    console.warn('⚠️ Error scanning localStorage for audit logs:', scanError);
  }
  
  console.log(`📋 getGlobalAuditLog: Loaded ${allLogs.length} entries from localStorage (${processedOrgs.size} organizations)`);
  console.log(`📋 Organizations with localStorage logs:`, Array.from(processedOrgs));
  
  // Get all known organizations from Supabase to see which ones might be missing logs
  const allKnownOrgs = Object.keys(orgs);
  const orgsWithoutLogs = allKnownOrgs.filter(org => !processedOrgs.has(org));
  if (orgsWithoutLogs.length > 0) {
    console.log(`⚠️ Organizations without localStorage logs (${orgsWithoutLogs.length}):`, orgsWithoutLogs);
    console.log(`ℹ️ These organizations' logs may be on other machines or they haven't generated any audit events yet.`);
  }
  
  // Also fetch audit logs and user login events from Supabase (if available)
  if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
    console.log('🔍 getGlobalAuditLog: Fetching audit logs from Supabase...');
    
    // Try to fetch audit logs from Supabase audit_logs table (if it exists)
    try {
      const { data: supabaseAuditLogs, error: auditLogsError } = await window.supabaseClient
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (!auditLogsError && supabaseAuditLogs && supabaseAuditLogs.length > 0) {
        console.log(`📋 getGlobalAuditLog: Found ${supabaseAuditLogs.length} audit log entries in Supabase`);
        console.log(`📋 Organizations in Supabase audit logs:`, [...new Set(supabaseAuditLogs.map(log => log.organization_name || 'Unknown'))]);
        
        // Get organization names for mapping
        const orgIds = [...new Set(supabaseAuditLogs.map(log => log.organization_id).filter(Boolean))];
        const orgIdToName = {};
        
        if (orgIds.length > 0) {
          const { data: orgsData } = await window.supabaseClient
            .from('organizations')
            .select('id, name')
            .in('id', orgIds);
          
          if (orgsData) {
            orgsData.forEach(org => {
              orgIdToName[org.id] = org.name;
            });
          }
        }
        
        // Convert Supabase audit logs to our format and add to allLogs
        supabaseAuditLogs.forEach(log => {
          const orgName = orgIdToName[log.organization_id] || log.organization_name || 'Unknown';
          
          // Extract user from log (username is the primary field)
          const logUser = log.username || log.user_name || log.user || 'Unknown';
          
          // Check for duplicates
          const existingEntry = allLogs.find(existing => 
            existing.id === log.id ||
            (existing.user === logUser && 
             existing.action === log.action && 
             new Date(existing.timestamp).getTime() === new Date(log.timestamp).getTime())
          );
          
          if (!existingEntry) {
            allLogs.push({
              id: log.id || `supabase_${log.organization_id}_${new Date(log.timestamp).getTime()}`,
              timestamp: log.timestamp || log.created_at,
              user: logUser,
              role: log.role || 'user',
              organization: orgName,
              action: log.action || log.event_type || 'UNKNOWN',
              details: typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {}),
              ipAddress: log.ip_address || log.ipAddress || 'N/A',
              userAgent: log.user_agent || log.userAgent || 'N/A'
            });
          }
        });
        
        console.log(`✅ getGlobalAuditLog: Added ${supabaseAuditLogs.length} audit log entries from Supabase audit_logs table`);
      } else if (auditLogsError && auditLogsError.code !== '42P01') {
        // 42P01 = table doesn't exist, which is fine
        console.warn('⚠️ getGlobalAuditLog: Error querying audit_logs table:', auditLogsError);
      } else {
        console.log(`ℹ️ getGlobalAuditLog: Supabase audit_logs table is empty (expected if table was just created)`);
        console.log(`ℹ️ New audit events will be saved to Supabase going forward, making them visible across all machines.`);
      }
    } catch (auditLogsErr) {
      // Table might not exist - that's okay, continue with other sources
      if (auditLogsErr.code !== '42P01') {
        console.warn('⚠️ getGlobalAuditLog: Exception querying audit_logs table:', auditLogsErr);
      }
    }
    
    // Get all users with their last_login timestamps
    console.log('🔍 getGlobalAuditLog: Fetching user login events from Supabase...');
    try {
      const { data: users, error: usersError } = await window.supabaseClient
        .from('users')
        .select('id, username, last_login, organization_id, role');
      
      console.log('🔍 getGlobalAuditLog: Supabase users query result:', {
        userCount: users?.length || 0,
        error: usersError,
        usersWithLogin: users?.filter(u => u.last_login).length || 0
      });
      
      if (!usersError && users && users.length > 0) {
        // Get organization names for each user
        const orgIds = [...new Set(users.map(u => u.organization_id).filter(Boolean))];
        console.log('🔍 getGlobalAuditLog: Organization IDs from users:', orgIds.length);
        
        if (orgIds.length > 0) {
          const { data: orgsData, error: orgsError } = await window.supabaseClient
            .from('organizations')
            .select('id, name')
            .in('id', orgIds);
          
          console.log('🔍 getGlobalAuditLog: Organizations query result:', {
            orgCount: orgsData?.length || 0,
            error: orgsError
          });
          
          if (!orgsError && orgsData) {
            const orgIdToName = {};
            orgsData.forEach(org => {
              orgIdToName[org.id] = org.name;
            });
            console.log('✅ getGlobalAuditLog: Mapped organization IDs to names:', Object.keys(orgIdToName).length);
            
            // Create audit log entries for user logins
            let loginEventsAdded = 0;
            users.forEach(user => {
              if (user.last_login) {
                const orgName = orgIdToName[user.organization_id] || 'Unknown';
                // Check if this login event is already in localStorage logs
                const existingEntry = allLogs.find(log => 
                  log.user === user.username && 
                  log.action === 'USER LOGIN SUPABASE' &&
                  new Date(log.timestamp).getTime() === new Date(user.last_login).getTime()
                );
                
                // Only add if not already present
                if (!existingEntry) {
                  allLogs.push({
                    id: `supabase_${user.id}_${new Date(user.last_login).getTime()}`,
                    timestamp: new Date(user.last_login).toISOString(),
                    user: user.username,
                    role: user.role || 'user',
                    organization: orgName,
                    action: 'USER LOGIN SUPABASE',
                    details: {
                      userId: user.id,
                      organizationId: user.organization_id,
                      source: 'supabase'
                    },
                    ipAddress: 'N/A',
                    userAgent: 'N/A'
                  });
                  loginEventsAdded++;
                  console.log(`✅ Added login event for ${user.username} from ${orgName} at ${user.last_login}`);
                } else {
                  console.log(`⏭️ Skipping duplicate login event for ${user.username}`);
                }
              }
            });
            console.log(`📊 getGlobalAuditLog: Added ${loginEventsAdded} login events from Supabase`);
          } else {
            console.warn('⚠️ getGlobalAuditLog: Error fetching organizations for mapping:', orgsError);
          }
        } else {
          console.warn('⚠️ getGlobalAuditLog: No organization IDs found in users');
        }
      } else {
        console.warn('⚠️ getGlobalAuditLog: Supabase users query failed or returned no data:', usersError);
      }
      
      // Also check for organization_registered events from localStorage platform_audit
      try {
        const platformAudit = JSON.parse(localStorage.getItem('platform_audit') || '[]');
        if (Array.isArray(platformAudit)) {
          platformAudit.forEach(entry => {
            // Find organization name for this entry
            const orgName = entry.organization || entry.details?.organization || 'Unknown';
            // Avoid duplicates
            const existingEntry = allLogs.find(log => 
              log.id === entry.id || 
              (log.action === entry.action && 
               log.user === entry.user && 
               log.timestamp === entry.timestamp)
            );
            if (!existingEntry) {
              allLogs.push({
                ...entry,
                organization: orgName
              });
            }
          });
        }
      } catch (platformAuditError) {
        console.warn('⚠️ Error reading platform_audit from localStorage:', platformAuditError);
      }
      
    } catch (error) {
      console.warn('⚠️ Error fetching audit logs from Supabase:', error);
      // Continue with localStorage logs only
    }
  }
  
  // Sort by timestamp (newest first)
  allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Log summary of what we found
  const orgsInLogs = [...new Set(allLogs.map(log => log.organization))];
  const usersInLogs = [...new Set(allLogs.map(log => log.user))];
  console.log(`📊 getGlobalAuditLog Summary:`, {
    totalEntries: allLogs.length,
    organizations: orgsInLogs.length,
    orgNames: orgsInLogs,
    users: usersInLogs.length,
    userNames: usersInLogs.slice(0, 10) // First 10 users
  });
  
  // Apply filters
  if (filters.organization) {
    allLogs = allLogs.filter(entry => entry.organization === filters.organization);
  }
  if (filters.action) {
    allLogs = allLogs.filter(entry => entry.action === filters.action);
  }
  if (filters.user) {
    allLogs = allLogs.filter(entry => entry.user === filters.user);
  }
  if (filters.startDate) {
    // Ensure startDate includes time (start of day if only date provided)
    const startDate = filters.startDate.includes('T') ? filters.startDate : filters.startDate + 'T00:00:00Z';
    allLogs = allLogs.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      const filterDate = new Date(startDate);
      return entryDate >= filterDate;
    });
    console.log(`📅 Filtered by startDate ${startDate}: ${allLogs.length} entries remaining`);
  }
  if (filters.endDate) {
    // Ensure endDate includes time (end of day if only date provided)
    const endDate = filters.endDate.includes('T') ? filters.endDate : filters.endDate + 'T23:59:59Z';
    allLogs = allLogs.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      const filterDate = new Date(endDate);
      return entryDate <= filterDate;
    });
    console.log(`📅 Filtered by endDate ${endDate}: ${allLogs.length} entries remaining`);
  }
  
  return allLogs;
};

// Register new clinic
window.registerNewClinic = async function(clinicData) {
  try {
    console.log('🏥 Registering new clinic:', clinicData.name);
    
    // Check if clinic name already exists in Supabase
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data: existingOrgs, error: checkError } = await supabaseClient
        .from('organizations')
        .select('name')
        .eq('name', clinicData.name);
      
      if (checkError) {
        console.error('Error checking existing organizations:', checkError);
        return { success: false, error: "Database error: " + checkError.message };
      }
      
      if (existingOrgs && existingOrgs.length > 0) {
        return { success: false, error: "Clinic name already exists" };
      }
      
      // Generate organization code
      const orgCode = generateOrgCode();
      
      // Create organization in Supabase
      const { data: newOrg, error: orgError } = await supabaseClient
        .from('organizations')
        .insert({
          name: clinicData.name,
          status: clinicData.status || 'active',
          country: clinicData.country,
          address_line1: clinicData.addressLine1 || '',
          address_line2: clinicData.addressLine2 || '',
          city: clinicData.city || '',
          state: clinicData.state || '',
          phone: clinicData.phone || '',
          owner_email: clinicData.ownerEmail || '',
          plan: clinicData.plan || 'free',
          org_code: orgCode,
          created_by: JSON.parse(localStorage.getItem("platformAdmin") || "{}").username
        })
        .select()
        .single();
      
      if (orgError) {
        console.error('Error creating organization:', orgError);
        return { success: false, error: "Database error: " + orgError.message };
      }
      
      console.log('✅ Organization created:', newOrg);
      
      // Log organization registration event
      const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin") || "{}");
      if (typeof logAuditEvent === 'function') {
        logAuditEvent('organization_registered', {
          organization: clinicData.name,
          created_by: platformAdmin.username || 'platform_admin',
          org_code: orgCode,
          country: clinicData.country
        }, 'platform_audit');
      }
      
      // Create admin user for the clinic
      if (clinicData.adminUsername && clinicData.adminPassword) {
        const userEmail = `${clinicData.adminUsername}@example.com`;
        
        // Register user with Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email: userEmail,
          password: clinicData.adminPassword,
          options: {
            data: {
              username: clinicData.adminUsername,
              first_name: clinicData.adminFirstName || "Admin",
              last_name: clinicData.adminLastName || "User",
              role: "Admin",
              license_number: clinicData.medicalLicenseNumber || ""
            }
          }
        });
        
        if (authError) {
          console.error('Error creating auth user:', authError);
          // Continue anyway, organization was created
        } else {
          console.log('✅ Auth user created:', authData.user?.id);
          
          // Create user profile in users table
          const { error: profileError } = await supabaseClient
            .from('users')
            .insert({
              auth_user_id: authData.user?.id,
              username: clinicData.adminUsername,
              first_name: clinicData.adminFirstName || "Admin",
              last_name: clinicData.adminLastName || "User",
              role: "Admin",
              license_number: clinicData.medicalLicenseNumber || "",
              organization_id: newOrg.id
            });
          
          if (profileError) {
            console.error('Error creating user profile:', profileError);
          } else {
            console.log('✅ User profile created');
          }
        }
      }
      
      // Clear cache so fresh data is loaded
      organizationsCache = null;
      cacheTimestamp = 0;
      
      return { 
        success: true, 
        organization: newOrg,
        message: `Clinic "${clinicData.name}" registered successfully with code: ${orgCode}`
      };
      
    } else {
      return { success: false, error: "Supabase client not available" };
    }
    
  } catch (error) {
    console.error('Exception in registerNewClinic:', error);
    return { success: false, error: "Unexpected error: " + error.message };
};

// Switch to organization view (impersonate)
// ==================== ORGANIZATION ACCESS CONTROL ====================

/**
 * Manually suspend an organization (toggle access OFF)
 * Platform admin can use this to immediately disable access
 */
window.suspendOrganizationAccess = async function(orgName, reason = 'Manual suspension by platform administrator') {
  try {
    const orgs = await getAllOrganizations();
    const org = orgs[orgName];
    
    if (!org || !org.id) {
      return { success: false, error: 'Organization not found' };
    }
    
    // Update localStorage
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (organizations[orgName]) {
      organizations[orgName].status = 'suspended';
      if (organizations[orgName].subscription) {
        organizations[orgName].subscription.status = 'suspended';
        organizations[orgName].subscription.suspendedDate = new Date().toISOString();
        organizations[orgName].subscription.suspensionReason = reason;
      }
      localStorage.setItem('organizations', JSON.stringify(organizations));
    }
    
    // Update Supabase
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      const { error: orgError } = await window.supabaseClient
        .from('organizations')
        .update({
          status: 'suspended',
          subscription_status: 'suspended',
          settings: {
            ...(org.settings || {}),
            suspended_date: new Date().toISOString(),
            suspension_reason: reason,
            suspended_by: JSON.parse(localStorage.getItem('platformAdmin') || '{}').username || 'platform_admin'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', org.id);
      
      if (orgError) {
        console.error('❌ Error suspending organization:', orgError);
        return { success: false, error: orgError.message };
      }
      
      // Update subscriptions table if it exists
      const { error: subError } = await window.supabaseClient
        .from('subscriptions')
        .update({ status: 'suspended' })
        .eq('organization_id', org.id);
      
      if (subError && !subError.message.includes('does not exist')) {
        console.warn('⚠️ Warning updating subscriptions table:', subError);
      }
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('organization_suspended', {
        organization: orgName,
        reason: reason,
        suspended_by: JSON.parse(localStorage.getItem('platformAdmin') || '{}').username || 'platform_admin'
      }, 'platform_audit');
    }
    
    console.log(`✅ Organization ${orgName} suspended`);
    return { success: true, message: `Organization ${orgName} has been suspended` };
  } catch (error) {
    console.error('❌ Error suspending organization:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Manually reactivate an organization (toggle access ON)
 * Platform admin can use this to immediately enable access
 */
window.reactivateOrganizationAccess = async function(orgName) {
  try {
    const orgs = await getAllOrganizations();
    const org = orgs[orgName];
    
    if (!org || !org.id) {
      return { success: false, error: 'Organization not found' };
    }
    
    // Update localStorage
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (organizations[orgName]) {
      organizations[orgName].status = 'active';
      if (organizations[orgName].subscription) {
        // Only change subscription status if it was suspended, not if it's expired/pending
        if (organizations[orgName].subscription.status === 'suspended') {
          organizations[orgName].subscription.status = 'active';
        }
        delete organizations[orgName].subscription.suspendedDate;
        delete organizations[orgName].subscription.suspensionReason;
      }
      localStorage.setItem('organizations', JSON.stringify(organizations));
    }
    
    // Update Supabase
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      // Get current subscription status to determine what to set
      const currentSubStatus = org.subscription?.status || 'active';
      const newSubStatus = currentSubStatus === 'suspended' ? 'active' : currentSubStatus;
      
      const { error: orgError } = await window.supabaseClient
        .from('organizations')
        .update({
          status: 'active',
          subscription_status: newSubStatus,
          settings: {
            ...(org.settings || {}),
            reactivated_date: new Date().toISOString(),
            reactivated_by: JSON.parse(localStorage.getItem('platformAdmin') || '{}').username || 'platform_admin'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', org.id);
      
      if (orgError) {
        console.error('❌ Error reactivating organization:', orgError);
        return { success: false, error: orgError.message };
      }
      
      // Update subscriptions table if it exists
      if (newSubStatus === 'active') {
        const { error: subError } = await window.supabaseClient
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('organization_id', org.id);
        
        if (subError && !subError.message.includes('does not exist')) {
          console.warn('⚠️ Warning updating subscriptions table:', subError);
        }
      }
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('organization_reactivated', {
        organization: orgName,
        reactivated_by: JSON.parse(localStorage.getItem('platformAdmin') || '{}').username || 'platform_admin'
      }, 'platform_audit');
    }
    
    console.log(`✅ Organization ${orgName} reactivated`);
    return { success: true, message: `Organization ${orgName} has been reactivated` };
  } catch (error) {
    console.error('❌ Error reactivating organization:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if organization has access (not suspended)
 * Returns true if organization is active, false if suspended
 */
window.checkOrganizationAccess = async function(orgName) {
  try {
    const orgs = await getAllOrganizations();
    const org = orgs[orgName];
    
    if (!org) {
      console.warn(`⚠️ Organization ${orgName} not found`);
      return true; // Allow access if org not found (graceful degradation)
    }
    
    const status = org.status?.toLowerCase() || 'active';
    const isSuspended = status === 'suspended';
    
    if (isSuspended) {
      const suspensionReason = org.subscription?.suspensionReason || org.settings?.suspension_reason || 'Organization access has been suspended by platform administrator';
      console.warn(`🚫 Organization ${orgName} is suspended: ${suspensionReason}`);
      return {
        hasAccess: false,
        reason: suspensionReason,
        suspendedDate: org.subscription?.suspendedDate || org.settings?.suspended_date
      };
    }
    
    return { hasAccess: true };
  } catch (error) {
    console.error('❌ Error checking organization access:', error);
    return { hasAccess: true }; // Allow access on error (graceful degradation)
  }
};

window.switchToOrganization = async function(orgName) {
  console.log('🔄 switchToOrganization called with:', orgName);
  const platformAdmin = JSON.parse(localStorage.getItem("platformAdmin"));
  if (!platformAdmin) {
    alert("Not logged in as platform admin");
    return;
  }
  
  try {
    const orgs = await getAllOrganizations();
    console.log('🔄 Available organizations:', Object.keys(orgs));
    console.log('🔄 Looking for organization:', orgName);
    
    if (!orgs[orgName]) {
      alert("Organization not found");
      return;
    }
    
    // Preserve the original platform admin session
    const originalPlatformAdmin = JSON.parse(localStorage.getItem("platformAdmin"));
    
    // Create temporary user context for the organization
    localStorage.setItem("user", JSON.stringify({
      username: platformAdmin.username,
      role: "PlatformOwner",
      org: orgName,
      _isPlatformView: true,
      _platformAdmin: platformAdmin,
      _originalPlatformAdmin: originalPlatformAdmin,
      _platformViewStartTime: Date.now() // Track when platform view started
    }));
    
    // Log context switch
    if (typeof logAuditEvent !== 'undefined') {
      logAuditEvent('platform_view_switched', {
        viewingOrg: orgName,
        platformAdmin: platformAdmin.username
      });
    }
    
    console.log('✅ Redirecting to dashboard for organization:', orgName);
    window.location.href = "/dashboard";
  } catch (error) {
    console.error('❌ Error in switchToOrganization:', error);
    alert('Error switching to organization: ' + error.message);
  }
};

// Ensure function is available globally
console.log('🔧 switchToOrganization function defined:', typeof window.switchToOrganization);

// Exit organization view and return to platform dashboard
window.exitOrganizationView = function() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (user._isPlatformView) {
    console.log('🔄 Exiting platform view, returning to platform dashboard');
    
    // Clear the temporary user context
    localStorage.removeItem("user");
    
    // Restore platform admin session if it was preserved
    if (user._originalPlatformAdmin) {
      localStorage.setItem("platformAdmin", JSON.stringify(user._originalPlatformAdmin));
    }
    
    // Log the exit
    if (typeof logAuditEvent !== 'undefined') {
      logAuditEvent('platform_view_exited', {
        viewedOrg: user.org,
        platformAdmin: user._platformAdmin?.username,
        viewDuration: Date.now() - (user._platformViewStartTime || Date.now())
      });
    }
    
    window.location.href = "/platform-dashboard";
  }
};

// Delete organization (with confirmation)
window.deleteOrganization = function(orgName) {
  if (!confirm(`Are you sure you want to DELETE ${orgName}? This will permanently remove ALL data for this clinic.\n\nThis action CANNOT be undone!`)) {
    return false;
  }
  
  if (!confirm(`FINAL CONFIRMATION: Delete ${orgName} and all associated data?`)) {
    return false;
  }
  
  // Remove organization from registry
  const orgs = getAllOrganizations();
  delete orgs[orgName];
  localStorage.setItem("organizations", JSON.stringify(orgs));
  
  // Remove all organization data (including billing_ prefixed keys)
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`${orgName}_`)) {
      keysToRemove.push(key);
    }
  }
  
  console.log(`Deleting ${keysToRemove.length} keys for ${orgName}:`, keysToRemove);
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Remove users from this organization
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const updatedUsers = users.filter(u => u.org !== orgName);
  localStorage.setItem("users", JSON.stringify(updatedUsers));
  
  // Log deletion
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('clinic_deleted', {
      clinicName: orgName,
      dataKeysRemoved: keysToRemove.length
    });
  }
  
  return true;
};

// Force reset user password (Platform Admin only)
window.forceResetPassword = function(username, newPassword) {
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const userIndex = users.findIndex(u => u.username === username);
  
  if (userIndex === -1) {
    return { success: false, error: "User not found" };
  }
  
  const user = users[userIndex];
  
  // Update password (Base64 for now, will upgrade to SHA-256 when moving to prod)
  users[userIndex].password = btoa(newPassword);
  users[userIndex].passwordType = 'base64';  // Mark as needing migration
  users[userIndex].passwordResetBy = JSON.parse(localStorage.getItem("platformAdmin") || "{}").username;
  users[userIndex].passwordResetAt = new Date().toISOString();
  
  localStorage.setItem("users", JSON.stringify(users));
  
  // Log password reset
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('password_reset_by_admin', {
      targetUser: username,
      targetRole: user.role,
      targetOrg: user.org,
      resetBy: users[userIndex].passwordResetBy
    });
  }
  
  return { 
    success: true, 
    message: `Password reset for ${username}. New password: ${newPassword}` 
  };
};

// Export organization data
window.exportOrganizationData = function(orgName) {
  const data = {
    organization: getAllOrganizations()[orgName],
    patients: JSON.parse(localStorage.getItem(`${orgName}_patients`) || "[]"),
    appointments: JSON.parse(localStorage.getItem(`${orgName}_appointments`) || "[]"),
    invoices: JSON.parse(localStorage.getItem(`${orgName}_billing_invoices`) || "[]"),  // FIX: billing_ prefix
    payments: JSON.parse(localStorage.getItem(`${orgName}_billing_payments`) || "[]"),  // FIX: billing_ prefix
    cashSessions: JSON.parse(localStorage.getItem(`${orgName}_billing_cashSessions`) || "[]"),  // Include cash register
    auditLog: JSON.parse(localStorage.getItem(`${orgName}_auditLog`) || "[]"),
    users: JSON.parse(localStorage.getItem("users") || "[]").filter(u => u.org === orgName),
    exportedAt: new Date().toISOString(),
    exportedBy: JSON.parse(localStorage.getItem("platformAdmin") || "{}").username
  };
  
  // Create downloadable JSON file
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${orgName.replace(/\s+/g, '-')}-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Log export
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('clinic_data_exported', {
      clinicName: orgName,
      recordCount: data.patients.length
    });
  }
  
  return true;
};

// Get clinic activity summary (last 30 days)
window.getClinicActivitySummary = function(orgName) {
  const auditLog = JSON.parse(localStorage.getItem(`${orgName}_auditLog`) || "[]");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const recentEvents = auditLog.filter(e => e.timestamp >= thirtyDaysAgo);
  
  // Count events by type
  const eventCounts = {};
  recentEvents.forEach(event => {
    eventCounts[event.action] = (eventCounts[event.action] || 0) + 1;
  });
  
  // Get unique active users
  const activeUsers = new Set(recentEvents.map(e => e.user));
  
  return {
    orgName: orgName,
    period: '30 days',
    totalEvents: recentEvents.length,
    activeUsers: activeUsers.size,
    eventBreakdown: eventCounts,
    lastActivity: recentEvents.length > 0 ? recentEvents[recentEvents.length - 1].timestamp : null
  };
};

// ==================== ORGANIZATION CLEANUP FUNCTIONS ====================

// Get organizations with zero users
window.getOrganizationsWithZeroUsers = async function() {
  console.log('🔍 Getting organizations with zero users...');
  
  try {
    const orgs = await getAllOrganizations();
    const orgNames = Object.keys(orgs);
    const zeroUserOrgs = [];
    
    // Process organizations sequentially with delays to prevent network suspension
    for (let i = 0; i < orgNames.length; i++) {
      const orgName = orgNames[i];
      // Add delay between organization stats calls (except first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY * 3));
      }
      const stats = await getOrganizationStats(orgName);
      console.log(`📊 ${orgName}: ${stats.userCount} users`);
      
      if (stats.userCount === 0) {
        zeroUserOrgs.push({
          name: orgName,
          org: orgs[orgName],
          stats: stats
        });
      }
    }
    
    console.log(`✅ Found ${zeroUserOrgs.length} organizations with zero users:`, zeroUserOrgs.map(o => o.name));
    return zeroUserOrgs;
  } catch (error) {
    console.error('❌ Error getting organizations with zero users:', error);
    return [];
  }
};

// Delete organization with zero users (with safety checks)
window.deleteOrganizationWithZeroUsers = async function(orgName) {
  console.log(`🗑️ Deleting organization with zero users: ${orgName}`);
  
  try {
    // Double-check that organization has zero users
    const stats = await getOrganizationStats(orgName);
    if (stats.userCount > 0) {
      console.error(`❌ Organization ${orgName} has ${stats.userCount} users, cannot delete`);
      return { 
        success: false, 
        error: `Organization has ${stats.userCount} users, cannot delete` 
      };
    }
    
    // Check if organization exists in Supabase
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      // Force fresh query from Supabase instead of using cache
      console.log('🔄 Fetching fresh organization data from Supabase...');
      const { data: freshOrgs, error: fetchError } = await supabaseClient
        .from('organizations')
        .select('*')
        .eq('name', orgName);
      
      if (fetchError) {
        console.error('❌ Error fetching organization:', fetchError);
        return { success: false, error: "Database fetch error: " + fetchError.message };
      }
      
      if (!freshOrgs || freshOrgs.length === 0) {
        console.log('❌ Organization not found in fresh database query');
        return { success: false, error: "Organization not found in database" };
      }
      
      const org = freshOrgs[0];
      console.log('✅ Found organization in fresh query:', org);
      
      const orgId = org.id;
      
      // Delete related records first (cascade deletion)
      console.log(`🗑️ Attempting cascade deletion for organization ${orgName} with ID: ${orgId}`);
      
      // Delete users first
      console.log('🗑️ Deleting users...');
      const { error: usersError } = await supabaseClient
        .from('users')
        .delete()
        .eq('organization_id', orgId);
      
      if (usersError) {
        console.warn('⚠️ Error deleting users:', usersError);
      } else {
        console.log('✅ Users deleted');
      }
      
      // Delete patients
      console.log('🗑️ Deleting patients...');
      const { error: patientsError } = await supabaseClient
        .from('patients')
        .delete()
        .eq('organization_id', orgId);
      
      if (patientsError) {
        console.warn('⚠️ Error deleting patients:', patientsError);
      } else {
        console.log('✅ Patients deleted');
      }
      
      // Delete appointments
      console.log('🗑️ Deleting appointments...');
      const { error: appointmentsError } = await supabaseClient
        .from('appointments')
        .delete()
        .eq('organization_id', orgId);
      
      if (appointmentsError) {
        console.warn('⚠️ Error deleting appointments:', appointmentsError);
      } else {
        console.log('✅ Appointments deleted');
      }
      
      // Delete clinical notes
      console.log('🗑️ Deleting clinical notes...');
      const { error: notesError } = await supabaseClient
        .from('clinical_notes')
        .delete()
        .eq('organization_id', orgId);
      
      if (notesError) {
        console.warn('⚠️ Error deleting clinical notes:', notesError);
      } else {
        console.log('✅ Clinical notes deleted');
      }
      
      // Delete invoices
      console.log('🗑️ Deleting invoices...');
      const { error: invoicesError } = await supabaseClient
        .from('invoices')
        .delete()
        .eq('organization_id', orgId);
      
      if (invoicesError) {
        console.warn('⚠️ Error deleting invoices:', invoicesError);
      } else {
        console.log('✅ Invoices deleted');
      }
      
      // Delete payments
      console.log('🗑️ Deleting payments...');
      const { error: paymentsError } = await supabaseClient
        .from('payments')
        .delete()
        .eq('organization_id', orgId);
      
      if (paymentsError) {
        console.warn('⚠️ Error deleting payments:', paymentsError);
      } else {
        console.log('✅ Payments deleted');
      }
      
      // Finally delete the organization
      console.log(`🗑️ Deleting organization ${orgName}...`);
      const { data: deleteData, error: deleteError } = await supabaseClient
        .from('organizations')
        .delete()
        .eq('id', orgId)
        .select();
      
      console.log('🗑️ Delete result:', { deleteData, deleteError });
      
      if (deleteError) {
        console.error('❌ Error deleting organization from Supabase:', deleteError);
        return { success: false, error: "Database error: " + deleteError.message };
      }
      
      if (!deleteData || deleteData.length === 0) {
        console.error('❌ No rows were deleted - organization may not exist');
        return { success: false, error: "Organization not found in database" };
      }
      
      console.log(`✅ Organization ${orgName} deleted from Supabase`);
      
          // Clear cache
          clearOrganizationsCache();
          
          // Log deletion
          if (typeof logAuditEvent !== 'undefined') {
            logAuditEvent('organization_deleted_zero_users', {
              orgName: orgName,
              orgId: orgId,
              deletedBy: JSON.parse(localStorage.getItem("platformAdmin") || "{}").username
            });
          }
          
          // Force page refresh to show updated data
          console.log('🔄 Forcing page refresh after deletion...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
      
      return { 
        success: true, 
        message: `Organization "${orgName}" deleted successfully` 
      };
    } else {
      console.error('❌ Supabase client not available');
      return { success: false, error: "Database not available" };
    }
  } catch (error) {
    console.error('❌ Exception deleting organization:', error);
    return { success: false, error: "Unexpected error: " + error.message };
  }
};

// Bulk delete organizations with zero users
window.bulkDeleteOrganizationsWithZeroUsers = async function() {
  console.log('🗑️ Starting bulk delete of organizations with zero users...');
  
  try {
    // Get organizations with zero users
    const zeroUserOrgs = await getOrganizationsWithZeroUsers();
    
    if (zeroUserOrgs.length === 0) {
      console.log('✅ No organizations with zero users found');
      return { 
        success: true, 
        message: "No organizations with zero users found",
        deletedCount: 0,
        deletedOrgs: []
      };
    }
    
    console.log(`🗑️ Found ${zeroUserOrgs.length} organizations with zero users to delete`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Delete each organization
    for (const org of zeroUserOrgs) {
      console.log(`🗑️ Deleting organization: ${org.name}`);
      
      const result = await deleteOrganizationWithZeroUsers(org.name);
      results.push({
        orgName: org.name,
        success: result.success,
        error: result.error || result.message
      });
      
      if (result.success) {
        successCount++;
        console.log(`✅ Successfully deleted: ${org.name}`);
      } else {
        errorCount++;
        console.error(`❌ Failed to delete: ${org.name} - ${result.error}`);
      }
    }
    
    console.log(`✅ Bulk delete completed: ${successCount} successful, ${errorCount} errors`);
    
    // Log bulk deletion
    if (typeof logAuditEvent !== 'undefined') {
      logAuditEvent('bulk_delete_zero_user_organizations', {
        totalFound: zeroUserOrgs.length,
        successCount: successCount,
        errorCount: errorCount,
        deletedOrgs: results.filter(r => r.success).map(r => r.orgName),
        deletedBy: JSON.parse(localStorage.getItem("platformAdmin") || "{}").username
      });
    }
    
    return {
      success: true,
      message: `Bulk delete completed: ${successCount} organizations deleted, ${errorCount} errors`,
      deletedCount: successCount,
      errorCount: errorCount,
      results: results,
      deletedOrgs: results.filter(r => r.success).map(r => r.orgName)
    };
  } catch (error) {
    console.error('❌ Exception in bulk delete:', error);
    return { 
      success: false, 
      error: "Unexpected error: " + error.message 
    };
  }
};

console.log('Platform admin module loaded successfully v4');

// ==================== SUBSCRIPTION PLANS INITIALIZATION ====================

// Initialize subscription plans if missing
(function initializeSubscriptionPlans() {
  // Check if plans were already initialized in this session
  const alreadyInitialized = sessionStorage.getItem('subscription_plans_initialized');
  if (alreadyInitialized) {
    console.log('✅ Subscription plans already initialized in this session');
    return;
  }
  
  const existingPlans = JSON.parse(localStorage.getItem('platform_subscription_plans') || '{}');
  
  console.log('🔍 Checking subscription plans:', Object.keys(existingPlans).length, 'plans found');
  console.log('🔍 Existing plans:', Object.keys(existingPlans));
  
  if (Object.keys(existingPlans).length === 0) {
    console.log('🔄 No subscription plans found, initializing...');
    
    const subscriptionPlans = {
      "free": {
        "id": "free",
        "name": "Free Trial",
        "prices": {
          "KES": 0, "TZS": 0, "UGX": 0, "RWF": 0, "BIF": 0, "ETB": 0, "SOS": 0,
          "NGN": 0, "GHS": 0, "XOF": 0, "LRD": 0, "SLL": 0, "GMD": 0,
          "ZAR": 0, "BWP": 0, "NAD": 0, "MWK": 0, "ZMW": 0, "ZWL": 0,
          "MZN": 0, "SZL": 0, "LSL": 0, "EGP": 0, "MAD": 0, "TND": 0,
          "DZD": 0, "LYD": 0, "XAF": 0, "CDF": 0, "AOA": 0, "MUR": 0,
          "SCR": 0, "MGA": 0, "KMF": 0, "CVE": 0, "USD": 0, "CAD": 0, "EUR": 0, "GBP": 0
        },
        "patientLimit": 27,
        "userLimit": 3,
        "trialDays": 60,
        "features": [
          "Basic patient management",
          "Appointment scheduling",
          "Clinical notes",
          "Basic billing (up to 100 patients)",
          "3 user accounts"
        ],
        "enabled": true
      },
      "basic": {
        "id": "basic",
        "name": "Basic Plan",
        "basePrice": 100,
        "basePriceCurrency": "CAD",
        "prices": {
          "KES": 9000, "TZS": 179000, "UGX": 263000, "RWF": 94000, "BIF": 206000,
          "ETB": 8600, "SOS": 40500, "NGN": 112000, "GHS": 900, "XOF": 43000,
          "LRD": 13500, "SLL": 1562500, "GMD": 4820, "ZAR": 1300, "BWP": 970,
          "NAD": 1300, "MWK": 123000, "ZMW": 1900, "ZWL": 22700, "MZN": 4500,
          "SZL": 1300, "LSL": 1300, "EGP": 3450, "MAD": 710, "TND": 225,
          "DZD": 9650, "LYD": 340, "XAF": 43000, "CDF": 199000, "AOA": 65500,
          "MUR": 3250, "SCR": 1000, "MGA": 326000, "KMF": 44000, "CVE": 1000,
          "USD": 73, "CAD": 100, "EUR": 68, "GBP": 58
        },
        "patientLimit": 250,
        "userLimit": 5,
        "features": [
          "All features from Free plan",
          "Up to 250 patients",
          "5 user accounts",
          "Advanced reporting & analytics",
          "Email support"
        ],
        "enabled": true
      },
      "premium": {
        "id": "premium",
        "name": "Premium Plan",
        "basePrice": 250,
        "basePriceCurrency": "CAD",
        "prices": {
          "KES": 22500, "TZS": 448000, "UGX": 658000, "RWF": 235000, "BIF": 515000,
          "ETB": 21500, "SOS": 101000, "NGN": 280000, "GHS": 2250, "XOF": 108000,
          "LRD": 33700, "SLL": 3906250, "GMD": 12050, "ZAR": 3250, "BWP": 2420,
          "NAD": 3250, "MWK": 307000, "ZMW": 4750, "ZWL": 56700, "MZN": 11250,
          "SZL": 3250, "LSL": 3250, "EGP": 8625, "MAD": 1775, "TND": 560,
          "DZD": 24100, "LYD": 850, "XAF": 108000, "CDF": 498000, "AOA": 163750,
          "MUR": 8125, "SCR": 2500, "MGA": 815000, "KMF": 110000, "CVE": 2500,
          "USD": 182, "CAD": 250, "EUR": 170, "GBP": 145
        },
        "patientLimit": -1,
        "userLimit": -1,
        "features": [
          "All features from Basic plan",
          "Unlimited patients",
          "Unlimited users",
          "Priority phone support",
          "Dedicated account manager"
        ],
        "enabled": true
      }
    };
    
    localStorage.setItem('platform_subscription_plans', JSON.stringify(subscriptionPlans));
    console.log('✅ Subscription plans initialized: Free Trial, Basic Plan, Premium Plan');
  } else {
    console.log('✅ Subscription plans already exist:', Object.keys(existingPlans).map(id => existingPlans[id].name).join(', '));
  }
  
  // Mark as initialized in this session
  sessionStorage.setItem('subscription_plans_initialized', 'true');
})();
}