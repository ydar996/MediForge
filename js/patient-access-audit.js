'use strict';

/**
 * Log patient chart access to audit trail (Supabase + local).
 */
(function (global) {
  function getPatientIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('patientId');
  }

  async function logPatientChartAccess(action, extra) {
    const patientId = getPatientIdFromUrl();
    if (!patientId) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const details = { patient_id: patientId, page: window.location.pathname, ...(extra || {}) };
    if (typeof global.logAuditEvent === 'function') {
      await global.logAuditEvent(action || 'patient_chart_viewed', details);
    }
    if (global.supabase && user.organizationId) {
      try {
        await global.supabase.rpc('log_patient_chart_access', {
          p_organization_id: user.organizationId,
          p_username: user.username || user.email || 'unknown',
          p_patient_id: patientId,
          p_action: action || 'patient_chart_viewed',
          p_details: details
        });
      } catch (err) {
        console.warn('Patient access RPC unavailable (run migration):', err.message);
      }
    }
  }

  function initPatientAccessAudit() {
    if (!/patient-details|cpp-patient-summary|patient-consents/i.test(window.location.pathname)) return;
    logPatientChartAccess('patient_chart_viewed');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPatientAccessAudit);
  } else {
    initPatientAccessAudit();
  }

  global.MediForgePatientAccessAudit = { logPatientChartAccess };
})(typeof window !== 'undefined' ? window : globalThis);
