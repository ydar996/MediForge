// Purpose: Comprehensive prescription management system
// Features: Drug database integration, validation, PDF generation, electronic signatures

// Helper function to get organization-specific data key
function getDataKey(key) {
  const user = JSON.parse(localStorage.getItem("user"));
  return user && user.org ? `${user.org}_${key}` : key;
}

// Generate organization-specific prescription number (e.g. MEC-RX-0001 for Mecure Clinics)
// Format: {ORG_PREFIX}-RX-{SEQUENTIAL_NUMBER} - flows chronologically per organization
// Duplicate prefixes (e.g. two "Mecure" orgs) get MEC, MEC1, MEC2, etc. to avoid unique constraint
window.generatePrescriptionNumber = async function() {
  try {
    const supabase = window.supabaseClient || (typeof window.getSupabaseClient === 'function' ? await window.getSupabaseClient() : null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let orgId = user.organizationId || user.organization_id;
    if (!orgId && user.org) {
      if (user.org.includes('-') && user.org.length === 36) orgId = user.org;
      else if (supabase) {
        const { data } = await supabase.from('users').select('organization_id').eq('username', user.username).maybeSingle();
        if (data?.organization_id) orgId = data.organization_id;
      }
    }
    let basePrefix = 'ORG';
    try {
      const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
      const orgData = Object.values(organizations).find(o => o.id === orgId);
      if (orgData?.name) basePrefix = orgData.name.substring(0, 3).toUpperCase();
    } catch (_) {}
    if (supabase && orgId) {
      const { data: org } = await supabase.from('organizations').select('name, org_code, settings').eq('id', orgId).maybeSingle();
      if (org?.settings && typeof org.settings === 'object' && org.settings.patient_id_prefix) {
        const raw = String(org.settings.patient_id_prefix).trim().toUpperCase();
        const firstSeg = raw.split(/[-_\s]+/).filter(Boolean)[0] || raw;
        basePrefix = firstSeg.replace(/[^A-Z0-9]/g, '').slice(0, 8) || basePrefix;
      } else if (org?.org_code) {
        basePrefix = String(org.org_code).split(/[-_]/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || basePrefix;
      } else if (org?.name) {
        basePrefix = org.name.substring(0, 3).toUpperCase();
      }
    }
    if (!supabase || !orgId) return basePrefix + '-RX-0001';
    function effectiveRxPrefix(o) {
      const st = o.settings && o.settings.patient_id_prefix;
      if (st) {
        const raw = String(st).trim().toUpperCase();
        const seg = raw.split(/[-_\s]+/).filter(Boolean)[0] || raw;
        const p = seg.replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (p) return p;
      }
      if (o.org_code) {
        const p = String(o.org_code).split(/[-_]/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (p) return p;
      }
      return (o.name || '').substring(0, 3).toUpperCase();
    }
    const { data: allOrgs } = await supabase.from('organizations').select('id, name, org_code, settings').order('id');
    const samePrefixOrgs = (allOrgs || []).filter(o => effectiveRxPrefix(o) === basePrefix);
    const orgRank = samePrefixOrgs.findIndex(o => o.id === orgId);
    const displayPrefix = orgRank <= 0 ? basePrefix : basePrefix + orgRank;
    const { data: rows, error } = await supabase
      .from('prescriptions')
      .select('prescription_number')
      .eq('organization_id', orgId)
      .not('prescription_number', 'is', null)
      .order('prescription_number', { ascending: false })
      .limit(500);
    if (error) return displayPrefix + '-RX-0001';
    const re = new RegExp('^' + displayPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-RX-(\\d+)$');
    let maxN = 0;
    (rows || []).forEach(r => {
      const m = (r.prescription_number || '').match(re);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    });
    return displayPrefix + '-RX-' + (maxN + 1).toString().padStart(4, '0');
  } catch (e) {
    console.warn('generatePrescriptionNumber failed:', e);
    return 'ORG-RX-0001';
  }
};

/** Org mnemonic (e.g. MFA-RX-0001) from any record shape. */
window.getPrescriptionMnemonic = function getPrescriptionMnemonic(p) {
  if (!p || typeof p !== 'object') return '';
  const v = p.prescription_number != null ? p.prescription_number : p.prescriptionNumber;
  if (v == null) return '';
  const s = String(v).trim();
  return s;
};

/** Keep snake_case + camelCase in sync so UI code paths always see the mnemonic. */
window.normalizePrescriptionRecord = function normalizePrescriptionRecord(p) {
  if (!p || typeof p !== 'object') return p;
  const m = window.getPrescriptionMnemonic(p);
  if (m) {
    p.prescription_number = m;
    p.prescriptionNumber = m;
  }
  return p;
};

function _prescriptionRowIdIsUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || '').trim());
}

/** UUID primary key for public.prescriptions (id may be legacy RX… on embedded copies). */
function _prescriptionRowUuidForHydrate(pr) {
  if (!pr || typeof pr !== 'object') return '';
  for (const c of [pr._supabaseId, pr.id]) {
    const s = String(c || '').trim();
    if (_prescriptionRowIdIsUuid(s)) return s;
  }
  return '';
}

function _prescriptionNeedsMnemonicHydration(pr) {
  const m = typeof window.getPrescriptionMnemonic === 'function' ? window.getPrescriptionMnemonic(pr) : '';
  return !(m && String(m).trim());
}

window.getPrescriptionSupabaseRowUuid = function getPrescriptionSupabaseRowUuid(p) {
  return _prescriptionRowUuidForHydrate(p);
};

function _normalizePrescriptionRecordIdKey(id) {
  return String(id || '').trim().toLowerCase();
}

/**
 * Root fix: embedded patient.prescriptions often lack prescription_number even when public.prescriptions has it.
 * Batch-fetch mnemonics for UUID rows missing the field (RLS must allow SELECT).
 */
window.hydratePrescriptionMnemonicsFromSupabase = async function hydratePrescriptionMnemonicsFromSupabase(prescriptions, retryCount = 0) {
  if (!Array.isArray(prescriptions) || prescriptions.length === 0) return prescriptions;
  let client = null;
  if (typeof window.getSupabaseClient === 'function') {
    try {
      client = await window.getSupabaseClient();
    } catch (_) {
      client = null;
    }
  }
  if (!client) client = window.supabaseClient;
  if (!client) {
    if (retryCount < 6) {
      await new Promise(r => setTimeout(r, 350 + retryCount * 150));
      return hydratePrescriptionMnemonicsFromSupabase(prescriptions, retryCount + 1);
    }
    return prescriptions;
  }

  const need = prescriptions.filter(pr => {
    const rowId = _prescriptionRowUuidForHydrate(pr);
    return pr && rowId && _prescriptionNeedsMnemonicHydration(pr);
  });
  if (need.length === 0) return prescriptions;

  const ids = [...new Set(need.map(pr => _prescriptionRowUuidForHydrate(pr)).filter(Boolean))];
  const map = new Map();
  const chunkSize = 80;
  try {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      const { data, error } = await client.from('prescriptions').select('id, prescription_number').in('id', slice);
      if (error) {
        console.warn('hydratePrescriptionMnemonicsFromSupabase batch:', error);
        continue;
      }
      (data || []).forEach(row => {
        if (row && row.id != null && row.prescription_number != null && String(row.prescription_number).trim() !== '') {
          const k = _normalizePrescriptionRecordIdKey(row.id);
          map.set(k, String(row.prescription_number).trim());
        }
      });
    }
  } catch (e) {
    console.warn('hydratePrescriptionMnemonicsFromSupabase exception:', e);
  }

  for (const pr of prescriptions) {
    const rowId = _prescriptionRowUuidForHydrate(pr);
    if (!pr || !rowId) continue;
    const k = _normalizePrescriptionRecordIdKey(rowId);
    const num = map.get(k);
    if (num) {
      pr.prescription_number = num;
      pr.prescriptionNumber = num;
    }
  }

  const stillNeed = prescriptions.filter(pr => {
    const rowId = _prescriptionRowUuidForHydrate(pr);
    return pr && rowId && _prescriptionNeedsMnemonicHydration(pr);
  });
  for (const pr of stillNeed) {
    const rowId = _prescriptionRowUuidForHydrate(pr);
    if (!rowId) continue;
    try {
      const { data: row, error } = await client
        .from('prescriptions')
        .select('prescription_number')
        .eq('id', rowId)
        .maybeSingle();
      if (error) {
        console.warn('hydratePrescriptionMnemonicsFromSupabase single:', error);
        continue;
      }
      if (row && row.prescription_number != null && String(row.prescription_number).trim() !== '') {
        const num = String(row.prescription_number).trim();
        pr.prescription_number = num;
        pr.prescriptionNumber = num;
      }
    } catch (e) {
      console.warn('hydratePrescriptionMnemonicsFromSupabase single exception:', e);
    }
  }

  const stillNull = prescriptions.filter(pr => {
    const rowId = _prescriptionRowUuidForHydrate(pr);
    return pr && rowId && _prescriptionNeedsMnemonicHydration(pr);
  });
  if (stillNull.length > 0 && typeof window.generatePrescriptionNumber === 'function') {
  for (const pr of stillNull) {
    const rowId = _prescriptionRowUuidForHydrate(pr);
    if (!rowId) continue;
    let assigned = '';
    for (let attempt = 0; attempt < 2 && !assigned; attempt++) {
      try {
        const num = await window.generatePrescriptionNumber();
        // Do NOT use .maybeSingle() on PATCH: PostgREST returns 406 when 0 rows match but client expects one object.
        let { data: updRows, error: upErr } = await client
          .from('prescriptions')
          .update({ prescription_number: num })
          .eq('id', rowId)
          .is('prescription_number', null)
          .select('prescription_number');
        if (!upErr && Array.isArray(updRows) && updRows[0] && String(updRows[0].prescription_number || '').trim() !== '') {
          assigned = String(updRows[0].prescription_number).trim();
          break;
        }
        if (upErr) {
          if (upErr.code === '23505') continue;
          if (upErr.code !== 'PGRST116') {
            console.warn('hydratePrescriptionMnemonicsFromSupabase assign (null):', upErr);
          }
        }
        // Retry for empty string in DB (not matched by .is(null))
        ({ data: updRows, error: upErr } = await client
          .from('prescriptions')
          .update({ prescription_number: num })
          .eq('id', rowId)
          .eq('prescription_number', '')
          .select('prescription_number'));
        if (!upErr && Array.isArray(updRows) && updRows[0] && String(updRows[0].prescription_number || '').trim() !== '') {
          assigned = String(updRows[0].prescription_number).trim();
          break;
        }
        if (upErr) {
          if (upErr.code === '23505') continue;
          if (upErr.code !== 'PGRST116') {
            console.warn('hydratePrescriptionMnemonicsFromSupabase assign (empty):', upErr);
          }
        }
        const { data: again } = await client
          .from('prescriptions')
          .select('prescription_number')
          .eq('id', rowId)
          .maybeSingle();
        if (again && again.prescription_number != null && String(again.prescription_number).trim() !== '') {
          assigned = String(again.prescription_number).trim();
          break;
        }
      } catch (e) {
        console.warn('hydratePrescriptionMnemonicsFromSupabase assign exception:', e);
        break;
      }
    }
    if (assigned) {
      pr.prescription_number = assigned;
      pr.prescriptionNumber = assigned;
    }
  }
  }

  return prescriptions;
};

/** Human-friendly label for tables and headers (full DB id in getPrescriptionDisplayTitle). */
window.getPrescriptionDisplayLabel = function getPrescriptionDisplayLabel(prescription) {
  if (!prescription) return '';
  const num = window.getPrescriptionMnemonic(prescription);
  if (num !== '') return num;
  const rowUuid =
    typeof window.getPrescriptionSupabaseRowUuid === 'function'
      ? window.getPrescriptionSupabaseRowUuid(prescription)
      : '';
  const id = rowUuid || prescription.id;
  if (id == null) return '';
  const s = String(id).trim();
  if (/^[A-Za-z0-9]+-RX-\d+$/i.test(s)) return s;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return s.slice(0, 8) + '…';
  }
  if (/^RX\d{12,}$/.test(s)) return 'RX…' + s.slice(-6);
  if (s.length > 22) return s.slice(0, 14) + '…';
  return s;
};

window.getPrescriptionDisplayTitle = function getPrescriptionDisplayTitle(prescription) {
  if (!prescription) return '';
  const parts = [];
  const num = window.getPrescriptionMnemonic(prescription);
  if (num) parts.push('Rx #: ' + num);
  if (prescription.id != null && String(prescription.id) !== '') parts.push('Record ID: ' + prescription.id);
  return parts.join('\n');
};

// Clinic-added custom medications only. Prescribing/search uses Health Canada DPD (js/canadian-formulary.js).
// Legacy WHO / African seed list archived in data/archive/legacy-drug-database-who.js (not loaded).
const DRUG_DATABASE = [];

const MEDICATION_FORM_OPTIONS = [
  'Capsule', 'Caplet', 'Chewable', 'Cream', 'Drops', 'Gel', 'Inhaler', 'Injection',
  'Liquid', 'Lozenge', 'Ointment', 'Patch', 'Powder', 'Softgel', 'Spray', 'Suppository', 'Tablet', 'Topical'
];

const MEDICATION_CATEGORY_OPTIONS = [
  'Human', 'Prescription', 'OTC', 'Veterinary', 'Disinfectant', 'Schedule F', 'Schedule G'
];

function lookupDrugByName(name) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  const custom = (DRUG_DATABASE || []).find((d) => (d.name || '').toLowerCase() === n);
  if (custom) return custom;
  if (typeof window.isCanadianFormularyReady === 'function' &&
      window.isCanadianFormularyReady() &&
      typeof window.searchCanadianDrugs === 'function') {
    const hits = window.searchCanadianDrugs(name, 8);
    return hits.find((d) => (d.name || '').toLowerCase() === n) ||
      hits.find((d) => (d.generic || '').toLowerCase() === n) ||
      hits[0] ||
      null;
  }
  return null;
}

// Global variables
let currentPrescription = {
  id: '',
  date: '',
  prescriber: {},
  patient: {},
  medications: [],
  diagnosis: '',
  signature: null,
  signatureDate: '',
  status: 'draft'
};

let medicationCounter = 0;
let isDrawing = false;
let signatureCanvas = null;
let signatureContext = null;

