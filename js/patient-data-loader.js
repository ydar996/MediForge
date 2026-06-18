// Patient Data Loader
// Secure data fetching for patient portal - ensures patients can only access their own data

/**
 * Get current patient ID from session
 * @returns {string|null}
 */
function getCurrentPatientId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'Patient' && user.patientId) {
      return user.patientId;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Ensure user is authenticated as patient
 * @throws {Error} if not authenticated as patient
 */
function ensurePatientAuth() {
  const patientId = getCurrentPatientId();
  if (!patientId) {
    window.location.href = '/patient-login';
    throw new Error('Patient authentication required');
  }
  return patientId;
}

/**
 * Get patient demographics
 * @returns {Promise<Object>}
 */
window.getPatientDemographics = async function() {
  try {
    const patientId = ensurePatientAuth();
    
    if (!window.supabaseClient) {
      throw new Error('Database connection not available');
    }

    const patientIds = await resolvePortalPatientIds(patientId);
    const uuid = patientIds.find((id) => id.includes('-') && id.length === 36) || patientId;

    let { data, error } = await window.supabaseClient
      .from('patients')
      .select('*')
      .eq('id', uuid)
      .maybeSingle();

    if (!data && !error) {
      const legacyId = patientIds.find((id) => id !== uuid) || patientId;
      const fallback = await window.supabaseClient
        .from('patients')
        .select('*')
        .eq('patient_id', legacyId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    // Last resort: match linked patients.id from users.patient_id (portal session UUID)
    if (!data && !error && uuid) {
      const byUserLink = await window.supabaseClient
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .maybeSingle();
      data = byUserLink.data;
      error = byUserLink.error;
    }

    if (error) {
      console.error('Error fetching patient demographics:', error);
      throw new Error('Failed to load patient information');
    }

    if (!data) {
      throw new Error('Patient record not found');
    }

    // Log access
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_portal_accessed', {
        patientId: patientId,
        section: 'demographics'
      });
    }

    return data;
  } catch (error) {
    console.error('getPatientDemographics error:', error);
    throw error;
  }
};

/**
 * Get patient appointments
 * @param {Object} filters - Optional filters (startDate, endDate, status)
 * @returns {Promise<Array>}
 */
window.getPatientAppointments = async function(filters = {}) {
  try {
    const patientId = ensurePatientAuth();
    
    if (!window.supabaseClient) {
      throw new Error('Database connection not available');
    }

    const patientUuid = await resolvePortalPatientUuid(patientId);
    if (!patientUuid) {
      throw new Error('Patient UUID could not be resolved for appointments');
    }

    let query = window.supabaseClient
      .from('appointments')
      .select('*')
      .eq('patient_id', patientUuid)
      .order('appointment_date', { ascending: false });

    if (filters.startDate) {
      query = query.gte('appointment_date', portalDateYmd(filters.startDate));
    }

    if (filters.endDate) {
      query = query.lte('appointment_date', portalDateYmd(filters.endDate));
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    let { data, error } = await query;

    // Retry without date filter if DATE vs ISO timestamp caused a bad request
    if (error && (filters.startDate || filters.endDate)) {
      console.warn('Appointment date filter failed, retrying without date filter:', error.message);
      let retry = window.supabaseClient
        .from('appointments')
        .select('*')
        .eq('patient_id', patientUuid)
        .order('appointment_date', { ascending: false });
      if (filters.status) retry = retry.eq('status', filters.status);
      const retryResult = await retry;
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('Error fetching patient appointments:', error);
      const detail = error.message || error.code || 'unknown';
      throw new Error(`Failed to load appointments (${detail})`);
    }

    const rows = (data || []).filter((a) => a.deleted !== true);

    // Log access
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_portal_accessed', {
        patientId: patientId,
        section: 'appointments'
      });
    }

    return rows;
  } catch (error) {
    console.error('getPatientAppointments error:', error);
    throw error;
  }
};

/**
 * Resolve portal patient UUID + legacy MRN for prescription/order queries.
 */
