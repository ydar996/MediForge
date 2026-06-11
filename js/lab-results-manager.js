/**
 * Lab Results Management System
 * Handles lab order status tracking, result entry, and result retrieval
 * ONLY accessible to Medical Lab Scientists - does not modify existing lab order creation flow
 */

// Initialize Supabase client
window.getLabSupabaseClient = async function() {
  if (typeof window.getSupabaseClient === 'function') {
    return await window.getSupabaseClient();
  }
  
  if (window.supabaseClient) {
    return window.supabaseClient;
  }
  
  // Fallback initialization
  const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
  const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');
  
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  
  throw new Error('Supabase client not available');
}

// Known lab panels: when an order contains exactly these tests, they move as a group (all → in-process when one is started)
var LAB_PANEL_TEST_NAMES = {
  'Hormonal Profile (Panel)': [
    'Prolactin',
    'Testosterone (Total)',
    'Follicle Stimulating Hormone (FSH)',
    'Luteinizing Hormone (LH)',
    'Estrogen (E2)',
    'Progesterone'
  ],
  'Hepatitis B Profile': [
    'HBsAg (Hepatitis B Surface Antigen)',
    'HBsAb (Hepatitis B Surface Antibody)',
    'HBeAg (Hepatitis B e Antigen)',
    'HBeAb (Hepatitis B e Antibody)',
    'HBcAb (Hepatitis B Core Antibody)'
  ]
};

/** Returns panel name if order is a panel group (all selected items are from that panel) or a single-item panel order, else null. */
function getPanelGroupName(selectedItems) {
  if (!Array.isArray(selectedItems) || selectedItems.length === 0) return null;
  var names = selectedItems.map(function (t) { return String((t && (t.name != null ? t.name : t)) || '').trim(); }).filter(Boolean);
  if (names.length === 1 && Object.prototype.hasOwnProperty.call(LAB_PANEL_TEST_NAMES, names[0])) return names[0];
  if (names.length < 2) return null;
  for (var panelName in LAB_PANEL_TEST_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(LAB_PANEL_TEST_NAMES, panelName)) continue;
    var panelSet = new Set(LAB_PANEL_TEST_NAMES[panelName]);
    var allInPanel = names.every(function (n) { return panelSet.has(n); });
    if (allInPanel) return panelName;
  }
  return null;
}

function orderIsPanelGroup(selectedItems) {
  return getPanelGroupName(selectedItems) != null;
}

/** Apply in-process payload to a single results key; never downgrade completed tests. */
function mergeInProcessKey(existingResults, rawKey, payload) {
  if (!existingResults || !rawKey) return;
  var key = String(rawKey).trim();
  if (!key) return;
  var useKey = Object.keys(existingResults).find(function (k) {
    return String(k).trim().toLowerCase() === key.toLowerCase();
  });
  if (!useKey) useKey = key;
  var cur = existingResults[useKey] && typeof existingResults[useKey] === 'object' ? { ...existingResults[useKey] } : {};
  var st = statusFromResult(cur);
  if (st === 'completed') return;
  existingResults[useKey] = { ...cur, ...payload };
}

/**
 * After payment, any "Start" sets every line on the order to in-process together (panels: panel key + all subtests).
 * Clicking Start on one row no longer leaves sibling tests stuck in pending.
 */
function applyStartPaidToAllLineItems(existingResults, selectedItems, startedPayload) {
  var items = normalizeSelectedItems(selectedItems);
  items.forEach(function (test) {
    var lineName = String((test && (test.name != null ? test.name : test)) || '').trim();
    if (!lineName) return;
    var subs = LAB_PANEL_TEST_NAMES[lineName];
    if (subs && subs.length > 0) {
      mergeInProcessKey(existingResults, lineName, startedPayload);
      subs.forEach(function (sub) {
        mergeInProcessKey(existingResults, sub, startedPayload);
      });
    } else {
      mergeInProcessKey(existingResults, lineName, startedPayload);
    }
  });
}

/** One status per selected_items row: for catalog panels, derive from panel + sub-keys so partial completion stays in-process. */
function getEffectiveStatusesForSelectedItems(existingResults, selectedItems) {
  var items = normalizeSelectedItems(selectedItems);
  return items.map(function (test) {
    var name = String((test && (test.name != null ? test.name : test)) || '').trim();
    if (!name) return 'pending';
    var subs = LAB_PANEL_TEST_NAMES[name];
    if (subs && subs.length > 0) {
      var panelR = getResultByKey(existingResults, name);
      var panelSt = statusFromResult(panelR);
      var subStats = subs.map(function (s) {
        return statusFromResult(getResultByKey(existingResults, s));
      });
      var allSubsCompleted = subStats.length > 0 && subStats.every(function (s) {
        return s === 'completed';
      });
      var anySubInProcess = subStats.some(function (s) {
        return s === 'in-process' || s === 'in process' || s === 'in_progress';
      });
      var anySubCompleted = subStats.some(function (s) {
        return s === 'completed';
      });
      if (panelSt === 'completed' || allSubsCompleted) return 'completed';
      var panelInProc =
        panelSt === 'in-process' || panelSt === 'in process' || panelSt === 'in_progress';
      if (panelInProc || anySubInProcess || (anySubCompleted && !allSubsCompleted)) return 'in-process';
      return 'pending';
    }
    var st = statusFromResult(getResultByKey(existingResults, name));
    return st || 'pending';
  });
}

function normalizeSelectedItems(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) {
      return raw.trim() ? [{ name: raw.trim() }] : [];
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    var keys = Object.keys(raw).filter(function (k) { return /^\d+$/.test(k); });
    if (keys.length > 0) return keys.sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return raw[k]; }).filter(Boolean);
    return [{ name: String(raw.name != null ? raw.name : raw) }];
  }
  return [];
}

