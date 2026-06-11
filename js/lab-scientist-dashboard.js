/**
 * Lab Scientist Dashboard UI Logic
 * Handles all lab scientist dashboard interactions
 * ONLY accessible to Medical Lab Scientists - does not modify existing lab order creation flows
 */

const LAB_DASH_DEBUG = !!window.__DEBUG_LOGS;
const debugLog = (...args) => {
  if (LAB_DASH_DEBUG) {
    console.log(...args);
  }
};
const debugWarn = (...args) => {
  if (LAB_DASH_DEBUG) {
    console.warn(...args);
  }
};
const debugError = (...args) => {
  if (LAB_DASH_DEBUG) {
    console.error(...args);
  }
};

debugLog('✅ [LAB-DASHBOARD] lab-scientist-dashboard.js file loaded');

// Check access and initialize
document.addEventListener('DOMContentLoaded', async function() {
  debugLog('✅ [LAB-DASHBOARD] DOMContentLoaded fired');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Check for lab scientist role variations (flexible: trim, case-insensitive, and partial match)
  const roleRaw = (user.role && String(user.role).trim()) || '';
  const roleLower = roleRaw.toLowerCase();
  const labScientistRoles = ['medical lab scientist', 'lab scientist', 'medical laboratory scientist', 'laboratory scientist', 'lab tech', 'laboratory technician'];
  const isLabScientist = labScientistRoles.some(r => roleLower === r) ||
    roleLower.includes('lab scientist') || roleLower.includes('laboratory scientist') || roleLower.includes('lab tech');
  
  if (!isLabScientist) {
    document.getElementById('access-denied').style.display = 'block';
    return;
  }
  
  document.getElementById('lab-content').style.display = 'block';
  
  var returnFromResults = consumeLabDashboardReturnState();
  if (returnFromResults) {
    await loadDashboard({ skipTabBodyReload: true });
    await switchTab('in-process');
    applyLabDashboardReturnScrollExpand(returnFromResults);
    requestAnimationFrame(function () {
      if (typeof window.applyLabDashboardSearch === 'function') window.applyLabDashboardSearch();
    });
  } else {
    await loadDashboard();
  }
  
  // Auto-refresh removed to prevent unexpected page refreshes
});

// Get the active tab's orders list container ID (searches only the active tab)
function getActiveTabListId() {
  const activeTab = document.querySelector('.tab-content.active');
  if (!activeTab) return 'incoming-orders-list';
  const list = activeTab.querySelector('[id*="orders-list"]');
  return list ? list.id : 'incoming-orders-list';
}

// Get unique patients from order cards in the active tab only (use card's data-patient-key for exact match)
function getPatientsFromActiveTab() {
  const listId = getActiveTabListId();
  const container = document.getElementById(listId);
  if (!container) return [];
  const cards = container.querySelectorAll('.order-card');
  const seen = new Set();
  const patients = [];
  cards.forEach(function(card) {
    const name = (card.getAttribute('data-patient-name') || '').trim();
    const id = (card.getAttribute('data-patient-id') || '').trim();
    const dob = (card.getAttribute('data-patient-dob') || '').trim();
    var key = (card.getAttribute('data-patient-key') || '').trim();
    if (!key) key = (name + '|' + id).toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      patients.push({ name: name || 'Unknown', id: id || '', dob: dob || '', key: key });
    }
  });
  return patients;
}

