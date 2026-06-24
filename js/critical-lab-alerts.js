'use strict';

(function (global) {
  async function loadCriticalLabOrders() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('orders')
      .select('id, serial_number, patient_id, portal_results_status, results, created_at')
      .eq('organization_id', orgId)
      .eq('type', 'lab')
      .eq('portal_results_status', 'awaiting_review')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return [];
    return (data || []).filter((o) => o.results?._interop?.critical === true);
  }

  function renderDashboardBanner(container, rows) {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';
    container.innerHTML =
      `<div style="background:#fdecea;border:2px solid #c62828;border-radius:10px;padding:14px 18px;margin:12px 0;">` +
      `<strong style="color:#c62828;">Critical lab results (${rows.length}):</strong> ` +
      `Review immediately. <a href="lab-results-queue" style="font-weight:700;margin-left:8px;">Open lab results queue</a></div>`;
  }

  global.MediForgeCriticalLabAlerts = { loadCriticalLabOrders, renderDashboardBanner };
})(typeof window !== 'undefined' ? window : globalThis);
