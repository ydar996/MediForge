/**
 * Pharmacy Management System
 * Handles prescription filling, inventory management, and dispensing
 * ONLY accessible to Pharmacists - does not modify existing prescription creation flow
 */

// Initialize Supabase client
window.getPharmacySupabaseClient = async function() {
  if (typeof window.getSupabaseClient === 'function') {
    return await window.getSupabaseClient();
  }
  
  if (window.supabaseClient) {
    return window.supabaseClient;
  }
  
  // Fallback initialization
  const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
  const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');
  
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  
  throw new Error('Supabase client not available');
}

// Get current organization ID
async function getPharmacyOrgId() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!user.org) {
    throw new Error('User organization not found');
  }
  
  // Method 1: Check if user.org is already a UUID (organization ID)
  if (user.org.includes('-') && user.org.length === 36) {
    return user.org;
  }
  
  // Method 2: Check if organizationId is stored in user object
  if (user.organizationId) {
    return user.organizationId;
  }
  if (user.organization_id) {
    return user.organization_id;
  }
  
  // Method 3: Check localStorage organizations object
  try {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (organizations[user.org] && organizations[user.org].id) {
      // Update user object for future use
      user.organizationId = organizations[user.org].id;
      user.organization_id = organizations[user.org].id;
      localStorage.setItem('user', JSON.stringify(user));
      return organizations[user.org].id;
    }
  } catch (e) {
    console.warn('Could not parse organizations from localStorage:', e);
  }
  
  // Method 4: Query Supabase by organization name
  try {
    const supabase = await getPharmacySupabaseClient();
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', user.org)
      .single();
    
    if (error) {
      console.error('Error fetching organization:', error);
      // Try case-insensitive search
      const { data: caseInsensitiveData, error: caseError } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', user.org)
        .limit(1)
        .maybeSingle();
      
      if (caseError || !caseInsensitiveData) {
        throw new Error(`Organization "${user.org}" not found in database`);
      }
      
      // Cache the result
      user.organizationId = caseInsensitiveData.id;
      user.organization_id = caseInsensitiveData.id;
      localStorage.setItem('user', JSON.stringify(user));
      
      return caseInsensitiveData.id;
    }
    
    if (!data) {
      throw new Error(`Organization "${user.org}" not found in database`);
    }
    
    // Cache the result
    user.organizationId = data.id;
    user.organization_id = data.id;
    localStorage.setItem('user', JSON.stringify(user));
    
    return data.id;
  } catch (error) {
    console.error('Error in getPharmacyOrgId:', error);
    throw new Error(`Could not retrieve organization ID: ${error.message}`);
  }
}
window.getPharmacyOrgId = getPharmacyOrgId;

// Check if user is a pharmacist
function isPharmacist() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.role === 'Pharmacist' || user.role === 'pharmacist';
}

// Get prescriptions stored in patient records (patients.prescriptions) - signed prescriptions not yet in prescriptions table
async function getPrescriptionsFromPatientRecords(supabase, orgId) {
  try {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, patient_id, first_name, last_name, prescriptions')
      .eq('organization_id', orgId);
    if (error) {
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('prescriptions')) {
        return [];
      }
      throw error;
    }
    if (!patients || patients.length === 0) return [];
    const list = [];
    for (const patient of patients) {
      let prescriptions = patient.prescriptions;
      if (typeof prescriptions === 'string') {
        try {
          prescriptions = JSON.parse(prescriptions);
        } catch (_) {
          continue;
        }
      }
      if (!Array.isArray(prescriptions)) continue;
      const patientId = patient.patient_id || patient.id;
      const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || patientId;
      for (const p of prescriptions) {
        if (p.status !== 'signed' && p.status !== 'Signed') continue;
        if (p._supabaseId) continue;
        const meds = Array.isArray(p.medications) ? p.medications : (typeof p.medications === 'string' ? (() => { try { return JSON.parse(p.medications); } catch (_) { return []; } })() : []);
        list.push({
          id: p.id,
          patient_id: patientId,
          patient_name: patientName,
          diagnosis: p.diagnosis || '',
          medications: typeof p.medications === 'string' ? p.medications : JSON.stringify(meds),
          signature: p.signature || null,
          signature_date: p.signatureDate || p.createdAt || p.savedAt,
          status: 'signed',
          sent_to_pharmacy_at: p.signatureDate || p.createdAt || p.savedAt,
          _fromPatientRecord: true
        });
      }
    }
    list.sort((a, b) => {
      const da = a.sent_to_pharmacy_at ? new Date(a.sent_to_pharmacy_at).getTime() : 0;
      const db = b.sent_to_pharmacy_at ? new Date(b.sent_to_pharmacy_at).getTime() : 0;
      return db - da;
    });
    return list;
  } catch (e) {
    console.warn('Could not fetch prescriptions from patient records:', e);
    return [];
  }
}

// Get incoming prescriptions: pending + approved_by_pharmacist not yet paid (stays visible with "Sent to accountant" until payment)
window.getIncomingPrescriptions = async function() {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    
    let tableRows = [];
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .in('pharmacy_status', ['pending', 'approved_by_pharmacist'])
      .order('sent_to_pharmacy_at', { ascending: false })
      .limit(100);
    
    if (error) {
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('pharmacy_status')) {
        const { data: allPrescriptions, error: fallbackError } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (!fallbackError && allPrescriptions) tableRows = allPrescriptions;
      } else {
        throw error;
      }
    } else {
      tableRows = data || [];
    }
    
    // Exclude approved_by_pharmacist that are already paid (those show only in Ready to fill)
    tableRows = (tableRows || []).filter(function(r) {
      if (r.pharmacy_status === 'approved_by_pharmacist' && r.paid_at) return false;
      return true;
    });
    
    const fromPatientRecords = await getPrescriptionsFromPatientRecords(supabase, orgId);
    const existingSourceIds = new Set((tableRows || []).map(r => r.source_prescription_id).filter(Boolean));
    const fromPatientFiltered = (fromPatientRecords || []).filter(p => !existingSourceIds.has(p.id));
    
    const merged = [...(tableRows || []), ...fromPatientFiltered];
    merged.sort((a, b) => {
      const da = (a.sent_to_pharmacy_at ? new Date(a.sent_to_pharmacy_at).getTime() : 0) || (a.created_at ? new Date(a.created_at).getTime() : 0);
      const db = (b.sent_to_pharmacy_at ? new Date(b.sent_to_pharmacy_at).getTime() : 0) || (b.created_at ? new Date(b.created_at).getTime() : 0);
      return db - da;
    });
    return merged;
  } catch (error) {
    console.error('Error fetching incoming prescriptions:', error);
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('⚠️ Prescriptions table issue. Migration may not have been run yet.');
      return [];
    }
    throw error;
  }
};

// Get prescriptions approved by pharmacist (for accountant dashboard – no pharmacist role required)
// Enriches each prescription with patient_name from patients table
window.getApprovedPrescriptions = async function() {
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('pharmacy_status', 'approved_by_pharmacist')
      .order('approved_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const prescriptions = data || [];
    if (prescriptions.length === 0) return prescriptions;
    const uniquePatientIds = [...new Set(prescriptions.map(p => p.patient_id).filter(Boolean))];
    const patientNamesById = {};
    for (const pid of uniquePatientIds) {
      try {
        if (typeof window.getPatientNameById === 'function') {
          const name = await window.getPatientNameById(pid);
          if (name) patientNamesById[pid] = name;
        }
        if (!patientNamesById[pid]) {
          const { data: byLegacy } = await supabase.from('patients').select('first_name, last_name').eq('organization_id', orgId).eq('patient_id', pid).maybeSingle();
          if (byLegacy) patientNamesById[pid] = [byLegacy.first_name, byLegacy.last_name].filter(Boolean).join(' ').trim();
        }
        if (!patientNamesById[pid] && pid && pid.length === 36 && pid.includes('-')) {
          const { data: byUuid } = await supabase.from('patients').select('first_name, last_name').eq('organization_id', orgId).eq('id', pid).maybeSingle();
          if (byUuid) patientNamesById[pid] = [byUuid.first_name, byUuid.last_name].filter(Boolean).join(' ').trim();
        }
      } catch (e) { console.warn('Could not resolve patient name for', pid, e); }
    }
    return prescriptions.map(p => ({
      ...p,
      patient_name: patientNamesById[p.patient_id] || p.patient_name || null
    }));
  } catch (e) {
    if (e.code === 'PGRST205' || (e.message && e.message.includes('table'))) return [];
    console.error('Error fetching approved prescriptions:', e);
    throw e;
  }
};

