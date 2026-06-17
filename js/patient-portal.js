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

  function getOrderPortalStatus(order) {
    if (!order) return { key: 'not_started', label: 'Not yet done', tone: 'muted' };

    const explicit = (order.portal_results_status || '').toLowerCase();
    if (explicit === 'published' || order.portal_results_published_at) {
      return { key: 'published', label: 'Results available to view', tone: 'success', canView: true };
    }
    if (explicit === 'reviewed' || order.portal_results_request_at) {
      if (order.portal_results_request_at && !order.portal_results_published_at) {
        return {
          key: 'request_pending',
          label: 'Request sent — awaiting practice to publish results',
          tone: 'info',
          canRequest: false
        };
      }
      return {
        key: 'reviewed',
        label: 'Reviewed by your provider',
        tone: 'info',
        canRequest: true
      };
    }
    if (explicit === 'awaiting_review') {
      return { key: 'awaiting_review', label: 'Test completed — awaiting provider review', tone: 'warning' };
    }

    const labStatus = String(order.lab_status || order.status || '').toLowerCase();
    const hasResultData = parseJsonField(order.results, []).length > 0;
    const completed = labStatus.includes('complete') || order.completed_at || hasResultData;

    if (order.provider_reviewed_at) {
      return {
        key: 'reviewed',
        label: 'Reviewed by your provider',
        tone: 'info',
        canRequest: !order.portal_results_request_at
      };
    }
    if (completed) {
      return { key: 'awaiting_review', label: 'Test completed — awaiting provider review', tone: 'warning' };
    }
    return { key: 'not_started', label: 'Not yet done', tone: 'muted' };
  }

  function getPrescriptionPortalStatus(rx) {
    const status = String(rx.status || 'pending').toLowerCase();
    const pharmacy = String(rx.pharmacy_status || rx.pharmacyStatus || '').toLowerCase();
    const pickup = String(rx.patient_pickup_status || '').toLowerCase();

    if (pickup === 'picked_up' || pharmacy === 'filled' || pharmacy === 'external') {
      return { key: 'filled', label: 'Filled / picked up', tone: 'success', canMarkPickup: pickup !== 'picked_up' };
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

  async function markPrescriptionPickup(prescriptionId, status) {
    if (!global.supabaseClient) throw new Error('Not connected');
    const { error } = await global.supabaseClient.rpc('portal_patient_mark_pickup', {
      p_prescription_id: prescriptionId,
      p_status: status
    });
    if (error) throw error;
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
    loadStaffAppointmentRequests,
    staffMarkAppointmentRequestActioned,
    isAppointmentUpcoming
  };
})(typeof window !== 'undefined' ? window : global);
