'use strict';

(function (global) {
  const PHN_SYSTEM = 'http://ehealthontario.ca/fhir/NamingSystem/id-on-patient-hcn';

  async function loadOrgIdentifiers() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('patient_identifiers')
      .select('*')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('patient_identifiers load:', error.message);
      return [];
    }
    return data || [];
  }

  async function loadForPatient(patientId) {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data } = await global.supabase
      .from('patient_identifiers')
      .select('*')
      .eq('organization_id', orgId)
      .eq('patient_id', patientId)
      .eq('active', true);
    return data || [];
  }

  function renderTable(container, rows) {
    if (!rows.length) {
      container.innerHTML =
        '<p>No provincial identifiers registered yet. PHN is captured on patient registration and synced when patients are saved.</p>';
      return;
    }
    const html = [
      '<table class="id-table"><thead><tr><th>Patient</th><th>System</th><th>Value</th><th>Province</th><th>Updated</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      const sys = r.system === PHN_SYSTEM || r.system === 'PHN' ? 'OHIP PHN' : r.system;
      html.push(
        `<tr><td><a href="patient-details?patientId=${encodeURIComponent(r.patient_id)}">${r.patient_id}</a></td>` +
          `<td>${sys}</td><td>${r.value}</td><td>${r.province || ''}</td>` +
          `<td>${(r.updated_at || r.created_at || '').slice(0, 10)}</td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgePatientIdentifiers = {
    PHN_SYSTEM,
    loadOrgIdentifiers,
    loadForPatient,
    renderTable
  };
})(typeof window !== 'undefined' ? window : globalThis);
