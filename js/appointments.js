// Purpose: Handles appointments: loading, adding, cancellation, and schedule calendar views with configurable slots.
// Version: v=286 - Fixed variable conflicts and schema mismatch

// Get clinic schedule configuration
function getClinicSchedule() {
  const config = JSON.parse(localStorage.getItem(getDataKey("clinic-schedule")) || '{}');
  return {
    startTime: config.startTime || "08:00",
    endTime: config.endTime || "18:00",
    slotDuration: config.slotDuration || 20,
    lunchBreak: config.lunchBreak || { enabled: false },
    workingDays: config.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday"]
  };
}

// Generate all possible time slots based on configuration
function getAllSlots() {
  const schedule = getClinicSchedule();
  const slots = [];
  
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
  
  let hour = startHour;
  let minute = startMinute;
  
  while (hour < endHour || (hour === endHour && minute < endMinute)) {
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // Check if this slot conflicts with lunch break
    if (schedule.lunchBreak && schedule.lunchBreak.enabled) {
      const [lunchHour, lunchMinute] = schedule.lunchBreak.startTime.split(':').map(Number);
      const lunchEndTime = new Date(2000, 0, 1, lunchHour, lunchMinute + schedule.lunchBreak.duration);
      const currentTime = new Date(2000, 0, 1, hour, minute);
      
      if (currentTime >= new Date(2000, 0, 1, lunchHour, lunchMinute) && currentTime < lunchEndTime) {
        minute += schedule.slotDuration;
        if (minute >= 60) {
          minute = 0;
          hour++;
        }
        continue;
      }
    }
    
    slots.push(timeStr);
    minute += schedule.slotDuration;
    if (minute >= 60) {
      minute = 0;
      hour++;
    }
  }
  
  return slots;
}

function getDataKey(key) {
  const user = JSON.parse(localStorage.getItem("user"));
  return user && user.org ? `${user.org}_${key}` : key;
}

/** True if s is a Supabase patient row UUID. Prefer PatientIdentity when present. */
function appointmentsIsUuidLike(s) {
  if (window.PatientIdentity && typeof window.PatientIdentity.isPatientRowUuid === 'function') {
    return window.PatientIdentity.isPatientRowUuid(s);
  }
  if (typeof window.isUuidLike === 'function') return window.isUuidLike(s);
  return !!(s && typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()));
}

function normalizePersonNameLabel(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildFullNameFromResolved(p) {
  if (!p) return '';
  const parts = [p.firstName, p.middleName, p.lastName].filter(Boolean);
  return normalizePersonNameLabel(parts.join(' '));
}

/**
 * Org for Supabase name lookup: user profile, organizations map, appointment row, FK patient, getCurrentOrgId().
 */
async function resolveOrgIdForAppointmentReconcile(contextAppt, patientFromFk) {
  if (typeof window.resolveOrganizationId === 'function') {
    try {
      const resolved = await window.resolveOrganizationId();
      if (resolved) return resolved;
    } catch (e) {
      console.warn('resolveOrgIdForAppointmentReconcile: resolveOrganizationId failed', e);
    }
  }
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  let orgId = user.organizationId || user.organization_id;
  if (!orgId && user.org) {
    const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
    orgId = orgs[user.org] && orgs[user.org].id;
  }
  if (!orgId && contextAppt) {
    orgId = contextAppt.organizationId || contextAppt.organization_id;
  }
  if (!orgId && patientFromFk) {
    orgId = patientFromFk.organizationId || patientFromFk.organization_id;
  }
  if (!orgId && typeof window.getCurrentOrgId === 'function') {
    try {
      orgId = await window.getCurrentOrgId();
    } catch (e) {
      /* ignore */
    }
  }
  return orgId || null;
}

function legacyDisplayIdFromPatientObject(p) {
  if (!p) return null;
  if (typeof window.getPatientIdentifier === 'function') {
    const leg = window.getPatientIdentifier(p);
    if (leg && !appointmentsIsUuidLike(leg)) return leg;
  }
  if (p.patient_id && !appointmentsIsUuidLike(String(p.patient_id))) return String(p.patient_id);
  if (p.patientNumber && !appointmentsIsUuidLike(String(p.patientNumber))) return String(p.patientNumber);
  if (p.id && !appointmentsIsUuidLike(String(p.id))) return String(p.id);
  return null;
}

/**
 * If appointments.patient_id (FK) points to patient A but patient_name on the row still says B,
 * links built from the FK show A. Prefer resolving by the stored display name so URLs match the list.
 * @param {object} [contextAppt] - appointment object with organizationId / patientName (optional)
 */
async function reconcileAppointmentUrlPatientId(urlToken, storedAppointmentName, contextAppt) {
  const label = String(storedAppointmentName || '').trim();
  if (!label || !urlToken) return String(urlToken).trim();
  const token = String(urlToken).trim();
  if (typeof window.resolvePatientByIdentifier !== 'function') return token;

  let pFk = null;
  try {
    pFk = await window.resolvePatientByIdentifier(token);
  } catch (e) {
    console.warn('reconcileAppointmentUrlPatientId: resolve failed', e);
  }

  if (pFk) {
    const fkName = buildFullNameFromResolved(pFk);
    if (fkName && fkName === normalizePersonNameLabel(label)) {
      const leg = legacyDisplayIdFromPatientObject(pFk);
      if (leg) return leg;
      return token;
    }
  }

  let orgId = await resolveOrgIdForAppointmentReconcile(contextAppt, pFk);
  if (!orgId || typeof window.resolveSupabasePatientIdByName !== 'function') {
    if (label && pFk) {
      console.warn('[appointments] Reconcile skipped: no org id for name lookup.', { label, hasFk: !!pFk });
    }
    return token;
  }

  try {
    const uuid = await window.resolveSupabasePatientIdByName(label, orgId, null);
    if (!uuid) {
      console.warn('[appointments] Reconcile: resolveSupabasePatientIdByName returned no match.', { label, orgId });
      return token;
    }
    const pByName = await window.resolvePatientByIdentifier(uuid);
    const leg = legacyDisplayIdFromPatientObject(pByName);
    if (leg) {
      console.warn('[appointments] Reconciled link patient id to match scheduled name on row.', { was: token, now: leg, label });
      return leg;
    }
  } catch (e) {
    console.warn('reconcileAppointmentUrlPatientId:', e);
  }
  return token;
}
window.reconcileAppointmentUrlPatientId = reconcileAppointmentUrlPatientId;

/**
 * Legacy display id for patient links / Open Note, UUID→legacy, then name-vs-FK reconcile.
 */
async function appointmentDisplayPatientIdForLink(appt) {
  let patientId = appt.patientId || appt.patient_id;
  if (!patientId) {
    patientId = await getPatientIdByName(appt.patientName);
  }
  if (patientId && appointmentsIsUuidLike(patientId) && typeof window.resolvePatientByIdentifier === 'function') {
    try {
      const patient = await window.resolvePatientByIdentifier(patientId);
      if (patient) {
        const legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id);
        if (legacyId && !appointmentsIsUuidLike(legacyId)) {
          patientId = legacyId;
        }
      }
    } catch (error) {
      console.warn('Could not resolve UUID to legacy ID for appointment:', error);
    }
  }
  const stored = (appt.patientName || appt.patient_name || '').trim();
  if (patientId && stored) {
    try {
      patientId = await reconcileAppointmentUrlPatientId(patientId, stored, appt);
    } catch (e) { /* non-fatal */ }
  }
  return patientId;
}

// Create in-app notification when appointment is saved (immediate feedback)
async function createAppointmentSavedNotification(appointment, orgId) {
  try {
    const supabase = window.supabaseClient;
    if (!supabase) return;
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let userId = user.id || user.user_id || user.userId;
    if (userId && typeof userId === 'string' && !userId.includes('-')) userId = null;
    if (!userId && (user.auth_user_id || user.authUserId)) {
      const { data: u } = await supabase.from('users').select('id').eq('auth_user_id', user.auth_user_id || user.authUserId).maybeSingle();
      if (u && u.id) userId = u.id;
    }
    if (!userId || !orgId) return;
    const dateStr = appointment.date || appointment.appointment_date || '';
    const timeStr = (appointment.time || appointment.appointment_time || '').toString().slice(0, 5);
    const patientName = appointment.patientName || appointment.patient_name || 'Patient';
    const title = 'Appointment scheduled';
    const body = `${patientName} on ${dateStr}${timeStr ? ' at ' + timeStr : ''}`;
    await supabase.from('notifications').insert({
      organization_id: orgId,
      user_id: userId,
      type: 'appointment_reminder',
      title,
      body,
      priority: 'normal',
      action_url: '/appointments'
    });
  } catch (e) {
    if (e?.message) console.warn('Appointment notification:', e.message);
  }
}
window.createAppointmentSavedNotification = createAppointmentSavedNotification;

// Helper: Check invoice payment status for an appointment
async function getAppointmentInvoiceStatus(appointmentId) {
  try {
    if (typeof window.getAllInvoices !== 'function') {
      return null; // Billing system not loaded
    }
    
    const invoices = await window.getAllInvoices();
    if (!Array.isArray(invoices)) {
      return null;
    }
    
    // Find invoice linked to this appointment (via encounterId)
    const invoice = invoices.find(inv => inv.encounterId === appointmentId);
    
    if (!invoice) {
      return null; // No invoice found
    }
    
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status, // pending, paid, partial, overdue, cancelled
      amountDue: invoice.amountDue || 0,
      amountPaid: invoice.amountPaid || 0,
      total: invoice.total || 0,
      currency: invoice.currency || 'USD'
    };
  } catch (error) {
    console.error('Error checking invoice status:', error);
    return null;
  }
}

