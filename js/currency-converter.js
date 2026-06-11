// Currency Converter Module for MediForge
// Purpose: Convert subscription prices across all African currencies
// Uses USD as pivot currency for conversions

// Exchange rates (approximate as of January 2025, per 1 USD)
const EXCHANGE_RATES = {
  // East Africa
  "KES": 127.50,    // Kenyan Shilling
  "TZS": 2520,      // Tanzanian Shilling
  "UGX": 3700,      // Ugandan Shilling
  "RWF": 1320,      // Rwandan Franc
  "BIF": 2900,      // Burundian Franc
  "ETB": 120,       // Ethiopian Birr
  "SOS": 570,       // Somali Shilling
  
  // West Africa
  "NGN": 1580,      // Nigerian Naira
  "GHS": 12.80,     // Ghanaian Cedi
  "XOF": 605,       // West African CFA Franc
  "LRD": 190,       // Liberian Dollar
  "SLL": 22000,     // Sierra Leonean Leone
  "GMD": 68,        // Gambian Dalasi
  
  // Southern Africa
  "ZAR": 18.50,     // South African Rand
  "BWP": 13.50,     // Botswana Pula
  "NAD": 18.50,     // Namibian Dollar (pegged to ZAR)
  "MWK": 1730,      // Malawian Kwacha
  "ZMW": 27,        // Zambian Kwacha
  "ZWL": 320,       // Zimbabwean Dollar
  "MZN": 63.50,     // Mozambican Metical
  "SZL": 18.50,     // Swazi Lilangeni (pegged to ZAR)
  "LSL": 18.50,     // Lesotho Loti (pegged to ZAR)
  
  // North Africa
  "EGP": 49,        // Egyptian Pound
  "MAD": 10,        // Moroccan Dirham
  "TND": 3.15,      // Tunisian Dinar
  "DZD": 135,       // Algerian Dinar
  "LYD": 4.85,      // Libyan Dinar
  
  // Central Africa
  "XAF": 605,       // Central African CFA Franc
  "CDF": 2800,      // Congolese Franc
  "AOA": 920,       // Angolan Kwanza
  
  // Island Nations
  "MUR": 46,        // Mauritian Rupee
  "SCR": 14,        // Seychellois Rupee
  "MGA": 4600,      // Malagasy Ariary
  "KMF": 455,       // Comorian Franc
  "CVE": 102,       // Cape Verdean Escudo
  
  // International
  "USD": 1,         // US Dollar (base)
  "CAD": 1.37,      // Canadian Dollar (platform default)
  "EUR": 0.92,      // Euro
  "GBP": 0.79       // British Pound
};