async function resolvePortalPatientIds(patientId) {
  const ids = new Set([String(patientId)]);
  if (!window.supabaseClient || !patientId) return Array.from(ids);

  try {
    let data = null;
    const byId = await window.supabaseClient
      .from('patients')
      .select('id, patient_id')
      .eq('id', patientId)
      .maybeSingle();
    data = byId.data;
    if (!data) {
      const byMrn = await window.supabaseClient
        .from('patients')
        .select('id, patient_id')
        .eq('patient_id', patientId)
        .maybeSingle();
      data = byMrn.data;
    }
    if (data) {
      if (data.id) ids.add(String(data.id));
      if (data.patient_id) ids.add(String(data.patient_id));
    }
  } catch (e) {
    console.warn('resolvePortalPatientIds:', e);
  }
  return Array.from(ids);
}

function portalIsUuidLike(id) {
  const s = String(id || '');
  return s.includes('-') && s.length === 36;
}

/** appointments.patient_id is UUID (FK to patients.id) — not legacy MRN. */
async function resolvePortalPatientUuid(patientId) {
  const ids = await resolvePortalPatientIds(patientId);
  return ids.find(portalIsUuidLike) || null;
}

function portalDateYmd(val) {
  if (!val) return '';
  return String(val).trim().slice(0, 10);
}

function portalIsUuidPrescriptionId(id) {
  if (id == null) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id).trim());
}

function resolvePortalPrescriptionPickupRef(rx) {
  if (!rx) return '';
  if (portalIsUuidPrescriptionId(rx.portalPickupId)) return rx.portalPickupId;
  if (portalIsUuidPrescriptionId(rx._supabaseId)) return rx._supabaseId;
  if (portalIsUuidPrescriptionId(rx.id)) return rx.id;
  if (rx.prescription_number) return String(rx.prescription_number).trim();
  if (rx.prescriptionNumber) return String(rx.prescriptionNumber).trim();
  return rx.id != null ? String(rx.id).trim() : '';
}

async function enrichPortalPrescriptions(rows, patientIds) {
  if (!Array.isArray(rows) || rows.length === 0 || !global.supabaseClient) {
    return rows || [];
  }

  const needsLink = rows.some((rx) => !portalIsUuidPrescriptionId(rx.id) && !portalIsUuidPrescriptionId(rx._supabaseId));
  let tableRows = [];
  if (needsLink) {
    const { data } = await global.supabaseClient
      .from('prescriptions')
      .select('id, prescription_number, source_prescription_id, patient_id')
      .in('patient_id', patientIds);
    tableRows = data || [];
  }

  return rows.map((rx) => {
    const enriched = { ...rx };
    if (portalIsUuidPrescriptionId(enriched.id)) {
      enriched.portalPickupId = enriched.id;
      enriched.portalPickupRef = enriched.id;
      return enriched;
    }
    if (portalIsUuidPrescriptionId(enriched._supabaseId)) {
      enriched.portalPickupId = enriched._supabaseId;
      enriched.portalPickupRef = enriched._supabaseId;
      return enriched;
    }

    const legacyId = enriched.id != null ? String(enriched.id).trim() : '';
    const rxNum = enriched.prescription_number || enriched.prescriptionNumber || '';
    const match = tableRows.find((t) =>
      (legacyId && String(t.source_prescription_id || '') === legacyId)
      || (rxNum && t.prescription_number === rxNum)
      || (legacyId && String(t.id) === legacyId)
    );
    if (match) {
      enriched._supabaseId = match.id;
      enriched.portalPickupId = match.id;
      enriched.portalPickupRef = match.id;
    } else {
      enriched.portalPickupRef = resolvePortalPrescriptionPickupRef(enriched);
    }
    return enriched;
  });
}

function transformPrescriptionRowsForPortal(data) {
  if (!Array.isArray(data)) return [];
  return data.map((rx) => ({
    ...rx,
    portalPickupRef: resolvePortalPrescriptionPickupRef(rx),
    medications: (() => {
      const meds = rx.medications;
      if (Array.isArray(meds)) return meds;
      if (typeof meds === 'string') {
        try { return JSON.parse(meds); } catch (_) { return []; }
      }
      return [];
    })()
  }));
}