// Show dropdown on focus/click - populated with patients from active tab
window.showLabSearchDropdown = function() {
  const dropdown = document.getElementById('lab-search-dropdown');
  const searchInput = document.getElementById('lab-dashboard-search');
  if (!dropdown || !searchInput) return;
  updateLabSearchDropdown();
  dropdown.style.display = 'block';
  // Close on click outside - delay to avoid same click closing immediately
  setTimeout(function() {
    const closeHandler = function(e) {
      if (!dropdown.contains(e.target) && e.target !== searchInput && !searchInput.contains(e.target)) {
        dropdown.style.display = 'none';
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);
};

// Called when user clicks a dropdown item (inline onclick passes the element)
window.selectLabPatientFromDropdown = function(el) {
  if (!el || !el.getAttribute) return;
  var patientKey = (el.getAttribute('data-patient-key') || '').trim();
  var displayLabel = (el.getAttribute('data-display-label') || patientKey).trim();
  if (!patientKey) return;
  var searchInput = document.getElementById('lab-dashboard-search');
  var dropdown = document.getElementById('lab-search-dropdown');
  if (!searchInput || !dropdown) return;
  // Temporarily remove oninput so setting value doesn't trigger it (avoids race)
  var savedOninput = searchInput.getAttribute('oninput');
  searchInput.removeAttribute('oninput');
  searchInput.setAttribute('data-selected-patient-key', patientKey);
  searchInput.value = displayLabel;
  if (savedOninput) searchInput.setAttribute('oninput', savedOninput);
  applyLabDashboardSearch();
  dropdown.style.display = 'none';
};

// Update dropdown content - filter by search term, show patients from active tab
window.updateLabSearchDropdown = function() {
  const dropdown = document.getElementById('lab-search-dropdown');
  const searchInput = document.getElementById('lab-dashboard-search');
  if (!dropdown || !searchInput) return;
  const term = (searchInput.value || '').trim().toLowerCase();
  const patients = getPatientsFromActiveTab();
  const filtered = term
    ? patients.filter(function(p) {
        const name = (p.name || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const dob = (p.dob || '').toLowerCase();
        return name.includes(term) || id.includes(term) || dob.includes(term);
      })
    : patients;
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div style="padding: 16px; color: #666; font-style: italic;">' +
      (patients.length === 0 ? 'No patients in this tab' : 'No matching patients') + '</div>';
  } else {
    dropdown.innerHTML = filtered.map(function(p) {
      const label = [p.name, p.id ? 'ID: ' + p.id : '', p.dob ? 'DOB: ' + p.dob : ''].filter(Boolean).join(' \u2022 ');
      const safeLabel = (label || 'Unknown').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      var patientKey = (p.key || ((p.name || '') + '|' + (p.id || '')).toLowerCase()).trim();
      var safeKey = patientKey.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
      return '<div class="lab-search-dropdown-item" data-patient-key="' + safeKey + '" data-display-label="' + safeLabel + '" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #eee; transition: background 0.2s;" onmouseover="this.style.background=\'#f0f9f4\'" onmouseout="this.style.background=\'white\'" onclick="window.selectLabPatientFromDropdown(this); return false;">' + safeLabel + '</div>';
    }).join('');
  }
  dropdown.style.display = 'block';
};

// Select patient from dropdown - filter to that patient (use ID if unique, else name)
window.selectLabSearchPatient = function(name, id, dob) {
  const searchInput = document.getElementById('lab-dashboard-search');
  if (searchInput) {
    searchInput.value = (id || name || '').trim();
    applyLabDashboardSearch();
  }
};

// Search filter - ACTIVE TAB ONLY. When patient selected from dropdown: exact match by key (or ID fallback). When typing: fuzzy match.
window.applyLabDashboardSearch = function() {
  const searchInput = document.getElementById('lab-dashboard-search');
  if (!searchInput) return;
  const term = (searchInput.value || '').trim().toLowerCase();
  const selectedKey = (searchInput.getAttribute('data-selected-patient-key') || '').trim();
  const listId = getActiveTabListId();
  const container = document.getElementById(listId);
  if (!container) return;
  const cards = container.querySelectorAll('.order-card');
  // When patient selected: extract ID from key (format "name|id") for fallback match
  const selectedId = selectedKey.indexOf('|') >= 0 ? selectedKey.split('|')[1] : selectedKey;
  cards.forEach(function(card) {
    if (!term && !selectedKey) {
      card.classList.remove('lab-search-hidden');
      return;
    }
    var matches = false;
    if (selectedKey) {
      var cardKey = (card.getAttribute('data-patient-key') || '').trim();
      if (!cardKey) cardKey = ((card.getAttribute('data-patient-name') || '') + '|' + (card.getAttribute('data-patient-id') || '')).toLowerCase().trim();
      var cardId = (card.getAttribute('data-patient-id') || '').trim().toLowerCase();
      // Exact key match, or fallback: match by patient ID (unique per patient)
      matches = (cardKey === selectedKey) || (selectedId && cardId === selectedId.toLowerCase());
    } else {
      var name = (card.getAttribute('data-patient-name') || '').toLowerCase();
      var id = (card.getAttribute('data-patient-id') || '').toLowerCase();
      var dob = (card.getAttribute('data-patient-dob') || '').toLowerCase();
      matches = name.includes(term) || id.includes(term) || dob.includes(term);
    }
    if (matches) {
      card.classList.remove('lab-search-hidden');
    } else {
      card.classList.add('lab-search-hidden');
    }
  });
};

window.clearLabDashboardSearch = function() {
  const searchInput = document.getElementById('lab-dashboard-search');
  const dropdown = document.getElementById('lab-search-dropdown');
  if (searchInput) {
    searchInput.value = '';
    searchInput.removeAttribute('data-selected-patient-key');
    applyLabDashboardSearch();
  }
  if (dropdown) dropdown.style.display = 'none';
};

// Switch tabs
async function switchTab(tabName, event) {
  // Hide all tabs
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Show selected tab
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName || 
          tab.textContent.toLowerCase().includes(tabName.replace('-', ' '))) {
        tab.classList.add('active');
      }
    });
  }
  
  const tabContent = document.getElementById(`tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }
  
  // Hide search dropdown when switching tabs
  const dropdown = document.getElementById('lab-search-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  // Load tab data
  if (tabName === 'incoming') {
    await loadIncomingOrders();
    requestAnimationFrame(() => {
      setTimeout(restoreExpandedState, 200);
      if (typeof window.applyLabDashboardSearch === 'function') window.applyLabDashboardSearch();
    });
  } else if (tabName === 'in-process') {
    await loadInProcessOrders();
    requestAnimationFrame(() => {
      setTimeout(restoreExpandedState, 200);
      if (typeof window.applyLabDashboardSearch === 'function') window.applyLabDashboardSearch();
    });
  } else if (tabName === 'completed') {
    await loadCompletedOrders();
    requestAnimationFrame(() => {
      setTimeout(restoreExpandedState, 200);
      if (typeof window.applyLabDashboardSearch === 'function') window.applyLabDashboardSearch();
    });
  }
}

// Store expanded order IDs to preserve state across reloads
window.expandedOrderIds = window.expandedOrderIds || new Set();

// Ensure display serial is always LAB-MEC-XXX (belt-and-suspenders if formatLabOrderSerial is overwritten)
function ensureLabDisplaySerial(serial, orderId, order) {
  const out = (typeof window.formatLabOrderSerial === 'function' ? window.formatLabOrderSerial(serial, orderId, order) : (serial || (orderId && orderId.substring(0, 8)) || 'N/A'));
  if (out && /^(LAB|IMG)-(\d+)$/i.test(String(out))) return String(out).replace(/^(LAB|IMG)-(\d+)$/i, (_, p, n) => p.toUpperCase() + '-MEC-' + n.padStart(3, '0'));
  return out;
}

/** Collapsed card header: number of test rows inside expanded section (0 = visible empty). */
function dashboardOrderTestCountLabel(n) {
  const c = Math.max(0, Number(n) || 0);
  const style = c === 0 ? 'font-size:13px;color:#6c757d;font-weight:600;' : 'font-size:13px;color:#495057;font-weight:600;';
  const label = c === 1 ? '1 test' : c + ' tests';
  return ` <span style="${style}">(${label})</span>`;
}

function dashboardEscSmallHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function dashboardAttrTitle(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Dashboard test cards only: shorten multi-CPT (e.g. Hep B panel) and long multi-part specimen;
 * full text in title tooltip; reports / order detail show everything.
 */
function dashboardTestCptSpecimenHtml(test) {
  if (!test) return '';
  const out = [];
  if (test.cpt != null && String(test.cpt).trim() !== '') {
    const cptPlain = String(test.cpt).trim();
    const cptPieces = cptPlain.split(/[/,\n\r]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    const cptLine = cptPieces.length <= 1
      ? 'CPT: ' + dashboardEscSmallHtml(cptPlain)
      : 'CPT: ' + dashboardEscSmallHtml(cptPieces[0]) + ' <span style="opacity:.85;">(+' + (cptPieces.length - 1) + ' more)</span>';
    out.push('<br><small style="color: #6c757d;" title="' + dashboardAttrTitle(cptPlain) + '">' + cptLine + '</small>');
  }
  if (test.specimen != null && String(test.specimen).trim() !== '') {
    const specPlain = String(test.specimen).trim();
    const specPieces = specPlain.split(/\s*\/\s*/).map(function (p) { return p.trim(); }).filter(Boolean);
    const specLine = specPieces.length <= 2
      ? 'Specimen: ' + dashboardEscSmallHtml(specPlain)
      : 'Specimen: ' + dashboardEscSmallHtml(specPieces[0]) + ' <span style="opacity:.85;">(+' + (specPieces.length - 1) + ' parts)</span>';
    out.push('<br><small style="color: #6c757d;" title="' + dashboardAttrTitle(specPlain) + '">' + specLine + '</small>');
  }
  return out.join('');
}

// Helper function to format lab order serial number - always use LAB-MEC-XXXX / IMG-MEC-XXXX format
// Retroactively normalizes legacy LAB-XXX (without org prefix) to LAB-MEC-XXX for consistent display
window.formatLabOrderSerial = function formatLabOrderSerial(serialNumber, orderId, orderOrOrgId) {
  if (!serialNumber) {
    return orderId ? orderId.substring(0, 8) : 'N/A';
  }
  // Aggressive cleanup: trim, remove control chars, ensure string
  const raw = String(serialNumber || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
  const normalized = raw.toUpperCase();

  // FIRST: Legacy LAB-XXX, IMG-XXX, or LABXXX/IMGXXX (no org prefix) - MUST convert to LAB-MEC-XXX
  let legacyMatch = normalized.match(/^(LAB|IMG)-(\d+)$/);
  if (!legacyMatch) legacyMatch = normalized.match(/^(LAB|IMG)(\d+)$/);
  if (legacyMatch) {
    const prefix = legacyMatch[1];
    const numPart = legacyMatch[2];
    const padded = numPart.length <= 3 ? numPart.padStart(3, '0') : numPart;
    let orgPrefix = 'MEC';
    if (orderOrOrgId) {
      const orgId = typeof orderOrOrgId === 'object' ? (orderOrOrgId.organization_id || orderOrOrgId.orgId) : orderOrOrgId;
      if (orgId) {
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const checkOrgId = orgId || user.organizationId || user.organization_id;
          if (checkOrgId) {
            const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
            const org = Object.values(orgs).find(o => o && o.id === checkOrgId);
            if (org?.name) orgPrefix = org.name.substring(0, 3).toUpperCase();
          }
        } catch (e) {}
      }
    }
    return `${prefix}-${orgPrefix}-${padded}`;
  }

  const prefix = normalized.startsWith('IMG') ? 'IMG' : 'LAB';

  // Get org prefix for display (MEC, etc.) - from order, localStorage, or default
  function getOrgPrefix() {
    let orgId = null;
    if (orderOrOrgId) {
      orgId = typeof orderOrOrgId === 'object' ? (orderOrOrgId.organization_id || orderOrOrgId.orgId) : orderOrOrgId;
    }
    if (!orgId) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        orgId = user.organizationId || user.organization_id;
      } catch (e) {}
    }
    if (orgId) {
      try {
        const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
        const org = Object.values(orgs).find(o => o && o.id === orgId);
        if (org?.name) return org.name.substring(0, 3).toUpperCase();
      } catch (e) {}
    }
    return 'MEC';
  }

  // Already in correct format LAB-MEC-XXX / IMG-MEC-XXX - return normalized for consistent display
  if (raw.length <= 20 && /^(LAB|IMG)-[A-Z]{2,4}-\d+$/.test(normalized)) {
    return normalized;
  }
  
  // If it's short but not matching expected format, continue to long-format parsing
  if (raw.length <= 15 && !normalized.match(/^(LAB|IMG)-/)) {
    return raw;
  }
  
  // If it matches pattern like "LAB-MEC0006-1767378043043-if5wean" or "IMG-MEC0006-1767378043043-if5wean", extract meaningful parts
  const parts = raw.split('-');
  if (parts.length > 2 && (parts[0] === 'LAB' || parts[0] === 'IMG')) {
    // Try to extract org prefix from the serial number if present (e.g., MEC0006 -> MEC)
    let orgPrefix = null;
    if (parts.length >= 2) {
      const secondPart = parts[1];
      // Check if second part looks like org prefix + number (e.g., MEC0006)
      const orgPrefixMatch = secondPart.match(/^([A-Z]{2,4})\d+$/);
      if (orgPrefixMatch) {
        orgPrefix = orgPrefixMatch[1];
      }
    }
    
    // Try to find a numeric timestamp part (long number like 1767378043043)
    const timestampPart = parts.find(p => /^\d{10,}$/.test(p));
    if (timestampPart) {
      // Extract last 3 digits from timestamp
      const lastThreeDigits = timestampPart.substring(timestampPart.length - 3);
      // Use org prefix if found, otherwise just LAB
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastThreeDigits}` : `${prefix}-${lastThreeDigits}`;
    }
    
    // If no timestamp found, try to find any numeric part
    const numericPart = parts.find(p => /^\d+$/.test(p));
    if (numericPart) {
      // Use last 3 digits of numeric part
      const lastThreeDigits = numericPart.substring(Math.max(0, numericPart.length - 3));
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastThreeDigits.padStart(3, '0')}` : `${prefix}-${getOrgPrefix()}-${lastThreeDigits.padStart(3, '0')}`;
    }
    
    // Fallback: use last 4 characters of order ID if available
    if (orderId && orderId.length >= 4) {
      const shortId = orderId.substring(orderId.length - 4).replace(/-/g, '');
      return orgPrefix ? `${prefix}-${orgPrefix}-${shortId}` : `${prefix}-${getOrgPrefix()}-${shortId}`;
    }
    
    // Last resort: use first 3 characters of last part
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length >= 3) {
      return orgPrefix ? `${prefix}-${orgPrefix}-${lastPart.substring(0, 3)}` : `${prefix}-${lastPart.substring(0, 3)}`;
    }
  }
  
  // If it's still too long and doesn't match expected pattern, truncate it
  if (raw.length > 20) {
    return raw.substring(0, 17) + '...';
  }
  
  // FINAL SAFEGUARD: Never return legacy LAB-XXX/IMG-XXX - force convert
  const lastLegacy = normalized.match(/^(LAB|IMG)-?(\d+)$/);
  if (lastLegacy) {
    const p = lastLegacy[1];
    const n = (lastLegacy[2] || '').padStart(3, '0');
    return `${p}-${getOrgPrefix()}-${n}`;
  }
  
  return raw;
};

// Panel test names for display expansion (must match lab-results-manager.js LAB_PANEL_TEST_NAMES)
var LAB_PANEL_DISPLAY = {
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

/** Expand panel items to subtests for display; otherwise return items as-is. */
function expandPanelItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  var out = [];
  items.forEach(function (item) {
    var name = (item && (typeof item === 'object' ? item.name : item)) || '';
    var nameStr = String(name).trim();
    var subTests = LAB_PANEL_DISPLAY[nameStr];
    if (subTests && subTests.length > 0) {
      subTests.forEach(function (sub) {
        out.push({ name: sub, _orderId: item._orderId, cpt: item.cpt, specimen: item.specimen });
      });
    } else {
      out.push(typeof item === 'object' && item !== null ? { ...item } : { name: nameStr, _orderId: item._orderId });
    }
  });
  return out;
}

/** Get result for a test: exact key, case-insensitive, then panel key fallback (for single-panel orders). */
function getTestResultForDisplay(parsedResults, testNameStr) {
  if (!parsedResults || typeof parsedResults !== 'object') return null;
  var r = parsedResults[testNameStr];
  if (r) return r;
  var key = Object.keys(parsedResults).find(function (k) { return k.toLowerCase() === testNameStr.toLowerCase(); });
  if (key) return parsedResults[key];
  for (var panelName in LAB_PANEL_DISPLAY) {
    if (!Object.prototype.hasOwnProperty.call(LAB_PANEL_DISPLAY, panelName)) continue;
    if (LAB_PANEL_DISPLAY[panelName].indexOf(testNameStr) !== -1) {
      var panelResult = parsedResults[panelName];
      if (panelResult) return panelResult;
    }
  }
  return null;
}

/** Normalize status string for comparison. */
function normalizeStatus(s) {
  return (s && String(s).toLowerCase().trim()) || '';
}
function isStatusInProcess(s) {
  var n = normalizeStatus(s);
  return n === 'in-process' || n === 'in process' || n === 'in_progress';
}

/** True if this test (panel or single) is in-process: check panel key and, for panels, any sub-test key so we never miss one. */
function isTestInProcess(parsedResults, testNameStr) {
  if (!parsedResults || typeof parsedResults !== 'object') return false;
  var testNorm = String(testNameStr || '').trim().toLowerCase();
  // 1) Direct lookup via getTestResultForDisplay
  var r = getTestResultForDisplay(parsedResults, testNameStr);
  if (r && isStatusInProcess(r.status)) return true;
  // 2) Panel sub-tests
  var subs = LAB_PANEL_DISPLAY[testNameStr];
  if (subs && subs.length > 0) {
    for (var i = 0; i < subs.length; i++) {
      var subKey = Object.keys(parsedResults).find(function (k) { return String(k).trim().toLowerCase() === String(subs[i]).trim().toLowerCase(); });
      var subR = subKey ? parsedResults[subKey] : parsedResults[subs[i]];
      if (subR && isStatusInProcess(subR.status)) return true;
    }
  }
  // 3) Fallback: scan all keys - status may be stored under slightly different key (whitespace, casing)
  var keys = Object.keys(parsedResults);
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    if (!key || key.startsWith('_')) continue; // skip metadata keys
    var keyNorm = key.trim().toLowerCase();
    if (keyNorm !== testNorm) {
      // Check if key is a sub-test of a panel we're displaying
      var foundAsSub = false;
      for (var pn in LAB_PANEL_DISPLAY) {
        if (LAB_PANEL_DISPLAY[pn].some(function (st) { return st.trim().toLowerCase() === keyNorm; }) && (testNorm === pn.trim().toLowerCase() || LAB_PANEL_DISPLAY[pn].some(function (st) { return st.trim().toLowerCase() === testNorm; }))) {
          foundAsSub = true;
          break;
        }
      }
      if (!foundAsSub) continue;
    }
    var res = parsedResults[key];
    if (res && typeof res === 'object' && isStatusInProcess(res.status)) return true;
  }
  return false;
}

/** Normalize selected_items to an array (handle string, object-with-keys, single string). */
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
    return [{ name: String(raw.name || raw) }];
  }
  return [];
}

/** Panel names that are shown as ONE primary test with sub-tests listed under it on the lab scientist dashboard. Individual sub-tests (e.g. Prolactin) remain orderable and show as their own card when ordered alone. */
var DISPLAY_PANEL_AS_SINGLE = { 'Hepatitis B Profile': true, 'Hormonal Profile (Panel)': true };

/** Get display items for an order. Panels in DISPLAY_PANEL_AS_SINGLE show as one card; other panel-like items are expanded; single tests (e.g. Prolactin) stay as one card. */
function getDisplayItemsForOrder(order) {
  var orderId = order.id;
  var items = normalizeSelectedItems(order.selected_items);
  var withOrderId = items.map(function (item) {
    var obj = typeof item === 'object' && item !== null ? item : { name: item };
    return { ...obj, _orderId: orderId };
  });
  // Retroactive display: if selected_items holds expanded panel sub-tests (e.g. Prolactin, FSH, …), collapse to one panel so we show one card
  var nameSet = new Set(withOrderId.map(function (i) { return String((i && i.name) || i).trim(); }).filter(Boolean));
  var used = new Set();
  var collapsed = [];
  for (var panelName in DISPLAY_PANEL_AS_SINGLE) {
    if (!Object.prototype.hasOwnProperty.call(DISPLAY_PANEL_AS_SINGLE, panelName) || !LAB_PANEL_DISPLAY[panelName]) continue;
    var subTests = LAB_PANEL_DISPLAY[panelName];
    var allPresent = subTests.every(function (t) { return nameSet.has(t); });
    var noneUsed = subTests.every(function (t) { return !used.has(t); });
    if (allPresent && noneUsed) {
      collapsed.push({ name: panelName, _orderId: orderId, _isPanel: true, _panelSubTests: subTests });
      subTests.forEach(function (t) { used.add(t); });
    }
  }
  nameSet.forEach(function (n) { if (!used.has(n)) collapsed.push({ name: n, _orderId: orderId }); });
  if (collapsed.length > 0 && collapsed.length < withOrderId.length) {
    withOrderId = collapsed;
  }
  var out = [];
  withOrderId.forEach(function (item) {
    var nameStr = String((item && item.name) || item || '').trim();
    var subTests = LAB_PANEL_DISPLAY[nameStr];
    if (DISPLAY_PANEL_AS_SINGLE[nameStr] && subTests && subTests.length > 0) {
      out.push({
        name: nameStr,
        _orderId: item._orderId,
        cpt: item.cpt,
        specimen: item.specimen,
        _isPanel: true,
        _panelSubTests: subTests
      });
    } else if (subTests && subTests.length > 0) {
      subTests.forEach(function (sub) {
        out.push({ name: sub, _orderId: item._orderId, cpt: item.cpt, specimen: item.specimen });
      });
    } else {
      out.push(typeof item === 'object' && item !== null ? { ...item } : { name: nameStr, _orderId: item._orderId });
    }
  });
  if (out.length > 0) return out;
  var results = order.results;
  if (typeof results === 'string') {
    try { results = JSON.parse(results); } catch (e) { results = {}; }
  }
  if (results && typeof results === 'object' && Object.keys(results).length > 0) {
    var keys = Object.keys(results);
    var seen = {};
    var fromResults = [];
    keys.forEach(function (k) {
      var subTests = LAB_PANEL_DISPLAY[k];
      if (DISPLAY_PANEL_AS_SINGLE[k] && subTests && subTests.length > 0) {
        if (!seen[k]) { seen[k] = true; fromResults.push({ name: k, _orderId: orderId, _isPanel: true, _panelSubTests: subTests }); }
      } else if (subTests && subTests.length > 0) {
        subTests.forEach(function (sub) {
          if (!seen[sub]) { seen[sub] = true; fromResults.push({ name: sub, _orderId: orderId }); }
        });
      } else {
        if (!seen[k]) { seen[k] = true; fromResults.push({ name: k, _orderId: orderId }); }
      }
    });
    return fromResults;
  }
  return [];
}

/** Group orders that were sent together (same patient, visit, within 5 min) for uniform display. */
function groupOrdersAsOneSend(orders) {
  if (!orders || orders.length === 0) return [];
  const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const key = (o) => `${o.patient_id || ''}|${o.visit_date || ''}|${o.organization_id || ''}`;
  const byKey = new Map();
  for (const order of orders) {
    const k = key(order);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(order);
  }
  const groups = [];
  for (const [, arr] of byKey) {
    arr.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    let batch = [];
    let batchStart = null;
    for (const order of arr) {
      const t = new Date(order.created_at || 0).getTime();
      if (batch.length === 0 || (batchStart !== null && t - batchStart <= TIME_WINDOW_MS)) {
        if (batch.length === 0) batchStart = t;
        batch.push(order);
      } else {
        groups.push(buildGroup(batch));
        batch = [order];
        batchStart = t;
      }
    }
    if (batch.length > 0) groups.push(buildGroup(batch));
  }
  return groups;
}

function buildGroup(orders) {
  const primary = orders[0];
  const orderIds = orders.map(o => o.id);
  const combinedItems = [];
  for (const order of orders) {
    let items = order.selected_items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    if (!Array.isArray(items)) items = [];
    for (const item of items) {
      combinedItems.push({ ...(typeof item === 'object' && item !== null ? item : { name: item }), _orderId: order.id });
    }
  }
  return { orderIds, orders, primaryOrder: primary, combinedItems };
}

function getParsedResults(order) {
  let pr = {};
  if (order.results) {
    if (typeof order.results === 'string') {
      try { pr = JSON.parse(order.results); } catch (e) { pr = {}; }
    } else if (typeof order.results === 'object' && order.results !== null) pr = order.results;
  }
  return pr;
}

/** Display line items + pending-only subset for Incoming (must match what we render). */
function buildIncomingGroupDisplayContext(group) {
  const parsedResultsByOrderId = {};
  group.orders.forEach(function (o) {
    parsedResultsByOrderId[o.id] = getParsedResults(o);
  });
  const displayItems = group.orders.flatMap(function (o) {
    return getDisplayItemsForOrder(o);
  });
  const selectedItems = displayItems.map(function (item) {
    return { ...item, _parsedResults: parsedResultsByOrderId[item._orderId] || {} };
  });
  const pendingForIncoming = selectedItems.filter(function (test) {
    const parsedResults = test._parsedResults || {};
    const testName = test.name || test;
    const testNameStr = String(testName);
    if (!testNameStr.trim()) return false;
    let testResult = getTestResultForDisplay(parsedResults, testNameStr);
    const testStatus = testResult?.status || 'pending';
    const testStatusLower = String(testStatus).toLowerCase();
    const isPending = testStatus === 'pending' || testStatusLower === 'pending' || testStatus === '' || !testResult || !testResult.status;
    const isCompleted = testStatus === 'completed' || testStatusLower === 'completed';
    const isInProcess = testStatus === 'in-process' || testStatusLower === 'in-process' || testStatusLower === 'in process' || testStatusLower === 'in_progress';
    return isPending && !isCompleted && !isInProcess;
  });
  return { selectedItems, pendingForIncoming };
}

/** In Process tab: display rows + full selectedItems (must match loadInProcessOrders). */
function buildInProcessGroupDisplayContext(group) {
  const parsedResultsByOrderId = {};
  group.orders.forEach(function (o) {
    parsedResultsByOrderId[o.id] = getParsedResults(o);
  });
  const displayItems = group.orders.flatMap(function (o) {
    return getDisplayItemsForOrder(o);
  });
  const selectedItems = displayItems.map(function (item) {
    return { ...item, _parsedResults: parsedResultsByOrderId[item._orderId] || {} };
  });
  let inProcessTests = selectedItems.filter(function (test) {
    const parsedResults = test._parsedResults || {};
    const testNameStr = String(test.name || test).trim();
    return isTestInProcess(parsedResults, testNameStr);
  });
  if (inProcessTests.length === 0) {
    const fallbackItems = [];
    group.orders.forEach(function (o) {
      const pr = parsedResultsByOrderId[o.id] || {};
      if (pr && typeof pr === 'object') {
        Object.keys(pr).forEach(function (k) {
          if (!k || k.startsWith('_')) return;
          const res = pr[k];
          if (res && typeof res === 'object' && isStatusInProcess(res.status)) {
            const existing = fallbackItems.find(function (it) {
              return String(it.name || it).trim().toLowerCase() === String(k).trim().toLowerCase() && it._orderId === o.id;
            });
            if (!existing) fallbackItems.push({ name: k, _orderId: o.id, _parsedResults: pr });
          }
        });
      }
    });
    inProcessTests = fallbackItems;
  }
  return { selectedItems, inProcessTests, parsedResultsByOrderId };
}

/** Completed tab: rows to show (must match loadCompletedOrders). */
function buildCompletedGroupDisplayContext(group) {
  const parsedResultsByOrderId = {};
  group.orders.forEach(function (o) {
    parsedResultsByOrderId[o.id] = getParsedResults(o);
  });
  const displayItems = group.orders.flatMap(function (o) {
    return getDisplayItemsForOrder(o);
  });
  const selectedItems = displayItems.map(function (item) {
    return { ...item, _parsedResults: parsedResultsByOrderId[item._orderId] || {} };
  });
  let completedForTab = selectedItems.filter(function (test) {
    const parsedResults = test._parsedResults || {};
    const testNameStr = String(test.name || test);
    const testResults = getTestResultForDisplay(parsedResults, testNameStr);
    const testStatus = testResults?.status || 'pending';
    const testStatusLower = String(testStatus).toLowerCase();
    return testStatus === 'completed' || testStatusLower === 'completed';
  });
  if (completedForTab.length === 0) {
    const fallbackItems = [];
    group.orders.forEach(function (o) {
      const pr = parsedResultsByOrderId[o.id] || {};
      if (pr && typeof pr === 'object') {
        Object.keys(pr).forEach(function (k) {
          if (!k || k.startsWith('_')) return;
          const res = pr[k];
          if (res && typeof res === 'object') {
            const st = String(res.status || '').toLowerCase();
            if (st === 'completed') {
              const existing = fallbackItems.find(function (it) {
                return String(it.name || it).trim().toLowerCase() === String(k).trim().toLowerCase() && it._orderId === o.id;
              });
              if (!existing) fallbackItems.push({ name: k, _orderId: o.id, _parsedResults: pr });
            }
          }
        });
      }
    });
    completedForTab = fallbackItems;
  }
  return { selectedItems, completedForTab, parsedResultsByOrderId };
}

function labDashboardPatientIdUi(patientData, rawOrderPatientId) {
  const hint = (patientData && patientData.legacyId) || rawOrderPatientId || '';
  const subject = (patientData && patientData.patient) || hint;
  return typeof window.patientMrnDisplay === 'function'
    ? window.patientMrnDisplay(subject, hint)
    : hint || '—';
}

  const patientDataMap = new Map(); // Map order.patient_id -> { name, legacyId }
  
  // Fetch all patient names in parallel
  const patientPromises = orders.map(async (order) => {
    if (!order.patient_id) return;
    
    const orderPatientId = order.patient_id;
    if (patientDataMap.has(orderPatientId)) return; // Already fetching
    
    try {
      let patient = null;
      if (typeof window.resolvePatientByIdentifier === 'function') {
        try {
          patient = await window.resolvePatientByIdentifier(orderPatientId);
        } catch (resolveErr) {
          debugWarn('⚠️ resolvePatientByIdentifier failed for', orderPatientId, resolveErr);
          patient = null;
        }
      } else {
        // Fallback: try localStorage
        const patients = typeof window.loadPatientsWithSupabasePriority === 'function' 
          ? await window.loadPatientsWithSupabasePriority()
          : JSON.parse(localStorage.getItem('patients') || '[]');
        patient = patients.find(p => 
          p.id === orderPatientId || 
          p.patient_id === orderPatientId ||
          p._supabaseUuid === orderPatientId ||
          String(p.id) === String(orderPatientId) ||
          String(p.patient_id) === String(orderPatientId)
        );
      }
      
      if (patient) {
        const firstName = patient.first_name || patient.firstName || '';
        const lastName = patient.last_name || patient.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        // Get legacy patient ID - CRITICAL: Always use getPatientIdentifier first
        let legacyPatientId = null;
        
        if (typeof window.getPatientIdentifier === 'function') {
          legacyPatientId = window.getPatientIdentifier(patient);
        }
        const isUuidLike = (s) => s && typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
        // If getPatientIdentifier returned null or UUID, try alternative fields
        if (!legacyPatientId || isUuidLike(legacyPatientId)) {
          if (patient.patient_id && !isUuidLike(patient.patient_id)) {
            legacyPatientId = patient.patient_id;
          } else if (patient.patientNumber && !isUuidLike(patient.patientNumber)) {
            legacyPatientId = patient.patientNumber;
          } else if (patient.id && !isUuidLike(patient.id)) {
            legacyPatientId = patient.id;
          }
        }
        // Final fallback: if order's patient_id is legacy format (not UUID), use it
        if (!legacyPatientId || isUuidLike(legacyPatientId)) {
          if (orderPatientId && !isUuidLike(orderPatientId)) {
            legacyPatientId = orderPatientId;
          } else {
            // Last resort: mark as unknown if we can't find a legacy ID
            legacyPatientId = 'Unknown';
            debugWarn(`⚠️ Could not determine legacy ID for patient. Order patient_id: ${orderPatientId}, Patient object:`, {
              id: patient.id,
              patient_id: patient.patient_id,
              patientNumber: patient.patientNumber,
              _supabaseUuid: patient._supabaseUuid
            });
          }
        }
        if (typeof window.getPatientIdForDisplay === 'function') {
          const uiMapped = window.getPatientIdForDisplay(patient, orderPatientId);
          if (uiMapped) legacyPatientId = uiMapped;
        }
        
        const dob = patient.dob || patient.dateOfBirth || patient.date_of_birth || '';
        const dobStr = dob ? (typeof dob === 'string' ? dob : (dob instanceof Date ? dob.toISOString().split('T')[0] : String(dob))) : '';
        patientDataMap.set(orderPatientId, {
          name: fullName || 'Unknown Patient',
          legacyId: legacyPatientId,
          dob: dobStr,
          patient: patient
        });
      } else {
        // Patient not found - check if order's patient_id is already legacy format
        let displayId = orderPatientId;
        let patientName = 'Patient Not Found';
        let fallbackDob = '';
        
        if (orderPatientId.includes('-') && orderPatientId.length === 36) {
          // It's a UUID, we can't display it - mark as not found
          displayId = 'Unknown';
          debugWarn(`⚠️ Patient not found for UUID: ${orderPatientId}. Order serial: ${order.serial_number || order.id}`);
        } else {
          // Order has legacy ID but patient not found - use it anyway and show "Patient Not Found"
          debugWarn(`⚠️ Patient not found for legacy ID: ${orderPatientId}. Order serial: ${order.serial_number || order.id}`);
          
          // Try multiple fallback strategies
          debugLog(`🔍 [FALLBACK] Starting fallback search for patient: ${orderPatientId}`);
          try {
            // Strategy 1: Reload patients from Supabase and try case-insensitive search
            let patients = [];
            if (typeof window.loadPatientsWithSupabasePriority === 'function') {
              try {
                patients = await window.loadPatientsWithSupabasePriority();
                debugLog(`🔍 [FALLBACK] Reloaded ${patients.length} patients from Supabase`);
              } catch (e) {
                debugWarn('⚠️ [FALLBACK] Failed to reload patients from Supabase:', e);
                patients = JSON.parse(localStorage.getItem('patients') || '[]');
                debugLog(`🔍 [FALLBACK] Using ${patients.length} patients from localStorage`);
              }
            } else {
              patients = JSON.parse(localStorage.getItem('patients') || '[]');
              debugLog(`🔍 [FALLBACK] loadPatientsWithSupabasePriority not available, using ${patients.length} patients from localStorage`);
            }
            
            // Strategy 2: Case-insensitive search in patient_id, patientNumber, and id fields
            let foundPatient = patients.find(p => {
              const pId = p.patient_id || p.patientNumber || p.id;
              return pId && String(pId).toUpperCase() === String(orderPatientId).toUpperCase();
            });
            
            if (foundPatient) {
              debugLog(`✅ [FALLBACK] Found patient via case-insensitive localStorage search`);
            }
            
            // Strategy 3: If not found, try querying Supabase directly with maybeSingle (no error on 0 rows)
            if (!foundPatient && window.supabaseClient) {
              debugLog(`🔍 [FALLBACK] Attempting direct Supabase query for ${orderPatientId}`);
              try {
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                const orgId = user.organizationId || user.organization_id;
                
                if (orgId) {
                  // Try with maybeSingle to avoid errors
                  debugLog(`🔍 [FALLBACK] Querying Supabase with orgId: ${orgId}`);
                  const { data: supabasePatient, error: supabaseError } = await window.supabaseClient
                    .from('patients')
                    .select('*')
                    .eq('patient_id', orderPatientId)
                    .eq('organization_id', orgId)
                    .maybeSingle();
                  
                  if (!supabaseError && supabasePatient) {
                    foundPatient = supabasePatient;
                    debugLog(`✅ [FALLBACK] Found patient via direct Supabase query: ${orderPatientId}`);
                  } else {
                    debugLog(`🔍 [FALLBACK] Direct query returned ${supabaseError ? 'error' : 'no results'}, trying case-insensitive search`);
                    // Try case-insensitive Supabase query - get all patients for this org
                    const { data: allPatients, error: allError } = await window.supabaseClient
                      .from('patients')
                      .select('*')
                      .eq('organization_id', orgId)
                      .limit(1000); // Get all patients for this org
                    
                    if (!allError && allPatients && allPatients.length > 0) {
                      debugLog(`🔍 [FALLBACK] Loaded ${allPatients.length} patients from Supabase for case-insensitive search`);
                      
                      // Try exact case-insensitive match first
                      foundPatient = allPatients.find(p => {
                        const pId = p.patient_id || p.id;
                        return pId && String(pId).trim().toUpperCase() === String(orderPatientId).trim().toUpperCase();
                      });
                      
                      // If not found, try partial match (in case patient_id has extra characters)
                      if (!foundPatient) {
                        foundPatient = allPatients.find(p => {
                          const pId = p.patient_id || p.id;
                          if (!pId) return false;
                          const pIdUpper = String(pId).trim().toUpperCase();
                          const searchUpper = String(orderPatientId).trim().toUpperCase();
                          // Check if orderPatientId is contained in patient_id or vice versa
                          return pIdUpper === searchUpper || 
                                 pIdUpper.includes(searchUpper) || 
                                 searchUpper.includes(pIdUpper);
                        });
                        if (foundPatient) {
                          debugLog(`✅ [FALLBACK] Found patient via partial match: ${orderPatientId} -> ${foundPatient.patient_id || foundPatient.id}`);
                        }
                      }
                      
                      // If still not found, log all patient IDs for debugging
                      if (!foundPatient) {
                        debugLog(`⚠️ [FALLBACK] Patient ${orderPatientId} not found in ${allPatients.length} Supabase patients`);
                        debugLog(`🔍 [FALLBACK] Available patient IDs (first 10):`, allPatients.slice(0, 10).map(p => ({
                          patient_id: p.patient_id,
                          id: p.id,
                          name: `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim()
                        })));
                      } else {
                        debugLog(`✅ [FALLBACK] Found patient via case-insensitive Supabase query: ${orderPatientId}`);
                      }
                    } else {
                      debugWarn(`⚠️ [FALLBACK] Failed to load patients from Supabase:`, allError);
                    }
                  }
                } else {
                  debugWarn(`⚠️ [FALLBACK] No orgId available for Supabase query`);
                }
              } catch (supabaseFallbackError) {
                debugWarn('⚠️ [FALLBACK] Direct Supabase fallback query failed:', supabaseFallbackError);
              }
            } else if (!window.supabaseClient) {
              debugWarn(`⚠️ [FALLBACK] Supabase client not available`);
            }
            
            if (foundPatient) {
              const firstName = foundPatient.first_name || foundPatient.firstName || '';
              const lastName = foundPatient.last_name || foundPatient.lastName || '';
              const fullName = `${firstName} ${lastName}`.trim();
              fallbackDob = foundPatient.dob || foundPatient.dateOfBirth || foundPatient.date_of_birth || '';
              fallbackDob = fallbackDob ? (typeof fallbackDob === 'string' ? fallbackDob : (fallbackDob instanceof Date ? fallbackDob.toISOString().split('T')[0] : String(fallbackDob))) : '';
              if (fullName) {
                patientName = fullName;
                // Get legacy ID
                if (typeof window.getPatientIdentifier === 'function') {
                  const legacyId = window.getPatientIdentifier(foundPatient);
                  if (legacyId && !legacyId.includes('-') && legacyId.length < 36) {
                    displayId = legacyId;
                  }
                } else {
                  // Fallback legacy ID extraction
                  if (foundPatient.patient_id && !foundPatient.patient_id.includes('-') && foundPatient.patient_id.length < 36) {
                    displayId = foundPatient.patient_id;
                  }
                }
                debugLog(`✅ Found patient via fallback search: ${patientName} (${displayId})`);
              }
            } else {
              debugWarn(`⚠️ Patient ${orderPatientId} not found after all fallback strategies. Searched ${patients.length} patients.`);
            }
          } catch (fallbackError) {
            debugWarn('⚠️ Fallback search failed:', fallbackError);
          }
        }
        
        patientDataMap.set(orderPatientId, {
          name: patientName,
          legacyId: displayId,
          dob: fallbackDob || ''
        });
      }
    } catch (error) {
      debugWarn(`⚠️ Failed to fetch patient data for ${orderPatientId}:`, error);
      // Use order's patient_id as fallback (might be legacy ID)
      let displayId = orderPatientId;
      if (orderPatientId.includes('-') && orderPatientId.length === 36) {
        displayId = 'Unknown';
      }
      patientDataMap.set(orderPatientId, {
        name: null,
        legacyId: displayId,
        dob: ''
      });
    }
  });
  
  await Promise.all(patientPromises);
  return patientDataMap;
}