// When an invoice is paid, mark linked prescription(s) as paid (called from billing.js recordPayment)
window.markPrescriptionPaidByInvoiceId = async function(invoiceId) {
  if (!invoiceId) return;
  try {
    const supabase = await getPharmacySupabaseClient();
    const { error } = await supabase
      .from('prescriptions')
      .update({ paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('invoice_id', String(invoiceId));
    if (error) console.error('Error marking prescription paid:', error);
  } catch (e) {
    console.error('markPrescriptionPaidByInvoiceId:', e);
  }
};

// Link a prescription to an invoice (call after creating invoice for prescription)
window.setPrescriptionInvoiceId = async function(prescriptionId, invoiceId) {
  if (!prescriptionId || !invoiceId) return;
  try {
    const supabase = await getPharmacySupabaseClient();
    const { error } = await supabase
      .from('prescriptions')
      .update({ invoice_id: String(invoiceId), updated_at: new Date().toISOString() })
      .eq('id', prescriptionId);
    if (error) throw error;
  } catch (e) {
    console.error('setPrescriptionInvoiceId:', e);
    throw e;
  }
};

// Default unit price when not in inventory (e.g. 50)
const DEFAULT_MEDICATION_UNIT_PRICE = 50;

// Categories pharmacists may prescribe (OTC / non-addictive). Excludes Opioid, Antibiotic, etc.
const PHARMACIST_PRESCRIBABLE_CATEGORIES = ['Analgesic', 'NSAID', 'Supplement', 'PPI', 'H2 Blocker', 'Bronchodilator', 'Antimalarial'];

// Get medications pharmacists can prescribe (OTC / non-addictive)
window.getPharmacistPrescribableMedications = function() {
  const db = typeof window.DRUG_DATABASE !== 'undefined' ? window.DRUG_DATABASE : [];
  return db.filter(d => PHARMACIST_PRESCRIBABLE_CATEGORIES.includes(d.category || ''));
};

// Create prescription from pharmacist (OTC / non-addictive only). Same workflow: approval → invoice → payment → dispense.
// Audit: prescriber_type='pharmacist', created_by=pharmacist username, logAuditEvent('prescription_created_by_pharmacist')
window.createPrescriptionFromPharmacist = async function(payload) {
  if (!isPharmacist()) throw new Error('Access denied: Pharmacist role required');
  const { patientId, patientName, medications, diagnosis } = payload;
  if (!patientId || !medications || !Array.isArray(medications) || medications.length === 0) {
    throw new Error('Patient and at least one medication required');
  }
  const prescribable = getPharmacistPrescribableMedications();
  const prescribableNames = new Set(prescribable.map(d => (d.name || '').toLowerCase()));
  for (const med of medications) {
    const name = (med.name || med.medication_name || '').trim();
    if (!name) throw new Error('Medication name required');
    if (!prescribableNames.has(name.toLowerCase())) {
      throw new Error(`"${name}" is not in the pharmacist-prescribable list (OTC/non-addictive only). Use doctor prescription for other medications.`);
    }
  }
  const supabase = await getPharmacySupabaseClient();
  const orgId = await getPharmacyOrgId();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const prescriptionNumber = typeof window.generatePrescriptionNumber === 'function' ? await window.generatePrescriptionNumber() : null;
  const row = {
    organization_id: orgId,
    prescription_number: prescriptionNumber,
    patient_id: patientId,
    patient_name: patientName || null,
    prescriber_id: user.id || user.user_id || user.username,
    prescriber_type: 'pharmacist',
    diagnosis: diagnosis || 'Pharmacist-prescribed (OTC/non-addictive)',
    medications: JSON.stringify(medications.map(m => ({
      name: m.name || m.medication_name,
      strength: m.strength || '',
      form: m.form || '',
      quantity: parseInt(m.quantity, 10) || 1,
      directions: m.directions || 'As directed',
      refills: m.refills || 0
    }))),
    status: 'signed',
    created_by: user.username || 'Pharmacist',
    pharmacy_status: 'pending',
    sent_to_pharmacy_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('prescriptions').insert([row]).select().single();
  if (error) throw error;
  if (typeof logAuditEvent === 'function') {
    await logAuditEvent('prescription_created_by_pharmacist', {
      prescription_id: data.id,
      patient_id: patientId,
      pharmacist: user.username,
      medication_count: medications.length,
      prescriber_type: 'pharmacist'
    });
  }
  return data;
};

// Create invoice for an approved prescription and link it (for Accountant dashboard)
window.createInvoiceForPrescription = async function(prescription) {
  if (!prescription || !prescription.id) throw new Error('Invalid prescription');
  if (typeof window.createInvoice !== 'function') throw new Error('Billing (createInvoice) not loaded');
  const supabase = await getPharmacySupabaseClient();
  const orgId = await getPharmacyOrgId();
  const meds = typeof prescription.medications === 'string' ? JSON.parse(prescription.medications || '[]') : (prescription.medications || []);
  if (meds.length === 0) throw new Error('Prescription has no medications');
  const { data: inventoryRows } = await supabase
    .from('medication_inventory')
    .select('medication_name, strength, form, selling_price_per_unit')
    .eq('organization_id', orgId);
  const priceByKey = (inventoryRows || []).reduce((acc, row) => {
    const key = [row.medication_name, row.strength || '', row.form || ''].join('|');
    acc[key] = parseFloat(row.selling_price_per_unit) || DEFAULT_MEDICATION_UNIT_PRICE;
    return acc;
  }, {});
  const services = meds.map(med => {
    const name = med.name || med.medication_name || 'Medication';
    const strength = med.strength || '';
    const form = med.form || '';
    const key = [name, strength, form].join('|');
    const unitPrice = priceByKey[key] || DEFAULT_MEDICATION_UNIT_PRICE;
    const qty = parseInt(med.quantity || med.quantity_to_dispense || 1, 10) || 1;
    const lineName = [name, strength, form].filter(Boolean).join(' ');
    return { name: lineName || name, quantity: qty, price: unitPrice };
  });
  // Look up patient name from patients table (prescriptions only store patient_id)
  let patientName = prescription.patient_name;
  if (!patientName && prescription.patient_id) {
    try {
      if (typeof window.getPatientNameById === 'function') {
        patientName = await window.getPatientNameById(prescription.patient_id);
      }
      if (!patientName) {
        let patientRow = null;
        const pid = prescription.patient_id;
        const { data: byLegacyId } = await supabase
          .from('patients')
          .select('first_name, last_name')
          .eq('organization_id', orgId)
          .eq('patient_id', pid)
          .maybeSingle();
        if (byLegacyId) patientRow = byLegacyId;
        else if (pid && pid.length === 36 && pid.includes('-')) {
          const { data: byUuid } = await supabase
            .from('patients')
            .select('first_name, last_name')
            .eq('organization_id', orgId)
            .eq('id', pid)
            .maybeSingle();
          if (byUuid) patientRow = byUuid;
        }
        if (patientRow) {
          patientName = [patientRow.first_name, patientRow.last_name].filter(Boolean).join(' ').trim();
        }
      }
    } catch (e) {
      console.warn('Could not resolve patient name for prescription:', e);
    }
  }
  if (!patientName) {
    patientName = 'Patient ' + (prescription.patient_id || '').toString().substring(0, 8);
  }
  const defaultCurrency = typeof window.getDefaultCurrency === 'function' ? window.getDefaultCurrency() : (localStorage.getItem((JSON.parse(localStorage.getItem('user') || '{}').org || 'Default') + '_billing_default_currency') || 'CAD');
  const invoice = await window.createInvoice({
    patientId: prescription.patient_id,
    patientName: patientName,
    services,
    date: new Date().toISOString().split('T')[0],
    currency: defaultCurrency,
    notes: 'Pharmacy prescription #' + (typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(prescription) : (prescription.prescription_number || (prescription.id || '').toString().substring(0, 8)))
  });
  await window.setPrescriptionInvoiceId(prescription.id, invoice.id);
  return invoice;
};

// Add a prescription from patient record into the prescriptions table so it can be processed (avoid duplicate display)
window.addPatientRecordPrescriptionToQueue = async function(patientId, patientName, prescription) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  const supabase = await getPharmacySupabaseClient();
  const orgId = await getPharmacyOrgId();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  var dateStr = null;
  if (prescription.signature_date || prescription.signatureDate || prescription.date || prescription.createdAt || prescription.savedAt) {
    var d = new Date(prescription.signature_date || prescription.signatureDate || prescription.date || prescription.createdAt || prescription.savedAt);
    dateStr = d.toISOString().split('T')[0];
  }
  if (!dateStr) dateStr = new Date().toISOString().split('T')[0];
  const prescriptionNumber = typeof window.generatePrescriptionNumber === 'function'
    ? await window.generatePrescriptionNumber()
    : null;
  const row = {
    organization_id: orgId,
    prescription_number: prescriptionNumber,
    patient_id: patientId,
    prescriber_id: user.id || user.user_id || user.username,
    diagnosis: prescription.diagnosis || '',
    medications: typeof prescription.medications === 'string' ? prescription.medications : JSON.stringify(prescription.medications || []),
    signature: prescription.signature || null,
    signature_date: prescription.signature_date || prescription.signatureDate || null,
    prescription_date: dateStr,
    status: 'signed',
    created_by: user.username || 'Pharmacy',
    pharmacy_status: 'pending',
    sent_to_pharmacy_at: new Date().toISOString(),
    source_prescription_id: prescription.id
  };
  const { data, error } = await supabase.from('prescriptions').insert([row]).select().single();
  if (error) throw error;
  return data;
};

// Get prescriptions in process
window.getInProcessPrescriptions = async function() {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('pharmacy_status', 'in-process')
      .order('sent_to_pharmacy_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching in-process prescriptions:', error);
    throw error;
  }
};

// Get filled prescriptions
window.getFilledPrescriptions = async function() {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .in('pharmacy_status', ['filled', 'completed'])
      .order('filled_at', { ascending: false })
      .limit(100); // Last 100 filled prescriptions
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching filled prescriptions:', error);
    throw error;
  }
};

