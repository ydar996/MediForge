// Lazy-load ICD11_CODES on first use
let codesLoaded = false;
let icdIndex = null;
let icdScriptPromise = null;

function loadIcd11Codes() {
  if (window.ICD11_CODES) {
    return Promise.resolve(true);
  }
  if (icdScriptPromise) {
    return icdScriptPromise;
  }

  icdScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('icd11-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => reject(new Error('Failed to load icd11.js')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'icd11-script';
    script.src = 'js/icd11.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load icd11.js'));
    document.head.appendChild(script);
  });

  return icdScriptPromise;
}

window.loadIcd11Codes = loadIcd11Codes;

function buildIcdIndex() {
  if (icdIndex) return icdIndex;
  const codes = window.ICD11_CODES || [];
  icdIndex = codes.map(item => ({
    code: item.code,
    title: item.title,
    codeLower: String(item.code || '').toLowerCase(),
    titleLower: String(item.title || '').toLowerCase()
  }));
  return icdIndex;
}

function searchLocalCodesOptimized(query, limit = 50) {
  if (!query || query.length < 2) return [];
  const searchTerm = query.toLowerCase();
  const index = buildIcdIndex();
  if (!index || index.length === 0) return [];

  const results = [];
  for (let i = 0; i < index.length; i += 1) {
    const item = index[i];
    if (item.titleLower.includes(searchTerm) || item.codeLower.includes(searchTerm)) {
      results.push({ code: item.code, title: item.title });
      if (results.length >= limit) break;
    }
  }
  return results;
}

window.searchLocalCodesOptimized = searchLocalCodesOptimized;
window.getIcdInitialSuggestions = function getIcdInitialSuggestions(limit = 20) {
  const index = buildIcdIndex();
  if (!index || index.length === 0) return [];
  return index.slice(0, limit).map(item => ({
    code: item.code,
    title: item.title
  }));
};