// Helper: Create appointment row (extracted for reuse in search)
async function createAppointmentRow(appt) {
  const patientId = await appointmentDisplayPatientIdForLink(appt);
  const storedApptName = (appt.patientName || appt.patient_name || '').trim();
  
  const timeSpan = calculateTimeSpan(appt.checkInTime, appt.checkOutTime);
  let actionsHtml = '';
  
  // Check invoice payment status
  const invoiceStatus = await getAppointmentInvoiceStatus(appt.id);
  let paymentStatusHtml = '';
  
  if (invoiceStatus) {
    if (invoiceStatus.status === 'paid' || invoiceStatus.amountDue <= 0) {
      // Payment completed
      paymentStatusHtml = `<span style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 5px; display: inline-block;" title="Payment completed - Invoice ${invoiceStatus.invoiceNumber}">✓ Paid</span>`;
    } else {
      // Invoice exists but unpaid - show red warning icon
      const currency = invoiceStatus.currency || 'USD';
      const amountDue = invoiceStatus.amountDue || 0;
      const amountText = typeof window.formatCurrency === 'function' ? window.formatCurrency(amountDue, currency) : (currency + ' ' + amountDue.toFixed(2));
      paymentStatusHtml = `<span style="background: #f44336; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 5px; display: inline-block; cursor: help;" title="Invoice ${invoiceStatus.invoiceNumber} - Unpaid (Amount due: ${amountText})">⚠ Unpaid</span>`;
    }
  }
  
  // Add check-in/check-out button
  if (!appt.checkInTime) {
    actionsHtml += `<button type="button" class="action-btn checkin-btn" onclick="event.preventDefault(); event.stopPropagation(); checkIn('${appt.id}'); return false;">Check-in</button>`;
  } else if (!appt.checkOutTime) {
    actionsHtml += `<button type="button" class="action-btn checkout-btn" onclick="event.preventDefault(); event.stopPropagation(); checkOut('${appt.id}'); return false;">Check-out</button>`;
  }
  
  // Add edit button - use data attribute and event listener for better reliability
  actionsHtml += `<button class="action-btn edit-btn" data-appointment-id="${appt.id}" onclick="window.editAppointment('${appt.id}')">Edit</button>`;
  
  // Add delete button
  actionsHtml += `<button class="action-btn delete-btn" onclick="deleteAppointment('${appt.id}')">Delete</button>`;
  
  // Add open note button
  // Pass appointment type if available
  const appointmentType = appt.appointment_type || appt.appointmentType || appt.visit_type || appt.type || '';
  
  // Show the stored label as-is (preserves legacy lab line-item names, etc.)
  const appointmentTypeDisplay = appointmentType || 'Not specified';
  
  // Pass patientId if available, otherwise fall back to patientName; 4th arg = stored list name (reconciles FK vs label)
  const patientIdentifier = patientId || appt.patientName;
  const escAttr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  actionsHtml += `<button type="button" class="action-btn note-btn" data-pid="${escAttr(patientIdentifier)}" data-date="${escAttr(appt.date)}" data-type="${escAttr(appointmentType)}" data-pname="${encodeURIComponent(storedApptName)}" onclick="if(window._openClinicalNoteFromApptRow)window._openClinicalNoteFromApptRow(event)">Open Note</button>`;
  
  // Add generate invoice button or payment status
  if (invoiceStatus) {
    // Invoice exists - show payment status and link to collect payment if unpaid
    if (invoiceStatus.status !== 'paid' && invoiceStatus.amountDue > 0) {
      actionsHtml += `<button class="action-btn payment-btn" onclick="window.location.href='/collect-payment?invoiceId=${invoiceStatus.invoiceId}'" title="Collect payment for invoice ${invoiceStatus.invoiceNumber}">💳 Pay</button>`;
    }
    actionsHtml += paymentStatusHtml;
  } else {
    // No invoice - show generate invoice button
    actionsHtml += `<button class="action-btn invoice-btn" onclick="generateInvoiceFromAppointment('${appt.id}', '${appt.patientId || appt.patientName}', '${appointmentType}')">💰 Invoice</button>`;
  }
  
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><a href="patient-details?id=${patientId}">${appt.patientName}</a></td>
    <td>${appt.date}</td>
    <td>${appt.time}</td>
    <td>${appointmentTypeDisplay}</td>
    <td>${timeSpan}</td>
    <td>${actionsHtml}</td>
  `;
  return row;
}

// Load patients data needed for appointments (patient links)
async function loadPatientsForAppointments() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const orgId = user.organizationId || (user.org ? JSON.parse(localStorage.getItem("organizations") || "{}")[user.org]?.id : null);
  
  if (!orgId) {
    console.log('⚠️ No organization ID found for loading patients');
    return;
  }
  
  // Check if patients are already loaded (but force reload if they contain test data)
  const existingPatientsRaw = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const existingPatients = Array.isArray(existingPatientsRaw)
    ? existingPatientsRaw.filter(p => p != null && typeof p === 'object')
    : [];
  if (existingPatientsRaw.length !== existingPatients.length) {
    try {
      localStorage.setItem(getDataKey('patients'), JSON.stringify(existingPatients));
    } catch (e) {
      console.warn('appointments: could not compact null patient entries', e);
    }
  }
  if (existingPatients.length > 0) {
    // Check if patients contain test data - if so, force reload
    const hasTestPatients = existingPatients.some(p => {
      if (!p.firstName && !p.lastName) return false;
      const name = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      return name.includes('test') || name.includes('e2e') || name.includes('debug') || name.includes('verified');
    });
    
    if (!hasTestPatients) {
      // Patients already loaded
      return;
    } else {
      console.log('🧹 Found test patients in cache, forcing reload from Supabase...');
      // Clear the cache to force reload
      localStorage.removeItem(getDataKey("patients"));
    }
  }
  
  // Load patients from Supabase
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      console.log('🔄 Loading patients from Supabase for appointments...');
      const { data: supabasePatients, error } = await supabaseClient
        .from('patients')
        .select('*')
        .eq('organization_id', orgId);
      
      if (error) {
        console.error('❌ Error loading patients from Supabase:', error);
        return;
      }
      
      if (supabasePatients && supabasePatients.length > 0) {
        console.log('✅ Loaded patients from Supabase:', supabasePatients.length);
        
        // Convert Supabase format to localStorage format
        const convertedPatients = supabasePatients.map(sp => ({
          id: sp.id,
          firstName: sp.first_name,
          middleName: sp.middle_name || '',
          lastName: sp.last_name,
          dob: sp.date_of_birth,
          phone: sp.phone,
          email: sp.email || '',
          address: sp.address || '',
          gender: sp.gender || 'Male',
          organizationId: sp.organization_id
        }));
        
        // Save to localStorage
        localStorage.setItem(getDataKey("patients"), JSON.stringify(convertedPatients));
        console.log('✅ Patients saved to localStorage for appointment links');
      }
    } catch (error) {
      console.error('❌ Exception loading patients from Supabase:', error);
    }
  }
}

// Load appointments list with cancel buttons and open note buttons
// Pagination state
let appointmentsPageNumber = 1;
const APPOINTMENTS_PER_PAGE = 10;
let allAppointments = [];
let filteredAppointments = [];

async function loadAppointments(forceRefresh = false) {
  // STEP 0: Ensure patients are loaded first (needed for patient links)
  await loadPatientsForAppointments();
  
  // Use universal data loader for consistency across all devices
  if (typeof window.loadAppointmentsWithSupabasePriority === 'function') {
    console.log('🔄 Using universal data loader for appointments...');
    const appointments = await window.loadAppointmentsWithSupabasePriority(forceRefresh);
    return displayAppointments(appointments);
  }
  
  // Fallback to original logic if universal loader not available
  console.log('⚠️ Universal data loader not available, using fallback logic');
  let appointments = [];
  // STEP 1: Load from Supabase (PRIORITY - SUSTAINABLE SOLUTION)
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      console.log('🔄 Loading appointments from Supabase...');
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      // Get organization ID from user data or organizations data
      let orgId = user.organizationId;
      if (!orgId && user.org) {
        // Try to get organization ID from organizations data
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = organizations[user.org];
        if (orgData && orgData.id) {
          orgId = orgData.id;
          console.log('✅ Found organization ID from organizations data:', orgId);
        }
      }
      
      if (orgId) {
        const { data: supabaseAppointments, error } = await supabaseClient
          .from('appointments')
          .select('*')
          .eq('organization_id', orgId);
        
        if (error) {
          console.error('❌ Error loading appointments from Supabase:', error);
          // Fallback to localStorage if Supabase fails
          appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
        } else {
          console.log('✅ Loaded', supabaseAppointments?.length || 0, 'appointments from Supabase');
          
          // Convert Supabase format to localStorage format; deduplicate by (patientId, date, time)
          if (supabaseAppointments && supabaseAppointments.length > 0) {
            const mapped = supabaseAppointments.map(sa => ({
              id: sa.appointment_id || `${sa.appointment_date}_${sa.appointment_time?.replace(':', '')}`,
              patientId: sa.patient_id,
              patientName: sa.patient_name || 'Unknown Patient',
              date: sa.appointment_date,
              time: sa.appointment_time,
              duration: sa.duration || 30,
              visitType: sa.visit_type || 'General',
              doctor: sa.doctor_name || 'Dr. Smith',
              appointment_type: sa.appointment_type || 'General Consultation',
              appointment_type_id: sa.appointment_type_id || '',
              status: sa.status || 'scheduled',
              notes: sa.notes || '',
              organizationId: sa.organization_id,
              checkInTime: sa.checked_in_at ? new Date(sa.checked_in_at).getTime() : null,
              checkOutTime: sa.checked_out_at ? new Date(sa.checked_out_at).getTime() : null
            }));
            const slotKey = (a) => `${a.patientId}|${a.date}|${a.time}`;
            const bySlot = new Map();
            for (const a of mapped) {
              const key = slotKey(a);
              const existing = bySlot.get(key);
              const preferThis = !existing ||
                ((a.appointment_type && a.appointment_type !== 'General Consultation') && (!existing.appointment_type || existing.appointment_type === 'General Consultation'));
              if (preferThis) bySlot.set(key, a);
            }
            appointments = Array.from(bySlot.values());
            localStorage.setItem(getDataKey("appointments"), JSON.stringify(appointments));
          } else {
            // No appointments in Supabase, use localStorage as fallback
            appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
          }
        }
      } else {
        console.warn('⚠️ No organization ID found, using localStorage only');
        appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
      }
    } catch (error) {
      console.error('❌ Exception loading appointments from Supabase:', error);
      // Fallback to localStorage if Supabase fails
      appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
    }
  } else {
    console.warn('⚠️ Supabase client not available, using localStorage only');
    appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  }

  console.log('Appointments after merge:', appointments.length);

  // Sort appointments from most recent to oldest (by date, then by time)
  allAppointments = sortAppointmentsByDateDesc(appointments);

  appointmentsPageNumber = 1; // Reset to first page when loading
  filterAppointments();  // Initial load via filter (handles search if active)
  // One-time cleanup of duplicate appointment rows in Supabase (same patient/date/time)
  if (typeof cleanupDuplicateAppointmentsInSupabase === 'function') {
    cleanupDuplicateAppointmentsInSupabase().catch(() => {});
  }
}

/** Safe sort for list UI (missing date/time or patientName no longer break render). */
function sortAppointmentsByDateDesc(appointments) {
  const list = Array.isArray(appointments) ? appointments : [];
  return list.sort((a, b) => {
    const da = (a && a.date) || a.appointment_date || '';
    const ta = (a && a.time) || a.appointment_time || '00:00:00';
    const db = (b && b.date) || b.appointment_date || '';
    const tb = (b && b.time) || b.appointment_time || '00:00:00';
    const tss = (t) => String(t || '00:00:00').slice(0, 8);
    const dateA = new Date(`${da}T${tss(ta)}`);
    const dateB = new Date(`${db}T${tss(tb)}`);
    const nA = dateA.getTime();
    const nB = dateB.getTime();
    return (Number.isNaN(nB) ? 0 : nB) - (Number.isNaN(nA) ? 0 : nA);
  });
}

// Display appointments function for universal data loader
function displayAppointments(appointments) {
  // Displaying appointments from universal data loader
  allAppointments = sortAppointmentsByDateDesc(appointments);

  appointmentsPageNumber = 1; // Reset to first page when loading
  filterAppointments();  // Initial load via filter (handles search if active)
}

// Filter and display appointments based on search query with pagination
function filterAppointments() {
  const tbody = document.getElementById("appointment-list");
  if (!tbody) return;
  
  const query = (document.getElementById("appt-search") || {}).value || '';
  
  // Filter appointments based on search query (guard missing fields — undefined patientName threw and cleared UI)
  const q = (query || '').toLowerCase();
  filteredAppointments = allAppointments.filter((appt) => {
    const name = (appt.patientName || appt.patient_name || '').toString().toLowerCase();
    const dateStr = (appt.date || appt.appointment_date || '').toString();
    const doc = (appt.doctor || '').toString().toLowerCase();
    return name.includes(q) || dateStr.includes(query) || doc.includes(q);
  });
  
  // Reset to first page when filtering
  appointmentsPageNumber = 1;
  
  displayPaginatedAppointments();
}

// Display appointments for current page
async function displayPaginatedAppointments() {
  const tbody = document.getElementById("appointment-list");
  if (!tbody) return;
  
  const startIndex = (appointmentsPageNumber - 1) * APPOINTMENTS_PER_PAGE;
  const endIndex = startIndex + APPOINTMENTS_PER_PAGE;
  const pageAppointments = filteredAppointments.slice(startIndex, endIndex);
  
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading appointments...</td></tr>';
  
  if (pageAppointments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No appointments found</td></tr>';
    updatePaginationControls();
    return;
  }
  
  // Clear loading message
  tbody.innerHTML = "";
  
  // Create rows asynchronously
  for (const appt of pageAppointments) {
    try {
      const row = await createAppointmentRow(appt);
      tbody.appendChild(row);
    } catch (error) {
      console.error('Error creating appointment row:', error);
      // Create a basic row as fallback
      let patientId = await appointmentDisplayPatientIdForLink(appt);
      if (!patientId) {
        patientId = appt.patientId || appt.patient_id || await getPatientIdByName(appt.patientName);
      }
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><a href="patient-details?id=${patientId}">${appt.patientName}</a></td>
        <td>${appt.date}</td>
        <td>${appt.time}</td>
        <td>${appt.appointment_type || 'Not specified'}</td>
        <td>-</td>
        <td><button class="action-btn" onclick="window.editAppointment('${appt.id}')">Edit</button></td>
      `;
      tbody.appendChild(row);
    }
  }
  
  // Force table alignment after loading appointments
  setTimeout(() => {
    const appointmentsTable = document.querySelector('.appointments-table');
    if (appointmentsTable) {
      appointmentsTable.style.setProperty('display', 'table', 'important');
      appointmentsTable.style.setProperty('table-layout', 'fixed', 'important');
      
      const thead = appointmentsTable.querySelector('thead');
      const tbody = appointmentsTable.querySelector('tbody');
      const rows = appointmentsTable.querySelectorAll('tr');
      const cells = appointmentsTable.querySelectorAll('th, td');
      
      if (thead) thead.style.setProperty('display', 'table-header-group', 'important');
      if (tbody) tbody.style.setProperty('display', 'table-row-group', 'important');
      rows.forEach(row => row.style.setProperty('display', 'table-row', 'important'));
      cells.forEach(cell => cell.style.setProperty('display', 'table-cell', 'important'));
    }
  }, 10);
  
  updatePaginationControls();
}

// Update pagination controls
function updatePaginationControls() {
  const totalPages = Math.ceil(filteredAppointments.length / APPOINTMENTS_PER_PAGE);
  const pageInfo = document.getElementById("page-info");
  const prevButton = document.getElementById("prev-page");
  const nextButton = document.getElementById("next-page");
  const topPageInfo = document.getElementById("top-page-info");
  const topPrevButton = document.getElementById("top-prev-page");
  const topNextButton = document.getElementById("top-next-page");
  
  if (pageInfo) {
    pageInfo.textContent = `Page ${appointmentsPageNumber} of ${totalPages} (${filteredAppointments.length} appointments)`;
  }
  if (topPageInfo) {
    topPageInfo.textContent = `Page ${appointmentsPageNumber} of ${totalPages} (${filteredAppointments.length} appointments)`;
  }
  
  if (prevButton) {
    prevButton.disabled = appointmentsPageNumber <= 1;
  }
  if (topPrevButton) {
    topPrevButton.disabled = appointmentsPageNumber <= 1;
  }
  
  if (nextButton) {
    nextButton.disabled = appointmentsPageNumber >= totalPages;
  }
  if (topNextButton) {
    topNextButton.disabled = appointmentsPageNumber >= totalPages;
  }
}

// Change page function
function changePage(direction) {
  const totalPages = Math.ceil(filteredAppointments.length / APPOINTMENTS_PER_PAGE);
  const newPage = appointmentsPageNumber + direction;
  
  if (newPage >= 1 && newPage <= totalPages) {
    appointmentsPageNumber = newPage;
    displayPaginatedAppointments();
  }
}

// Debounce helper for search
function debounce(func, delay) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), delay);
  };
}

// Setup search for appointments
function setupAppointmentSearch() {
  const searchInput = document.getElementById("appt-search");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(function() {
      filterAppointments(); // Use the updated filterAppointments function
    }, 300));
  }
}

// Calculate time span between check-in and check-out
function calculateTimeSpan(checkIn, checkOut) {
  if (!checkIn) return 'N/A';
  if (!checkOut) return 'In Progress';
  const duration = (checkOut - checkIn) / 60000;  // in minutes
  return `${Math.round(duration)} minutes`;
}

// Check-in for appointment
window.checkIn = async function(id) {
  try {
    console.log('🔄 Check-in initiated for appointment:', id);
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const index = appointments.findIndex(a => a.id === id);
  if (index !== -1) {
    appointments[index].checkInTime = Date.now();
    localStorage.setItem(getDataKey("appointments"), JSON.stringify(appointments));
      console.log('✅ Check-in time saved to localStorage:', new Date(appointments[index].checkInTime).toLocaleString());
    
    // Sync to Supabase
    await syncAppointmentUpdateToSupabase(appointments[index]);
      
      // Clear cache to force fresh load
      if (typeof window.clearAppointmentsCache === 'function') {
        window.clearAppointmentsCache();
      }
    
    loadAppointments();  // Reload to update buttons and duration
      console.log('✅ Check-in completed successfully');
    } else {
      console.error('❌ Appointment not found:', id);
      alert('Appointment not found. Please refresh the page and try again.');
  }
  } catch (error) {
    console.error('❌ Error during check-in:', error);
    alert('An error occurred during check-in. Please try again.');
  }
  return false; // Prevent any default behavior
};

// Check-out for appointment
window.checkOut = async function(id) {
  try {
    console.log('🔄 Check-out initiated for appointment:', id);
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const index = appointments.findIndex(a => a.id === id);
  if (index !== -1) {
    appointments[index].checkOutTime = Date.now();
    localStorage.setItem(getDataKey("appointments"), JSON.stringify(appointments));
      console.log('✅ Check-out time saved to localStorage:', new Date(appointments[index].checkOutTime).toLocaleString());
    
    // Sync to Supabase
    await syncAppointmentUpdateToSupabase(appointments[index]);
      
      // Clear cache to force fresh load
      if (typeof window.clearAppointmentsCache === 'function') {
        window.clearAppointmentsCache();
      }
    
    loadAppointments();  // Reload to update buttons and duration
      console.log('✅ Check-out completed successfully');
    } else {
      console.error('❌ Appointment not found:', id);
      alert('Appointment not found. Please refresh the page and try again.');
  }
  } catch (error) {
    console.error('❌ Error during check-out:', error);
    alert('An error occurred during check-out. Please try again.');
  }
  return false; // Prevent any default behavior
};