// Get prescriptions approved by pharmacist and paid (ready for pharmacist to start fill)
window.getReadyToFillPrescriptions = async function() {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('pharmacy_status', 'approved_by_pharmacist')
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching ready-to-fill prescriptions:', error);
    throw error;
  }
};

// Approve prescription (after allergy check) – moves to approved_by_pharmacist and to accountant
window.approvePrescription = async function(prescriptionId) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  const supabase = await getPharmacySupabaseClient();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const updateData = {
    pharmacy_status: 'approved_by_pharmacist',
    approved_at: new Date().toISOString(),
    approved_by_user_id: user.id || user.user_id,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('prescriptions')
    .update(updateData)
    .eq('id', prescriptionId)
    .select()
    .single();
  if (error) throw error;
  if (typeof logAuditEvent === 'function') {
    await logAuditEvent('prescription_approved_by_pharmacist', { prescription_id: prescriptionId, pharmacist: user.username });
  }
  return data;
};

// Update prescription status (pending → in-process → filled, etc.)
window.updatePrescriptionStatus = async function(prescriptionId, newStatus, notes = null) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  const allowed = ['pending', 'in-process', 'filled', 'completed', 'cancelled', 'approved_by_pharmacist', 'rejected', 'sent_out'];
  if (!allowed.includes(newStatus)) {
    throw new Error('Invalid prescription status');
  }
  try {
    const supabase = await getPharmacySupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const updateData = {
      pharmacy_status: newStatus,
      updated_at: new Date().toISOString()
    };
    if (newStatus === 'in-process') {
      const { data: current } = await supabase.from('prescriptions').select('medications, sent_to_pharmacy_at').eq('id', prescriptionId).single();
      if (current) {
        if (!current.sent_to_pharmacy_at) {
          updateData.sent_to_pharmacy_at = new Date().toISOString();
        }
        if (current.medications) {
          const meds = typeof current.medications === 'string' ? JSON.parse(current.medications) : current.medications;
          if (Array.isArray(meds) && meds.length > 0) {
            const normalized = meds.map(m => ({
              ...m,
              pharmacy_line_status: m.pharmacy_line_status || 'in-process'
            }));
            updateData.medications = normalized;
          }
        }
      }
    }
    if (newStatus === 'filled' || newStatus === 'completed') {
      updateData.filled_at = new Date().toISOString();
      updateData.filled_by_user_id = user.id || user.user_id;
      updateData.patient_pickup_status = 'due_for_pickup';
    }
    if (newStatus === 'rejected') {
      updateData.rejected_at = new Date().toISOString();
      updateData.rejected_by_user_id = user.id || user.user_id;
      updateData.rejected_reason = notes || '';
    }
    if (newStatus === 'sent_out') {
      updateData.sent_out_at = new Date().toISOString();
      updateData.sent_out_notes = notes || '';
    }
    if (notes && newStatus !== 'rejected' && newStatus !== 'sent_out') {
      updateData.pharmacy_notes = notes;
    }
    const { data, error } = await supabase
      .from('prescriptions')
      .update(updateData)
      .eq('id', prescriptionId)
      .select()
      .single();
    if (error) throw error;
    if (typeof logAuditEvent === 'function') {
      const auditDetails = {
        prescription_id: prescriptionId,
        new_status: newStatus,
        pharmacist: user.username
      };
      if (newStatus === 'rejected') auditDetails.rejected_reason = notes || '';
      if (newStatus === 'sent_out') auditDetails.sent_out_notes = notes || '';
      await logAuditEvent('prescription_status_updated', auditDetails);
    }
    return data;
  } catch (error) {
    console.error('Error updating prescription status:', error);
    throw error;
  }
};

// Mark a single medication line as dispensed (per-line status). When all lines are completed, order moves to completed.
window.markMedicationLineDispensed = async function(prescriptionId, lineIndex) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  const supabase = await getPharmacySupabaseClient();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { data: prescription, error: fetchError } = await supabase
    .from('prescriptions')
    .select('medications, patient_id, pharmacy_status')
    .eq('id', prescriptionId)
    .single();
  if (fetchError || !prescription) throw new Error('Prescription not found');
  const meds = typeof prescription.medications === 'string' ? JSON.parse(prescription.medications || '[]') : (prescription.medications || []);
  if (!Array.isArray(meds) || lineIndex < 0 || lineIndex >= meds.length) {
    throw new Error('Invalid medication line');
  }
  const line = meds[lineIndex];
  line.pharmacy_line_status = 'completed';
  const allTerminal = meds.every(m => {
    const s = (m.pharmacy_line_status || 'in-process');
    return s === 'completed' || s === 'rejected' || s === 'sent_out';
  });
  const updateData = {
    medications: meds,
    updated_at: new Date().toISOString()
  };
  if (allTerminal) {
    updateData.pharmacy_status = 'completed';
    updateData.filled_at = new Date().toISOString();
    updateData.filled_by_user_id = user.id || user.user_id;
  }
  const { data, error } = await supabase
    .from('prescriptions')
    .update(updateData)
    .eq('id', prescriptionId)
    .select()
    .single();
  if (error) throw error;
  if (typeof logAuditEvent === 'function') {
    await logAuditEvent('medication_line_dispensed', {
      prescription_id: prescriptionId,
      line_index: lineIndex,
      medication: line.name || line.medication_name,
      all_complete: allTerminal,
      pharmacist: user.username
    });
  }
  return data;
};