function createIcdSelector(fieldId, isMultiple = true, targetId = fieldId) {
  console.log(`Creating ICD selector for fieldId: ${fieldId}, targetId: ${targetId}`);
  const container = document.getElementById(fieldId + '-container');
  if (!container) {
    console.error(`Container not found: ${fieldId + '-container'}`);
    return;
  }
  console.log(`Container found:`, container);

  container.style.position = 'relative';  // Ensure suggestions position correctly

  // Check if input already exists, if not create one
  let input = document.getElementById(targetId);
  if (!input) {
    input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search disease name...';
    input.id = targetId;  // Set custom ID for add functions to access
  } else {
    // Enhance existing input with search placeholder
    input.placeholder = 'Search disease name...';
    console.log('Using existing input field:', input);
  }

  const suggestions = document.createElement('ul');
  suggestions.style.listStyle = 'none';
  suggestions.style.position = 'absolute';
  suggestions.style.background = 'white';
  suggestions.style.border = '1px solid #ccc';
  suggestions.style.maxHeight = '300px';
  suggestions.style.overflowY = 'auto';
  suggestions.style.display = 'none';
  suggestions.style.zIndex = '1000';
  suggestions.style.padding = '0';
  suggestions.style.margin = '0';
  suggestions.style.minWidth = '400px';
  suggestions.style.maxWidth = '800px';
  suggestions.style.width = 'max-content';
  suggestions.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  suggestions.style.borderRadius = '4px';

  let selectedList;
  if (isMultiple) {
    selectedList = document.createElement('ul');
    selectedList.id = fieldId + '-list';
    selectedList.style.listStyle = 'none';
    selectedList.style.padding = '0';
    container.appendChild(selectedList);
  }

  // Only append input if it was newly created
  if (!document.getElementById(targetId)) {
    container.appendChild(input);
  }
  container.appendChild(suggestions);

  // Function to position suggestions dropdown
  function positionSuggestions() {
    console.log('Positioning suggestions...');
    const inputRect = input.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    console.log('Input rect:', inputRect);
    console.log('Container rect:', containerRect);
    
    // Calculate available space
    const spaceBelow = viewportHeight - inputRect.bottom;
    const spaceAbove = inputRect.top;
    const spaceRight = viewportWidth - inputRect.left;
    
    // Set width based on available space and content
    const maxWidth = Math.min(800, spaceRight - 20);
    suggestions.style.maxWidth = maxWidth + 'px';
    
    // Position vertically
    if (spaceBelow >= 300 || spaceBelow > spaceAbove) {
      // Show below input
      suggestions.style.top = '100%';
      suggestions.style.bottom = 'auto';
      suggestions.style.maxHeight = Math.min(300, spaceBelow - 10) + 'px';
    } else {
      // Show above input
      suggestions.style.bottom = '100%';
      suggestions.style.top = 'auto';
      suggestions.style.maxHeight = Math.min(300, spaceAbove - 10) + 'px';
    }
    
    // Position horizontally
    if (inputRect.left + maxWidth > viewportWidth - 20) {
      // Align to right edge
      suggestions.style.right = '0';
      suggestions.style.left = 'auto';
    } else {
      // Align to left edge
      suggestions.style.left = '0';
      suggestions.style.right = 'auto';
    }
    console.log('Final suggestions style:', {
      display: suggestions.style.display,
      position: suggestions.style.position,
      top: suggestions.style.top,
      bottom: suggestions.style.bottom,
      left: suggestions.style.left,
      right: suggestions.style.right,
      maxWidth: suggestions.style.maxWidth,
      maxHeight: suggestions.style.maxHeight
    });
  }

  async function ensureCodesLoaded() {
    if (codesLoaded) return;
    if (!window.ICD11_CODES) {
      try {
        await loadIcd11Codes();
      } catch (error) {
        console.warn('ICD11_CODES script failed to load:', error);
      }
    }
    if (window.ICD11_CODES) {
      codesLoaded = true;
      buildIcdIndex();
      console.log(`Loaded ${window.ICD11_CODES.length} ICD-11 codes from global`);
    } else {
      console.warn('ICD11_CODES not available globally');
      codesLoaded = true;
    }
  }

  function renderSuggestions(list) {
    suggestions.innerHTML = '';

    if (!list || list.length === 0) {
      const rawValue = (input.value || '').trim();
      if (rawValue.length >= 2) {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.style.padding = '8px 12px';
        li.style.borderBottom = '1px solid #eee';
        li.style.whiteSpace = 'normal';
        li.style.background = '#f8f9fa';
        li.textContent = `➕ Use custom entry: ${rawValue}`;
        li.addEventListener('click', () => {
          if (isMultiple) {
            addSelected({ code: 'CUSTOM', title: rawValue }, fieldId);
            input.value = '';
          } else {
            input.value = rawValue;
          }
          suggestions.style.display = 'none';
          if (isMultiple) syncData(fieldId);
        });
        suggestions.appendChild(li);
        positionSuggestions();
        suggestions.style.display = 'block';
      } else {
        suggestions.style.display = 'none';
      }
      return;
    }

    list.forEach(c => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.style.padding = '8px 12px';
      li.style.borderBottom = '1px solid #eee';
      li.style.whiteSpace = 'nowrap';
      li.style.overflow = 'visible';
      li.style.textOverflow = 'unset';
      li.style.display = 'flex';
      li.style.alignItems = 'flex-start';
      li.style.lineHeight = '1.4';
      
      // Create a more structured display
      const codeSpan = document.createElement('span');
      codeSpan.textContent = c.code;
      codeSpan.style.fontWeight = 'bold';
      codeSpan.style.color = '#007bff';
      codeSpan.style.marginRight = '8px';
      codeSpan.style.flexShrink = '0';
      codeSpan.style.minWidth = '80px';
      
      const titleSpan = document.createElement('span');
      titleSpan.textContent = c.title;
      titleSpan.style.flex = '1';
      titleSpan.style.wordWrap = 'break-word';
      titleSpan.style.whiteSpace = 'normal';
      
      li.appendChild(codeSpan);
      li.appendChild(titleSpan);
      
      // Add hover effect
      li.addEventListener('mouseenter', () => {
        li.style.backgroundColor = '#f0f8ff';
        li.style.borderLeft = '3px solid #007bff';
      });
      li.addEventListener('mouseleave', () => {
        li.style.backgroundColor = 'white';
        li.style.borderLeft = 'none';
      });
      
      const selectFn = () => {
        console.log('Selected: ' + c.code + ' - ' + c.title);
        if (isMultiple) {
          addSelected(c, fieldId);
          input.value = '';
        } else {
          input.value = c.code + ' - ' + c.title;
        }
        suggestions.style.display = 'none';
        if (isMultiple) syncData(fieldId);
      };
      li.addEventListener('click', selectFn);
      li.addEventListener('touchend', selectFn);
      suggestions.appendChild(li);
    });

    positionSuggestions();
    suggestions.style.display = 'block';
  }

  async function showInitialSuggestions() {
    await ensureCodesLoaded();
    const index = buildIcdIndex();
    if (!index || index.length === 0) return;

    const defaultList = index.slice(0, 50).map(item => ({
      code: item.code,
      title: item.title
    }));

    renderSuggestions(defaultList);
  }

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });

  // Reposition suggestions on window resize
  window.addEventListener('resize', () => {
    if (suggestions.style.display === 'block') {
      positionSuggestions();
    }
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length === 0) {
      showInitialSuggestions();
    }
  });

  input.addEventListener('click', () => {
    if (input.value.trim().length === 0) {
      showInitialSuggestions();
    }
  });

  let inputDebounce = null;
  input.addEventListener('input', async (e) => {
    const value = e.target.value;
    if (inputDebounce) {
      clearTimeout(inputDebounce);
    }
    inputDebounce = setTimeout(async () => {
      const normalized = value.trim().toLowerCase();
      console.log(`Input event triggered with value: "${normalized}"`);

      if (normalized.length < 2) {
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
        return;
      }

      await ensureCodesLoaded();

      const filtered = searchLocalCodesOptimized(normalized, 50);

      console.log(`Found ${filtered.length} matches for "${normalized}"`);
      renderSuggestions(filtered);
    }, 250);
  });
}

