'use strict';

const fs = require('fs');
const path = require('path');

let cached = null;

function loadBillingConfig(configPath) {
  if (cached) return cached;
  const resolved =
    configPath ||
    process.env.BILLING_CONFIG_PATH ||
    path.join(process.cwd(), 'config', 'billing-payers.json');

  if (!fs.existsSync(resolved)) return getDefaultConfig();
  cached = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return cached;
}

function getDefaultConfig() {
  return {
    version: '1.0',
    defaultCurrency: 'CAD',
    defaultCountry: 'CA',
    patientPaymentMethods: ['cash', 'check', 'bank_transfer', 'etransfer', 'zelle', 'card', 'debit'],
    provincialPayers: {},
    privateInsurers: {},
    paymentGateways: {},
    copayRules: { defaultCopay: 0, uninsuredMarkupPercent: 0 }
  };
}

function clearBillingConfigCache() {
  cached = null;
}

module.exports = { loadBillingConfig, getDefaultConfig, clearBillingConfigCache };