// Edit appointment - Check if note is locked, then allow editing
window.editAppointment = async function(id) {
  // Navigate to edit appointment page
  window.location.href = `edit-appointment.html?id=${encodeURIComponent(id)}`;
};

// Function to load existing doctors into dropdown
async function loadDoctors() {
  // Get organization ID
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  let orgId = currentUser.organizationId || currentUser.organization_id;
  
  // Resolve organization ID if needed
  if (!orgId && currentUser.org) {
    const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
    const orgData = organizations[currentUser.org];
    if (orgData && orgData.id) {
      orgId = orgData.id;
    } else if (typeof currentUser.org === 'string' && currentUser.org.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // org is already a UUID
      orgId = currentUser.org;
    }
  }
  
  console.log('🔍 Loading doctors for organization:', orgId);
  
  let users = [];
  
  // Try Supabase first to get all users in the organization
  if (window.supabaseClient && orgId) {
    try {
      console.log('🔍 Fetching doctors from Supabase...');
      const { data: supabaseUsers, error } = await window.supabaseClient
        .from('users')
        .select('*')
        .eq('organization_id', orgId);
      
      if (!error && supabaseUsers && supabaseUsers.length > 0) {
        console.log(`✅ Loaded ${supabaseUsers.length} users from Supabase`);
        // Convert Supabase format to localStorage format
        users = supabaseUsers.map(su => ({
          id: su.id,
          username: su.username,
          firstName: su.first_name || su.firstName || '',
          lastName: su.last_name || su.lastName || '',
          email: su.email || '',
          role: su.role || '',
          organizationId: su.organization_id,
          organization_id: su.organization_id
        }));
        
        // Save to localStorage for future use
        localStorage.setItem(getDataKey("users"), JSON.stringify(users));
      } else {
        console.warn('⚠️ No users found in Supabase or error:', error);
      }
    } catch (error) {
      console.warn('⚠️ Supabase query failed:', error);
    }
  }
  
  // Fallback to localStorage if Supabase didn't return users
  if (users.length === 0) {
    users = JSON.parse(localStorage.getItem(getDataKey("users")) || "[]");
    console.log('🔍 Users from localStorage:', users.length);
    
    // Also check the current user (stored as single object)
    if (currentUser && currentUser.username) {
      const existingUser = users.find(u => u.username === currentUser.username);
      if (!existingUser) {
        users.push(currentUser);
        console.log('🔍 Added current user to users array');
      }
    }
  }
  
  // Filter for doctors with various role formats
  const doctors = users.filter(user => {
    const role = (user.role || '').toLowerCase();
    const isDoctor = role === "doctor" || role.includes("doctor");
    return isDoctor;
  });
  
  console.log('🔍 Doctors found:', doctors.length);
  
  // Return array of doctor names in "FirstName LastName" format
  const doctorNames = doctors
    .map(doctor => {
      const firstName = doctor.firstName || doctor.first_name || '';
      const lastName = doctor.lastName || doctor.last_name || '';
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      }
      return null;
    })
    .filter(name => name !== null);
  
  return doctorNames;
}

// Show edit appointment modal
async function showEditAppointmentModal(appointment) {
  // Remove existing modal if any
  const existingModal = document.getElementById('edit-appointment-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'edit-appointment-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 30px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  `;
  
  // Load doctors and appointment types
  const doctors = await loadDoctors();
  const appointmentTypes = await window.getAppointmentTypes();
  
  // Build appointment type options
  let appointmentTypeOptions = '<option value="">Select appointment type...</option>';
  const categories = {};
  appointmentTypes.forEach(type => {
    if (!categories[type.category]) {
      categories[type.category] = [];
    }
    categories[type.category].push(type);
  });
  
  const standardCategories = ['Consultation', 'Laboratory', 'Vitals'];
  const otherCategories = Object.keys(categories).filter(cat => !standardCategories.includes(cat));
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  standardCategories.forEach(category => {
    if (categories[category]) {
      appointmentTypeOptions += `<optgroup label="${esc(category)}">`;
      categories[category].forEach(type => {
        appointmentTypeOptions += `<option value="${esc(type.id)}">${esc(type.name)}</option>`;
      });
      appointmentTypeOptions += '</optgroup>';
    }
  });
  
  otherCategories.forEach(category => {
    if (categories[category]) {
      appointmentTypeOptions += `<optgroup label="${esc(category)}">`;
      categories[category].forEach(type => {
        appointmentTypeOptions += `<option value="${esc(type.id)}">${esc(type.name)}</option>`;
      });
      appointmentTypeOptions += '</optgroup>';
    }
  });
  
  // Build doctor options
  let doctorOptions = '<option value="">Select a doctor...</option>';
  if (doctors && doctors.length > 0) {
    doctors.forEach(doctor => {
      const selected = appointment.doctor === doctor ? 'selected' : '';
      doctorOptions += `<option value="${doctor}" ${selected}>Dr. ${doctor}</option>`;
    });
  }
  doctorOptions += '<option value="other">Other...</option>';
  
  modalContent.innerHTML = `
    <h2 style="margin-top: 0; color: #008753;">Edit Appointment</h2>
    <form id="edit-appointment-form">
      <input type="hidden" id="edit-appointment-id" value="${appointment.id}">
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Patient:</label>
        <input type="text" value="${appointment.patientName}" disabled style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5;">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label for="edit-appointment-type" style="display: block; margin-bottom: 5px; font-weight: 600;">Appointment Type:</label>
        <select id="edit-appointment-type" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          ${appointmentTypeOptions}
        </select>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label for="edit-appointment-date" style="display: block; margin-bottom: 5px; font-weight: 600;">Date:</label>
        <input type="date" id="edit-appointment-date" value="${appointment.date}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label for="edit-appointment-time" style="display: block; margin-bottom: 5px; font-weight: 600;">Time:</label>
        <input type="time" id="edit-appointment-time" value="${appointment.time || ''}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label for="edit-appointment-doctor" style="display: block; margin-bottom: 5px; font-weight: 600;">Doctor:</label>
        <select id="edit-appointment-doctor" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          ${doctorOptions}
        </select>
        <input type="text" id="edit-appointment-doctor-custom" placeholder="Enter doctor name manually" style="display: none; margin-top: 5px; width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label for="edit-appointment-notes" style="display: block; margin-bottom: 5px; font-weight: 600;">Notes:</label>
        <textarea id="edit-appointment-notes" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 80px;">${appointment.notes || ''}</textarea>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button type="submit" style="flex: 1; background: #008753; color: white; border: none; padding: 12px; border-radius: 4px; font-weight: 600; cursor: pointer;">Save Changes</button>
        <button type="button" onclick="closeEditAppointmentModal()" style="flex: 1; background: #6c757d; color: white; border: none; padding: 12px; border-radius: 4px; font-weight: 600; cursor: pointer;">Cancel</button>
      </div>
    </form>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  const typeSelectForEdit = document.getElementById('edit-appointment-type');
  if (typeSelectForEdit && typeof window.applyAppointmentTypeToSelect === 'function') {
    await window.applyAppointmentTypeToSelect(typeSelectForEdit, appointment);
  }
  
  // Handle doctor selection
  document.getElementById('edit-appointment-doctor').addEventListener('change', function() {
    const customInput = document.getElementById('edit-appointment-doctor-custom');
    if (this.value === 'other') {
      customInput.style.display = 'block';
      customInput.required = true;
    } else {
      customInput.style.display = 'none';
      customInput.required = false;
    }
  });
  
  // Remove any minimum date restriction on edit modal to allow past dates
  const editDateInput = document.getElementById('edit-appointment-date');
  if (editDateInput) {
    editDateInput.removeAttribute('min');
    editDateInput.setAttribute('min', '1900-01-01'); // Allow all past dates
  }
  
  // Handle form submission
  document.getElementById('edit-appointment-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    await saveAppointmentEdit(appointment.id);
  });
  
  // Close on overlay click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeEditAppointmentModal();
    }
  });
};

// Close edit appointment modal
function closeEditAppointmentModal() {
  const modal = document.getElementById('edit-appointment-modal');
  if (modal) {
    modal.remove();
  }
}

// Save appointment edit
async function saveAppointmentEdit(appointmentId) {
  const form = document.getElementById('edit-appointment-form');
  if (!form) return;
  
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const appointmentIndex = appointments.findIndex(a => a.id === appointmentId);
  
  if (appointmentIndex === -1) {
    alert("Appointment not found.");
    return;
  }
  
  const oldAppointment = { ...appointments[appointmentIndex] };
  
  // Get form values
  const appointmentTypeId = document.getElementById('edit-appointment-type').value;
  const appointmentType = await window.getAppointmentTypeById(appointmentTypeId);
  let appointmentTypeName = appointmentType && appointmentType.name
    ? appointmentType.name
    : (oldAppointment.appointment_type || String(appointmentTypeId || ''));
  
  const doctorSelect = document.getElementById('edit-appointment-doctor');
  const doctorCustom = document.getElementById('edit-appointment-doctor-custom');
  const doctor = doctorSelect.value === 'other' ? doctorCustom.value.trim() : doctorSelect.value;
  
  const date = document.getElementById('edit-appointment-date').value;
  const time = document.getElementById('edit-appointment-time').value;
  const notes = document.getElementById('edit-appointment-notes').value;
  
  // Update appointment
  appointments[appointmentIndex].appointment_type = appointmentTypeName;
  appointments[appointmentIndex].appointment_type_id = appointmentTypeId;
  appointments[appointmentIndex].doctor = doctor;
  appointments[appointmentIndex].date = date;
  appointments[appointmentIndex].time = time;
  appointments[appointmentIndex].notes = notes;
  appointments[appointmentIndex].updated_at = new Date().toISOString();
  
  // Save to localStorage
  localStorage.setItem(getDataKey("appointments"), JSON.stringify(appointments));
  
  // Sync to Supabase
  await syncAppointmentUpdateToSupabase(appointments[appointmentIndex]);
  
  // Log audit event
  if (typeof logAuditEvent !== 'undefined') {
    logAuditEvent('appointment_edited', {
      appointmentId: appointmentId,
      patientName: appointments[appointmentIndex].patientName,
      changes: {
        appointmentType: { from: oldAppointment.appointment_type, to: appointmentTypeName },
        doctor: { from: oldAppointment.doctor, to: doctor },
        date: { from: oldAppointment.date, to: date },
        time: { from: oldAppointment.time, to: time },
        notes: { from: oldAppointment.notes, to: notes }
      }
    });
  }
  
  // Close modal and reload (force refresh to bypass cache - ensures edited data shows first time)
  closeEditAppointmentModal();
  await loadAppointments(true);
  
  if (typeof window.showSuccessNotification === 'function') {
    window.showSuccessNotification('Appointment updated successfully');
  } else {
    alert('Appointment updated successfully');
  }
}

// Sync appointment update to Supabase
async function syncAppointmentUpdateToSupabase(appointment) {
  if (!window.supabaseClient) {
    console.warn('⚠️ Supabase client not available for appointment update');
    return;
  }
  
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = appointment.organization_id || appointment.organizationId || user.organizationId || user.organization_id;
    
    if (!orgId && user.org) {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const orgData = organizations[user.org];
      if (orgData && orgData.id) {
        orgId = orgData.id;
      }
    }
    
    if (!orgId) {
      console.error('❌ Cannot determine organization ID for appointment update');
      return;
    }
    
    // Normalize time
    let normalizedTime = appointment.time;
    if (normalizedTime && normalizedTime.split(':').length === 2) {
      normalizedTime = normalizedTime + ':00';
    }
    
    // Update payload - only fields that can change (exclude appointment_id, org)
    // Use doctor (schema column); doctor_name may exist if added later
    const supabaseUpdate = {
      patient_id: appointment.patientId,
      patient_name: appointment.patientName,
      appointment_date: appointment.date,
      appointment_time: normalizedTime || appointment.time,
      doctor_name: appointment.doctor,
      appointment_type: appointment.appointment_type || 'General Consultation',
      notes: appointment.notes || '',
      status: (appointment.status || 'scheduled').toLowerCase(),
      duration: appointment.duration || 30,
      updated_at: new Date().toISOString()
    };
    
    // Prefer Supabase row UUID (id) - most reliable. Fall back to appointment_id.
    let result;
    if (appointment.supabaseId && appointment.supabaseId.includes('-')) {
      result = await window.supabaseClient
        .from('appointments')
        .update(supabaseUpdate)
        .eq('id', appointment.supabaseId);
    } else {
      result = await window.supabaseClient
        .from('appointments')
        .update(supabaseUpdate)
        .eq('appointment_id', appointment.id)
        .eq('organization_id', orgId);
    }
    const { error } = result;
    
    if (error) {
      console.error('❌ Error updating appointment in Supabase:', error);
      // Queue for sync (include full payload for retry)
      if (typeof window.queueForSync === 'function') {
        window.queueForSync('appointment_update', { ...supabaseUpdate, appointment_id: appointment.id, organization_id: orgId });
      }
    } else {
      console.log('✅ Appointment updated in Supabase');
    }
  } catch (error) {
    console.error('❌ Exception updating appointment in Supabase:', error);
  }
}

// Delete appointment
window.deleteAppointment = async function(id) {
  if (!confirm("Are you sure you want to delete this appointment?")) return;
  let appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const appointment = appointments.find(appt => appt.id === id);
  
  // Remove from localStorage immediately
  appointments = appointments.filter(appt => appt.id !== id);
  localStorage.setItem(getDataKey("appointments"), JSON.stringify(appointments));
  
  // Immediately update the displayed list (don't wait for Supabase sync)
  allAppointments = allAppointments.filter(appt => appt.id !== id);
  filteredAppointments = filteredAppointments.filter(appt => appt.id !== id);
  
  // Update pagination if needed
  const totalPages = Math.ceil(filteredAppointments.length / APPOINTMENTS_PER_PAGE);
  if (appointmentsPageNumber > totalPages && totalPages > 0) {
    appointmentsPageNumber = totalPages;
  }
  
  displayPaginatedAppointments(); // Refresh the display immediately
  
  // Sync deletion to Supabase (background - don't block UI)
  syncAppointmentDeleteToSupabase(id).catch(err => {
    console.warn('⚠️ Background sync of deletion failed (non-critical):', err);
  });
  
  // Audit log: Appointment canceled
  if (appointment && typeof logAuditEvent !== 'undefined') {
    logAuditEvent('appointment_canceled', {
      appointmentId: id,
      patientName: appointment.patientName,
      date: appointment.date,
      time: appointment.time
    });
  }
  
  // NO reload from universal data loader - we've already updated the display
  // The background sync will handle Supabase deletion
};

