'use strict';

(function (global) {
  async function loadAwaitingReports() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('hrm_inbound_reports')
      .select('id, patient_id, placer_id, report_title, status, created_at')
      .eq('organization_id', orgId)
      .eq('status', 'awaiting_review')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('HRM inbox load:', error.message);
      return [];
    }
    return data || [];
  }

  async function insertReport(row) {
    if (!global.supabase) return { error: 'Database not configured' };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data, error } = await global.supabase
      .from('hrm_inbound_reports')
      .insert({ ...row, organization_id: orgId })
      .select()
      .single();
    return error ? { error: error.message } : { data };
  }

  async function fileReport(id, patientId) {
    if (!global.supabase) return { error: 'Database not configured' };
    const { error } = await global.supabase
      .from('hrm_inbound_reports')
      .update({ status: 'filed', patient_id: patientId, filed_at: new Date().toISOString() })
      .eq('id', id);
    return error ? { error: error.message } : { ok: true };
  }

  function renderQueue(container, rows) {
    if (!rows.length) {
      container.innerHTML =
        '<p>No hospital reports awaiting review. Paste an HL7 MDM/ORU or FHIR DocumentReference below.</p>';
      return;
    }
    const html = [
      '<table class="hrm-table"><thead><tr><th>Report</th><th>Patient</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      html.push(
        `<tr><td>${r.report_title || r.id}</td>` +
          `<td>${r.patient_id ? `<a href="patient-details?patientId=${encodeURIComponent(r.patient_id)}">${r.patient_id}</a>` : 'Unmatched'}</td>` +
          `<td>${r.status}</td>` +
          `<td><button type="button" class="btn-sm" data-file="${r.id}">Mark filed</button></td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeHrmInbox = { loadAwaitingReports, insertReport, fileReport, renderQueue };
})(typeof window !== 'undefined' ? window : globalThis);