// Currency symbols and names
const CURRENCY_INFO = {
  // East Africa
  "KES": { symbol: "KSh", name: "Kenyan Shilling", flag: "🇰🇪" },
  "TZS": { symbol: "TSh", name: "Tanzanian Shilling", flag: "🇹🇿" },
  "UGX": { symbol: "USh", name: "Ugandan Shilling", flag: "🇺🇬" },
  "RWF": { symbol: "RF", name: "Rwandan Franc", flag: "🇷🇼" },
  "BIF": { symbol: "FBu", name: "Burundian Franc", flag: "🇧🇮" },
  "ETB": { symbol: "Br", name: "Ethiopian Birr", flag: "🇪🇹" },
  "SOS": { symbol: "Sh", name: "Somali Shilling", flag: "🇸🇴" },
  
  // West Africa
  "NGN": { symbol: "₦", name: "Nigerian Naira", flag: "🇳🇬" },
  "GHS": { symbol: "GH₵", name: "Ghanaian Cedi", flag: "🇬🇭" },
  "XOF": { symbol: "CFA", name: "West African CFA Franc", flag: "" },
  "LRD": { symbol: "L$", name: "Liberian Dollar", flag: "🇱🇷" },
  "SLL": { symbol: "Le", name: "Sierra Leonean Leone", flag: "🇸🇱" },
  "GMD": { symbol: "D", name: "Gambian Dalasi", flag: "🇬🇲" },
  
  // Southern Africa
  "ZAR": { symbol: "R", name: "South African Rand", flag: "🇿🇦" },
  "BWP": { symbol: "P", name: "Botswana Pula", flag: "🇧🇼" },
  "NAD": { symbol: "N$", name: "Namibian Dollar", flag: "🇳🇦" },
  "MWK": { symbol: "MK", name: "Malawian Kwacha", flag: "🇲🇼" },
  "ZMW": { symbol: "ZK", name: "Zambian Kwacha", flag: "🇿🇲" },
  "ZWL": { symbol: "Z$", name: "Zimbabwean Dollar", flag: "🇿🇼" },
  "MZN": { symbol: "MT", name: "Mozambican Metical", flag: "🇲🇿" },
  "SZL": { symbol: "L", name: "Swazi Lilangeni", flag: "🇸🇿" },
  "LSL": { symbol: "L", name: "Lesotho Loti", flag: "🇱🇸" },
  
  // North Africa
  "EGP": { symbol: "E£", name: "Egyptian Pound", flag: "🇪🇬" },
  "MAD": { symbol: "MAD", name: "Moroccan Dirham", flag: "🇲🇦" },
  "TND": { symbol: "د.ت", name: "Tunisian Dinar", flag: "🇹🇳" },
  "DZD": { symbol: "د.ج", name: "Algerian Dinar", flag: "🇩🇿" },
  "LYD": { symbol: "LD", name: "Libyan Dinar", flag: "🇱🇾" },
  
  // Central Africa
  "XAF": { symbol: "FCFA", name: "Central African CFA Franc", flag: "" },
  "CDF": { symbol: "FC", name: "Congolese Franc", flag: "🇨🇩" },
  "AOA": { symbol: "Kz", name: "Angolan Kwanza", flag: "🇦🇴" },
  
  // Island Nations
  "MUR": { symbol: "₨", name: "Mauritian Rupee", flag: "🇲🇺" },
  "SCR": { symbol: "₨", name: "Seychellois Rupee", flag: "🇸🇨" },
  "MGA": { symbol: "Ar", name: "Malagasy Ariary", flag: "🇲🇬" },
  "KMF": { symbol: "CF", name: "Comorian Franc", flag: "🇰🇲" },
  "CVE": { symbol: "CVE", name: "Cape Verdean Escudo", flag: "🇨🇻" },
  
  // International
  "USD": { symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  "CAD": { symbol: "CA$", name: "Canadian Dollar", flag: "🇨🇦" },
  "EUR": { symbol: "€", name: "Euro", flag: "🇪🇺" },
  "GBP": { symbol: "£", name: "British Pound", flag: "🇬🇧" }
};

/**
 * Convert amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code (e.g., "NGN")
 * @param {string} toCurrency - Target currency code (e.g., "KES")
 * @returns {number} Converted amount
 */
window.convertCurrency = function(amount, fromCurrency, toCurrency) {
  // Same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // Check if currencies exist
  if (!EXCHANGE_RATES[fromCurrency] || !EXCHANGE_RATES[toCurrency]) {
    console.warn(`Currency not found: ${fromCurrency} or ${toCurrency}`);
    return amount; // Return original amount if currency not found
  }
  
  // Convert: FROM → USD → TO
  const amountInUSD = amount / EXCHANGE_RATES[fromCurrency];
  const convertedAmount = amountInUSD * EXCHANGE_RATES[toCurrency];
  
  // Round to 2 decimal places
  return Math.round(convertedAmount * 100) / 100;
};

/**
 * Format currency with symbol and amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @param {boolean} includeCode - Include currency code in output
 * @returns {string} Formatted currency string
 */
window.formatCurrencyAmount = function(amount, currency, includeCode = false) {
  const info = CURRENCY_INFO[currency];
  if (!info) {
    return `${amount} ${currency}`;
  }
  
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  if (includeCode) {
    return `${info.symbol} ${formattedAmount} (${currency})`;
  }
  
  return `${info.symbol} ${formattedAmount}`;
};

/**
 * Get currency symbol
 * @param {string} currency - Currency code
 * @returns {string} Currency symbol
 */
window.getCurrencySymbol = function(currency) {
  return CURRENCY_INFO[currency]?.symbol || currency;
};

/**
 * Get currency name
 * @param {string} currency - Currency code
 * @returns {string} Currency name
 */
window.getCurrencyName = function(currency) {
  return CURRENCY_INFO[currency]?.name || currency;
};

/**
 * Get all supported currencies
 * @returns {Array} Array of currency codes
 */
window.getAllCurrencies = function() {
  return Object.keys(EXCHANGE_RATES);
};

/**
 * Get currency info
 * @param {string} currency - Currency code
 * @returns {Object} Currency info object
 */
window.getCurrencyInfo = function(currency) {
  return CURRENCY_INFO[currency] || { symbol: currency, name: currency, flag: "" };
};

/**
 * Get exchange rate
 * @param {string} currency - Currency code
 * @returns {number} Exchange rate per 1 USD
 */
window.getExchangeRate = function(currency) {
  return EXCHANGE_RATES[currency] || 1;
};

/**
 * Auto-fill all currency prices from a base price
 * Used in platform settings to quickly generate prices for all currencies
 * @param {number} basePrice - Base price amount
 * @param {string} baseCurrency - Base currency code
 * @returns {Object} Object with all currency codes as keys and converted prices as values
 */
window.autoFillCurrencyPrices = function(basePrice, baseCurrency) {
  const prices = {};
  const allCurrencies = Object.keys(EXCHANGE_RATES);
  
  allCurrencies.forEach(currency => {
    const converted = window.convertCurrency(basePrice, baseCurrency, currency);
    // Round to sensible amounts based on currency value
    if (EXCHANGE_RATES[currency] > 100) {
      // High-value currencies (e.g., TZS, UGX): round to nearest 100
      prices[currency] = Math.round(converted / 100) * 100;
    } else if (EXCHANGE_RATES[currency] > 10) {
      // Medium-value currencies (e.g., NGN, ZAR): round to nearest 10
      prices[currency] = Math.round(converted / 10) * 10;
    } else {
      // Low-value currencies (e.g., USD, EUR): round to nearest 1
      prices[currency] = Math.round(converted);
    }
  });
  
  return prices;
};

console.log('Currency converter loaded with', Object.keys(EXCHANGE_RATES).length, 'currencies');


