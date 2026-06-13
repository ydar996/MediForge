/**
 * Country Codes with Flags - Centralized Data
 * Purpose: Provide country codes with proper flag emojis and correct character encoding
 * Usage: Include this file before any HTML that uses country code dropdowns
 */

window.COUNTRY_CODES_DATA = [
  // West Africa
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+225', country: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: '+221', country: 'Senegal', flag: '🇸🇳' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+227', country: 'Niger', flag: '🇳🇪' },
  { code: '+228', country: 'Togo', flag: '🇹🇬' },
  { code: '+229', country: 'Benin', flag: '🇧🇯' },
  { code: '+220', country: 'Gambia', flag: '🇬🇲' },
  { code: '+224', country: 'Guinea', flag: '🇬🇳' },
  { code: '+245', country: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: '+238', country: 'Cape Verde', flag: '🇨🇻' },
  { code: '+232', country: 'Sierra Leone', flag: '🇸🇱' },
  { code: '+231', country: 'Liberia', flag: '🇱🇷' },
  
  // East Africa
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+256', country: 'Uganda', flag: '🇺🇬' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹' },
  { code: '+253', country: 'Djibouti', flag: '🇩🇯' },
  { code: '+252', country: 'Somalia', flag: '🇸🇴' },
  { code: '+249', country: 'Sudan', flag: '🇸🇩' },
  { code: '+211', country: 'South Sudan', flag: '🇸🇸' },
  { code: '+257', country: 'Burundi', flag: '🇧🇮' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' }, // Duplicate removed in sorted version
  
  // Southern Africa
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+260', country: 'Zambia', flag: '🇿🇲' },
  { code: '+263', country: 'Zimbabwe', flag: '🇿🇼' },
  { code: '+267', country: 'Botswana', flag: '🇧🇼' },
  { code: '+268', country: 'Eswatini', flag: '🇸🇿' },
  { code: '+264', country: 'Namibia', flag: '🇳🇦' },
  { code: '+265', country: 'Malawi', flag: '🇲🇼' },
  { code: '+258', country: 'Mozambique', flag: '🇲🇿' },
  { code: '+261', country: 'Madagascar', flag: '🇲🇬' },
  { code: '+230', country: 'Mauritius', flag: '🇲🇺' },
  { code: '+248', country: 'Seychelles', flag: '🇸🇨' },
  
  // Central Africa
  { code: '+237', country: 'Cameroon', flag: '🇨🇲' },
  { code: '+236', country: 'Central African Republic', flag: '🇨🇫' },
  { code: '+235', country: 'Chad', flag: '🇹🇩' },
  { code: '+242', country: 'Republic of the Congo', flag: '🇨🇬' },
  { code: '+243', country: 'Democratic Republic of the Congo', flag: '🇨🇩' },
  { code: '+240', country: 'Equatorial Guinea', flag: '🇬🇶' },
  { code: '+241', country: 'Gabon', flag: '🇬🇦' },
  { code: '+239', country: 'São Tomé and Príncipe', flag: '🇸🇹' },
  
  // North Africa
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+212', country: 'Morocco', flag: '🇲🇦' },
  { code: '+213', country: 'Algeria', flag: '🇩🇿' },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳' },
  { code: '+218', country: 'Libya', flag: '🇱🇾' },
  { code: '+249', country: 'Sudan', flag: '🇸🇩' },
  
  // Other common countries
  { code: '+1', country: 'Canada', flag: '🇨🇦' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' } // Already listed above
];

/**
 * Populate country code dropdown with proper flags and encoding
 * @param {string} selectId - ID of the select element
 * @param {string} defaultCode - Default country code to select (e.g., '+1')
 * @param {boolean} includeSelectOption - Whether to include "Select Country" as first option
 * @param {string} defaultCountry - When multiple entries share a code (e.g. +1), pick this country
 */
window.populateCountryCodeDropdown = function(selectId, defaultCode = '+1', includeSelectOption = true, defaultCountry = 'Canada') {
  const select = document.getElementById(selectId);
  if (!select) {
    console.warn(`Country code dropdown not found: ${selectId}`);
    return;
  }
  
  // Clear existing options
  select.innerHTML = '';
  
  // Add "Select Country" option if requested
  if (includeSelectOption) {
    const selectOption = document.createElement('option');
    selectOption.value = '';
    selectOption.textContent = 'Select Country';
    select.appendChild(selectOption);
  }
  
  // Keep all entries (Canada and US both use +1)
  const uniqueCountries = [];
  const seenKeys = new Set();
  window.COUNTRY_CODES_DATA.forEach(item => {
    const key = item.code + '|' + item.country;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    uniqueCountries.push(item);
  });
  
  const priorityNames = ['Canada', 'United States'];
  const priorityItems = [];
  const otherItems = [];
  uniqueCountries.forEach(item => {
    if (priorityNames.includes(item.country)) {
      priorityItems.push(item);
    } else {
      otherItems.push(item);
    }
  });
  priorityItems.sort((a, b) => priorityNames.indexOf(a.country) - priorityNames.indexOf(b.country));
  otherItems.sort((a, b) => a.country.localeCompare(b.country));
  const orderedCountries = priorityItems.concat(otherItems);

  // Populate dropdown
  orderedCountries.forEach(item => {
    const option = document.createElement('option');
    option.value = item.code;
    // Use proper flag emoji and correct character encoding
    option.textContent = `${item.flag} ${item.code} (${item.country})`;
    option.setAttribute('data-flag', item.flag);
    option.setAttribute('data-country', item.country);
    
    select.appendChild(option);
  });

  window.setPhoneCountryCodeForAddressCountry(select, defaultCountry, defaultCode);
  
  // Ensure UTF-8 encoding is set
  if (document.characterSet !== 'UTF-8' && document.charset !== 'UTF-8') {
    const metaCharset = document.querySelector('meta[charset]');
    if (metaCharset) {
      metaCharset.setAttribute('charset', 'UTF-8');
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('charset', 'UTF-8');
      document.head.insertBefore(meta, document.head.firstChild);
    }
  }
};

/** Select phone country code option; prefers data-country when +1 is shared by CA/US. */
window.setPhoneCountryCodeForAddressCountry = function(selectId, addressCountry, fallbackCode) {
  const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
  if (!select) return;
  const country = addressCountry || 'Canada';
  const byCountry = Array.from(select.options).find(function (o) {
    return o.getAttribute('data-country') === country;
  });
  if (byCountry) {
    byCountry.selected = true;
    return;
  }
  const code = fallbackCode || (window.COUNTRIES_DATA && window.COUNTRIES_DATA[country] && window.COUNTRIES_DATA[country].phoneCode) || '+1';
  const byCode = Array.from(select.options).find(function (o) { return o.value === code; });
  if (byCode) byCode.selected = true;
};

console.log('✅ Country codes utility loaded');