function addSelected(c, fieldId) {
  const selectedList = document.getElementById(fieldId + '-list');
  if (!selectedList) return;
  
  const li = document.createElement('li');
  li.style.display = 'inline-block';
  li.style.margin = '5px';
  li.style.padding = '8px 12px';
  li.style.background = '#e3f2fd';
  li.style.borderRadius = '5px';
  li.style.border = '1px solid #bbdefb';
  li.style.maxWidth = '100%';
  li.style.wordWrap = 'break-word';
  li.style.whiteSpace = 'normal';
  
  // Create structured content for selected items in format: CODE - TITLE
  const codeSpan = document.createElement('span');
  codeSpan.textContent = c.code + ' - ';
  codeSpan.style.fontWeight = 'bold';
  codeSpan.style.color = '#1976d2';
  
  const titleSpan = document.createElement('span');
  titleSpan.textContent = c.title;
  titleSpan.style.color = '#333';
  
  li.appendChild(codeSpan);
  li.appendChild(titleSpan);

  const remove = document.createElement('button');
  remove.textContent = '×';
  remove.style.marginLeft = '8px';
  remove.style.background = '#f44336';
  remove.style.color = 'white';
  remove.style.border = 'none';
  remove.style.borderRadius = '50%';
  remove.style.width = '20px';
  remove.style.height = '20px';
  remove.style.cursor = 'pointer';
  remove.style.fontSize = '12px';
  remove.style.fontWeight = 'bold';
  remove.addEventListener('click', () => {
    li.remove();
    syncData(fieldId);
  });

  li.appendChild(remove);
  selectedList.appendChild(li);
}

function syncData(fieldId) {
  const list = document.getElementById(fieldId + '-list');
  const items = Array.from(list.children).map(li => {
    const spans = li.querySelectorAll('span');
    // First span contains "CODE - ", second span contains "TITLE"
    const codeText = spans[0] ? spans[0].textContent : '';
    const title = spans[1] ? spans[1].textContent : '';
    // Extract just the code (remove the " - " part)
    const code = codeText.replace(' - ', '').trim();
    return { code, title, fullText: code + ' - ' + title };
  });
  localStorage.setItem(fieldId, JSON.stringify(items));
}

// Function is already available in global scope