/**
 * Build a high-level office visit summary from patient chart + visit date.
 */
(function (global) {
  'use strict';

  function parseField(val, fallback) {
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

  function formatDate(d) {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {
      return String(d);
    }
  }

  function normalizeVitals(vitals) {
    if (!vitals) return [];
    if (Array.isArray(vitals)) return vitals;
    if (typeof vitals === 'object') return [vitals];
    return [];
  }

  function matchVisitDate(left, right) {
    if (!left || !right) return false;
    const a = String(left).slice(0, 10);
    const b = String(right).slice(0, 10);
    return a === b;
  }

  async function resolvePatient(patientId) {
    if (typeof global.resolvePatientByIdentifier === 'function') {
      return global.resolvePatientByIdentifier(patientId);
    }
    if (typeof global.loadPatientsWithSupabasePriority === 'function') {
      const patients = await global.loadPatientsWithSupabasePriority();
      return patients.find((p) => p.id === patientId || p.patient_id === patientId) || null;
    }
    return null;
  }

  async function loadVisitFromClinicalNotes(patientUuid, visitDate, orgId) {
    if (!global.supabaseClient || !patientUuid) return null;
    const { data } = await global.supabaseClient
      .from('clinical_notes')
      .select('*')
      .eq('patient_id', patientUuid)
      .eq('note_date', visitDate)
      .maybeSingle();
    if (data) return data;
    if (!orgId) return null;
    const { data: byOrg } = await global.supabaseClient
      .from('clinical_notes')
      .select('*')
      .eq('organization_id', orgId)
      .eq('note_date', visitDate)
      .eq('patient_id', patientUuid)
      .maybeSingle();
    return byOrg || null;
  }

  async function loadOrdersForVisit(patientIds, visitDate, orgId) {
    if (!global.supabaseClient) return [];
    const orFilter = patientIds.map((id) => `patient_id.eq.${id}`).join(',');
    let query = global.supabaseClient.from('orders').select('*').or(orFilter);
    if (orgId) query = query.eq('organization_id', orgId);
    const { data } = await query.order('created_at', { ascending: false });
    return (data || []).filter((o) => {
      if (o.deleted_at) return false;
      const vd = o.visit_date || o.created_at;
      return matchVisitDate(vd, visitDate);
    });
  }

  async function loadPrescriptionsForVisit(patientIds, visitDate, orgId) {
    if (!global.supabaseClient) return [];
    const orFilter = patientIds.map((id) => `patient_id.eq.${id}`).join(',');
    let query = global.supabaseClient.from('prescriptions').select('*').or(orFilter);
    if (orgId) query = query.eq('organization_id', orgId);
    const { data } = await query.order('created_at', { ascending: false });
    return (data || []).filter((rx) => {
      const d = rx.prescription_date || rx.visit_date || rx.created_at;
      return matchVisitDate(d, visitDate);
    });
  }

  async function loadUpcomingAppointments(patientIds, orgId) {
    if (!global.supabaseClient) return [];
    const orFilter = patientIds.map((id) => `patient_id.eq.${id}`).join(',');
    const today = new Date().toISOString().slice(0, 10);
    let query = global.supabaseClient
      .from('appointments')
      .select('*')
      .or(orFilter)
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .limit(5);
    if (orgId) query = query.eq('organization_id', orgId);
    const { data } = await query;
    return (data || []).filter((a) => {
      const st = String(a.status || '').toLowerCase();
      return !['cancelled', 'canceled', 'completed', 'done'].includes(st);
    });
  }

  async function buildOfficeVisitSummary(patientId, visitDate, organizationId) {
    const patient = await resolvePatient(patientId);
    if (!patient) throw new Error('Patient not found');

    const patientUuid = patient.id || patient._supabaseUuid;
    const legacyId = patient.patient_id || patientId;
    const patientIds = [...new Set([String(patientUuid), String(legacyId), String(patientId)].filter(Boolean))];

    if (typeof global.loadClinicalNoteDataFromSupabase === 'function') {
      await global.loadClinicalNoteDataFromSupabase(patient, visitDate);
    }
    if (typeof global.loadClinicalNoteSOAPFromSupabase === 'function') {
      await global.loadClinicalNoteSOAPFromSupabase(patient, visitDate);
    }

    const visit = (patient.visits || []).find((v) => matchVisitDate(v.date, visitDate)) || { date: visitDate, soap: {} };
    const soap = visit.soap || {};
    const subjective = soap.subjective || {};
    const plan = soap.plan || {};

    const clinicalNote = await loadVisitFromClinicalNotes(patientUuid, visitDate, organizationId);

    const vitalsRaw = visit.vitals || visit.vitalSigns || patient.vitals || [];
    const visitVitals = normalizeVitals(vitalsRaw).filter((v) => matchVisitDate(v.date || v.recorded_at, visitDate));
    if (!visitVitals.length && normalizeVitals(vitalsRaw).length === 1) {
      visitVitals.push(normalizeVitals(vitalsRaw)[0]);
    }

    const diagnosesFromVisit = parseField(visit.diagnoses, []);
    const diagnosesFromPatient = parseField(patient.diagnoses, []);
    const diagnoses = diagnosesFromVisit.length ? diagnosesFromVisit : diagnosesFromPatient.slice(0, 10);

    const [orders, prescriptions, upcomingAppointments] = await Promise.all([
      loadOrdersForVisit(patientIds, visitDate, organizationId),
      loadPrescriptionsForVisit(patientIds, visitDate, organizationId),
      loadUpcomingAppointments(patientIds, organizationId)
    ]);

    const referrals = parseField(visit.referrals, []);
    if (!referrals.length && plan.referrals) {
      parseField(plan.referrals, []).forEach((r) => referrals.push(r));
    }

    const medications = [];
    prescriptions.forEach((rx) => {
      const meds = parseField(rx.medications, []);
      meds.forEach((m) => {
        medications.push({
          name: m.name || m.drugName || m.medication || 'Medication',
          dosage: m.dosage || m.strength || '',
          frequency: m.frequency || m.directions || '',
          status: rx.status || 'pending'
        });
      });
    });

    const providerName = clinicalNote?.provider_name
      || visit.provider
      || plan.provider
      || (JSON.parse(global.localStorage?.getItem('user') || '{}').username);

    const snapshot = {
      visitDate,
      generatedAt: new Date().toISOString(),
      patient: {
        name: patient.name || `${patient.first_name || patient.firstName || ''} ${patient.last_name || patient.lastName || ''}`.trim(),
        patientId: legacyId,
        dob: patient.date_of_birth || patient.dateOfBirth || patient.dob
      },
      provider: providerName || 'Your care team',
      chiefComplaint: subjective.chiefComplaint || subjective.cc || clinicalNote?.chief_complaint || '',
      visitOverview: [
        subjective.hpi || subjective.historyOfPresentIllness || '',
        plan.treatmentPlan || plan.treatment || '',
        plan.followUp || plan.follow_up || ''
      ].filter(Boolean).join('\n\n'),
      vitals: visitVitals.map((v) => ({
        temperature: v.temperature || v.temp,
        heartRate: v.heartRate || v.heart_rate || v.pulse,
        bloodPressure: v.bloodPressure || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : null),
        respiratoryRate: v.respiratoryRate || v.respiratory_rate,
        oxygenSaturation: v.oxygenSaturation || v.o2_sat || v.spo2,
        height: v.height,
        weight: v.weight,
        bmi: v.bmi,
        painLevel: v.painLevel || v.pain_level
      })),
      diagnoses: diagnoses.map((d) => ({
        name: typeof d === 'string' ? d : (d.diagnosis || d.name || d.event || 'Diagnosis'),
        date: d.date || visitDate,
        notes: d.notes || ''
      })),
      orders: orders.map((o) => ({
        type: o.type || 'lab',
        items: (o.selected_items || []).map((i) => i.name || i.test || i).filter(Boolean),
        status: o.status || o.lab_status || 'ordered',
        serialNumber: o.serial_number
      })),
      prescriptions: medications,
      referrals: referrals.map((r) => ({
        specialist: r.specialist || r.provider || r.to || 'Specialist',
        diagnoses: r.diagnoses || r.diagnosis || r.reason || '',
        status: r.status || 'sent'
      })),
      followUpPlan: plan.followUp || plan.follow_up || plan.patientEducation || '',
      upcomingAppointments: upcomingAppointments.map((a) => ({
        date: a.appointment_date,
        time: a.appointment_time,
        doctor: a.doctor || a.doctor_name,
        reason: a.reason || a.appointment_type
      }))
    };

    return { patient, patientUuid, legacyId, snapshot };
  }

  function renderSnapshotHtml(snapshot) {
    if (!snapshot) return '<p>No summary available.</p>';
    const s = snapshot;

    const vitalsHtml = (s.vitals || []).length
      ? `<ul>${s.vitals.map((v) => {
          const parts = [];
          if (v.temperature) parts.push(`Temp ${v.temperature}°C`);
          if (v.heartRate) parts.push(`HR ${v.heartRate}`);
          if (v.bloodPressure) parts.push(`BP ${v.bloodPressure}`);
          if (v.respiratoryRate) parts.push(`RR ${v.respiratoryRate}`);
          if (v.oxygenSaturation) parts.push(`SpO₂ ${v.oxygenSaturation}%`);
          if (v.height) parts.push(`Height ${v.height} cm`);
          if (v.weight) parts.push(`Weight ${v.weight} kg`);
          if (v.bmi) parts.push(`BMI ${v.bmi}`);
          return `<li>${parts.join(' · ') || 'Recorded'}</li>`;
        }).join('')}</ul>`
      : '<p class="muted">No vitals recorded for this visit yet.</p>';

    const dxHtml = (s.diagnoses || []).length
      ? `<ul>${s.diagnoses.map((d) => `<li><strong>${d.name}</strong>${d.notes ? ` — ${d.notes}` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">No diagnoses documented for this visit yet.</p>';

    const ordersHtml = (s.orders || []).length
      ? `<ul>${s.orders.map((o) => {
          const label = o.type === 'imaging' ? 'Imaging' : 'Lab';
          const items = (o.items || []).join(', ') || 'Orders placed';
          return `<li><strong>${label}</strong>: ${items} <em>(${o.status || 'ordered'})</em></li>`;
        }).join('')}</ul>`
      : '<p class="muted">No lab or imaging orders for this visit.</p>';

    const rxHtml = (s.prescriptions || []).length
      ? `<ul>${s.prescriptions.map((m) => `<li><strong>${m.name}</strong>${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` — ${m.frequency}` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">No prescriptions sent during this visit.</p>';

    const refHtml = (s.referrals || []).length
      ? `<ul>${s.referrals.map((r) => `<li><strong>${r.specialist}</strong>${r.diagnoses ? ` — ${r.diagnoses}` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">No referrals sent during this visit.</p>';

    const apptHtml = (s.upcomingAppointments || []).length
      ? `<ul>${s.upcomingAppointments.map((a) => `<li>${formatDate(a.date)}${a.time ? ` at ${a.time}` : ''} — ${a.doctor || 'Provider'}${a.reason ? ` (${a.reason})` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">No upcoming appointments scheduled.</p>';

    return `
      <div class="summary-block">
        <p><strong>Visit date:</strong> ${formatDate(s.visitDate)}</p>
        <p><strong>Provider:</strong> ${s.provider || '—'}</p>
        ${s.chiefComplaint ? `<p><strong>Chief complaint:</strong> ${s.chiefComplaint}</p>` : ''}
      </div>
      ${s.visitOverview ? `<div class="summary-block"><h3>Visit overview</h3><p>${s.visitOverview.replace(/\n/g, '<br>')}</p></div>` : ''}
      <div class="summary-block"><h3>Vital signs</h3>${vitalsHtml}</div>
      <div class="summary-block"><h3>Diagnoses / problem list</h3>${dxHtml}</div>
      <div class="summary-block"><h3>Orders</h3>${ordersHtml}</div>
      <div class="summary-block"><h3>Prescriptions</h3>${rxHtml}</div>
      <div class="summary-block"><h3>Referrals</h3>${refHtml}</div>
      <div class="summary-block"><h3>Follow-up plan</h3><p>${s.followUpPlan || '—'}</p></div>
      <div class="summary-block"><h3>Upcoming appointments</h3>${apptHtml}</div>
      <p class="muted" style="margin-top:20px;font-size:12px;">This is a high-level summary. Your provider may update clinical notes after your visit.</p>
    `;
  }

  async function saveOfficeVisitSummary(patientId, visitDate, organizationId, snapshot, options) {
    if (!global.supabaseClient) throw new Error('Database not available');
    const user = JSON.parse(global.localStorage.getItem('user') || '{}');
    const payload = {
      organization_id: organizationId,
      patient_id: String(patientId),
      visit_date: visitDate,
      summary_type: 'office_visit',
      portal_visible: true,
      admission_id: null,
      discharge_date: new Date().toISOString(),
      chief_complaint: snapshot.chiefComplaint || null,
      history_of_present_illness: snapshot.visitOverview || null,
      follow_up_plan: snapshot.followUpPlan || null,
      final_diagnoses: snapshot.diagnoses || [],
      discharge_medications: snapshot.prescriptions || [],
      follow_up_appointments: snapshot.upcomingAppointments || [],
      visit_snapshot: snapshot,
      discharging_physician: snapshot.provider || user.username || null,
      discharging_physician_id: user.id || null,
      summary_generated_at: new Date().toISOString()
    };

    const { data: existing } = await global.supabaseClient
      .from('discharge_summaries')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('patient_id', String(patientId))
      .eq('visit_date', visitDate)
      .eq('summary_type', 'office_visit')
      .maybeSingle();

    if (existing?.id) {
      const { error } = await global.supabaseClient
        .from('discharge_summaries')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
      return existing.id;
    }

    const { data, error } = await global.supabaseClient
      .from('discharge_summaries')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return data?.id;
  }

  global.VisitSummaryBuilder = {
    buildOfficeVisitSummary,
    renderSnapshotHtml,
    saveOfficeVisitSummary,
    formatDate
  };
})(typeof window !== 'undefined' ? window : global);
