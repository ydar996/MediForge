// Vaccine selector component for immunization entries
// Based on the ICD selector pattern but adapted for vaccine selection

// Search function for vaccines
function searchVaccines(query) {
  if (!window.VACCINES_DATA) {
    console.error('VACCINES_DATA not available');
    return [];
  }
  
  const lowerQuery = query.toLowerCase();
  return window.VACCINES_DATA.filter(vaccine => 
    vaccine.name.toLowerCase().includes(lowerQuery) ||
    vaccine.purpose.toLowerCase().includes(lowerQuery) ||
    vaccine.status.toLowerCase().includes(lowerQuery)
  );
}

function createVaccineSelector(containerId, targetInputId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with ID '${containerId}' not found`);
    return;
  }

  container.style.position = 'relative';  // Ensure suggestions position correctly

  // Clear any existing content (like fallback input)
  container.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search vaccine name or type custom entry...';
  input.id = targetInputId;
  input.style.width = '100%';
  input.style.padding = '8px';
  input.style.border = '1px solid #ccc';
  input.style.borderRadius = '4px';

  const suggestions = document.createElement('ul');
  suggestions.style.listStyle = 'none';
  suggestions.style.position = 'absolute';
  suggestions.style.background = 'white';
  suggestions.style.border = '1px solid #ccc';
  suggestions.style.borderRadius = '4px';
  suggestions.style.maxHeight = '300px';
  suggestions.style.overflowY = 'auto';
  suggestions.style.display = 'none';
  suggestions.style.zIndex = '1000';
  suggestions.style.padding = '0';
  suggestions.style.margin = '0';
  suggestions.style.width = '100%';
  suggestions.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

  // Vaccine details popup
  const detailsPopup = document.createElement('div');
  detailsPopup.style.position = 'absolute';
  detailsPopup.style.background = 'white';
  detailsPopup.style.border = '1px solid #ccc';
  detailsPopup.style.borderRadius = '4px';
  detailsPopup.style.padding = '10px';
  detailsPopup.style.display = 'none';
  detailsPopup.style.zIndex = '1001';
  detailsPopup.style.maxWidth = '400px';
  detailsPopup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
  detailsPopup.style.fontSize = '12px';

  container.appendChild(input);
  container.appendChild(suggestions);
  container.appendChild(detailsPopup);

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      suggestions.style.display = 'none';
      detailsPopup.style.display = 'none';
    }
  });

  // Helper function to show all vaccines
  function showAllVaccines() {
    suggestions.innerHTML = '';
    detailsPopup.style.display = 'none';
    
    // Get all vaccines (limit to first 50 for performance)
    const allVaccines = window.VACCINES_DATA ? window.VACCINES_DATA.slice(0, 50) : [];
    
    if (allVaccines.length === 0) {
      suggestions.style.display = 'none';
      return;
    }
    
    // Add all vaccines to suggestions
    allVaccines.forEach(vaccine => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.style.padding = '8px 12px';
      li.style.borderBottom = '1px solid #eee';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = vaccine.name;
      nameSpan.style.fontWeight = '500';
      
      const statusSpan = document.createElement('span');
      statusSpan.textContent = vaccine.status;
      statusSpan.style.fontSize = '11px';
      statusSpan.style.padding = '2px 6px';
      statusSpan.style.borderRadius = '3px';
      statusSpan.style.fontWeight = '500';
      
      if (vaccine.status === 'Mandatory') {
        statusSpan.style.background = '#d4edda';
        statusSpan.style.color = '#155724';
        statusSpan.style.border = '1px solid #c3e6cb';
      } else {
        statusSpan.style.background = '#fff3cd';
        statusSpan.style.color = '#856404';
        statusSpan.style.border = '1px solid #ffeaa7';
      }
      
      li.appendChild(nameSpan);
      li.appendChild(statusSpan);
      
      // Add hover effect
      li.addEventListener('mouseenter', () => {
        li.style.backgroundColor = '#f0f0f0';
        showVaccineDetails(vaccine, li);
      });
      li.addEventListener('mouseleave', () => {
        li.style.backgroundColor = '';
      });
      
      // Select vaccine on click
      li.addEventListener('click', () => {
        input.value = vaccine.name;
        suggestions.style.display = 'none';
        detailsPopup.style.display = 'none';
        input.dispatchEvent(new Event('input')); // Trigger any input handlers
      });
      
      suggestions.appendChild(li);
    });
    
    suggestions.style.display = 'block';
  }

  // Show all vaccines on focus/click (always show, even if input has value)
  input.addEventListener('focus', () => {
    showAllVaccines();
  });
  
  input.addEventListener('click', () => {
    showAllVaccines();
  });

  input.addEventListener('input', (e) => {
    const value = e.target.value;
    const lowerValue = value.toLowerCase();
    suggestions.innerHTML = '';
    detailsPopup.style.display = 'none';
    
    if (lowerValue.length < 2) {
      suggestions.style.display = 'none';
      return;
    }

    // Search vaccines
    const filtered = searchVaccines(lowerValue).slice(0, 20);  // Limit to 20 for performance
    
    // Add matching vaccines to suggestions
    filtered.forEach(vaccine => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.style.padding = '8px 12px';
      li.style.borderBottom = '1px solid #eee';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = vaccine.name;
      nameSpan.style.fontWeight = '500';
      
      const statusSpan = document.createElement('span');
      statusSpan.textContent = vaccine.status;
      statusSpan.style.fontSize = '11px';
      statusSpan.style.padding = '2px 6px';
      statusSpan.style.borderRadius = '3px';
      statusSpan.style.fontWeight = '500';
      
      if (vaccine.status === 'Mandatory') {
        statusSpan.style.background = '#d4edda';
        statusSpan.style.color = '#155724';
        statusSpan.style.border = '1px solid #c3e6cb';
      } else {
        statusSpan.style.background = '#fff3cd';
        statusSpan.style.color = '#856404';
        statusSpan.style.border = '1px solid #ffeaa7';
      }
      
      li.appendChild(nameSpan);
      li.appendChild(statusSpan);
      
      // Add hover effect
      li.addEventListener('mouseenter', () => {
        li.style.backgroundColor = '#f8f9fa';
        // Show details popup
        showVaccineDetails(vaccine, li);
      });
      
      li.addEventListener('mouseleave', () => {
        li.style.backgroundColor = 'white';
        // Hide details popup after a short delay
        setTimeout(() => {
          if (!detailsPopup.matches(':hover') && !li.matches(':hover')) {
            detailsPopup.style.display = 'none';
          }
        }, 200);
      });
      
      const selectFn = () => {
        input.value = vaccine.name;
        suggestions.style.display = 'none';
        detailsPopup.style.display = 'none';
        
        // Trigger change event for any listeners
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      
      li.addEventListener('click', selectFn);
      li.addEventListener('touchend', selectFn);  // Support touch for mobile
      suggestions.appendChild(li);
    });
    
    // Add "Custom Entry" option if user is typing something not in the list
    const exactMatch = filtered.find(vaccine => vaccine.name.toLowerCase() === lowerValue);
    if (!exactMatch && value.trim().length > 0) {
      const customLi = document.createElement('li');
      customLi.style.cursor = 'pointer';
      customLi.style.padding = '8px 12px';
      customLi.style.borderBottom = '1px solid #eee';
      customLi.style.display = 'flex';
      customLi.style.justifyContent = 'space-between';
      customLi.style.alignItems = 'center';
      customLi.style.backgroundColor = '#f0f8ff';
      customLi.style.borderLeft = '3px solid #007bff';
      
      const customSpan = document.createElement('span');
      customSpan.textContent = `Use "${value}" (Custom Entry)`;
      customSpan.style.fontWeight = '500';
      customSpan.style.color = '#007bff';
      
      const customStatusSpan = document.createElement('span');
      customStatusSpan.textContent = 'Custom';
      customStatusSpan.style.fontSize = '11px';
      customStatusSpan.style.padding = '2px 6px';
      customStatusSpan.style.borderRadius = '3px';
      customStatusSpan.style.fontWeight = '500';
      customStatusSpan.style.background = '#e3f2fd';
      customStatusSpan.style.color = '#1976d2';
      customStatusSpan.style.border = '1px solid #bbdefb';
      
      customLi.appendChild(customSpan);
      customLi.appendChild(customStatusSpan);
      
      // Add hover effect for custom entry
      customLi.addEventListener('mouseenter', () => {
        customLi.style.backgroundColor = '#e3f2fd';
      });
      
      customLi.addEventListener('mouseleave', () => {
        customLi.style.backgroundColor = '#f0f8ff';
      });
      
      const customSelectFn = () => {
        // Keep the user's typed value as-is
        suggestions.style.display = 'none';
        detailsPopup.style.display = 'none';
        
        // Trigger change event for any listeners
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      
      customLi.addEventListener('click', customSelectFn);
      customLi.addEventListener('touchend', customSelectFn);
      suggestions.appendChild(customLi);
    }
    
    suggestions.style.display = (filtered.length > 0 || (!exactMatch && value.trim().length > 0)) ? 'block' : 'none';
  });

  function showVaccineDetails(vaccine, targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    detailsPopup.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong style="color: #333;">${vaccine.name}</strong>
        <span style="float: right; font-size: 10px; padding: 2px 6px; border-radius: 3px; background: ${vaccine.status === 'Mandatory' ? '#d4edda' : '#fff3cd'}; color: ${vaccine.status === 'Mandatory' ? '#155724' : '#856404'};">${vaccine.status}</span>
      </div>
      <div style="margin-bottom: 6px;">
        <strong>Purpose:</strong> ${vaccine.purpose}
      </div>
      <div>
        <strong>Recommended Ages:</strong><br>
        <span style="font-size: 11px; line-height: 1.4;">${vaccine.recommendedAges}</span>
      </div>
    `;
    
    // Position popup
    detailsPopup.style.left = '0px';
    detailsPopup.style.top = (rect.bottom - containerRect.top + 5) + 'px';
    
    // Adjust if popup would go off screen
    const popupRect = detailsPopup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth) {
      detailsPopup.style.left = (window.innerWidth - popupRect.width - 20) + 'px';
    }
    
    detailsPopup.style.display = 'block';
    
    // Keep popup visible when hovering over it
    detailsPopup.addEventListener('mouseenter', () => {
      detailsPopup.style.display = 'block';
    });
    
    detailsPopup.addEventListener('mouseleave', () => {
      detailsPopup.style.display = 'none';
    });
  }

  // Add keyboard navigation
  input.addEventListener('keydown', (e) => {
    const visibleSuggestions = Array.from(suggestions.children).filter(li => li.style.display !== 'none');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = suggestions.querySelector('.highlighted');
      const currentIndex = current ? visibleSuggestions.indexOf(current) : -1;
      const nextIndex = currentIndex < visibleSuggestions.length - 1 ? currentIndex + 1 : 0;
      
      if (current) current.classList.remove('highlighted');
      if (visibleSuggestions[nextIndex]) {
        visibleSuggestions[nextIndex].classList.add('highlighted');
        visibleSuggestions[nextIndex].style.backgroundColor = '#e3f2fd';
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = suggestions.querySelector('.highlighted');
      const currentIndex = current ? visibleSuggestions.indexOf(current) : visibleSuggestions.length;
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleSuggestions.length - 1;
      
      if (current) current.classList.remove('highlighted');
      if (visibleSuggestions[prevIndex]) {
        visibleSuggestions[prevIndex].classList.add('highlighted');
        visibleSuggestions[prevIndex].style.backgroundColor = '#e3f2fd';
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const highlighted = suggestions.querySelector('.highlighted');
      if (highlighted) {
        highlighted.click();
      }
    } else if (e.key === 'Escape') {
      suggestions.style.display = 'none';
      detailsPopup.style.display = 'none';
    }
  });

  return {
    input,
    container,
    suggestions,
    detailsPopup
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createVaccineSelector };
}