function getResultByKey(results, key) {
  if (!results || typeof results !== 'object') return null;
  var r = results[key];
  if (r) return r;
  var k = Object.keys(results).find(function (x) { return x.toLowerCase() === key.toLowerCase(); });
  return k ? results[k] : null;
}

/** Panel-aware lookup — must stay aligned with lab-scientist-dashboard getTestResultForDisplay (same panels as LAB_PANEL_TEST_NAMES). */
function getLineResultLikeDashboard(results, testNameStr) {
  if (!results || typeof results !== 'object') return null;
  var name = String(testNameStr || '').trim();
  if (!name) return null;
  var direct = getResultByKey(results, name);
  if (direct) return direct;
  for (var panelName in LAB_PANEL_TEST_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(LAB_PANEL_TEST_NAMES, panelName)) continue;
    var subs = LAB_PANEL_TEST_NAMES[panelName];
    if (!subs || subs.length === 0) continue;
    var matchesSub = subs.some(function (st) { return String(st).trim().toLowerCase() === name.toLowerCase(); });
    if (matchesSub) {
      var panelResult = getResultByKey(results, panelName);
      if (panelResult) return panelResult;
    }
  }
  return null;
}

function statusFromResult(result) {
  return (result && result.status) ? String(result.status).toLowerCase() : '';
}

function orderHasPendingOrInProcess(results, selectedItems, wantPending) {
  if (!results || typeof results !== 'object') return wantPending;
  var items = normalizeSelectedItems(selectedItems);
  if (items.length === 0) {
    return Object.values(results).some(function (r) {
      if (!r || typeof r !== 'object') return false;
      var s = statusFromResult(r);
      return wantPending ? (s !== 'completed' && s !== 'in-process' && s !== 'in process' && s !== 'in_progress') : (s === 'in-process' || s === 'in process' || s === 'in_progress');
    });
  }
  if (items.length === 1) {
    var panelName = String((items[0].name != null ? items[0].name : items[0]) || '').trim();
    var subTests = LAB_PANEL_TEST_NAMES[panelName];
    if (subTests && subTests.length > 0) {
      var panelResult = getResultByKey(results, panelName);
      var panelStatus = statusFromResult(panelResult);
      if (wantPending) {
        if (panelResult && panelStatus !== 'completed' && panelStatus !== 'in-process' && panelStatus !== 'in process' && panelStatus !== 'in_progress') return true;
        for (var i = 0; i < subTests.length; i++) {
          var sr = getLineResultLikeDashboard(results, subTests[i]);
          var ss = statusFromResult(sr);
          if (ss !== 'completed' && ss !== 'in-process' && ss !== 'in process' && ss !== 'in_progress') return true;
        }
        return false;
      } else {
        if (panelStatus === 'in-process' || panelStatus === 'in process' || panelStatus === 'in_progress') return true;
        for (var j = 0; j < subTests.length; j++) {
          var s2 = statusFromResult(getLineResultLikeDashboard(results, subTests[j]));
          if (s2 === 'in-process' || s2 === 'in process' || s2 === 'in_progress') return true;
        }
        return false;
      }
    }
  }
  // When order has multiple items (e.g. expanded sub-tests), also check panel keys - status may be stored under panel name (e.g. "Hormonal Profile (Panel)")
  if (items.length > 1) {
    for (var panelName in LAB_PANEL_TEST_NAMES) {
      if (!Object.prototype.hasOwnProperty.call(LAB_PANEL_TEST_NAMES, panelName)) continue;
      var panelRes = getResultByKey(results, panelName);
      if (!panelRes || typeof panelRes !== 'object') continue;
      var panelS = statusFromResult(panelRes);
      if (wantPending) {
        if (panelS !== 'completed' && panelS !== 'in-process' && panelS !== 'in process' && panelS !== 'in_progress') return true;
      } else {
        if (panelS === 'in-process' || panelS === 'in process' || panelS === 'in_progress') return true;
      }
    }
  }
  if (wantPending) {
    return items.some(function (test) {
      var name = test.name || test;
      var r = getLineResultLikeDashboard(results, String(name));
      var s = statusFromResult(r);
      return s !== 'completed' && s !== 'in-process' && s !== 'in process' && s !== 'in_progress';
    });
  } else {
    return items.some(function (test) {
      var name = test.name || test;
      var r = getLineResultLikeDashboard(results, String(name));
      var s = statusFromResult(r);
      return s === 'in-process' || s === 'in process' || s === 'in_progress';
    });
  }
}

