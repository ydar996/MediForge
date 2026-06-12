/**
 * Searchable Dropdown Component
 * Purpose: Convert regular select dropdowns to searchable inputs for better mobile UX
 * Usage: Call makeSearchableDropdown(selectId) on any select element
 */

/**
 * Convert a select dropdown to a searchable input with dropdown
 * @param {string} selectId - ID of the select element to convert
 * @param {object} options - Configuration options
 */
window.makeSearchableDropdown = function(selectId, options = {}) {
  const select = document.getElementById(selectId);
  if (!select) {
    console.warn(`Select element not found: ${selectId}`);
    return;
  }
  
  // Don't convert if already converted
  if (select.dataset.searchable === 'true') {
    return;
  }
  
  const {
    placeholder = 'Type to search...',
    minChars = 0,
    maxHeight = '300px',
    mobileOptimized = true
  } = options;
  
  // Get all options
  const optionsList = Array.from(select.options).map(opt => ({
    value: opt.value,
    text: opt.textContent,
    disabled: opt.disabled
  }));
  
  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; width: 100%;';
  wrapper.className = 'searchable-dropdown-wrapper';
  
  // Create input field
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `${selectId}-search`;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
    box-sizing: border-box;
    ${mobileOptimized ? '-webkit-appearance: none; -moz-appearance: none; appearance: none;' : ''}
  `;
  
  // Create dropdown container
  const dropdown = document.createElement('div');
  dropdown.id = `${selectId}-dropdown`;
  dropdown.style.cssText = `
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background: white;
    border: 1px solid #ccc;
    border-top: none;
    border-radius: 0 0 4px 4px;
    max-height: ${maxHeight};
    overflow-y: auto;
    z-index: 10000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    margin-top: -1px;
  `;
  dropdown.className = 'searchable-dropdown-list';
  
  // Store original select value
  let selectedValue = select.value;
  let selectedText = select.options[select.selectedIndex]?.textContent || '';
  
  // Set initial input value
  if (selectedValue && selectedText && selectedText !== 'Select Race' && selectedText !== 'Select...') {
    input.value = selectedText;
  }
  
  // Filter and display options
  function filterOptions(searchTerm = '') {
    const term = searchTerm.toLowerCase().trim();
    const filtered = optionsList.filter(opt => {
      if (opt.disabled || opt.value === '') return false;
      if (term.length < minChars) return true;
      return opt.text.toLowerCase().includes(term);
    });
    
    dropdown.innerHTML = '';
    
    if (filtered.length === 0) {
      const noResults = document.createElement('div');
      noResults.style.cssText = 'padding: 12px; color: #666; text-align: center; font-style: italic;';
      noResults.textContent = 'No matches found';
      dropdown.appendChild(noResults);
    } else {
      filtered.forEach(opt => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding: 12px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
          transition: background-color 0.2s;
        `;
        item.textContent = opt.text;
        item.dataset.value = opt.value;
        
        // Highlight search term
        if (term && opt.text.toLowerCase().includes(term)) {
          const regex = new RegExp(`(${term})`, 'gi');
          item.innerHTML = opt.text.replace(regex, '<strong>$1</strong>');
        }
        
        // Hover effect
        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = '#f5f5f5';
        });
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = 'white';
        });
        
        // Click handler
        item.addEventListener('click', () => {
          select.value = opt.value;
          input.value = opt.text;
          selectedValue = opt.value;
          selectedText = opt.text;
          dropdown.style.display = 'none';
          
          // Trigger change event
          select.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        dropdown.appendChild(item);
      });
    }
  }
  
  // Show dropdown
  function showDropdown() {
    filterOptions(input.value);
    dropdown.style.display = 'block';
    
    // Scroll to selected item if exists
    const selectedItem = dropdown.querySelector(`[data-value="${selectedValue}"]`);
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      selectedItem.style.backgroundColor = '#e3f2fd';
    }
  }
  
  // Hide dropdown
  function hideDropdown() {
    // Delay to allow click events to fire
    setTimeout(() => {
      dropdown.style.display = 'none';
    }, 200);
  }
  
  // Input event handlers
  input.addEventListener('focus', () => {
    showDropdown();
    // On mobile, scroll input into view
    if (mobileOptimized && window.innerWidth < 768) {
      setTimeout(() => {
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 300);
    }
  });
  
  input.addEventListener('input', (e) => {
    filterOptions(e.target.value);
    if (dropdown.style.display === 'none') {
      showDropdown();
    }
  });
  
  input.addEventListener('blur', hideDropdown);
  
  // Keyboard navigation
  let highlightedIndex = -1;
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('[data-value]');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
        items[highlightedIndex].style.backgroundColor = '#e3f2fd';
        // Remove highlight from others
        items.forEach((item, idx) => {
          if (idx !== highlightedIndex) {
            item.style.backgroundColor = 'white';
          }
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, -1);
      items.forEach((item, idx) => {
        item.style.backgroundColor = idx === highlightedIndex ? '#e3f2fd' : 'white';
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        items[highlightedIndex].click();
      } else if (items.length === 1) {
        items[0].click();
      }
    } else if (e.key === 'Escape') {
      hideDropdown();
      input.blur();
    }
  });
  
  // Replace select with wrapper
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);
  
  // Hide original select but keep it for form submission
  select.style.cssText = 'position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0;';
  select.dataset.searchable = 'true';
  
  // Sync input value to select value
  input.addEventListener('change', () => {
    select.value = selectedValue;
  });
  
  // Initialize dropdown
  filterOptions('');
  
  console.log(`✅ Converted ${selectId} to searchable dropdown`);
};


console.log('✅ Searchable dropdown utility loaded');



