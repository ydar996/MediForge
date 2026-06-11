// Payment Methods Configuration by Country
// Purpose: Determine which payment providers and methods are available for each African country

const PAYMENT_PROVIDERS = {
  // PAYSTACK - Nigeria, Ghana, South Africa, Kenya
  paystack: {
    name: 'Paystack',
    countries: ['Nigeria', 'Ghana', 'South Africa', 'Kenya'],
    currencies: ['NGN', 'GHS', 'ZAR', 'KES'],
    methods: ['card', 'bank_transfer', 'ussd', 'mobile_money', 'qr'],
    publicKey: 'pk_test_YOUR_PAYSTACK_PUBLIC_KEY', // Replace with actual key
    fees: {
      'NGN': { percentage: 1.5, cap: 2000, flat: 100 },
      'GHS': { percentage: 1.95, cap: null, flat: 0 },
      'ZAR': { percentage: 2.9, cap: null, flat: 0 },
      'KES': { percentage: 3.5, cap: null, flat: 0 }
    }
  },
  
  // FLUTTERWAVE - Pan-African (34+ countries)
  flutterwave: {
    name: 'Flutterwave',
    countries: [
      'Nigeria', 'Ghana', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Zambia',
      'South Africa', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Senegal',
      'Ivory Coast', 'Cameroon', 'Zimbabwe', 'Mozambique', 'Malawi', 'Botswana',
      'Namibia', 'Ethiopia', 'DR Congo', 'Angola', 'Mauritius', 'Seychelles'
    ],
    currencies: [
      'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'RWF', 'ZMW', 'ZAR', 'EGP',
      'MAD', 'TND', 'DZD', 'XOF', 'XAF', 'ZWL', 'MZN', 'MWK', 'BWP',
      'NAD', 'ETB', 'CDF', 'AOA', 'MUR', 'SCR', 'USD', 'EUR', 'GBP'
    ],
    methods: ['card', 'bank_transfer', 'mobile_money', 'ussd', 'mpesa'],
    publicKey: 'FLWPUBK_TEST-YOUR_FLUTTERWAVE_PUBLIC_KEY', // Replace with actual key
    fees: {
      'NGN': { percentage: 1.4, cap: null, flat: 0 },
      'default': { percentage: 3.8, cap: null, flat: 0 }
    }
  },
  
  // DPO PAY - East/Southern Africa specialist
  dpopay: {
    name: 'DPO Pay',
    countries: [
      'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'South Africa', 'Botswana',
      'Zambia', 'Zimbabwe', 'Mozambique', 'Malawi', 'Namibia', 'Mauritius'
    ],
    currencies: ['KES', 'UGX', 'TZS', 'RWF', 'ZAR', 'BWP', 'ZMW', 'ZWL', 'MZN', 'MWK', 'NAD', 'MUR'],
    methods: ['card', 'mobile_money', 'mpesa'],
    fees: {
      'default': { percentage: 2.5, cap: null, flat: 0 }
    }
  }
};

// Payment method details by type
const PAYMENT_METHOD_INFO = {
  'card': {
    icon: '💳',
    name: 'Debit/Credit Card',
    description: 'Pay with Visa, Mastercard, or Verve card',
    priority: 1
  },
  'bank_transfer': {
    icon: '🏦',
    name: 'Bank Transfer',
    description: 'Direct bank transfer via your bank',
    priority: 2
  },
  'ussd': {
    icon: '📱',
    name: 'USSD',
    description: 'Pay via *737# or other bank USSD codes',
    priority: 3
  },
  'mobile_money': {
    icon: '📲',
    name: 'Mobile Money',
    description: 'Pay with mobile money wallet',
    priority: 4
  },
  'mpesa': {
    icon: '💚',
    name: 'M-Pesa',
    description: 'Pay with M-Pesa mobile money',
    priority: 5
  },
  'qr': {
    icon: '📷',
    name: 'Scan to Pay',
    description: 'Scan QR code to pay',
    priority: 6
  },
  'manual_bank': {
    icon: '🏦',
    name: 'Manual Bank Transfer',
    description: 'Transfer to our bank account manually',
    priority: 7,
    alwaysAvailable: true
  }
};

/**
 * Get available payment providers for a country
 * @param {string} country - Country name
 * @returns {Array} Array of available provider IDs
 */
window.getAvailableProviders = function(country) {
  const available = [];
  
  for (const [providerId, provider] of Object.entries(PAYMENT_PROVIDERS)) {
    if (provider.countries.includes(country)) {
      available.push(providerId);
    }
  }
  
  return available;
};

/**
 * Get available payment methods for a country
 * @param {string} country - Country name
 * @param {string} currency - Currency code
 * @returns {Array} Array of available payment method objects
 */
window.getAvailablePaymentMethods = function(country, currency) {
  const methods = new Set();
  const providers = getAvailableProviders(country);
  
  // Collect all unique payment methods from available providers
  providers.forEach(providerId => {
    const provider = PAYMENT_PROVIDERS[providerId];
    if (provider.currencies.includes(currency)) {
      provider.methods.forEach(method => methods.add(method));
    }
  });
  
  // Always include manual bank transfer as fallback
  methods.add('manual_bank');
  
  // Convert to array with full info, sorted by priority
  const methodsArray = Array.from(methods).map(methodId => ({
    id: methodId,
    ...PAYMENT_METHOD_INFO[methodId],
    providers: providers.filter(p => PAYMENT_PROVIDERS[p].methods.includes(methodId))
  })).sort((a, b) => a.priority - b.priority);
  
  return methodsArray;
};

/**
 * Get best provider for a country and currency
 * @param {string} country - Country name
 * @param {string} currency - Currency code
 * @returns {string} Provider ID
 */
window.getBestProvider = function(country, currency) {
  const providers = getAvailableProviders(country);
  
  // Priority order: Paystack > Flutterwave > DPO Pay
  if (providers.includes('paystack') && PAYMENT_PROVIDERS.paystack.currencies.includes(currency)) {
    return 'paystack';
  }
  if (providers.includes('flutterwave') && PAYMENT_PROVIDERS.flutterwave.currencies.includes(currency)) {
    return 'flutterwave';
  }
  if (providers.includes('dpopay')) {
    return 'dpopay';
  }
  
  return 'manual_bank'; // Fallback to manual
};

/**
 * Get provider configuration
 * @param {string} providerId - Provider ID
 * @returns {Object} Provider configuration
 */
window.getProviderConfig = function(providerId) {
  return PAYMENT_PROVIDERS[providerId] || null;
};

/**
 * Calculate payment fees
 * @param {number} amount - Payment amount
 * @param {string} currency - Currency code
 * @param {string} providerId - Provider ID
 * @returns {Object} { fee, total }
 */
window.calculatePaymentFees = function(amount, currency, providerId) {
  const provider = PAYMENT_PROVIDERS[providerId];
  if (!provider) {
    return { fee: 0, total: amount };
  }
  
  const feeConfig = provider.fees[currency] || provider.fees.default || { percentage: 0, flat: 0, cap: null };
  
  let fee = (amount * feeConfig.percentage / 100) + (feeConfig.flat || 0);
  
  // Apply cap if exists
  if (feeConfig.cap && fee > feeConfig.cap) {
    fee = feeConfig.cap;
  }
  
  return {
    fee: Math.round(fee),
    total: amount + Math.round(fee)
  };
};

console.log('Payment methods configuration loaded');