// Get current organization ID
async function getLabOrgId() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!user.org) {
    throw new Error('User organization not found');
  }
  
  // Method 1: Check if user.org is already a UUID (organization ID)
  if (user.org.includes('-') && user.org.length === 36) {
    return user.org;
  }
  
  // Method 2: Check if organizationId is stored in user object
  if (user.organizationId) {
    return user.organizationId;
  }
  if (user.organization_id) {
    return user.organization_id;
  }
  
  // Method 3: Check localStorage organizations object
  try {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (organizations[user.org] && organizations[user.org].id) {
      user.organizationId = organizations[user.org].id;
      user.organization_id = organizations[user.org].id;
      localStorage.setItem('user', JSON.stringify(user));
      return organizations[user.org].id;
    }
  } catch (e) {
    console.warn('Could not parse organizations from localStorage:', e);
  }
  
  // Method 4: Query Supabase by organization name
  try {
    const supabase = await getLabSupabaseClient();
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', user.org)
      .single();
    
    if (error) {
      // Try case-insensitive search
      const { data: caseInsensitiveData, error: caseError } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', user.org)
        .limit(1)
        .maybeSingle();
      
      if (caseError || !caseInsensitiveData) {
        throw new Error(`Organization "${user.org}" not found in database`);
      }
      
      user.organizationId = caseInsensitiveData.id;
      user.organization_id = caseInsensitiveData.id;
      localStorage.setItem('user', JSON.stringify(user));
      
      return caseInsensitiveData.id;
    }
    
    if (!data) {
      throw new Error(`Organization "${user.org}" not found in database`);
    }
    
    user.organizationId = data.id;
    user.organization_id = data.id;
    localStorage.setItem('user', JSON.stringify(user));
    
    return data.id;
  } catch (error) {
    console.error('Error in getLabOrgId:', error);
    throw new Error(`Could not retrieve organization ID: ${error.message}`);
  }
}

// Check if user is a lab scientist
function isLabScientist() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const labScientistRoles = ['Medical Lab Scientist', 'Lab Scientist', 'Medical Laboratory Scientist', 'Laboratory Scientist', 'Lab Tech', 'Laboratory Technician'];
  return labScientistRoles.some(role => 
    user.role === role || user.role?.toLowerCase() === role.toLowerCase()
  );
}

/** True if the order has something we can show as test lines (selected_items, inferred from results, or explicit "no tests" visit). */
function labOrderHasDisplayableLineItems(order) {
  if (!order) return false;
  if (order.no_items_checked) return true;
  var items = normalizeSelectedItems(order.selected_items);
  if (items.length > 0) return true;
  var results = order.results;
  if (typeof results === 'string') {
    try {
      results = JSON.parse(results);
    } catch (e) {
      results = null;
    }
  }
  if (results && typeof results === 'object' && Object.keys(results).length > 0) return true;
  return false;
}

// Get incoming lab orders (status: 'Generated' or 'pending', type: 'lab')
window.getIncomingLabOrders = async function() {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const orgId = await getLabOrgId();
    
    // Query orders table for lab orders with status 'Generated' or 'pending'
    // Use proper Supabase query syntax - filter client-side for complex OR conditions
    // Explicitly select payment_status and invoice_id to ensure they're included
    const { data, error } = await supabase
      .from('orders')
      .select('*, payment_status, invoice_id')
      .eq('organization_id', orgId)
      .eq('type', 'lab')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('❌ Error fetching lab orders:', error);
      throw error;
    }
    
    console.log('🔍 [LAB-RESULTS] Fetched incoming orders:', {
      count: data?.length || 0,
      sampleOrder: data?.[0] ? {
        id: data[0].id,
        serial_number: data[0].serial_number,
        payment_status: data[0].payment_status,
        invoice_id: data[0].invoice_id,
        hasPaymentStatus: 'payment_status' in (data[0] || {}),
        hasInvoiceId: 'invoice_id' in (data[0] || {})
      } : null
    });
    
    // Filter client-side for orders that have at least ONE test with status 'pending'
    // CRITICAL: Ignore order-level status - only check individual test statuses
    // An order can appear in multiple tabs if it has tests in different statuses
    const filteredOrders = (data || []).filter(order => {
      const orderId = order.id;

      if (!labOrderHasDisplayableLineItems(order)) {
        console.log(`⚠️ [INCOMING-FILTER] Order ${orderId} excluded: no tests stored on order (empty selected_items & results; not a no-tests visit)`);
        return false;
      }
      
      // Include if order has no results yet (all tests pending)
      if (!order.results || (typeof order.results === 'string' && order.results.trim() === '') || 
          (typeof order.results === 'object' && Object.keys(order.results).length === 0)) {
        console.log(`✅ [INCOMING-FILTER] Order ${orderId} included: no results (all tests pending)`);
        return true;
      }
      
      // Check if at least one test is pending
      try {
        const results = typeof order.results === 'string' ? JSON.parse(order.results) : order.results;
        if (results && typeof results === 'object' && Object.keys(results).length > 0) {
          const selectedItems = normalizeSelectedItems(order.selected_items);
          
          if (selectedItems.length > 0) {
            const hasPendingTest = orderHasPendingOrInProcess(results, selectedItems, true);
            if (hasPendingTest) {
              console.log(`✅ [INCOMING-FILTER] Order ${orderId} included: has pending test(s)`);
              return true;
            }
            console.log(`⚠️ [INCOMING-FILTER] Order ${orderId} excluded: no pending tests (${selectedItems.length} tests)`);
          } else {
            const hasPendingTest = orderHasPendingOrInProcess(results, [], true);
            if (hasPendingTest) {
              console.log(`✅ [INCOMING-FILTER] Order ${orderId} included: pending test found (no selected_items)`);
              return true;
            } else {
              console.log(`⚠️ [INCOMING-FILTER] Order ${orderId} excluded: no pending tests (no selected_items)`);
            }
          }
        } else {
          console.log(`✅ [INCOMING-FILTER] Order ${orderId} included: no results data`);
          return true;
        }
      } catch (e) {
        // If results can't be parsed, include it (likely all pending)
        console.log(`✅ [INCOMING-FILTER] Order ${orderId} included: error parsing results (likely pending)`);
        return true;
      }
      
      return false;
    });
    
    console.log(`✅ [INCOMING-FILTER] Found ${filteredOrders.length} incoming orders out of ${data.length} total orders`);
    
    return filteredOrders || [];
  } catch (error) {
    console.error('Error fetching incoming lab orders:', error);
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('⚠️ Orders table issue. Migration may not have been run yet.');
      return [];
    }
    // Don't throw - return empty array to prevent dashboard crash
    return [];
  }
};