// Per-medication Reject or Sent out (single line within a prescription)
window.updatePrescriptionLineStatus = async function(prescriptionId, lineIndex, status, notes) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  if (status !== 'rejected' && status !== 'sent_out') {
    throw new Error('Line status must be rejected or sent_out');
  }
  const supabase = await getPharmacySupabaseClient();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { data: prescription, error: fetchError } = await supabase
    .from('prescriptions')
    .select('medications, patient_id, pharmacy_status')
    .eq('id', prescriptionId)
    .single();
  if (fetchError || !prescription) throw new Error('Prescription not found');
  const meds = typeof prescription.medications === 'string' ? JSON.parse(prescription.medications || '[]') : (prescription.medications || []);
  if (!Array.isArray(meds) || lineIndex < 0 || lineIndex >= meds.length) {
    throw new Error('Invalid medication line');
  }
  const line = meds[lineIndex];
  line.pharmacy_line_status = status;
  if (notes) line.pharmacy_line_notes = notes;
  const allTerminal = meds.every(m => {
    const s = (m.pharmacy_line_status || 'in-process');
    return s === 'completed' || s === 'rejected' || s === 'sent_out';
  });
  const updateData = {
    medications: meds,
    updated_at: new Date().toISOString()
  };
  if (allTerminal) {
    updateData.pharmacy_status = 'completed';
    updateData.filled_at = new Date().toISOString();
    updateData.filled_by_user_id = user.id || user.user_id;
  }
  const { data, error } = await supabase
    .from('prescriptions')
    .update(updateData)
    .eq('id', prescriptionId)
    .select()
    .single();
  if (error) throw error;
  if (typeof logAuditEvent === 'function') {
    await logAuditEvent('prescription_line_status_updated', {
      prescription_id: prescriptionId,
      line_index: lineIndex,
      status,
      medication: line.name || line.medication_name,
      all_terminal: allTerminal,
      pharmacist: user.username
    });
  }
  return data;
};

function sortInventoryLotsFefo(lots) {
  return [...(lots || [])].sort((a, b) => {
    const ad = a.expiry_date ? new Date(String(a.expiry_date).slice(0, 10) + 'T12:00:00').getTime() : Number.POSITIVE_INFINITY;
    const bd = b.expiry_date ? new Date(String(b.expiry_date).slice(0, 10) + 'T12:00:00').getTime() : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    const ar = new Date(a.received_at || a.created_at || 0).getTime();
    const br = new Date(b.received_at || b.created_at || 0).getTime();
    return ar - br;
  });
}

function allocateInventoryLotsFefo(lots, need) {
  const sorted = sortInventoryLotsFefo((lots || []).filter(l => (l.quantity_on_hand || 0) > 0));
  let remaining = Math.max(0, parseInt(need, 10) || 0);
  const plan = [];
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const qoh = lot.quantity_on_hand || 0;
    const take = Math.min(qoh, remaining);
    if (take <= 0) continue;
    plan.push({ lot_id: lot.id, quantity: take });
    remaining -= take;
  }
  return { plan, short: remaining };
}

function isInventoryLotsMissingError(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return err.code === '42P01' || err.code === 'PGRST205' || msg.includes('inventory_lots') || msg.includes('Could not find the table');
}

/**
 * Add a receipt layer (opening, restock, import, adjustment). No-op if table missing.
 */
window.addInventoryReceiptLot = async function (supabase, params) {
  const {
    orgId,
    inventoryId,
    quantity,
    unitCost,
    batchNumber,
    expiryDate,
    source,
    notes
  } = params || {};
  const q = parseInt(quantity, 10) || 0;
  if (q <= 0) return;
  const row = {
    organization_id: orgId,
    inventory_id: inventoryId,
    quantity_on_hand: q,
    batch_number: batchNumber || null,
    expiry_date: expiryDate || null,
    source: source || 'receipt',
    notes: notes || null,
    received_at: new Date().toISOString()
  };
  const uc = unitCost != null && unitCost !== '' ? parseFloat(unitCost) : null;
  if (uc != null && !isNaN(uc)) row.unit_cost = Math.round(uc * 10000) / 10000;
  const { error } = await supabase.from('inventory_lots').insert([row]);
  if (isInventoryLotsMissingError(error)) return;
  if (error) throw error;
};

async function ensureInventoryLotsCoverAggregate(supabase, inventory) {
  const { data: lots, error } = await supabase
    .from('inventory_lots')
    .select('quantity_on_hand')
    .eq('inventory_id', inventory.id);
  if (isInventoryLotsMissingError(error)) return false;
  if (error) throw error;
  const sum = (lots || []).reduce((s, l) => s + (l.quantity_on_hand || 0), 0);
  const cur = inventory.current_stock || 0;
  if (sum >= cur) return true;
  const gap = cur - sum;
  await window.addInventoryReceiptLot(supabase, {
    orgId: inventory.organization_id,
    inventoryId: inventory.id,
    quantity: gap,
    unitCost: inventory.cost_per_unit,
    batchNumber: inventory.batch_number,
    expiryDate: inventory.expiry_date,
    source: 'aggregate_sync',
    notes: 'Auto layer to match on-hand total'
  });
  return true;
}

async function consumeInventoryLotsForAdjustment(supabase, orgId, inventoryRow, qtyAbs) {
  const { data: lots, error } = await supabase
    .from('inventory_lots')
    .select('*')
    .eq('inventory_id', inventoryRow.id)
    .eq('organization_id', orgId)
    .gt('quantity_on_hand', 0);
  if (isInventoryLotsMissingError(error)) return null;
  if (error) throw error;
  const { plan, short } = allocateInventoryLotsFefo(lots, qtyAbs);
  if (short > 0) {
    throw new Error('Insufficient quantity in inventory lots for this reduction. Sync on-hand totals or add layers.');
  }
  for (const step of plan) {
    const lot = (lots || []).find(l => l.id === step.lot_id);
    if (!lot) throw new Error('Lot not found during adjustment');
    const newQoh = (lot.quantity_on_hand || 0) - step.quantity;
    const { error: uerr } = await supabase
      .from('inventory_lots')
      .update({ quantity_on_hand: newQoh, updated_at: new Date().toISOString() })
      .eq('id', step.lot_id);
    if (uerr) throw uerr;
    lot.quantity_on_hand = newQoh;
  }
  return plan;
}

