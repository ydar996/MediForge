'use strict';

(function (global) {
  async function loadErxQueue() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('prescriptions')
      .select(
        'id, patient_id, prescription_number, status, pharmacy_status, erx_status, erx_pharmacy_name, erx_dispense_status, erx_transmitted_at, medications, created_at'
      )
      .eq('organization_id', orgId)
      .in('status', ['signed', 'active'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('eRx queue load:', error.message);
      return [];
    }
    const rows = data || [];
    if (global.MediForgeRxWorkflow?.summarizeErxQueue) {
      return global.MediForgeRxWorkflow.summarizeErxQueue(rows);
    }
    return rows.filter(
      (p) =>
        p.pharmacy_status === 'external' ||
        ['queued', 'transmitted', 'renewal_requested', 'dispensed'].includes(p.erx_status)
    );
  }

  async function findPrescriptionByNumber(num) {
    if (!global.supabase || !num) return null;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data } = await global.supabase
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .or(`prescription_number.eq.${num},id.eq.${num}`)
      .maybeSingle();
    return data;
  }

  async function patchPrescription(id, patch) {
    if (!global.supabase) return { error: 'No database' };
    const { error } = await global.supabase.from('prescriptions').update(patch).eq('id', id);
    return error ? { error: error.message } : { ok: true };
  }

  function renderQueue(container, rows) {
    if (!rows.length) {
      container.innerHTML =
        '<p>No provincial eRx items in queue. Sign a prescription, set pharmacy to external, and queue for PrescribeIT transmit.</p>';
      return;
    }
    const html = [
      '<table class="erx-table"><thead><tr><th>Rx #</th><th>Patient</th><th>eRx status</th><th>Pharmacy</th><th>Dispense</th><th>Actions</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      html.push(
        `<tr data-rx-id="${r.id}">` +
          `<td>${r.prescription_number || r.id.slice(0, 8)}</td>` +
          `<td><a href="patient-details?patientId=${encodeURIComponent(r.patient_id)}">${r.patient_id}</a></td>` +
          `<td>${r.erx_status || 'n/a'}</td>` +
          `<td>${r.erx_pharmacy_name || 'n/a'}</td>` +
          `<td>${r.erx_dispense_status || 'n/a'}</td>` +
          `<td>` +
          `<button type="button" class="btn-sm btn-transmit" data-id="${r.id}" data-patient="${r.patient_id}">Transmit</button> ` +
          `<button type="button" class="btn-sm btn-cancel" data-id="${r.id}" data-patient="${r.patient_id}">Cancel</button> ` +
          `<button type="button" class="btn-sm btn-renew" data-id="${r.id}" data-patient="${r.patient_id}">Renewal</button>` +
          `</td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeErxQueue = {
    loadErxQueue,
    findPrescriptionByNumber,
    patchPrescription,
    renderQueue
  };
})(typeof window !== 'undefined' ? window : globalThis);