// Initialize prescription form
async function initializePrescriptionForm() {
  console.log('Initializing prescription form...');
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('patientId');
  const visitDate = urlParams.get('visitDate');
  const encounterId = urlParams.get('encounterId');
  const encounterDate = urlParams.get('encounterDate');
  const editId = urlParams.get('editId');
  
  if (!patientId) {
    console.error('Patient ID is required. Please access this page from a patient record.');
    // Show error message in the page instead of alert
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 15px; border-radius: 5px; z-index: 10000; max-width: 300px;';
    errorDiv.innerHTML = '<strong>Error:</strong> Patient ID is required. Please access this page from a patient record.<br><button onclick="window.location.href=\'/patients\'" style="margin-top: 10px; padding: 5px 10px;">Go to Patients</button>';
    document.body.appendChild(errorDiv);
    return;
  }
  
  // Load patient data (await since it's async)
  await loadPatientData(patientId);
  
  // Load prescriber data
  loadPrescriberData();
  
  // Store encounter information if available
  if (encounterId && encounterDate) {
    currentPrescription.encounterId = encounterId;
    currentPrescription.encounterDate = encounterDate;
    console.log('Prescription linked to encounter:', encounterId, 'on', encounterDate);
  }
  
  // Initialize signature canvas
  initializeSignatureCanvas();
  
  // Set current date
  document.getElementById('prescription-date').value = new Date().toISOString().split('T')[0];

  // Diagnosis ICD search is handled by createIcdSelector() in prescription.html (full ICD-10-CA index).
  
  // Generate prescription ID
  generatePrescriptionId();
  
  // Handle edit mode
  if (editId) {
    console.log('Edit mode detected, loading prescription:', editId);
    loadPrescriptionForEdit(editId);
  } else {
    // Add first medication only for new prescriptions
    addMedication();
  }
  
  console.log('Prescription form initialized successfully');
  if (typeof window.loadCanadianFormulary === 'function') {
    window.loadCanadianFormulary()
      .then((n) => console.log('Canadian DPD formulary ready:', n, 'products'))
      .catch((err) => console.warn('Canadian formulary unavailable, using fallback list:', err.message));
  }
}

// Load prescription data for editing
function loadPrescriptionForEdit(prescriptionId) {
  console.log('Loading prescription for edit:', prescriptionId);
  
  // First, try to load from temporary storage (for new window approach)
  let prescription = null;
  const editingPrescriptionData = localStorage.getItem('_editingPrescription');
  if (editingPrescriptionData) {
    try {
      prescription = JSON.parse(editingPrescriptionData);
      console.log('Found prescription in temporary storage:', prescription);
      // Clean up temporary storage
      localStorage.removeItem('_editingPrescription');
    } catch (e) {
      console.error('Error parsing temporary prescription data:', e);
    }
  }
  
  // If not in temporary storage, try old storage location
  if (!prescription) {
    const prescriptions = JSON.parse(localStorage.getItem(getDataKey("prescriptions")) || "[]");
    prescription = prescriptions.find(
      p =>
        p.id === prescriptionId ||
        p._supabaseId === prescriptionId ||
        p.prescription_number === prescriptionId ||
        p.prescriptionNumber === prescriptionId
    );
  }
  
  // If still not found, try patient's prescriptions array
  if (!prescription) {
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('patientId');
    if (patientId) {
      const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      const patient = patients.find(p => p.id === patientId || p.patient_id === patientId || p._supabaseUuid === patientId);
      if (patient && patient.prescriptions) {
        prescription = patient.prescriptions.find(
          p =>
            p.id === prescriptionId ||
            p._supabaseId === prescriptionId ||
            p.prescription_number === prescriptionId ||
            p.prescriptionNumber === prescriptionId
        );
      }
    }
  }
  
  if (!prescription) {
    console.error('Prescription not found:', prescriptionId);
    alert('Prescription not found. Please try again.');
    return;
  }

  if (typeof window.normalizePrescriptionRecord === 'function') {
    window.normalizePrescriptionRecord(prescription);
  }

  const displayLabel =
    typeof window.getPrescriptionDisplayLabel === 'function'
      ? window.getPrescriptionDisplayLabel(prescription)
      : (window.getPrescriptionMnemonic(prescription) || prescriptionId);

  console.log('Found prescription for edit:', prescription);
  
  // Update the page title to indicate edit mode
  document.title = `Edit Prescription - ${displayLabel}`;
  
  // Update the form header
  const formHeader = document.querySelector('h2');
  if (formHeader) {
    formHeader.textContent = `✏️ Edit Prescription - ${displayLabel}`;
    formHeader.style.color = '#ffc107';
  }
  
  // Update the save button text and styling
  const saveButton = document.querySelector('button[onclick="savePrescription()"]');
  if (saveButton) {
    saveButton.textContent = '💾 Update Prescription';
    saveButton.style.backgroundColor = '#ffc107';
    saveButton.style.color = '#000';
    saveButton.style.fontWeight = 'bold';
    saveButton.classList.add('btn-update');
  }
  
  // Update the clear button text and styling
  const clearButton = document.querySelector('button[onclick="clearPrescriptionForm()"]');
  if (clearButton) {
    clearButton.textContent = '🔄 Reset to Original';
    clearButton.style.backgroundColor = '#6c757d';
    clearButton.style.color = '#fff';
  }
  
  // Load prescription data into form fields
  currentPrescription = { ...prescription };
  if (typeof window.normalizePrescriptionRecord === 'function') {
    window.normalizePrescriptionRecord(currentPrescription);
  }

  const pidField = document.getElementById('prescription-id');
  if (pidField) {
    pidField.value =
      window.getPrescriptionMnemonic(currentPrescription) || String(currentPrescription.id || '');
  }
  
  // Set basic prescription information
  const prescriptionDateField = document.getElementById('prescription-date');
  if (prescriptionDateField && prescription.date) {
    prescriptionDateField.value = prescription.date.split('T')[0]; // Convert to YYYY-MM-DD format
  }
  
  // Try both possible field IDs
  const diagnosisField = document.getElementById('diagnosis') || document.getElementById('prescription-diagnosis');
  if (diagnosisField && prescription.diagnosis) {
    diagnosisField.value = prescription.diagnosis;
  }
  
  // Clear existing medications
  const medicationsContainer = document.getElementById('medications-container');
  if (medicationsContainer) {
    medicationsContainer.innerHTML = '';
  }
  medicationCounter = 0;
  
  // Load medications
  if (prescription.medications && prescription.medications.length > 0) {
    prescription.medications.forEach((medication, index) => {
      addMedication();
      
      const currentCounter = medicationCounter;
      
      // Populate medication fields
      const nameField = document.getElementById(`med-name-${currentCounter}`);
      if (nameField) nameField.value = medication.name || '';
      
      const strengthField = document.getElementById(`med-strength-${currentCounter}`);
      if (strengthField) strengthField.value = medication.strength || '';
      
      const formField = document.getElementById(`med-form-${currentCounter}`);
      if (formField) formField.value = medication.form || '';
      
      const routeField = document.getElementById(`med-route-${currentCounter}`);
      if (routeField) routeField.value = medication.route || '';
      
      const quantityField = document.getElementById(`med-quantity-${currentCounter}`);
      if (quantityField) quantityField.value = medication.quantity || '';
      
      const durationField = document.getElementById(`med-duration-${currentCounter}`);
      if (durationField) durationField.value = medication.duration || '';
      
      const refillsField = document.getElementById(`med-refills-${currentCounter}`);
      if (refillsField) refillsField.value = medication.refills || '';
      
      const directionsField = document.getElementById(`med-directions-${currentCounter}`);
      const directionsCustomField = document.getElementById(`med-directions-custom-${currentCounter}`);
      
      if (directionsField && medication.directions) {
        // Check if this is a custom instruction (not in the default options)
        const defaultOptions = [
          'Take 1 tablet once daily',
          'Take 1 tablet twice daily',
          'Take 1 tablet three times daily',
          'Take 2 tablets once daily',
          'Take 2 tablets twice daily',
          'Take 2 tablets three times daily',
          'Take with food',
          'Take on empty stomach',
          'Apply once daily to affected area',
          'Apply twice daily to affected area',
          'Take as directed by your doctor',
          'Use before bedtime'
        ];
        
        if (defaultOptions.includes(medication.directions)) {
          directionsField.value = medication.directions;
        } else {
          // Custom instruction
          directionsField.value = 'CUSTOM';
          if (directionsCustomField) {
            directionsCustomField.value = medication.directions;
            directionsCustomField.style.display = 'block';
            directionsCustomField.required = true;
          }
        }
      }
      
      const warningsField = document.getElementById(`med-warnings-${currentCounter}`);
      if (warningsField) warningsField.value = medication.warnings || '';
      
      console.log(`Loaded medication ${index + 1}:`, medication);
    });
  } else {
    // Add one empty medication if none exist
    addMedication();
  }
  
  // Load signature if it exists
  if (prescription.signature) {
    const signatureCanvas = document.getElementById('signature-canvas');
    if (signatureCanvas) {
      const ctx = signatureCanvas.getContext('2d');
      const img = new Image();
      img.onload = function() {
        ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        ctx.drawImage(img, 0, 0, signatureCanvas.width, signatureCanvas.height);
      };
      img.src = prescription.signature;
    }
    
    // Show signature canvas and hide the "Click to sign" button
    const signaturePad = document.getElementById('signature-pad');
    if (signaturePad) {
      signaturePad.style.display = 'none';
    }
    if (signatureCanvas) {
      signatureCanvas.style.display = 'block';
    }
  }
  
  // Set signature date if it exists
  const signatureDateField = document.getElementById('signature-date');
  if (signatureDateField && prescription.signatureDate) {
    // Convert ISO string to datetime-local format
    const date = new Date(prescription.signatureDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    signatureDateField.value = `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  (function hydrateEditMnemonic() {
    if (typeof window.hydratePrescriptionMnemonicsFromSupabase !== 'function') return;
    window.hydratePrescriptionMnemonicsFromSupabase([currentPrescription]).then(() => {
      if (typeof window.normalizePrescriptionRecord === 'function') {
        window.normalizePrescriptionRecord(currentPrescription);
      }
      const pf = document.getElementById('prescription-id');
      if (pf) {
        pf.value =
          window.getPrescriptionMnemonic(currentPrescription) || String(currentPrescription.id || '');
      }
    });
  })();

  console.log('Prescription loaded for editing successfully');
}

// Load patient data (now uses resolvePatientByIdentifier to handle UUIDs and display IDs)
async function loadPatientData(patientId) {
  console.log('🔍 loadPatientData: Starting...');
  console.log('🔍 loadPatientData: patientId:', patientId);
  
  // Use resolvePatientByIdentifier if available (handles UUID and display IDs)
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    console.log('🔍 loadPatientData: Using resolvePatientByIdentifier...');
    patient = await window.resolvePatientByIdentifier(patientId);
    console.log('🔍 loadPatientData: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null');
  } else {
    console.warn('⚠️ loadPatientData: resolvePatientByIdentifier not available, using fallback...');
    const patients = await window.loadPatientsWithSupabasePriority();
    // Try to find by UUID first, then by patient_id or patientNumber
    patient = patients.find(p => p.id === patientId) ||
              patients.find(p => p._supabaseUuid === patientId) ||
              patients.find(p => p.patient_id === patientId || p.patientNumber === patientId);
    console.log('🔍 loadPatientData: Fallback lookup result:', patient ? `Patient found: ${patient.id || patient.patient_id}` : 'null');
  }
  
  if (!patient) {
    console.error('❌ loadPatientData: Patient not found! Identifier:', patientId);
    // Show error message in the page instead of alert
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 15px; border-radius: 5px; z-index: 10000; max-width: 300px;';
    errorDiv.innerHTML = '<strong>Error:</strong> Patient not found!<br><button onclick="window.location.href=\'/patients\'" style="margin-top: 10px; padding: 5px 10px;">Go to Patients</button>';
    document.body.appendChild(errorDiv);
    return;
  }
  
  // Use patient_id from Supabase if available (display ID like MEC0012/H1Z7C), otherwise use id
  const displayId = patient.patient_id || patient.id;
  
  // Store patient data
  currentPrescription.patient = {
    id: displayId,
    uuid: patient._supabaseUuid || patient.id, // Store UUID for Supabase operations
    name: `${patient.firstName} ${patient.lastName}`,
    dob: patient.dob,
    gender: patient.gender,
    weight: patient.weight,
    height: patient.height,
    allergies: patient.allergies || [],
    address: patient.address,
    phone: patient.phone
  };
  
  // Populate patient fields
  document.getElementById('patient-name').value = currentPrescription.patient.name;
  document.getElementById('patient-dob').value = patient.dob;
  document.getElementById('patient-gender').value = patient.gender || '';
  document.getElementById('patient-id').value = displayId;
  
  console.log('✅ loadPatientData: Patient data loaded successfully:', currentPrescription.patient.name, 'ID:', displayId);
  
  // Display allergies
  const allergiesText = patient.allergies ? patient.allergies.map(a => `${a.allergen} (${a.reaction})`).join(', ') : 'No known allergies';
  document.getElementById('patient-allergies').value = allergiesText;
  
  // Update patient info display
  const patientInfoElement = document.getElementById('prescription-patient-info');
  if (patientInfoElement) {
    const displayPatientId =
      typeof window.patientMrnDisplay === 'function'
        ? window.patientMrnDisplay(patient, patientId)
        : patient.patient_id || patient.patientNumber || patient.id;
    patientInfoElement.innerHTML = `<strong>Patient ID:</strong> ${displayPatientId} | <strong>Patient:</strong> ${patient.firstName} ${patient.lastName} | <strong>DOB:</strong> ${patient.dob}`;
  }
  
  console.log('Patient data loaded:', currentPrescription.patient);

  populatePrescriptionDiagnosisPicker(patient);
}

// Load prescriber data
function loadPrescriberData() {
  const user = JSON.parse(localStorage.getItem("user"));
  
  if (!user) {
    console.error('User not logged in!');
    // Show error message in the page instead of alert
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 15px; border-radius: 5px; z-index: 10000; max-width: 300px;';
    errorDiv.innerHTML = '<strong>Error:</strong> User not logged in!<br><button onclick="window.location.href=\'/login\'" style="margin-top: 10px; padding: 5px 10px;">Go to Login</button>';
    document.body.appendChild(errorDiv);
    return;
  }
  
  // Store prescriber data
  currentPrescription.prescriber = {
    name: `${user.firstName} ${user.lastName}`,
    license: user.medicalLicenseNumber,
    specialty: user.role,
    address: `${user.orgAddressLine1 || ''} ${user.orgAddressLine2 || ''}, ${user.orgCity || ''}, ${user.orgState || ''}, ${user.orgCountry || ''}`.trim(),
    phone: user.orgPhone,
    email: user.username + '@' + (user.org || 'clinic').toLowerCase().replace(/\s+/g, '') + '.com',
    org: user.org
  };
  
  // Populate prescriber fields
  document.getElementById('prescriber-name').value = currentPrescription.prescriber.name;
  document.getElementById('prescriber-license').value = currentPrescription.prescriber.license;
  document.getElementById('prescriber-specialty').value = currentPrescription.prescriber.specialty;
  document.getElementById('prescriber-address').value = currentPrescription.prescriber.address;
  document.getElementById('prescriber-phone').value = currentPrescription.prescriber.phone;
  document.getElementById('prescriber-email').value = currentPrescription.prescriber.email;
  
  console.log('Prescriber data loaded:', currentPrescription.prescriber);
}

// Initialize signature canvas
function initializeSignatureCanvas() {
  signatureCanvas = document.getElementById('signature-canvas');
  signatureContext = signatureCanvas.getContext('2d');
  
  // Set canvas properties
  signatureContext.strokeStyle = '#000';
  signatureContext.lineWidth = 2;
  signatureContext.lineCap = 'round';
  
  // Add event listeners
  signatureCanvas.addEventListener('mousedown', startDrawing);
  signatureCanvas.addEventListener('mousemove', draw);
  signatureCanvas.addEventListener('mouseup', stopDrawing);
  signatureCanvas.addEventListener('mouseout', stopDrawing);
  
  // Touch events for mobile
  signatureCanvas.addEventListener('touchstart', handleTouch);
  signatureCanvas.addEventListener('touchmove', handleTouch);
  signatureCanvas.addEventListener('touchend', stopDrawing);
  
  // DISABLED: Electronic signature system is handled by signElectronically() function
  // Show canvas when signature pad is clicked
  /* document.getElementById('signature-pad').addEventListener('click', function() {
    signatureCanvas.style.display = 'block';
    this.style.display = 'none';
    
    // Automatically set the signature date and time when doctor starts signing
    const signatureDateField = document.getElementById('signature-date');
    if (signatureDateField) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      // Format as datetime-local value (YYYY-MM-DDTHH:MM)
      const dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
      signatureDateField.value = dateTimeValue;
      
      console.log('Signature date automatically set to:', dateTimeValue);
    }
  }); */
}

// Signature drawing functions
function startDrawing(e) {
  isDrawing = true;
  const rect = signatureCanvas.getBoundingClientRect();
  signatureContext.beginPath();
  signatureContext.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = signatureCanvas.getBoundingClientRect();
  signatureContext.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  signatureContext.stroke();
}

function stopDrawing() {
  isDrawing = false;
  signatureContext.beginPath();
}

function handleTouch(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                  e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  signatureCanvas.dispatchEvent(mouseEvent);
}

// Generate prescription ID
function generatePrescriptionId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  currentPrescription.id = `RX${timestamp}${random}`;
  const pidField = document.getElementById('prescription-id');
  if (pidField) pidField.value = currentPrescription.id;
}

// Add medication to prescription
function addMedication() {
  console.log('🔍 addMedication called');
  medicationCounter++;
  const medicationsContainer = document.getElementById('medications-container');
  
  console.log('🔍 Medications container found:', !!medicationsContainer);
  console.log('🔍 Medication counter:', medicationCounter);
  
  const medicationDiv = document.createElement('div');
  medicationDiv.className = 'medication-item';
  medicationDiv.id = `medication-${medicationCounter}`;
  
  medicationDiv.innerHTML = `
    <div class="medication-header">
      <span class="medication-number">Medication #${medicationCounter}</span>
      <button type="button" class="remove-medication" onclick="removeMedication(${medicationCounter})">Remove</button>
    </div>
    
    <div class="form-group">
      <label for="med-name-${medicationCounter}">Medication Name <span class="required">*</span></label>
      <div style="position: relative;">
        <input type="text" id="med-name-${medicationCounter}" required 
               placeholder="Search Canadian drug formulary (DPD)…" 
               oninput="searchDrugs(${medicationCounter})"
               onfocus="showDrugSuggestionsOnFocus(${medicationCounter})"
               autocomplete="off">
        <input type="hidden" id="med-din-${medicationCounter}" value="">
        <input type="hidden" id="med-ccdd-${medicationCounter}" value="">
        <input type="hidden" id="med-generic-${medicationCounter}" value="">
        <div id="drug-suggestions-${medicationCounter}" class="drug-suggestions"></div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
      <div class="form-group">
        <label for="med-strength-${medicationCounter}">Strength <span class="required">*</span></label>
        <div id="med-strength-container-${medicationCounter}" style="position: relative;">
          <input type="text" id="med-strength-${medicationCounter}" required placeholder="Search strength..." autocomplete="off" onfocus="showStrengthSuggestionsOnFocus(${medicationCounter})">
          <div id="strength-suggestions-${medicationCounter}" class="drug-suggestions"></div>
        </div>
        <small style="color: #666; font-size: 12px;">Search and select from available strengths</small>
      </div>
      
      <div class="form-group">
        <label for="med-form-${medicationCounter}">Form <span class="required">*</span></label>
        <select id="med-form-${medicationCounter}" required>
          <option value="">Select Form</option>
          <option value="Tablet">Tablet</option>
          <option value="Capsule">Capsule</option>
          <option value="Syrup">Syrup</option>
          <option value="Injection">Injection</option>
          <option value="Inhaler">Inhaler</option>
          <option value="Cream">Cream</option>
          <option value="Ointment">Ointment</option>
          <option value="Drops">Drops</option>
          <option value="Patch">Patch</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="med-route-${medicationCounter}">Route <span class="required">*</span></label>
        <select id="med-route-${medicationCounter}" required>
          <option value="">Select Route</option>
          <option value="Oral">Oral</option>
          <option value="IV">IV</option>
          <option value="IM">IM</option>
          <option value="Subcutaneous">Subcutaneous</option>
          <option value="Topical">Topical</option>
          <option value="Inhalation">Inhalation</option>
          <option value="Sublingual">Sublingual</option>
          <option value="Rectal">Rectal</option>
          <option value="Vaginal">Vaginal</option>
          <option value="Nasal">Nasal</option>
          <option value="Ophthalmic">Ophthalmic</option>
          <option value="Otic">Otic</option>
          <option value="Other">Other</option>
        </select>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
      <div class="form-group">
        <label for="med-quantity-${medicationCounter}">Quantity <span class="required">*</span></label>
        <input type="number" id="med-quantity-${medicationCounter}" required min="1" placeholder="e.g., 30">
      </div>
      
      <div class="form-group">
        <label for="med-duration-${medicationCounter}">Duration (days) <span class="required">*</span></label>
        <input type="number" id="med-duration-${medicationCounter}" required min="1" placeholder="e.g., 7">
      </div>
      
      <div class="form-group">
        <label for="med-refills-${medicationCounter}">Refills</label>
        <input type="number" id="med-refills-${medicationCounter}" min="0" max="5" value="0" placeholder="0">
      </div>
    </div>
    
    <div class="form-group">
      <label for="med-directions-${medicationCounter}">Directions (Sig) <span class="required">*</span></label>
      <select id="med-directions-${medicationCounter}" required onchange="handleDirectionsChange(${medicationCounter})">
        <option value="">Select common instruction...</option>
        <option value="Take 1 tablet once daily">Take 1 tablet once daily</option>
        <option value="Take 1 tablet twice daily">Take 1 tablet twice daily</option>
        <option value="Take 1 tablet three times daily">Take 1 tablet three times daily</option>
        <option value="Take 2 tablets once daily">Take 2 tablets once daily</option>
        <option value="Take 1 tablet once daily with food">Take 1 tablet once daily with food</option>
        <option value="Take 1 tablet twice daily with food">Take 1 tablet twice daily with food</option>
        <option value="Take 1 tablet once daily before meals">Take 1 tablet once daily before meals</option>
        <option value="Take 1 tablet twice daily before meals">Take 1 tablet twice daily before meals</option>
        <option value="Take 1 tablet once daily after meals">Take 1 tablet once daily after meals</option>
        <option value="Take 1 tablet as needed for pain">Take 1 tablet as needed for pain</option>
        <option value="Take 1-2 tablets as needed for pain">Take 1-2 tablets as needed for pain</option>
        <option value="Apply to affected area as directed">Apply to affected area as directed</option>
        <option value="Apply twice daily to affected area">Apply twice daily to affected area</option>
        <option value="Take as directed by your doctor">Take as directed by your doctor</option>
        <option value="Use before bedtime">Use before bedtime</option>
        <option value="CUSTOM">--- Enter custom instruction ---</option>
      </select>
      <textarea id="med-directions-custom-${medicationCounter}" 
                placeholder="Enter custom directions..." 
                rows="2" 
                style="display: none; margin-top: 5px;"></textarea>
    </div>
    
    <div class="form-group">
      <label for="med-warnings-${medicationCounter}">Special Instructions/Warnings</label>
      <textarea id="med-warnings-${medicationCounter}" 
                placeholder="e.g., Avoid alcohol, Monitor blood pressure" 
                rows="2"></textarea>
    </div>
    <div id="interaction-alert-${medicationCounter}" class="interaction-alert"></div>
    <div id="allergy-alert-${medicationCounter}" class="allergy-alert"></div>
  `;
  
  medicationsContainer.appendChild(medicationDiv);
  
  // Initialize strength search for this medication
  setTimeout(() => {
    initializeStrengthSearch(medicationCounter);
  }, 100);
  
  // Check for drug interactions and allergies
  setTimeout(() => {
    checkDrugInteractions(medicationCounter);
    checkAllergies(medicationCounter);
  }, 100);
  
  console.log(`Medication ${medicationCounter} added`);
}

// Remove medication from prescription
function removeMedication(medicationId) {
  const medicationDiv = document.getElementById(`medication-${medicationId}`);
  if (medicationDiv) {
    medicationDiv.remove();
    console.log(`Medication ${medicationId} removed`);
  }
}

// Search drugs in database (Canadian DPD formulary when loaded, else fallback list)
function escapeDrugHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findDrugMatches(searchTerm, limit = 15) {
  if (typeof window.searchCanadianDrugs === 'function' &&
      typeof window.isCanadianFormularyReady === 'function' &&
      window.isCanadianFormularyReady()) {
    return window.searchCanadianDrugs(searchTerm, limit);
  }
  const term = (searchTerm || '').toLowerCase();
  if (!term) return [];
  return (DRUG_DATABASE || []).filter((drug) =>
    (drug.name || '').toLowerCase().includes(term) ||
    (drug.generic || '').toLowerCase().includes(term)
  ).slice(0, limit);
}

function getDefaultDrugSuggestions(limit = 20) {
  if (typeof window.getCanadianFormularySuggestions === 'function' &&
      typeof window.isCanadianFormularyReady === 'function' &&
      window.isCanadianFormularyReady()) {
    return window.getCanadianFormularySuggestions(limit);
  }
  return (Array.isArray(DRUG_DATABASE) ? DRUG_DATABASE.slice() : [])
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, limit);
}

function renderDrugSuggestions(medicationId, matches) {
  const suggestionsDiv = document.getElementById(`drug-suggestions-${medicationId}`);
  if (!suggestionsDiv) return;

  suggestionsDiv._drugMatches = matches;
  suggestionsDiv.innerHTML = matches.map((drug, idx) => {
    const label = drug.npn ? `${drug.name} (NPN ${drug.npn})` : drug.din ? `${drug.name} (DIN ${drug.din})` : drug.name;
    const subParts = [drug.strength, drug.form];
    if (drug.generic && drug.generic.toLowerCase() !== (drug.name || '').toLowerCase()) {
      subParts.push(drug.generic);
    }
    if (drug.ccdd) subParts.push('CCDD ' + drug.ccdd);
    if (drug.npn && !drug.din) subParts.push('NHP');
    return `
    <div class="drug-suggestion" data-drug-idx="${idx}">
      <div class="drug-name">${escapeDrugHtml(label)}</div>
      <div class="drug-strength">${escapeDrugHtml(subParts.filter(Boolean).join(' | '))}</div>
    </div>`;
  }).join('') + `
    <div class="drug-suggestion" style="background:#f8f9fa; font-weight:600;" data-custom-med="1">➕ Add custom medication…</div>
  `;

  suggestionsDiv.querySelectorAll('[data-drug-idx]').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-drug-idx'), 10);
      selectDrugFromMatch(medicationId, suggestionsDiv._drugMatches[idx]);
    });
  });
  const customBtn = suggestionsDiv.querySelector('[data-custom-med]');
  if (customBtn) {
    customBtn.addEventListener('click', () => openCustomMedicationModal(medicationId));
  }

  suggestionsDiv.style.maxHeight = suggestionsDiv.style.maxHeight || '240px';
  suggestionsDiv.style.overflowY = suggestionsDiv.style.overflowY || 'auto';
  suggestionsDiv.style.display = 'block';
}

function searchDrugs(medicationId) {
  const nameInput = document.getElementById(`med-name-${medicationId}`);
  const suggestionsDiv = document.getElementById(`drug-suggestions-${medicationId}`);

  if (!nameInput || !suggestionsDiv) return;

  const searchTerm = nameInput.value.trim();
  if (searchTerm.length < 2) {
    suggestionsDiv.style.display = 'none';
    return;
  }

  const matches = findDrugMatches(searchTerm, 15);
  if (matches.length === 0) {
    suggestionsDiv.style.display = 'none';
    return;
  }

  renderDrugSuggestions(medicationId, matches);

  setTimeout(() => {
    document.addEventListener('click', function hideSuggestions(e) {
      if (!e.target.closest(`#medication-${medicationId}`)) {
        suggestionsDiv.style.display = 'none';
        document.removeEventListener('click', hideSuggestions);
      }
    });
  }, 100);
}