async function legacyDispenseWithoutLots(supabase, orgId, inventory, dispensingData, dispensingRecord) {
  const { data, error } = await supabase.from('dispensing_records').insert([dispensingRecord]).select().single();
  if (error) throw error;
  const newStock = inventory.current_stock - dispensingData.quantity;
  let stockUpdate = { current_stock: newStock, last_dispensed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  let { error: stockErr } = await supabase.from('medication_inventory').update(stockUpdate).eq('id', inventory.id);
  if (stockErr && (stockErr.message?.includes('last_dispensed_at') || stockErr.code === '42703')) {
    stockUpdate = { current_stock: newStock, updated_at: new Date().toISOString() };
    stockErr = (await supabase.from('medication_inventory').update(stockUpdate).eq('id', inventory.id)).error;
  }
  if (stockErr) throw stockErr;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const txRow = {
    inventory_id: inventory.id,
    organization_id: orgId,
    transaction_type: 'dispense',
    quantity: -dispensingData.quantity,
    balance_after: newStock,
    prescription_id: dispensingData.prescription_id,
    performed_by_user_id: user.id || user.user_id,
    performed_by_username: user.username,
    notes: 'Dispensed for prescription ' + dispensingData.prescription_id
  };
  const { error: txErr } = await supabase.from('inventory_transactions').insert([txRow]);
  if (txErr) throw txErr;
  return data;
}

// Add medication to inventory (from prescription parameters)
window.addMedicationToInventory = async function(medicationData) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Check if medication already exists
    const { data: existing } = await supabase
      .from('medication_inventory')
      .select('id, current_stock, cost_per_unit, medication_name')
      .eq('organization_id', orgId)
      .eq('medication_name', medicationData.name)
      .eq('strength', medicationData.strength)
      .eq('form', medicationData.form)
      .maybeSingle();
    
    if (existing) {
      const addQty = medicationData.initial_stock || 0;
      const newStock = existing.current_stock + addQty;
      const receiptCost =
        medicationData.cost_per_unit != null
          ? parseFloat(medicationData.cost_per_unit)
          : medicationData.last_purchase_cost != null
            ? parseFloat(medicationData.last_purchase_cost)
            : null;
      let newAvgCost;
      if (addQty > 0 && receiptCost != null && !isNaN(receiptCost)) {
        newAvgCost = window.computeInventoryWeightedAverageCost(
          existing.current_stock,
          existing.cost_per_unit,
          addQty,
          receiptCost
        );
      } else if (addQty === 0 && receiptCost != null && !isNaN(receiptCost)) {
        newAvgCost = Math.round(receiptCost * 100) / 100;
      }
      const updatePayload = {
        current_stock: newStock,
        updated_at: new Date().toISOString()
      };
      if (addQty > 0) updatePayload.last_restocked_at = new Date().toISOString();
      if (newAvgCost !== undefined) {
        updatePayload.cost_per_unit = newAvgCost;
      }
      if (receiptCost != null && !isNaN(receiptCost)) {
        updatePayload.last_purchase_cost = Math.round(receiptCost * 100) / 100;
      }
      const optionalFields = ['batch_number', 'expiry_date', 'registration_number', 'manufacturer', 'brand_name', 'country_of_origin', 'prescription_only', 'controlled_substance', 'storage_conditions', 'sku', 'ndc', 'barcode', 'reorder_point', 'reorder_quantity', 'pack_size', 'unit_of_purchase', 'lead_time_days', 'shelf_location', 'warehouse_location', 'tax_exempt', 'therapeutic_category', 'atc_code', 'cold_chain', 'special_handling', 'selling_price_per_unit', 'unit_of_measure'];
      optionalFields.forEach(f => { if (medicationData[f] != null) updatePayload[f] = medicationData[f]; });
      const { data, error } = await supabase
        .from('medication_inventory')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      if (newAvgCost !== undefined && inventoryCostsDiffer(existing.cost_per_unit, newAvgCost)) {
        await window.recordInventoryCostPerUnitChange(
          supabase,
          orgId,
          existing.id,
          existing.medication_name || medicationData.name,
          existing.cost_per_unit,
          newAvgCost,
          {
            changedBy: user.username,
            changedByUserId: user.id || user.user_id,
            source: 'restock_wac',
            reason:
              addQty > 0 && receiptCost != null
                ? 'Restock ' + addQty + ' units @ receipt ' + receiptCost + ' (WAC)'
                : 'Cost update on restock'
          }
        );
      }
      if (addQty > 0 && typeof window.recordInventoryPurchaseTransaction === 'function') {
        await window.recordInventoryPurchaseTransaction(supabase, {
          inventoryId: existing.id,
          orgId,
          quantity: addQty,
          balanceAfter: newStock,
          unitCost: receiptCost,
          performedByUsername: user.username,
          performedByUserId: user.id || user.user_id,
          notes:
            'Restock' +
            (receiptCost != null ? ' · receipt unit cost ' + receiptCost : '') +
            (newAvgCost != null ? ' · WAC after ' + newAvgCost : '')
        });
      }
      if (addQty > 0) {
        await window.addInventoryReceiptLot(supabase, {
          orgId,
          inventoryId: existing.id,
          quantity: addQty,
          unitCost: receiptCost,
          batchNumber: medicationData.batch_number,
          expiryDate: medicationData.expiry_date,
          source: 'restock',
          notes: 'Restock receipt layer'
        });
      }
      if (addQty > 0 && typeof logAuditEvent === 'function') {
        await logAuditEvent('inventory_restocked', {
          inventory_id: existing.id,
          medication_name: medicationData.name,
          quantity_added: addQty,
          previous_stock: existing.current_stock,
          new_stock: newStock,
          performed_by: user.username
        });
      }
      return data;
    }
    
    // Create new inventory entry
    const inventoryEntry = {
      organization_id: orgId,
      medication_name: medicationData.name,
      generic_name: medicationData.generic_name || medicationData.name,
      strength: medicationData.strength,
      form: medicationData.form,
      route: medicationData.route || 'oral',
      current_stock: medicationData.initial_stock || 0,
      minimum_stock: medicationData.minimum_stock || 10,
      maximum_stock: medicationData.maximum_stock || 1000,
      unit_of_measure: medicationData.unit_of_measure || 'units',
      cost_per_unit: medicationData.cost_per_unit || null,
      selling_price_per_unit: medicationData.selling_price_per_unit || null,
      batch_number: medicationData.batch_number || null,
      expiry_date: medicationData.expiry_date || null,
      registration_number: medicationData.registration_number || null,
      manufacturer: medicationData.manufacturer || null,
      country_of_origin: medicationData.country_of_origin || null,
      prescription_only: medicationData.prescription_only || false,
      controlled_substance: medicationData.controlled_substance || null,
      storage_conditions: medicationData.storage_conditions || null,
      sku: medicationData.sku || null,
      ndc: medicationData.ndc || null,
      barcode: medicationData.barcode || null,
      reorder_point: medicationData.reorder_point ?? null,
      reorder_quantity: medicationData.reorder_quantity ?? null,
      pack_size: medicationData.pack_size ?? null,
      unit_of_purchase: medicationData.unit_of_purchase || null,
      lead_time_days: medicationData.lead_time_days ?? null,
      shelf_location: medicationData.shelf_location || null,
      warehouse_location: medicationData.warehouse_location || null,
      tax_exempt: medicationData.tax_exempt || false,
      last_purchase_cost: medicationData.cost_per_unit || medicationData.last_purchase_cost || null,
      therapeutic_category: medicationData.therapeutic_category || null,
      atc_code: medicationData.atc_code || null,
      cold_chain: medicationData.cold_chain || false,
      special_handling: medicationData.special_handling || null,
      created_by: user.username
    };
    
    const { data, error } = await supabase
      .from('medication_inventory')
      .insert([inventoryEntry])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Create initial transaction and set last_restocked_at if stock was added
    if (medicationData.initial_stock > 0) {
      const initCost =
        medicationData.cost_per_unit != null
          ? parseFloat(medicationData.cost_per_unit)
          : medicationData.last_purchase_cost != null
            ? parseFloat(medicationData.last_purchase_cost)
            : null;
      await window.recordInventoryPurchaseTransaction(supabase, {
        inventoryId: data.id,
        orgId,
        quantity: medicationData.initial_stock,
        balanceAfter: medicationData.initial_stock,
        unitCost: initCost != null && !isNaN(initCost) ? initCost : null,
        performedByUsername: user.username,
        performedByUserId: user.id || user.user_id,
        notes: 'Initial stock entry'
      });
      await window.addInventoryReceiptLot(supabase, {
        orgId,
        inventoryId: data.id,
        quantity: medicationData.initial_stock,
        unitCost: initCost != null && !isNaN(initCost) ? initCost : null,
        batchNumber: medicationData.batch_number,
        expiryDate: medicationData.expiry_date,
        source: 'initial',
        notes: 'Initial stock layer'
      });
      if (initCost != null && !isNaN(initCost) && inventoryCostsDiffer(null, initCost)) {
        await window.recordInventoryCostPerUnitChange(
          supabase,
          orgId,
          data.id,
          medicationData.name,
          null,
          initCost,
          { changedBy: user.username, changedByUserId: user.id || user.user_id, source: 'initial_stock' }
        );
      }
      await supabase.from('medication_inventory').update({
        last_restocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', data.id);
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      await logAuditEvent('medication_added_to_inventory', {
        medication_name: medicationData.name,
        strength: medicationData.strength,
        form: medicationData.form,
        initial_stock: medicationData.initial_stock || 0
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error adding medication to inventory:', error);
    throw error;
  }
};

// Get medication inventory
window.getMedicationInventory = async function() {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    
    const { data, error } = await supabase
      .from('medication_inventory')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('medication_name', { ascending: true });
    
    if (error) {
      // If table doesn't exist, return empty array (migration not run yet)
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        console.warn('⚠️ Medication inventory table not found. Migration may not have been run yet.');
        return [];
      }
      throw error;
    }
    
    return data || [];
  } catch (error) {
    // If table doesn't exist, return empty array
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('⚠️ Medication inventory table not found. Migration may not have been run yet.');
      return [];
    }
    console.error('Error fetching inventory:', error);
    throw error;
  }
};

// Get stock alerts
window.getStockAlerts = async function() {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    
    const { data, error } = await supabase
      .from('stock_alerts')
      .select(`
        *,
        medication_inventory (
          medication_name,
          strength,
          form,
          current_stock,
          minimum_stock
        )
      `)
      .eq('organization_id', orgId)
      .eq('is_resolved', false)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      // If table doesn't exist, return empty array (migration not run yet)
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        console.warn('⚠️ Stock alerts table not found. Migration may not have been run yet.');
        return [];
      }
      throw error;
    }
    
    return data || [];
  } catch (error) {
    // If table doesn't exist, return empty array
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('⚠️ Stock alerts table not found. Migration may not have been run yet.');
      return [];
    }
    console.error('Error fetching stock alerts:', error);
    throw error;
  }
};