/**
 * Get patient medications/prescriptions (full prescription records, including pending/signed).
 * @returns {Promise<Array>}
 */
window.getPatientMedications = async function() {
  try {
    const patientId = ensurePatientAuth();
    
    if (!window.supabaseClient) {
      throw new Error('Database connection not available');
    }

    const patientIds = await resolvePortalPatientIds(patientId);

    let { data, error } = await window.supabaseClient
      .from('prescriptions')
      .select('*')
      .in('patient_id', patientIds)
      .order('created_at', { ascending: false });

    if ((!data || data.length === 0) && !error) {
      const uuid = patientIds.find((id) => id.includes('-') && id.length === 36) || patientId;
      const { data: patientData } = await window.supabaseClient
        .from('patients')
        .select('prescriptions, medications')
        .eq('id', uuid)
        .maybeSingle();
      if (patientData?.prescriptions) {
        data = parsePortalJsonField(patientData.prescriptions);
      } else if (patientData?.medications) {
        data = parsePortalJsonField(patientData.medications);
      }
    }

    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const orgName = user.org || 'Default';
        const prescriptions = JSON.parse(localStorage.getItem(`${orgName}_prescriptions`) || '[]');
        data = prescriptions.filter((p) =>
          patientIds.some((id) => p.patientId === id || p.patient_id === id)
        );
      } else {
        console.warn('Returning empty medications array due to error:', error);
        return [];
      }
    }

    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_portal_accessed', { patientId, section: 'medications' });
    }

    return enrichPortalPrescriptions(
      transformPrescriptionRowsForPortal(data || []),
      patientIds
    );
  } catch (error) {
    console.error('getPatientMedications error:', error);
    throw error;
  }
};

function parsePortalJsonField(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field.filter((item) => item != null && item !== '');
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null') return [];
    try {
      const p = JSON.parse(trimmed);
      return Array.isArray(p) ? p.filter((item) => item != null && item !== '') : [];
    } catch (_) {
      return trimmed ? [trimmed] : [];
    }
  }
  return [];
}

function buildPortalMedicalHistory(demographics) {
  return parsePortalJsonField(demographics?.medical_history);
}

function buildPortalConditions(demographics) {
  const diagnoses = parsePortalJsonField(demographics?.diagnoses);
  const chronic = parsePortalJsonField(demographics?.chronic_conditions);
  const legacy = parsePortalJsonField(demographics?.conditions);
  const seen = new Set();
  const merged = [];

  function conditionKey(entry) {
    if (typeof entry === 'string') return entry.trim().toLowerCase();
    if (!entry || typeof entry !== 'object') return '';
    return String(
      entry.diagnosis || entry.name || entry.description || entry.condition || ''
    ).trim().toLowerCase();
  }

  function add(entry) {
    const key = conditionKey(entry);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(typeof entry === 'string' ? { diagnosis: entry, status: 'Active' } : entry);
  }

  diagnoses.forEach(add);
  chronic.forEach(add);
  legacy.forEach(add);
  return merged;
}

window.parsePortalJsonField = parsePortalJsonField;
window.buildPortalMedicalHistory = buildPortalMedicalHistory;
window.buildPortalConditions = buildPortalConditions;

window.getPatientPrescriptions = window.getPatientMedications;

/**
 * Get patient lab and imaging results
 * @returns {Promise<Array>}
 */
window.getPatientResults = async function() {
  try {
    const patientId = ensurePatientAuth();
    
    if (!window.supabaseClient) {
      throw new Error('Database connection not available');
    }

    // Try to get from orders table (UUID + legacy patient_id)
    const patientIds = await resolvePortalPatientIds(patientId);

    let { data, error } = await window.supabaseClient
      .from('orders')
      .select('*')
      .in('patient_id', patientIds)
      .in('type', ['lab', 'imaging'])
      .order('created_at', { ascending: false });

    // If orders table doesn't exist, try localStorage
    if (error && error.code === '42P01') {
      console.log('Orders table not found, checking localStorage');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const orgName = user.org || 'Default';
      const orders = JSON.parse(localStorage.getItem(`${orgName}_orders`) || '[]');
      data = orders.filter(o => 
        (o.patientId === patientId || o.patient_id === patientId) &&
        (o.type === 'lab' || o.type === 'imaging')
      );
    } else if (error) {
      console.error('Error fetching patient results:', error);
      throw new Error('Failed to load results');
    }

    // Log access
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_portal_accessed', {
        patientId: patientId,
        section: 'results'
      });
    }

    const rows = data || [];
    if (window.MediForgePatientPortal?.sanitizeOrderForPatientPortal) {
      return rows.map((order) => window.MediForgePatientPortal.sanitizeOrderForPatientPortal(order));
    }
    return rows;
  } catch (error) {
    console.error('getPatientResults error:', error);
    throw error;
  }
};

