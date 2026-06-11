// Purpose: Accessibility and keyboard navigation enhancements for MediForge

// Keyboard shortcuts configuration
const KEYBOARD_SHORTCUTS = {
  'ALT+P': { action: () => window.location.href = '/add-patient', description: 'Add new patient' },
  'ALT+D': { action: () => window.location.href = '/dashboard', description: 'Go to dashboard' },
  'ALT+A': { action: () => window.location.href = '/appointments', description: 'View appointments' },
  'ALT+L': { action: () => window.location.href = '/patients', description: 'View patient list' },
  'ALT+B': { action: () => { if (typeof downloadBackup === 'function') downloadBackup(); }, description: 'Create backup' },
  'ALT+H': { action: showKeyboardShortcuts, description: 'Show this help' },
  'ESCAPE': { action: closeAllModals, description: 'Close modals/popups' }
};

// Initialize keyboard navigation
function initializeKeyboardNav() {
  document.addEventListener('keydown', function(e) {
    const key = [];
    if (e.altKey) key.push('ALT');
    if (e.ctrlKey) key.push('CTRL');
    if (e.shiftKey) key.push('SHIFT');
    key.push(e.key.toUpperCase());
    
    const combination = key.join('+');
    const shortcut = KEYBOARD_SHORTCUTS[combination];
    
    if (shortcut && typeof shortcut.action === 'function') {
      e.preventDefault();
      shortcut.action();
    }
  });
  
  console.log('Keyboard navigation initialized');
}

// Show keyboard shortcuts help
function showKeyboardShortcuts() {
  let message = '⌨️ Keyboard Shortcuts:\n\n';
  Object.keys(KEYBOARD_SHORTCUTS).forEach(key => {
    message += `${key}: ${KEYBOARD_SHORTCUTS[key].description}\n`;
  });
  alert(message);
}

// Close all modals
function closeAllModals() {
  // Close any element with modal-like styling
  const modals = document.querySelectorAll('[style*="position: fixed"][style*="z-index"]');
  modals.forEach(modal => {
    if (modal.style.zIndex >= 1000) {
      modal.remove();
    }
  });
  
  // Call specific close functions if they exist
  if (typeof closeEncounterSummaryModal === 'function') {
    closeEncounterSummaryModal();
  }
}

// Add ARIA labels to tables
function enhanceTableAccessibility() {
  const tables = document.querySelectorAll('table');
  
  tables.forEach(table => {
    if (!table.getAttribute('role')) {
      table.setAttribute('role', 'table');
    }
    
    const thead = table.querySelector('thead');
    if (thead && !thead.getAttribute('role')) {
      thead.setAttribute('role', 'rowgroup');
    }
    
    const tbody = table.querySelector('tbody');
    if (tbody && !tbody.getAttribute('role')) {
      tbody.setAttribute('role', 'rowgroup');
    }
    
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      if (!row.getAttribute('role')) {
        row.setAttribute('role', 'row');
      }
    });
    
    const headers = table.querySelectorAll('th');
    headers.forEach(header => {
      if (!header.getAttribute('role')) {
        header.setAttribute('role', 'columnheader');
      }
    });
    
    const cells = table.querySelectorAll('td');
    cells.forEach(cell => {
      if (!cell.getAttribute('role')) {
        cell.setAttribute('role', 'cell');
      }
    });
  });
  
  console.log(`Enhanced accessibility for ${tables.length} tables`);
}

// Add skip navigation link
function addSkipNavigation() {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: #4CAF50;
    color: white;
    padding: 8px;
    text-decoration: none;
    border-radius: 0 0 4px 0;
    z-index: 100000;
  `;
  
  skipLink.addEventListener('focus', function() {
    this.style.top = '0';
  });
  
  skipLink.addEventListener('blur', function() {
    this.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Add main content ID if not exists
  const h1 = document.querySelector('h1');
  if (h1 && !document.getElementById('main-content')) {
    h1.id = 'main-content';
  }
}

// Add ARIA labels to buttons without labels
function enhanceButtonAccessibility() {
  const buttons = document.querySelectorAll('button');
  
  buttons.forEach(button => {
    if (!button.getAttribute('aria-label') && !button.textContent.trim()) {
      // Button has no text and no aria-label
      const onclick = button.getAttribute('onclick');
      if (onclick) {
        button.setAttribute('aria-label', `Action: ${onclick.substring(0, 50)}`);
      }
    }
  });
}

// Announce page changes for screen readers
function announcePageChange(message) {
  const announcer = document.getElementById('aria-announcer') || createAnnouncer();
  announcer.textContent = message;
  
  setTimeout(() => {
    announcer.textContent = '';
  }, 1000);
}

function createAnnouncer() {
  const announcer = document.createElement('div');
  announcer.id = 'aria-announcer';
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  `;
  document.body.appendChild(announcer);
  return announcer;
}

// Check if device is mobile
window.isMobileDevice = function() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Check if device is touch-enabled
window.isTouchDevice = function() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
};

// Optimize for mobile on specific pages
function optimizeMobilePage() {
  if (isMobileDevice()) {
    // Add mobile class to body
    document.body.classList.add('mobile-device');
    
    // Add viewport meta if missing
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(viewport);
    }
    
    console.log('Mobile optimizations applied');
  }
}

// Initialize all accessibility features
window.initializeAccessibility = function() {
  console.log('Initializing accessibility features...');
  
  // Add skip navigation
  addSkipNavigation();
  
  // Enhance tables
  enhanceTableAccessibility();
  
  // Enhance buttons
  enhanceButtonAccessibility();
  
  // Initialize keyboard nav
  initializeKeyboardNav();
  
  // Mobile optimizations
  optimizeMobilePage();
  
  // Announce page load
  const pageTitle = document.querySelector('h1')?.textContent || 'Page loaded';
  announcePageChange(pageTitle + ' loaded');
  
  console.log('Accessibility features initialized');
};

// Auto-initialize on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    setTimeout(initializeAccessibility, 100);
  });
}

console.log('Accessibility module loaded successfully');


