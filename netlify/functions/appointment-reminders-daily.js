/**
 * Netlify Function: appointment-reminders-daily
 * Runs daily (via cron or manual HTTP trigger) to create in-app appointment reminders.
 * Creates notifications for doctors and patients when reminders are due.
 *
 * Call via: GET/POST /.netlify/functions/appointment-reminders-daily
 * Optional: ?key=CRON_SECRET (set CRON_SECRET env var to protect from public triggers)
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const CRON_SECRET = process.env.CRON_SECRET || process.env.APPOINTMENT_REMINDER_CRON_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

async function supabaseFetch(path, options = {}) {
  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in Netlify env vars. See Site settings → Environment variables.');
  }
  const base = url.replace(/\/$/, '');
  const res = await fetch(`${base}/rest/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

function parseDate(d) {
  if (!d) return null;
  const s = typeof d === 'string' ? d : d.toISOString ? d.toISOString().split('T')[0] : '';
  return s;
}

exports.handler = async function (event) {
  // Synchronous ping - no await, no fetch. If this fails, the function runtime itself is broken.
  if (event.queryStringParameters?.ping === '1') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ping: true, message: 'Function runtime OK' })
    };
  }

  console.log('[appointment-reminders-daily] Invoked', event.httpMethod, 'origin:', event.headers?.origin || 'none', 'referer:', event.headers?.referer || 'none');
  // Early check: return clear error if Supabase env vars are missing (avoids cryptic 500)
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add both in Netlify → Site settings → Environment variables, then redeploy.',
        log: []
      })
    };
  }

  const method = event.httpMethod || 'GET';
  if (method !== 'GET' && method !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Auth: CRON_SECRET required only for requests without Origin/Referer (e.g. cron). Browser requests from our site are allowed.
  if (CRON_SECRET) {
    const provided = event.queryStringParameters?.key || event.headers?.['x-cron-secret'] || '';
    const origin = String(event.headers?.origin || event.headers?.Origin || '');
    const referer = String(event.headers?.referer || event.headers?.Referer || '');
    const hasKey = provided === CRON_SECRET;
    const fromBrowser = origin.includes('mediforge') || referer.includes('mediforge') || origin.includes('netlify.app') || referer.includes('netlify.app');
    if (!hasKey && !fromBrowser) {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  const log = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Minimal test path (?test=1): fetch orgs only to verify env vars and Supabase connectivity
  const isTest = event.queryStringParameters?.test === '1';
  if (isTest) {
    try {
      const orgsRes = await supabaseFetch('/organizations?select=id,name');
      const orgs = Array.isArray(orgsRes) ? orgsRes : orgsRes ? [orgsRes] : [];
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, test: true, orgCount: orgs.length, message: 'Connection OK. Env vars and Supabase are working.' })
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: e.message, test: true })
      };
    }
  }

  try {
    let orgsRes;
    try {
      orgsRes = await supabaseFetch('/organizations?select=id,name,settings');
    } catch (e) {
      throw new Error(`[Step: fetch organizations] ${e.message}`);
    }
    const orgs = Array.isArray(orgsRes) ? orgsRes : orgsRes ? [orgsRes] : [];
    log.push(`Organizations: ${orgs.length}`);

    for (const org of orgs) {
      const settings = org.settings || {};
      const leadDays = Math.max(1, parseInt(settings.reminder_lead_days, 10) || 14);
      const dailyEnabled = settings.daily_reminders_enabled !== false;

      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + leadDays);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      let appointmentsRes;
      const baseAppointmentsPath = `/appointments?organization_id=eq.${org.id}&and=(appointment_date.gte.${startStr},appointment_date.lte.${endStr})`;
      const selectCols = 'id,appointment_id,patient_id,appointment_date,appointment_time,organization_id,reason';
      try {
        appointmentsRes = await supabaseFetch(
          `${baseAppointmentsPath}&deleted=eq.false&select=id,appointment_id,patient_id,appointment_date,appointment_time,doctor_name,doctor,organization_id,reason`
        );
      } catch (e) {
        const msg = (e.message || '').toLowerCase();
        if (msg.includes('doctor') || msg.includes('column')) {
          try {
            appointmentsRes = await supabaseFetch(`${baseAppointmentsPath}&deleted=eq.false&select=${selectCols}`);
          } catch (e2) {
            const m2 = (e2.message || '').toLowerCase();
            if (m2.includes('deleted') || m2.includes('column')) {
              appointmentsRes = await supabaseFetch(`${baseAppointmentsPath}&select=${selectCols}`);
            } else throw new Error(`[Step: fetch appointments for org ${org.name}] ${e2.message}`);
          }
        } else if (msg.includes('deleted') || msg.includes('column')) {
          appointmentsRes = await supabaseFetch(`${baseAppointmentsPath}&select=${selectCols}`);
        } else {
          throw new Error(`[Step: fetch appointments for org ${org.name}] ${e.message}`);
        }
      }
      const appointments = Array.isArray(appointmentsRes) ? appointmentsRes : [];
      log.push(`Org ${org.name}: ${appointments.length} appointments in window`);

      for (const apt of appointments) {
        const aptDate = parseDate(apt.appointment_date);
        if (!aptDate) continue;
        const aptDt = new Date(aptDate);
        aptDt.setHours(0, 0, 0, 0);
        const diffMs = aptDt - today;
        const daysBefore = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        if (daysBefore < 1) continue;

        const dueDays = [];
        if (daysBefore === leadDays) dueDays.push(leadDays);
        if (daysBefore === 7) dueDays.push(7);
        if (dailyEnabled && daysBefore >= 1 && daysBefore <= 6) dueDays.push(daysBefore);

        for (const db of dueDays) {
          let patientUserId = null;
          let staffUserIds = [];

          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(apt.patient_id || '').trim());
          let patientUuid = apt.patient_id;
          let patientData = null;
          if (!isUuid) {
            const patients = await supabaseFetch(
              `/patients?organization_id=eq.${org.id}&patient_id=eq.${encodeURIComponent(apt.patient_id)}&select=id,patient_id,first_name,last_name,date_of_birth`
            );
            if (Array.isArray(patients) && patients.length > 0) {
              patientUuid = patients[0].id;
              patientData = patients[0];
            }
          } else {
            const patients = await supabaseFetch(
              `/patients?organization_id=eq.${org.id}&id=eq.${apt.patient_id}&select=id,patient_id,first_name,last_name,date_of_birth`
            );
            if (Array.isArray(patients) && patients.length > 0) patientData = patients[0];
          }
          if (patientUuid) {
            const patientUsers = await supabaseFetch(
              `/users?organization_id=eq.${org.id}&patient_id=eq.${patientUuid}&or=(role.eq.Patient,role.ilike.patient)&select=id`
            );
            if (Array.isArray(patientUsers) && patientUsers.length > 0) patientUserId = patientUsers[0].id;
          }

          const doctorName = (apt.doctor || apt.doctor_name || '').trim();
          const staff = await supabaseFetch(
            `/users?organization_id=eq.${org.id}&role=neq.Patient&select=id,first_name,last_name,username`
          );
          const staffList = Array.isArray(staff) ? staff : [];
          if (doctorName) {
            for (const s of staffList) {
              const fn = (s.first_name || '').toLowerCase();
              const ln = (s.last_name || '').toLowerCase();
              const un = (s.username || '').toLowerCase();
              if (
                (fn && ln && (doctorName.toLowerCase().includes(fn) || doctorName.toLowerCase().includes(ln))) ||
                (un && doctorName.toLowerCase().includes(un))
              ) {
                staffUserIds.push(s.id);
              }
            }
          }
          if (staffUserIds.length === 0 && staffList.length > 0) {
            staffUserIds = staffList.slice(0, 3).map((s) => s.id);
          }

          const patientName = patientData ? `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || 'Patient' : 'Patient';
          const patientId = patientData?.patient_id || apt.patient_id || ':';
          const dob = patientData?.date_of_birth ? new Date(patientData.date_of_birth).toISOString().split('T')[0] : null;
          const dobStr = dob ? new Date(dob).toLocaleDateString() : ':';
          const timeStr = apt.appointment_time ? String(apt.appointment_time).slice(0, 5) : '';
          const purpose = apt.reason || ':';
          const smsUrl = `/appointment-sms-reminders?patient=${encodeURIComponent(patientId)}&date=${encodeURIComponent(aptDate)}`;

          const title = `Appointment reminder: ${daysBefore} day${daysBefore !== 1 ? 's' : ''} until appointment`;
          const bodyStaff = `Patient: ${patientName} (ID: ${patientId}, DOB: ${dobStr}) | Date: ${aptDate} | Time: ${timeStr} | Purpose: ${purpose} | ${daysBefore} day${daysBefore !== 1 ? 's' : ''} until appointment.`;
          const bodyPatient = `Reminder: You have an appointment on ${aptDate}${timeStr ? ' at ' + timeStr : ''}. ${daysBefore} day${daysBefore !== 1 ? 's' : ''} remaining.`;
          const metadata = { appointment_id: apt.id, patient_id: patientId, patient_name: patientName, appointment_date: aptDate, appointment_time: timeStr, reason: purpose };

          const recipients = [...new Set([patientUserId, ...staffUserIds].filter(Boolean))];
          for (const uid of recipients) {
            try {
              const existing = await supabaseFetch(
                `/appointment_reminders?appointment_id=eq.${apt.id}&user_id=eq.${uid}&days_before=eq.${db}&select=id`
              );
              if (Array.isArray(existing) && existing.length > 0) {
                log.push(`Skip (already sent): apt ${apt.id} user ${uid} ${db}d`);
                continue;
              }
              await supabaseFetch('/appointment_reminders', {
                method: 'POST',
                body: JSON.stringify({
                  organization_id: org.id,
                  appointment_id: apt.id,
                  user_id: uid,
                  days_before: db,
                  reminder_type: 'appointment_reminder',
                }),
              });
              const isPatient = uid === patientUserId;
              await supabaseFetch('/notifications', {
                method: 'POST',
                body: JSON.stringify({
                  organization_id: org.id,
                  user_id: uid,
                  type: 'appointment_reminder',
                  title,
                  body: isPatient ? bodyPatient : bodyStaff,
                  priority: 'normal',
                  action_url: isPatient ? '/patient-appointments' : smsUrl,
                  metadata,
                }),
              });
              log.push(`Sent reminder to user ${uid} for apt ${apt.id} (${db}d)`);
            } catch (e) {
              log.push(`Error sending to ${uid}: ${e.message}`);
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, log }),
    };
  } catch (err) {
    console.error('[appointment-reminders-daily] Fatal:', err.message, err.stack);
    log.push(`Fatal: ${err.message}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message, log }),
    };
  }
};
