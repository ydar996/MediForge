// Purpose: Comprehensive prescription management system using Supabase
// Features: Drug database integration, validation, PDF generation, electronic signatures

// Supabase Configuration (use unique names to avoid clash with supabase-client.js)
const PRESCRIPTIONS_SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
const PRESCRIPTIONS_SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');

let supabase = null;

// Initialize Supabase client
function initSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(PRESCRIPTIONS_SUPABASE_URL, PRESCRIPTIONS_SUPABASE_ANON_KEY);
    console.log('✅ [PRESCRIPTIONS] Supabase client initialized');
    return true;
  }
  console.error('❌ [PRESCRIPTIONS] Supabase not available');
  return false;
}

// Get current user's organization ID
async function getCurrentOrgId() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (user.org && user.org.includes('-')) {
    return user.org;
  }
  
  if (!supabase) {
    if (!initSupabase()) return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', user.org)
      .single();
    
    if (error) {
      console.error('❌ [PRESCRIPTIONS] Error getting organization ID:', error);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('❌ [PRESCRIPTIONS] Exception getting organization ID:', error);
    return null;
  }
}

// Use DRUG_DATABASE from prescriptions.js (loads first). Avoid duplicate declaration.
const DRUG_DATABASE_REF = () => (typeof window !== 'undefined' && window.DRUG_DATABASE) || [];

// currentPrescription is declared in prescriptions.js (loads first) - do not redeclare

// Get all prescriptions for current organization
async function getAllPrescriptions() {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('❌ [PRESCRIPTIONS] Cannot get prescriptions - no organization');
    return [];
  }
  
  if (!supabase) {
    if (!initSupabase()) return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [PRESCRIPTIONS] Error fetching prescriptions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ [PRESCRIPTIONS] Exception fetching prescriptions:', error);
    return [];
  }
}

// Get prescription by ID
async function getPrescriptionById(prescriptionId) {
  if (!supabase) {
    if (!initSupabase()) return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('id', prescriptionId)
      .single();
    
    if (error) {
      console.error('❌ [PRESCRIPTIONS] Error fetching prescription:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('❌ [PRESCRIPTIONS] Exception fetching prescription:', error);
    return null;
  }
}

// Create new prescription
async function createPrescription(prescriptionData) {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('❌ [PRESCRIPTIONS] Cannot create prescription - no organization');
    return null;
  }
  
  if (!supabase) {
    if (!initSupabase()) return null;
  }
  
  try {
    const normalizedAdmissionId = (typeof window !== 'undefined' && window.normalizeAdmissionId)
      ? window.normalizeAdmissionId(prescriptionData.admissionId)
      : prescriptionData.admissionId;

    const prescriptionNumber = prescriptionData.prescriptionNumber != null && String(prescriptionData.prescriptionNumber).trim() !== ''
      ? String(prescriptionData.prescriptionNumber).trim()
      : (typeof window.generatePrescriptionNumber === 'function'
        ? await window.generatePrescriptionNumber()
        : null);
    const prescription = {
      organization_id: orgId,
      patient_id: prescriptionData.patientId,
      prescriber_id: prescriptionData.prescriberId,
      diagnosis: prescriptionData.diagnosis,
      medications: JSON.stringify(prescriptionData.medications),
      signature: prescriptionData.signature,
      signature_date: prescriptionData.signatureDate,
      status: prescriptionData.status || 'draft',
      created_by: getCurrentUsername(),
      created_at: new Date().toISOString(),
      admission_id: normalizedAdmissionId || null,
      prescription_number: prescriptionNumber
    };
    
    // NEW: If prescription is signed, check in-house pharmacy setting
    // If in-house pharmacy is enabled, send to pharmacy dashboard
    // Otherwise, prescription can be downloaded/printed for external pharmacy
    if (prescriptionData.status === 'signed') {
      // Check in-house pharmacy setting
      let inHousePharmacy = false;
      try {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', orgId)
          .maybeSingle();
        
        if (!orgError && orgData && orgData.settings) {
          inHousePharmacy = orgData.settings.in_house_pharmacy === true;
        }
      } catch (error) {
        console.warn('Could not check in-house pharmacy setting:', error);
      }
      
      // Only set pharmacy_status if in-house pharmacy is enabled
      if (inHousePharmacy) {
        prescription.pharmacy_status = 'pending';
        prescription.sent_to_pharmacy_at = new Date().toISOString();
      } else {
        // External pharmacy - prescription can be downloaded/printed
        prescription.pharmacy_status = 'external';
      }
    }
    
    const { data, error } = await supabase
      .from('prescriptions')
      .insert([prescription])
      .select()
      .single();
    
    if (error) {
      console.error('❌ [PRESCRIPTIONS] Error creating prescription:', error);
      return null;
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('prescription_created', {
        prescriptionId: data.id,
        patientId: data.patient_id,
        prescriberId: data.prescriber_id
      });
    }
    
    console.log('✅ [PRESCRIPTIONS] Prescription created:', data.id);
    return data;
  } catch (error) {
    console.error('❌ [PRESCRIPTIONS] Exception creating prescription:', error);
    return null;
  }
}

// Update prescription
async function updatePrescription(prescriptionId, updates) {
  if (!supabase) {
    if (!initSupabase()) return null;
  }
  
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: getCurrentUsername()
    };
    
    const { data, error } = await supabase
      .from('prescriptions')
      .update(updateData)
      .eq('id', prescriptionId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [PRESCRIPTIONS] Error updating prescription:', error);
      return null;
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('prescription_updated', {
        prescriptionId: data.id,
        patientId: data.patient_id
      });
    }
    
    console.log('✅ [PRESCRIPTIONS] Prescription updated:', data.id);
    return data;
  } catch (error) {
    console.error('❌ [PRESCRIPTIONS] Exception updating prescription:', error);
    return null;
  }
}