// Save expanded state before reloading
function saveExpandedState() {
  window.expandedOrderIds.clear();
  document.querySelectorAll('.order-details').forEach(details => {
    if (details.style.display !== 'none') {
      const orderCardId = details.id.replace('-details', '');
      window.expandedOrderIds.add(orderCardId);
    }
  });
}

// Restore expanded state after reloading
function restoreExpandedState() {
  debugLog(`🔄 [RESTORE] Restoring expanded state for ${window.expandedOrderIds.size} orders:`, Array.from(window.expandedOrderIds));
  
  window.expandedOrderIds.forEach(orderCardId => {
    const detailsDiv = document.getElementById(`${orderCardId}-details`);
    const iconSpan = document.getElementById(`${orderCardId}-icon`);
    
    if (!detailsDiv) {
      debugWarn(`⚠️ [RESTORE] Details div not found for ${orderCardId}`);
      return;
    }
    
    if (!iconSpan) {
      debugWarn(`⚠️ [RESTORE] Icon span not found for ${orderCardId}`);
      return;
    }
    
    const expandLabel = iconSpan.parentElement ? iconSpan.parentElement.querySelector('.expand-label') : null;
    
    debugLog(`✅ [RESTORE] Restoring ${orderCardId}`);
    
    // Use same robust method as toggle function
    detailsDiv.style.display = 'block';
    detailsDiv.style.visibility = 'visible';
    detailsDiv.style.opacity = '1';
    detailsDiv.removeAttribute('hidden');
    
    // Force a reflow
    void detailsDiv.offsetHeight;
    
    iconSpan.textContent = '▲';
    iconSpan.style.transform = 'rotate(180deg)';
    if (expandLabel) {
      expandLabel.textContent = 'Click to collapse';
    }
    
    // Verify it's visible
    setTimeout(() => {
      const computedDisplay = window.getComputedStyle(detailsDiv).display;
      if (computedDisplay === 'none') {
        debugWarn(`⚠️ [RESTORE] ${orderCardId} still hidden, applying !important`);
        detailsDiv.style.setProperty('display', 'block', 'important');
        detailsDiv.style.setProperty('visibility', 'visible', 'important');
      }
    }, 50);
  });
}

