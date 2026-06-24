/**
 * Billing mode settings: system.billingMode ("Canada" | "USA") in organizations.settings.
 */
(function (global) {
  'use strict';

  const DEFAULT_MODE = 'Canada';
  const STORAGE_SUFFIX = '_billing_settings';

  function normalizeMode(mode) {
    const m = String(mode || DEFAULT_MODE).trim();
    if (m.toUpperCase() === 'USA' || m === 'US') return 'USA';
    return 'Canada';
  }

  function getOrgBillingSettings() {
    const user = JSON.parse(global.localStorage.getItem('user') || '{}');
    const org = user.org || 'Default';
    const key = typeof global.getDataKey === 'function'
      ? global.getDataKey('billing_settings').replace(/billing_settings$/, 'billing_settings')
      : `${org}${STORAGE_SUFFIX}`;
    const settingsKey = (typeof global.getDataKey === 'function')
      ? global.getDataKey('billing_settings')
      : `${org}_billing_settings`;
    try {
      return JSON.parse(global.localStorage.getItem(settingsKey) || '{}');
    } catch {
      return {};
    }
  }

  function saveOrgBillingSettingsLocal(patch) {
    const user = JSON.parse(global.localStorage.getItem('user') || '{}');
    const settingsKey = (typeof global.getDataKey === 'function')
      ? global.getDataKey('billing_settings')
      : `${user.org || 'Default'}_billing_settings`;
    const current = getOrgBillingSettings();
    const next = { ...current, ...patch, system: { ...(current.system || {}), ...(patch.system || {}) } };
    global.localStorage.setItem(settingsKey, JSON.stringify(next));
    if (user.organizationId || user.organization_id) {
      user.settings = { ...(user.settings || {}), system: next.system };
      global.localStorage.setItem('user', JSON.stringify(user));
    }
    return next;
  }

  async function getBillingMode() {
    const local = getOrgBillingSettings();
    if (local.system?.billingMode) return normalizeMode(local.system.billingMode);

    const user = JSON.parse(global.localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (global.supabaseClient && orgId) {
      try {
        const { data } = await global.supabaseClient
          .from('organizations')
          .select('settings')
          .eq('id', orgId)
          .maybeSingle();
        const mode = data?.settings?.system?.billingMode;
        if (mode) {
          saveOrgBillingSettingsLocal({ system: { billingMode: normalizeMode(mode) } });
          return normalizeMode(mode);
        }
      } catch (e) {
        console.warn('[billing-mode] Could not load org settings:', e.message);
      }
    }
    return DEFAULT_MODE;
  }

  async function setBillingMode(mode) {
    const normalized = normalizeMode(mode);
    saveOrgBillingSettingsLocal({ system: { billingMode: normalized }, billingMode: normalized });

    const user = JSON.parse(global.localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (typeof global.saveOrganizationSetting === 'function' && orgId) {
      await global.saveOrganizationSetting(orgId, 'billingMode', normalized);
    } else if (global.supabaseClient && orgId) {
      try {
        const { data: orgData } = await global.supabaseClient
          .from('organizations')
          .select('settings')
          .eq('id', orgId)
          .maybeSingle();
        const settings = {
          ...(orgData?.settings || {}),
          billingMode: normalized,
          system: { ...(orgData?.settings?.system || {}), billingMode: normalized }
        };
        await global.supabaseClient.from('organizations').update({ settings }).eq('id', orgId);
      } catch (e) {
        console.warn('[billing-mode] Supabase save failed:', e.message);
      }
    }

    if (global.MediForgeBillingService?.reload) {
      await global.MediForgeBillingService.reload(normalized);
    }
    global.dispatchEvent(new CustomEvent('mediforge:billingModeChanged', { detail: { mode: normalized } }));
    return normalized;
  }

  function applyBillingLabels(labels) {
    if (!labels) return;
    document.querySelectorAll('[data-billing-label]').forEach((el) => {
      const key = el.getAttribute('data-billing-label');
      if (labels[key]) el.textContent = labels[key];
    });
  }

  global.MediForgeBillingMode = {
    getBillingMode,
    setBillingMode,
    normalizeMode,
    getOrgBillingSettings,
    applyBillingLabels,
    isPayerLedBilling: async () => {
      const mode = await getBillingMode();
      return mode === 'Canada' || mode === 'USA';
    },
    DEFAULT_MODE
  };
})(typeof window !== 'undefined' ? window : global);
