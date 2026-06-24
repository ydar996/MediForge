'use strict';

/**
 * OHIP / MCEDT-style claim batch export from billing drafts.
 */
(function (global) {
  function formatDob(dob) {
    if (!dob) return '';
    const s = String(dob).replace(/-/g, '');
    return s.length === 8 ? s : dob;
  }

  function buildClaimBatchFromInvoice(invoice, patient, provider, serviceLines) {
    const org = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      format: 'mcedt_batch',
      payerCode: 'OHIP',
      province: 'ON',
      status: 'draft',
      generatedAt: new Date().toISOString(),
      submitter: {
        billingNumber: provider.billingNumber || provider.ohipBillingNumber || '',
        groupNumber: provider.groupNumber || '0001',
        softwareVendor: 'MEDIFORGE',
        organizationId: org.organizationId || org.organization_id
      },
      claims: [{
        claimReference: invoice.invoiceNumber || invoice.id,
        serviceDate: (invoice.date || invoice.createdAt || '').slice(0, 10),
        patient: {
          phn: patient.phn || patient.healthCardNumber || '',
          versionCode: patient.healthCardVersion || patient.versionCode || '',
          lastName: (patient.lastName || '').toUpperCase(),
          firstName: (patient.firstName || '').toUpperCase(),
          dob: formatDob(patient.dob),
          gender: (patient.gender || '').charAt(0).toUpperCase()
        },
        serviceLines: (serviceLines || []).map((line, idx) => ({
          lineNumber: idx + 1,
          feeCode: line.feeCode || line.serviceCode || line.code,
          diagnosticCode: (line.diagnosisCodes && line.diagnosisCodes[0]) || line.diagnosisCode || '',
          amount: line.amount || line.price || 0,
          units: line.units || 1,
          description: line.description || line.name
        }))
      }],
      notes: 'MediForge draft claim batch. Not submitted to MOH until MCEDT credentials configured.'
    };
  }

  function downloadClaimBatch(batch, filename) {
    const blob = new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `ohip-claim-batch-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportInvoiceAsClaimDraft(invoice, patient, provider, serviceLines) {
    const batch = buildClaimBatchFromInvoice(invoice, patient, provider, serviceLines);
    downloadClaimBatch(batch, `ohip-${batch.claims[0].claimReference || 'draft'}.json`);
    if (typeof global.logAuditEvent === 'function') {
      global.logAuditEvent('ohip_claim_draft_exported', {
        invoice_id: invoice.id,
        patient_id: patient.id,
        line_count: (serviceLines || []).length
      });
    }
    return batch;
  }

  global.MediForgeOhipClaimExport = {
    buildClaimBatchFromInvoice,
    exportInvoiceAsClaimDraft,
    downloadClaimBatch
  };
})(typeof window !== 'undefined' ? window : globalThis);
