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
    const merged = {
      ...(order?.results || {}),
      ...chartResults.results,
      _interop: {
        source: 'hl7_oru',
        critical: chartResults.critical === true,
        at: new Date().toISOString()
      }
    };

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

  async function exportLabOrderFhir({ patientId, order, orderId }) {
    if (!global.MediForgeInteropClient?.generateLabFhir) return { error: 'Client not loaded' };
    const patient = normalizePatient(await loadPatient(patientId));
    const orgId = await resolveOrgId();
    const consent = await checkOlisConsentForPatient(patientId);
    if (consent.blocked) return consent;
    return global.MediForgeInteropClient.generateLabFhir({
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

  async function applyImagingResultsToOrder(orderId, chartResults, wadoUrl) {
    if (!orderId || !chartResults) return;
    const supabase = global.supabaseClient || global.supabase;
    if (!supabase) return;

    const { data: order } = await supabase.from('orders').select('results').eq('id', orderId).single();
    const merged = {
      ...(order?.results || {}),
      ...(chartResults.results || {}),
      _interop: {
        source: chartResults.standard || 'imaging_report',
        placerOrderNumber: chartResults.placerOrderNumber || null,
        at: new Date().toISOString()
      }
    };
    if (wadoUrl) {
      merged._imaging = merged._imaging || {};
      merged._imaging.studies = merged._imaging.studies || [];
      merged._imaging.studies.push({ wadoUrl, linkedAt: new Date().toISOString() });
    }

    await supabase.from('orders').update({
      results: merged,
      status: 'completed',
      portal_results_status: 'awaiting_review',
      completed_at: new Date().toISOString()
    }).eq('id', orderId);
  }

  async function ingestImagingAndApply({ rawHl7, fhirBundle, orderSerial, orderId, wadoUrl }) {
    if (!global.MediForgeInteropClient) return { error: 'Interop client not loaded' };
    try {
      const orgId = await resolveOrgId();
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await global.MediForgeInteropClient.ingestImagingReport({
        organizationId: orgId,
        rawHl7,
        fhirBundle,
        userId: user.id || user.username
      });
      const chart = response.result?.chart || response.chart;
      if (!chart) return { error: 'No chart mapping returned', response };

      let targetOrderId = orderId;
      if (!targetOrderId && (orderSerial || chart.placerOrderNumber)) {
        const found = await MediForgeImagingResultsQueue?.findOrderBySerial?.(orderSerial || chart.placerOrderNumber);
        targetOrderId = found?.id;
      }
      if (targetOrderId) {
        await applyImagingResultsToOrder(targetOrderId, chart, wadoUrl);
        return { applied: true, orderId: targetOrderId, chart };
      }
      return { applied: false, chart, message: 'Order not found; set order serial.' };
    } catch (err) {
      return { error: err.message };
    }
  }

  async function exportImagingOrderHl7({ patientId, order, orderId }) {
    if (!global.MediForgeInteropClient?.generateImagingHl7) return { error: 'Client not loaded' };
    const patient = normalizePatient(await loadPatient(patientId));
    const orgId = await resolveOrgId();
    return global.MediForgeInteropClient.generateImagingHl7({
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

  async function exportImagingOrderFhir({ patientId, order, orderId }) {
    if (!global.MediForgeInteropClient?.generateImagingFhir) return { error: 'Client not loaded' };
    const patient = normalizePatient(await loadPatient(patientId));
    const orgId = await resolveOrgId();
    return global.MediForgeInteropClient.generateImagingFhir({
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

  async function launchConnectingOntario({ patientId, purpose }) {
    if (!global.MediForgeInteropClient?.connectingOntarioLaunch) return { error: 'Client not loaded' };
    const patient = normalizePatient(await loadPatient(patientId));
    const orgId = await resolveOrgId();
    return global.MediForgeInteropClient.connectingOntarioLaunch({
      organizationId: orgId,
      patient,
      purpose
    });
  }

  async function launchSmartFhir({ patientId, scope, launch }) {
    if (!global.MediForgeInteropClient?.smartLaunch) return { error: 'Client not loaded' };
    const patient = normalizePatient(await loadPatient(patientId));
    const orgId = await resolveOrgId();
    return global.MediForgeInteropClient.smartLaunch({
      organizationId: orgId,
      patient,
      scope,
      launch
    });
  }

  async function attachDicomStudyToOrder({ orderId, studyInstanceUid, wadoUrl, seriesUid }) {
    const supabase = global.supabaseClient || global.supabase;
    if (!supabase || !orderId) return { error: 'Database required' };
    const { data: order } = await supabase.from('orders').select('results').eq('id', orderId).single();
    const res = await global.MediForgeInteropClient?.callGateway?.({
      action: 'attachDicomStudy',
      existingResults: order?.results || {},
      studyInstanceUid,
      wadoUrl,
      seriesUid
    });
    const merged = res?.result?.results || res?.results;
    if (!merged) return { error: 'Attach failed' };
    await supabase.from('orders').update({ results: merged }).eq('id', orderId);
    return { ok: true, results: merged };
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

  async function checkErxConsentForPatient(patientId) {
    if (!global.MediForgePatientConsent?.hasErxConsent) return { ok: true, skipped: true };
    return global.MediForgePatientConsent.hasErxConsent(patientId);
  }

  async function transmitPrescription({ patientId, prescription, pharmacy }) {
    if (!global.MediForgeInteropClient) return { skipped: true };
    if (prescription?.pharmacy_status === 'pending') return { skipped: true, reason: 'in-house pharmacy' };
    if (prescription?.status !== 'signed') return { skipped: true, reason: 'not signed' };

    try {
      const consent = await checkErxConsentForPatient(patientId);
      if (consent.blocked) return consent;
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
        userId: user.id,
        erxConsentGranted: true,
        pharmacy
      });
    } catch (err) {
      console.warn('[interop] rx transmit failed:', err.message);
      return { error: err.message };
    }
  }

  async function queueProvincialRx({ patientId, prescription, pharmacy }) {
    return transmitPrescription({ patientId, prescription, pharmacy });
  }

  async function cancelProvincialRx({ patientId, prescription, reason }) {
    if (!global.MediForgeInteropClient) return { error: 'Client not loaded' };
    const consent = await checkErxConsentForPatient(patientId);
    if (consent.blocked) return consent;
    const orgId = await resolveOrgId();
    const patient = normalizePatient(await loadPatient(patientId));
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return global.MediForgeInteropClient.callGateway({
      action: 'cancelPrescription',
      organizationId: orgId,
      patient,
      prescription,
      userId: user.id,
      erxConsentGranted: true,
      reason
    });
  }

  async function requestRxRenewal({ patientId, prescription }) {
    if (!global.MediForgeInteropClient) return { error: 'Client not loaded' };
    const consent = await checkErxConsentForPatient(patientId);
    if (consent.blocked) return consent;
    const orgId = await resolveOrgId();
    const patient = normalizePatient(await loadPatient(patientId));
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return global.MediForgeInteropClient.callGateway({
      action: 'requestPrescriptionRenewal',
      organizationId: orgId,
      patient,
      prescription,
      userId: user.id,
      erxConsentGranted: true,
      requestedBy: user.username || user.email
    });
  }

  async function ingestDispenseAndApply({ fhirBundle }) {
    if (!global.MediForgeInteropClient) return { error: 'Client not loaded' };
    const orgId = await resolveOrgId();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const response = await global.MediForgeInteropClient.callGateway({
      action: 'ingestMedicationDispense',
      organizationId: orgId,
      fhirBundle,
      userId: user.id
    });
    const feedback = response.result || response;
    if (!feedback?.parsed) return { applied: false, feedback };

    const ref = feedback.prescriptionRef || '';
    const num = ref.includes('/') ? ref.split('/').pop() : ref;
    const rx = await MediForgeErxQueue?.findPrescriptionByNumber?.(num);
    if (!rx) return { applied: false, feedback, message: 'Prescription not matched.' };

    const patch = {
      erx_dispense_status: feedback.pharmacyStatus || feedback.status,
      erx_status: feedback.pharmacyStatus === 'filled' || feedback.status === 'completed' ? 'dispensed' : rx.erx_status,
      pharmacy_status: feedback.pharmacyStatus === 'filled' ? 'filled' : rx.pharmacy_status,
      filled_at: feedback.whenHandedOver || rx.filled_at
    };
    await MediForgeErxQueue?.patchPrescription?.(rx.id, patch);
    return { applied: true, prescriptionId: rx.id, feedback, patch };
  }

  global.MediForgeInterop = {
    transmitLabOrder,
    transmitImagingOrder,
    transmitPrescription,
    queueProvincialRx,
    cancelProvincialRx,
    requestRxRenewal,
    ingestDispenseAndApply,
    applyLabResultsToOrder,
    applyImagingResultsToOrder,
    ingestOruAndApply,
    ingestImagingAndApply,
    exportLabOrderHl7,
    exportLabOrderFhir,
    exportImagingOrderHl7,
    exportImagingOrderFhir,
    launchConnectingOntario,
    launchSmartFhir,
    attachDicomStudyToOrder,
    loadPatient,
    normalizePatient
  };
})(typeof window !== 'undefined' ? window : global);
