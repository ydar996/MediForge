'use strict';

(function (global) {
  const STORAGE_KEY = 'mediforge_provincial_hub_settings';

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveLocal(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  async function loadOrgSettings() {
    const local = loadLocal();
    if (!global.supabase) return local;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return local;
    const { data } = await global.supabase.from('organizations').select('settings').eq('id', orgId).single();
    const hubs = data?.settings?.provincialHubs || {};
    return { ...local, ...hubs };
  }

  async function saveOrgSettings(settings) {
    saveLocal(settings);
    if (!global.supabase) return { ok: true, localOnly: true };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return { ok: true, localOnly: true };
    const { data: org } = await global.supabase.from('organizations').select('settings').eq('id', orgId).single();
    const merged = { ...(org?.settings || {}), provincialHubs: settings };
    const { error } = await global.supabase.from('organizations').update({ settings: merged }).eq('id', orgId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  global.MediForgeProvincialHubSettings = { loadOrgSettings, saveOrgSettings };
})(typeof window !== 'undefined' ? window : globalThis);