// Get lab orders in process
window.getInProcessLabOrders = async function() {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const orgId = await getLabOrgId();
    
    // Query all lab orders and filter client-side for in-process status
    // Explicitly select payment_status and invoice_id
    const { data, error } = await supabase
      .from('orders')
      .select('*, payment_status, invoice_id')
      .eq('organization_id', orgId)
      .eq('type', 'lab')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('❌ Error fetching lab orders:', error);
      throw error;
    }
    
    // Filter client-side for orders that have at least ONE test in-process
    // CRITICAL: Ignore order-level status - only check individual test statuses
    // An order can appear in multiple tabs if it has tests in different statuses
    const filteredOrders = (data || []).filter(order => {
      const orderId = order.id;
      
      // ONLY check test-level status, NOT order-level status
      // Check if there's at least one in-process test
      try {
        const results = typeof order.results === 'string' ? JSON.parse(order.results) : order.results;
        if (results && typeof results === 'object' && Object.keys(results).length > 0) {
          const selectedItems = normalizeSelectedItems(order.selected_items);
          
          if (selectedItems.length > 0) {
            var allCompleted = false;
            if (selectedItems.length === 1) {
              var pn = String((selectedItems[0].name != null ? selectedItems[0].name : selectedItems[0]) || '').trim();
              var subs = LAB_PANEL_TEST_NAMES[pn];
              if (subs && subs.length > 0) {
                var panelDone = statusFromResult(getResultByKey(results, pn)) === 'completed';
                allCompleted = panelDone && subs.every(function (s) { return statusFromResult(getResultByKey(results, s)) === 'completed'; });
              } else {
                allCompleted = statusFromResult(getResultByKey(results, pn)) === 'completed';
              }
            } else {
              allCompleted = selectedItems.every(function (test) {
                var name = test.name || test;
                return statusFromResult(getResultByKey(results, String(name))) === 'completed';
              });
            }
            if (allCompleted) {
              console.log(`⚠️ [IN-PROCESS-FILTER] Order ${orderId} excluded: all tests completed`);
              return false;
            }
            // In Process: at least one test in-process (order can also appear in Incoming/Completed)
            let hasInProcessTest = orderHasPendingOrInProcess(results, selectedItems, false);
            // Legacy: only when there are no selected_items — otherwise Object.values can match stale keys
            // and the dashboard shows an empty card (same class of bug as false-pending Incoming).
            if (!hasInProcessTest && selectedItems.length === 0) {
              hasInProcessTest = Object.values(results).some(function (r) {
                var s = statusFromResult(r);
                return s === 'in-process' || s === 'in process' || s === 'in_progress';
              });
            }
            if (hasInProcessTest) {
              console.log(`✅ [IN-PROCESS-FILTER] Order ${orderId} included: has in-process test(s)`);
              return true;
            } else {
              console.log(`⚠️ [IN-PROCESS-FILTER] Order ${orderId} excluded: no in-process tests (${selectedItems.length} tests)`);
            }
          } else {
            // Fallback: check if any test in results is in-process (for orders without selected_items)
            const hasInProcessTest = Object.values(results).some(test => {
              const testStatus = (test?.status || '').toLowerCase();
              return testStatus === 'in-process' || testStatus === 'in process' || testStatus === 'in_progress';
            });
            if (hasInProcessTest) {
              console.log(`✅ [IN-PROCESS-FILTER] Order ${orderId} included: in-process test found (no selected_items)`);
              return true;
            } else {
              console.log(`⚠️ [IN-PROCESS-FILTER] Order ${orderId} excluded: no in-process tests (no selected_items)`);
            }
          }
        } else {
          console.log(`⚠️ [IN-PROCESS-FILTER] Order ${orderId} excluded: no results data`);
        }
      } catch (e) {
        // If results can't be parsed, exclude from in-process
        console.warn(`⚠️ [IN-PROCESS-FILTER] Order ${orderId} excluded: Error parsing results:`, e);
        return false;
      }
      
      return false;
    });
    
    console.log(`✅ [IN-PROCESS-FILTER] Found ${filteredOrders.length} in-process orders out of ${data.length} total orders`);
    
    return filteredOrders || [];
  } catch (error) {
    console.error('Error fetching in-process lab orders:', error);
    throw error;
  }
};