// Open appropriate note for the appointment based on appointment type
// Optional 4th: display name on the appointment row (reconciles stale patient_name vs patient_id)
async function resolveOpenNotePatientContext(patientNameOrId, storedScheduledPatientName) {
  const tokens = [];
  const addToken = (v) => {
    const t = v != null ? String(v).trim() : '';
    if (t && tokens.indexOf(t) === -1) tokens.push(t);
  };
  addToken(patientNameOrId);
  addToken(storedScheduledPatientName);

  let orgId = null;
  if (typeof window.resolveOrganizationId === 'function') {
    try {
      orgId = await window.resolveOrganizationId();
    } catch (e) {
      console.warn('resolveOpenNotePatientContext: org resolve failed', e);
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (typeof window.resolvePatientByIdentifier !== 'function') continue;
    try {
      const p = await window.resolvePatientByIdentifier(token);
      if (p) {
        const rowUuid =
          p._supabaseUuid || (appointmentsIsUuidLike(p.id) ? p.id : null);
        const displayId = legacyDisplayIdFromPatientObject(p) || token;
        return { patient: p, rowUuid, displayId };
      }
    } catch (e) {
      console.warn('resolveOpenNotePatientContext: identifier lookup failed for', token, e);
    }
  }

  for (let j = 0; j < tokens.length; j++) {
    const token = tokens[j];
    if (!/\s/.test(token)) continue;
    let rowUuid = await getPatientIdByName(token);
    if (!rowUuid && orgId && typeof window.resolveSupabasePatientIdByName === 'function') {
      rowUuid = await window.resolveSupabasePatientIdByName(token, orgId, null);
    }
    if (!rowUuid) continue;
    if (typeof window.resolvePatientByIdentifier === 'function') {
      try {
        const p = await window.resolvePatientByIdentifier(rowUuid);
        if (p) {
          return {
            patient: p,
            rowUuid: p._supabaseUuid || rowUuid,
            displayId: legacyDisplayIdFromPatientObject(p) || rowUuid
          };
        }
      } catch (e) {
        /* use rowUuid below */
      }
    }
    return { patient: null, rowUuid, displayId: rowUuid };
  }

  return null;
}

window.openClinicalNote = async function(patientNameOrId, date, appointmentType, storedScheduledPatientName) {
  const ctx = await resolveOpenNotePatientContext(patientNameOrId, storedScheduledPatientName);
  if (!ctx || (!ctx.displayId && !ctx.rowUuid)) {
    alert('Patient not found.');
    return;
  }

  let patientId = ctx.displayId || ctx.rowUuid;
  const preLegacyPatientId = patientId;

  const PI = window.PatientIdentity;
  if (PI && ctx.rowUuid && PI.isPatientRowUuid(ctx.rowUuid)) {
    try {
      const disp = await PI.rowUuidToUrlDisplayId(ctx.rowUuid);
      if (disp) patientId = disp;
    } catch (e) {
      console.warn('openClinicalNote: rowUuidToUrlDisplayId failed', e);
    }
  } else if (appointmentsIsUuidLike(patientId) && typeof window.resolvePatientByIdentifier === 'function') {
    try {
      const patient = await window.resolvePatientByIdentifier(patientId);
      if (patient) {
        const legacyId = legacyDisplayIdFromPatientObject(patient);
        if (legacyId) patientId = legacyId;
      }
    } catch (error) {
      console.warn('Could not resolve UUID to legacy ID for clinical note:', error);
    }
  }

  // Determine note type based on appointment type
  // If appointment type not provided, try to get from appointment data
  if (!appointmentType || appointmentType === '') {
    console.log('🔍 [ROUTING] Appointment type not provided, looking up from appointment data...');
    const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
    const appointment = appointments.find(a => {
      if (a.date !== date) return false;
      const apPid = a.patientId != null ? a.patientId : a.patient_id;
      return apPid === patientId || apPid === preLegacyPatientId || a.patientName === patientNameOrId ||
        (storedScheduledPatientName && a.patientName === storedScheduledPatientName);
    });
    if (appointment) {
      // Try multiple field names for appointment type
      appointmentType = appointment.appointment_type || appointment.appointmentType || appointment.type || '';
      
      // FALLBACK FOR EXISTING APPOINTMENTS: If appointment_type is missing, try to infer from other fields
      if (!appointmentType || appointmentType === '') {
        console.log('🔍 [ROUTING] No appointment_type found, checking for fallback indicators...');
        
        // Check visitType field (legacy field)
        if (appointment.visitType && appointment.visitType.toLowerCase().includes('lab')) {
          appointmentType = 'Lab Intervention - Laboratory Test Appointment';
          console.log('✅ [ROUTING] Inferred lab appointment from visitType:', appointment.visitType);
        }
        // Check notes field for lab-related keywords
        else if (appointment.notes && appointment.notes.toLowerCase().includes('lab')) {
          appointmentType = 'Lab Intervention - Laboratory Test Appointment';
          console.log('✅ [ROUTING] Inferred lab appointment from notes field');
        }
        // Check if doctor is a lab scientist
        else if (appointment.doctor && (
          appointment.doctor.toLowerCase().includes('lab') ||
          appointment.doctor.toLowerCase().includes('scientist')
        )) {
          appointmentType = 'Lab Intervention - Laboratory Test Appointment';
          console.log('✅ [ROUTING] Inferred lab appointment from doctor field:', appointment.doctor);
        }
      }
      
      console.log('🔍 [ROUTING] Final appointment type after lookup:', appointmentType, 'Full appointment:', appointment);
    } else {
      console.warn('⚠️ [ROUTING] Appointment not found in localStorage');
    }
  }
  
  // Determine which note page to open
  let noteUrl = '/clinical-note'; // Default to clinical note
  
  console.log('🔍 [ROUTING] openClinicalNote called with:', {
    patientNameOrId,
    date,
    appointmentType,
    patientId
  });
  
  if (appointmentType) {
    console.log('🔍 [ROUTING] Checking appointment type:', appointmentType, 'Type:', typeof appointmentType);
    
    // Normalize appointment type for matching
    const appointmentTypeLower = (appointmentType || '').toString().toLowerCase().trim();
    const appointmentTypeNormalized = appointmentTypeLower.replace(/\s+/g, ' '); // Normalize whitespace
    
    console.log('🔍 [ROUTING] Normalized appointment type:', appointmentTypeNormalized);
    
    // Check 1: Direct string matching (most reliable)
    const labInterventionPatterns = [
      'lab intervention',
      'lab-intervention',
      'labintervention',
      'lab intervention',
      'laboratory intervention'
    ];
    
    const isLabIntervention = labInterventionPatterns.some(pattern => 
      appointmentTypeNormalized === pattern || 
      appointmentTypeNormalized.includes(pattern) ||
      (appointmentTypeNormalized.includes('lab') && appointmentTypeNormalized.includes('intervention'))
    );
    
    const bloodPressureCheckPatterns = [
      'blood pressure check',
      'blood-pressure-check',
      'bloodpressurecheck'
    ];
    const isBloodPressureCheck = bloodPressureCheckPatterns.some(pattern => 
      appointmentTypeNormalized === pattern || 
      appointmentTypeNormalized.includes(pattern) ||
      (appointmentTypeNormalized.includes('blood') && appointmentTypeNormalized.includes('pressure'))
    );
    
    if (isLabIntervention) {
      noteUrl = '/lab-intervention-note';
      console.log('✅ [ROUTING] Routing to lab-intervention-note (direct string match)');
    } else if (isBloodPressureCheck) {
      noteUrl = '/blood-pressure-check-note';
      console.log('✅ [ROUTING] Routing to blood-pressure-check-note (direct string match)');
    } else {
      // Check 2: Use appointment types utility
      if (typeof window.getNoteTypeForAppointment === 'function' && typeof window.getAppointmentTypes === 'function') {
        try {
          const types = await window.getAppointmentTypes();
          console.log('🔍 [ROUTING] Loaded appointment types:', types.length);
          
          // Try to find by name match (exact or case-insensitive)
          let type = types.find(t => {
            const typeNameLower = (t.name || '').toLowerCase().trim();
            return typeNameLower === appointmentTypeNormalized || 
                   typeNameLower.includes(appointmentTypeNormalized) ||
                   appointmentTypeNormalized.includes(typeNameLower);
          });
          
          // If not found by name, try by ID
          if (!type && appointmentType.includes('-')) {
            type = types.find(t => t.id === appointmentType || t.id === appointmentTypeLower);
          }
          
          // Also check if appointmentType is an ID
          if (!type) {
            type = types.find(t => t.id === appointmentType);
          }
          
          if (type) {
            console.log('🔍 [ROUTING] Found appointment type:', type.name, 'ID:', type.id);
            const noteType = await window.getNoteTypeForAppointment(type.id);
            console.log('🔍 [ROUTING] Note type from utility:', noteType);
            
            if (noteType === 'lab-intervention-note') {
              noteUrl = '/lab-intervention-note';
              console.log('✅ [ROUTING] Routing to lab-intervention-note (utility match)');
            } else if (noteType === 'blood-pressure-check-note') {
              noteUrl = '/blood-pressure-check-note';
              console.log('✅ [ROUTING] Routing to blood-pressure-check-note (utility match)');
            }
          } else {
            console.warn('⚠️ [ROUTING] Appointment type not found in types list:', appointmentType);
            // Fallback: if it contains "lab", route to lab intervention note
            if (appointmentTypeNormalized.includes('lab')) {
              noteUrl = '/lab-intervention-note';
              console.log('✅ [ROUTING] Routing to lab-intervention-note (fallback: contains "lab")');
            }
          }
        } catch (error) {
          console.error('❌ [ROUTING] Error checking appointment type utility:', error);
          // Fallback: if it contains "lab", route to lab intervention note
          if (appointmentTypeNormalized.includes('lab')) {
            noteUrl = '/lab-intervention-note';
            console.log('✅ [ROUTING] Routing to lab-intervention-note (error fallback: contains "lab")');
          }
        }
      } else {
        console.warn('⚠️ [ROUTING] Appointment type utilities not available');
        // Fallback: if it contains "lab", route to lab intervention note
        if (appointmentTypeNormalized.includes('lab')) {
          noteUrl = '/lab-intervention-note';
          console.log('✅ [ROUTING] Routing to lab-intervention-note (no utility fallback: contains "lab")');
        }
      }
    }
  } else {
    console.warn('⚠️ [ROUTING] No appointment type provided, defaulting to clinical-note');
  }
  
  console.log('🚀 [ROUTING] Final decision - Opening note:', noteUrl, 'for appointment type:', appointmentType);
  
  // CRITICAL FIX: Use centralized normalizer to ensure legacy ID for URLs
  let patientIdForUrl = patientId;
  if (typeof window.normalizePatientIdForUrl === 'function') {
    try {
      patientIdForUrl = await window.normalizePatientIdForUrl(patientId);
    } catch (error) {
      console.warn('⚠️ openClinicalNote: Error normalizing patient ID, using fallback:', error);
      // Fallback: Manual normalization
      const pidIsUuid = appointmentsIsUuidLike(patientId);
      if (patientId && pidIsUuid) {
        if (typeof window.resolvePatientByIdentifier === 'function') {
          try {
            const patient = await window.resolvePatientByIdentifier(patientId);
            if (patient) {
              const legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.id);
              if (legacyId && !appointmentsIsUuidLike(legacyId)) {
                patientIdForUrl = legacyId;
              }
            }
          } catch (resolveError) {
            console.warn('Could not resolve UUID to legacy ID:', resolveError);
          }
        }
      }
    }
  } else {
    // Fallback: Manual normalization if normalizer not available
    const pidIsUuidFb = appointmentsIsUuidLike(patientId);
    if (patientId && pidIsUuidFb) {
      try {
        const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
        const patient = patients.find(p => p.id === patientId || p._supabaseUuid === patientId);
        if (patient) {
          const legacyId = window.getPatientIdentifier ? window.getPatientIdentifier(patient) : (patient.patient_id || patient.patientNumber);
          if (legacyId && !appointmentsIsUuidLike(legacyId)) {
            patientIdForUrl = legacyId;
          }
        }
      } catch (error) {
        console.warn('Error resolving patient ID, using UUID:', error);
      }
    }
  }
  
  const schedName = (storedScheduledPatientName != null && String(storedScheduledPatientName).trim() !== '')
    ? String(storedScheduledPatientName).trim()
    : '';
  if (schedName && patientIdForUrl) {
    let apptContext = null;
    try {
      const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
      const sn = normalizePersonNameLabel(schedName);
      apptContext = appointments.find(
        (a) => a.date === date && normalizePersonNameLabel(a.patientName || a.patient_name || '') === sn
      );
    } catch (e) {
      /* ignore */
    }
    try {
      patientIdForUrl = await reconcileAppointmentUrlPatientId(patientIdForUrl, schedName, apptContext);
    } catch (e) {
      console.warn('openClinicalNote: reconcile failed', e);
    }
  }
  let qs = `patientId=${encodeURIComponent(patientIdForUrl)}&visitDate=${encodeURIComponent(date)}`;
  if (
    (!patientIdForUrl || patientIdForUrl === 'Unknown ID' || String(patientIdForUrl).trim() === 'null') &&
    ctx.displayId &&
    ctx.displayId !== 'Unknown ID'
  ) {
    patientIdForUrl = ctx.displayId;
    qs = `patientId=${encodeURIComponent(patientIdForUrl)}&visitDate=${encodeURIComponent(date)}`;
  }
  if (!patientIdForUrl || patientIdForUrl === 'Unknown ID' || String(patientIdForUrl).trim() === 'null') {
    alert('Patient not found.');
    return;
  }
  if (schedName && (noteUrl === '/blood-pressure-check-note' || (noteUrl && noteUrl.indexOf('blood-pressure-check-note') >= 0))) {
    qs += `&scheduledPatientName=${encodeURIComponent(schedName)}`;
  }
  window.location.href = `${noteUrl}?${qs}`;
};

window._openClinicalNoteFromApptRow = function (ev) {
  const b = ev && ev.currentTarget;
  if (!b) return;
  const pid = b.getAttribute('data-pid') || '';
  const d = b.getAttribute('data-date') || '';
  const t = b.getAttribute('data-type') || '';
  const enc = b.getAttribute('data-pname') || '';
  let name = '';
  if (enc) {
    try {
      name = decodeURIComponent(enc);
    } catch (e) {
      name = '';
    }
  }
  if (window.openClinicalNote) {
    window.openClinicalNote(pid, d, t, name);
  }
};