// Dispense medication (create dispensing record)
window.dispenseMedication = async function(dispensingData) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const name = (dispensingData.medication_name || '').trim();
    const strength = (dispensingData.strength || '').trim();
    const form = (dispensingData.form || '').trim();
    
    // Parse combined "Name - Strength Form" when strength/form are empty
    let lookupName = name; let lookupStrength = strength; let lookupForm = form;
    if (!lookupStrength && !lookupForm && name.includes(' - ')) {
      const parts = name.split(' - ');
      if (parts.length >= 2) {
        lookupName = parts[0].trim();
        const rest = parts.slice(1).join(' - ').trim();
        const strengthMatch = rest.match(/^(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|iu|units?)(?:\s*\/\s*(?:ml|tablet|dose))?)\s+(.+)$/i);
        if (strengthMatch) {
          lookupStrength = strengthMatch[1].trim();
          lookupForm = strengthMatch[2].trim();
        }
      }
    }
    
    // Normalize for comparison (e.g. "5 mg" vs "5mg")
    const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
    
    // Find inventory item – use maybeSingle to avoid 406
    let { data: inventory, error: invError } = await supabase
      .from('medication_inventory')
      .select('*')
      .eq('organization_id', orgId)
      .eq('medication_name', lookupName)
      .eq('strength', lookupStrength)
      .eq('form', lookupForm)
      .maybeSingle();
    
    if (!inventory && !invError) {
      // Fallback: fetch org inventory and match by normalized keys
      const { data: rows } = await supabase
        .from('medication_inventory')
        .select('*')
        .eq('organization_id', orgId);
      const targetKey = [norm(lookupName), norm(lookupStrength), norm(lookupForm)].join('|');
      inventory = (rows || []).find(r =>
        [norm(r.medication_name), norm(r.strength || ''), norm(r.form || '')].join('|') === targetKey
      );
    }
    
    if (!inventory) {
      const displayName = [lookupName, lookupStrength, lookupForm].filter(Boolean).join(' - ');
      const err = new Error(`${displayName || 'Medication'} is not in inventory. Add it via Inventory → Add Medication, then try dispensing again.`);
      err.code = 'MEDICATION_NOT_IN_INVENTORY';
      err.medication = { name: lookupName, strength: lookupStrength, form: lookupForm };
      throw err;
    }
    
    if (inventory.current_stock < dispensingData.quantity) {
      throw new Error(`Insufficient stock. Available: ${inventory.current_stock}, Requested: ${dispensingData.quantity}`);
    }

    const needQty = dispensingData.quantity;
    const probe = await supabase.from('inventory_lots').select('id').limit(1);
    const lotsMissing = probe.error && isInventoryLotsMissingError(probe.error);

    let data;
    if (lotsMissing) {
      const batchNumber = dispensingData.batch_number || inventory.batch_number || null;
      const expiryDate = dispensingData.expiry_date || inventory.expiry_date || null;
      const dispensingRecord = {
        prescription_id: dispensingData.prescription_id,
        inventory_id: inventory.id,
        organization_id: orgId,
        patient_id: dispensingData.patient_id,
        medication_name: lookupName,
        strength: lookupStrength,
        form: lookupForm,
        quantity_dispensed: needQty,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        unit_price: dispensingData.unit_price || inventory.selling_price_per_unit || null,
        total_price: (dispensingData.unit_price || inventory.selling_price_per_unit || 0) * needQty,
        dispensed_by_user_id: user.id || user.user_id,
        dispensed_by_username: user.username,
        dispensing_notes: dispensingData.notes || null
      };
      data = await legacyDispenseWithoutLots(supabase, orgId, inventory, dispensingData, dispensingRecord);
    } else {
      if (probe.error) throw probe.error;
      await ensureInventoryLotsCoverAggregate(supabase, inventory);
      const { data: lotRows, error: lotErr } = await supabase
        .from('inventory_lots')
        .select('*')
        .eq('inventory_id', inventory.id)
        .gt('quantity_on_hand', 0);
      if (lotErr) throw lotErr;
      const { plan, short } = allocateInventoryLotsFefo(lotRows, needQty);
      if (short > 0) {
        throw new Error(
          `Insufficient stock in inventory layers (FEFO). Available in layers: ${needQty - short}, Requested: ${needQty}.`
        );
      }
      const firstLot = (lotRows || []).find(l => l.id === plan[0].lot_id);
      const batchNumber = firstLot?.batch_number || dispensingData.batch_number || inventory.batch_number || null;
      const expiryDate = firstLot?.expiry_date || dispensingData.expiry_date || inventory.expiry_date || null;
      const expiryStr = expiryDate ? String(expiryDate).slice(0, 10) : null;
      const dispensingPayload = {
        prescription_id: dispensingData.prescription_id,
        inventory_id: inventory.id,
        organization_id: orgId,
        patient_id: dispensingData.patient_id,
        medication_name: lookupName,
        strength: lookupStrength,
        form: lookupForm,
        quantity_dispensed: needQty,
        batch_number: batchNumber,
        expiry_date: expiryStr,
        unit_price: dispensingData.unit_price || inventory.selling_price_per_unit || null,
        total_price: (dispensingData.unit_price || inventory.selling_price_per_unit || 0) * needQty,
        dispensed_by_user_id: user.id || user.user_id,
        dispensed_by_username: user.username,
        dispensing_notes: dispensingData.notes || null
      };
      const { data: rpcData, error: rpcErr } = await supabase.rpc('apply_pharmacy_dispense', {
        p_payload: { dispensing: dispensingPayload, allocations: plan }
      });
      if (rpcErr) {
        if (rpcErr.code === '42883' || String(rpcErr.message || '').includes('apply_pharmacy_dispense')) {
          throw new Error(
            'Lot-based dispensing requires the apply_pharmacy_dispense database migration. Apply migration 20260417120000_pharmacy_inventory_lots_and_dispense_cogs.sql, then retry.'
          );
        }
        throw rpcErr;
      }
      const dispId = rpcData && rpcData.dispensing_record_id;
      const { data: insertedRow, error: fetchErr } = await supabase
        .from('dispensing_records')
        .select('*')
        .eq('id', dispId)
        .single();
      if (fetchErr) throw fetchErr;
      data = insertedRow;
    }

    if (typeof logAuditEvent === 'function') {
      const auditDetails = {
        prescription_id: dispensingData.prescription_id,
        medication_name: dispensingData.medication_name,
        quantity: dispensingData.quantity,
        pharmacist: user.username
      };
      if (inventory.controlled_substance) {
        auditDetails.controlled_substance = inventory.controlled_substance;
        auditDetails.controlled_substance_dispensed = true;
        auditDetails.patient_id = dispensingData.patient_id;
        auditDetails.batch_number = dispensingData.batch_number || inventory.batch_number;
      }
      await logAuditEvent('medication_dispensed', auditDetails);
    }

    return data;
  } catch (error) {
    console.error('Error dispensing medication:', error);
    throw error;
  }
};