/**
 * Visit summaries published to the patient portal (office visits).
 * @returns {Promise<Array>}
 */
window.getPatientVisitSummaries = async function() {
  try {
    const patientId = ensurePatientAuth();
    if (!window.supabaseClient) return [];

    const patientIds = await resolvePortalPatientIds(patientId);

    const { data, error } = await window.supabaseClient
      .from('discharge_summaries')
      .select('id, visit_date, summary_generated_at, visit_snapshot, chief_complaint, discharging_physician')
      .in('patient_id', patientIds)
      .eq('summary_type', 'office_visit')
      .eq('portal_visible', true)
      .order('visit_date', { ascending: false });

    if (error) {
      console.warn('getPatientVisitSummaries:', error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('getPatientVisitSummaries error:', error);
    return [];
  }
};

/**
 * Get patient summary/clinical summary
 * @returns {Promise<Object>}
 */
window.getPatientSummary = async function(requestedPatientId = null) {
  try {
    // If patientId is provided (staff access), use it; otherwise use patient authentication
    let patientId = requestedPatientId;
    
    if (!patientId) {
      // Check if we have a globally set patientId (for staff access)
      if (window.currentPatientIdForSummary) {
        patientId = window.currentPatientIdForSummary;
      } else {
        // Otherwise, require patient authentication
        patientId = ensurePatientAuth();
      }
    }
    
    // Get patient demographics - use staff-friendly version if patientId was provided
    const demographics = requestedPatientId || window.currentPatientIdForSummary
      ? await window.getPatientDemographicsForStaff(patientId)
      : await window.getPatientDemographics();
    
    // Determine if this is staff access (patientId was provided directly, not from auth)
    const isStaffAccess = !!(requestedPatientId || window.currentPatientIdForSummary);
    
    // Get recent appointments - use staff-friendly version if staff access
    let appointments = [];
    const loadWarnings = [];
    try {
      appointments = isStaffAccess
        ? await window.getPatientAppointmentsForStaff(patientId, { 
            startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // Last year
          })
        : await window.getPatientAppointments({
            startDate: portalDateYmd(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
          });
    } catch (apptError) {
      const msg = window.MediForgePatientPortal?.formatPortalError(apptError) || apptError.message || 'Failed to load appointments';
      console.warn('Failed to load appointments:', apptError);
      loadWarnings.push({ section: 'appointments', message: msg });
      appointments = [];
    }
    
    // Get medications (handle errors gracefully) - use staff-friendly version if staff access
    let medications = [];
    try {
      medications = isStaffAccess
        ? await window.getPatientMedicationsForStaff(patientId)
        : await window.getPatientMedications();
      console.log('💊 Medications loaded:', medications.length, medications);
    } catch (medError) {
      const msg = window.MediForgePatientPortal?.formatPortalError(medError) || medError.message || 'Failed to load medications';
      console.warn('Failed to load medications:', medError);
      loadWarnings.push({ section: 'medications', message: msg });
      medications = [];
    }
    
    // Get results (handle errors gracefully) - use staff-friendly version if staff access
    let results = [];
    try {
      results = isStaffAccess
        ? await window.getPatientResultsForStaff(patientId)
        : await window.getPatientResults();
    } catch (resultsError) {
      const msg = window.MediForgePatientPortal?.formatPortalError(resultsError) || resultsError.message || 'Failed to load lab orders';
      console.warn('Failed to load results:', resultsError);
      loadWarnings.push({ section: 'lab orders', message: msg });
      results = [];
    }
    
    // Clinical sections — same sources as EMR (patient-details problem list + past medical history)
    const medicalHistory = buildPortalMedicalHistory(demographics);
    const conditions = buildPortalConditions(demographics);
    const allergies = parsePortalJsonField(demographics.allergies);
    
    console.log('📋 Portal clinical data:', {
      medicalHistory: medicalHistory.length,
      conditions: conditions.length,
      allergies: allergies.length
    });

    // Helper function to calculate age from date of birth
    const calculateAge = (dob) => {
      if (!dob) return null;
      try {
        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      } catch (e) {
        return null;
      }
    };

    // Calculate age if not provided
    const age = demographics.age || calculateAge(demographics.date_of_birth);

    // Build summary
    const summary = {
      patient: {
        name: `${demographics.first_name || ''} ${demographics.last_name || ''}`.trim(),
        dob: demographics.date_of_birth,
        age: age,
        gender: demographics.gender,
        patientId: demographics.patient_id || demographics.id
      },
      stats: {
        totalAppointments: appointments.length,
        upcomingAppointments: appointments.filter(a => 
          new Date(a.appointment_date) >= new Date()
        ).length,
      activeMedications: medications.filter((m) => {
        const status = (m.status || '').toLowerCase();
        const pharmacy = (m.pharmacy_status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'discontinued' && pharmacy !== 'cancelled';
      }).length,
        recentResults: results.filter(r => {
          const resultDate = new Date(r.created_at || r.date || Date.now());
          const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
          return resultDate >= sixMonthsAgo;
        }).length
      },
      recentAppointments: appointments.slice(0, 5),
      activeMedications: medications.filter((m) => {
        const status = (m.status || '').toLowerCase();
        const pharmacy = (m.pharmacy_status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'discontinued' && pharmacy !== 'cancelled';
      }).slice(0, 10),
      recentResults: results.slice(0, 5),
      medicalHistory: medicalHistory,
      conditions: conditions,
      allergies: allergies,
      loadWarnings: loadWarnings
    };

    // Log access
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('patient_portal_accessed', {
        patientId: patientId,
        section: 'summary'
      });
    }

    return summary;
  } catch (error) {
    console.error('getPatientSummary error:', error);
    throw error;
  }
};

/**
 * Get patient demographics for staff (no patient auth required)
 * @param {string} patientId - Patient ID (UUID or legacy ID)
 * @returns {Promise<Object>}
 */
window.getPatientDemographicsForStaff = async function(patientId) {
  if (!window.supabaseClient) {
    throw new Error('Database connection not available');
  }

  // First, try to find patient by patient_id (legacy ID like MEC0012/H1Z7C)
  let { data, error } = await window.supabaseClient
    .from('patients')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  // If not found and looks like UUID, try by id column
  if (!data && patientId.includes('-') && patientId.length === 36) {
    const { data: uuidData, error: uuidError } = await window.supabaseClient
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .maybeSingle();
    
    if (!uuidError && uuidData) {
      data = uuidData;
      error = null;
    }
  }

  // If resolvePatientByIdentifier is available, try using it as fallback
  if (!data && typeof window.resolvePatientByIdentifier === 'function') {
    try {
      const resolvedPatient = await window.resolvePatientByIdentifier(patientId);
      if (resolvedPatient && resolvedPatient._supabaseUuid) {
        const { data: resolvedData, error: resolvedError } = await window.supabaseClient
          .from('patients')
          .select('*')
          .eq('id', resolvedPatient._supabaseUuid)
          .maybeSingle();
        
        if (!resolvedError && resolvedData) {
          data = resolvedData;
          error = null;
        }
      }
    } catch (resolveError) {
      console.warn('Error resolving patient identifier:', resolveError);
    }
  }

  if (error && !data) {
    console.error('Error fetching patient demographics:', error);
    throw new Error('Failed to load patient information');
  }

  if (!data) {
    throw new Error('Patient record not found');
  }

  return data;
};

/**
 * Get patient appointments for staff (no patient auth required)
 * @param {string} patientId - Patient ID (UUID or legacy ID)
 * @param {Object} filters - Optional filters (startDate, endDate, status)
 * @returns {Promise<Array>}
 */
window.getPatientAppointmentsForStaff = async function(patientId, filters = {}) {
  if (!window.supabaseClient) {
    throw new Error('Database connection not available');
  }

  // First, get patient record to find UUID (appointments table uses UUID in patient_id column)
  let patientUuid = null;
  
  // If patientId is already a UUID, use it directly
  if (patientId.includes('-') && patientId.length === 36) {
    patientUuid = patientId;
  } else {
    // Query patients table to get UUID from legacy ID
    const { data: patientData, error: patientError } = await window.supabaseClient
      .from('patients')
      .select('id')
      .eq('patient_id', patientId)
      .maybeSingle();
    
    if (!patientError && patientData && patientData.id) {
      patientUuid = patientData.id;
      console.log('Resolved patient ID for appointments:', patientId, '->', patientUuid);
    } else if (typeof window.resolvePatientByIdentifier === 'function') {
      // Fallback to resolvePatientByIdentifier if available
      try {
        const resolvedPatient = await window.resolvePatientByIdentifier(patientId);
        if (resolvedPatient && resolvedPatient._supabaseUuid) {
          patientUuid = resolvedPatient._supabaseUuid;
        } else if (resolvedPatient && resolvedPatient.id && resolvedPatient.id.includes('-')) {
          patientUuid = resolvedPatient.id;
        }
      } catch (resolveError) {
        console.warn('Error resolving patient identifier:', resolveError);
      }
    }
  }
  
  // If we still don't have a UUID, return empty array (appointments table uses UUIDs)
  if (!patientUuid || !patientUuid.includes('-') || patientUuid.length !== 36) {
    console.warn('Could not resolve patient ID to UUID for appointments query. Patient ID:', patientId);
    return [];
  }

  let query = window.supabaseClient
    .from('appointments')
    .select('*')
    .eq('patient_id', patientUuid)
    .order('appointment_date', { ascending: false });

  if (filters.startDate) {
    query = query.gte('appointment_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('appointment_date', filters.endDate);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching patient appointments:', error);
    // Return empty array instead of throwing to allow summary to load
    return [];
  }

  return data || [];
};

/**
 * Get patient medications for staff (no patient auth required)
 * @param {string} patientId - Patient ID (UUID or legacy ID)
 * @returns {Promise<Array>}
 */
window.getPatientMedicationsForStaff = async function(patientId) {
  if (!window.supabaseClient) {
    throw new Error('Database connection not available');
  }

  // First, get patient record to find UUID (prescriptions table uses UUID in patient_id column)
  let patientUuid = null;
  
  // If patientId is already a UUID, use it directly
  if (patientId.includes('-') && patientId.length === 36) {
    patientUuid = patientId;
  } else {
    // Query patients table to get UUID from legacy ID
    const { data: patientData, error: patientError } = await window.supabaseClient
      .from('patients')
      .select('id')
      .eq('patient_id', patientId)
      .maybeSingle();
    
    if (!patientError && patientData && patientData.id) {
      patientUuid = patientData.id;
    } else if (typeof window.resolvePatientByIdentifier === 'function') {
      // Fallback to resolvePatientByIdentifier if available
      try {
        const resolvedPatient = await window.resolvePatientByIdentifier(patientId);
        if (resolvedPatient && resolvedPatient._supabaseUuid) {
          patientUuid = resolvedPatient._supabaseUuid;
        } else if (resolvedPatient && resolvedPatient.id && resolvedPatient.id.includes('-')) {
          patientUuid = resolvedPatient.id;
        }
      } catch (resolveError) {
        console.warn('Error resolving patient identifier:', resolveError);
      }
    }
  }

  // If we still don't have a UUID, try localStorage fallback
  if (!patientUuid || !patientUuid.includes('-') || patientUuid.length !== 36) {
    console.log('Could not resolve to UUID for prescriptions, trying localStorage');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgName = user.org || 'Default';
    const prescriptions = JSON.parse(localStorage.getItem(`${orgName}_prescriptions`) || '[]');
    return prescriptions.filter(p => 
      p.patientId === patientId || 
      p.patient_id === patientId
    );
  }

  // Try to get from prescriptions table using UUID
  let { data, error } = await window.supabaseClient
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientUuid)
    .order('prescription_date', { ascending: false });

  console.log('💊 Prescriptions table query result:', { data, error, count: data?.length || 0 });

  // Also check if medications are stored in patients table (prescriptions JSONB column)
  if ((!data || data.length === 0) && !error) {
    try {
      const { data: patientData, error: patientError } = await window.supabaseClient
        .from('patients')
        .select('prescriptions, medications')
        .eq('id', patientUuid)
        .maybeSingle();
      
      console.log('💊 Patients table query for medications:', { patientData, patientError });
      
      if (!patientError && patientData) {
        // Check prescriptions JSONB column
        if (patientData.prescriptions) {
          let prescriptions = patientData.prescriptions;
          // If it's a JSON string, parse it
          if (typeof prescriptions === 'string') {
            try {
              prescriptions = JSON.parse(prescriptions);
            } catch (e) {
              console.warn('Error parsing prescriptions JSON string:', e);
            }
          }
          if (Array.isArray(prescriptions) && prescriptions.length > 0) {
            data = prescriptions;
            console.log('💊 Found medications in patients.prescriptions JSONB column:', prescriptions.length);
          }
        }
        // Check medications JSONB column
        if ((!data || data.length === 0) && patientData.medications) {
          let medications = patientData.medications;
          // If it's a JSON string, parse it
          if (typeof medications === 'string') {
            try {
              medications = JSON.parse(medications);
            } catch (e) {
              console.warn('Error parsing medications JSON string:', e);
            }
          }
          if (Array.isArray(medications) && medications.length > 0) {
            data = medications;
            console.log('💊 Found medications in patients.medications JSONB column:', medications.length);
          }
        }
      }
    } catch (patientQueryError) {
      console.warn('Error querying patients table for medications:', patientQueryError);
    }
  }

  // Transform prescription data to match expected format
  if (data && Array.isArray(data)) {
    data = data.map(med => {
      // If it's a prescription object with medications array, extract each medication
      if (med.medications && Array.isArray(med.medications)) {
        return med.medications.map(m => ({
          medication: m.name || m.medication || m.medication_name,
          name: m.name || m.medication || m.medication_name,
          dosage: m.dosage || m.strength,
          frequency: m.frequency || m.directions,
          instructions: m.instructions || m.directions || m.frequency,
          prescribed_date: med.prescription_date || med.date || med.prescribed_date || med.createdAt,
          date: med.prescription_date || med.date || med.prescribed_date || med.createdAt,
          status: (med.status || m.status || 'active').toLowerCase()
        }));
      } else {
        // Single medication or already in correct format
        return {
          medication: med.medication || med.name || med.medication_name || med.medicationName,
          name: med.medication || med.name || med.medication_name || med.medicationName,
          dosage: med.dosage || med.strength,
          frequency: med.frequency || med.directions,
          instructions: med.instructions || med.directions || med.frequency,
          prescribed_date: med.prescription_date || med.date || med.prescribed_date || med.start_date,
          date: med.prescription_date || med.date || med.prescribed_date || med.start_date,
          status: med.status || 'active'
        };
      }
    }).flat(); // Flatten array if prescriptions contained multiple medications
    console.log('💊 Transformed medication data:', data);
  }

  // Fallback to localStorage if Supabase fails
  if (error) {
    if (error.code === '42P01') {
      console.log('Prescriptions table not found, checking localStorage');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const orgName = user.org || 'Default';
      const prescriptions = JSON.parse(localStorage.getItem(`${orgName}_prescriptions`) || '[]');
      data = prescriptions.filter(p => 
        p.patientId === patientId || 
        p.patient_id === patientId || 
        p.patientId === patientUuid || 
        p.patient_id === patientUuid
      );
      error = null;
    } else {
      console.warn('Error fetching medications, returning empty array:', error);
      return [];
    }
  }

  // Transform prescription data to match expected format
  if (data && Array.isArray(data)) {
    data = data.map(med => {
      // If it's a prescription object, extract medication info
      if (med.medications && Array.isArray(med.medications)) {
        // This is a prescription with multiple medications
        return med.medications.map(m => ({
          medication: m.name || m.medication || m.medication_name,
          name: m.name || m.medication || m.medication_name,
          dosage: m.dosage || m.strength,
          frequency: m.frequency || m.directions,
          instructions: m.instructions || m.directions || m.frequency,
          prescribed_date: med.prescription_date || med.date || med.prescribed_date,
          date: med.prescription_date || med.date || med.prescribed_date,
          status: med.status || m.status || 'active'
        }));
      } else {
        // Single medication or already in correct format
        return {
          medication: med.medication || med.name || med.medication_name || med.medicationName,
          name: med.medication || med.name || med.medication_name || med.medicationName,
          dosage: med.dosage || med.strength,
          frequency: med.frequency || med.directions,
          instructions: med.instructions || med.directions || med.frequency,
          prescribed_date: med.prescription_date || med.date || med.prescribed_date || med.start_date,
          date: med.prescription_date || med.date || med.prescribed_date || med.start_date,
          status: med.status || 'active'
        };
      }
    }).flat(); // Flatten array if prescriptions contained multiple medications
  }

  return data || [];
};

/**
 * Get patient results for staff (no patient auth required)
 * @param {string} patientId - Patient ID (UUID or legacy ID)
 * @returns {Promise<Array>}
 */
window.getPatientResultsForStaff = async function(patientId) {
  if (!window.supabaseClient) {
    throw new Error('Database connection not available');
  }

  // First, get patient record to find UUID (orders table uses UUID in patient_id column)
  let patientUuid = null;
  
  // If patientId is already a UUID, use it directly
  if (patientId.includes('-') && patientId.length === 36) {
    patientUuid = patientId;
  } else {
    // Query patients table to get UUID from legacy ID
    const { data: patientData, error: patientError } = await window.supabaseClient
      .from('patients')
      .select('id')
      .eq('patient_id', patientId)
      .maybeSingle();
    
    if (!patientError && patientData && patientData.id) {
      patientUuid = patientData.id;
    } else if (typeof window.resolvePatientByIdentifier === 'function') {
      // Fallback to resolvePatientByIdentifier if available
      try {
        const resolvedPatient = await window.resolvePatientByIdentifier(patientId);
        if (resolvedPatient && resolvedPatient._supabaseUuid) {
          patientUuid = resolvedPatient._supabaseUuid;
        } else if (resolvedPatient && resolvedPatient.id && resolvedPatient.id.includes('-')) {
          patientUuid = resolvedPatient.id;
        }
      } catch (resolveError) {
        console.warn('Error resolving patient identifier:', resolveError);
      }
    }
  }

  // If we still don't have a UUID, try localStorage fallback
  if (!patientUuid || !patientUuid.includes('-') || patientUuid.length !== 36) {
    console.log('Could not resolve to UUID for orders, trying localStorage');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgName = user.org || 'Default';
    const orders = JSON.parse(localStorage.getItem(`${orgName}_orders`) || '[]');
    return orders.filter(o => 
      (o.patientId === patientId || o.patient_id === patientId) &&
      (o.type === 'lab' || o.type === 'imaging')
    );
  }

  // Try to get from orders table using UUID
  let { data, error } = await window.supabaseClient
    .from('orders')
    .select('*')
    .eq('patient_id', patientUuid)
    .in('type', ['lab', 'imaging'])
    .order('created_at', { ascending: false });

  // Fallback to localStorage if Supabase fails
  if (error) {
    if (error.code === '42P01') {
      console.log('Orders table not found, checking localStorage');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const orgName = user.org || 'Default';
      const orders = JSON.parse(localStorage.getItem(`${orgName}_orders`) || '[]');
      data = orders.filter(o => 
        (o.patientId === patientId || o.patient_id === patientId || o.patientId === patientUuid || o.patient_id === patientUuid) &&
        (o.type === 'lab' || o.type === 'imaging')
      );
      error = null;
    } else {
      console.error('Error fetching patient results:', error);
      // Return empty array instead of throwing to allow summary to load
      return [];
    }
  }

  return data || [];
};