// Delete prescription
async function deletePrescription(prescriptionId) {
  if (!supabase) {
    if (!initSupabase()) return false;
  }
  
  try {
    // Get prescription info for audit log
    const prescription = await getPrescriptionById(prescriptionId);
    
    const { error } = await supabase
      .from('prescriptions')
      .delete()
      .eq('id', prescriptionId);
    
    if (error) {
      console.error('❌ [PRESCRIPTIONS] Error deleting prescription:', error);
      return false;
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function' && prescription) {
      logAuditEvent('prescription_deleted', {
        prescriptionId: prescription.id,
        patientId: prescription.patient_id
      });
    }
    
    console.log('✅ [PRESCRIPTIONS] Prescription deleted:', prescriptionId);
    return true;
  } catch (error) {
    console.error('❌ [PRESCRIPTIONS] Exception deleting prescription:', error);
    return false;
  }
}

// Search drugs in database
function searchDrugs(query) {
  const db = DRUG_DATABASE_REF();
  const searchTerm = query.toLowerCase();
  return db.filter(drug => 
    drug.name.toLowerCase().includes(searchTerm) ||
    drug.generic.toLowerCase().includes(searchTerm) ||
    drug.category.toLowerCase().includes(searchTerm)
  );
}

// Get drug by name
function getDrugByName(name) {
  return DRUG_DATABASE_REF().find(drug => 
    drug.name.toLowerCase() === name.toLowerCase() ||
    drug.generic.toLowerCase() === name.toLowerCase()
  );
}

// Validate drug interactions
function checkDrugInteractions(medications) {
  const interactions = [];
  const drugNames = medications.map(med => med.drug);
  
  medications.forEach(med => {
    const drug = getDrugByName(med.drug);
    if (drug && drug.interactions) {
      drug.interactions.forEach(interaction => {
        if (drugNames.includes(interaction)) {
          interactions.push({
            drug1: med.drug,
            drug2: interaction,
            type: 'interaction'
          });
        }
      });
    }
  });
  
  return interactions;
}

// Get current username
function getCurrentUsername() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.username || 'Unknown';
}

// Export functions for global use
window.getAllPrescriptions = getAllPrescriptions;
window.getPrescriptionById = getPrescriptionById;
window.createPrescription = createPrescription;
window.updatePrescription = updatePrescription;
window.deletePrescription = deletePrescription;
window.searchDrugs = searchDrugs;
window.getDrugByName = getDrugByName;
window.checkDrugInteractions = checkDrugInteractions;

// Initialize on load
console.log('✅ [PRESCRIPTIONS] Supabase prescriptions module loaded');