// Update inventory stock manually
window.updateInventoryStock = async function(inventoryId, newStock, reason = 'Manual adjustment') {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  
  try {
    const supabase = await getPharmacySupabaseClient();
    const orgId = await getPharmacyOrgId();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const { data: inventory } = await supabase
      .from('medication_inventory')
      .select('id, organization_id, current_stock, medication_name, strength, form, cost_per_unit')
      .eq('id', inventoryId)
      .single();
    
    if (!inventory) {
      throw new Error('Inventory item not found');
    }
    
    const quantityChange = newStock - inventory.current_stock;

    if (quantityChange < 0) {
      await consumeInventoryLotsForAdjustment(supabase, orgId, inventory, Math.abs(quantityChange));
    } else if (quantityChange > 0) {
      await window.addInventoryReceiptLot(supabase, {
        orgId,
        inventoryId,
        quantity: quantityChange,
        unitCost: inventory.cost_per_unit,
        source: 'adjustment',
        notes: reason
      });
    }
    
    const stockUpdate = { current_stock: newStock, updated_at: new Date().toISOString() };
    if (quantityChange > 0) stockUpdate.last_restocked_at = new Date().toISOString();
    let { data, error } = await supabase.from('medication_inventory').update(stockUpdate).eq('id', inventoryId).select().single();
    if (error && (error.message?.includes('last_restocked_at') || error.code === '42703') && quantityChange > 0) {
      const fallback = { current_stock: newStock, updated_at: new Date().toISOString() };
      const res = await supabase.from('medication_inventory').update(fallback).eq('id', inventoryId).select().single();
      if (res.error) throw res.error;
      data = res.data;
    } else if (error) {
      throw error;
    }
    
    // Create transaction record
    await supabase
      .from('inventory_transactions')
      .insert([{
        inventory_id: inventoryId,
        organization_id: orgId,
        transaction_type: 'adjustment',
        quantity: quantityChange,
        balance_after: newStock,
        reason: reason,
        performed_by_user_id: user.id || user.user_id,
        performed_by_username: user.username,
        notes: reason
      }]);
    
    // Audit log: traceable inventory adjustment
    if (typeof logAuditEvent === 'function') {
      const medLabel = [inventory.medication_name, inventory.strength, inventory.form].filter(Boolean).join(' ');
      await logAuditEvent('inventory_adjusted', {
        inventory_id: inventoryId,
        medication_name: inventory.medication_name,
        medication_label: medLabel,
        previous_stock: inventory.current_stock,
        new_stock: newStock,
        quantity_change: quantityChange,
        reason: reason,
        performed_by: user.username
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error updating inventory stock:', error);
    throw error;
  }
};

// Update inventory batch number and expiry date
window.updateInventoryBatchExpiry = async function(inventoryId, batchNumber, expiryDate) {
  return window.updateInventoryDetails(inventoryId, { batch_number: batchNumber || null, expiry_date: expiryDate || null });
};

// Update inventory details (any optional fields)
// Price changes (cost/selling) are logged to inventory_price_history and audit_logs; effective from timestamp of change
window.updateInventoryDetails = async function(inventoryId, updates) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  const allowed = ['batch_number', 'expiry_date', 'registration_number', 'manufacturer', 'brand_name', 'country_of_origin', 'prescription_only', 'controlled_substance', 'storage_conditions', 'sku', 'ndc', 'barcode', 'reorder_point', 'reorder_quantity', 'pack_size', 'unit_of_purchase', 'lead_time_days', 'shelf_location', 'warehouse_location', 'tax_exempt', 'cost_per_unit', 'last_purchase_cost', 'therapeutic_category', 'atc_code', 'cold_chain', 'special_handling', 'selling_price_per_unit', 'price_unit', 'current_stock', 'unit_of_measure', 'on_purchase_order', 'on_sales_order'];
  const payload = { updated_at: new Date().toISOString() };
  Object.keys(updates || {}).forEach(k => {
    if (allowed.includes(k) && updates[k] !== undefined) payload[k] = updates[k];
  });
  if (Object.keys(payload).length <= 1) return { ok: true };
  try {
    const supabase = await getPharmacySupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = await getPharmacyOrgId();
    const effectiveFrom = new Date().toISOString();

    // Price changes: log to inventory_price_history and audit_logs (effective from now)
    const priceFields = ['cost_per_unit', 'selling_price_per_unit', 'price_unit'];
    const pricePayloadKeys = priceFields.filter(f => payload[f] !== undefined);
    if (pricePayloadKeys.length > 0) {
      const { data: current } = await supabase.from('medication_inventory').select('medication_name, cost_per_unit, selling_price_per_unit, price_unit').eq('id', inventoryId).single();
      const changes = [];
      for (const field of pricePayloadKeys) {
        const oldVal = current?.[field];
        const newVal = payload[field];
        if (oldVal !== newVal && (String(oldVal || '') !== String(newVal || ''))) {
          const isNumeric = field !== 'price_unit';
          const historyRow = {
            organization_id: orgId,
            inventory_id: inventoryId,
            field_changed: field,
            old_value: isNumeric ? (oldVal != null ? parseFloat(oldVal) : null) : null,
            new_value: isNumeric ? (newVal != null ? parseFloat(newVal) : null) : null,
            old_value_text: !isNumeric ? (oldVal || null) : null,
            new_value_text: !isNumeric ? (newVal || null) : null,
            effective_from: effectiveFrom,
            changed_by: user.username || 'unknown'
          };
          try {
            await supabase.from('inventory_price_history').insert([historyRow]);
          } catch (e) {
            if (e.code !== '42P01' && !e.message?.includes('does not exist')) console.warn('inventory_price_history insert failed:', e);
          }
          changes.push({ field, old_value: oldVal, new_value: newVal });
        }
      }
      if (changes.length > 0 && typeof logAuditEvent === 'function') {
        await logAuditEvent('inventory_price_changed', {
          inventory_id: inventoryId,
          medication_name: current?.medication_name,
          changes,
          effective_from: effectiveFrom,
          performed_by: user.username
        });
      }
    }

    const { error } = await supabase.from('medication_inventory').update(payload).eq('id', inventoryId);
    if (error) {
      if (error.code === '42703' || error.message?.includes('column')) {
        const fallback = { updated_at: payload.updated_at };
        if (payload.batch_number !== undefined) fallback.batch_number = payload.batch_number;
        if (payload.expiry_date !== undefined) fallback.expiry_date = payload.expiry_date;
        const { error: e2 } = await supabase.from('medication_inventory').update(fallback).eq('id', inventoryId);
        if (e2) throw e2;
      } else {
        throw error;
      }
    }
    if (typeof logAuditEvent === 'function') {
      const updatedFields = Object.keys(payload).filter(k => k !== 'updated_at');
      await logAuditEvent('inventory_details_updated', {
        inventory_id: inventoryId,
        updated_fields: updatedFields,
        performed_by: user.username
      });
    }
    return { ok: true };
  } catch (error) {
    console.error('Error updating inventory details:', error);
    throw error;
  }
};

/**
 * Weighted average unit cost after a purchase receipt.
 * addQty > 0 and addUnitCost set: blends existing pool with new receipt.
 * If no prior average (null) but receipt cost known: adopts receipt cost as average.
 * If receipt has no unit cost: returns prior average unchanged.
 */
window.computeInventoryWeightedAverageCost = function (oldQty, oldCostPerUnit, addQty, addUnitCost) {
  const oq = Math.max(0, parseInt(oldQty, 10) || 0);
  const aq = Math.max(0, parseInt(addQty, 10) || 0);
  const oc = oldCostPerUnit == null || oldCostPerUnit === '' ? null : parseFloat(oldCostPerUnit);
  const ac = addUnitCost == null || addUnitCost === '' ? null : parseFloat(addUnitCost);
  if (aq <= 0 || ac == null || isNaN(ac)) {
    return oc == null || isNaN(oc) ? null : Math.round(oc * 100) / 100;
  }
  if (oq <= 0 || oc == null || isNaN(oc)) {
    return Math.round(ac * 100) / 100;
  }
  const wac = (oq * oc + aq * ac) / (oq + aq);
  return Math.round(wac * 100) / 100;
};

function inventoryCostsDiffer(a, b) {
  const na = a == null || a === '' ? null : parseFloat(a);
  const nb = b == null || b === '' ? null : parseFloat(b);
  if (na == null && nb == null) return false;
  if (na == null || nb == null) return true;
  return Math.round(na * 100) !== Math.round(nb * 100);
}

/**
 * Append cost_per_unit change to inventory_price_history + audit_logs (same contract as manual price edits).
 */
window.recordInventoryCostPerUnitChange = async function (supabase, orgId, inventoryId, medicationName, oldCost, newCost, meta) {
  meta = meta || {};
  if (!inventoryCostsDiffer(oldCost, newCost)) return;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const effectiveFrom = new Date().toISOString();
  const oldVal = oldCost == null || oldCost === '' ? null : parseFloat(oldCost);
  const newVal = newCost == null || newCost === '' ? null : parseFloat(newCost);
  const changedBy = meta.changedBy || user.username || 'unknown';
  const historyRow = {
    organization_id: orgId,
    inventory_id: inventoryId,
    field_changed: 'cost_per_unit',
    old_value: oldVal,
    new_value: newVal,
    old_value_text: null,
    new_value_text: null,
    effective_from: effectiveFrom,
    changed_by: changedBy,
    changed_by_user_id: meta.changedByUserId || user.id || user.user_id || null
  };
  try {
    await supabase.from('inventory_price_history').insert([historyRow]);
  } catch (e) {
    if (e.code !== '42P01' && !String(e.message || '').includes('does not exist')) {
      console.warn('inventory_price_history insert failed:', e);
    }
  }
  if (typeof logAuditEvent === 'function') {
    await logAuditEvent('inventory_price_changed', {
      inventory_id: inventoryId,
      medication_name: medicationName,
      source: meta.source || 'costing',
      reason: meta.reason || null,
      changes: [{ field: 'cost_per_unit', old_value: oldVal, new_value: newVal }],
      effective_from: effectiveFrom,
      performed_by: changedBy
    });
  }
};

/**
 * Record a purchase movement; unit_cost / extended_cost when columns exist (post-migration).
 */
window.recordInventoryPurchaseTransaction = async function (supabase, params) {
  const {
    inventoryId,
    orgId,
    quantity,
    balanceAfter,
    unitCost,
    performedByUsername,
    performedByUserId,
    notes
  } = params;
  const q = parseInt(quantity, 10) || 0;
  const uc = unitCost != null && unitCost !== '' ? parseFloat(unitCost) : null;
  const row = {
    inventory_id: inventoryId,
    organization_id: orgId,
    transaction_type: 'purchase',
    quantity: q,
    balance_after: balanceAfter,
    performed_by_username: performedByUsername || null,
    performed_by_user_id: performedByUserId || null,
    notes: notes || null
  };
  if (uc != null && !isNaN(uc)) {
    row.unit_cost = Math.round(uc * 10000) / 10000;
    row.extended_cost = Math.round(q * uc * 100) / 100;
  }
  const { error } = await supabase.from('inventory_transactions').insert([row]);
  if (error && (error.code === '42703' || String(error.message || '').includes('unit_cost'))) {
    delete row.unit_cost;
    delete row.extended_cost;
    const { error: e2 } = await supabase.from('inventory_transactions').insert([row]);
    if (e2) throw e2;
  } else if (error) {
    throw error;
  }
};

// Update inventory price (editable by user)
window.updateInventoryPrice = async function(inventoryId, sellingPrice, priceUnit) {
  if (!isPharmacist()) throw new Error('Access denied: Pharmacist role required');
  const updates = { selling_price_per_unit: sellingPrice != null ? parseFloat(sellingPrice) : null };
  if (priceUnit !== undefined) updates.price_unit = priceUnit || null;
  return window.updateInventoryDetails(inventoryId, updates);
};

// Set inventory quantity to zero (user can "remove from stock" without deleting)
window.setInventoryQuantityToZero = async function(inventoryId) {
  if (!isPharmacist()) throw new Error('Access denied: Pharmacist role required');
  return window.updateInventoryStock(inventoryId, 0, 'Set quantity to zero');
};

// Delete/deactivate item from inventory (sets is_active = false)
window.deleteInventoryItem = async function(inventoryId) {
  if (!isPharmacist()) throw new Error('Access denied: Pharmacist role required');
  try {
    const supabase = await getPharmacySupabaseClient();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const { data: inv } = await supabase.from('medication_inventory').select('medication_name').eq('id', inventoryId).single();
    const { error } = await supabase.from('medication_inventory').update({
      is_active: false,
      updated_at: new Date().toISOString()
    }).eq('id', inventoryId);
    if (error) throw error;
    if (typeof logAuditEvent === 'function') {
      await logAuditEvent('inventory_item_deleted', {
        inventory_id: inventoryId,
        medication_name: inv?.medication_name,
        performed_by: user.username
      });
    }
    return { ok: true };
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw error;
  }
};

/**
 * Read-only audit trail for one inventory line: WAC/price history + purchase receipts.
 * Extensible: same inventory_id can later join inventory_lots without changing this API shape.
 */
window.getInventoryCostAuditTrail = async function (inventoryId) {
  if (!isPharmacist()) {
    throw new Error('Access denied: Pharmacist role required');
  }
  const supabase = await getPharmacySupabaseClient();
  const orgId = await getPharmacyOrgId();
  const id = String(inventoryId || '').trim();
  if (!id) throw new Error('inventoryId required');

  let priceHistory = [];
  let transactions = [];
  let lots = [];
  let priceErr = null;
  let txErr = null;
  let lotsErr = null;

  const phRes = await supabase
    .from('inventory_price_history')
    .select('id, field_changed, old_value, new_value, old_value_text, new_value_text, effective_from, changed_by, created_at')
    .eq('inventory_id', id)
    .eq('organization_id', orgId)
    .order('effective_from', { ascending: false })
    .limit(200);
  if (phRes.error) priceErr = phRes.error;
  else priceHistory = phRes.data || [];

  let txQuery = supabase
    .from('inventory_transactions')
    .select('id, transaction_type, quantity, balance_after, unit_cost, extended_cost, notes, reason, created_at, performed_by_username')
    .eq('inventory_id', id)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  const lotsRes = await supabase
    .from('inventory_lots')
    .select(
      'id, quantity_on_hand, unit_cost, batch_number, expiry_date, received_at, source, notes, created_at, updated_at'
    )
    .eq('inventory_id', id)
    .eq('organization_id', orgId)
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('received_at', { ascending: true })
    .limit(200);
  if (lotsRes.error) {
    if (isInventoryLotsMissingError(lotsRes.error)) lotsErr = null;
    else lotsErr = lotsRes.error;
  } else {
    lots = lotsRes.data || [];
  }

  const txRes = await txQuery;
  if (txRes.error) {
    const msg = String(txRes.error.message || '');
    if (txRes.error.code === '42703' || msg.includes('unit_cost')) {
      const txRes2 = await supabase
        .from('inventory_transactions')
        .select('id, transaction_type, quantity, balance_after, notes, reason, created_at, performed_by_username')
        .eq('inventory_id', id)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (txRes2.error) txErr = txRes2.error;
      else transactions = txRes2.data || [];
    } else {
      txErr = txRes.error;
    }
  } else {
    transactions = txRes.data || [];
  }

  const purchases = (transactions || []).filter(t => t.transaction_type === 'purchase');
  const otherMovements = (transactions || []).filter(t => t.transaction_type !== 'purchase');

  return {
    priceHistory,
    purchaseTransactions: purchases,
    otherTransactions: otherMovements,
    lots,
    errors: { priceHistory: priceErr, transactions: txErr, lots: lotsErr }
  };
};

// Expose for pharmacy-inventory-analytics and other modules
window.getPharmacyOrgId = getPharmacyOrgId;