function consumeLabDashboardReturnState() {
  var key = window.LAB_DASHBOARD_RETURN_APPLY_KEY || 'ehr.labDashboardReturn.apply';
  try {
    var raw = sessionStorage.getItem(key);
    if (!raw) return null;
    var state = JSON.parse(raw);
    sessionStorage.removeItem(key);
    if (state && state.tab === 'in-process' && state.from === 'lab-result-entry') return state;
  } catch (e) {
    try { sessionStorage.removeItem(key); } catch (e2) {}
  }
  return null;
}

function applyLabDashboardReturnScrollExpand(state) {
  if (!state) return;
  if (state.orderId) {
    var cardId = 'order-' + state.orderId + '-inprocess';
    window.expandedOrderIds.add(cardId);
    restoreExpandedState();
    var el = document.getElementById(cardId);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      return;
    }
  }
  if (typeof state.scrollY === 'number') window.scrollTo(0, state.scrollY);
}

// Load dashboard stats
async function loadDashboard(opts) {
  var skipTabBodyReload = opts && opts.skipTabBodyReload === true;
  try {
    // Save expanded state before reloading (only if we're refreshing, not initial load)
    if (!skipTabBodyReload && (window.expandedOrderIds.size > 0 || document.querySelectorAll('.order-details').length > 0)) {
      saveExpandedState();
    }
    
    // Load order counts
    let incoming = [];
    let inProcess = [];
    let completed = [];
    
    try {
      incoming = await window.getIncomingLabOrders();
      const incomingGroups = groupOrdersAsOneSend(incoming);
      let incomingCardCount = 0;
      incomingGroups.forEach(function (g) {
        if (buildIncomingGroupDisplayContext(g).pendingForIncoming.length > 0) incomingCardCount++;
      });
      document.getElementById('stat-incoming').textContent = incomingCardCount;
    } catch (error) {
      debugWarn('Could not load incoming lab orders:', error);
      document.getElementById('stat-incoming').textContent = '0';
    }
    
    try {
      inProcess = await window.getInProcessLabOrders();
      const inProcessGroups = groupOrdersAsOneSend(inProcess);
      let inProcessCardCount = 0;
      inProcessGroups.forEach(function (g) {
        const ipc = buildInProcessGroupDisplayContext(g);
        if (ipc.inProcessTests.length > 0) inProcessCardCount++;
      });
      document.getElementById('stat-in-process').textContent = inProcessCardCount;
    } catch (error) {
      debugWarn('Could not load in-process lab orders:', error);
      document.getElementById('stat-in-process').textContent = '0';
    }
    
    try {
      completed = await window.getCompletedLabOrders();
      const completedGroups = groupOrdersAsOneSend(completed);
      let completedCardCount = 0;
      completedGroups.forEach(function (g) {
        if (buildCompletedGroupDisplayContext(g).completedForTab.length > 0) completedCardCount++;
      });
      document.getElementById('stat-completed').textContent = completedCardCount;
    } catch (error) {
      debugWarn('Could not load completed lab orders:', error);
      document.getElementById('stat-completed').textContent = '0';
    }
    
    if (skipTabBodyReload) return;
    
    // Reload current tab content WITHOUT switching (preserve active tab)
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
      const tabName = activeTab.textContent.includes('Incoming') ? 'incoming' :
                     activeTab.textContent.includes('Process') ? 'in-process' :
                     'completed';
      
      // Reload the tab content without calling switchTab (which would reset the UI)
      if (tabName === 'incoming') {
        await loadIncomingOrders();
        requestAnimationFrame(() => {
          setTimeout(restoreExpandedState, 200);
          if (typeof window.applyLabDashboardSearch === 'function') window.applyLabDashboardSearch();
        });
      } else if (tabName === 'in-process') {
        await loadInProcessOrders();
        requestAnimationFrame(() => {
          setTimeout(restoreExpandedState, 200);
          if (typeof window.applyLabDashboardSearch === 'function') window.applyLabDashboardSearch();
        });
      } else if (tabName === 'completed') {
        await loadCompletedOrders();
        requestAnimationFrame(() => {
          setTimeout(restoreExpandedState, 200);
          if (typeof window.applyLabDashboardSearch === 'function') window.applyLabDashboardSearch();
        });
      }
    }
    
  } catch (error) {
    debugError('Error loading dashboard:', error);
  }
}