// Get completed lab orders
window.getCompletedLabOrders = async function() {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const orgId = await getLabOrgId();
    
    // Query all lab orders and filter client-side for completed status
    // Explicitly select payment_status and invoice_id
    const { data, error } = await supabase
      .from('orders')
      .select('*, payment_status, invoice_id')
      .eq('organization_id', orgId)
      .eq('type', 'lab')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100); // Last 100 orders to check
    
    if (error) {
      console.error('❌ Error fetching lab orders:', error);
      throw error;
    }
    
    // Filter client-side for orders that have at least ONE completed test
    // CRITICAL: Ignore order-level status - only check individual test statuses
    // An order can appear in multiple tabs if it has tests in different statuses
    const filteredOrders = (data || []).filter(order => {
      const orderId = order.id;
      
      // ONLY check test-level status, NOT order-level status
      // Check if at least one test is completed
      try {
        const results = typeof order.results === 'string' ? JSON.parse(order.results) : order.results;
        if (results && typeof results === 'object' && Object.keys(results).length > 0) {
          const selectedItems = normalizeSelectedItems(order.selected_items);
          
          if (selectedItems.length === 0) {
            const legacyCompleted = Object.values(results).some(function (r) {
              return r && typeof r === 'object' && statusFromResult(r) === 'completed';
            });
            if (legacyCompleted) {
              console.log(`✅ [COMPLETED-FILTER] Order ${orderId} included: completed (no selected_items)`);
              return true;
            }
            console.log(`⚠️ [COMPLETED-FILTER] Order ${orderId} excluded: no tests in order`);
            return false;
          }
          
          let hasCompletedTest = selectedItems.some(function (test) {
            const name = String(test.name || test || '').trim();
            const r = getLineResultLikeDashboard(results, name);
            return statusFromResult(r) === 'completed';
          });
          if (!hasCompletedTest) {
            for (var panelName in LAB_PANEL_TEST_NAMES) {
              if (!Object.prototype.hasOwnProperty.call(LAB_PANEL_TEST_NAMES, panelName)) continue;
              if (statusFromResult(getResultByKey(results, panelName)) === 'completed') {
                hasCompletedTest = true;
                break;
              }
            }
          }
          
          if (hasCompletedTest) {
            console.log(`✅ [COMPLETED-FILTER] Order ${orderId} included: has completed test(s)`);
            return true;
          } else {
            console.log(`⚠️ [COMPLETED-FILTER] Order ${orderId} excluded: no completed tests (${selectedItems.length} tests)`);
          }
        } else {
          console.log(`⚠️ [COMPLETED-FILTER] Order ${orderId} excluded: no results data`);
        }
      } catch (e) {
        // If results can't be parsed, exclude from completed tab
        console.warn(`⚠️ [COMPLETED-FILTER] Order ${orderId} excluded: Error parsing results:`, e);
        return false;
      }
      
      return false;
    });
    
    console.log(`✅ [COMPLETED-FILTER] Found ${filteredOrders.length} completed orders out of ${data.length} total orders`);
    
    return filteredOrders || [];
  } catch (error) {
    console.error('Error fetching completed lab orders:', error);
    throw error;
  }
};

