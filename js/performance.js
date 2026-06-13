// Purpose: Performance optimization module for MediForge
// Implements lazy loading, data indexing, and code splitting for better scalability

// Fallback for getDataKey if not defined
if (typeof window.getDataKey === 'undefined') {
  window.getDataKey = function(key) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.org ? `${user.org}_${key}` : key;
  };
}

// Performance configuration
const PERF_CONFIG = {
  patientsPerPage: 50,
  enableLazyLoading: true,
  enableIndexing: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes cache
  virtualScrollThreshold: 100 // Use virtual scroll for lists > 100 items
};

// In-memory cache for frequently accessed data
const dataCache = {
  patients: null,
  patientIndex: null,
  appointments: null,
  cacheTimestamp: null
};

// Clear cache
function clearCache() {
  dataCache.patients = null;
  dataCache.patientIndex = null;
  dataCache.appointments = null;
  dataCache.cacheTimestamp = null;
  console.log('Performance cache cleared');
}

// Check if cache is still valid
function isCacheValid() {
  if (!dataCache.cacheTimestamp) return false;
  return (Date.now() - dataCache.cacheTimestamp) < PERF_CONFIG.cacheTimeout;
}

// Build patient index for O(1) lookups
window.buildPatientIndex = function() {
  console.log('Building patient index...');
  const start = performance.now();
  
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const index = {
    byId: {},
    byName: {},
    byDOB: {},
    count: patients.length
  };
  
  patients.forEach((patient, i) => {
    // Index by ID
    index.byId[patient.id] = i;
    
    // Index by full name
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    if (!index.byName[fullName]) {
      index.byName[fullName] = [];
    }
    index.byName[fullName].push(i);
    
    // Index by DOB
    if (patient.dob) {
      if (!index.byDOB[patient.dob]) {
        index.byDOB[patient.dob] = [];
      }
      index.byDOB[patient.dob].push(i);
    }
  });
  
  const end = performance.now();
  console.log(`Patient index built in ${(end - start).toFixed(2)}ms for ${patients.length} patients`);
  
  // Store index
  localStorage.setItem(getDataKey("patientIndex"), JSON.stringify(index));
  dataCache.patientIndex = index;
  
  return index;
};

// Get patient by ID using index (much faster than array.find())
window.getPatientByIdFast = function(patientId) {
  let index = dataCache.patientIndex;
  
  // Build index if not exists
  if (!index || !isCacheValid()) {
    index = buildPatientIndex();
  }
  
  const position = index.byId[patientId];
  
  if (position !== undefined) {
    let patients = dataCache.patients;
    if (!patients || !isCacheValid()) {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      dataCache.patients = patients;
      dataCache.cacheTimestamp = Date.now();
    }
    return patients[position];
  }
  
  return null;
};

// Lazy load patients with pagination
window.loadPatientsLazy = function(page = 1, pageSize = PERF_CONFIG.patientsPerPage, searchQuery = '') {
  const start = performance.now();
  
  let patients = dataCache.patients;
  if (!patients || !isCacheValid()) {
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    dataCache.patients = patients;
    dataCache.cacheTimestamp = Date.now();
  }
  
  // Apply search filter if provided
  let filtered = patients;
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = patients.filter(p => {
      const name = `${p.firstName} ${p.lastName}`.toLowerCase();
      const id = p.id.toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      return name.includes(query) || id.includes(query) || phone.includes(query);
    });
  }
  
  // Calculate pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const pageData = filtered.slice(startIndex, endIndex);
  
  const end = performance.now();
  console.log(`Loaded page ${page} (${pageData.length} patients) in ${(end - start).toFixed(2)}ms`);
  
  return {
    data: pageData,
    page: page,
    pageSize: pageSize,
    totalPages: totalPages,
    totalRecords: filtered.length,
    hasNext: page < totalPages,
    hasPrevious: page > 1
  };
};

