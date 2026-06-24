'use strict';

(function (global) {
  const STORAGE_KEY = 'mediforge_mcedt_settings';

  function loadLocalSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveLocalSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  async function loadOrgSettings() {
    const local = loadLocalSettings();
    if (!global.supabase) return local;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return local;
    const { data, error } = await global.supabase.from('organizations').select('settings').eq('id', orgId).single();
    if (error || !data) return local;
    const mcedt = data.settings?.mcedt || {};
    return { ...local, ...mcedt };
  }

  async function saveOrgSettings(settings) {
    saveLocalSettings(settings);
    if (!global.supabase) return { ok: true, localOnly: true };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return { ok: true, localOnly: true };
    const { data: org } = await global.supabase.from('organizations').select('settings').eq('id', orgId).single();
    const merged = { ...(org?.settings || {}), mcedt: settings };
    const { error } = await global.supabase.from('organizations').update({ settings: merged }).eq('id', orgId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function checkEligibility(patient) {
    if (!global.MediForgeInteropClient) return { message: 'Interop client not loaded' };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return global.MediForgeInteropClient.call('checkOhipEligibility', {
      patient,
      organizationId: user.organizationId || user.organization_id,
      userId: user.id
    });
  }

  global.MediForgeMcedtSettings = {
    loadOrgSettings,
    saveOrgSettings,
    checkEligibility
  };
})(typeof window !== 'undefined' ? window : globalThis);
