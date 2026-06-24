/**
 * Registration and encounter workflow hooks for provincial hub integration.
 * Registers PHN on patient save; optional claim submission after invoice.
 */
(function (global) {
  async function resolveOrgId() {
    if (typeof global.resolveOrganizationId === 'function') {
      return global.resolveOrganizationId();
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.organizationId || user.organization_id;
  }

  function normalizePatient(patient) {
    if (!patient) return null;
    return {
      id: patient.id,
      firstName: patient.firstName || patient.first_name,
      lastName: patient.lastName || patient.last_name,
      dob: patient.dob,
      gender: patient.gender,
      province: patient.province || patient.state,
      phn: patient.phn || patient.healthCardNumber || patient.health_card_number || patient.ohip,
      healthCardNumber: patient.healthCardNumber || patient.health_card_number,
      versionCode: patient.healthCardVersion || patient.versionCode || patient.version_code
    };
  }

  function resolveProvince(patient) {
    const province = (patient?.province || patient?.state || 'ON').toString().toUpperCase();
    if (province.length === 2) return province;
    const map = {
      ontario: 'ON',
      'british columbia': 'BC',
      alberta: 'AB',
      quebec: 'QC'
    };
    return map[province.toLowerCase()] || 'ON';
  }

  async function registerPatientIdentifiers(patient) {
    if (!global.MediForgeInteropClient) return { skipped: true };
    const normalized = normalizePatient(patient);
    if (!normalized?.phn) return { skipped: true, reason: 'no PHN' };

    try {
      const orgId = await resolveOrgId();
      const province = resolveProvince(normalized);
      const match = await global.MediForgeInteropClient.matchPatient({
        phn: normalized.phn,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        dob: normalized.dob,
        province,
        candidates: [normalized]
      });

      if (global.supabaseClient && orgId && normalized.id) {
        const phnValue = String(normalized.phn).replace(/\s/g, '').toUpperCase();
        await global.supabaseClient.from('patient_identifiers').upsert(
          {
            patient_id: normalized.id,
            organization_id: orgId,
            system: 'http://ehealthontario.ca/fhir/NamingSystem/id-on-patient-hcn',
            value: phnValue,
            province,
            active: true
          },
          { onConflict: 'organization_id,system,value' }
        ).catch(() => {});
      }

      if (typeof global.logAuditEvent === 'function') {
        global.logAuditEvent('interop_patient_registered', { patientId: normalized.id, province, matched: match?.matched });
      }
      return { province, match };
    } catch (err) {
      console.warn('[integration-workflow] patient register failed:', err.message);
      return { error: err.message };
    }
  }

  async function submitClaimForInvoice(invoice, patient, services, provider) {
    if (!global.MediForgeInteropClient || !invoice) return { skipped: true };
    try {
      const orgId = await resolveOrgId();
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const normalized = normalizePatient(patient);
      const province = resolveProvince(normalized);
      const payerCode = invoice.payerCode || invoice.payer_code || 'OHIP';

      return await global.MediForgeInteropClient.submitClaim({
        organizationId: orgId,
        patient: normalized,
        provider: provider || { organizationId: orgId, billingNumber: user.billingNumber || user.ohipBillingNumber },
        invoice,
        services: services || invoice.services || [],
        payerCode,
        userId: user.id || user.username,
        province
      });
    } catch (err) {
      console.warn('[integration-workflow] claim submit failed:', err.message);
      return { error: err.message };
    }
  }

  global.MediForgeIntegrationWorkflow = {
    registerPatientIdentifiers,
    submitClaimForInvoice,
    resolveProvince,
    normalizePatient
  };
})(typeof window !== 'undefined' ? window : global);