// Setup patient search input for add-appointment.html
function setupPatientSearch() {
  let patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");

  // Migration: If no patients under prefixed key, check non-prefixed and migrate (only if org defined)
  const user = JSON.parse(localStorage.getItem("user"));
  if (patients.length === 0 && user && user.org) {
    const oldPatients = JSON.parse(localStorage.getItem("patients") || "[]");
    if (oldPatients.length > 0) {
      localStorage.setItem(getDataKey("patients"), JSON.stringify(oldPatients));  // Migrate
      localStorage.removeItem("patients");  // Clean up old key
      patients = oldPatients;
    }
  }

  const searchInput = document.getElementById("patient-search");
  const resultsDiv = document.getElementById("patient-results");
  const selectedInput = document.getElementById("patient-name");
  const selectedDisplay = document.getElementById("selected-patient");

  if (searchInput && resultsDiv && selectedInput) {
    // Add event listener for search
    searchInput.addEventListener("input", function() {
      const query = this.value.toLowerCase();
      resultsDiv.innerHTML = '';
      resultsDiv.style.display = 'none';
      if (query.length < 1) return;

      const filtered = patients.filter(patient => {
        const fullName = `${patient.firstName} ${patient.middleName ? patient.middleName : ''} ${patient.lastName}`.toLowerCase().replace(/\s+/g,' ').trim();
        return fullName.includes(query);
      });

      if (filtered.length > 0) {
        resultsDiv.style.display = 'block';
        filtered.forEach(patient => {
          const fullName = `${patient.firstName} ${patient.middleName ? patient.middleName : ''} ${patient.lastName}`.replace(/\s+/g,' ').trim();
          const resultItem = document.createElement("div");
          resultItem.textContent = fullName;
          resultItem.style.cursor = 'pointer';
          resultItem.style.padding = '8px';
          resultItem.style.borderBottom = '1px solid #ddd';
          resultItem.addEventListener("click", function() {
            selectedInput.value = fullName;
            selectedInput.dataset.patientId = patient.id; // store selected id
            const selectedDisplay = document.getElementById("selected-patient");
            if (selectedDisplay) {
              selectedDisplay.textContent = `Selected: ${fullName}`;
              selectedDisplay.dataset.patientId = patient.id;
            }
            resultsDiv.innerHTML = '';
            resultsDiv.style.display = 'none';
            searchInput.value = '';  // Optional: clear search after select
          });
          resultsDiv.appendChild(resultItem);
        });
      }
    });

    // Hide results on click outside
    document.addEventListener("click", function(e) {
      if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
        resultsDiv.style.display = 'none';
      }
    });
  }
}

// Count doctors in the organization
async function getDoctorCount() {
  try {
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = currentUser.organizationId || currentUser.organization_id;
    
    // Resolve organization ID if needed
    if (!orgId && currentUser.org) {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const orgData = organizations[currentUser.org];
      if (orgData && orgData.id) {
        orgId = orgData.id;
      } else if (typeof currentUser.org === 'string' && currentUser.org.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        orgId = currentUser.org;
      }
    }
    
    if (!orgId) {
      console.warn('⚠️ No organization ID found, defaulting to 1 doctor');
      return 1;
    }
    
    // Try Supabase first
    if (window.supabaseClient) {
      try {
        const { data: users, error } = await window.supabaseClient
          .from('users')
          .select('role')
          .eq('organization_id', orgId)
          .eq('status', 'active');
        
        if (!error && users) {
          const doctorCount = users.filter(u => u.role === 'Doctor' || u.role === 'doctor').length;
          return Math.max(1, doctorCount); // At least 1 doctor
        }
      } catch (error) {
        console.warn('⚠️ Error fetching doctors from Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const orgUsers = users.filter(u => {
      const userOrgId = u.organizationId || u.organization_id;
      const userOrg = u.org || u.organization;
      return (userOrgId === orgId) || (userOrg && typeof getAllOrganizations === 'function' && (async () => {
        const orgs = await getAllOrganizations();
        return orgs[userOrg]?.id === orgId;
      })());
    });
    const doctorCount = orgUsers.filter(u => u.role === 'Doctor' || u.role === 'doctor').length;
    return Math.max(1, doctorCount); // At least 1 doctor
  } catch (error) {
    console.error('❌ Error counting doctors:', error);
    return 1; // Default to 1 doctor on error
  }
}

// Count doctors in the organization
async function getDoctorCount() {
  try {
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    let orgId = currentUser.organizationId || currentUser.organization_id;
    
    // Resolve organization ID if needed
    if (!orgId && currentUser.org) {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const orgData = organizations[currentUser.org];
      if (orgData && orgData.id) {
        orgId = orgData.id;
      } else if (typeof currentUser.org === 'string' && currentUser.org.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        orgId = currentUser.org;
      }
    }
    
    if (!orgId) {
      console.warn('⚠️ No organization ID found, defaulting to 1 doctor');
      return 1;
    }
    
    // Try Supabase first
    if (window.supabaseClient) {
      try {
        const { data: users, error } = await window.supabaseClient
          .from('users')
          .select('role')
          .eq('organization_id', orgId)
          .eq('status', 'active');
        
        if (!error && users) {
          const doctorCount = users.filter(u => u.role === 'Doctor' || u.role === 'doctor').length;
          return Math.max(1, doctorCount); // At least 1 doctor
        }
      } catch (error) {
        console.warn('⚠️ Error fetching doctors from Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const orgUsers = users.filter(u => {
      const userOrgId = u.organizationId || u.organization_id;
      const userOrg = u.org || u.organization;
      return (userOrgId === orgId) || (userOrg && typeof getAllOrganizations === 'function' && (async () => {
        const orgs = await getAllOrganizations();
        return orgs[userOrg]?.id === orgId;
      })());
    });
    const doctorCount = orgUsers.filter(u => u.role === 'Doctor' || u.role === 'doctor').length;
    return Math.max(1, doctorCount); // At least 1 doctor
  } catch (error) {
    console.error('❌ Error counting doctors:', error);
    return 1; // Default to 1 doctor on error
  }
}

// Load available slots for selected date
async function loadAvailableSlots() {
  const dateInput = document.getElementById("date");
  const slotSelect = document.getElementById("time-slot");
  if (dateInput && slotSelect) {
    slotSelect.innerHTML = '<option value="">Loading slots...</option>';
    const selectedDate = dateInput.value;
    if (!selectedDate) {
      slotSelect.innerHTML = '<option value="">Select date first</option>';
      return;
    }

    const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");

    // Get all slots
    const allSlots = getAllSlots();

    // Count doctors in organization to multiply available slots
    const doctorCount = await getDoctorCount();
    console.log(`👨‍⚕️ Found ${doctorCount} doctor(s) in organization. Slots will be multiplied by ${doctorCount}.`);
    
    // Count occupied slots per time slot (multiple doctors can occupy same time)
    const occupiedByTime = {};
    appointments
      .filter(appt => appt.date === selectedDate)
      .forEach(appt => {
        if (!occupiedByTime[appt.time]) {
          occupiedByTime[appt.time] = 0;
        }
        occupiedByTime[appt.time]++;
      });

    // Calculate available slots: for each time slot, available = (doctorCount - occupied)
    const available = [];
    allSlots.forEach(slot => {
      const occupiedCount = occupiedByTime[slot] || 0;
      const availableCount = doctorCount - occupiedCount;
      // Add this slot 'availableCount' times to the list
      for (let i = 0; i < availableCount; i++) {
        available.push(slot);
      }
    });
    slotSelect.innerHTML = '<option value="">Select Slot</option>';
    if (available.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.text = "No slots available";
      option.disabled = true;
      slotSelect.appendChild(option);
    } else {
      // Sort slots and remove duplicates for display (but allow multiple selections of same time)
      const uniqueSlots = [...new Set(available)].sort();
      uniqueSlots.forEach(slot => {
        const occupiedCount = occupiedByTime[slot] || 0;
        const availableCount = doctorCount - occupiedCount;
        const option = document.createElement("option");
        option.value = slot;
        // Show how many doctors are available for this slot
        if (availableCount < doctorCount) {
          option.text = `${slot} (${availableCount} of ${doctorCount} doctors available)`;
        } else {
        option.text = slot;
        }
        slotSelect.appendChild(option);
      });
    }
  }
}

// Add appointment
const addForm = document.getElementById("add-appointment-form");
if (addForm) {
  const dateInput = document.getElementById("date");
  if (dateInput) {
    dateInput.addEventListener("change", loadAvailableSlots);
  }

  function isUuid(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }

  function parseNameAndDob(label) {
    const res = { cleanName: (label||'').trim(), dob: null };
    if (!label) return res;
    const m = label.match(/^(.*)\(\s*DOB:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*\)\s*$/i);
    if (m) {
      res.cleanName = m[1].trim().replace(/\s+/g,' ');
      res.dob = m[2];
    } else {
      res.cleanName = label.replace(/\s+/g,' ').trim();
    }
    return res;
  }

  addForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    console.log("Add appointment form submit triggered");
    // Robust element resolution (different templates may use different IDs)
    // add-appointment.html uses: patientName (hidden), patientSearch (search input), selected-patient (display)
    // Other pages may use: patient-name
    const patientNameInput = document.getElementById("patient-name") 
      || document.getElementById("patientName")  // add-appointment.html uses this
      || document.getElementById("patient") 
      || document.querySelector('input[name="patient-name"], input[name="patient"]');
    const dateInputEl = document.getElementById("date") 
      || document.querySelector('input[name="date"]');
    const timeSlotEl = document.getElementById("time-slot") 
      || document.getElementById("time")  // add-appointment.html uses this
      || document.querySelector('select[name="time-slot"], input[name="time"]');
    const doctorEl = document.getElementById("doctor") 
      || document.querySelector('input[name="doctor"], select[name="doctor"]');
    const notesEl = document.getElementById("notes") 
      || document.querySelector('textarea[name="notes"], input[name="notes"]');

    // Extract values with fallbacks
    let selectedPatient = patientNameInput ? (patientNameInput.value || "").trim() : "";
    if (!selectedPatient) {
      // Try reading from selected-patient display (add-appointment.html format)
      const selectedLabel = document.getElementById("selected-patient");
      if (selectedLabel && selectedLabel.textContent) {
        // Extract name from "Selected: Name (DOB: ...)" format
        const match = selectedLabel.textContent.match(/Selected:\s*(.+?)(?:\s*\(DOB:|$)/i);
        if (match) {
          selectedPatient = match[1].trim();
        } else {
          selectedPatient = selectedLabel.textContent.replace(/^Selected:\s*/i, '').trim();
        }
      }
      // Also try patientSearch field (add-appointment.html)
      if (!selectedPatient) {
        const searchInput = document.getElementById("patientSearch");
        if (searchInput && searchInput.value) {
          selectedPatient = searchInput.value.trim();
        }
      }
    }
    
    // Check if patient is actually selected (must have name OR patientId)
    const selectedDatasetId = (patientNameInput && patientNameInput.dataset ? patientNameInput.dataset.patientId : '') || (document.getElementById('selected-patient')?.dataset?.patientId || '');
    
    if (!selectedPatient && !selectedDatasetId) {
      console.error('❌ No patient selected - patientNameInput:', patientNameInput?.id, 'value:', patientNameInput?.value, 'patientSearch:', document.getElementById('patientSearch')?.value);
      // Don't show alert - just return silently and let the form validation handle it
      return;
    }
    
    const parsed = parseNameAndDob(selectedPatient);
    const displayName = parsed.cleanName || selectedPatient.trim(); // Use original if parsing fails
    const selectedDate = dateInputEl ? (dateInputEl.value || "").trim() : "";
    const selectedSlotRaw = timeSlotEl ? (timeSlotEl.value || "").trim() : "";
    const doctor = doctorEl ? (doctorEl.value || "").trim() : "";
    const notes = notesEl ? (notesEl.value || "").trim() : "";

    if (!displayName) { 
      console.error('❌ Patient name is empty after parsing');
      alert("Please select a patient from the search results.");
      return; 
    }
    if (!selectedDate) { alert("Please select a date."); return; }
    if (!selectedSlotRaw) { alert("Please select a valid slot."); return; }

    // Prefer selected patientId from dataset, fallback to name resolution (Supabase-first)
    let patientId = selectedDatasetId || await getPatientIdByName(displayName);

    // Normalize time
    const normalizedSlot = normalizeTo24hHHMM(selectedSlotRaw);
    if (!normalizedSlot) { alert("Invalid time format. Please pick a valid time slot."); return; }

    // Date/time guards - REMOVED to allow past appointments for historical data entry
    // Organizations need to add historical appointments even if they just started using the app
    // const [year, month, day] = selectedDate.split('-').map(Number);
    // const appointmentDate = new Date(year, month - 1, day);
    // const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    // if (appointmentDate < todayMidnight) { alert("Cannot book past dates."); return; }
    // const today = new Date().toISOString().split('T')[0];
    // if (selectedDate === today) {
    //   const now = new Date();
    //   const [hour, minute] = normalizedSlot.split(':').map(Number);
    //   const slotTime = new Date(now); slotTime.setHours(hour, minute, 0, 0);
    //   if (slotTime <= now) { alert("Cannot book past times on the current day."); return; }
    // }

    // Duplicate guard (local)
    const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
    const hasExisting = appointments.some(appt => appt.date === selectedDate && appt.patientName === displayName);
    if (hasExisting) { alert("Patient already booked on this date. Only one appointment per day."); return; }

    // Supabase-first insert to avoid false errors later
    try {
      // Ensure Supabase client is available (same initialization for all devices)
      if (!window.supabaseClient) {
        console.warn('⚠️ Supabase client not available, waiting for initialization...');
        // Wait for supabase-client.js to initialize (max 5 seconds)
        let attempts = 0;
        while (!window.supabaseClient && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!window.supabaseClient) {
          throw new Error('Supabase client not available after waiting');
        }
      }
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      // ROOT CAUSE FIX: Properly resolve organization ID for all roles (including Medical Lab Scientists)
      let orgId = user.organizationId || user.organization_id;
      
      // Resolve organization ID if needed
      if (!orgId && user.org) {
        const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
        const orgData = organizations[user.org];
        if (orgData && orgData.id) {
          orgId = orgData.id;
        } else if (typeof user.org === 'string' && user.org.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // org is already a UUID
          orgId = user.org;
        }
      }
      
      if (!orgId) { 
        console.error('❌ Cannot determine organization ID:', { user, organizations: localStorage.getItem("organizations") });
        alert("Cannot determine organization. Please re-login."); 
        return; 
      }

      // ROOT CAUSE FIX: patientId from localStorage is a serial number (MEC0014), not UUID
      // We need to resolve it to UUID from Supabase
      // Check if it's already a UUID, if not, resolve it
      if (!isUuid(patientId)) {
        console.log('🔍 Patient ID is not UUID, resolving from Supabase:', patientId);
        // First try: If patientId is a serial number, look it up directly by patient_id field
        if (patientId && patientId.match(/^[A-Z]{3}\d{4}$/)) {
          const { data: patientBySerial, error: serialError } = await window.supabaseClient
            .from('patients')
            .select('id')
            .eq('organization_id', orgId)
            .eq('patient_id', patientId)
            .single();
          
          if (!serialError && patientBySerial) {
            console.log('✅ Found patient UUID by serial number:', patientBySerial.id);
            patientId = patientBySerial.id;
          }
        }
        
        // Second try: If still not UUID, resolve by name
        if (!isUuid(patientId)) {
          console.log('🔍 Resolving patient UUID by name:', displayName);
          const resolved = await resolveSupabasePatientIdByName(displayName, orgId, parsed.dob);
          if (resolved) {
            patientId = resolved;
            console.log('✅ Resolved patient UUID:', patientId);
          } else {
            console.error('❌ Could not resolve patient:', { displayName, orgId, patientId });
            alert("Could not resolve patient to a valid record. Please ensure this patient exists in your organization.");
            return;
          }
        }
      } else {
        console.log('✅ Patient ID is already UUID:', patientId);
      }

      if (typeof window.reconcileFormPatientRowWithDisplayedName === 'function' && isUuid(patientId)) {
        const reconciled = await window.reconcileFormPatientRowWithDisplayedName(patientId, displayName, {
          orgId,
          dob: parsed.dob || null
        });
        if (reconciled && isUuid(reconciled)) {
          patientId = reconciled;
        }
      }

      const apptId = `${selectedDate}_${normalizedSlot.replace(':', '')}`;
      const { error: insertError } = await window.supabaseClient
        .from('appointments')
        .insert({
          appointment_id: apptId,
          patient_id: patientId,
          patient_name: displayName,
          appointment_date: selectedDate,
          appointment_time: normalizeTimeHHMMSS(normalizedSlot),
          duration: 30,
          doctor_name: doctor || 'Dr. Smith',
          status: normalizeAppointmentStatus('scheduled'),
          notes: notes || '',
          organization_id: orgId
        });

      const appt = {
        id: apptId,
        patientId: patientId,
        patientName: displayName,
        date: selectedDate,
        time: normalizedSlot,
        duration: 30,
        doctor: doctor,
        notes: notes,
        status: 'scheduled'
      };

      if (insertError) {
        const msg = (insertError?.message || '').toLowerCase();
        if (msg.includes('duplicate key') || msg.includes('already exists') || msg.includes('violates check constraint')) {
          // Appointment already exists in Supabase - treat as success and cache to localStorage
          console.log('✅ Appointment already exists in Supabase (non-critical):', insertError.message);
          // Save to localStorage as cache
          const appointmentsKey = getDataKey("appointments");
          let appointments = JSON.parse(localStorage.getItem(appointmentsKey) || "[]");
          const isDuplicate = appointments.some(a => a.id === apptId);
          if (!isDuplicate) {
            appointments.push(appt);
            localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
            console.log('✅ Appointment cached to localStorage after Supabase success');
          }
        } else {
          // Supabase insert failed - fallback to localStorage
          console.warn('⚠️ Supabase insert failed, falling back to localStorage:', insertError.message);
          const appointmentsKey = getDataKey("appointments");
          let appointments = JSON.parse(localStorage.getItem(appointmentsKey) || "[]");
          const isDuplicate = appointments.some(a => a.id === apptId);
          if (!isDuplicate) {
            appointments.push(appt);
            localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
            console.log('✅ Appointment saved to localStorage (fallback)');
          }
        }
      } else {
        // Supabase insert succeeded - save to localStorage as cache
        console.log('✅ Appointment saved to Supabase successfully');
        const appointmentsKey = getDataKey("appointments");
        let appointments = JSON.parse(localStorage.getItem(appointmentsKey) || "[]");
        const isDuplicate = appointments.some(a => a.id === apptId);
        if (!isDuplicate) {
          appointments.push(appt);
          localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
          console.log('✅ Appointment cached to localStorage after Supabase success');
        }
        createAppointmentSavedNotification(appt, orgId);
      }

      // Audit log and redirect
      if (typeof logAuditEvent !== 'undefined') {
        logAuditEvent('appointment_created', { appointmentId: appt.id, patientName: appt.patientName, date: appt.date, time: appt.time, doctor: appt.doctor });
      }
      window.location.href = "/appointments";

    } catch (err) {
      // Supabase exception - fallback to localStorage
      console.warn('⚠️ Supabase exception, falling back to localStorage:', err.message || err);
      const apptId = `${selectedDate}_${normalizedSlot.replace(':', '')}`;
      const appt = {
        id: apptId,
        patientId: patientId || 'unknown',
        patientName: displayName,
        date: selectedDate,
        time: normalizedSlot,
        duration: 30,
        doctor: doctor,
        notes: notes,
        status: 'scheduled'
      };
      // Fallback to localStorage
      const appointmentsKey = getDataKey("appointments");
      let appointments = JSON.parse(localStorage.getItem(appointmentsKey) || "[]");
      const isDuplicate = appointments.some(a => a.id === apptId);
      if (!isDuplicate) {
        appointments.push(appt);
        localStorage.setItem(appointmentsKey, JSON.stringify(appointments));
        console.log('✅ Appointment saved to localStorage (fallback)');
      }
      // Redirect anyway - appointment is saved locally and will sync later
      window.location.href = "/appointments";
    }
  });
}

// --- Schedule Calendar Functions ---

let currentDate = new Date();  // Start with today's date

// Group appointments by date for easy lookup
function getAppointmentsByDate() {
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const grouped = {};
  appointments.forEach(appt => {
    if (!grouped[appt.date]) grouped[appt.date] = [];
    grouped[appt.date].push(appt);
  });
  return grouped;
}

// Format date as YYYY-MM-DD (local)
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get patient ID by full name (for linking to details)
// Supabase-first patient lookup by name
async function getPatientIdByName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Single-token: resolve display id / UUID via PatientIdentity or resolvePatientByIdentifier before name search.
  const trimmed = name.trim();
  if (trimmed && !/\s/.test(trimmed)) {
    if (window.PatientIdentity && typeof window.PatientIdentity.resolveTokenBeforeNameLookup === 'function') {
      const u = await window.PatientIdentity.resolveTokenBeforeNameLookup(trimmed);
      if (u) return u;
    } else if (typeof window.resolvePatientByIdentifier === 'function') {
      try {
        const byId = await window.resolvePatientByIdentifier(trimmed);
        if (byId) return byId._supabaseUuid || byId.id;
      } catch (e) {
        /* fall through */
      }
    }
  }

  // Normalize helper: collapse whitespace, trim, lower
  const normalize = (s) => (s || '').replace(/\(DOB:.*?\)\s*$/i, '') // strip trailing DOB
    .replace(/\s+/g, ' ').trim().toLowerCase();

  // Build normalized target without DOB and extra spaces
  const target = normalize(name);

  // STEP 1: Query Supabase FIRST (Supabase-first architecture)
  if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
    try {
      let orgId = null;
      if (typeof window.resolveOrganizationId === 'function') {
        orgId = await window.resolveOrganizationId();
      } else {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        orgId =
          user.organizationId ||
          (user.org ? JSON.parse(localStorage.getItem("organizations") || "{}")[user.org]?.id : null);
      }
      
      if (orgId) {
        // Parse name into parts for matching
        const nameParts = target.split(' ').filter(Boolean);
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];
          
          // Query Supabase for patients matching first and last name
          const { data: supabasePatients, error } = await window.supabaseClient
            .from('patients')
            .select('id, first_name, middle_name, last_name')
            .eq('organization_id', orgId)
            .ilike('first_name', `${firstName}%`)
            .ilike('last_name', `${lastName}%`);
          
          if (!error && supabasePatients && supabasePatients.length > 0) {
            // Find best match by normalizing and comparing
            for (const sp of supabasePatients) {
              const fullName = normalize(`${sp.first_name} ${sp.middle_name || ''} ${sp.last_name}`);
              const noMidName = normalize(`${sp.first_name} ${sp.last_name}`);
              
              if (fullName === target || noMidName === target) {
                // Found match in Supabase - cache to localStorage and return
                const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
                const existingIndex = patients.findIndex(p => p.id === sp.id);
                if (existingIndex === -1) {
                  // Add to cache
                  patients.push({
                    id: sp.id,
                    firstName: sp.first_name,
                    middleName: sp.middle_name || '',
                    lastName: sp.last_name
                  });
                  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
                }
                console.log('✅ Patient found in Supabase and cached');
                return sp.id;
              }
            }
            
            // If no exact match but we have results, try first/last match
            if (supabasePatients.length === 1) {
              const sp = supabasePatients[0];
              const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
              const existingIndex = patients.findIndex(p => p.id === sp.id);
              if (existingIndex === -1) {
                patients.push({
                  id: sp.id,
                  firstName: sp.first_name,
                  middleName: sp.middle_name || '',
                  lastName: sp.last_name
                });
                localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
              }
              console.log('✅ Patient found in Supabase (single match) and cached');
              return sp.id;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error querying Supabase for patient:', error);
      // Fall through to localStorage check
    }
  }

  // STEP 2: Fallback to localStorage (hybrid architecture)
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");

  // Try exact match on full name (with and without middle)
  let patient = patients.find(p => {
    const full = normalize(`${p.firstName} ${p.middleName ? p.middleName : ''} ${p.lastName}`);
    return full === target;
  });

  // Try match ignoring middle name
  if (!patient) {
    patient = patients.find(p => {
      const noMid = normalize(`${p.firstName} ${p.lastName}`);
      return noMid === target;
    });
  }

  // Try partial (first and last contained anywhere)
  if (!patient) {
    const parts = target.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      patient = patients.find(p => {
        const pf = normalize(p.firstName);
        const pl = normalize(p.lastName);
        return pf === first && pl === last;
      });
    }
  }

  if (!patient) {
    console.error('❌ Patient not found in Supabase or localStorage');
  }

  return patient ? patient.id : '';
}

