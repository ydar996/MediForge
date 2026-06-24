'use strict';

(function (global) {
  const CONSENT_TYPES = [
    { id: 'portal_access', label: 'Patient Portal Access', description: 'Patient may use the secure portal to view appointments, medications, and results.' },
    { id: 'data_sharing', label: 'Data Sharing With Care Team', description: 'Share chart information with authorized clinic staff and covered agents.' },
    { id: 'olis_query', label: 'OLIS Lab Query (Future)', description: 'When enabled, query Ontario lab network with patient consent.' },
    { id: 'research', label: 'De-Identified Quality / Research', description: 'Use de-identified data for quality improvement or research.' }
  ];

  async function loadConsents(patientId) {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('patient_consents')
      .select('*')
      .eq('organization_id', orgId)
      .eq('patient_id', patientId);
    if (error) {
      console.warn('Load consents:', error.message);
      return [];
    }
    return data || [];
  }

  async function saveConsent(patientId, consentType, granted, notes) {
    if (!global.supabase) throw new Error('Database not connected');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const row = {
      organization_id: orgId,
      patient_id: patientId,
      consent_type: consentType,
      granted: !!granted,
      granted_at: granted ? new Date().toISOString() : null,
      granted_by: granted ? (user.username || user.email) : null,
      revoked_at: granted ? null : new Date().toISOString(),
      notes: notes || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await global.supabase
      .from('patient_consents')
      .upsert(row, { onConflict: 'organization_id,patient_id,consent_type' });
    if (error) throw error;
    if (typeof global.logAuditEvent === 'function') {
      await global.logAuditEvent('patient_consent_updated', { patient_id: patientId, consent_type: consentType, granted: !!granted });
    }
    return row;
  }

  global.MediForgePatientConsent = {
    CONSENT_TYPES,
    loadConsents,
    saveConsent
  };
})(typeof window !== 'undefined' ? window : globalThis);
