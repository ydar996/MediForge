// Enhanced Phone Input Component
// Purpose: Create phone input fields with country code selector and auto-formatting

(function() {
  'use strict';
  
  // Common country codes for quick access
  const COMMON_PHONE_CODES = [
    { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
    { code: '+254', country: 'Kenya', flag: '🇰🇪' },
    { code: '+27', country: 'South Africa', flag: '🇿🇦' },
    { code: '+233', country: 'Ghana', flag: '🇬🇭' },
    { code: '+256', country: 'Uganda', flag: '🇺🇬' },
    { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
    { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
    { code: '+251', country: 'Ethiopia', flag: '🇪🇹' },
    { code: '+20', country: 'Egypt', flag: '🇪🇬' },
    { code: '+212', country: 'Morocco', flag: '🇲🇦' },
    { code: '+213', country: 'Algeria', flag: '🇩🇿' },
    { code: '+260', country: 'Zambia', flag: '🇿🇲' },
    { code: '+263', country: 'Zimbabwe', flag: '🇿🇼' },
    { code: '+1', country: 'USA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' }
  ];
  
  /**
   * Enhance a phone input field with country code selector
   * @param {string} inputId - ID of the phone input field
   * @param {string} defaultCountryCode - Default country code (e.g., '+234')
   */
  window.enhancePhoneInput = function(inputId, defaultCountryCode = '+234') {
    const input = document.getElementById(inputId);
    if (!input) {
      console.warn(`Phone input not found: ${inputId}`);
      return;
    }
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    
    // Create country code selector
    const codeSelect = document.createElement('select');
    codeSelect.id = `${inputId}-country-code`;
    codeSelect.style.cssText = 'width: 140px; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box; margin-bottom: 20px;';
    
    // Populate country codes
    COMMON_PHONE_CODES.forEach(item => {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = `${item.flag} ${item.code}`;
      if (item.code === defaultCountryCode) {
        option.selected = true;
      }
      codeSelect.appendChild(option);
    });
    
    // Update input to show only the number part
    input.style.flex = '1';
    input.placeholder = 'Enter phone number';
    input.type = 'tel';
    
    // Parse existing value if any
    if (input.value && input.value.startsWith('+')) {
      const match = input.value.match(/^(\+\d+)(.*)$/);
      if (match) {
        const code = match[1];
        const number = match[2].trim();
        
        // Set country code if it exists in our list
        const foundCode = COMMON_PHONE_CODES.find(c => input.value.startsWith(c.code));
        if (foundCode) {
          codeSelect.value = foundCode.code;
          input.value = number;
        }
      }
    }
    
    // Insert wrapper before input
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(codeSelect);
    wrapper.appendChild(input);
    
    // Auto-format on input
    input.addEventListener('input', function() {
      // Remove non-numeric characters
      let cleaned = this.value.replace(/[^\d]/g, '');
      this.value = cleaned;
    });
    
    // Return full phone number when needed
    const originalInput = input;
    originalInput.getFullPhoneNumber = function() {
      const code = codeSelect.value;
      const number = this.value.replace(/[^\d]/g, '');
      return number ? code + number : '';
    };
    
    // Do not mutate the input value on submit; callers should use getFullPhoneNumber()
  };
  
  /**
   * Get full phone number with country code
   * @param {string} inputId - ID of the phone input field
   * @returns {string} Full phone number with country code
   */
  window.getFullPhoneNumber = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return '';
    
    if (input.getFullPhoneNumber) {
      return input.getFullPhoneNumber();
    }
    
    // Pattern 1: Check if input has country code selector with suffix pattern (e.g., phone-country-code)
    const codeSelectSuffix = document.getElementById(`${inputId}-country-code`);
    if (codeSelectSuffix && codeSelectSuffix.value) {
      const code = codeSelectSuffix.value;
      const number = input.value.replace(/[^\d]/g, '');
      return number ? code + number : '';
    }
    
    // Pattern 2: Check for add-patient.html pattern (phone -> phoneCountryCode, emergencyPhone -> emergencyPhoneCountryCode)
    let codeSelectId = null;
    if (inputId === 'phone') {
      codeSelectId = 'phoneCountryCode';
    } else if (inputId === 'emergencyPhone') {
      codeSelectId = 'emergencyPhoneCountryCode';
    }
    
    if (codeSelectId) {
      const codeSelect = document.getElementById(codeSelectId);
      if (codeSelect && codeSelect.value) {
        const code = codeSelect.value;
        const number = input.value.replace(/[^\d]/g, '');
        return number ? code + number : '';
      }
    }
    
    // Pattern 3: Generic pattern - try common variations
    const commonPatterns = [
      `${inputId}CountryCode`,
      `${inputId}Code`,
      `country-code-${inputId}`,
      `${inputId}-code`
    ];
    
    for (const patternId of commonPatterns) {
      const codeSelect = document.getElementById(patternId);
      if (codeSelect && codeSelect.value) {
        const code = codeSelect.value;
        const number = input.value.replace(/[^\d]/g, '');
        return number ? code + number : '';
      }
    }
    
    // Fallback: return input value as-is (may already contain country code)
    return input.value;
  };
  
  console.log('Phone input enhancement module loaded');
})();