// Mark individual lab test as in-process
window.startProcessingTest = async function(orderId, testName) {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  // Check payment status before allowing test processing
  if (typeof window.isLabOrderPaymentConfirmed === 'function') {
    const paymentConfirmed = await window.isLabOrderPaymentConfirmed(orderId);
    if (!paymentConfirmed) {
      alert('⚠️ Payment Required\n\nPayment must be confirmed before processing lab tests. Please generate an invoice and confirm payment first.');
      return { success: false, error: 'Payment not confirmed' };
    }
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Get current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('results, selected_items')
      .eq('id', orderId)
      .single();
    
    if (fetchError) {
      throw fetchError;
    }
    
    // Parse results - handle both string (JSONB) and object formats
    let parsedResults = {};
    if (order.results) {
      if (typeof order.results === 'string') {
        try {
          parsedResults = JSON.parse(order.results);
        } catch (e) {
          console.warn('⚠️ Failed to parse results as JSON string, treating as empty:', e);
          parsedResults = {};
        }
      } else if (typeof order.results === 'object' && order.results !== null) {
        // Deep clone to avoid mutating the original object
        parsedResults = JSON.parse(JSON.stringify(order.results));
      }
    }
    
    // IMPORTANT: Deep clone to avoid mutating the original object
    const existingResults = parsedResults;
    
    // Get all selected items (normalize string/object to array)
    const selectedItems = normalizeSelectedItems(order.selected_items);
    
    // First, ensure ALL tests from selected_items have entries in existingResults
    // CRITICAL: Only initialize NEW tests to 'pending', preserve existing statuses
    selectedItems.forEach(test => {
      const normalizedName = test.name || test;
      // Only initialize if it doesn't exist - preserve existing statuses
      if (!existingResults[normalizedName]) {
        existingResults[normalizedName] = {
          status: 'pending'
        };
      } else {
        // Preserve existing status - don't overwrite!
        // Only ensure the status property exists
        if (!existingResults[normalizedName].status) {
          existingResults[normalizedName].status = 'pending';
        }
      }
      // Preserve all existing properties (status, results, notes, etc.) - don't overwrite
    });
    
    const startedPayload = {
      status: 'in-process',
      started_at: new Date().toISOString(),
      started_by: user.id || user.user_id || user.username
    };

    applyStartPaidToAllLineItems(existingResults, selectedItems, startedPayload);

    const lineStatuses = getEffectiveStatusesForSelectedItems(existingResults, selectedItems);
    const allCompleted = lineStatuses.every(function (s) {
      return s === 'completed';
    });
    const anyInProcess = lineStatuses.some(function (s) {
      return s === 'in-process' || s === 'in process' || s === 'in_progress';
    });
    
    let orderStatus = 'Generated';
    let labStatus = 'pending';
    
    if (allCompleted) {
      orderStatus = 'completed';
      labStatus = 'completed';
    } else if (anyInProcess) {
      orderStatus = 'in-process';
      labStatus = 'in-process';
    }
    
    // Update order with test status and aggregate order status
    // CRITICAL: Ensure results is sent as proper JSONB (object, not string)
    const updateData = {
      results: existingResults, // This should be an object for JSONB column
      status: orderStatus,
      lab_status: labStatus,
      updated_at: new Date().toISOString()
    };
    
    // Set in_process_at when order is going in-process (first time or panel start)
    if (anyInProcess) {
      updateData.in_process_at = new Date().toISOString();
      updateData.in_process_by = user.id || user.user_id || user.username;
    }
    
    console.log('🔍 [START-TEST] Updating order (all line items started):', {
      orderId,
      clickedRow: testName,
      lineStatuses: lineStatuses,
      orderStatus: orderStatus,
      updateData: { ...updateData, results: '[...object...]' }
    });
    
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('type', 'lab');
    
    if (error) {
      throw error;
    }
    
    // Reload dashboard to show updated status
    // IMPORTANT: Reload both incoming AND in-process orders since order may have moved
    if (typeof loadIncomingOrders === 'function') {
      loadIncomingOrders();
    }
    if (typeof loadInProcessOrders === 'function') {
      loadInProcessOrders();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error starting test processing:', error);
    throw error;
  }
};

// Mark individual lab test as completed
window.markTestCompleted = async function(orderId, testName) {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  if (typeof window.isLabOrderPaymentConfirmed === 'function') {
    const paymentConfirmed = await window.isLabOrderPaymentConfirmed(orderId);
    if (!paymentConfirmed) {
      alert('⚠️ Payment Required\n\nPayment must be confirmed before marking lab tests completed. Please generate an invoice and confirm payment first.');
      return { success: false, error: 'Payment not confirmed' };
    }
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Get current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('results, selected_items')
      .eq('id', orderId)
      .single();
    
    if (fetchError) {
      throw fetchError;
    }
    
    // Parse results - handle both string (JSONB) and object formats
    let parsedResults = {};
    if (order.results) {
      if (typeof order.results === 'string') {
        try {
          parsedResults = JSON.parse(order.results);
        } catch (e) {
          console.warn('⚠️ Failed to parse results as JSON string, treating as empty:', e);
          parsedResults = {};
        }
      } else if (typeof order.results === 'object' && order.results !== null) {
        // Deep clone to preserve all existing data
        parsedResults = JSON.parse(JSON.stringify(order.results));
      }
    }
    
    const existingResults = parsedResults;
    
    // Get all selected items - use normalizeSelectedItems for consistency
    const selectedItems = normalizeSelectedItems(order.selected_items);
    
    // Ensure ALL tests have entries in existingResults to preserve their statuses
    // CRITICAL: Only initialize NEW tests to 'pending', preserve existing statuses
    selectedItems.forEach(test => {
      const normalizedName = test.name || test;
      if (!existingResults[normalizedName]) {
        existingResults[normalizedName] = {
          status: 'pending'
        };
      } else {
        // Preserve existing status - don't overwrite!
        if (!existingResults[normalizedName].status) {
          existingResults[normalizedName].status = 'pending';
        }
      }
    });
    
    // Find the matching test name
    const testNameNorm = String(testName || '').trim();
    let targetTestName = testName;
    const matchingTest = selectedItems.find(test => {
      const name = String(test.name || test || '').trim();
      return name === testNameNorm || name.toLowerCase() === testNameNorm.toLowerCase();
    });
    if (matchingTest) {
      targetTestName = matchingTest.name || matchingTest;
    }
    
    const completedPayload = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: user.id || user.user_id || user.username
    };
    
    // Update status ONLY for the specific test that was clicked (per-test status)
    existingResults[targetTestName] = {
      ...existingResults[targetTestName],
      ...completedPayload
    };
    
    // When the test is a panel header, also mark its sub-tests completed so the panel can leave in-process.
    const panelSubs = LAB_PANEL_TEST_NAMES[targetTestName];
    if (panelSubs && panelSubs.length > 0) {
      panelSubs.forEach(function (sub) {
        existingResults[sub] = { ...(existingResults[sub] || {}), ...completedPayload };
      });
    }
    
    const lineStatuses = getEffectiveStatusesForSelectedItems(existingResults, selectedItems);
    const allCompleted = lineStatuses.every(function (s) {
      return s === 'completed';
    });
    const anyInProcess = lineStatuses.some(function (s) {
      return s === 'in-process' || s === 'in process' || s === 'in_progress';
    });
    const anyCompleted = lineStatuses.some(function (s) {
      return s === 'completed';
    });
    
    let orderStatus = 'Generated';
    let labStatus = 'pending';
    
    if (allCompleted) {
      orderStatus = 'completed';
      labStatus = 'completed';
    } else if (anyInProcess || anyCompleted) {
      orderStatus = 'in-process';
      labStatus = 'in-process';
    }
    
    const updateData = {
      results: existingResults,
      status: orderStatus,
      lab_status: labStatus,
      updated_at: new Date().toISOString()
    };
    
    // Set completed_at if all tests are completed
    if (allCompleted) {
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = user.id || user.user_id || user.username;
    }
    
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('type', 'lab');
    
    if (error) {
      throw error;
    }
    
    // Reload dashboard - reload all tabs since order status may have changed
    // Use window functions or direct function calls
    try {
      if (typeof window.loadIncomingOrders === 'function') {
        await window.loadIncomingOrders();
      } else if (typeof loadIncomingOrders === 'function') {
        await loadIncomingOrders();
      }
    } catch (e) {
      console.warn('Could not reload incoming orders:', e);
    }
    
    try {
      if (typeof window.loadInProcessOrders === 'function') {
        await window.loadInProcessOrders();
      } else if (typeof loadInProcessOrders === 'function') {
        await loadInProcessOrders();
      }
    } catch (e) {
      console.warn('Could not reload in-process orders:', e);
    }
    
    try {
      if (typeof window.loadCompletedOrders === 'function') {
        await window.loadCompletedOrders();
      } else if (typeof loadCompletedOrders === 'function') {
        await loadCompletedOrders();
      }
    } catch (e) {
      console.warn('Could not reload completed orders:', e);
    }
    
    // Also reload dashboard stats to update counts
    try {
      if (typeof window.loadDashboard === 'function') {
        await window.loadDashboard();
      } else if (typeof loadDashboard === 'function') {
        await loadDashboard();
      }
    } catch (e) {
      console.warn('Could not reload dashboard:', e);
    }
    
    // Force a page reload if functions aren't available (fallback)
    if (typeof window.loadInProcessOrders !== 'function' && typeof loadInProcessOrders !== 'function') {
      console.log('⚠️ Reload functions not available, refreshing page...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error marking test as completed:', error);
    throw error;
  }
};

// sessionStorage: pending set when opening result entry; moved to apply only after successful save
window.LAB_DASHBOARD_RETURN_PENDING_KEY = window.LAB_DASHBOARD_RETURN_PENDING_KEY || 'ehr.labDashboardReturn.pending';
window.LAB_DASHBOARD_RETURN_APPLY_KEY = window.LAB_DASHBOARD_RETURN_APPLY_KEY || 'ehr.labDashboardReturn.apply';

// Navigate to result entry page immediately (payment is enforced on lab-result-entry load)
window.enterTestResults = function(orderId, testName) {
  try {
    var scrollY = typeof window.scrollY === 'number' ? window.scrollY : 0;
    if (!scrollY && document.documentElement) scrollY = document.documentElement.scrollTop || 0;
    sessionStorage.setItem(window.LAB_DASHBOARD_RETURN_PENDING_KEY, JSON.stringify({
      v: 1,
      from: 'lab-result-entry',
      tab: 'in-process',
      orderId: String(orderId || ''),
      testName: String(testName || ''),
      scrollY: scrollY
    }));
  } catch (e) {}
  window.location.href = 'lab-result-entry?orderId=' + encodeURIComponent(orderId) + '&testName=' + encodeURIComponent(testName);
};

/** Call after successful save on lab-result-entry so dashboard restores In Process scroll/card. */
window.commitLabDashboardReturnForAfterSave = function() {
  try {
    var p = window.LAB_DASHBOARD_RETURN_PENDING_KEY || 'ehr.labDashboardReturn.pending';
    var a = window.LAB_DASHBOARD_RETURN_APPLY_KEY || 'ehr.labDashboardReturn.apply';
    var raw = sessionStorage.getItem(p);
    if (raw) {
      sessionStorage.setItem(a, raw);
      sessionStorage.removeItem(p);
    }
  } catch (e) {}
};

// View results for a specific test
window.viewTestResults = function(orderId, testName) {
  window.location.href = `lab-result-entry?orderId=${orderId}&testName=${encodeURIComponent(testName)}&view=true`;
};

// Mark lab order as in-process (DEPRECATED - use startProcessingTest for individual tests)
window.markLabOrderInProcess = async function(orderId) {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const updateData = {
      status: 'in-process',
      updated_at: new Date().toISOString(),
      in_process_at: new Date().toISOString(),
      in_process_by: user.id || user.user_id || user.username,
      lab_status: 'in-process'
    };
    
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('type', 'lab');
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error marking order as in-process:', error);
    throw error;
  }
};