// Load incoming lab orders
async function loadIncomingOrders() {
  const container = document.getElementById('incoming-orders-list');
  container.innerHTML = '<div class="loading">Loading incoming lab orders...</div>';
  
  debugLog('🔍 [LAB-DASHBOARD] Loading incoming orders...');
  debugLog('🔍 [LAB-DASHBOARD] Scripts check:', {
    getIncomingLabOrders: typeof window.getIncomingLabOrders === 'function',
    generateInvoiceFromLabOrder: typeof window.generateInvoiceFromLabOrder === 'function',
    isLabOrderPaymentConfirmed: typeof window.isLabOrderPaymentConfirmed === 'function'
  });
  
  try {
    const orders = await window.getIncomingLabOrders();
    
    debugLog('🔍 [LAB-DASHBOARD] Orders loaded:', {
      count: orders.length,
      sampleOrder: orders[0] ? {
        id: orders[0].id,
        serial_number: orders[0].serial_number,
        payment_status: orders[0].payment_status,
        invoice_id: orders[0].invoice_id,
        allKeys: Object.keys(orders[0])
      } : null
    });
    
    if (orders.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No incoming lab orders</h3><p>All orders have been processed.</p></div>';
      return;
    }
    
    const patientDataMap = await fetchPatientNamesForOrders(orders);
    const groups = groupOrdersAsOneSend(orders);
    const incomingContexts = groups.map(function (group) {
      const ctx = buildIncomingGroupDisplayContext(group);
      return { group, selectedItems: ctx.selectedItems, pendingForIncoming: ctx.pendingForIncoming };
    }).filter(function (c) {
      return c.pendingForIncoming.length > 0;
    });
    
    if (incomingContexts.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No incoming lab orders</h3><p>All orders have been processed.</p></div>';
      return;
    }
    
    container.innerHTML = incomingContexts.map(function (incomingCtx) {
      const group = incomingCtx.group;
      const selectedItems = incomingCtx.selectedItems;
      const pendingForIncoming = incomingCtx.pendingForIncoming;
      const order = group.primaryOrder;
      const orderDate = order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A';
      const visitDate = order.visit_date || 'N/A';
      const patientData = patientDataMap.get(order.patient_id) || { name: 'Loading...', legacyId: order.patient_id || 'Unknown' };
      const patientName = patientData.name || 'Loading...';
      let displayPatientId = patientData.legacyId || order.patient_id || 'Unknown';
      if (displayPatientId.includes('-') && displayPatientId.length === 36) displayPatientId = 'Unknown';
      const displayPatientIdUi = labDashboardPatientIdUi(patientData, order.patient_id);
      const paymentConfirmed = group.orders.some(o => (o.payment_status === 'paid' || o.payment_status === 'confirmed'));
      const hasInvoice = group.orders.some(o => !!(o.invoice_id && o.invoice_id !== null && o.invoice_id !== ''));
      const orderCardId = `order-${order.id}-incoming`;
      const orderIdsForInvoice = group.orderIds.length > 1 ? group.orderIds.join(',') : '';
      const patientDob = (patientData.dob || '').replace(/"/g, '&quot;');
      const patientKey = ((patientName || '') + '|' + (displayPatientId || '')).toLowerCase().replace(/"/g, '&quot;');
      return `
        <div class="order-card" id="${orderCardId}" data-patient-name="${(patientName || '').replace(/"/g, '&quot;')}" data-patient-id="${(displayPatientId || '').replace(/"/g, '&quot;')}" data-patient-dob="${patientDob}" data-patient-key="${patientKey}">
          <div class="order-header" style="cursor: pointer; user-select: none; padding: 15px; border-bottom: 2px solid #e9ecef;" data-order-card-id="${orderCardId}" title="Click to expand/collapse order details">
            <div class="order-info">
              <h3 style="display: flex; align-items: center; gap: 10px; margin: 0;">
                <span>Lab Order #${ensureLabDisplaySerial(order.serial_number, order.id, order)}${dashboardOrderTestCountLabel(pendingForIncoming.length)}${group.orderIds.length > 1 ? ' <span style="font-size:12px;color:#6c757d;">(' + group.orderIds.length + ' combined)</span>' : ''}</span>
                <span class="expand-icon" id="${orderCardId}-icon" style="font-size: 14px; transition: transform 0.3s; color: #007bff;">▼</span>
                <span class="expand-label" style="font-size: 12px; color: #6c757d; font-weight: normal;">Click to expand</span>
              </h3>
              <div class="order-meta" style="margin-top: 8px;">
                <strong style="font-size: 14px; color: #007bff;">Patient: ${patientName}</strong><br>
                Patient ID: ${displayPatientIdUi}<br>
                Order Date: ${orderDate}<br>
                Visit Date: ${visitDate}<br>
                Ordered By: ${order.created_by || 'Doctor'}<br>
                Payment: <span style="color: ${paymentConfirmed ? '#28a745' : '#dc3545'}; font-weight: bold;">
                  ${paymentConfirmed ? '✅ Paid' : hasInvoice ? '⏳ Pending' : '❌ Not Invoiced'}
                </span>
              </div>
            </div>
            <span class="status-badge status-pending">Pending</span>
          </div>
          
          <div class="order-details" id="${orderCardId}-details" style="display: none; overflow: hidden; transition: max-height 0.3s ease-out;">
          <div class="tests-list">
            <strong>Lab Tests:</strong>
            ${pendingForIncoming.map((test, index) => {
              const parsedResults = test._parsedResults || {};
              const orderIdForTest = test._orderId || order.id;
              const testName = test.name || test;
              const testNameStr = String(testName);
              const isPanel = test._isPanel === true && Array.isArray(test._panelSubTests) && test._panelSubTests.length > 0;
              let testResult = getTestResultForDisplay(parsedResults, testNameStr);
              const testResultObj = testResult || {};
              const testStatus = testResultObj.status || 'pending';
              
              // Check if test has results entered (has data beyond just status/metadata)
              // More comprehensive detection: check for entered_at, nested objects with values, and any non-metadata fields
              const metadataFields = ['status', 'entered_at', 'entered_by', 'completed_at', 'completed_by', 'started_at', 'started_by', 'reviewed_at', 'reviewed_by'];
              const isReviewed = !!(testResultObj.reviewed_at && testResultObj.reviewed_by);
              
              // If entered_at exists, results were definitely entered
              const hasEnteredAt = testResultObj && testResultObj.entered_at;
              
              // Check if testResult exists and has any keys beyond metadata
              const hasTestResult = testResultObj && typeof testResultObj === 'object' && Object.keys(testResultObj).length > 0;
              
              // Check for actual result data fields - simplified: if testResult exists and has non-metadata fields, it has results
              let hasResults = false;
              if (hasEnteredAt) {
                hasResults = true;
              } else if (hasTestResult) {
                // Check if there are any non-metadata fields
                const nonMetadataKeys = Object.keys(testResultObj).filter(key => !metadataFields.includes(key));
                if (nonMetadataKeys.length > 0) {
                  // Check if any of these fields have actual data
                  hasResults = nonMetadataKeys.some(key => {
                    const value = testResultObj[key];
                    if (value === null || value === undefined || value === '') return false;
                    if (typeof value === 'string' && value.trim()) return true;
                    if (typeof value === 'boolean') return true; // booleans are valid results
                    if (typeof value === 'number') return true; // numbers are valid results
                    if (Array.isArray(value) && value.length > 0) return true;
                    // Check nested objects - common pattern for lab results (e.g., { abo_group: { value: 'A' } })
                    if (typeof value === 'object' && value !== null) {
                      // If it has a 'value' property with data, it's a result
                      if (value.value !== undefined && value.value !== null && value.value !== '') return true;
                      // If it has any keys, it's likely a result object
                      const nestedKeys = Object.keys(value);
                      if (nestedKeys.length > 0) {
                        // Check if any nested key has actual data
                        return nestedKeys.some(nestedKey => {
                          const nestedValue = value[nestedKey];
                          if (nestedValue === null || nestedValue === undefined || nestedValue === '') return false;
                          if (typeof nestedValue === 'string' && nestedValue.trim()) return true;
                          if (typeof nestedValue === 'boolean') return true;
                          if (typeof nestedValue === 'number') return true;
                          if (typeof nestedValue === 'object' && nestedValue !== null && Object.keys(nestedValue).length > 0) return true;
                          return false;
                        });
                      }
                    }
                    return false;
                  });
                }
              }
              
              // Debug logging (remove in production if needed)
              if (testName === 'C-Reactive Protein (CRP)' || testName === 'Liver Function Test (LFT)') {
                debugLog(`🔍 [RESULT-DETECTION] Test: ${testName}`, {
                  testResult: testResultObj,
                  hasEnteredAt,
                  hasTestResult,
                  hasResults,
                  keys: testResultObj ? Object.keys(testResultObj) : [],
                  nonMetadataKeys: testResultObj ? Object.keys(testResultObj).filter(k => !metadataFields.includes(k)) : []
                });
              }
              
              // Determine effective status: if has results but not completed, show as "has results"
              // This allows user to mark it as completed manually
              const effectiveStatus = testStatus === 'completed' ? 'completed' : 
                                     (hasResults && testStatus !== 'completed') ? 'has-results' : 
                                     testStatus;
              
              const statusClass = effectiveStatus === 'completed' ? 'status-completed' : 
                                 effectiveStatus === 'has-results' ? 'status-has-results' :
                                 effectiveStatus === 'in-process' ? 'status-in-process' : 'status-pending';
              
              const statusDisplay = effectiveStatus === 'has-results' ? 'Results Entered' : 
                                   (effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1));
              const safeName = (testName + '').replace(/'/g, "\\'");
              const subTestsList = isPanel ? (test._panelSubTests.map(function (sub) { return '<li style="margin: 4px 0; font-size: 13px;">' + (sub + '').replace(/</g, '&lt;') + '</li>'; }).join('')) : '';
              return `
                <div class="test-item" style="border: 2px solid ${effectiveStatus === 'completed' ? '#28a745' : effectiveStatus === 'has-results' ? '#17a2b8' : effectiveStatus === 'in-process' ? '#ffc107' : '#dc3545'}; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: ${effectiveStatus === 'completed' ? '#d4edda' : effectiveStatus === 'has-results' ? '#d1ecf1' : effectiveStatus === 'in-process' ? '#fff3cd' : '#f8d7da'};">
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="flex: 1; min-width: 0;">
                      <strong>${(testName + '').replace(/</g, '&lt;')}</strong>
                      ${isPanel && subTestsList ? `<ul style="margin: 8px 0 0 18px; padding: 0; list-style: disc;">${subTestsList}</ul>` : ''}
                      ${dashboardTestCptSpecimenHtml(test)}
                      <br><span class="status-badge ${statusClass}" style="margin-top: 8px; display: inline-block;">${statusDisplay}</span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; flex-direction: row;">
                      ${!paymentConfirmed ? `
                        <span style="color: #dc3545; font-size: 11px; font-weight: bold; padding: 4px 8px; background: #f8d7da; border-radius: 4px;">
                          ⚠️ Payment Required
                        </span>
                      ` : effectiveStatus === 'pending' ? `
                        <button class="btn btn-primary" onclick="startProcessingTest('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px;">
                          ⚙️ Start
                        </button>
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : effectiveStatus === 'in-process' && !hasResults ? `
                        <button class="btn btn-success" onclick="enterTestResults('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px;">
                          📝 Enter Results
                        </button>
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : effectiveStatus === 'has-results' || (hasResults && testStatus !== 'completed') ? `
                        <button class="btn btn-info" onclick="viewTestResults('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px;">
                          👁️ View Results
                        </button>
                        ${!isReviewed ? `<button class="btn btn-warning" onclick="enterTestResults('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: #f0ad4e; color: white; border: none;" title="Edit result entry (only before doctor review)">✏️ Edit Result Entry</button>` : ''}
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : effectiveStatus === 'completed' ? `
                        <button class="btn btn-info" onclick="viewTestResults('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px;">
                          👁️ View Results
                        </button>
                        ${!isReviewed ? `<button class="btn btn-warning" onclick="enterTestResults('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: #f0ad4e; color: white; border: none;" title="Edit result entry (only before doctor review)">✏️ Edit Result Entry</button>` : ''}
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : `
                        <button class="btn btn-info" onclick="viewTestResults('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px;">
                          👁️ View Results
                        </button>
                        ${!isReviewed ? `<button class="btn btn-warning" onclick="enterTestResults('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: #f0ad4e; color: white; border: none;" title="Edit result entry (only before doctor review)">✏️ Edit Result Entry</button>` : ''}
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      `}
                      ${selectedItems.length > 1 ? `
                        <button class="btn" onclick="removeTestFromLabOrder('${orderIdForTest}', '${safeName}')" style="font-size: 12px; padding: 6px 12px; border: 1px solid #dc3545; color: #dc3545; background: transparent; border-radius: 6px;" title="Remove this test from the order">Remove from order</button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          
          <div class="action-buttons" style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
            ${!paymentConfirmed ? (selectedItems.length > 1 ? `
            <div class="invoice-test-selection" style="width: 100%; margin-bottom: 10px;">
              <strong>Select tests to include in invoice:</strong>
              <div style="max-height: 120px; overflow-y: auto; margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                ${selectedItems.map((test) => {
                  const name = test.name || test;
                  const safeName = (name + '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                  return `<label style="display: block; margin: 4px 0;"><input type="checkbox" class="invoice-test-cb" data-order-id="${order.id}" data-test-name="${safeName}" checked> ${(name + '').replace(/</g, '&lt;')}</label>`;
                }).join('')}
              </div>
              <button class="btn btn-primary" onclick="generateInvoiceForSelectedTests('${order.id}', '${orderIdsForInvoice}')" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; font-weight: bold;">
                💰 Generate Invoice for selected
              </button>
            </div>
            ` : `
            <button class="btn btn-primary" onclick="generateInvoiceFromLabOrder('${orderIdsForInvoice || order.id}')" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; font-weight: bold;">
              💰 Generate Invoice
            </button>
            `) : ''}
            ${hasInvoice && !paymentConfirmed ? `
            <button class="btn btn-warning" onclick="processLabOrderPayment('${order.id}')" style="background: linear-gradient(135deg, #ffc107, #ff9800); color: white; font-weight: bold;">
              💳 Process Payment
            </button>
            <button class="btn btn-danger" onclick="cancelLabOrderInvoice('${order.id}')" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; font-weight: bold;" title="Cancel invoice and reset order to 'Not Invoiced'">
              ❌ Cancel Invoice
            </button>
            ` : ''}
            ${paymentConfirmed ? `
            <button class="btn btn-success" onclick="printLabOrderReceipt('${order.id}')" style="background: linear-gradient(135deg, #17a2b8, #138496); color: white;">
              🧾 Print Receipt
            </button>
            ` : ''}
            <button class="btn btn-secondary" onclick="viewOrderDetails('${order.id}')">
              👁️ View Order Details
            </button>
            ${(order.no_items_checked || (selectedItems.length === 0 && !order.selected_items)) ? `
            <button class="btn" onclick="deleteEmptyOrder('${order.id}', '${order.serial_number || order.id}')" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white;">
              🗑️ Delete Empty Order
            </button>
            ` : ''}
          </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    debugError('Error loading incoming orders:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Load in-process lab orders
async function loadInProcessOrders() {
  const container = document.getElementById('in-process-orders-list');
  container.innerHTML = '<div class="loading">Loading in-process lab orders...</div>';
  
  try {
    const orders = await window.getInProcessLabOrders();
    
    if (orders.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No lab orders in process</h3></div>';
      return;
    }
    
    const patientDataMap = await fetchPatientNamesForOrders(orders);
    const groups = groupOrdersAsOneSend(orders);
    const inProcessContexts = groups.map(function (group) {
      return { group: group, ctx: buildInProcessGroupDisplayContext(group) };
    }).filter(function (item) {
      return item.ctx.inProcessTests.length > 0;
    });
    
    if (inProcessContexts.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No lab orders in process</h3></div>';
      return;
    }
    
    container.innerHTML = inProcessContexts.map(function (item) {
      const group = item.group;
      const selectedItems = item.ctx.selectedItems;
      const inProcessTests = item.ctx.inProcessTests;
      const order = group.primaryOrder;
      const paymentStatus = group.orders[0].payment_status || 'unpaid';
      const hasInvoice = group.orders.some(o => !!o.invoice_id);
      const paymentConfirmed = group.orders.some(o => (o.payment_status === 'paid' || o.payment_status === 'confirmed'));
      const patientData = patientDataMap.get(order.patient_id) || { name: 'Loading...', legacyId: order.patient_id || 'Unknown' };
      const patientName = patientData.name || 'Loading...';
      let displayPatientId = patientData.legacyId || order.patient_id || 'Unknown';
      if (displayPatientId.includes('-') && displayPatientId.length === 36) displayPatientId = 'Unknown';
      const displayPatientIdUi = labDashboardPatientIdUi(patientData, order.patient_id);
      const orderCardId = `order-${order.id}-inprocess`;
      const parsedResults = getParsedResults(order);
      const patientDob = (patientData.dob || '').replace(/"/g, '&quot;');
      const patientKey = ((patientName || '') + '|' + (displayPatientId || '')).toLowerCase().replace(/"/g, '&quot;');
      return `
        <div class="order-card" id="${orderCardId}" data-patient-name="${(patientName || '').replace(/"/g, '&quot;')}" data-patient-id="${(displayPatientId || '').replace(/"/g, '&quot;')}" data-patient-dob="${patientDob}" data-patient-key="${patientKey}">
          <div class="order-header" style="cursor: pointer; user-select: none; padding: 15px; border-bottom: 2px solid #e9ecef;" data-order-card-id="${orderCardId}" title="Click to expand/collapse order details">
            <div class="order-info">
              <h3 style="display: flex; align-items: center; gap: 10px; margin: 0;">
                <span>Lab Order #${ensureLabDisplaySerial(order.serial_number, order.id, order)}${dashboardOrderTestCountLabel(inProcessTests.length)}${group.orderIds.length > 1 ? ' <span style="font-size:12px;color:#6c757d;">(' + group.orderIds.length + ' combined)</span>' : ''}</span>
                <span class="expand-icon" id="${orderCardId}-icon" style="font-size: 14px; transition: transform 0.3s; color: #007bff;">▼</span>
                <span class="expand-label" style="font-size: 12px; color: #6c757d; font-weight: normal;">Click to expand</span>
              </h3>
              <div class="order-meta" style="margin-top: 8px;">
                <strong style="font-size: 14px; color: #007bff;">Patient: ${patientName}</strong><br>
                Patient ID: ${displayPatientIdUi}<br>
                Started: ${order.in_process_at ? new Date(order.in_process_at).toLocaleString() : 'N/A'}<br>
                Payment: <span style="color: ${paymentConfirmed ? '#28a745' : '#dc3545'}; font-weight: bold;">
                  ${paymentConfirmed ? '✅ Paid' : hasInvoice ? '⏳ Pending' : '❌ Not Invoiced'}
                </span>
              </div>
            </div>
            <span class="status-badge status-in-process">In Process</span>
          </div>
          
          <div class="order-details" id="${orderCardId}-details" style="display: none; overflow: hidden; transition: max-height 0.3s ease-out;">
          <div class="tests-list">
            <strong>Lab Tests:</strong>
            ${inProcessTests.map((test, index) => {
              const orderIdForTest = test._orderId || order.id;
              const parsedResults = test._parsedResults || {};
              const testName = test.name || test;
              const testNameStr = String(testName);
              const isPanel = test._isPanel === true && Array.isArray(test._panelSubTests) && test._panelSubTests.length > 0;
              let testResult = getTestResultForDisplay(parsedResults, testNameStr);
              const testResultObj = testResult || {};
              const testStatus = testResultObj.status || 'pending';
              
              // Check if test has results entered (has data beyond just status/metadata)
              // More comprehensive detection: check for entered_at, nested objects with values, and any non-metadata fields
              const metadataFields = ['status', 'entered_at', 'entered_by', 'completed_at', 'completed_by', 'started_at', 'started_by', 'reviewed_at', 'reviewed_by'];
              const isReviewed = !!(testResultObj.reviewed_at && testResultObj.reviewed_by);
              
              // If entered_at exists, results were definitely entered
              const hasEnteredAt = testResultObj && testResultObj.entered_at;
              
              // Check if testResult exists and has any keys beyond metadata
              const hasTestResult = testResultObj && typeof testResultObj === 'object' && Object.keys(testResultObj).length > 0;
              
              // Check for actual result data fields - simplified: if testResult exists and has non-metadata fields, it has results
              let hasResults = false;
              if (hasEnteredAt) {
                hasResults = true;
              } else if (hasTestResult) {
                // Check if there are any non-metadata fields
                const nonMetadataKeys = Object.keys(testResultObj).filter(key => !metadataFields.includes(key));
                if (nonMetadataKeys.length > 0) {
                  // Check if any of these fields have actual data
                  hasResults = nonMetadataKeys.some(key => {
                    const value = testResultObj[key];
                    if (value === null || value === undefined || value === '') return false;
                    if (typeof value === 'string' && value.trim()) return true;
                    if (typeof value === 'boolean') return true; // booleans are valid results
                    if (typeof value === 'number') return true; // numbers are valid results
                    if (Array.isArray(value) && value.length > 0) return true;
                    // Check nested objects - common pattern for lab results (e.g., { abo_group: { value: 'A' } })
                    if (typeof value === 'object' && value !== null) {
                      // If it has a 'value' property with data, it's a result
                      if (value.value !== undefined && value.value !== null && value.value !== '') return true;
                      // If it has any keys, it's likely a result object
                      const nestedKeys = Object.keys(value);
                      if (nestedKeys.length > 0) {
                        // Check if any nested key has actual data
                        return nestedKeys.some(nestedKey => {
                          const nestedValue = value[nestedKey];
                          if (nestedValue === null || nestedValue === undefined || nestedValue === '') return false;
                          if (typeof nestedValue === 'string' && nestedValue.trim()) return true;
                          if (typeof nestedValue === 'boolean') return true;
                          if (typeof nestedValue === 'number') return true;
                          if (typeof nestedValue === 'object' && nestedValue !== null && Object.keys(nestedValue).length > 0) return true;
                          return false;
                        });
                      }
                    }
                    return false;
                  });
                }
              }
              
              // Debug logging (remove in production if needed)
              if (testName === 'C-Reactive Protein (CRP)' || testName === 'Liver Function Test (LFT)') {
                debugLog(`🔍 [RESULT-DETECTION] Test: ${testName}`, {
                  testResult: testResultObj,
                  hasEnteredAt,
                  hasTestResult,
                  hasResults,
                  keys: testResultObj ? Object.keys(testResultObj) : [],
                  nonMetadataKeys: testResultObj ? Object.keys(testResultObj).filter(k => !metadataFields.includes(k)) : []
                });
              }
              
              // Determine effective status: if has results but not completed, show as "has results"
              // This allows user to mark it as completed manually
              const effectiveStatus = testStatus === 'completed' ? 'completed' : 
                                     (hasResults && testStatus !== 'completed') ? 'has-results' : 
                                     testStatus;
              
              const statusClass = effectiveStatus === 'completed' ? 'status-completed' : 
                                 effectiveStatus === 'has-results' ? 'status-has-results' :
                                 effectiveStatus === 'in-process' ? 'status-in-process' : 'status-pending';
              
              const statusDisplay = effectiveStatus === 'has-results' ? 'Results Entered' : 
                                   (effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1));
              
              return `
                <div class="test-item" style="border: 2px solid ${effectiveStatus === 'completed' ? '#28a745' : effectiveStatus === 'has-results' ? '#17a2b8' : effectiveStatus === 'in-process' ? '#ffc107' : '#dc3545'}; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: ${effectiveStatus === 'completed' ? '#d4edda' : effectiveStatus === 'has-results' ? '#d1ecf1' : effectiveStatus === 'in-process' ? '#fff3cd' : '#f8d7da'};">
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="flex: 1; min-width: 0;">
                      <strong>${(testName + '').replace(/</g, '&lt;')}</strong>
                      ${dashboardTestCptSpecimenHtml(test)}
                      <br><span class="status-badge ${statusClass}" style="margin-top: 8px; display: inline-block;">${statusDisplay}</span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; flex-direction: row;">
                      ${!paymentConfirmed ? `
                        <span style="color: #dc3545; font-size: 11px; font-weight: bold; padding: 4px 8px; background: #f8d7da; border-radius: 4px;">
                          ⚠️ Payment Required
                        </span>
                      ` : effectiveStatus === 'pending' ? `
                        <button class="btn btn-primary" onclick="startProcessingTest('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px;">
                          ⚙️ Start
                        </button>
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : effectiveStatus === 'in-process' && !hasResults ? `
                        <button class="btn btn-success" onclick="enterTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px;">
                          📝 Enter Results
                        </button>
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : effectiveStatus === 'has-results' || (hasResults && testStatus !== 'completed') ? `
                        <button class="btn btn-info" onclick="viewTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px;">
                          👁️ View Results
                        </button>
                        ${!isReviewed ? `<button class="btn btn-warning" onclick="enterTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: #f0ad4e; color: white; border: none;" title="Edit result entry (only before doctor review)">✏️ Edit Result Entry</button>` : ''}
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : effectiveStatus === 'completed' ? `
                        <button class="btn btn-info" onclick="viewTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px;">
                          👁️ View Results
                        </button>
                        ${!isReviewed ? `<button class="btn btn-warning" onclick="enterTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: #f0ad4e; color: white; border: none;" title="Edit result entry (only before doctor review)">✏️ Edit Result Entry</button>` : ''}
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      ` : `
                        <button class="btn btn-info" onclick="viewTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px;">
                          👁️ View Results
                        </button>
                        ${!isReviewed ? `<button class="btn btn-warning" onclick="enterTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: #f0ad4e; color: white; border: none;" title="Edit result entry (only before doctor review)">✏️ Edit Result Entry</button>` : ''}
                        <button class="btn btn-success" onclick="markTestCompletedWrapper('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: linear-gradient(135deg, #28a745, #20c997);">
                          ✅ Mark Completed
                        </button>
                      `}
                      ${selectedItems.length > 1 ? `<button class="btn" onclick="removeTestFromLabOrder('${orderIdForTest}', '${(testName + '').replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; border: 1px solid #dc3545; color: #dc3545; background: transparent; border-radius: 6px;" title="Remove this test from the order">Remove from order</button>` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          
          <div class="action-buttons" style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${!paymentConfirmed ? `
            <button class="btn btn-primary" onclick="generateInvoiceFromLabOrder('${order.id}')" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; font-weight: bold;">
              💰 Generate Invoice
            </button>
            ` : ''}
            ${hasInvoice && !paymentConfirmed ? `
            <button class="btn btn-warning" onclick="processLabOrderPayment('${order.id}')" style="background: linear-gradient(135deg, #ffc107, #ff9800); color: white; font-weight: bold;">
              💳 Process Payment
            </button>
            <button class="btn btn-danger" onclick="cancelLabOrderInvoice('${order.id}')" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; font-weight: bold;" title="Cancel invoice and reset order to 'Not Invoiced'">
              ❌ Cancel Invoice
            </button>
            ` : ''}
            ${paymentConfirmed ? `
            <button class="btn btn-primary" onclick="markOrderCompleted('${order.id}')">
              ✅ Mark as Completed
            </button>
            ` : ''}
            ${(order.no_items_checked || (selectedItems.length === 0 && !order.selected_items)) ? `
            <button class="btn" onclick="deleteEmptyOrder('${order.id}', '${order.serial_number || order.id}')" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white;">
              🗑️ Delete Empty Order
            </button>
            ` : ''}
          </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    debugError('Error loading in-process orders:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Load completed lab orders
async function loadCompletedOrders() {
  const container = document.getElementById('completed-orders-list');
  container.innerHTML = '<div class="loading">Loading completed lab orders...</div>';
  
  try {
    const orders = await window.getCompletedLabOrders();
    
    if (orders.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No completed lab orders</h3></div>';
      return;
    }
    
    const patientDataMap = await fetchPatientNamesForOrders(orders);
    const groups = groupOrdersAsOneSend(orders);
    const completedContexts = groups.map(function (group) {
      return { group: group, ctx: buildCompletedGroupDisplayContext(group) };
    }).filter(function (item) {
      return item.ctx.completedForTab.length > 0;
    });
    
    if (completedContexts.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No completed lab orders</h3></div>';
      return;
    }
    
    container.innerHTML = completedContexts.map(function (item) {
      const group = item.group;
      const selectedItems = item.ctx.selectedItems;
      const completedForTab = item.ctx.completedForTab;
      const order = group.primaryOrder;
      const patientData = patientDataMap.get(order.patient_id) || { name: 'Loading...', legacyId: order.patient_id || 'Unknown' };
      const patientName = patientData.name || 'Loading...';
      let displayPatientId = patientData.legacyId || order.patient_id || 'Unknown';
      if (displayPatientId.includes('-') && displayPatientId.length === 36) displayPatientId = 'Unknown';
      const displayPatientIdUi = labDashboardPatientIdUi(patientData, order.patient_id);
      let completedDate = order.completed_at ? new Date(order.completed_at).toLocaleString() : null;
      if (!completedDate || completedDate === 'Invalid Date') {
        let mostRecentDate = null;
        try {
          for (const o of group.orders) {
            const results = typeof o.results === 'string' ? JSON.parse(o.results) : o.results;
            if (results && typeof results === 'object') {
              const items = Array.isArray(o.selected_items) ? o.selected_items : (typeof o.selected_items === 'string' ? JSON.parse(o.selected_items || '[]') : []);
              items.forEach(test => {
                const testName = test.name || test;
                const testResult = results[testName];
                if (testResult && testResult.status === 'completed' && testResult.completed_at) {
                  const testDate = new Date(testResult.completed_at);
                  if (!mostRecentDate || testDate > mostRecentDate) mostRecentDate = testDate;
                }
              });
            }
          }
          if (mostRecentDate) completedDate = mostRecentDate.toLocaleString();
        } catch (e) {}
      }
      const displayDate = completedDate && completedDate !== 'Invalid Date' ? completedDate : 'N/A';
      const orderCardId = `order-${order.id}-completed`;
      const parsedResults = getParsedResults(order);
      const patientDob = (patientData.dob || '').replace(/"/g, '&quot;');
      const patientKey = ((patientName || '') + '|' + (displayPatientId || '')).toLowerCase().replace(/"/g, '&quot;');
      return `
        <div class="order-card" id="${orderCardId}" data-patient-name="${(patientName || '').replace(/"/g, '&quot;')}" data-patient-id="${(displayPatientId || '').replace(/"/g, '&quot;')}" data-patient-dob="${patientDob}" data-patient-key="${patientKey}">
          <div class="order-header" style="cursor: pointer; user-select: none; padding: 15px; border-bottom: 2px solid #e9ecef;" data-order-card-id="${orderCardId}" title="Click to expand/collapse order details">
            <div class="order-info">
              <h3 style="display: flex; align-items: center; gap: 10px; margin: 0;">
                <span>Lab Order #${ensureLabDisplaySerial(order.serial_number, order.id, order)}${dashboardOrderTestCountLabel(completedForTab.length)}${group.orderIds.length > 1 ? ' <span style="font-size:12px;color:#6c757d;">(' + group.orderIds.length + ' combined)</span>' : ''}</span>
                <span class="expand-icon" id="${orderCardId}-icon" style="font-size: 14px; transition: transform 0.3s; color: #007bff;">▼</span>
                <span class="expand-label" style="font-size: 12px; color: #6c757d; font-weight: normal;">Click to expand</span>
              </h3>
              <div class="order-meta" style="margin-top: 8px;">
                <strong style="font-size: 14px; color: #007bff;">Patient: ${patientName}</strong><br>
                Patient ID: ${displayPatientIdUi}<br>
                Completed: ${displayDate}
              </div>
            </div>
            <span class="status-badge status-completed">Completed</span>
          </div>
          
          <div class="order-details" id="${orderCardId}-details" style="display: none; overflow: hidden; transition: max-height 0.3s ease-out;">
          <div class="tests-list">
            <strong>Lab Tests:</strong>
            ${completedForTab.map(test => {
              const orderIdForTest = test._orderId || order.id;
              const parsedResults = test._parsedResults || {};
              const testName = test.name || test;
              const testNameStr = String(testName);
              let testResults = getTestResultForDisplay(parsedResults, testNameStr);
              
              // Determine test status (should always be completed here since we filtered)
              const testStatus = testResults?.status || 'pending';
              const testStatusLower = String(testStatus).toLowerCase();
              const isCompleted = testStatus === 'completed' || testStatusLower === 'completed';
              const isInProcess = testStatus === 'in-process' || testStatusLower === 'in-process' || testStatusLower === 'in process' || testStatusLower === 'in_progress';
              const isReviewed = !!(testResults && testResults.reviewed_at && testResults.reviewed_by);
              
              // Status badge styling
              let statusBadge = '';
              let statusClass = 'status-pending';
              if (isCompleted) {
                statusBadge = '<span class="status-badge status-completed" style="margin-top: 8px; display: inline-block;">Completed</span>';
                statusClass = 'status-completed';
              } else if (isInProcess) {
                statusBadge = '<span class="status-badge status-in-process" style="margin-top: 8px; display: inline-block;">In Process</span>';
                statusClass = 'status-in-process';
              } else {
                statusBadge = '<span class="status-badge status-pending" style="margin-top: 8px; display: inline-block;">Pending</span>';
                statusClass = 'status-pending';
              }
              
              // Card background color based on status
              let cardBg = '#f8f9fa';
              let cardBorder = '#dee2e6';
              if (isCompleted) {
                cardBg = '#d4edda';
                cardBorder = '#28a745';
              } else if (isInProcess) {
                cardBg = '#fff3cd';
                cardBorder = '#ffc107';
              }
              
              const removeBtn = selectedItems.length > 1
                ? `<button class="btn" onclick="removeTestFromLabOrder('${orderIdForTest}', '${(testName + '').replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; border: 1px solid #dc3545; color: #dc3545; background: transparent; border-radius: 6px;" title="Remove this test from the order">Remove from order</button>`
                : '';
              return `
              <div class="test-item" style="border: 2px solid ${cardBorder}; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: ${cardBg};">
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div style="flex: 1; min-width: 0;">
                    <strong>${(testName + '').replace(/</g, '&lt;')}</strong>
                    ${dashboardTestCptSpecimenHtml(test)}
                    <br>${statusBadge}
                  </div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    ${testResults ? `<button class="btn btn-info" onclick="viewTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px;">👁️ View Results</button>` : ''}
                    ${testResults && !isReviewed ? `<button class="btn btn-warning" onclick="enterTestResults('${orderIdForTest}', '${testName.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 6px 12px; background: #f0ad4e; color: white; border: none;" title="Edit result entry (only before doctor review)">✏️ Edit Result Entry</button>` : ''}
                    ${removeBtn}
                  </div>
                </div>
              </div>
            `;
            }).join('')}
          </div>
          
          <div class="action-buttons">
            <button class="btn btn-secondary" onclick="viewOrderResults('${order.id}')">
              👁️ View Results
            </button>
            ${(order.no_items_checked || (selectedItems.length === 0 && !order.selected_items)) ? `
            <button class="btn" onclick="deleteEmptyOrder('${order.id}', '${order.serial_number || order.id}')" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; margin-left: 10px;">
              🗑️ Delete Empty Order
            </button>
            ` : ''}
          </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    debugError('Error loading completed orders:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Start processing an order
// DEPRECATED: Use startProcessingTest for individual tests instead
async function startProcessingOrder(orderId) {
  try {
    await window.markLabOrderInProcess(orderId);
    await loadDashboard();
    alert('Order marked as in-process');
  } catch (error) {
    debugError('Error starting processing:', error);
    alert('Error: ' + error.message);
  }
}

// Mark individual test as completed (wrapper function)
// Store reference to original function from lab-results-manager.js
const originalMarkTestCompleted = window.markTestCompleted;

async function markTestCompletedWrapper(orderId, testName) {
  try {
    debugLog(`🔍 [DASHBOARD] markTestCompletedWrapper called for order ${orderId}, test: ${testName}`);
    if (typeof originalMarkTestCompleted === 'function') {
      const out = await originalMarkTestCompleted(orderId, testName);
      if (out && out.success === false) return;
    } else {
      throw new Error('markTestCompleted function not available');
    }
    // Reload all tabs to reflect changes
    await loadIncomingOrders();
    await loadInProcessOrders();
    await loadCompletedOrders();
    await loadDashboard();
    // Restore expanded state after reload
    setTimeout(restoreExpandedState, 150);
    debugLog(`✅ [DASHBOARD] Test ${testName} marked as completed, dashboard reloaded`);
  } catch (error) {
    debugError('Error marking test as completed:', error);
    alert('Error: ' + error.message);
  }
}

// Override window.markTestCompleted with our wrapper
window.markTestCompleted = markTestCompletedWrapper;

// Generate invoice for scientist-selected subset of tests (single order or grouped orders)
window.generateInvoiceForSelectedTests = async function(orderId, orderIdsComma) {
  const primaryId = (orderIdsComma && orderIdsComma.trim()) ? orderIdsComma.split(',')[0].trim() : orderId;
  // Order cards use ids: order-{id}-incoming, order-{id}-inprocess, or order-{id}-completed (not order-{id})
  const card = document.getElementById('order-' + primaryId) ||
    document.getElementById('order-' + primaryId + '-incoming') ||
    document.getElementById('order-' + primaryId + '-inprocess') ||
    document.getElementById('order-' + primaryId + '-completed') ||
    document.querySelector('.order-card[id*="' + primaryId + '"]');
  if (!card) {
    alert('Order card not found.');
    return;
  }
  const checked = card.querySelectorAll('.invoice-test-cb:checked');
  const selectedNames = new Set(Array.from(checked).map(cb => (cb.getAttribute('data-test-name') || '').trim()).filter(Boolean));
  if (selectedNames.size === 0) {
    alert('Select at least one test to include in the invoice.');
    return;
  }
  const supabase = await window.getLabSupabaseClient();
  if (!supabase) {
    alert('Connection not available.');
    return;
  }
  const ids = orderIdsComma && orderIdsComma.trim() ? orderIdsComma.split(',').map(id => id.trim()).filter(Boolean) : [orderId];
  const { data: orders, error } = await supabase.from('orders').select('*').eq('type', 'lab').in('id', ids);
  if (error || !orders || orders.length === 0) {
    alert('Order(s) not found.');
    return;
  }
  // Build items using the SAME collapse as the UI (getDisplayItemsForOrder) so checkbox names match.
  // Otherwise raw selected_items may have 10 sub-test names while checkboxes show 2 panel names → no match.
  let items = [];
  for (const order of orders) {
    const displayItems = getDisplayItemsForOrder(order);
    displayItems.forEach(function (di) {
      const name = (di && di.name) || '';
      if (name) items.push({ name: name, cpt: di.cpt, _orderId: di._orderId });
    });
  }
  const filtered = items.filter(test => {
    const name = (test && (test.name ?? test)) ? String(test.name || test).trim() : '';
    if (!name) return false;
    return selectedNames.has(name) || Array.from(selectedNames).some(s => s.toLowerCase() === name.toLowerCase());
  });
  if (filtered.length === 0) {
    alert('No matching tests found. Please ensure the selected tests belong to this order.');
    return;
  }
  const orderIdArg = ids.length > 1 ? ids.join(',') : orderId;
  await window.generateInvoiceFromLabOrder(orderIdArg, filtered);
};

// Track recent toggles to prevent double-toggling from multiple handlers
window._recentToggles = window._recentToggles || {};

// Toggle order details expand/collapse - make globally accessible
// This function MUST work reliably for ALL orders, regardless of tab or order number
// Made idempotent to prevent double-toggling from multiple event handlers
window.toggleOrderDetails = function(orderCardId) {
  // Ensure orderCardId is a string
  orderCardId = String(orderCardId);
  
  // Prevent rapid double-toggling (within 100ms)
  const now = Date.now();
  const lastToggle = window._recentToggles[orderCardId];
  if (lastToggle && (now - lastToggle) < 100) {
    debugLog(`⏭️ [TOGGLE] Skipping duplicate toggle for ${orderCardId} (${now - lastToggle}ms ago)`);
    return;
  }
  window._recentToggles[orderCardId] = now;
  
  debugLog(`🔍 [TOGGLE] Called with orderCardId: "${orderCardId}"`);
  
  // Find elements - try multiple selectors to ensure we find them
  let detailsDiv = document.getElementById(`${orderCardId}-details`);
  let iconSpan = document.getElementById(`${orderCardId}-icon`);
  
  debugLog(`🔍 [TOGGLE] Initial search:`, {
    detailsDiv: !!detailsDiv,
    iconSpan: !!iconSpan,
    detailsId: `${orderCardId}-details`,
    iconId: `${orderCardId}-icon`
  });
  
  // If not found by ID, try finding by order card
  if (!detailsDiv || !iconSpan) {
    const orderCard = document.getElementById(orderCardId);
    debugLog(`🔍 [TOGGLE] Searching in order card:`, {
      orderCard: !!orderCard,
      orderCardId: orderCardId
    });
    
    if (orderCard) {
      if (!detailsDiv) {
        detailsDiv = orderCard.querySelector(`#${orderCardId}-details`) || orderCard.querySelector('.order-details');
      }
      if (!iconSpan) {
        iconSpan = orderCard.querySelector(`#${orderCardId}-icon`) || orderCard.querySelector('.expand-icon');
      }
    }
  }
  
  // Final check - if still not found, log error and return
  if (!detailsDiv) {
    debugError('❌ [TOGGLE] Details div not found for:', orderCardId);
    const allOrderCards = Array.from(document.querySelectorAll('.order-card'));
    debugError('Available order cards:', allOrderCards.map(c => ({
      id: c.id,
      hasDetails: !!c.querySelector('.order-details'),
      hasIcon: !!c.querySelector('.expand-icon')
    })));
    return;
  }
  
  if (!iconSpan) {
    debugError('❌ [TOGGLE] Icon span not found for:', orderCardId);
    return;
  }
  
  // Determine current state - check both style.display and computed style
  const currentDisplay = detailsDiv.style.display;
  const computedDisplay = window.getComputedStyle(detailsDiv).display;
  const isExpanded = currentDisplay !== 'none' && currentDisplay !== '' && computedDisplay !== 'none';
  
  debugLog(`🔍 [TOGGLE] Current state:`, {
    currentDisplay,
    computedDisplay,
    isExpanded
  });
  
  // Find expand label
  const expandLabel = iconSpan.parentElement ? iconSpan.parentElement.querySelector('.expand-label') : null;
  
  if (isExpanded) {
    // Collapse
    debugLog(`🔽 [TOGGLE] Collapsing ${orderCardId}`);
    detailsDiv.style.display = 'none';
    detailsDiv.style.visibility = 'hidden';
    iconSpan.textContent = '▼';
    iconSpan.style.transform = 'rotate(0deg)';
    if (expandLabel) {
      expandLabel.textContent = 'Click to expand';
    }
    window.expandedOrderIds.delete(orderCardId);
  } else {
    // Expand - use multiple methods to ensure visibility
    debugLog(`🔼 [TOGGLE] Expanding ${orderCardId}`);
    
    // Check if content exists
    const hasContent = detailsDiv.children.length > 0 || detailsDiv.textContent.trim().length > 0;
    debugLog(`🔍 [TOGGLE] Content check for ${orderCardId}:`, {
      hasContent,
      childrenCount: detailsDiv.children.length,
      textLength: detailsDiv.textContent.trim().length,
      innerHTML: detailsDiv.innerHTML.substring(0, 100)
    });
    
    // Force display with multiple methods
    detailsDiv.style.display = 'block';
    detailsDiv.style.visibility = 'visible';
    detailsDiv.style.opacity = '1';
    detailsDiv.removeAttribute('hidden');
    
    // Force a reflow to ensure browser applies styles
    void detailsDiv.offsetHeight;
    
    iconSpan.textContent = '▲';
    iconSpan.style.transform = 'rotate(180deg)';
    if (expandLabel) {
      expandLabel.textContent = 'Click to collapse';
    }
    window.expandedOrderIds.add(orderCardId);
    
    // Verify it's actually visible
    setTimeout(() => {
      const computedDisplay = window.getComputedStyle(detailsDiv).display;
      const computedVisibility = window.getComputedStyle(detailsDiv).visibility;
      debugLog(`🔍 [TOGGLE] Verification for ${orderCardId}:`, {
        computedDisplay,
        computedVisibility,
        inlineDisplay: detailsDiv.style.display,
        inlineVisibility: detailsDiv.style.visibility,
        isVisible: computedDisplay !== 'none' && computedVisibility !== 'hidden'
      });
      
      if (computedDisplay === 'none' || computedVisibility === 'hidden') {
        debugError(`❌ [TOGGLE] ${orderCardId} is still hidden after expansion! Applying !important fix.`);
        detailsDiv.style.setProperty('display', 'block', 'important');
        detailsDiv.style.setProperty('visibility', 'visible', 'important');
      }
    }, 50);
  }
  
  debugLog(`✅ [TOGGLE] Successfully toggled ${orderCardId}`);
};

// Add robust event delegation for ALL order headers across ALL tabs
// This ensures expand/collapse ALWAYS works, even if onclick handlers fail
document.addEventListener('click', function(event) {
  // Check if click is on an order header or any element within it
  const orderHeader = event.target.closest('.order-header');
  
  if (orderHeader) {
    // Don't interfere with buttons or links
    const clickedElement = event.target;
    const isButton = clickedElement.tagName === 'BUTTON' || clickedElement.closest('button');
    const isLink = clickedElement.tagName === 'A' || clickedElement.closest('a');
    
    if (!isButton && !isLink) {
      // Find the order card
      const orderCard = orderHeader.closest('.order-card');
      
      if (orderCard && orderCard.id) {
        const orderCardId = orderCard.id;
        
        // Always trigger toggle - the function itself will handle state correctly
        // This ensures it works even if onclick handler is missing or broken
        debugLog(`🔄 [DELEGATION] Click detected on order header, toggling ${orderCardId}`);
        window.toggleOrderDetails(orderCardId);
      }
    }
  }
}, true); // Use capture phase to ensure we catch it

// Mark order as completed
async function markOrderCompleted(orderId) {
  try {
    await window.markLabOrderCompleted(orderId);
    await loadDashboard();
    alert('Order marked as completed');
  } catch (error) {
    debugError('Error marking order as completed:', error);
    alert('Error: ' + error.message);
  }
}

// Enter lab results
function enterLabResults(orderId, testName) {
  window.location.href = `/lab-result-entry?orderId=${encodeURIComponent(orderId)}&testName=${encodeURIComponent(testName)}`;
}

// View order details - Updated to use generateLabOrderHTML
async function viewOrderDetails(orderId) {
  try {
    // Show loading indicator
    const loadingModal = createLoadingModal('Loading order details...');
    
    // Get Supabase client
    const supabase = await window.getLabSupabaseClient();
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    // Fetch order from Supabase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    
    if (orderError || !order) {
      throw new Error(orderError?.message || 'Order not found');
    }
    
    // Resolve patient
    let patient = null;
    if (order.patient_id && typeof window.resolvePatientByIdentifier === 'function') {
      patient = await window.resolvePatientByIdentifier(order.patient_id);
    }
    
    if (!patient) {
      throw new Error('Patient not found for this order');
    }
    
    // Get user info - try to get the user who created the order
    let user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // If order has created_by, try to fetch that user's info
    if (order.created_by && supabase) {
      try {
        const { data: orderUser } = await supabase
          .from('users')
          .select('*')
          .eq('username', order.created_by)
          .maybeSingle();
        if (orderUser) {
          user = orderUser;
        }
      } catch (e) {
        debugWarn('Could not fetch order creator user info:', e);
      }
    }
    
    // Fetch organization details from Supabase
    const orgId = order.organization_id || user.organizationId || user.organization_id || user.orgId;
    let orgData = null;
    
    if (orgId && supabase) {
      try {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('name, address_line1, address_line2, city, state, country, phone')
          .eq('id', orgId)
          .maybeSingle();
        
        if (!orgError && org) {
          orgData = org;
        }
      } catch (e) {
        debugWarn('Could not fetch organization details:', e);
      }
    }
    
    // Fallback: try to get org data from localStorage organizations
    if (!orgData) {
      try {
        const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
        const orgName = user.org || (orgId ? Object.values(organizations).find(o => o.id === orgId)?.name : null);
        if (orgName && organizations[orgName]) {
          orgData = organizations[orgName];
        }
      } catch (e) {
        debugWarn('Could not get organization from localStorage:', e);
      }
    }
    
    // Get visit date from order
    const visitDate = order.visit_date || new Date().toISOString().split('T')[0];
    
    // Transform order to match expected format for generateLabOrderHTML
    // Handle selected_items (JSONB) -> selectedItems (array)
    // IMPORTANT: Extract test names from objects if needed
    let selectedItems = [];
    if (Array.isArray(order.selected_items)) {
      selectedItems = order.selected_items.map(item => {
        // If item is an object, extract the name
        if (typeof item === 'object' && item !== null) {
          return item.name || item.testName || item.test_name || item;
        }
        return item; // Already a string
      });
    } else if (typeof order.selected_items === 'string') {
      try {
        const parsed = JSON.parse(order.selected_items || '[]');
        selectedItems = Array.isArray(parsed) ? parsed.map(item => {
          if (typeof item === 'object' && item !== null) {
            return item.name || item.testName || item.test_name || item;
          }
          return item;
        }) : [];
      } catch (e) {
        selectedItems = [];
      }
    }
    
    const transformedOrder = {
      ...order,
      selectedItems: selectedItems,
      noItemsChecked: order.no_items_checked || false,
      timestamp: order.created_at || order.timestamp || new Date().toISOString()
    };
    
    // Normalize patient data format
    const normalizedPatient = {
      firstName: patient.first_name || patient.firstName || '',
      middleName: patient.middle_name || patient.middleName || '',
      lastName: patient.last_name || patient.lastName || '',
      dob: patient.dob || patient.date_of_birth || 'N/A',
      gender: patient.gender || 'N/A',
      phone: patient.phone || patient.phone_number || 'N/A',
      email: patient.email || 'N/A',
      addressLine1: patient.address_line1 || patient.addressLine1 || '',
      addressLine2: patient.address_line2 || patient.addressLine2 || '',
      city: patient.city || '',
      state: patient.state || '',
      country: patient.country || ''
    };
    
    // Normalize user data format
    // Use organization data from Supabase if available, otherwise fallback to user object
    const normalizedUser = {
      firstName: user.first_name || user.firstName || user.username || 'Unknown',
      lastName: user.last_name || user.lastName || '',
      role: user.role || 'Unknown',
      medicalLicenseNumber: user.medical_license_number || user.medicalLicenseNumber || 'N/A',
      org: orgData?.name || user.org || user.organization_name || 'N/A',
      orgAddressLine1: orgData?.address_line1 || user.org_address_line1 || user.orgAddressLine1 || '',
      orgAddressLine2: orgData?.address_line2 || user.org_address_line2 || user.orgAddressLine2 || '',
      orgCity: orgData?.city || user.org_city || user.orgCity || '',
      orgState: orgData?.state || user.org_state || user.orgState || '',
      orgCountry: orgData?.country || user.org_country || user.orgCountry || ''
    };
    
    // Remove loading modal
    if (loadingModal) {
      loadingModal.remove();
    }
    
    // Generate and display order details in a printable HTML page
    await openLabOrderDetailsPage(transformedOrder, normalizedPatient, normalizedUser, visitDate);
  } catch (error) {
    debugError('Error loading order details:', error);
    alert('Error loading order details: ' + (error.message || 'Unknown error'));
    
    // Remove loading modal if it exists
    const loadingModal = document.getElementById('loading-order-modal');
    if (loadingModal) {
      loadingModal.remove();
    }
  }
}

// Create loading modal
function createLoadingModal(message) {
  const existing = document.getElementById('loading-order-modal');
  if (existing) {
    existing.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'loading-order-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 8px; text-align: center;">
      <div style="margin-bottom: 15px;">
        <div style="border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
      </div>
      <p style="margin: 0; color: #333;">${message}</p>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

// Fallback function to generate order HTML if generateLabOrderHTML is not available
function generateFallbackOrderHTML(order, patient, user, visitDate, orderedByLine, orgLine) {
  let selectedItems =
    typeof window.mfNormalizeOrderSelectedItems === 'function'
      ? window.mfNormalizeOrderSelectedItems(order)
      : [];
  if (!selectedItems.length) {
    if (Array.isArray(order.selectedItems)) {
      selectedItems = order.selectedItems;
    } else if (Array.isArray(order.selected_items)) {
      selectedItems = order.selected_items;
    } else if (typeof order.selected_items === 'string') {
      try {
        selectedItems = JSON.parse(order.selected_items);
      } catch (e) {
        selectedItems = [];
      }
    }
    if (!Array.isArray(selectedItems)) selectedItems = [];
  }
  
  let tableRows = '';
  if (order.noItemsChecked || order.no_items_checked) {
    tableRows = '<tr><td colspan="6" style="border: 1px solid #ddd; padding: 12px; text-align: center; font-style: italic; color: #666;">No lab tests required</td></tr>';
  } else if (selectedItems.length > 0) {
    selectedItems.forEach(item => {
      const row =
        typeof window.mfMergeLabOrderItemWithCatalog === 'function'
          ? window.mfMergeLabOrderItemWithCatalog(item)
          : null;
      const testNameStr =
        typeof item === 'object' && item !== null
          ? item.name || item.testName || JSON.stringify(item)
          : item;
      if (row && row.name) {
        tableRows += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;">${row.name}</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${row.cpt || 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${row.specimen || 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${row.container || 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${row.transport || 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 12px;">${row.notes || 'N/A'}</td>
          </tr>
        `;
      } else {
        tableRows += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 12px;">${testNameStr}</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">N/A</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">N/A</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">N/A</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">N/A</td>
            <td style="border: 1px solid #ddd; padding: 12px;">N/A</td>
          </tr>
        `;
      }
    });
  } else {
    tableRows = '<tr><td colspan="6" style="border: 1px solid #ddd; padding: 12px; text-align: center; font-style: italic; color: #666;">No items selected</td></tr>';
  }
  
  const ob =
    orderedByLine != null && orderedByLine !== ''
      ? orderedByLine
      : order && (order.created_by || order.createdBy)
        ? String(order.created_by || order.createdBy)
        : `${user.firstName || ''} ${user.lastName || ''} (${user.role || 'N/A'}), Medical License: ${
            user.medicalLicenseNumber || 'N/A'
          }`;
  const og =
    orgLine != null && orgLine !== ''
      ? orgLine
      : `${user.org || 'N/A'}, Address: ${user.orgAddressLine1 || ''} ${user.orgAddressLine2 || ''}, ${user.orgCity || ''}, ${
          user.orgState || ''
        }, ${user.orgCountry || ''}`;

  return `
    <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
      <p><strong>Patient:</strong> ${patient.firstName} ${patient.middleName || ''} ${patient.lastName}</p>
      <p><strong>DOB:</strong> ${patient.dob} | <strong>Gender:</strong> ${patient.gender} | <strong>Phone:</strong> ${patient.phone} | <strong>Email:</strong> ${patient.email || 'N/A'}</p>
      <p><strong>Address:</strong> ${patient.addressLine1} ${patient.addressLine2 || ''}, ${patient.city}, ${patient.state}, ${patient.country}</p>
      <p><strong>Visit Date:</strong> ${visitDate}</p>
      <p><strong>Ordered By:</strong> ${ob}</p>
      <p><strong>Organization:</strong> ${og}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #4CAF50; color: white;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Test Name</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">CPT Code(s)</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Specimen Type/Volume</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Container</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Transport/Stability</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Notes/Reflex</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    
    <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Generated on ${new Date(order.timestamp).toLocaleString()}</p>
    </div>
  `;
}

// Open lab order details in a printable HTML page
async function openLabOrderDetailsPage(order, patient, user, visitDate) {
  let orderHTML = '';
  const supabase =
    (typeof window.getLabSupabaseClient === 'function' ? await window.getLabSupabaseClient() : null) ||
    window.supabaseClient;
  let orderedByLine = '';
  let orgLine = '';
  if (typeof window.mfResolveOrderedByLineForOrder === 'function') {
    orderedByLine = await window.mfResolveOrderedByLineForOrder(supabase, order, user);
  }
  if (typeof window.mfResolveOrganizationDisplayLineForOrder === 'function') {
    orgLine = await window.mfResolveOrganizationDisplayLineForOrder(supabase, order, user);
  }

  if (typeof window.generateLabOrderHTML === 'function') {
    orderHTML = window.generateLabOrderHTML(order, patient, user, visitDate, orderedByLine, orgLine);
  } else {
    debugWarn('⚠️ generateLabOrderHTML not available, using fallback HTML generation');
    orderHTML = generateFallbackOrderHTML(order, patient, user, visitDate, orderedByLine, orgLine);
  }
  
  // Format serial number for display
  const serialNumber = ensureLabDisplaySerial(order.serial_number, order.id, order);
  
  // Create printable HTML page
  const printableHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lab Order Details - ${serialNumber}</title>
  <style>
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .print-break {
        page-break-after: always;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #4CAF50;
    }
    .header h1 {
      margin: 0;
      color: #333;
      font-size: 28px;
    }
    .serial-number {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 16px;
      font-weight: bold;
    }
    .order-modal-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .order-modal-table th {
      background-color: #4CAF50;
      color: white;
      padding: 12px;
      text-align: left;
      border: 1px solid #ddd;
    }
    .order-modal-table th.order-th-center {
      text-align: center;
    }
    .order-modal-table td {
      padding: 12px;
      border: 1px solid #ddd;
    }
    .order-modal-table td.order-td-center {
      text-align: center;
    }
    .order-modal-table td.order-td-left {
      text-align: left;
    }
    .actions {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e9ecef;
      text-align: center;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      margin: 0 10px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover {
      background: #0056b3;
    }
    .btn-print {
      background: #28a745;
    }
    .btn-print:hover {
      background: #218838;
    }
    .btn-close {
      background: #dc3545;
    }
    .btn-close:hover {
      background: #c82333;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔬 Lab Order Details</h1>
      <div class="no-print">
        <button class="btn btn-print" onclick="window.print()">🖨️ Print</button>
        <button class="btn btn-close" onclick="window.close()">✕ Close</button>
      </div>
    </div>
    
    <div class="serial-number">
      <strong>Order Serial Number:</strong> ${serialNumber}
    </div>
    
    ${orderHTML}
    
    <div class="actions no-print">
      <button class="btn btn-print" onclick="window.print()">🖨️ Print Order</button>
      <button class="btn btn-close" onclick="window.close()">✕ Close</button>
    </div>
  </div>
</body>
</html>
  `;
  
  // Open in new window
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (printWindow) {
    printWindow.document.write(printableHTML);
    printWindow.document.close();
    
    // Focus the window
    printWindow.focus();
  } else {
    // Fallback: if popup blocked, show alert
    alert('Please allow popups to view order details, or check your browser settings.');
  }
}

// View order results
function viewOrderResults(orderId) {
  window.location.href = `/lab-result-entry?orderId=${encodeURIComponent(orderId)}&view=true`;
}

// Schedule Lab Appointment - Navigate to add-appointment with Lab Intervention type pre-selected
window.scheduleLabAppointment = function() {
  // Navigate to add-appointment page
  // The appointment type will be handled by the form loading logic
  window.location.href = '/add-appointment?appointmentType=lab-intervention';
};

// Delete empty order (soft delete)
async function deleteEmptyOrder(orderId, serialNumber) {
  if (!confirm(`Are you sure you want to delete empty order ${serialNumber}?`)) {
    return;
  }
  
  try {
    const supabase = await window.getLabSupabaseClient();
    if (!supabase) {
      throw new Error('Database connection not available');
    }
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const deletedBy = user.username || user.email || user.id || 'system';
    
    // Soft delete: set deleted_at timestamp
    const { error } = await supabase
      .from('orders')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy
      })
      .eq('id', orderId);
    
    if (error) {
      throw error;
    }
    
    // Refresh dashboard
    await loadDashboard();
    
    if (typeof window.showSuccessNotification === 'function') {
      window.showSuccessNotification('Empty order deleted successfully');
    } else {
      alert('Empty order deleted successfully');
    }
  } catch (error) {
    debugError('Error deleting empty order:', error);
    alert('Error deleting order: ' + (error.message || 'Unknown error'));
  }
}

// Make deleteEmptyOrder available globally
window.deleteEmptyOrder = deleteEmptyOrder;

// Remove a single test from a lab order (updates selected_items in Supabase; reflects on dashboard)
window.removeTestFromLabOrder = async function(orderId, testName) {
  if (!orderId || !testName) return;
  if (!confirm(`Remove "${testName}" from this order? This will update the order and cannot be undone.`)) return;
  try {
    const supabase = await window.getLabSupabaseClient();
    if (!supabase) {
      alert('Database connection not available.');
      return;
    }
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, selected_items')
      .eq('id', orderId)
      .eq('type', 'lab')
      .single();
    if (fetchErr || !order) {
      alert('Order not found.');
      return;
    }
    let items = order.selected_items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    if (!Array.isArray(items)) items = [];
    const testNameStr = String(testName).trim();
    const before = items.length;
    const updated = items.filter(item => {
      const name = (item && (item.name || item)) ? String(item.name || item).trim() : '';
      return name !== testNameStr && name.toLowerCase() !== testNameStr.toLowerCase();
    });
    if (updated.length === before) {
      alert('Test not found in this order.');
      return;
    }
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        selected_items: updated,
        no_items_checked: updated.length === 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
    if (updateErr) {
      alert('Failed to update order: ' + (updateErr.message || 'Unknown error'));
      return;
    }
    if (typeof loadDashboard === 'function') {
      await loadDashboard();
    } else if (typeof loadIncomingOrders === 'function') {
      await loadIncomingOrders();
    }
    if (typeof window.showSuccessNotification === 'function') {
      window.showSuccessNotification('Test removed from order');
    } else {
      alert('Test removed from order.');
    }
  } catch (e) {
    console.error('removeTestFromLabOrder:', e);
    alert('Error: ' + (e.message || 'Unknown error'));
  }
};

