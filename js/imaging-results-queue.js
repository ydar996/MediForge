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
      .eq('type', 'imaging')
      .in('portal_results_status', ['awaiting_review', 'order_sent'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('Imaging queue load:', error.message);
      return [];
    }
    return (data || []).filter(
      (o) => o.portal_results_status === 'awaiting_review' || o.results?._interop || o.results?._imaging
    );
  }

  async function findOrderBySerial(serial) {
    if (!global.supabase || !serial) return null;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data } = await global.supabase
      .from('orders')
      .select('*')
      .eq('organization_id', orgId)
      .eq('type', 'imaging')
      .or(`serial_number.eq.${serial},id.eq.${serial}`)
      .maybeSingle();
    return data;
  }

  function renderQueue(container, rows) {
    if (!rows.length) {
      container.innerHTML =
        '<p>No inbound imaging reports awaiting review. Paste an ORU or FHIR DiagnosticReport below.</p>';
      return;
    }
    const html = [
      '<table class="img-table"><thead><tr><th>Order</th><th>Patient</th><th>Status</th><th>DICOM</th><th>Actions</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      const dicom = r.results?._imaging?.studies?.length ? 'Linked' : 'n/a';
      html.push(
        `<tr><td>${r.serial_number || r.id}</td>` +
          `<td><a href="patient-details?patientId=${encodeURIComponent(r.patient_id)}">${r.patient_id}</a></td>` +
          `<td>${r.portal_results_status || r.status}</td>` +
          `<td>${dicom}</td>` +
          `<td><a href="view-order?orderId=${encodeURIComponent(r.id)}">Review</a></td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeImagingResultsQueue = {
    loadAwaitingReviewOrders,
    findOrderBySerial,
    renderQueue
  };
})(typeof window !== 'undefined' ? window : globalThis);
