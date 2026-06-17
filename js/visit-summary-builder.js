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

  function toYmd(val) {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return s.slice(0, 10);
  }

  function matchVisitDate(left, right) {
    const a = toYmd(left);
    const b = toYmd(right);
    return !!(a && b && a === b);
  }

  function resolveFollowUpPlan(plan, clinicalNote) {
    const p = plan || {};
    const fromPlan = p.followUp || p.follow_up || p.followup || p.patientEducation || p.education || '';
    if (fromPlan) return fromPlan;
    if (!clinicalNote) return '';
    let soap = clinicalNote.soap_data;
    if (typeof soap === 'string') {
      try { soap = JSON.parse(soap); } catch (_) { soap = null; }
    }
    const cp = soap?.plan || {};
    return cp.followUp || cp.follow_up || cp.followup || cp.patientEducation || cp.education || '';
  }

  function parseOrderItems(order) {
    let items = order.selected_items != null ? order.selected_items : order.selectedItems;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (_) {
        items = [];
      }
    }
    return Array.isArray(items) ? items : [];
  }

  function orderItemLabel(item) {
    if (item == null) return '';
    if (typeof item === 'string') return item.trim();
    return String(item.name || item.test || item.label || '').trim();
  }

  async function resolveAllPatientIds(patientId, patient) {
    const ids = new Set([String(patientId)]);
    if (patient) {
      ['id', '_supabaseUuid', 'patient_id', 'patientNumber'].forEach((key) => {
        if (patient[key]) ids.add(String(patient[key]));
      });
    }
    if (global.supabaseClient && patientId) {
      const { data } = await global.supabaseClient
        .from('patients')
        .select('id, patient_id')
        .or(`id.eq.${patientId},patient_id.eq.${patientId}`)
        .maybeSingle();
      if (data) {
        if (data.id) ids.add(String(data.id));
        if (data.patient_id) ids.add(String(data.patient_id));
      }
    }
    return Array.from(ids);
  }

  function patientIdMatches(recordPatientId, patientIds) {
    if (!recordPatientId) return false;
    const pid = String(recordPatientId);
    return patientIds.some((id) => String(id) === pid);
  }

  function mergeLocalStorageVisitOrders(patient, patientId, visitDate) {
    try {
      const storageKey = typeof global.getDataKey === 'function'
        ? global.getDataKey('patients')
        : 'patients';
      const patients = JSON.parse(global.localStorage?.getItem(storageKey) || '[]');
      const localPatient = patients.find((p) =>
        p &&
        (p.id === patientId ||
          p.patient_id === patientId ||
          p._supabaseUuid === patientId ||
          (patient && (p.id === patient.id || p.patient_id === patient.patient_id)))
      );
      if (!localPatient?.visits) return;
      const localVisit = localPatient.visits.find((v) => matchVisitDate(v.date, visitDate));
      if (!localVisit?.orders?.length) return;
      if (!patient.visits) patient.visits = [];
      let targetVisit = patient.visits.find((v) => matchVisitDate(v.date, visitDate));
      if (!targetVisit) {
        patient.visits.push({ ...localVisit, date: toYmd(localVisit.date) || visitDate });
      } else {
        targetVisit.orders = localVisit.orders;
      }
    } catch (_) {
      /* ignore localStorage merge errors */
    }
  }

  function collectVisitOrders(patient, visitDate) {
    const orders = [];
    const seen = new Set();
    (patient.visits || []).forEach((visit) => {
      if (!matchVisitDate(visit.date, visitDate)) return;
      (visit.orders || []).forEach((order) => {
        if (order.deleted_at || order.deletedAt) return;
        const items = parseOrderItems(order);
        const noItemsChecked = order.noItemsChecked || order.no_items_checked;
        if (!items.length && !noItemsChecked) return;
        const serial = order.serialNumber || order.serial_number || '';
        const ts = order.timestamp || order.created_at || '';
        const key = `${serial}_${ts}`;
        if (seen.has(key)) return;
        seen.add(key);
        orders.push({
          type: order.type || 'lab',
          selected_items: items,
          status: order.status || order.lab_status || 'ordered',
          serial_number: serial,
          visit_date: visit.date,
          created_at: ts
        });
      });
    });
    return orders;
  }

  function prescriptionMatchesVisit(rx, visitDate) {
    const dates = [
      rx.visitDate,
      rx.visit_date,
      rx.date,
      rx.encounterDate,
      rx.prescription_date,
      rx.signature_date,
      rx.signatureDate,
      rx.created_at,
      rx.createdAt
    ];
    return dates.some((d) => matchVisitDate(d, visitDate));
  }

  function medicationsFromPrescription(rx) {
    const meds = parseField(rx.medications, []);
    return meds.map((m) => ({
      name: m.name || m.drugName || m.medication || 'Medication',
      dosage: m.dosage || m.strength || '',
      frequency: m.frequency || m.directions || '',
      status: rx.status || rx.pharmacy_status || 'pending'
    }));
  }

  function dedupeOrders(orders) {
    const seen = new Set();
    return orders.filter((o) => {
      const key = `${o.serial_number || ''}_${toYmd(o.visit_date || o.created_at)}_${o.type || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    const matched = [];
    const seen = new Set();

    function addOrder(order) {
      if (!order || order.deleted_at) return;
      const vd = order.visit_date || order.visitDate || order.created_at;
      if (!matchVisitDate(vd, visitDate)) return;
      const serial = order.serial_number || order.serialNumber || '';
      const key = `${serial}_${toYmd(vd)}`;
      if (seen.has(key)) return;
      seen.add(key);
      matched.push(order);
    }

    if (global.supabaseClient) {
      const orFilter = patientIds.map((id) => `patient_id.eq.${id}`).join(',');
      let query = global.supabaseClient.from('orders').select('*').or(orFilter).is('deleted_at', null);
      if (orgId) query = query.eq('organization_id', orgId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data?.length) {
        data.forEach(addOrder);
      }
      if (!matched.length) {
        let fallback = global.supabaseClient.from('orders').select('*').or(orFilter).is('deleted_at', null);
        const { data: allData, error: allErr } = await fallback.order('created_at', { ascending: false });
        if (!allErr && allData?.length) allData.forEach(addOrder);
      }
    }

    return matched;
  }

  async function loadPrescriptionsForVisit(patientIds, visitDate, orgId, patient) {
    const prescriptions = [];
    const seen = new Set();

    function addPrescription(rx) {
      if (!rx) return;
      const id = rx.id || rx._supabaseId || JSON.stringify(rx.medications);
      if (seen.has(id)) return;
      if (!prescriptionMatchesVisit(rx, visitDate)) return;
      seen.add(id);
      prescriptions.push(rx);
    }

    if (global.supabaseClient) {
      const orFilter = patientIds.map((id) => `patient_id.eq.${id}`).join(',');
      let query = global.supabaseClient.from('prescriptions').select('*').or(orFilter);
      if (orgId) query = query.eq('organization_id', orgId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data?.length) {
        data.forEach((rx) => {
          addPrescription({
            ...rx,
            medications: parseField(rx.medications, [])
          });
        });
      }
      if (!prescriptions.length) {
        const { data: allData, error: allErr } = await global.supabaseClient
          .from('prescriptions')
          .select('*')
          .or(orFilter)
          .order('created_at', { ascending: false });
        if (!allErr && allData?.length) {
          allData.forEach((rx) => {
            addPrescription({
              ...rx,
              medications: parseField(rx.medications, [])
            });
          });
        }
      }
    }

    let patientPrescriptions = patient?.prescriptions || [];
    if (typeof global.refreshPatientPrescriptionsFromSupabase === 'function' && patient) {
      try {
        const refreshed = await global.refreshPatientPrescriptionsFromSupabase(
          patient.patient_id || patient.id || patientIds[0],
          patient
        );
        if (Array.isArray(refreshed)) patientPrescriptions = refreshed;
      } catch (e) {
        console.warn('Visit summary: could not refresh prescriptions', e);
      }
    }
    patientPrescriptions.forEach(addPrescription);

    return prescriptions;
  }

  async function loadUpcomingAppointments(patientIds, orgId) {
    const today = toYmd(new Date());
    const upcoming = [];
    const seen = new Set();

    function addAppointment(appt) {
      if (!appt) return;
      const pid = appt.patient_id || appt.patientId;
      if (!patientIdMatches(pid, patientIds)) return;
      const st = String(appt.status || '').toLowerCase();
      if (['cancelled', 'canceled', 'completed', 'done'].includes(st)) return;
      const date = toYmd(appt.appointment_date || appt.date);
      if (!date || date < today) return;
      const key = appt.id || `${pid}_${date}_${appt.appointment_time || appt.time || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      upcoming.push(appt);
    }

    if (global.supabaseClient) {
      const orFilter = patientIds.map((id) => `patient_id.eq.${id}`).join(',');
      let query = global.supabaseClient
        .from('appointments')
        .select('*')
        .or(orFilter)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .limit(10);
      if (orgId) query = query.eq('organization_id', orgId);
      const { data, error } = await query;
      if (!error && data?.length) data.forEach(addAppointment);

      if (!upcoming.length) {
        const { data: allData, error: allErr } = await global.supabaseClient
          .from('appointments')
          .select('*')
          .or(orFilter)
          .gte('appointment_date', today)
          .order('appointment_date', { ascending: true })
          .limit(10);
        if (!allErr && allData?.length) allData.forEach(addAppointment);
      }
    }

    if (!upcoming.length && typeof global.loadAppointmentsWithSupabasePriority === 'function') {
      try {
        const all = await global.loadAppointmentsWithSupabasePriority();
        (all || []).forEach(addAppointment);
      } catch (e) {
        console.warn('Visit summary: appointments fallback failed', e);
      }
    }

    return upcoming
      .sort((a, b) => {
        const da = toYmd(a.appointment_date || a.date);
        const db = toYmd(b.appointment_date || b.date);
        if (da !== db) return da.localeCompare(db);
        return String(a.appointment_time || a.time || '').localeCompare(String(b.appointment_time || b.time || ''));
      })
      .slice(0, 5);
  }

  async function buildOfficeVisitSummary(patientId, visitDate, organizationId) {
    const normalizedVisitDate = toYmd(visitDate) || visitDate;

    if (typeof global.collectOfficeVisitChartData === 'function') {
      const chart = await global.collectOfficeVisitChartData(patientId, normalizedVisitDate);
      const patient = chart.patient;
      const legacyId = patient.patient_id || patientId;
      const patientUuid = patient.id || patient._supabaseUuid;
      const subjective = chart.subjective || {};
      const plan = chart.plan || {};
      const clinicalNote = await loadVisitFromClinicalNotes(patientUuid, normalizedVisitDate, organizationId);

      const medications = [];
      (chart.prescriptions || []).forEach((rx) => {
        medicationsFromPrescription(rx).forEach((m) => medications.push(m));
      });

      const providerName = clinicalNote?.provider_name
        || chart.visit?.provider
        || plan.provider
        || (JSON.parse(global.localStorage?.getItem('user') || '{}').username);

      const snapshot = {
        visitDate: normalizedVisitDate,
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
          plan.treatmentPlan || plan.treatment || plan.treatments || '',
          plan.followUp || plan.follow_up || plan.followup || ''
        ].filter(Boolean).join('\n\n'),
        vitals: normalizeVitals(chart.vitals).map((v) => ({
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
        diagnoses: (chart.diagnoses || []).map((d) => ({
          name: typeof d === 'string' ? d : (d.diagnosis || d.name || d.event || 'Diagnosis'),
          date: d.date || normalizedVisitDate,
          notes: d.notes || ''
        })),
        orders: (chart.orders || []).map((o) => ({
          type: o.type || 'lab',
          items: parseOrderItems(o).map(orderItemLabel).filter(Boolean),
          status: o.status || o.lab_status || 'ordered',
          serialNumber: o.serial_number || o.serialNumber
        })),
        prescriptions: medications,
        referrals: (chart.referrals || []).map((r) => ({
          specialist: r.specialistName || r.specialist || r.provider || r.to || 'Specialist',
          diagnoses: Array.isArray(r.diagnoses) ? r.diagnoses.join(', ') : (r.diagnoses || r.diagnosis || r.reason || ''),
          status: r.status || 'sent'
        })),
        followUpPlan: resolveFollowUpPlan(plan, clinicalNote),
        upcomingAppointments: (chart.upcomingAppointments || []).map((a) => ({
          date: a.appointment_date || a.date,
          time: a.appointment_time || a.time,
          doctor: a.doctor || a.doctor_name,
          reason: a.reason || a.appointment_type
        }))
      };

      return { patient, patientUuid, legacyId, snapshot };
    }

    const patient = await resolvePatient(patientId);
    if (!patient) throw new Error('Patient not found');

    const patientUuid = patient.id || patient._supabaseUuid;
    const legacyId = patient.patient_id || patientId;
    const patientIds = await resolveAllPatientIds(patientId, patient);

    if (typeof global.loadClinicalNoteDataFromSupabase === 'function') {
      await global.loadClinicalNoteDataFromSupabase(patient, normalizedVisitDate);
    }
    if (typeof global.loadClinicalNoteSOAPFromSupabase === 'function') {
      await global.loadClinicalNoteSOAPFromSupabase(patient, normalizedVisitDate);
    }
    mergeLocalStorageVisitOrders(patient, patientId, normalizedVisitDate);

    const visit = (patient.visits || []).find((v) => matchVisitDate(v.date, normalizedVisitDate)) || { date: normalizedVisitDate, soap: {} };
    const soap = visit.soap || {};
    const subjective = soap.subjective || {};
    const plan = soap.plan || {};

    const clinicalNote = await loadVisitFromClinicalNotes(patientUuid, normalizedVisitDate, organizationId);

    const vitalsRaw = visit.vitals || visit.vitalSigns || patient.vitals || [];
    const visitVitals = normalizeVitals(vitalsRaw).filter((v) => matchVisitDate(v.date || v.recorded_at, normalizedVisitDate));
    if (!visitVitals.length && normalizeVitals(vitalsRaw).length === 1) {
      visitVitals.push(normalizeVitals(vitalsRaw)[0]);
    }

    const diagnosesFromVisit = parseField(visit.diagnoses, []);
    const diagnosesFromPatient = parseField(patient.diagnoses, []);
    const diagnoses = diagnosesFromVisit.length ? diagnosesFromVisit : diagnosesFromPatient.slice(0, 10);

    const [supabaseOrders, prescriptions, upcomingAppointments] = await Promise.all([
      loadOrdersForVisit(patientIds, normalizedVisitDate, organizationId),
      loadPrescriptionsForVisit(patientIds, normalizedVisitDate, organizationId, patient),
      loadUpcomingAppointments(patientIds, organizationId)
    ]);

    const visitOrders = collectVisitOrders(patient, normalizedVisitDate);
    const orders = dedupeOrders([...supabaseOrders, ...visitOrders]);

    const referrals = parseField(visit.referrals, []);
    if (!referrals.length && plan.referrals) {
      parseField(plan.referrals, []).forEach((r) => referrals.push(r));
    }

    const medications = [];
    prescriptions.forEach((rx) => {
      medicationsFromPrescription(rx).forEach((m) => medications.push(m));
    });

    const providerName = clinicalNote?.provider_name
      || visit.provider
      || plan.provider
      || (JSON.parse(global.localStorage?.getItem('user') || '{}').username);

    const snapshot = {
      visitDate: normalizedVisitDate,
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
        plan.treatmentPlan || plan.treatment || plan.treatments || '',
        plan.followUp || plan.follow_up || plan.followup || ''
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
        date: d.date || normalizedVisitDate,
        notes: d.notes || ''
      })),
      orders: orders.map((o) => ({
        type: o.type || 'lab',
        items: parseOrderItems(o).map(orderItemLabel).filter(Boolean),
        status: o.status || o.lab_status || 'ordered',
        serialNumber: o.serial_number || o.serialNumber
      })),
      prescriptions: medications,
      referrals: referrals.map((r) => ({
        specialist: r.specialist || r.provider || r.to || 'Specialist',
        diagnoses: r.diagnoses || r.diagnosis || r.reason || '',
        status: r.status || 'sent'
      })),
      followUpPlan: resolveFollowUpPlan(plan, clinicalNote),
      upcomingAppointments: upcomingAppointments.map((a) => ({
        date: a.appointment_date || a.date,
        time: a.appointment_time || a.time,
        doctor: a.doctor || a.doctor_name || a.patient_name,
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
