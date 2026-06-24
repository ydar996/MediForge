'use strict';

(function (global) {
  const TYPE_LABELS = {
    portal_access: 'Patient Portal',
    data_sharing: 'Data Sharing',
    olis_query: 'OLIS Query',
    hrm_query: 'HRM Hospital Reports',
    dhdr_query: 'DHDR Medication History',
    prescribeit_erx: 'PrescribeIT ePrescribing',
    research: 'Research / Quality'
  };

  async function loadOrgConsents() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('patient_consents')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('Consent management load:', error.message);
      return [];
    }
    return data || [];
  }

  function typeLabel(type) {
    return TYPE_LABELS[type] || type;
  }

  function renderTable(container, rows) {
    if (!rows.length) {
      container.innerHTML = '<p>No consent records yet. Staff capture consents from the patient chart (Consents button) or <a href="patient-consents">patient consents page</a>.</p>';
      return;
    }
    const html = ['<table class="consent-table"><thead><tr><th>Patient</th><th>Consent Type</th><th>Status</th><th>Updated</th><th>Notes</th></tr></thead><tbody>'];
    rows.forEach((r) => {
      const status = r.granted ? '<span class="badge granted">Granted</span>' : '<span class="badge revoked">Not granted / Revoked</span>';
      html.push(`<tr><td><a href="patient-details?patientId=${encodeURIComponent(r.patient_id)}">${r.patient_id}</a></td><td>${typeLabel(r.consent_type)}</td><td>${status}</td><td>${(r.updated_at || '').slice(0, 10)}</td><td>${r.notes || ''}</td></tr>`);
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeConsentManagement = { loadOrgConsents, renderTable, typeLabel };
})(typeof window !== 'undefined' ? window : globalThis);
