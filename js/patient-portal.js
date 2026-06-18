/**
 * Patient portal shared helpers — order status, prescriptions, messaging.
 */
(function (global) {
  'use strict';

  function parseJsonField(val, fallback) {
    if (Array.isArray(val)) return val;
    if (!val) return fallback;
    if (typeof val === 'string') {
      try {
        const p = JSON.parse(val);
        return Array.isArray(p) ? p : fallback;
      } catch (_) {
        return fallback;
      }
    }
    return fallback;
  }

  const RESULT_FIELD_METADATA = new Set([
    'status', 'entered_at', 'entered_by', 'auditTrail', 'AuditTrail',
    'completed_at', 'completed_by', 'started_at', 'started_by',
    'reviewed_at', 'reviewed_by', 'doctor_note', 'doctor_note_by', 'doctor_note_updated_at',
    'file_name', 'file_data', 'file_type', 'file_size', '_attachments', '_interop'
  ]);

  function parseOrderResultsObject(order) {
    const raw = order?.results;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (_) { return {}; }
    }
    return typeof raw === 'object' && raw !== null ? raw : {};
  }

  function resultFieldHasValue(val) {
    if (val == null) return false;
    if (typeof val === 'object') {
      if (val.value != null && String(val.value).trim() !== '' && String(val.value).trim() !== 'Not Tested') return true;
      if (val.result != null && String(val.result).trim() !== '' && String(val.result).trim() !== 'Not Tested') return true;
      return false;
    }
    const s = String(val).trim();
    return s !== '' && s !== 'Not Tested';
  }

  function testHasLabResultData(testObj) {
    if (!testObj || typeof testObj !== 'object') return false;
    if (testObj.file_name && testObj.file_data) return true;
    if (String(testObj.status || '').toLowerCase() === 'completed') return true;
    if (testObj.notes && String(testObj.notes).trim()) return true;
    return Object.entries(testObj).some(([k, v]) => {
      if (RESULT_FIELD_METADATA.has(k)) return false;
      return resultFieldHasValue(v);
    });
  }

  function orderLabResultsReceived(order) {
    const results = parseOrderResultsObject(order);
    const keys = Object.keys(results).filter((k) => !k.startsWith('_'));
    if (keys.some((k) => testHasLabResultData(results[k]))) return true;

    const labStatus = String(order.lab_status || '').toLowerCase();
    const status = String(order.status || '').toLowerCase();
    if (order.completed_at && (labStatus.includes('complete') || status.includes('complete'))) {
      return true;
    }
    return false;
  }

  function orderHasResultPayload(order) {
    return orderLabResultsReceived(order);
  }

  function portalOrderResultsAreVisible(order) {
    if (!order) return false;
    const explicit = (order.portal_results_status || '').toLowerCase();
    if (explicit === 'published' || order.portal_results_published_at) return true;
    if (order.provider_reviewed_at) return true;
    return false;
  }

  function getOrderPortalStatus(order) {
    if (!order) {
      return { key: 'unknown', label: 'Unknown', tone: 'muted', canView: false, canViewOrder: false };
    }

    if (portalOrderResultsAreVisible(order)) {
      return {
        key: 'results_available',
        label: 'Reviewed — results available',
        tone: 'success',
        canView: true,
        canViewOrder: true,
        subtext: 'Your provider has reviewed these results. You can open them below.'
      };
    }

    if (orderLabResultsReceived(order)) {
      return {
        key: 'awaiting_provider_review',
        label: 'Test Completed: Awaiting Provider Review',
        tone: 'warning',
        canView: false,
        canViewOrder: true,
        subtext: 'Results have been received from the lab or imaging centre. Your provider will review and release them to you.'
      };
    }

    return {
      key: 'order_sent',
      label: 'Order Sent',
      tone: 'info',
      canView: false,
      canViewOrder: true,
      subtext: 'Your order has been sent to the laboratory or imaging centre. You can print a copy of the order below.'
    };
  }

  function sanitizeOrderForPatientPortal(order) {
    if (!order) return order;
    const status = getOrderPortalStatus(order);
    if (status.canView) return order;
    const safe = { ...order };
    delete safe.results;
    safe._portalResultsHeld = true;
    return safe;
  }

  function getPrescriptionPortalStatus(rx) {
    const status = String(rx.status || 'pending').toLowerCase();
    const pharmacy = String(rx.pharmacy_status || rx.pharmacyStatus || '').toLowerCase();
    const pickup = String(rx.patient_pickup_status || '').toLowerCase();

    if (pickup === 'picked_up') {
      return {
        key: 'filled',
        label: rx.patient_pickup_at ? 'Picked up (reported by you)' : 'Picked up',
        tone: 'success',
        canMarkPickup: true
      };
    }
    if (pharmacy === 'filled' || pharmacy === 'external') {
      return { key: 'filled', label: 'Filled / picked up', tone: 'success', canMarkPickup: true };
    }
    if (status === 'signed' || status === 'sent' || pharmacy === 'pending' || pharmacy === 'in-process' || status === 'pending') {
      return { key: 'due', label: 'Due for pick up', tone: 'warning', canMarkPickup: true };
    }
    if (status === 'draft' || status === 'unsigned') {
      return { key: 'pending', label: 'Pending — sent by doctor', tone: 'info', canMarkPickup: false };
    }
    if (status === 'cancelled') {
      return { key: 'cancelled', label: 'Cancelled', tone: 'muted', canMarkPickup: false };
    }
    return { key: 'active', label: status || 'Active', tone: 'info', canMarkPickup: true };
  }

  function flattenPrescriptionMeds(rx) {
    const meds = parseJsonField(rx.medications, []);
    if (meds.length) {
      return meds.map((m) => ({
        name: m.name || m.drugName || m.medication || 'Medication',
        dosage: m.dosage || m.strength || '',
        frequency: m.frequency || m.directions || '',
        instructions: m.instructions || m.notes || ''
      }));
    }
    if (rx.medication_name || rx.name) {
      return [{
        name: rx.medication_name || rx.name,
        dosage: rx.dosage || '',
        frequency: rx.frequency || '',
        instructions: rx.instructions || ''
      }];
    }
    return [];
  }

  async function resolvePatientUuidForPortal(patientId) {
    if (!patientId) return null;
    if (String(patientId).includes('-') && String(patientId).length === 36) return patientId;
    if (!global.supabaseClient) return patientId;
    const { data } = await global.supabaseClient
      .from('patients')
      .select('id, patient_id')
      .eq('patient_id', patientId)
      .maybeSingle();
    return data?.id || patientId;
  }

  async function loadPortalMessages() {
    const patient = global.getCurrentPatient?.();
    if (!patient?.patientId || !global.supabaseClient) return [];
    const patientUuid = await resolvePatientUuidForPortal(patient.patientId);
    const { data, error } = await global.supabaseClient
      .from('portal_messages')
      .select('*')
      .eq('patient_id', patientUuid)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[portal] messages load:', error.message);
      return [];
    }
    return data || [];
  }

  async function sendPortalMessage(body) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const { data, error } = await global.supabaseClient.rpc('portal_patient_send_message', { p_body: body });
    if (error) throw error;
    return data;
  }

  async function requestResultPublication(orderId) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const { error } = await global.supabaseClient.rpc('portal_patient_request_results', { p_order_id: orderId });
    if (error) throw error;
  }

  async function markPrescriptionPickup(prescriptionRef, status) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const ref = String(prescriptionRef || '').trim();
    if (!ref) throw new Error('Prescription reference missing');
    const { error } = await global.supabaseClient.rpc('portal_patient_mark_pickup', {
      p_prescription_ref: ref,
      p_status: status
    });
    if (error) throw error;
    if (typeof global.logAuditEvent === 'function') {
      global.logAuditEvent('patient_prescription_pickup_reported', {
        prescriptionRef: ref,
        status
      });
    }
  }

  async function loadStaffPortalThreads(organizationId) {
    if (!global.supabaseClient || !organizationId) return [];
    const { data, error } = await global.supabaseClient
      .from('portal_messages')
      .select('*, patients(first_name, last_name, patient_id)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('[portal] staff threads:', error.message);
      return [];
    }
    return data || [];
  }

  async function staffReplyToPatient(patientId, organizationId, body) {
    const user = JSON.parse(global.localStorage.getItem('user') || '{}');
    if (!global.supabaseClient) throw new Error('Not connected');
    const patientUuid = await resolvePatientUuidForPortal(patientId);
    const { error } = await global.supabaseClient.from('portal_messages').insert({
      organization_id: organizationId,
      patient_id: patientUuid,
      from_patient: false,
      sender_user_id: user.id,
      body: body.trim(),
      is_read_by_patient: false,
      is_read_by_staff: true
    });
    if (error) throw error;
  }

  async function loadOrdersAwaitingPublish(organizationId) {
    if (!global.supabaseClient || !organizationId) return [];
    const { data, error } = await global.supabaseClient
      .from('orders')
      .select('id, type, patient_id, created_at, portal_results_request_at, portal_results_status, provider_reviewed_at, selected_items, serial_number, patients(first_name, last_name, patient_id)')
      .eq('organization_id', organizationId)
      .not('portal_results_request_at', 'is', null)
      .is('portal_results_published_at', null)
      .in('type', ['lab', 'imaging'])
      .order('portal_results_request_at', { ascending: false });
    if (error) {
      console.warn('[portal] result requests:', error.message);
      return [];
    }
    return data || [];
  }

  async function staffPublishOrderResults(orderId) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const { error } = await global.supabaseClient
      .from('orders')
      .update({
        portal_results_published_at: new Date().toISOString(),
        portal_results_status: 'published'
      })
      .eq('id', orderId);
    if (error) throw error;
  }

  async function staffMarkPortalMessagesRead(messageIds) {
    if (!global.supabaseClient || !messageIds?.length) return;
    await global.supabaseClient
      .from('portal_messages')
      .update({ is_read_by_staff: true })
      .in('id', messageIds);
  }

  async function loadPatientAppointmentRequests() {
    const patient = global.getCurrentPatient?.();
    if (!patient?.patientId || !global.supabaseClient) return [];
    const patientUuid = await resolvePatientUuidForPortal(patient.patientId);
    const { data, error } = await global.supabaseClient
      .from('portal_appointment_requests')
      .select('*')
      .eq('patient_id', patientUuid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[portal] appointment requests:', error.message);
      return [];
    }
    return data || [];
  }

  async function requestAppointmentCancellation(appointmentId, reason) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const { data, error } = await global.supabaseClient.rpc('portal_patient_request_appointment_cancel', {
      p_appointment_id: appointmentId,
      p_reason: reason
    });
    if (error) throw error;
    return data;
  }

  async function requestAppointmentReschedule(appointmentId, preferredDate, preferredTime, notes) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const { data, error } = await global.supabaseClient.rpc('portal_patient_request_appointment_reschedule', {
      p_appointment_id: appointmentId,
      p_preferred_date: preferredDate,
      p_preferred_time: preferredTime,
      p_notes: notes || null
    });
    if (error) throw error;
    return data;
  }

  async function requestNewAppointment(preferredDate, preferredTime, reason, notes) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const { data, error } = await global.supabaseClient.rpc('portal_patient_request_new_appointment', {
      p_preferred_date: preferredDate,
      p_preferred_time: preferredTime,
      p_reason: reason,
      p_notes: notes || null
    });
    if (error) throw error;
    return data;
  }

  function formatPortalError(error) {
    if (!error) return 'Unknown error';
    const msg = error.message || String(error);
    if (msg.includes('portal_messages') && msg.includes('does not exist')) {
      return 'Patient portal database is not set up yet. Ask your clinic to run the portal SQL migrations.';
    }
    if (msg.includes('portal_appointment_requests') && msg.includes('does not exist')) {
      return 'Appointment requests are not enabled yet. Ask your clinic to run the portal SQL migrations.';
    }
    if (msg.includes('permission denied') || msg.includes('42501') || msg.includes('PGRST301')) {
      return 'Access denied — your portal account may not be linked correctly. Contact your clinic.';
    }
    if (msg.includes('Patient session required')) {
      return 'Please sign out and sign in again at the patient login page.';
    }
    return msg;
  }

  async function diagnosePortalAccess() {
    const issues = [];
    const patient = global.getCurrentPatient?.();
    if (!patient?.patientId) {
      issues.push({ section: 'auth', message: 'Not signed in as a patient.' });
      return issues;
    }
    if (!global.supabaseClient) {
      issues.push({ section: 'connection', message: 'Database connection not available.' });
      return issues;
    }
    const checks = [
      { section: 'appointments', fn: () => global.getPatientAppointments({ startDate: new Date().toISOString().split('T')[0] }) },
      { section: 'orders', fn: () => global.getPatientResults() },
      { section: 'messages', fn: () => loadPortalMessages() }
    ];
    for (const check of checks) {
      try {
        await check.fn();
      } catch (e) {
        issues.push({ section: check.section, message: formatPortalError(e) });
      }
    }
    return issues;
  }

  async function loadStaffAppointmentRequests(organizationId) {
    if (!global.supabaseClient || !organizationId) return [];
    const { data, error } = await global.supabaseClient
      .from('portal_appointment_requests')
      .select('*, patients(first_name, last_name, patient_id), appointments(appointment_date, appointment_time, doctor, appointment_type, reason)')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[portal] staff appointment requests:', error.message);
      return [];
    }
    return data || [];
  }

  async function staffMarkAppointmentRequestActioned(requestId, status) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const user = JSON.parse(global.localStorage.getItem('user') || '{}');
    const finalStatus = status === 'declined' ? 'declined' : 'actioned';
    const { error } = await global.supabaseClient
      .from('portal_appointment_requests')
      .update({
        status: finalStatus,
        actioned_at: new Date().toISOString(),
        actioned_by: user.id || null
      })
      .eq('id', requestId);
    if (error) throw error;
  }

  function isAppointmentUpcoming(appointment) {
    if (!appointment) return false;
    const status = String(appointment.status || '').toLowerCase();
    if (['cancelled', 'canceled', 'completed', 'done', 'no-show', 'noshow'].includes(status)) return false;
    const d = new Date(appointment.appointment_date || appointment.date);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d >= today;
  }

  global.MediForgePatientPortal = {
    parseJsonField,
    getOrderPortalStatus,
    portalOrderResultsAreVisible,
    sanitizeOrderForPatientPortal,
    getPrescriptionPortalStatus,
    flattenPrescriptionMeds,
    resolvePatientUuidForPortal,
    loadPortalMessages,
    sendPortalMessage,
    requestResultPublication,
    markPrescriptionPickup,
    loadStaffPortalThreads,
    staffReplyToPatient,
    loadOrdersAwaitingPublish,
    staffPublishOrderResults,
    staffMarkPortalMessagesRead,
    loadPatientAppointmentRequests,
    requestAppointmentCancellation,
    requestAppointmentReschedule,
    requestNewAppointment,
    loadStaffAppointmentRequests,
    staffMarkAppointmentRequestActioned,
    isAppointmentUpcoming,
    formatPortalError,
    diagnosePortalAccess
  };
})(typeof window !== 'undefined' ? window : global);