// Generate daily view with slots
async function generateDailyView(date) {
  const grouped = getAppointmentsByDate();
  const dateStr = formatDate(date);
  const appts = grouped[dateStr] || [];
  const allSlots = getAllSlots();
  let html = `<h3>Daily Schedule for ${date.toDateString()}</h3>`;
  html += '<button onclick="changeDate(-1, \'daily\')">Previous Day</button> ';
  html += '<button onclick="changeDate(1, \'daily\')">Next Day</button>';
  html += '<table><thead><tr><th>Slot</th><th>Status</th></tr></thead><tbody>';
  for (const slot of allSlots) {
    const appt = appts.find(a => a.time === slot);
    let status = 'Free';
    if (appt) {
      const patientId = await appointmentDisplayPatientIdForLink(appt) || (appt.patientId || appt.patient_id || await getPatientIdByName(appt.patientName));
      status = `<a href="patient-details?id=${patientId}">${appt.patientName}</a>`;
    } else {
      // Make "Free" slots clickable links to add-appointment.html with pre-selected date and time
      status = `<a href="add-appointment?date=${dateStr}&time=${slot}" style="color: #4CAF50; text-decoration: none; font-weight: bold;">Free</a>`;
    }
    html += `<tr><td>${slot}</td><td>${status}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

// Generate weekly view with occupied counts
async function generateWeeklyView(date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());  // Sunday start
  const grouped = getAppointmentsByDate();
  let html = `<h3>Weekly Schedule for Week of ${startOfWeek.toDateString()}</h3>`;
  html += '<button onclick="changeDate(-7, \'weekly\')">Previous Week</button> ';
  html += '<button onclick="changeDate(7, \'weekly\')">Next Week</button>';
  html += '<table><thead><tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead><tbody><tr>';
  
  // Get doctor count once for all days
  const doctorCount = await getDoctorCount();
  const allSlots = getAllSlots();
  const totalSlotsPerDay = allSlots.length * doctorCount;
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(day.getDate() + i);
    const dateStr = formatDate(day);
    const appts = grouped[dateStr] || [];
    const occupied = appts.length;
    // Calculate free slots accounting for multiple doctors
    const free = totalSlotsPerDay - occupied;
    html += `<td>${day.getDate()}<br>Occupied: ${occupied}<br>Free: ${free}</td>`;
  }
  html += '</tr></tbody></table>';
  return html;
}

// Generate monthly view with occupied counts
async function generateMonthlyView(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const grouped = getAppointmentsByDate();
  let html = `<h3>Monthly Schedule for ${date.toLocaleString('default', { month: 'long' })} ${year}</h3>`;
  html += '<button onclick="changeDate(-30, \'monthly\')">Previous Month</button> ';
  html += '<button onclick="changeDate(30, \'monthly\')">Next Month</button>';
  html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"><thead><tr style="background-color: #007bff; color: white;"><th style="padding: 12px; border: 1px solid #0056b3;">Sun</th><th style="padding: 12px; border: 1px solid #0056b3;">Mon</th><th style="padding: 12px; border: 1px solid #0056b3;">Tue</th><th style="padding: 12px; border: 1px solid #0056b3;">Wed</th><th style="padding: 12px; border: 1px solid #0056b3;">Thu</th><th style="padding: 12px; border: 1px solid #0056b3;">Fri</th><th style="padding: 12px; border: 1px solid #0056b3;">Sat</th></tr></thead><tbody>';
  let row = '<tr>';
  
  // Get doctor count once for all days
  const doctorCount = await getDoctorCount();
  const allSlots = getAllSlots();
  const totalSlotsPerDay = allSlots.length * doctorCount;
  
  // Pad start of month
  for (let i = 0; i < firstDay.getDay(); i++) {
    row += '<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; min-height: 60px;"></td>';
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const day = new Date(year, month, d);
    const dateStr = formatDate(day);
    const appts = grouped[dateStr] || [];
    const occupied = appts.length;
    
    // Calculate total available slots for this day (accounting for multiple doctors)
    const freeSlots = totalSlotsPerDay - occupied;
    
    // Make dates clickable with appointment details
    const clickableDate = `<span style="cursor: pointer; color: #007bff; text-decoration: underline; font-weight: bold;" onclick="showDailyDetails('${dateStr}')" title="Click to view ${occupied} appointment(s)">${d}</span>`;
    
    // Show status with actual numbers
    const statusText = occupied > 0 ? 
      `<span style="color: ${occupied >= 5 ? '#dc3545' : occupied >= 3 ? '#ffc107' : '#28a745'}; font-weight: bold;">Occupied: ${occupied}</span><br><span style="color: #6c757d; font-weight: bold;">Free: ${freeSlots}</span>` :
      `<span style="color: #28a745; font-weight: bold;">Free: ${freeSlots}</span>`;
    
    row += `<td style="padding: 8px; border: 1px solid #ddd; vertical-align: top; min-height: 60px; background-color: #f8f9fa;">${clickableDate}<br>${statusText}</td>`;
    if (day.getDay() === 6) {  // End row on Saturday
      html += row + '</tr>';
      row = '<tr>';
    }
  }
  // Pad end of month
  if (lastDay.getDay() !== 6) {
    for (let i = lastDay.getDay() + 1; i < 7; i++) {
      row += '<td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa; min-height: 60px;"></td>';
    }
    html += row + '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// Show selected view
async function showView(view) {
  const container = document.getElementById("calendar-container");
  if (container) {
    if (view === 'daily') {
      container.innerHTML = await generateDailyView(currentDate);
    } else if (view === 'weekly') {
      generateWeeklyView(currentDate).then(html => {
        container.innerHTML = html;
      }).catch(err => {
        console.error('Error generating weekly view:', err);
        container.innerHTML = '<p>Error loading weekly view</p>';
      });
    } else if (view === 'monthly') {
      generateMonthlyView(currentDate).then(html => {
        container.innerHTML = html;
      }).catch(err => {
        console.error('Error generating monthly view:', err);
        container.innerHTML = '<p>Error loading monthly view</p>';
      });
    }
  }
}

// Change date for navigation (days offset, view type)
function changeDate(offset, view) {
  currentDate.setDate(currentDate.getDate() + offset);
  showView(view);
}

// Show daily details for a specific date
function showDailyDetails(dateStr) {
  const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  const dayAppointments = appointments.filter(apt => apt.date === dateStr);
  
  // Calculate slot information
  const allSlots = getAllSlots();
  const totalSlots = allSlots.length;
  const occupiedSlots = dayAppointments.length;
  const freeSlots = totalSlots - occupiedSlots;
  
  // Sort appointments by time
  dayAppointments.sort((a, b) => {
    const timeA = a.time || "00:00";
    const timeB = b.time || "00:00";
    return timeA.localeCompare(timeB);
  });
  
  // Create modal content
  const modalHTML = `
    <div id="daily-details-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; border-radius: 10px; padding: 30px; max-width: 800px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #007bff; padding-bottom: 15px;">
          <div>
            <h2 style="margin: 0; color: #007bff;">Daily Schedule - ${new Date(dateStr).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</h2>
            <div style="margin-top: 8px; display: flex; gap: 20px; font-size: 14px;">
              <span style="background: #007bff; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">Total Slots: ${totalSlots}</span>
              <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">Free: ${freeSlots}</span>
              <span style="background: #ffc107; color: #212529; padding: 4px 8px; border-radius: 4px; font-weight: bold;">Occupied: ${occupiedSlots}</span>
            </div>
          </div>
          <button onclick="closeDailyDetails()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 16px; font-weight: bold;">×</button>
        </div>
        
        ${dayAppointments.length === 0 ? 
          `<div style="text-align: center; padding: 40px; color: #6c757d;">
            <h3 style="color: #28a745;">📅 No Appointments Scheduled</h3>
            <p>All ${totalSlots} slots are available for this day!</p>
            <p style="font-size: 14px; color: #888;">You can schedule appointments in any of the available time slots.</p>
          </div>` :
          `<div style="margin-bottom: 20px;">
            <h3 style="color: #007bff; margin-bottom: 15px;">📋 ${dayAppointments.length} Appointment(s) Scheduled</h3>
            <div style="display: grid; gap: 15px;">
              ${dayAppointments.map(apt => `
                <div style="border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; background-color: #f8f9fa;">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                      <h4 style="margin: 0 0 5px 0; color: #333;">${apt.patientName}</h4>
                      <p style="margin: 0; color: #666; font-size: 14px;">Patient ID: ${typeof window.patientMrnDisplay === 'function' ? window.patientMrnDisplay(apt.patientId) : apt.patientId}</p>
                    </div>
                    <div style="text-align: right;">
                      <span style="background: #007bff; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${apt.time || 'No time set'}</span>
                      <div style="margin-top: 5px;">
                        <span style="background: ${apt.status === 'completed' ? '#28a745' : apt.status === 'cancelled' ? '#dc3545' : '#ffc107'}; color: ${apt.status === 'completed' || apt.status === 'cancelled' ? 'white' : '#212529'}; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; text-transform: capitalize;">${apt.status || 'scheduled'}</span>
                      </div>
                    </div>
                  </div>
                  ${apt.reason ? `<p style="margin: 10px 0 0 0; color: #555; font-style: italic;">Reason: ${apt.reason}</p>` : ''}
                  ${apt.notes ? `<p style="margin: 10px 0 0 0; color: #555;">Notes: ${apt.notes}</p>` : ''}
                  <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button onclick="editAppointment('${apt.id}')" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Edit</button>
                    <button onclick="deleteAppointment('${apt.id}')" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
                    <button onclick="openClinicalNote(${JSON.stringify(apt.patientId || apt.patient_id || '')}, ${JSON.stringify(apt.date)}, ${JSON.stringify(apt.appointment_type || apt.appointmentType || '')}, ${JSON.stringify(apt.patientName || apt.patient_name || '')})" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Open Note</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`
        }
        
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <button onclick="closeDailyDetails()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Close</button>
          <button onclick="window.location.href='/add-appointment?date=${dateStr}'" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Add Appointment</button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close daily details modal
function closeDailyDetails() {
  const modal = document.getElementById('daily-details-modal');
  if (modal) {
    modal.remove();
  }
}

// Helper: normalize appointment status to allowed values
function normalizeAppointmentStatus(status) {
  const allowed = new Set(['scheduled', 'completed', 'cancelled', 'no_show']);
  if (!status || typeof status !== 'string') return 'scheduled';
  const s = status.toLowerCase().trim().replace(/\s+/g, '_');
  return allowed.has(s) ? s : 'scheduled';
}

// Function to sync appointment updates to Supabase with mobile support
async function syncAppointmentUpdateToSupabase(appointment) {
  try {
    // Ensure Supabase client is available (same behavior for all devices)
    await ensureSupabaseClientAvailable();
    
    if (window.supabaseClient) {
      console.log('🔄 Syncing appointment update to Supabase:', appointment.id);
      
      // Convert to Supabase format
      const supabaseUpdate = {
        status: normalizeAppointmentStatus(appointment.status),
        updated_at: new Date().toISOString()
      };
      
      // Add check-in/check-out times if they exist
      // Note: Only include these fields if the columns exist in the database
      // We'll try to update them, but if they don't exist, the update will still succeed for other fields
      if (appointment.checkInTime) {
        supabaseUpdate.checked_in_at = new Date(appointment.checkInTime).toISOString();
      }
      if (appointment.checkOutTime) {
        supabaseUpdate.checked_out_at = new Date(appointment.checkOutTime).toISOString();
      }
      
      // Try to update - if check-in/check-out columns don't exist, update will still work for other fields
      const { data, error } = await window.supabaseClient
        .from('appointments')
        .update(supabaseUpdate)
        .eq('appointment_id', appointment.id);
      
      if (error) {
        // If error is about missing columns, try again without check-in/check-out fields
        if (error.message && (error.message.includes('checked_in_at') || error.message.includes('checked_out_at') || error.message.includes('checked_in'))) {
          console.warn('⚠️ Check-in/check-out columns not found in database, syncing without them');
          // Remove check-in/check-out fields and try again
          const { checked_in_at, checked_out_at, ...updateWithoutCheckFields } = supabaseUpdate;
          const { data: retryData, error: retryError } = await window.supabaseClient
            .from('appointments')
            .update(updateWithoutCheckFields)
            .eq('appointment_id', appointment.id);
          
          if (retryError) {
            console.error('❌ Error syncing appointment update to Supabase (retry):', retryError);
          } else {
            console.log('✅ Appointment update synced to Supabase successfully (without check-in/check-out fields)');
          }
        } else {
        console.error('❌ Error syncing appointment update to Supabase:', error);
        }
      } else {
        console.log('✅ Appointment update synced to Supabase successfully');
      }
    } else {
      console.warn('⚠️ Supabase client not available, appointment update saved locally only');
    }
  } catch (error) {
    console.error('❌ Exception syncing appointment update to Supabase:', error);
  }
}

// Function to sync appointment deletion to Supabase with mobile support
async function syncAppointmentDeleteToSupabase(appointmentId) {
  try {
    // Ensure Supabase client is available (same behavior for all devices)
    await ensureSupabaseClientAvailable();
    
    if (window.supabaseClient) {
      console.log('🔄 Syncing appointment deletion to Supabase:', appointmentId);
      
      const { data, error } = await window.supabaseClient
        .from('appointments')
        .delete()
        .eq('appointment_id', appointmentId);
      
      if (error) {
        // Don't log as error - deletion is saved locally (non-critical)
        console.warn('⚠️ Supabase deletion sync warning (deletion saved locally):', error.message || error);
      } else {
        console.log('✅ Appointment deletion synced to Supabase successfully');
      }
    } else {
      console.warn('⚠️ Supabase client not available, appointment deletion saved locally only');
    }
  } catch (error) {
    // Don't log as error - deletion is saved locally (non-critical)
    console.warn('⚠️ Non-critical exception syncing appointment deletion (deletion saved locally):', error.message || error);
  }
}

// Universal Supabase client check (same behavior for all devices)
// Supabase client should already be initialized by js/supabase-client.js
// This function just ensures it's available and waits if needed
async function ensureSupabaseClientAvailable() {
  if (window.supabaseClient) {
    return true;
  }
  
  // Wait for supabase-client.js to initialize (max 5 seconds)
  let attempts = 0;
  while (!window.supabaseClient && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (window.supabaseClient) {
    return true;
  }
  
  console.warn('⚠️ Supabase client not available after waiting');
  return false;
}

// One-time cleanup: remove duplicate appointment rows (same patient, date, time) from Supabase. Keeps one per slot (prefer Lab Intervention etc over General Consultation).
async function cleanupDuplicateAppointmentsInSupabase() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const orgId = user.organizationId || user.organization_id;
  if (!orgId || !window.supabaseClient) return;
  const doneKey = 'cleanupDuplicateAppointments_' + orgId;
  if (localStorage.getItem(doneKey) === 'done') return;
  try {
    const { data: rows, error } = await window.supabaseClient.from('appointments').select('id, appointment_id, patient_id, appointment_date, appointment_time, appointment_type').eq('organization_id', orgId);
    if (error || !rows || rows.length === 0) { localStorage.setItem(doneKey, 'done'); return; }
    const slotKey = (r) => `${r.patient_id}|${r.appointment_date}|${r.appointment_time}`;
    const bySlot = new Map();
    for (const r of rows) {
      const key = slotKey(r);
      if (!bySlot.has(key)) bySlot.set(key, []);
      bySlot.get(key).push(r);
    }
    let deleted = 0;
    for (const [key, group] of bySlot) {
      if (group.length <= 1) continue;
      const keep = group.find(r => r.appointment_type && r.appointment_type !== 'General Consultation') || group[0];
      const toDelete = group.filter(r => r.id !== keep.id);
      for (const r of toDelete) {
        const { error: delErr } = await window.supabaseClient.from('appointments').delete().eq('id', r.id);
        if (!delErr) deleted++;
      }
    }
    if (deleted > 0) console.log('✅ Cleaned up', deleted, 'duplicate appointment row(s)');
    localStorage.setItem(doneKey, 'done');
  } catch (e) {
    console.warn('Cleanup duplicate appointments:', e);
  }
}

// Function to sync all appointments from localStorage to Supabase
async function syncAllAppointmentsToSupabase() {
  // Ensure Supabase client is available (same behavior for all devices)
  await ensureSupabaseClientAvailable();
  
  if (!window.supabaseClient) {
    console.warn('⚠️ Supabase client not available, cannot sync appointments');
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }

  let hasSession = true;
  try {
    if (window.supabaseClient?.auth?.getSession) {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) {
        hasSession = false;
      } else {
        hasSession = !!data?.session;
      }
    }
  } catch (error) {
    hasSession = false;
  }

  if (!hasSession) {
    return;
  }

  try {
    // Syncing all appointments from localStorage to Supabase
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    
    // Get organization ID
    let orgId = user.organizationId;
    if (!orgId && user.org) {
      const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
      const orgData = organizations[user.org];
      if (orgData && orgData.id) {
        orgId = orgData.id;
      }
    }
    
    if (!orgId) {
      console.warn('⚠️ No organization ID found, cannot sync appointments');
      return;
    }
    
    // Get all appointments from localStorage
    const appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
    // Syncing appointments to Supabase (count removed for privacy)
    
    let syncedCount = 0;
    let errorCount = 0;
    
    let stopSync = false;
    for (const appointment of appointments) {
      try {
        // If we have supabaseId (row UUID), appointment is already in Supabase - skip to avoid duplicates
        if (appointment.supabaseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(appointment.supabaseId))) {
          const { data: byUuid } = await window.supabaseClient.from('appointments').select('id').eq('id', appointment.supabaseId).maybeSingle();
          if (byUuid) {
            continue; // Already in Supabase, skip (avoids duplicate on edit/reschedule)
          }
        }
        // Check if appointment already exists in Supabase
        const { data: existing, error: checkError } = await window.supabaseClient
          .from('appointments')
          .select('appointment_id')
          .eq('appointment_id', appointment.id)
          .eq('organization_id', orgId);
        
        if (checkError) {
          const checkMsg = (checkError?.message || '').toLowerCase();
          if (checkMsg.includes('failed to fetch') || checkMsg.includes('network')) {
            console.warn('⚠️ Appointment sync paused due to network error.');
            stopSync = true;
          }
          console.error('❌ Error checking existing appointment:', checkError);
          errorCount++;
          continue;
        }
        
        if (existing && existing.length > 0) {
          // Appointment already exists in Supabase, skipping (ID removed for privacy)
          continue;
        }

        // Ensure we have a valid patient UUID
        let patientUuid = appointment.patientId;
        if (!patientUuid || !isUuid(patientUuid)) {
          // Try resolve using Supabase-first lookup (checks Supabase then localStorage)
          patientUuid = await getPatientIdByName(appointment.patientName);
          // If still not found and we have DOB, try the specialized resolver
          if (!patientUuid && appointment.dob) {
            patientUuid = await resolveSupabasePatientIdByName(appointment.patientName, orgId, appointment.dob);
          }
        }
        if (!patientUuid) {
          console.warn(`⚠️ Skipping appointment ${appointment.id}: could not resolve patient UUID`);
          errorCount++;
          continue;
        }

        // Normalize time for DB (time type expects HH:MM:SS)
        const normalizedTime = normalizeTimeHHMMSS(appointment.time);
        if (!normalizedTime) {
          console.warn(`⚠️ Skipping appointment ${appointment.id}: invalid time ${appointment.time}`);
          errorCount++;
          continue;
        }
        
        // CRITICAL: Use same canonical appointment_id as add-appointment (patientId_date_time)
        // so we never create a duplicate row for the same patient/date/time (e.g. one Lab Intervention + one General Consultation)
        const canonicalSuffix = (patientUuid + '_' + appointment.date + '_' + appointment.time).replace(/[:-\s]/g, '');
        const canonicalAppointmentId = canonicalSuffix.length <= 100 ? canonicalSuffix : canonicalSuffix.substring(0, 96) + '_' + (appointment.id || '').slice(-4);
        
        // Check existing by canonical id so we skip if add-appointment already inserted this slot
        const { data: existingCanonical, error: checkCanonicalError } = await window.supabaseClient
          .from('appointments')
          .select('appointment_id')
          .eq('appointment_id', canonicalAppointmentId)
          .eq('organization_id', orgId);
        if (!checkCanonicalError && existingCanonical && existingCanonical.length > 0) {
          continue; // already in Supabase (e.g. from add-appointment)
        }
        
        const appointmentType = (appointment.appointment_type || appointment.appointmentType || '').trim();
        const insertPayload = {
          appointment_id: canonicalAppointmentId,
          patient_id: patientUuid,
          patient_name: appointment.patientName,
          appointment_date: appointment.date,
          appointment_time: normalizedTime,
          duration: appointment.duration || 30,
          doctor_name: appointment.doctor || 'Dr. Smith',
          appointment_type: appointmentType || 'General Consultation',
          status: normalizeAppointmentStatus(appointment.status),
          notes: appointment.notes || '',
          organization_id: orgId
        };
        const { error: insertError } = await window.supabaseClient
          .from('appointments')
          .insert(insertPayload);
        
        if (insertError) {
          const insertMsg = (insertError?.message || '').toLowerCase();
          if (insertMsg.includes('failed to fetch') || insertMsg.includes('network')) {
            console.warn('⚠️ Appointment sync paused due to network error.');
            stopSync = true;
          }
          const msg = (insertError?.message || '').toLowerCase();
          // Treat duplicates and constraint errors as non-critical (appointment already exists)
          if (msg.includes('duplicate key') || msg.includes('already exists') || msg.includes('violates check constraint')) {
            // Appointment already exists or constraint issue (non-critical), skipping (ID removed for privacy)
            // Don't count as error - appointment exists
          } else {
            // Only log as warning for other errors (not critical - appointment saved locally)
            console.warn(`⚠️ Non-critical sync warning for appointment ${appointment.id}:`, insertError.message);
            // Don't count as error - appointment is saved locally
          }
        } else {
          console.log(`✅ Synced appointment: ${canonicalAppointmentId}`);
          syncedCount++;
        }
      } catch (error) {
        const errMsg = String(error?.message || error || '').toLowerCase();
        if (errMsg.includes('failed to fetch') || errMsg.includes('network')) {
          console.warn('⚠️ Appointment sync paused due to network error.');
          stopSync = true;
        }
        // Don't log as error - appointment is saved locally (non-critical)
        console.warn(`⚠️ Non-critical sync exception for appointment ${appointment.id}:`, error.message || error);
        // Don't count as error - appointment is saved locally
      }

      if (stopSync) {
        break;
      }
    }
    
    console.log(`🎉 Sync complete: ${syncedCount} synced, ${errorCount} errors`);
    
    if (syncedCount > 0) {
      // Reload appointments to get the latest data
      await loadAppointments();
    }
    
  } catch (error) {
    // Don't log as error - appointments are saved locally (non-critical)
    console.warn('⚠️ Non-critical exception in syncAllAppointmentsToSupabase (appointments saved locally):', error.message || error);
  }
}

// Normalize time to 24h 'HH:MM' from possible 'HH:MM AM/PM'
function normalizeTo24hHHMM(t) {
  if (!t) return '';
  const str = t.toString().trim();
  const ampmMatch = str.match(/^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$/);
  if (ampmMatch) {
    let hh = parseInt(ampmMatch[1], 10);
    const mm = ampmMatch[2];
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
    return `${hh.toString().padStart(2,'0')}:${mm}`;
  }
  // If already HH:MM or HH:MM:SS, keep first two parts
  const parts = str.split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
  return '';
}

// Normalize time to HH:MM:SS
function normalizeTimeHHMMSS(t) {
  if (!t || typeof t !== 'string') return null;
  const base = normalizeTo24hHHMM(t);
  if (!base) return null;
  return `${base}:00`;
}

// Try to resolve a Supabase patient UUID by full name (and optional DOB) via Supabase (fallback)
async function resolveSupabasePatientIdByName(fullName, orgId, dob) {
  if (!window.supabaseClient || !fullName || !orgId) {
    console.warn('⚠️ resolveSupabasePatientIdByName: Missing required parameters', { fullName, orgId });
    return null;
  }
  try {
    // Clean and normalize the name
    const cleanName = fullName.trim().replace(/\s+/g, ' ').replace(/\(DOB:.*?\)/gi, '').trim();
    const parts = cleanName.split(' ').filter(p => p.length > 0);
    
    if (parts.length < 2) {
      console.warn('⚠️ resolveSupabasePatientIdByName: Name has less than 2 parts:', cleanName);
      return null;
    }
    
    const first = parts[0];
    const last = parts[parts.length - 1];
    
    console.log('🔍 Resolving patient:', { cleanName, first, last, orgId, dob });
    
    // CRITICAL: Select both id (UUID) and patient_id (serial number like MEC0014)
    // The patient_id field stores the serial number that matches localStorage format
    let query = window.supabaseClient
      .from('patients')
      .select('id, patient_id, first_name, last_name, middle_name, date_of_birth')
      .eq('organization_id', orgId)
      .ilike('first_name', first)
      .ilike('last_name', last);
    
    if (dob) {
      query = query.eq('date_of_birth', dob);
    }
    
    let { data, error } = await query.limit(10); // Get multiple matches to find best one
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ No patients found with exact first/last match');
      return null;
    }

    const fullNameFromRow = (p) => normalizePersonNameLabel(
      [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')
    );
    const targetNorm = normalizePersonNameLabel(cleanName);
    if (data.length > 1 && targetNorm) {
      const exact = data.find((p) => fullNameFromRow(p) === targetNorm);
      if (exact) {
        console.log('✅ Disambiguated multiple first/last matches via full name:', exact.id);
        return exact.id;
      }
    }
    
    // If we have DOB, prefer exact match
    if (dob && data.length > 1) {
      const dobMatch = data.find(p => p.date_of_birth === dob);
      if (dobMatch) {
        // Return UUID (id field) - this is what Supabase appointments table expects
        console.log('✅ Found patient with DOB match:', dobMatch.id, 'serial:', dobMatch.patient_id);
        return dobMatch.id;
      }
    }
    
    // If single match, return UUID
    if (data.length === 1) {
      console.log('✅ Found single patient match - UUID:', data[0].id, 'serial:', data[0].patient_id);
      return data[0].id; // Return UUID, not serial number
    }
    
    // Multiple matches - try to match middle name if provided
    if (parts.length >= 3) {
      const middle = parts.slice(1, -1).join(' ');
      const middleMatch = data.find(p => {
        const pMiddle = (p.middle_name || '').trim();
        return pMiddle && pMiddle.toLowerCase() === middle.toLowerCase();
      });
      if (middleMatch) {
        console.log('✅ Found patient with middle name match - UUID:', middleMatch.id, 'serial:', middleMatch.patient_id);
        return middleMatch.id; // Return UUID
      }
    }
    
    // Return first match UUID if multiple (user will need to verify)
    console.log(`⚠️ Multiple patients found (${data.length}), returning first match UUID:`, data[0].id);
    return data[0].id; // Return UUID, not serial number
    
  } catch (e) {
    console.error('❌ resolveSupabasePatientIdByName exception:', e);
  }
  return null;
}
window.resolveSupabasePatientIdByName = resolveSupabasePatientIdByName;

// Generate invoice from appointment
window.generateInvoiceFromAppointment = async function(appointmentId, patientIdOrName, appointmentType) {
  console.log('Generate invoice clicked. AppointmentId:', appointmentId, 'PatientIdOrName:', patientIdOrName, 'AppointmentType:', appointmentType);
  
  if (!appointmentId) {
    alert('Appointment ID not found. Cannot generate invoice.');
    return;
  }
  
  // Load appointments to get full appointment data
  let appointments = [];
  if (typeof window.loadAppointmentsWithSupabasePriority === 'function') {
    appointments = await window.loadAppointmentsWithSupabasePriority();
  } else {
    appointments = JSON.parse(localStorage.getItem(getDataKey("appointments")) || "[]");
  }
  
  const appointment = appointments.find(a => a.id === appointmentId);
  if (!appointment) {
    alert('Appointment not found.');
    return;
  }
  
  // Get patient data - try multiple methods
  let patients = [];
  try {
    // Method 1: Try loadPatientsWithSupabasePriority (returns array directly)
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    }
    
    // Method 2: If still empty, try localStorage
    if (!patients || patients.length === 0) {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
    
    // Method 3: If still empty and we have patientIdOrName, try to load from Supabase directly
    if ((!patients || patients.length === 0) && patientIdOrName && typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const orgId = user.organizationId || user.organization_id;
        
        if (orgId) {
          // Try to find patient by ID first
          const { data: patientById, error: idError } = await supabaseClient
            .from('patients')
            .select('*')
            .eq('id', patientIdOrName)
            .eq('organization_id', orgId)
            .limit(1)
            .maybeSingle();
          
          if (!idError && patientById) {
            patients = [patientById];
          } else {
            // Try to find by name (first_name + last_name)
            const nameParts = patientIdOrName.split(' ');
            if (nameParts.length >= 2) {
              const { data: patientsByName, error: nameError } = await supabaseClient
                .from('patients')
                .select('*')
                .eq('first_name', nameParts[0])
                .eq('last_name', nameParts.slice(1).join(' '))
                .eq('organization_id', orgId)
                .limit(1);
              
              if (!nameError && patientsByName && patientsByName.length > 0) {
                patients = patientsByName;
              }
            }
          }
        }
      } catch (supabaseError) {
        console.error('Error loading patient from Supabase:', supabaseError);
      }
    }
  } catch (error) {
    console.error('Error loading patients:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  // Find patient by ID or name - handle both Supabase format and localStorage format
  let patient = null;
  
  // Debug: Log first patient structure to understand format
  if (patients.length > 0) {
    console.log('🔍 [INVOICE] First patient sample:', {
      id: patients[0].id,
      patient_id: patients[0].patient_id,
      firstName: patients[0].firstName,
      first_name: patients[0].first_name,
      lastName: patients[0].lastName,
      last_name: patients[0].last_name
    });
  }
  
  // Try by appointment.patientId first - check all possible ID fields
  if (appointment.patientId) {
    patient = patients.find(p => 
      p.id === appointment.patientId || 
      p.patient_id === appointment.patientId ||
      String(p.id) === String(appointment.patientId) ||
      String(p.patient_id) === String(appointment.patientId)
    );
    if (patient) {
      console.log('✅ [INVOICE] Found patient by appointment.patientId:', appointment.patientId);
    }
  }
  
  // Try by patientIdOrName parameter (which is the same as appointment.patientId in this case)
  if (!patient && patientIdOrName) {
    patient = patients.find(p => 
      p.id === patientIdOrName || 
      p.patient_id === patientIdOrName ||
      String(p.id) === String(patientIdOrName) ||
      String(p.patient_id) === String(patientIdOrName)
    );
    if (patient) {
      console.log('✅ [INVOICE] Found patient by patientIdOrName:', patientIdOrName);
    }
  }
  
  // Try by appointment.patientName - handle middle names
  if (!patient && appointment.patientName) {
    const appointmentNameLower = appointment.patientName.toLowerCase().trim();
    patient = patients.find(p => {
      // Try various name combinations
      const firstName = (p.firstName || p.first_name || '').trim();
      const middleName = (p.middleName || p.middle_name || '').trim();
      const lastName = (p.lastName || p.last_name || '').trim();
      
      // Full name with middle name
      const fullNameWithMiddle = `${firstName} ${middleName} ${lastName}`.trim().toLowerCase();
      // Full name without middle name
      const fullNameNoMiddle = `${firstName} ${lastName}`.trim().toLowerCase();
      // Alternative format (first_name, last_name)
      const altFullName = `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim().toLowerCase();
      
      return fullNameWithMiddle === appointmentNameLower || 
             fullNameNoMiddle === appointmentNameLower ||
             altFullName === appointmentNameLower;
    });
    if (patient) {
      console.log('✅ [INVOICE] Found patient by appointment.patientName:', appointment.patientName);
    }
  }
  
  if (!patient) {
    console.error('❌ [INVOICE] Patient lookup failed. Appointment:', {
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName
    }, 'patientIdOrName:', patientIdOrName, 'Patients found:', patients.length);
    
    // Try direct Supabase query as last resort
    if (patientIdOrName && typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const orgId = user.organizationId || user.organization_id;
        
        if (orgId) {
          console.log('🔍 [INVOICE] Attempting direct Supabase query for patient:', patientIdOrName);
          const { data: directPatient, error: directError } = await supabaseClient
            .from('patients')
            .select('*')
            .eq('id', patientIdOrName)
            .eq('organization_id', orgId)
            .limit(1)
            .maybeSingle();
          
          if (!directError && directPatient) {
            console.log('✅ [INVOICE] Found patient via direct Supabase query');
            patient = directPatient;
          } else {
            console.error('❌ [INVOICE] Direct Supabase query failed:', directError);
          }
        }
      } catch (directError) {
        console.error('❌ [INVOICE] Exception in direct Supabase query:', directError);
      }
    }
    
    if (!patient) {
      alert('Patient not found. Cannot generate invoice.');
      return;
    }
  }
  
  // Redirect to quick-checkout with patient and appointment type pre-filled
  // This allows the user to manually create the invoice and ensures it's linked to the appointment
  const patientId = patient.id || patient.patient_id;
  const appointmentTypeParam = encodeURIComponent(appointmentType || appointment.appointment_type || 'General Consultation');
  const appointmentIdParam = encodeURIComponent(appointmentId);
  
  window.location.href = `/quick-checkout?patientId=${patientId}&appointmentType=${appointmentTypeParam}&appointmentId=${appointmentIdParam}`;
};

function shouldInitAppointmentsModule() {
  return !!(
    document.getElementById('appointment-list') ||
    document.getElementById('calendar-container') ||
    document.getElementById('add-appointment-form') ||
    document.getElementById('edit-appointment-form')
  );
}

window.addEventListener('load', async function appointmentsModuleOnLoad() {
  if (!shouldInitAppointmentsModule()) return;

  loadAppointments();
  setupPatientSearch(); // add-appointment.html
  setupAppointmentSearch(); // appointments.html search
  if (document.getElementById('calendar-container')) showView('monthly'); // schedule.html default

  setTimeout(async () => {
    await syncAllAppointmentsToSupabase();
  }, 2000);
});