'use strict';

(function (global) {
  async function loadAwaitingReviewOrders() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('orders')
      .select('id, serial_number, patient_id, portal_results_status, results, status, created_at')
      .eq('organization_id', orgId)
      .eq('type', 'lab')
      .in('portal_results_status', ['awaiting_review', 'order_sent'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('Lab queue load:', error.message);
      return [];
    }
    return (data || []).filter((o) => o.portal_results_status === 'awaiting_review' || o.results?._interop);
  }

  async function findOrderBySerial(serial) {
    if (!global.supabase || !serial) return null;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data } = await global.supabase
      .from('orders')
      .select('*')
      .eq('organization_id', orgId)
      .eq('serial_number', serial)
      .maybeSingle();
    return data;
  }

  function renderQueue(container, rows) {
    if (!rows.length) {
      container.innerHTML =
        '<p>No inbound lab results awaiting review. Paste an ORU message below or ingest from an external lab order.</p>';
      return;
    }
    const html = [
      '<table class="lab-table"><thead><tr><th>Order</th><th>Patient</th><th>Status</th><th>Critical</th><th>Actions</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      const crit = r.results?._interop?.critical ? '<span class="badge crit">Yes</span>' : 'No';
      html.push(
        `<tr><td>${r.serial_number || r.id}</td>` +
          `<td><a href="patient-details?patientId=${encodeURIComponent(r.patient_id)}">${r.patient_id}</a></td>` +
          `<td>${r.portal_results_status || r.status}</td>` +
          `<td>${crit}</td>` +
          `<td><a href="doctor-lab-results?orderId=${encodeURIComponent(r.id)}">Review</a></td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeLabResultsQueue = {
    loadAwaitingReviewOrders,
    findOrderBySerial,
    renderQueue
  };
})(typeof window !== 'undefined' ? window : globalThis);
