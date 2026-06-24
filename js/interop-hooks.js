/**
 * Workflow hooks: call interoperability gateway after order/Rx save
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
      middleName: patient.middleName || patient.middle_name,
      dob: patient.dob,
      gender: patient.gender,
      phn: patient.phn || patient.healthCardNumber || patient.health_card_number || patient.ohip
    };
  }

  async function loadPatient(patientId) {
    if (typeof global.loadPatientsWithSupabasePriority === 'function') {
      const patients = await global.loadPatientsWithSupabasePriority();
      return patients.find((p) => p.id === patientId);
    }
    const patients = JSON.parse(localStorage.getItem(global.getDataKey?.('patients') || 'patients') || '[]');
    return patients.find((p) => p.id === patientId);
  }

  async function applyLabResultsToOrder(orderId, chartResults) {
    if (!orderId || !chartResults?.results) return;
    const supabase = global.supabaseClient;
    if (!supabase) return;

    const { data: order } = await supabase.from('orders').select('results').eq('id', orderId).single();
    const merged = { ...(order?.results || {}), ...chartResults.results, _interop: { source: 'hl7_oru', at: new Date().toISOString() } };

    await supabase.from('orders').update({
      results: merged,
      status: 'completed',
      lab_status: 'completed',
      completed_at: new Date().toISOString(),
      portal_results_status: 'awaiting_review'
    }).eq('id', orderId);

    if (chartResults.critical && typeof global.showErrorNotification === 'function') {
      global.showErrorNotification('Critical lab result received: review immediately.');
    }
  }

  async function checkOlisConsentForPatient(patientId) {
    if (!global.MediForgePatientConsent?.hasOlisConsent) return { ok: true, skipped: true };
    return global.MediForgePatientConsent.hasOlisConsent(patientId);
  }

  async function ingestOruAndApply({ rawHl7, orderSerial, orderId, patientId }) {
    if (!global.MediForgeInteropClient) return { error: 'Interop client not loaded' };
    try {
      if (patientId) {
        const consent = await checkOlisConsentForPatient(patientId);
        if (consent.blocked) return consent;
      }
      const orgId = await resolveOrgId();
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await global.MediForgeInteropClient.ingestOru({
        organizationId: orgId,
        rawHl7,
        userId: user.id || user.username,
        olisConsentGranted: true
      });
      const chart = response.result?.chart || response.chart;
      if (!chart) return { error: 'No chart mapping returned', response };

      let targetOrderId = orderId;
      if (!targetOrderId && (orderSerial || chart.placerOrderNumber)) {
        const found = await MediForgeLabResultsQueue?.findOrderBySerial?.(orderSerial || chart.placerOrderNumber);
        targetOrderId = found?.id;
      }
      if (targetOrderId) {
        await applyLabResultsToOrder(targetOrderId, chart);
        return { applied: true, orderId: targetOrderId, critical: chart.critical, ack: response.result?.ack };
      }
      return { applied: false, chart, message: 'Order not found; use preview or set order serial.' };
    } catch (err) {
      return { error: err.message };
    }
  }

  async function exportLabOrderHl7({ patientId, order, orderId }) {
    if (!global.MediForgeInteropClient?.generateLabHl7) return { error: 'Client not loaded' };
    const patient = normalizePatient(await loadPatient(patientId));
    const orgId = await resolveOrgId();
    const consent = await checkOlisConsentForPatient(patientId);
    if (consent.blocked) return consent;
    return global.MediForgeInteropClient.generateLabHl7({
      organizationId: orgId,
      patient,
      order: {
        id: orderId,
        serial_number: order?.serial_number || order?.serialNumber,
        selected_items: order?.selected_items || order?.selectedItems,
        timestamp: order?.timestamp
      }
    });
  }

  async function transmitLabOrder({ patientId, order, orderId }) {
    if (!global.MediForgeInteropClient) return { skipped: true, reason: 'client not loaded' };
    const consent = await checkOlisConsentForPatient(patientId);
    if (consent.blocked) return consent;
    try {
      const orgId = await resolveOrgId();
      const patient = normalizePatient(await loadPatient(patientId));
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const payload = {
        organizationId: orgId,
        patient,
        order: {
          id: orderId,
          serial_number: order?.serial_number || order?.serialNumber,
          selected_items: order?.selected_items || order?.selectedItems,
          timestamp: order?.timestamp || new Date().toISOString()
        },
        userId: user.id || user.username
      };
      const response = await global.MediForgeInteropClient.transmitLabOrder({
        ...payload,
        olisConsentGranted: true
      });
      if (typeof global.logAuditEvent === 'function') {
        global.logAuditEvent('interop_lab_order_sent', { orderId, serial: payload.order.serial_number, queued: response.result?.queued });
      }
      return response;
    } catch (err) {
      console.warn('[interop] lab transmit failed:', err.message);
      return { error: err.message };
    }
  }

  async function transmitImagingOrder({ patientId, order, orderId }) {
    if (!global.MediForgeInteropClient) return { skipped: true };
    try {
      const orgId = await resolveOrgId();
      const patient = normalizePatient(await loadPatient(patientId));
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return await global.MediForgeInteropClient.transmitImagingOrder({
        organizationId: orgId,
        patient,
        order: {
          id: orderId,
          serial_number: order?.serial_number || order?.serialNumber,
          selected_items: order?.selected_items || order?.selectedItems,
          timestamp: order?.timestamp
        },
        userId: user.id
      });
    } catch (err) {
      console.warn('[interop] imaging transmit failed:', err.message);
      return { error: err.message };
    }
  }

  async function transmitPrescription({ patientId, prescription }) {
    if (!global.MediForgeInteropClient) return { skipped: true };
    if (prescription?.pharmacy_status === 'pending') return { skipped: true, reason: 'in-house pharmacy' };
    if (prescription?.status !== 'signed') return { skipped: true, reason: 'not signed' };

    try {
      const orgId = await resolveOrgId();
      const patient = normalizePatient(await loadPatient(patientId));
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      let medications = prescription.medications;
      if (typeof medications === 'string') {
        try { medications = JSON.parse(medications); } catch { medications = []; }
      }
      return await global.MediForgeInteropClient.transmitPrescription({
        organizationId: orgId,
        patient,
        prescription: { ...prescription, medications },
        userId: user.id
      });
    } catch (err) {
      console.warn('[interop] rx transmit failed:', err.message);
      return { error: err.message };
    }
  }

  global.MediForgeInterop = {
    transmitLabOrder,
    transmitImagingOrder,
    transmitPrescription,
    applyLabResultsToOrder,
    ingestOruAndApply,
    exportLabOrderHl7,
    loadPatient,
    normalizePatient
  };
})(typeof window !== 'undefined' ? window : global);