// Diagnosis suggestions and custom modal
function parsePrescriptionJsonField(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (!val || val === 'null') return fallback;
  try {
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
}

function normalizeDiagnosisKey(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function addPatientDiagnosisOption(map, label, meta = {}) {
  const trimmed = String(label || '').trim();
  const key = normalizeDiagnosisKey(trimmed);
  if (!key || key.length < 2) return;
  if (!map.has(key)) {
    map.set(key, { label: trimmed, ...meta });
  }
}

/** Collect unique diagnoses from the patient's full chart (problem list, visits, prior Rx, etc.). */
function collectPatientDiagnosisOptions(patient) {
  if (!patient) return [];
  const map = new Map();

  parsePrescriptionJsonField(patient.diagnoses, []).forEach((entry) => {
    const text = entry && entry.diagnosis ? entry.diagnosis : (typeof entry === 'string' ? entry : '');
    addPatientDiagnosisOption(map, text, { source: 'Problem list', date: entry.date || '' });
  });

  (patient.prescriptions || []).forEach((rx) => {
    if (rx && rx.diagnosis) {
      addPatientDiagnosisOption(map, rx.diagnosis, { source: 'Prior prescription', date: rx.date || '' });
    }
  });

  (patient.visits || []).forEach((visit) => {
    const assessment = (visit.soap && visit.soap.assessment) || {};
    if (assessment.status) {
      addPatientDiagnosisOption(map, assessment.status, { source: 'Visit note', date: visit.date || '' });
    }
    if (assessment.differential) {
      String(assessment.differential)
        .split(/[\n;,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((part) => {
          addPatientDiagnosisOption(map, part, { source: 'Visit assessment', date: visit.date || '' });
        });
    }
  });

  parsePrescriptionJsonField(patient.chronic_conditions || patient.conditions, []).forEach((entry) => {
    const text = entry && (entry.name || entry.diagnosis) ? (entry.name || entry.diagnosis) : (typeof entry === 'string' ? entry : '');
    addPatientDiagnosisOption(map, text, { source: 'Chronic condition' });
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function ensurePrescriptionDiagnosisExistingSelect() {
  let select = document.getElementById('prescription-diagnosis-existing');
  if (select) return select;

  const container = document.getElementById('prescription-diagnosis-container');
  if (!container) return null;

  const formGroup = container.closest('.form-group') || container.parentElement;
  if (!formGroup) return null;

  const label = document.createElement('label');
  label.setAttribute('for', 'prescription-diagnosis-existing');
  label.textContent = 'Existing patient diagnoses';
  label.style.cssText = 'display:block;margin-bottom:5px;font-weight:600;';

  select = document.createElement('select');
  select.id = 'prescription-diagnosis-existing';
  select.style.cssText = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px;margin-bottom:8px;';
  select.innerHTML = '<option value="">Select an existing diagnosis for this patient…</option>';
  select.addEventListener('change', function onExistingDiagnosisPick() {
    if (!this.value) return;
    const input = document.getElementById('prescription-diagnosis') || document.getElementById('diagnosis');
    if (input) {
      input.value = this.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  formGroup.insertBefore(label, container);
  formGroup.insertBefore(select, container);
  return select;
}

function populatePrescriptionDiagnosisPicker(patient) {
  const select = ensurePrescriptionDiagnosisExistingSelect();
  if (!select) return;

  const options = collectPatientDiagnosisOptions(patient);
  select.innerHTML = '<option value="">Select an existing diagnosis for this patient…</option>';

  if (!options.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.disabled = true;
    empty.textContent = 'No diagnoses on file yet — search ICD below to add one';
    select.appendChild(empty);
    return;
  }

  options.forEach((opt) => {
    const el = document.createElement('option');
    el.value = opt.label;
    const meta = [opt.source, opt.date].filter(Boolean).join(' · ');
    el.textContent = meta ? `${opt.label} (${meta})` : opt.label;
    select.appendChild(el);
  });
}

window.collectPatientDiagnosisOptions = collectPatientDiagnosisOptions;
window.populatePrescriptionDiagnosisPicker = populatePrescriptionDiagnosisPicker;

function getCustomDiagnoses() {
  try { return JSON.parse(localStorage.getItem('customDiagnoses') || '[]'); } catch (_) { return []; }
}
function setCustomDiagnoses(list) { localStorage.setItem('customDiagnoses', JSON.stringify(list)); }

function showDiagnosisSuggestionsOnFocus() {
  const suggestionsDiv = document.getElementById('diagnosis-suggestions');
  if (!suggestionsDiv) return;
  const recent = getCustomDiagnoses();
  const items = recent.slice(0,20);
  // Build ICD suggestions if available
  const icdSource = typeof window.getActiveIcdCodes === 'function'
    ? window.getActiveIcdCodes()
    : (window.ICD_CODES || window.ICD11_CODES || []);
  const icdList = icdSource.slice(0).sort((a,b)=>(a.title||'').localeCompare(b.title||'')).slice(0,10);
  const icdMarkup = icdList.map(c => `
    <div class="drug-suggestion" onclick="selectDiagnosis('${(c.code + ' - ' + c.title).replace(/'/g, "\\'")}')"><div class="drug-name">${c.code} - ${c.title}</div></div>
  `).join('');
  const customMarkup = items.map(dx => `
    <div class="drug-suggestion" onclick="selectDiagnosis('${dx.replace(/'/g, "\\'")}')"><div class="drug-name">${dx}</div></div>
  `).join('');
  suggestionsDiv.innerHTML = icdMarkup + customMarkup + `
    <div class="drug-suggestion" style="background:#f8f9fa; font-weight:600;" onclick="openCustomDiagnosisModal()">➕ Add custom diagnosis…</div>
  `;
  suggestionsDiv.style.maxHeight = '240px';
  suggestionsDiv.style.overflowY = 'auto';
  suggestionsDiv.style.display = 'block';
  setTimeout(()=>{
    document.addEventListener('click', function hideDx(e){
      if (!e.target.closest('#diagnosis-suggestions') && !e.target.closest('#prescription-diagnosis') && !e.target.closest('#diagnosis')) {
        suggestionsDiv.style.display='none';
        document.removeEventListener('click', hideDx);
      }
    });
  },0);
}

function filterDiagnosisSuggestionsOnInput(e){
  const val = (e.target.value||'').trim().toLowerCase();
  const suggestionsDiv = document.getElementById('diagnosis-suggestions');
  if (!suggestionsDiv) return;
  const base = getCustomDiagnoses();
  const filtered = base.filter(dx => dx.toLowerCase().includes(val)).slice(0,20);
  suggestionsDiv.innerHTML = filtered.map(dx => `
    <div class="drug-suggestion" onclick="selectDiagnosis('${dx.replace(/'/g, "\\'")}')"><div class="drug-name">${dx}</div></div>
  `).join('') + `
    <div class="drug-suggestion" style="background:#f8f9fa; font-weight:600;" onclick="openCustomDiagnosisModal()">➕ Add custom diagnosis…</div>
  `;
  suggestionsDiv.style.display='block';
}

function selectDiagnosis(text){
  const dxInput = document.getElementById('prescription-diagnosis') || document.getElementById('diagnosis');
  if (dxInput) dxInput.value = text;
  const suggestionsDiv = document.getElementById('diagnosis-suggestions');
  if (suggestionsDiv) suggestionsDiv.style.display='none';
}

function ensureCustomDiagnosisModal(){
  if (document.getElementById('custom-diagnosis-modal')) return;
  const modal = document.createElement('div');
  modal.id='custom-diagnosis-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.4);display:none;align-items:center;justify-content:center;z-index:10000;';
  modal.innerHTML=`
    <div style="background:#fff; border-radius:8px; width:90%; max-width:520px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 12px 0;">Add Custom Diagnosis/Indication</h3>
      <div class="form-group"><label>Diagnosis/Indication <span class="required">*</span></label>
      <input type="text" id="custom-dx-text" required placeholder="e.g., Malaria, Typhoid fever"></div>
      <div class="form-group"><label>ICD Code (optional)</label>
      <input type="text" id="custom-dx-icd" placeholder="e.g., B50"></div>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">
        <button type="button" onclick="closeCustomDiagnosisModal()" class="action-btn btn-clear">Cancel</button>
        <button type="button" onclick="saveCustomDiagnosis()" class="action-btn btn-save">Save</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
function openCustomDiagnosisModal(){ ensureCustomDiagnosisModal(); document.getElementById('custom-diagnosis-modal').style.display='flex'; }
function closeCustomDiagnosisModal(){ const m=document.getElementById('custom-diagnosis-modal'); if(m) m.style.display='none'; }
function saveCustomDiagnosis(){
  const text=(document.getElementById('custom-dx-text')?.value||'').trim();
  if(!text){ alert('Please provide a diagnosis/indication.'); return; }
  const list=getCustomDiagnoses();
  if(!list.includes(text)) list.unshift(text);
  setCustomDiagnoses(list.slice(0,100));
  selectDiagnosis(text);
  closeCustomDiagnosisModal();
}
window.openCustomDiagnosisModal=openCustomDiagnosisModal;
window.closeCustomDiagnosisModal=closeCustomDiagnosisModal;
window.saveCustomDiagnosis=saveCustomDiagnosis;
window.selectDiagnosis=selectDiagnosis;
function showDrugSuggestionsOnFocus(medicationId) {
  const suggestionsDiv = document.getElementById(`drug-suggestions-${medicationId}`);
  if (!suggestionsDiv) return;
  const list = getDefaultDrugSuggestions(20);
  if (list.length === 0) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  renderDrugSuggestions(medicationId, list);
  setTimeout(() => {
    document.addEventListener('click', function hideSuggestions(e) {
      if (!e.target.closest(`#medication-${medicationId}`)) {
        suggestionsDiv.style.display = 'none';
        document.removeEventListener('click', hideSuggestions);
      }
    });
  }, 0);
}

function selectDrugFromMatch(medicationId, drug) {
  if (!drug) return;
  document.getElementById(`med-name-${medicationId}`).value = drug.name;
  const strength = (drug.strength || '').split(',')[0].trim();
  document.getElementById(`med-strength-${medicationId}`).value = strength;
  const formSelect = document.getElementById(`med-form-${medicationId}`);
  if (formSelect && drug.form) {
    const formVal = drug.form;
    let matched = false;
    for (const opt of formSelect.options) {
      if (opt.value && formVal.toLowerCase().includes(opt.value.toLowerCase())) {
        formSelect.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) formSelect.value = formVal;
  }
  const routeSelect = document.getElementById(`med-route-${medicationId}`);
  if (routeSelect && drug.route) {
    for (const opt of routeSelect.options) {
      if (opt.value && drug.route.toLowerCase().includes(opt.value.toLowerCase())) {
        routeSelect.value = opt.value;
        break;
      }
    }
  }
  const dinEl = document.getElementById(`med-din-${medicationId}`);
  const ccddEl = document.getElementById(`med-ccdd-${medicationId}`);
  const genericEl = document.getElementById(`med-generic-${medicationId}`);
  if (dinEl) dinEl.value = drug.din || '';
  if (ccddEl) ccddEl.value = drug.ccdd || '';
  if (genericEl) genericEl.value = drug.generic || drug.name || '';
  document.getElementById(`drug-suggestions-${medicationId}`).style.display = 'none';
  const strengthSug = document.getElementById(`strength-suggestions-${medicationId}`);
  if (strengthSug) strengthSug.style.display = 'none';
  checkDrugInteractions(medicationId);
  checkAllergies(medicationId);
}

// Select drug from suggestions (legacy onclick API)
function selectDrug(medicationId, name, strength, form, category) {
  selectDrugFromMatch(medicationId, {
    name,
    generic: name,
    strength,
    form,
    category,
    din: '',
    ccdd: ''
  });
}

// Strength suggestions
function showStrengthSuggestionsOnFocus(medicationId) {
  const nameInput = document.getElementById(`med-name-${medicationId}`);
  const targetInput = document.getElementById(`med-strength-${medicationId}`);
  const container = document.getElementById(`strength-suggestions-${medicationId}`);
  if (!targetInput || !container) return;
  // Resolve strengths from selected drug
  let options = [];
  if (nameInput && nameInput.value) {
    const d = lookupDrugByName(nameInput.value);
    if (d && typeof d.strength === 'string' && d.strength.trim()) {
      options = d.strength.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (options.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.innerHTML = options.map(s => `
    <div class="drug-suggestion" onclick="selectStrength(${medicationId}, '${s.replace(/'/g, "\'")}')">
      <div class="drug-name">${s}</div>
    </div>
  `).join('');
  container.style.maxHeight = container.style.maxHeight || '240px';
  container.style.overflowY = container.style.overflowY || 'auto';
  container.style.display = 'block';
  setTimeout(() => {
    document.addEventListener('click', function hideStrength(e){
      if (!e.target.closest(`#medication-${medicationId}`)) {
        container.style.display = 'none';
        document.removeEventListener('click', hideStrength);
      }
    });
  }, 0);
}

function selectStrength(medicationId, strength) {
  const input = document.getElementById(`med-strength-${medicationId}`);
  if (input) input.value = strength;
  const container = document.getElementById(`strength-suggestions-${medicationId}`);
  if (container) container.style.display = 'none';
}

// Modal for adding custom medication
let CUSTOM_MED_TARGET_ID = null;
function ensureCustomMedicationModal() {
  if (document.getElementById('custom-medication-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'custom-medication-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:none;align-items:center;justify-content:center;z-index:10000;';
  modal.innerHTML = `
    <div style="background:#fff; border-radius:8px; width:90%; max-width:520px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 12px 0;">Add Custom Medication</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group" style="grid-column: span 2;">
          <label>Name <span class="required">*</span></label>
          <input type="text" id="custom-med-name" required placeholder="e.g., Artesunate-Amodiaquine">
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Generic <span class="required">*</span></label>
          <input type="text" id="custom-med-generic" required placeholder="Generic name">
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Strength <span class="required">*</span></label>
          <input type="text" id="custom-med-strength" required placeholder="e.g., 500mg, 1g">
        </div>
        <div class="form-group">
          <label>Form <span class="required">*</span></label>
          <select id="custom-med-form"></select>
        </div>
        <div class="form-group">
          <label>Category <span class="required">*</span></label>
          <select id="custom-med-category"></select>
        </div>
      </div>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">
        <button type="button" onclick="closeCustomMedicationModal()" class="action-btn btn-clear">Cancel</button>
        <button type="button" onclick="saveCustomMedication()" class="action-btn btn-save">Save</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function openCustomMedicationModal(medicationId) {
  CUSTOM_MED_TARGET_ID = medicationId;
  ensureCustomMedicationModal();
  // Populate dropdowns from existing data
  const formSelect = document.getElementById('custom-med-form');
  const catSelect = document.getElementById('custom-med-category');
  const forms = Array.from(new Set(
    MEDICATION_FORM_OPTIONS.concat((DRUG_DATABASE || []).map((d) => d.form).filter(Boolean))
  )).sort();
  const categories = Array.from(new Set(
    MEDICATION_CATEGORY_OPTIONS.concat((DRUG_DATABASE || []).map((d) => d.category).filter(Boolean))
  )).sort();
  formSelect.innerHTML = '<option value="">Select form</option>' + forms.map(f => `<option value="${f}">${f}</option>`).join('');
  catSelect.innerHTML = '<option value="">Select category</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
  // Open
  document.getElementById('custom-medication-modal').style.display = 'flex';
}

function closeCustomMedicationModal() {
  const modal = document.getElementById('custom-medication-modal');
  if (modal) modal.style.display = 'none';
}

function saveCustomMedication() {
  const name = document.getElementById('custom-med-name').value.trim();
  const generic = document.getElementById('custom-med-generic').value.trim();
  const strength = document.getElementById('custom-med-strength').value.trim();
  const form = document.getElementById('custom-med-form').value.trim();
  const category = document.getElementById('custom-med-category').value.trim();
  if (!name || !generic || !strength || !form || !category) {
    alert('Please complete all required fields.');
    return;
  }
  const toKey = (d) => `${(d.name||'').toLowerCase()}|${(d.form||'').toLowerCase()}|${(d.strength||'').toLowerCase()}`;
  const newDrug = { name, generic, strength, form, category, interactions: [], contraindications: [] };
  const exists = new Set((DRUG_DATABASE || []).map(d => toKey(d)));
  if (!exists.has(toKey(newDrug))) {
    DRUG_DATABASE.push(newDrug);
  }
  // Fill into current medication row
  if (CUSTOM_MED_TARGET_ID != null) {
    document.getElementById(`med-name-${CUSTOM_MED_TARGET_ID}`).value = name;
    document.getElementById(`med-strength-${CUSTOM_MED_TARGET_ID}`).value = strength.split(',')[0].trim();
    const formSelect = document.getElementById(`med-form-${CUSTOM_MED_TARGET_ID}`);
    if (formSelect && !Array.from(formSelect.options).some(o => o.value === form)) {
      const opt = document.createElement('option');
      opt.value = form; opt.textContent = form; formSelect.appendChild(opt);
    }
    formSelect.value = form;
    closeCustomMedicationModal();
    // Re-run checks
    checkDrugInteractions(CUSTOM_MED_TARGET_ID);
    checkAllergies(CUSTOM_MED_TARGET_ID);
  }
}

// Expose for onclick handlers
window.openCustomMedicationModal = openCustomMedicationModal;
window.closeCustomMedicationModal = closeCustomMedicationModal;
window.saveCustomMedication = saveCustomMedication;
// Handle directions dropdown change
function handleDirectionsChange(medicationId) {
  const directionsSelect = document.getElementById(`med-directions-${medicationId}`);
  const customTextarea = document.getElementById(`med-directions-custom-${medicationId}`);
  
  if (directionsSelect.value === 'CUSTOM') {
    // Show custom textarea and make it required
    customTextarea.style.display = 'block';
    customTextarea.required = true;
    directionsSelect.required = false;
  } else {
    // Hide custom textarea and remove requirement
    customTextarea.style.display = 'none';
    customTextarea.required = false;
    directionsSelect.required = true;
  }
}

// Check for drug interactions
function checkDrugInteractions(medicationId) {
  const currentDrug = document.getElementById(`med-name-${medicationId}`).value;
  const alertDiv = document.getElementById(`interaction-alert-${medicationId}`);
  
  if (!currentDrug) {
    alertDiv.style.display = 'none';
    return;
  }
  
  // Find current drug in database
  const drug = lookupDrugByName(currentDrug);
  if (!drug || !drug.interactions || drug.interactions.length === 0) {
    alertDiv.style.display = 'none';
    return;
  }

  // Check for interactions with other medications
  let interactions = [];
  for (let i = 1; i <= medicationCounter; i++) {
    if (i === medicationId) continue;
    const otherDrug = document.getElementById(`med-name-${i}`).value;
    if (otherDrug && drug.interactions.includes(otherDrug)) {
      interactions.push(otherDrug);
    }
  }
  
  if (interactions.length > 0) {
    alertDiv.innerHTML = `
      <strong>⚠️ Drug Interaction Alert:</strong><br>
      ${currentDrug} may interact with: ${interactions.join(', ')}<br>
      Please review and consider alternative medications.
    `;
    alertDiv.style.display = 'block';
  } else {
    alertDiv.style.display = 'none';
  }
}

// Check for allergies
function checkAllergies(medicationId) {
  const currentDrug = document.getElementById(`med-name-${medicationId}`).value;
  const alertDiv = document.getElementById(`allergy-alert-${medicationId}`);
  
  if (!currentDrug) {
    alertDiv.style.display = 'none';
    return;
  }
  
  // Find current drug in database
  const drug = lookupDrugByName(currentDrug);
  if (!drug || !drug.contraindications || drug.contraindications.length === 0) {
    alertDiv.style.display = 'none';
    return;
  }

  // Check patient allergies
  const patientAllergies = currentPrescription.patient.allergies || [];
  const allergyMatches = patientAllergies.filter(allergy => 
    drug.contraindications.some(contraindication => 
      contraindication.toLowerCase().includes(allergy.allergen.toLowerCase())
    )
  );
  
  if (allergyMatches.length > 0) {
    alertDiv.innerHTML = `
      <strong>⚠️ Allergy Alert:</strong><br>
      Patient has known allergy to: ${allergyMatches.map(a => a.allergen).join(', ')}<br>
      This medication may be contraindicated. Please review.
    `;
    alertDiv.style.display = 'block';
  } else {
    alertDiv.style.display = 'none';
  }
}

// Preview prescription
function previewPrescription() {
  if (!validatePrescription()) {
    return;
  }
  
  collectPrescriptionData();
  generatePrescriptionPreview();
  
  // Open preview in a new window instead of showing on current page
  const previewHTML = document.getElementById('prescription-preview').innerHTML;
  const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
  
  if (newWindow) {
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription Preview</title>
        <style>
          body { font-family: 'Courier New', monospace; margin: 20px; background: white; }
          .prescription { border: 2px solid #333; padding: 30px; background: white; }
        </style>
      </head>
      <body>
        <div class="prescription">
          ${previewHTML}
        </div>
      </body>
      </html>
    `);
    newWindow.document.close();
  } else {
    alert('Please allow popups to view the prescription preview');
  }
  
  // Hide the preview on the current page
  document.getElementById('prescription-preview').style.display = 'none';
}

// Validate prescription
function validatePrescription() {
  const requiredFields = [
    'prescription-date',
    'prescription-diagnosis'
  ];
  
  for (const fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field) {
      alert(`Required field '${fieldId}' not found. Please check the form.`);
      return false;
    }
    if (!field.value.trim()) {
      alert(`Please fill in the ${fieldId.replace('-', ' ')} field`);
      field.focus();
      return false;
    }
  }
  
  // Check if at least one medication is added by checking DOM elements
  let medicationCount = 0;
  for (let i = 1; i <= medicationCounter; i++) {
    const medicationDiv = document.getElementById(`medication-${i}`);
    if (medicationDiv) {
      const nameField = document.getElementById(`med-name-${i}`);
      if (nameField && nameField.value.trim()) {
        medicationCount++;
      }
    }
  }
  
  if (medicationCount === 0) {
    alert('Please add at least one medication');
    return false;
  }
  
  // Validate each medication
  for (let i = 1; i <= medicationCounter; i++) {
    const medicationDiv = document.getElementById(`medication-${i}`);
    if (!medicationDiv) continue;
    
    const nameField = document.getElementById(`med-name-${i}`);
    if (!nameField || !nameField.value.trim()) continue; // Skip empty medication entries
    
    const requiredMedFields = [
      `med-name-${i}`,
      `med-strength-${i}`,
      `med-form-${i}`,
      `med-route-${i}`,
      `med-quantity-${i}`,
      `med-directions-${i}`
    ];
    
    for (const fieldId of requiredMedFields) {
      const field = document.getElementById(fieldId);
      
      // Special handling for directions field
      if (fieldId === `med-directions-${i}`) {
        const directionsValue = getDirectionsValue(i);
        if (!directionsValue.trim()) {
          alert(`Please fill in all required fields for medication #${i}`);
          field.focus();
          return false;
        }
        continue;
      }
      
      if (!field || !field.value.trim()) {
        alert(`Please fill in all required fields for medication #${i}`);
        if (field) field.focus();
        return false;
      }
    }
  }
  
  return true;
}

// Helper function to get directions value (from dropdown or custom textarea)
function getDirectionsValue(medicationId) {
  const directionsSelect = document.getElementById(`med-directions-${medicationId}`);
  const customTextarea = document.getElementById(`med-directions-custom-${medicationId}`);
  
  if (directionsSelect && directionsSelect.value === 'CUSTOM' && customTextarea) {
    return customTextarea.value || '';
  } else if (directionsSelect) {
    return directionsSelect.value || '';
  }
  return '';
}

// Collect prescription data
function collectPrescriptionData() {
  currentPrescription.date = document.getElementById('prescription-date').value;
  currentPrescription.diagnosis = document.getElementById('prescription-diagnosis').value;
  currentPrescription.medications = [];
  
  // Collect prescriber data
  currentPrescription.prescriber = {
    name: document.getElementById('prescriber-name')?.value || 'Dr. Unknown',
    license: document.getElementById('prescriber-license')?.value || 'Not specified',
    specialty: document.getElementById('prescriber-specialty')?.value || 'General Practice',
    address: document.getElementById('prescriber-address')?.value || 'Not specified',
    phone: document.getElementById('prescriber-phone')?.value || 'Not specified',
    email: document.getElementById('prescriber-email')?.value || 'Not specified',
    org: document.getElementById('prescriber-org')?.value || 'Medical Clinic'
  };
  
  // Collect patient data
  currentPrescription.patient = {
    name: document.getElementById('patient-name')?.value || 'Unknown Patient',
    dob: document.getElementById('patient-dob')?.value || 'Not specified',
    gender: document.getElementById('patient-gender')?.value || 'Not specified',
    weight: document.getElementById('patient-weight')?.value || 'Not specified',
    height: document.getElementById('patient-height')?.value || 'Not specified',
    id: document.getElementById('patient-id')?.value || 'Not specified',
    allergies: document.getElementById('patient-allergies')?.value || 'None known'
  };
  
  // Collect medications
  for (let i = 1; i <= medicationCounter; i++) {
    const medicationDiv = document.getElementById(`medication-${i}`);
    if (!medicationDiv) continue;
    
    const nameField = document.getElementById(`med-name-${i}`);
    if (!nameField || !nameField.value.trim()) continue; // Skip empty medication entries
    
    const medication = {
      id: i,
      name: nameField.value,
      generic: document.getElementById(`med-generic-${i}`)?.value || nameField.value,
      din: document.getElementById(`med-din-${i}`)?.value || '',
      ccdd: document.getElementById(`med-ccdd-${i}`)?.value || '',
      dosage: `${document.getElementById(`med-strength-${i}`).value} ${document.getElementById(`med-form-${i}`).value}`.trim(),
      strength: document.getElementById(`med-strength-${i}`).value,
      form: document.getElementById(`med-form-${i}`).value,
      route: document.getElementById(`med-route-${i}`).value,
      frequency: '', // No frequency field in current form
      startDate: '', // No start date field in current form
      endDate: '', // No end date field in current form
      prescribingProvider: currentPrescription.prescriber?.name || 'Dr. Unknown',
      indication: '', // No indication field in current form
      status: 'Active',
      quantity: document.getElementById(`med-quantity-${i}`).value,
      refillsRemaining: document.getElementById(`med-refills-${i}`).value || '0',
      refills: document.getElementById(`med-refills-${i}`).value || '0',
      duration: document.getElementById(`med-duration-${i}`).value,
      directions: getDirectionsValue(i),
      notes: getDirectionsValue(i), // Use directions as notes
      warnings: document.getElementById(`med-warnings-${i}`).value || ''
    };
    
    currentPrescription.medications.push(medication);
  }
  
  console.log('Prescription data collected:', currentPrescription);
}

// Generate prescription preview
function generatePrescriptionPreview() {
  const previewDiv = document.getElementById('prescription-preview');
  
  const previewHTML = `
    <div class="prescription-header-preview">
      <h1>PRESCRIPTION</h1>
      <h2>${currentPrescription.prescriber.org || 'Medical Clinic'}</h2>
      <p>${currentPrescription.prescriber.address}</p>
      <p>Phone: ${currentPrescription.prescriber.phone} | Email: ${currentPrescription.prescriber.email}</p>
    </div>
    
    <div class="prescription-body-preview">
      <div>
        <h3>PRESCRIBER INFORMATION</h3>
        <p><strong>Name:</strong> ${currentPrescription.prescriber.name}</p>
        <p><strong>License:</strong> ${currentPrescription.prescriber.license}</p>
        <p><strong>Specialty:</strong> ${currentPrescription.prescriber.specialty}</p>
      </div>
      
      <div>
        <h3>PATIENT INFORMATION</h3>
        <p><strong>Name:</strong> ${currentPrescription.patient.name}</p>
        <p><strong>DOB:</strong> ${currentPrescription.patient.dob}</p>
        <p><strong>Gender:</strong> ${currentPrescription.patient.gender || 'Not specified'}</p>
        <p><strong>Patient ID:</strong> ${typeof window.patientMrnDisplay === 'function' ? window.patientMrnDisplay(currentPrescription.patient, currentPrescription.patient?.id || currentPrescription.patient?.patient_id) : currentPrescription.patient.id}</p>
      </div>
    </div>
    
    <div style="margin: 30px 0;">
      <h3>PRESCRIPTION DETAILS</h3>
      <p><strong>Date:</strong> ${currentPrescription.date}</p>
      <p><strong>Prescription ID:</strong> ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(currentPrescription) : (window.getPrescriptionMnemonic(currentPrescription) || currentPrescription.id)}</p>
      <p><strong>Diagnosis/Indication:</strong> ${currentPrescription.diagnosis}</p>
    </div>
    
    <div style="margin: 30px 0;">
      <h3>MEDICATIONS</h3>
      ${currentPrescription.medications.map((med, index) => `
        <div style="border: 1px solid #333; padding: 15px; margin: 10px 0;">
          <h4>Medication #${index + 1}</h4>
          <p><strong>Name:</strong> ${med.name}</p>
          <p><strong>Strength:</strong> ${med.strength}</p>
          <p><strong>Form:</strong> ${med.form}</p>
          <p><strong>Route:</strong> ${med.route}</p>
          <p><strong>Quantity:</strong> ${med.quantity}</p>
          <p><strong>Duration:</strong> ${med.duration} days</p>
          <p><strong>Refills:</strong> ${med.refills}</p>
          <p><strong>Directions:</strong> ${med.directions}</p>
          ${med.warnings ? `<p><strong>Warnings:</strong> ${med.warnings}</p>` : ''}
        </div>
      `).join('')}
    </div>
    
    <div class="prescription-footer-preview">
      <div class="signature-preview">
        <p>Electronically signed by ${currentPrescription.prescriber.name}</p>
        <p>Date: ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="barcode-preview">
        <div id="barcode-${currentPrescription.id}"></div>
        <p>Prescription ID: ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(currentPrescription) : (window.getPrescriptionMnemonic(currentPrescription) || currentPrescription.id)}</p>
      </div>
      
      <div style="margin-top: 20px; font-size: 12px; color: #666;">
        <p>This prescription was generated electronically and is valid for dispensing.</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;
  
  previewDiv.innerHTML = previewHTML;
  
  // Generate barcode (simplified - in real implementation, use a proper barcode library)
  generateBarcode(currentPrescription.id, currentPrescription);
}

// Generate barcode (simplified implementation)
function generateBarcode(prescriptionId, prescriptionObj) {
  const barcodeDiv = document.getElementById(`barcode-${prescriptionId}`);
  if (barcodeDiv) {
    const humanId =
      prescriptionObj && typeof window.getPrescriptionDisplayLabel === 'function'
        ? window.getPrescriptionDisplayLabel(prescriptionObj)
        : prescriptionId;
    // In a real implementation, you would use a barcode library like JsBarcode
    barcodeDiv.innerHTML = `
      <div style="font-family: monospace; font-size: 24px; letter-spacing: 2px;">
        ||| ${humanId} |||
      </div>
      <div style="font-size: 12px; margin-top: 5px;">
        Scan this code for verification
      </div>
    `;
  }
}

// Save prescription
async function savePrescription() {
  if (!document.getElementById('prescription-date')) {
    return;
  }
  if (!validatePrescription()) {
    return;
  }
  
  collectPrescriptionData();
  
  // Add signature data
  if (signatureCanvas && signatureContext) {
    currentPrescription.signature = signatureCanvas.toDataURL();
  }
  
  // Use the signature date from the form field, or current time if not set
  const signatureDateField = document.getElementById('signature-date');
  if (signatureDateField && signatureDateField.value) {
    // Convert datetime-local value to ISO string
    currentPrescription.signatureDate = new Date(signatureDateField.value).toISOString();
  } else {
    currentPrescription.signatureDate = new Date().toISOString();
  }
  currentPrescription.status = 'signed';
  currentPrescription.createdAt = new Date().toISOString();
  currentPrescription.createdBy = currentPrescription.prescriber.name;
  
  // Save to patient record
  // Save prescription to patient record - FORCE SYNCHRONOUS UPDATE
  try {
    console.log('*** FORCING PATIENT RECORD UPDATE ***');
    const urlParams = new URLSearchParams(window.location.search);
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patientIndex = patients.findIndex(p =>
      p.id === currentPrescription.patient.id ||
      p.patient_id === currentPrescription.patient.id ||
      p._supabaseUuid === currentPrescription.patient.uuid ||
      p.id === currentPrescription.patient.uuid
    );
    
    if (patientIndex !== -1) {
      if (!patients[patientIndex].prescriptions) {
        patients[patientIndex].prescriptions = [];
      }
      
      const prescriptionIndex = patients[patientIndex].prescriptions.findIndex(p => p.id === currentPrescription.id);
      
      if (prescriptionIndex !== -1) {
        // Update existing prescription
        patients[patientIndex].prescriptions[prescriptionIndex] = {
          ...currentPrescription,
          visitDate: urlParams.get('visitDate'),
          updatedAt: new Date().toISOString()
        };
        console.log('*** UPDATED EXISTING PRESCRIPTION IN PATIENT RECORD ***');
      } else {
        // Add new prescription
        patients[patientIndex].prescriptions.push({
          ...currentPrescription,
          visitDate: urlParams.get('visitDate'),
          savedAt: new Date().toISOString()
        });
        console.log('*** ADDED NEW PRESCRIPTION TO PATIENT RECORD ***');
        
        // Audit log: Prescription created
        if (typeof logAuditEvent !== 'undefined') {
          logAuditEvent('prescription_created', {
            prescriptionId: currentPrescription.id,
            patientId: currentPrescription.patient.id,
            patientName: currentPrescription.patient.name,
            medicationCount: currentPrescription.medications.length,
            prescriber: currentPrescription.prescriber.name
          });
        }
      }
      
      // HYBRID ARCHITECTURE FIX: Supabase-first, localStorage fallback
      const updatedPatient = patients[patientIndex];
      
      // Try Supabase FIRST
      if (window.supabaseClient && typeof savePatientToSupabase === 'function') {
        try {
          await savePatientToSupabase(updatedPatient);
          console.log('*** PATIENT RECORD SYNCED TO SUPABASE ***');
          
          // Success - cache to localStorage
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          
          if (typeof window.showSuccessNotification === 'function') {
            window.showSuccessNotification('Prescription saved successfully');
          }
        } catch (error) {
          console.error('*** SUPABASE SYNC FAILED:', error, '***');
          
          // Fallback: Save to localStorage and queue for sync
          localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
          
          if (typeof window.queueForSync === 'function') {
            window.queueForSync('patients', updatedPatient, 'update');
          }
          
          if (typeof window.showWarningNotification === 'function') {
            window.showWarningNotification('Prescription saved locally. Will sync when online.');
          }
        }
      } else {
        // Supabase not available - save locally
        localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
        console.log('*** PATIENT RECORD SAVED TO LOCALSTORAGE (Supabase unavailable) ***');
        
        if (typeof window.showWarningNotification === 'function') {
          window.showWarningNotification('Database not available. Prescription saved locally and will sync automatically.');
        }
      }
      
      // Dispatch localStorage event to notify all tabs by setting a value
      localStorage.setItem('patientDataSync', JSON.stringify({
        type: 'prescriptionSaved',
        patientId: currentPrescription.patient.id,
        prescriptionId: currentPrescription.id,
        timestamp: new Date().toISOString()
      }));
      console.log('*** DISPATCHED STORAGE EVENT FOR CROSS-TAB SYNC ***');
      
      // Verify the save
      const verifyPatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      const verifyPatient = verifyPatients.find(p => p.id === currentPrescription.patient.id);
      const verifyPrescription = verifyPatient?.prescriptions?.find(p => p.id === currentPrescription.id);
      console.log('*** VERIFICATION - PRESCRIPTION IN PATIENT RECORD:', verifyPrescription?.medications?.[0]?.strength, '***');
    }
  } catch (error) {
    console.error('*** PATIENT RECORD UPDATE FAILED:', error, '***');
  }
  
  // CRITICAL FIX: Wait for async patient save to complete
  await savePrescriptionToPatient();
  
  // Save to prescriptions storage (master prescriptions table)
  savePrescriptionToStorage();
  
  // Sync signed prescription to Supabase prescriptions table so Pharmacy dashboard can fulfil it
  await syncPrescriptionToSupabaseTable();
  
  // Show success message
  const successDiv = document.createElement('div');
  successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 15px; border-radius: 5px; z-index: 10000; max-width: 300px;';
  
  // Check if this is an update or new save
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('editId');
  const isUpdate = editId !== null;
  
  const message = isUpdate ? 
    '<strong>✓ Updated!</strong><br>Prescription updated successfully!' :
    '<strong>✓ Saved!</strong><br>Prescription saved successfully!';
  
  successDiv.innerHTML = message;
  document.body.appendChild(successDiv);
  
  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    if (successDiv.parentElement) {
      successDiv.remove();
    }
  }, 3000);
  
  console.log('Prescription saved:', currentPrescription);
  
  // Notify parent window (clinical note) or opener window (popup) that prescription was saved/updated
  if (window.parent !== window) {
    console.log('Sending prescriptionSaved message to parent window:', {
      type: 'prescriptionSaved', 
      prescriptionId: currentPrescription.id,
      isUpdate: isUpdate
    });
    window.parent.postMessage({ 
      type: 'prescriptionSaved', 
      prescriptionId: currentPrescription.id,
      isUpdate: isUpdate 
    }, '*');
  } else if (window.opener) {
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('patientId') || urlParams.get('id');
    const visitDate = urlParams.get('visitDate');
    
    console.log('Sending prescriptionSaved message to opener window:', {
      type: 'prescriptionSaved', 
      prescriptionId: currentPrescription.id,
      patientId: patientId,
      visitDate: visitDate,
      isUpdate: isUpdate
    });
    
    // Send message to opener with all necessary data for refresh
    window.opener.postMessage({ 
      type: 'prescriptionSaved', 
      prescriptionId: currentPrescription.id,
      patientId: patientId,
      visitDate: visitDate,
      isUpdate: isUpdate 
    }, '*');
    
    console.log('✅ Prescription saved message sent to opener window');
    
    // Keep the prescription window open so the user can review logs or continue editing.
  } else {
    console.log('Not in iframe or popup, skipping parent/opener message');
    
    // Dispatch custom event to notify all pages about the prescription save
    const prescriptionSavedEvent = new CustomEvent('prescriptionSaved', {
      detail: { 
        prescriptionId: currentPrescription.id,
        patientId: currentPrescription.patient.id,
        isUpdate: isUpdate 
      }
    });
    window.dispatchEvent(prescriptionSavedEvent);
    console.log('Dispatched prescriptionSaved event for standalone page');
  }
}

// Merge prescription diagnosis and medications into the patient chart (problem list + med list).
async function persistPrescriptionClinicalDataFromRx() {
  if (!currentPrescription || !currentPrescription.patient) return { diagnosisAdded: null, medicationsAdded: [] };

  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    patient = await window.resolvePatientByIdentifier(currentPrescription.patient.id);
  }
  if (!patient) return { diagnosisAdded: null, medicationsAdded: [] };

  const { diagnosisAdded, medicationsAdded } = mergePrescriptionClinicalDataIntoPatient(patient, currentPrescription);

  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
    }
  } catch (_) {
    patients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
  }

  const idx = patients.findIndex((p) =>
    p.id === patient.id ||
    p._supabaseUuid === patient._supabaseUuid ||
    (patient.patient_id && p.patient_id === patient.patient_id)
  );
  if (idx >= 0) {
    patients[idx] = patient;
  } else {
    patients.push(patient);
  }

  localStorage.setItem(getDataKey('patients'), JSON.stringify(patients));

  if (typeof window.savePatientToSupabase === 'function') {
    try {
      await window.savePatientToSupabase(patient);
    } catch (err) {
      console.warn('Chart sync after prescription failed:', err);
    }
  }

  const patientIdParam = currentPrescription.patient.id;
  if (diagnosisAdded) {
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId: patientIdParam, action: 'diagnosisAdded', data: diagnosisAdded }
    }));
  }
  if (medicationsAdded.length) {
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId: patientIdParam, action: 'medicationAdded', data: medicationsAdded }
    }));
  }

  populatePrescriptionDiagnosisPicker(patient);

  return { diagnosisAdded, medicationsAdded };
}

function mergePrescriptionClinicalDataIntoPatient(patient, prescription) {
  const chartDate = prescription.date || new Date().toISOString().split('T')[0];
  let diagnosisAdded = null;
  const medicationsAdded = [];

  if (prescription.diagnosis && prescription.diagnosis.trim()) {
    if (!patient.diagnoses) patient.diagnoses = [];
    const dxText = prescription.diagnosis.trim();
    const diagnosisExists = patient.diagnoses.some((d) => {
      const existing = (d.diagnosis || d || '').toString().trim().toLowerCase();
      return existing === dxText.toLowerCase();
    });
    if (!diagnosisExists) {
      diagnosisAdded = {
        diagnosis: dxText,
        date: chartDate,
        notes: 'From prescription'
      };
      patient.diagnoses.push(diagnosisAdded);
    }
  }

  if (!patient.medications) patient.medications = [];
  for (const med of prescription.medications || []) {
    const name = (med.name || med.drugName || '').trim();
    if (!name) continue;
    const dosage = (med.dosage || med.strength || '').trim();
    const exists = patient.medications.some((m) =>
      (m.name || '').trim().toLowerCase() === name.toLowerCase() &&
      (m.dosage || m.strength || '').trim() === dosage
    );
    if (!exists) {
      const entry = {
        name,
        dosage,
        startDate: med.startDate || chartDate,
        endDate: med.endDate || '',
        notes: (med.notes || '').trim() || 'From prescription',
        source: 'prescription',
        prescriptionId: prescription.id
      };
      patient.medications.push(entry);
      medicationsAdded.push(entry);
    }
  }

  return { diagnosisAdded, medicationsAdded };
}

// Save prescription to patient record
async function savePrescriptionToPatient() {
  console.log('*** PATIENT RECORD UPDATE FUNCTION CALLED ***');
  console.log('*** Looking for patient with ID:', currentPrescription.patient.id, '***');
  
  // Use resolvePatientByIdentifier to handle UUID and display IDs
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    console.log('*** Using resolvePatientByIdentifier for patient lookup ***');
    patient = await window.resolvePatientByIdentifier(currentPrescription.patient.id);
    console.log('*** resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null', '***');
  } else {
    console.warn('*** resolvePatientByIdentifier not available, using fallback ***');
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    // Try to find by display ID first, then UUID
    patient = patients.find(p => p.id === currentPrescription.patient.id) ||
              patients.find(p => p.patient_id === currentPrescription.patient.id) ||
              patients.find(p => p._supabaseUuid === currentPrescription.patient.id);
  }
  
  if (!patient) {
    console.error('*** PATIENT NOT FOUND FOR PRESCRIPTION SAVE ***');
    console.error('*** Searched for ID:', currentPrescription.patient.id, '***');
    alert('Error: Patient not found. Prescription may not be saved correctly.');
    return;
  }
  
  // Reload patients array to ensure we have the latest data
  let patients = [];
  try {
    if (typeof window.loadPatientsWithSupabasePriority === 'function') {
      patients = await window.loadPatientsWithSupabasePriority();
    } else {
      patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    }
  } catch (error) {
    console.warn('Error loading patients, using localStorage fallback:', error);
    patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  }
  
  // Update patient in the patients array
  const patientIndex = patients.findIndex(p => 
    p.id === patient.id || 
    p._supabaseUuid === patient._supabaseUuid ||
    (patient._supabaseUuid && p.id === patient._supabaseUuid) ||
    (patient.patient_id && p.patient_id === patient.patient_id)
  );
  
  if (patientIndex !== -1) {
    patient = patients[patientIndex]; // Use the patient from the array
    if (!patient.prescriptions) {
      patient.prescriptions = [];
    }
    
    // Get visit date from URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const visitDate = urlParams.get('visitDate');
    
    // Check if prescription already exists for update vs new save
    const existingIndex = patient.prescriptions.findIndex(p => p.id === currentPrescription.id);
    if (existingIndex !== -1) {
      // Update existing prescription
      const updatedPrescription = {
        ...currentPrescription,
        visitDate: visitDate,
        encounterId: currentPrescription.encounterId || null,
        encounterDate: currentPrescription.encounterDate || null,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('Updating prescription in patient record:', updatedPrescription);
      console.log('Old prescription was:', patient.prescriptions[existingIndex]);
      
    patient.prescriptions[existingIndex] = updatedPrescription;
    patients[patientIndex] = patient; // Update the patient in the array
    
    console.log('*** New prescription is:', patient.prescriptions[existingIndex]);
    console.log('*** Prescription updated in patient record');
  } else {
    // Add new prescription
    patient.prescriptions.push({
      ...currentPrescription,
      visitDate: visitDate,
      encounterId: currentPrescription.encounterId || null,
      encounterDate: currentPrescription.encounterDate || null,
      savedAt: new Date().toISOString()
    });
    patients[patientIndex] = patient;
    console.log('*** New prescription added. Total prescriptions:', patient.prescriptions.length);
  }

  const { diagnosisAdded, medicationsAdded } = mergePrescriptionClinicalDataIntoPatient(patient, currentPrescription);
  patients[patientIndex] = patient;

  localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
  console.log('*** Prescription + chart lists saved to localStorage ***');

  if (typeof window.savePatientToSupabase === 'function') {
    try {
      await window.savePatientToSupabase(patient);
      console.log('*** Patient chart synced to Supabase (Rx, diagnoses, medications) ***');
    } catch (error) {
      console.error('*** SUPABASE SYNC FAILED:', error, '***');
    }
  }

  const patientIdParam = urlParams.get('patientId') || urlParams.get('id') || patient.id || patient.patient_id;

  if (diagnosisAdded) {
    localStorage.setItem('patientDataSync', JSON.stringify({
      type: 'patientDataUpdated',
      patientId: patientIdParam,
      action: 'diagnosisAdded',
      data: diagnosisAdded
    }));
  }
  if (medicationsAdded.length) {
    localStorage.setItem('patientDataSync', JSON.stringify({
      type: 'patientDataUpdated',
      patientId: patientIdParam,
      action: 'medicationAdded',
      data: medicationsAdded
    }));
  }

  window.dispatchEvent(new CustomEvent('prescriptionSaved', {
    detail: {
      patientId: patientIdParam,
      visitDate: urlParams.get('visitDate'),
      prescriptionId: currentPrescription.id
    }
  }));

  if (diagnosisAdded) {
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId: patientIdParam, action: 'diagnosisAdded', data: diagnosisAdded }
    }));
  }
  if (medicationsAdded.length) {
    window.dispatchEvent(new CustomEvent('patientDataUpdated', {
      detail: { patientId: patientIdParam, action: 'medicationAdded', data: medicationsAdded }
    }));
  }

  console.log('*** PRESCRIPTION SAVE COMPLETE ***');
  }
}

// Sync signed prescription to Supabase prescriptions table so Pharmacy dashboard can show and fulfil it.
// Without this, prescriptions only live in the patient record and never appear on the pharmacy dashboard.
async function syncPrescriptionToSupabaseTable() {
  if (currentPrescription.status !== 'signed') return;
  if (typeof window.createPrescription !== 'function') {
    console.warn('Pharmacy sync skipped: prescriptions-supabase.js not loaded. Add script to prescription.html for pharmacy dashboard visibility.');
    return;
  }
  try {
    let patientId = currentPrescription.patient.id;
    if (typeof window.resolvePatientByIdentifier === 'function') {
      const resolved = await window.resolvePatientByIdentifier(currentPrescription.patient.id);
      if (resolved) patientId = resolved.id || resolved._supabaseUuid || patientId; // use display id so loadAllPrescriptionsForPatient finds by patient_id
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const prescriberId = user.id || user.user_id || user.username || currentPrescription.prescriber?.name || null;
    const urlParams = new URLSearchParams(window.location.search);
    const admissionId = urlParams.get('admissionId') || currentPrescription.admissionId || null;
    const payload = {
      patientId,
      prescriberId,
      diagnosis: currentPrescription.diagnosis || '',
      medications: currentPrescription.medications || [],
      signature: currentPrescription.signature,
      signatureDate: currentPrescription.signatureDate,
      status: 'signed',
      admissionId: admissionId || undefined,
      prescriptionNumber: currentPrescription.prescription_number && String(currentPrescription.prescription_number).trim()
        ? String(currentPrescription.prescription_number).trim()
        : undefined
    };
    const supabaseId = currentPrescription._supabaseId || (typeof currentPrescription.id === 'string' && currentPrescription.id.includes('-') ? currentPrescription.id : null);
    if (supabaseId) {
      const updated = await window.updatePrescription(supabaseId, {
        diagnosis: payload.diagnosis,
        medications: JSON.stringify(payload.medications),
        signature: payload.signature,
        signature_date: payload.signatureDate,
        status: 'signed'
      });
      if (updated) console.log('Prescription updated in Supabase (pharmacy):', updated.id);
    } else {
      const created = await window.createPrescription(payload);
      if (created && created.id) {
        currentPrescription._supabaseId = created.id;
        if (created.prescription_number) {
          currentPrescription.prescription_number = created.prescription_number;
          const pf = document.getElementById('prescription-id');
          if (pf) pf.value = created.prescription_number;
          if (typeof window.normalizePrescriptionRecord === 'function') {
            window.normalizePrescriptionRecord(currentPrescription);
          }
        }
        const patients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
        const idx = patients.findIndex(p => p.id === currentPrescription.patient.id || p._supabaseUuid === currentPrescription.patient.id || p.patient_id === currentPrescription.patient.id);
        if (idx !== -1 && patients[idx].prescriptions) {
          const prescIdx = patients[idx].prescriptions.findIndex(p => p.id === currentPrescription.id);
          if (prescIdx !== -1) {
            patients[idx].prescriptions[prescIdx]._supabaseId = created.id;
            if (created.prescription_number) {
              patients[idx].prescriptions[prescIdx].prescription_number = created.prescription_number;
            }
            localStorage.setItem(getDataKey('patients'), JSON.stringify(patients));
          }
        }
        console.log('Prescription sent to pharmacy (Supabase):', created.id);
      }
    }
  } catch (err) {
    console.warn('Could not sync prescription to pharmacy table:', err);
  }
}

/** Send signed Rx to in-clinic pharmacy queue and optional provincial e-prescribing hub. */
async function sendPrescriptionToPharmacy() {
  if (!currentPrescription || currentPrescription.status !== 'signed') {
    alert('Sign the prescription first, then save it, before sending to a pharmacy.');
    return;
  }

  collectPrescriptionData();
  await persistPrescriptionClinicalDataFromRx();
  await syncPrescriptionToSupabaseTable();

  let externalMessage = '';
  if (typeof window.MediForgeInterop !== 'undefined' && typeof window.MediForgeInterop.transmitPrescription === 'function') {
    try {
      const patientId = currentPrescription.patient?.id;
      const result = await window.MediForgeInterop.transmitPrescription({
        patientId,
        prescription: currentPrescription
      });
      if (result && result.skipped) {
        externalMessage = '\n\nExternal e-prescribing is not enabled yet (provincial hub credentials required). The in-clinic pharmacy dashboard was updated.';
      } else if (result && result.ok === false) {
        externalMessage = '\n\nExternal transmit did not complete: ' + (result.message || 'check integration settings.');
      } else {
        externalMessage = '\n\nExternal e-prescribing transmit was queued.';
      }
    } catch (err) {
      externalMessage = '\n\nExternal transmit failed: ' + (err.message || err);
    }
  } else {
    externalMessage = '\n\nFor electronic delivery to an outside pharmacy, provincial e-prescribing must be configured (see MEDIFORGE-CONNECTION-GUIDE.md).';
  }

  alert(
    'Prescription sent to the in-clinic pharmacy queue (Pharmacy dashboard → Incoming).' +
    externalMessage
  );
}

window.sendPrescriptionToPharmacy = sendPrescriptionToPharmacy;

// Save prescription to storage
function savePrescriptionToStorage() {
  const prescriptions = JSON.parse(localStorage.getItem(getDataKey("prescriptions")) || "[]");
  
  // Check if prescription already exists for update vs new save
  const existingIndex = prescriptions.findIndex(p => p.id === currentPrescription.id);
  if (existingIndex !== -1) {
    // Update existing prescription
    prescriptions[existingIndex] = {
      ...currentPrescription,
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    console.log('Prescription updated in storage');
  } else {
    // Add new prescription
    prescriptions.push({
      ...currentPrescription,
      savedAt: new Date().toISOString()
    });
    console.log('New prescription added to storage');
  }
  
  console.log('Saving prescriptions data to storage:', prescriptions);
  localStorage.setItem(getDataKey("prescriptions"), JSON.stringify(prescriptions));
  console.log('Prescription saved to storage');
  
  // Verify the storage save worked
  const savedPrescriptions = JSON.parse(localStorage.getItem(getDataKey("prescriptions")) || "[]");
  const savedPrescription = savedPrescriptions.find(p => p.id === currentPrescription.id);
  console.log('Verification - saved prescription in storage:', savedPrescription);
}

// Print prescription as PDF
function printPrescription() {
  if (!validatePrescription()) {
    return;
  }
  
  previewPrescription();
  
  setTimeout(() => {
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    const previewContent = document.getElementById('prescription-preview').innerHTML;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Prescription - ${currentPrescription.id}</title>
          <style>
            @page { 
              size: A4; 
              margin: 1cm; 
            }
            body { 
              font-family: 'Times New Roman', serif; 
              margin: 0; 
              padding: 20px; 
              font-size: 12px; 
              line-height: 1.4;
              color: #000;
            }
            .prescription-header-preview { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #000; 
              padding-bottom: 15px; 
            }
            .prescription-header-preview h1 { 
              font-size: 24px; 
              margin: 0 0 10px 0; 
              font-weight: bold;
            }
            .prescription-header-preview h2 { 
              font-size: 18px; 
              margin: 0; 
              font-weight: bold;
            }
            .prescription-body-preview { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 30px; 
              margin-bottom: 30px; 
            }
            .prescription-footer-preview { 
              border-top: 2px solid #000; 
              padding-top: 20px; 
              text-align: center; 
            }
            .signature-preview { 
              border: 1px solid #000; 
              height: 80px; 
              margin: 20px 0; 
              padding: 10px; 
              background: #f9f9f9;
            }
            .medication-item { 
              border: 1px solid #ccc; 
              padding: 10px; 
              margin: 10px 0; 
              background: #f9f9f9;
            }
            .medication-name { 
              font-weight: bold; 
              font-size: 14px;
            }
            .medication-details { 
              margin: 5px 0; 
            }
            .prescriber-info { 
              margin: 10px 0; 
            }
            .patient-info { 
              margin: 10px 0; 
            }
            .prescription-id { 
              font-weight: bold; 
              color: #000;
            }
            @media print { 
              body { margin: 0; padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${previewContent}
          <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666;">
            Generated on ${new Date().toLocaleString()} | Prescription: ${typeof window.getPrescriptionDisplayLabel === 'function' ? window.getPrescriptionDisplayLabel(currentPrescription) : (window.getPrescriptionMnemonic(currentPrescription) || currentPrescription.id)}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  }, 500);
}

// Email prescription
function emailPrescription() {
  if (!validatePrescription()) {
    return;
  }
  
  previewPrescription();
  
  const rxLabel =
    typeof window.getPrescriptionDisplayLabel === 'function'
      ? window.getPrescriptionDisplayLabel(currentPrescription)
      : (window.getPrescriptionMnemonic(currentPrescription) || currentPrescription.id);
  const subject = `Prescription - ${currentPrescription.patient.name} - ${rxLabel}`;
  const body = `
Prescription Details:
Patient: ${currentPrescription.patient.name}
Date: ${currentPrescription.date}
Prescription: ${rxLabel}
Diagnosis: ${currentPrescription.diagnosis}

Medications:
${currentPrescription.medications.map((med, index) => `
${index + 1}. ${med.name} ${med.strength} ${med.form}
   Directions: ${med.directions}
   Quantity: ${med.quantity}
   Duration: ${med.duration} days
   Refills: ${med.refills}
`).join('')}

Prescriber: ${currentPrescription.prescriber.name}
License: ${currentPrescription.prescriber.license}

This is an electronic prescription. Please verify all details before dispensing.
  `.trim();
  
  const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoLink);
}

// Clear form
function clearForm() {
  if (confirm('Are you sure you want to clear the entire prescription form? This action cannot be undone.')) {
    document.getElementById('prescription-form').reset();
    document.getElementById('medications-container').innerHTML = '';
    medicationCounter = 0;
    
    // Clear signature
    if (signatureContext) {
      signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    }
    signatureCanvas.style.display = 'none';
    document.getElementById('signature-pad').style.display = 'block';
    
    // Hide preview
    document.getElementById('prescription-preview').style.display = 'none';
    
    // Reset prescription data
    currentPrescription = {
      id: '',
      date: '',
      prescriber: {},
      patient: {},
      medications: [],
      diagnosis: '',
      signature: null,
      signatureDate: '',
      status: 'draft'
    };
    
    // Reinitialize
    initializePrescriptionForm();
    
    console.log('Prescription form cleared');
  }
}

// Retrieve saved prescriptions
function getSavedPrescriptions(patientId = null) {
  const prescriptions = JSON.parse(localStorage.getItem(getDataKey("prescriptions")) || "[]");
  
  if (patientId) {
    return prescriptions.filter(p => p.patient && p.patient.id === patientId);
  }
  
  return prescriptions;
}

// Get prescription by ID
function getPrescriptionById(prescriptionId) {
  const prescriptions = JSON.parse(localStorage.getItem(getDataKey("prescriptions")) || "[]");
  return prescriptions.find(p => p.id === prescriptionId);
}

// Print saved prescription by ID
function printSavedPrescription(prescriptionId) {
  const prescription = getPrescriptionById(prescriptionId);
  
  if (!prescription) {
    alert('Prescription not found!');
    return;
  }
  
  // Set current prescription data
  currentPrescription = prescription;
  
  // Generate and print the prescription
  printPrescription();
}

// Generate prescription report (for admin/doctor use)
function generatePrescriptionReport(startDate = null, endDate = null, doctorName = null) {
  let prescriptions = getSavedPrescriptions();
  
  // Filter by date range
  if (startDate && endDate) {
    prescriptions = prescriptions.filter(p => {
      const prescriptionDate = new Date(p.date);
      return prescriptionDate >= new Date(startDate) && prescriptionDate <= new Date(endDate);
    });
  }
  
  // Filter by doctor
  if (doctorName) {
    prescriptions = prescriptions.filter(p => 
      p.prescriber && p.prescriber.name && p.prescriber.name.toLowerCase().includes(doctorName.toLowerCase())
    );
  }
  
  // Generate report
  let reportHTML = `
    <html>
      <head>
        <title>Prescription Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .report-header { text-align: center; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Prescription Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          ${startDate && endDate ? `<p>Date Range: ${startDate} to ${endDate}</p>` : ''}
          ${doctorName ? `<p>Doctor: ${doctorName}</p>` : ''}
          <p>Total Prescriptions: ${prescriptions.length}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Prescription ID</th>
              <th>Patient Name</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Diagnosis</th>
              <th>Medications Count</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  prescriptions.forEach(p => {
    reportHTML += `
      <tr>
        <td>${
          typeof window.getPrescriptionDisplayLabel === 'function'
            ? window.getPrescriptionDisplayLabel(p)
            : (window.getPrescriptionMnemonic(p) || p.id)
        }</td>
        <td>${p.patient ? p.patient.name : 'N/A'}</td>
        <td>${p.prescriber ? p.prescriber.name : 'N/A'}</td>
        <td>${p.date}</td>
        <td>${p.diagnosis || 'N/A'}</td>
        <td>${p.medications ? p.medications.length : 0}</td>
        <td>${p.status || 'Unknown'}</td>
      </tr>
    `;
  });
  
  reportHTML += `
          </tbody>
        </table>
      </body>
    </html>
  `;
  
  // Open report in new window
  const reportWindow = window.open('', '_blank');
  reportWindow.document.write(reportHTML);
  reportWindow.document.close();
  
  // Auto-print the report
  setTimeout(() => {
    reportWindow.print();
  }, 500);
}

// Initialize strength search for a specific medication field
function initializeStrengthSearch(medicationNumber) {
  console.log(`🔍 Initializing strength search for medication ${medicationNumber}`);
  const input = document.getElementById(`med-strength-${medicationNumber}`);
  const container = document.getElementById(`med-strength-container-${medicationNumber}`);
  
  console.log(`🔍 Strength input found:`, input);
  console.log(`🔍 Strength container found:`, container);
  
  if (!input || !container) {
    console.error(`❌ Missing elements for strength search - input: ${!!input}, container: ${!!container}`);
    return;
  }
  
  // Create suggestions dropdown
  const suggestionsDiv = document.createElement('div');
  suggestionsDiv.id = `strength-suggestions-${medicationNumber}`;
  suggestionsDiv.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-top: none;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `;
  container.appendChild(suggestionsDiv);
  
  // Get all unique strengths from drug database
  const drugDatabase = window.DRUG_DATABASE || [];
  console.log(`🔍 DRUG_DATABASE available:`, !!drugDatabase, `Length:`, drugDatabase.length);
  
  const allStrengths = [...new Set(drugDatabase.flatMap(drug => 
    drug.strength.split(',').map(s => s.trim())
  ))].sort();
  
  console.log(`🔍 All strengths extracted:`, allStrengths.slice(0, 10), `Total:`, allStrengths.length);
  
  // Filter strengths based on input
  function filterStrengths(searchTerm) {
    console.log(`🔍 Filtering strengths for: "${searchTerm}"`);
    
    if (!searchTerm || searchTerm.length < 1) {
      console.log(`🔍 Search term too short, hiding suggestions`);
      suggestionsDiv.style.display = 'none';
      return;
    }
    
    const filtered = allStrengths.filter(strength => 
      strength.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    console.log(`🔍 Filtered strengths:`, filtered.slice(0, 5), `Total matches:`, filtered.length);
    
    if (filtered.length === 0) {
      console.log(`🔍 No matches found, hiding suggestions`);
      suggestionsDiv.style.display = 'none';
      return;
    }
    
    // Display suggestions
    suggestionsDiv.innerHTML = filtered.slice(0, 10).map(strength => `
      <div class="strength-suggestion" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;" 
           data-strength="${strength}">
        <div style="font-weight: bold; color: #007bff;">${strength}</div>
      </div>
    `).join('');
    
    suggestionsDiv.style.display = 'block';
    console.log(`✅ Strength suggestions displayed for medication ${medicationNumber}`);
    
    // Add click handlers to suggestions
    suggestionsDiv.querySelectorAll('.strength-suggestion').forEach(suggestion => {
      suggestion.addEventListener('click', function() {
        const strength = this.dataset.strength;
        console.log(`🔍 Strength selected: ${strength}`);
        
        // Fill the strength field
        input.value = strength;
        
        // Hide suggestions
        suggestionsDiv.style.display = 'none';
      });
    });
  }
  
  // Add input event listener
  input.addEventListener('input', function() {
    filterStrengths(this.value);
  });
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', function(e) {
    if (!container.contains(e.target)) {
      suggestionsDiv.style.display = 'none';
    }
  });
}

// View prescription details
function viewPrescription(prescriptionId) {
  const prescription = getPrescriptionById(prescriptionId);
  if (!prescription) {
    alert('Prescription not found');
    return;
  }
  
  // Set current prescription and preview
  currentPrescription = prescription;
  previewPrescription();
  
  // Show the preview
  const previewElement = document.getElementById('prescription-preview');
  if (previewElement) {
    previewElement.style.display = 'block';
    previewElement.scrollIntoView({ behavior: 'smooth' });
  }
}

// Edit prescription (OLD - DEPRECATED - use patients.js editPrescription instead)
function editPrescriptionOld(prescriptionId) {
  console.warn('WARNING: editPrescriptionOld called - this function is deprecated. Use patients.js editPrescription instead.');
  const prescription = getPrescriptionById(prescriptionId);
  if (!prescription) {
    alert('Prescription not found');
    return;
  }
  
  // Set current prescription
  currentPrescription = prescription;
  
  // Populate form fields
  document.getElementById('prescription-date').value = prescription.date;
  document.getElementById('prescription-diagnosis').value = prescription.diagnosis;
  
  // Clear existing medications
  clearForm();
  
  // Add medications from prescription
  if (prescription.medications && prescription.medications.length > 0) {
    prescription.medications.forEach((med, index) => {
      if (index > 0) {
        addMedication();
      }
      
      // Populate medication fields
      const medIndex = index + 1;
      const nameField = document.getElementById(`med-name-${medIndex}`);
      if (nameField) nameField.value = med.name || '';
      
      const strengthField = document.getElementById(`med-strength-${medIndex}`);
      if (strengthField) strengthField.value = med.strength || '';
      
      const formField = document.getElementById(`med-form-${medIndex}`);
      if (formField) formField.value = med.form || '';
      
      const routeField = document.getElementById(`med-route-${medIndex}`);
      if (routeField) routeField.value = med.route || '';
      
      const dosageField = document.getElementById(`med-dosage-${medIndex}`);
      if (dosageField) dosageField.value = med.dosage || '';
      
      const quantityField = document.getElementById(`med-quantity-${medIndex}`);
      if (quantityField) quantityField.value = med.quantity || '';
      
      const frequencyField = document.getElementById(`med-frequency-${medIndex}`);
      if (frequencyField) frequencyField.value = med.frequency || '';
      
      const startDateField = document.getElementById(`med-start-date-${medIndex}`);
      if (startDateField) startDateField.value = med.startDate || '';
      
      const endDateField = document.getElementById(`med-end-date-${medIndex}`);
      if (endDateField) endDateField.value = med.endDate || '';
      
      const indicationField = document.getElementById(`med-indication-${medIndex}`);
      if (indicationField) indicationField.value = med.indication || '';
      
      const durationField = document.getElementById(`med-duration-${medIndex}`);
      if (durationField) durationField.value = med.duration || '';
      
      const refillsField = document.getElementById(`med-refills-${medIndex}`);
      if (refillsField) refillsField.value = med.refills || '';
    });
  }
  
  // Scroll to form
  const formElement = document.getElementById('prescription-form');
  if (formElement) {
    formElement.scrollIntoView({ behavior: 'smooth' });
  }
}

// Delete prescription
function deletePrescription(prescriptionId) {
  if (!confirm('Are you sure you want to delete this prescription? This action cannot be undone.')) {
    return;
  }
  
  const prescriptions = JSON.parse(localStorage.getItem(getDataKey("prescriptions")) || "[]");
  const prescriptionIndex = prescriptions.findIndex(p => p.id === prescriptionId);
  
  if (prescriptionIndex === -1) {
    alert('Prescription not found');
    return;
  }
  
  const deletedPrescription = prescriptions[prescriptionIndex];
  prescriptions.splice(prescriptionIndex, 1);
  
  // Save to localStorage
  localStorage.setItem(getDataKey("prescriptions"), JSON.stringify(prescriptions));
  
  // Update patient prescriptions
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get("patientId");
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const patient = patients.find(p => p.id === patientId);
  
  if (patient) {
    if (patient.prescriptions) {
      patient.prescriptions = patient.prescriptions.filter(p => p.id !== prescriptionId);
    }
    
    // Save patient data
    localStorage.setItem(getDataKey("patients"), JSON.stringify(patients));
    
    // Save to Supabase
    if (typeof savePatientToSupabase === 'function') {
      savePatientToSupabase(patient).catch(error => {
        console.error('Failed to save patient to Supabase:', error);
      });
    }
  }
  
  // Dispatch event for other components to refresh
  window.dispatchEvent(new CustomEvent('patientDataUpdated', {
    detail: { patientId, action: 'prescriptionDeleted', prescriptionId }
  }));
  
  // Refresh the display
  if (typeof loadPatientEncounters === 'function') {
    loadPatientEncounters();
  }
  
  alert('Prescription deleted successfully');
}

// Download prescription as image
function downloadPrescriptionAsImage() {
  try {
    console.log('🖼️ Starting download as image...');
    
    // Validate and collect prescription data first
    if (!validatePrescription()) {
      return;
    }
    
    collectPrescriptionData();
    generatePrescriptionPreview();
    
    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
      console.error('❌ html2canvas not loaded');
      alert('Image generation library not loaded. Please refresh the page and try again.');
      return;
    }
    
    // Show loading message
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px;
      z-index: 10000; font-size: 16px;
    `;
    loadingDiv.textContent = 'Generating image...';
    document.body.appendChild(loadingDiv);

    // Create a temporary preview element for capture (same as print preview)
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; padding: 20px; background: white;';
    tempDiv.innerHTML = document.getElementById('prescription-preview').innerHTML;
    document.body.appendChild(tempDiv);
    
    console.log('✅ Created temporary preview element for capture');
    
    // Use html2canvas to capture the preview
    html2canvas(tempDiv, {
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 800,
      height: tempDiv.scrollHeight
    }).then(canvas => {
      console.log('✅ Canvas generated successfully:', canvas.width, 'x', canvas.height);
      
      // Clean up temporary element
      document.body.removeChild(tempDiv);
      
      // Create download link
      const link = document.createElement('a');
      link.download = `prescription-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      
      // Append to body, click, then remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Remove loading message
      loadingDiv.remove();
      
      console.log('✅ Image download initiated successfully');
    }).catch(error => {
      console.error('Error generating image:', error);
      alert('Error downloading prescription as image');
      loadingDiv.remove();
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
    });
  } catch (error) {
    console.error('Error in downloadPrescriptionAsImage:', error);
    alert('Error downloading prescription as image');
  }
}

// Download prescription in sections for long prescriptions
function downloadPrescriptionInSections(previewElement) {
  const sections = [];
  const sectionHeight = window.innerHeight * 0.8; // 80% of viewport height
  const totalHeight = previewElement.scrollHeight;
  const numSections = Math.ceil(totalHeight / sectionHeight);
  let currentSection = 0;

  function captureNextSection() {
    if (currentSection >= numSections) {
      alert(`Downloaded ${numSections} prescription sections successfully!`);
      return;
    }

    // Create a temporary container for this section
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
      position: absolute; top: -9999px; left: -9999px;
      width: ${previewElement.offsetWidth}px; height: ${sectionHeight}px;
      overflow: hidden; background: white;
    `;
    
    // Clone the preview element
    const clonedElement = previewElement.cloneNode(true);
    clonedElement.style.position = 'relative';
    clonedElement.style.top = `-${currentSection * sectionHeight}px`;
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);

    // Capture this section
    html2canvas(tempContainer, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      // Download this section
      const link = document.createElement('a');
      link.download = `prescription-page-${currentSection + 1}-of-${numSections}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Clean up
      document.body.removeChild(tempContainer);
      
      // Move to next section
      currentSection++;
      setTimeout(captureNextSection, 500); // Small delay between downloads
    }).catch(error => {
      console.error('Error capturing section:', error);
      document.body.removeChild(tempContainer);
      alert('Error downloading prescription section');
    });
  }

  captureNextSection();
}

// Clear prescription form (alias for clearForm)
function clearPrescriptionForm() {
  return clearForm();
}

// Close prescription modal
function closePrescriptionModal() {
  const modal = document.getElementById('prescription-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Clear the form
  clearForm();
  
  // Hide preview
  const previewElement = document.getElementById('prescription-preview');
  if (previewElement) {
    previewElement.style.display = 'none';
  }
}

// Handle prescription page navigation
function handlePrescriptionPageNavigation() {
  // Check if we're on the prescription page
  if (window.location.pathname.includes('prescription.html')) {
    // Initialize the page-specific functionality
    console.log('Prescription page detected, initializing...');
    
    // Set up page-specific event listeners
    setupPrescriptionPageEvents();
  }
}

// Setup prescription page events
function setupPrescriptionPageEvents() {
  // Handle form submission
  const form = document.querySelector('.prescription-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      savePrescription();
    });
  }
  
  // Handle keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      savePrescription();
    }
    // Ctrl+P to print
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      printPrescription();
    }
  });
  
  // Handle beforeunload to warn about unsaved changes
  window.addEventListener('beforeunload', function(e) {
    if (currentPrescription.medications.length > 0) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  });
}

// Export functions to global scope
window.addMedication = addMedication;
window.removeMedication = removeMedication;
window.searchDrugs = searchDrugs;
window.selectDrug = selectDrug;
window.handleDirectionsChange = handleDirectionsChange;
window.previewPrescription = previewPrescription;
window.savePrescription = savePrescription;
window.printPrescription = printPrescription;
window.emailPrescription = emailPrescription;
window.clearForm = clearForm;
window.getSavedPrescriptions = getSavedPrescriptions;
window.viewPrescription = viewPrescription;
// window.editPrescription = editPrescription; // COMMENTED OUT - handled by patients.js instead
window.deletePrescription = deletePrescription;
window.getPrescriptionById = getPrescriptionById;
window.printSavedPrescription = printSavedPrescription;
window.generatePrescriptionReport = generatePrescriptionReport;
window.downloadPrescriptionAsImage = downloadPrescriptionAsImage;
window.clearPrescriptionForm = clearPrescriptionForm;
window.closePrescriptionModal = closePrescriptionModal;
window.handlePrescriptionPageNavigation = handlePrescriptionPageNavigation;
window.lookupDrugByName = lookupDrugByName;

// Expose DRUG_DATABASE to global scope (clinic custom meds only; formulary is primary)
window.DRUG_DATABASE = DRUG_DATABASE;

// Preload Health Canada DPD formulary on any page that uses prescriptions.js
(function mediForgeFormularyBootstrap() {
  const SEARCH_SRC = 'js/canadian-formulary-search.js?v=20260617';

  function preloadFormulary() {
    const loads = [];
    if (typeof window.loadAllCanadianFormularies === 'function') {
      loads.push(window.loadAllCanadianFormularies());
    } else if (typeof window.loadCanadianFormulary === 'function') {
      loads.push(window.loadCanadianFormulary());
    }
    Promise.all(loads)
      .then((result) => {
        const meta = typeof window.getCanadianFormularyMeta === 'function' ? window.getCanadianFormularyMeta() : {};
        console.log('[formulary] DPD:', meta.dpdCount || result, 'NHP:', meta.nhpCount || 0);
      })
      .catch((err) => console.warn('[formulary] unavailable:', err.message));
  }

  function ensureSearchScript() {
    if (typeof window.loadCanadianFormulary === 'function') {
      preloadFormulary();
      return;
    }
    const existing = document.querySelector('script[data-mf-formulary-search]');
    if (existing) {
      existing.addEventListener('load', preloadFormulary);
      return;
    }
    const script = document.createElement('script');
    script.src = SEARCH_SRC;
    script.async = true;
    script.setAttribute('data-mf-formulary-search', '1');
    script.onload = preloadFormulary;
    script.onerror = () => console.warn('[formulary] could not load search helper');
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSearchScript);
  } else {
    ensureSearchScript();
  }
})();