// Mark lab order as completed
window.markLabOrderCompleted = async function(orderId) {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const updateData = {
      status: 'completed',
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      completed_by: user.id || user.user_id || user.username,
      lab_status: 'completed'
    };
    
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('type', 'lab');
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error marking order as completed:', error);
    throw error;
  }
};

// Save lab results to an order
window.saveLabResults = async function(orderId, testName, resultsData) {
  if (!isLabScientist()) {
    throw new Error('Access denied: Medical Lab Scientist role required');
  }
  
  // Check payment status before allowing result entry
  if (typeof window.isLabOrderPaymentConfirmed === 'function') {
    const paymentConfirmed = await window.isLabOrderPaymentConfirmed(orderId);
    if (!paymentConfirmed) {
      alert('⚠️ Payment Required\n\nPayment must be confirmed before entering lab test results. Please generate an invoice and confirm payment first.');
      return { success: false, error: 'Payment not confirmed' };
    }
  }
  
  try {
    const supabase = await getLabSupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Get current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('results')
      .eq('id', orderId)
      .single();
    
    if (fetchError) {
      throw fetchError;
    }
    
    // Parse results - handle both string (JSONB) and object formats
    let parsedResults = {};
    if (order.results) {
      if (typeof order.results === 'string') {
        try {
          parsedResults = JSON.parse(order.results);
        } catch (e) {
          console.warn('⚠️ Failed to parse results as JSON string, treating as empty:', e);
          parsedResults = {};
        }
      } else if (typeof order.results === 'object' && order.results !== null) {
        // Deep clone to preserve all existing test data
        parsedResults = JSON.parse(JSON.stringify(order.results));
      }
    }
    
    const existingResults = parsedResults;
    
    // Merge new results with existing results - preserve all existing test data
    // CRITICAL: Only update the specific test, preserve all others
    // IMPORTANT: When results are saved, automatically mark test as 'completed' if it has results
    const hasResults = resultsData && (
      (resultsData.results && Object.keys(resultsData.results).length > 0) ||
      (resultsData.values && Array.isArray(resultsData.values) && resultsData.values.length > 0) ||
      (resultsData.notes && typeof resultsData.notes === 'string' && resultsData.notes.trim()) ||
      (resultsData.interpretation && typeof resultsData.interpretation === 'string' && resultsData.interpretation.trim()) ||
      // Check for any other result fields that might contain data
      (Object.keys(resultsData).some(key => {
        const value = resultsData[key];
        if (key === 'status' || key === 'entered_at' || key === 'entered_by' || key === 'completed_at' || key === 'completed_by') {
          return false; // Skip metadata fields
        }
        if (typeof value === 'string' && value.trim()) return true;
        if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) return true;
        if (Array.isArray(value) && value.length > 0) return true;
        return false;
      }))
    );
    
    // IMPORTANT: Don't auto-mark as completed - let user manually mark it
    // This allows tests with results to remain in "in-process" until explicitly marked complete
    const auditEntry = {
      action: 'results_saved',
      by: user.username || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}`.trim() : null) || user.id || user.user_id,
      at: new Date().toISOString()
    };

    const updatedResults = {
      ...existingResults, // Preserve all other tests
      [testName]: {
        ...existingResults[testName], // Preserve existing status and other properties for this test
        ...resultsData, // Merge new results data
        entered_at: new Date().toISOString(),
        entered_by: user.id || user.user_id || user.username,
        // Preserve existing status - don't auto-complete
        // User must click "Mark Completed" button to mark as completed
        status: existingResults[testName]?.status || 'in-process',
        // Don't set completed_at/completed_by here - only when user clicks "Mark Completed"
        auditTrail: [
          ...(Array.isArray(existingResults[testName]?.auditTrail) ? existingResults[testName].auditTrail : []),
          auditEntry
        ]
      }
    };
    
    // Get selected items to calculate aggregate order status
    const { data: orderWithItems } = await supabase
      .from('orders')
      .select('selected_items')
      .eq('id', orderId)
      .single();
    
    const selectedItems = Array.isArray(orderWithItems?.selected_items) ? orderWithItems.selected_items : 
                         (typeof orderWithItems?.selected_items === 'string' ? JSON.parse(orderWithItems.selected_items || '[]') : []);
    
    // Calculate aggregate order status based on all tests
    const testStatuses = selectedItems.map(test => {
      const name = test.name || test;
      return updatedResults[name]?.status || 'pending';
    });
    
    const allCompleted = testStatuses.every(s => s === 'completed');
    const anyInProcess = testStatuses.some(s => s === 'in-process');
    const allPending = testStatuses.every(s => s === 'pending');
    
    let orderStatus = 'Generated';
    let labStatus = 'pending';
    
    if (allCompleted) {
      orderStatus = 'completed';
      labStatus = 'completed';
    } else if (anyInProcess) {
      orderStatus = 'in-process';
      labStatus = 'in-process';
    }
    
    // Update order with new results and aggregate status
    const updateData = {
      results: updatedResults,
      status: orderStatus,
      lab_status: labStatus,
      updated_at: new Date().toISOString()
    };
    
    // Set completed_at if all tests are completed
    if (allCompleted) {
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = user.id || user.user_id || user.username;
    }
    
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);
    
    if (updateError) {
      throw updateError;
    }
    
    // Reload dashboard to reflect status changes
    if (typeof loadIncomingOrders === 'function') {
      loadIncomingOrders();
    }
    if (typeof loadInProcessOrders === 'function') {
      loadInProcessOrders();
    }
    if (typeof loadCompletedOrders === 'function') {
      loadCompletedOrders();
    }
    if (typeof loadDashboard === 'function') {
      loadDashboard();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving lab results:', error);
    throw error;
  }
};

// Get lab results for an order
window.getLabResults = async function(orderId) {
  try {
    const supabase = await getLabSupabaseClient();
    
    console.log('🔍 [GET-LAB-RESULTS] Fetching order with orderId:', orderId, 'type:', typeof orderId);
    
    // Try to fetch by id first (UUID)
    let { data, error } = await supabase
      .from('orders')
      .select('results, selected_items, patient_id, visit_date, created_at, organization_id, created_by, serial_number, id')
      .eq('id', orderId)
      .single();
    
    // If not found by id, try by serial_number (numeric ID)
    if (error && error.code === 'PGRST116') {
      console.log('🔍 [GET-LAB-RESULTS] Not found by id, trying serial_number...');
      const result = await supabase
        .from('orders')
        .select('results, selected_items, patient_id, visit_date, created_at, organization_id, created_by, serial_number, id')
        .eq('serial_number', orderId)
        .maybeSingle();
      
      if (result.error) {
        throw result.error;
      }
      
      if (result.data) {
        console.log('✅ [GET-LAB-RESULTS] Found by serial_number');
        return result.data;
      }
      
      // If still not found, try as integer ID
      const intOrderId = parseInt(orderId, 10);
      if (!isNaN(intOrderId) && intOrderId.toString() === orderId) {
        console.log('🔍 [GET-LAB-RESULTS] Trying as integer ID...');
        const intResult = await supabase
          .from('orders')
          .select('results, selected_items, patient_id, visit_date, created_at, organization_id, created_by, serial_number, id')
          .eq('id', intOrderId)
          .maybeSingle();
        
        if (!intResult.error && intResult.data) {
          console.log('✅ [GET-LAB-RESULTS] Found by integer ID');
          return intResult.data;
        }
      }
      
      throw new Error(`Order not found with id/serial_number: ${orderId}`);
    }
    
    if (error) {
      throw error;
    }
    
    console.log('✅ [GET-LAB-RESULTS] Found by UUID id');
    return data;
  } catch (error) {
    console.error('❌ [GET-LAB-RESULTS] Error fetching lab results:', error);
    throw error;
  }
};

// Get all lab results for a patient (for doctor's view)
window.getPatientLabResults = async function(patientId) {
  try {
    const supabase = await getLabSupabaseClient();
    const orgId = await getLabOrgId();
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('organization_id', orgId)
      .eq('patient_id', patientId)
      .eq('type', 'lab')
      .eq('status', 'completed')
      .not('results', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching patient lab results:', error);
    throw error;
  }
};