// Debounce function for search input
window.debounce = function(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Optimize large array operations
window.optimizedFilter = function(array, predicate) {
  // Use native filter for small arrays
  if (array.length < 1000) {
    return array.filter(predicate);
  }
  
  // Use manual loop for large arrays (slightly faster)
  const result = [];
  for (let i = 0; i < array.length; i++) {
    if (predicate(array[i], i, array)) {
      result.push(array[i]);
    }
  }
  return result;
};

// Virtual scrolling for large lists
window.createVirtualScroll = function(container, data, renderItem, rowHeight = 60) {
  if (data.length < PERF_CONFIG.virtualScrollThreshold) {
    // Use normal rendering for small lists
    data.forEach(item => {
      container.appendChild(renderItem(item));
    });
    return;
  }
  
  // Virtual scrolling for large lists
  const totalHeight = data.length * rowHeight;
  const visibleCount = Math.ceil(container.clientHeight / rowHeight) + 5; // Buffer rows
  
  // Create spacer for total height
  const spacer = document.createElement('div');
  spacer.style.height = totalHeight + 'px';
  spacer.style.position = 'relative';
  container.appendChild(spacer);
  
  let currentStartIndex = 0;
  const renderedItems = [];
  
  function updateVisibleItems() {
    const scrollTop = container.scrollTop;
    const startIndex = Math.floor(scrollTop / rowHeight);
    const endIndex = Math.min(startIndex + visibleCount, data.length);
    
    if (startIndex === currentStartIndex) return; // No change
    
    // Clear previous items
    renderedItems.forEach(item => item.remove());
    renderedItems.length = 0;
    
    // Render visible items
    for (let i = startIndex; i < endIndex; i++) {
      const item = renderItem(data[i]);
      item.style.position = 'absolute';
      item.style.top = (i * rowHeight) + 'px';
      item.style.width = '100%';
      spacer.appendChild(item);
      renderedItems.push(item);
    }
    
    currentStartIndex = startIndex;
  }
  
  // Initial render
  updateVisibleItems();
  
  // Update on scroll
  container.addEventListener('scroll', debounce(updateVisibleItems, 50));
  
  console.log(`Virtual scroll enabled for ${data.length} items`);
};

// Lazy load ICD codes by prefix (instead of all 5000 at once)
window.getICDCodesByPrefix = function(prefix) {
  const icdCodes = typeof window.getActiveIcdCodes === 'function'
    ? window.getActiveIcdCodes()
    : (window.ICD_CODES || window.ICD11_CODES || []);
  if (!icdCodes.length) {
    console.warn('ICD codes not available');
    return [];
  }
  
  const prefixLower = prefix.toLowerCase();
  const results = [];
  
  // Binary search would be faster if codes were sorted
  for (let i = 0; i < icdCodes.length; i++) {
    const code = icdCodes[i];
    if (code.code.toLowerCase().startsWith(prefixLower) || 
        code.title.toLowerCase().includes(prefixLower)) {
      results.push(code);
      if (results.length >= 50) break; // Limit results
    }
  }
  
  return results;
};

// Batch localStorage operations for better performance
window.batchSaveToLocalStorage = function(operations) {
  const start = performance.now();
  
  operations.forEach(op => {
    if (op.action === 'set') {
      localStorage.setItem(op.key, op.value);
    } else if (op.action === 'remove') {
      localStorage.removeItem(op.key);
    }
  });
  
  const end = performance.now();
  console.log(`Batch saved ${operations.length} items in ${(end - start).toFixed(2)}ms`);
};

// Preload critical data
window.preloadCriticalData = function() {
  console.log('Preloading critical data...');
  const start = performance.now();
  
  // Preload patients
  dataCache.patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  
  // Build index if doesn't exist
  let index = JSON.parse(localStorage.getItem(getDataKey("patientIndex")) || "null");
  if (!index || index.count !== dataCache.patients.length) {
    index = buildPatientIndex();
  }
  dataCache.patientIndex = index;
  
  // Preload appointments
  dataCache.appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  
  dataCache.cacheTimestamp = Date.now();
  
  const end = performance.now();
  console.log(`Critical data preloaded in ${(end - start).toFixed(2)}ms`);
  console.log(`- Patients: ${dataCache.patients.length}`);
  console.log(`- Appointments: ${dataCache.appointments.length}`);
};

// Monitor performance metrics
window.getPerformanceMetrics = function() {
  const metrics = {
    cacheStatus: isCacheValid() ? 'Valid' : 'Expired',
    cachedPatients: dataCache.patients ? dataCache.patients.length : 0,
    indexBuilt: dataCache.patientIndex !== null,
    storageUsage: checkStorageUsage(),
    memoryUsage: performance.memory ? {
      used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
    } : 'Not available'
  };
  
  return metrics;
};

// Clear old data (e.g., deleted patients older than 30 days)
window.archiveOldData = function() {
  const deletedPatients = JSON.parse(localStorage.getItem(getDataKey("deletedPatients")) || "[]");
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const archived = deletedPatients.filter(p => new Date(p.deletedAt) < thirtyDaysAgo);
  const remaining = deletedPatients.filter(p => new Date(p.deletedAt) >= thirtyDaysAgo);
  
  if (archived.length > 0) {
    const confirmArchive = confirm(`Found ${archived.length} deleted patients older than 30 days.\n\nArchive these to free up storage space?`);
    
    if (confirmArchive) {
      // Save to archive file
      const archiveData = {
        timestamp: new Date().toISOString(),
        count: archived.length,
        patients: archived
      };
      
      const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archived-patients-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Update deleted patients
      localStorage.setItem(getDataKey("deletedPatients"), JSON.stringify(remaining));
      
      logAuditEvent('data_archived', { count: archived.length });
      
      alert(`Archived ${archived.length} old deleted patients.\nArchive file downloaded for your records.`);
    }
  } else {
    alert('No old deleted patients to archive');
  }
};

// Invalidate cache when data changes
window.invalidateCache = function() {
  clearCache();
  console.log('Cache invalidated - will refresh on next access');
};

// Auto-initialize on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    // Preload data on critical pages
    const currentPage = window.location.pathname.split('/').pop();
    const criticalPages = ['patients.html', 'patient-details.html', 'dashboard.html'];
    
    if (criticalPages.includes(currentPage)) {
      setTimeout(preloadCriticalData, 100); // Small delay to not block initial render
    }
  });
  
  // Invalidate cache on data updates
  window.addEventListener('patientDataUpdated', invalidateCache);
}

console.log('Performance optimization module loaded');


