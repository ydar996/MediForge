// Purpose: Comprehensive prescription modal functionality
// Features: Complete prescription management with Supabase integration
// Usage: Include this script in any page that needs prescription functionality

// Helper function to get organization-specific data key
function getDataKey(key) {
  const user = JSON.parse(localStorage.getItem("user"));
  return user && user.org ? `${user.org}_${key}` : key;
}

// Make getDataKey globally available
window.getDataKey = getDataKey;

// Function to open prescription form in new HTML page (not modal)
window.openPrescriptionPage = async function() {
  // Get current patient data
  let patientId = new URLSearchParams(window.location.search).get('patientId') || 
                   new URLSearchParams(window.location.search).get('id');
  const visitDate = new URLSearchParams(window.location.search).get('visitDate');
  
  if (!patientId) {
    alert('Patient ID not found. Please access this page from a patient record.');
    return;
  }

  // CRITICAL: Normalize patient ID to legacy format before opening prescription page
  if (typeof window.normalizePatientIdForUrl === 'function') {
    try {
      patientId = await window.normalizePatientIdForUrl(patientId);
      console.log('✅ openPrescriptionPage: Normalized patient ID to legacy format:', patientId);
    } catch (error) {
      console.warn('⚠️ openPrescriptionPage: Could not normalize patient ID, using original:', error);
    }
  }

  // Open prescription.html in a new tab (not popup) - use _blank target for proper browser tab
  const prescriptionUrl = `prescription.html?patientId=${encodeURIComponent(patientId)}${visitDate ? '&visitDate=' + encodeURIComponent(visitDate) : ''}`;
  console.log('🔍 openPrescriptionPage: Opening prescription page with URL:', prescriptionUrl);
  console.log('🔍 openPrescriptionPage: patientId:', patientId, 'visitDate:', visitDate);
  
  // Open as a proper browser tab (not popup) - _blank opens in new tab
  window.open(prescriptionUrl, '_blank');
  
  console.log('✅ openPrescriptionPage: Prescription page opened in new tab');
};

// Function to open prescription form modal (kept for backward compatibility)
window.openPrescriptionForm = function() {
  // Get current patient data
  const patientId = new URLSearchParams(window.location.search).get('patientId') || 
                   new URLSearchParams(window.location.search).get('id');
  const visitDate = new URLSearchParams(window.location.search).get('visitDate');
  
  if (!patientId) {
    alert('Patient ID not found. Please access this page from a patient record.');
    return;
  }

  // Create sophisticated prescription modal HTML
  const modalHTML = `
    <div id="prescription-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; overflow-y: auto;">
      <div style="background: white; border-radius: 8px; padding: 20px; max-width: 95%; max-height: 95%; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 1200px;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #007bff;">
          <div>
            <h1 style="margin: 0; color: #333;">📋 Prescription Management</h1>
            <p id="prescription-patient-info" style="margin: 5px 0 0 0; color: #666;">Loading patient information...</p>
          </div>
          <button onclick="closePrescriptionModal()" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer;">✕ Close</button>
        </div>

        <!-- Prescription Form -->
        <form id="prescription-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
          
          <!-- Prescriber Information -->
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            <h3 style="margin-top: 0; color: #007bff; font-size: 18px;">👨‍⚕️ Prescriber Information</h3>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Full Name <span style="color: #dc3545;">*</span></label>
              <input type="text" id="prescriber-name" required readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">License Number <span style="color: #dc3545;">*</span></label>
              <input type="text" id="prescriber-license" required readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Specialty</label>
              <input type="text" id="prescriber-specialty" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Address</label>
              <textarea id="prescriber-address" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; min-height: 80px;"></textarea>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Phone</label>
              <input type="tel" id="prescriber-phone" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Email</label>
              <input type="email" id="prescriber-email" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
          </div>

          <!-- Patient Information -->
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            <h3 style="margin-top: 0; color: #007bff; font-size: 18px;">👤 Patient Information</h3>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Full Name <span style="color: #dc3545;">*</span></label>
              <input type="text" id="patient-name" required readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Date of Birth <span style="color: #dc3545;">*</span></label>
              <input type="date" id="patient-dob" required readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Gender</label>
              <select id="patient-gender" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Weight (kg)</label>
              <input type="number" id="patient-weight" step="0.1" min="0" max="500" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Height (cm)</label>
              <input type="number" id="patient-height" step="0.1" min="0" max="300" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Patient ID</label>
              <input type="text" id="patient-id" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Known Allergies</label>
              <textarea id="patient-allergies" readonly placeholder="No known allergies" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; resize: vertical; min-height: 80px;"></textarea>
            </div>
          </div>

          <!-- Prescription Details -->
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            <h3 style="margin-top: 0; color: #007bff; font-size: 18px;">📅 Prescription Details</h3>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Date of Prescription <span style="color: #dc3545;">*</span></label>
              <input type="date" id="prescription-date" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Prescription ID</label>
              <input type="text" id="prescription-id" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Diagnosis/Indication <span style="color: #dc3545;">*</span></label>
              <div id="prescription-diagnosis-container" style="position: relative;">
                <input type="text" id="prescription-diagnosis" required placeholder="Search for diagnosis or condition..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
              </div>
              <small style="color: #666;">Choose an existing diagnosis above when available, or search ICD below to add a new one. New diagnoses are saved to the patient chart when the prescription is saved or sent.</small>
            </div>
          </div>

          <!-- Medications Section -->
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; grid-column: 1 / -1;">
            <h3 style="margin-top: 0; color: #007bff; font-size: 18px;">💊 Medications</h3>
            <div id="medications-container">
              <!-- Medications will be added dynamically -->
            </div>
            <button type="button" onclick="addMedication()" style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%; margin-top: 10px;">
              ➕ Add Medication
            </button>
          </div>

          <!-- Signature Section -->
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; grid-column: 1 / -1;">
            <h3 style="margin-top: 0; color: #007bff; font-size: 18px;">✍️ Electronic Signature</h3>
            <div id="signature-pad" style="border: 2px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; min-height: 150px; background: #fff;">
              <p>Click to sign prescription</p>
              <canvas id="signature-canvas" width="400" height="100" style="border: 1px solid #ddd; display: none;"></canvas>
            </div>
            <div style="margin-bottom: 15px; margin-top: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Signature Date & Time</label>
              <input type="datetime-local" id="signature-date" readonly style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: flex; align-items: center; font-weight: 600; color: #333;">
                <input type="checkbox" id="prescriber-confirmation" required style="margin-right: 8px;">
                I confirm this prescription is accurate and appropriate
              </label>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="grid-column: 1 / -1; display: flex; gap: 15px; justify-content: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #007bff;">
            <button type="button" onclick="previewPrescription()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              👁️ Preview
            </button>
            <button type="button" onclick="savePrescription()" style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              💾 Save Prescription
            </button>
            <button type="button" onclick="downloadPrescriptionAsImage()" style="background: #17a2b8; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              📥 Download As Image
            </button>
            <button type="button" onclick="printPrescription()" style="background: #ffc107; color: #212529; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              🖨️ Print
            </button>
            <button type="button" onclick="emailPrescription()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              📧 Email
            </button>
            <button type="button" onclick="clearPrescriptionForm()" style="background: #dc3545; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              🗑️ Clear Form
            </button>
          </div>
        </form>

        <!-- Prescription Preview -->
        <div id="prescription-preview" style="background: white; border: 2px solid #333; padding: 30px; margin: 20px 0; font-family: 'Courier New', monospace; display: none;">
          <!-- Preview content will be generated here -->
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Initialize the prescription form
  initializePrescriptionModal(patientId, visitDate);
};

// Initialize prescription modal with patient data
async function initializePrescriptionModal(patientId, visitDate) {
  // Load patient data (now async)
  await loadPatientDataForPrescription(patientId);
  
  // Load prescriber data
  await loadPrescriberDataForPrescription();
  
  // Set current date
  document.getElementById('prescription-date').value = new Date().toISOString().split('T')[0];
  
  // Generate prescription ID
  generatePrescriptionId();
  
  // Initialize signature canvas
  initializeSignatureCanvas();
  
  // Initialize ICD selector for diagnosis field
  initializePrescriptionDiagnosisSelector();
}

// Load patient data for prescription
async function loadPatientDataForPrescription(patientId) {
  try {
    // Helper function to get patients data
    function getPatientsData() {
      // Try to get the organization-specific key first
      if (typeof getDataKey !== 'undefined') {
        const orgKey = getDataKey("patients");
        const orgPatients = JSON.parse(localStorage.getItem(orgKey) || "[]");
        if (orgPatients.length > 0) {
          return orgPatients;
        }
      }
      
      // Check for any organization-specific keys manually
      const allKeys = Object.keys(localStorage);
      const patientKeys = allKeys.filter(key => key.includes('patients') && key !== 'patients');
      
      for (const key of patientKeys) {
        const patients = JSON.parse(localStorage.getItem(key) || "[]");
        if (patients.length > 1) {
          return patients;
        }
      }
      
      // Fallback to generic patients key
      return JSON.parse(localStorage.getItem("patients") || "[]");
    }
    
    const patients = getPatientsData();
    console.log('Found patients for prescription:', patients.length);
    
    // Use resolvePatientByIdentifier if available (handles UUID and display IDs)
    let patient = null;
    if (typeof window.resolvePatientByIdentifier === 'function') {
      console.log('🔍 loadPatientDataForPrescription: Using resolvePatientByIdentifier...');
      patient = await window.resolvePatientByIdentifier(patientId);
      console.log('🔍 loadPatientDataForPrescription: resolvePatientByIdentifier returned:', patient ? `Patient found: ${patient.id || patient.patient_id || patient._supabaseUuid}` : 'null');
    } else {
      // Fallback: Try to find patient manually
      patient = patients.find(p => p.id === patientId) ||
                patients.find(p => p._supabaseUuid === patientId) ||
                patients.find(p => p.patient_id === patientId || p.patientNumber === patientId) ||
                patients.find(p => p.id === parseInt(patientId)) ||
                patients.find(p => p.id.toString() === patientId) ||
                patients.find(p => p.id == patientId);
      console.log('🔍 loadPatientDataForPrescription: Fallback lookup result:', patient ? `Patient found: ${patient.id || patient.patient_id}` : 'null');
    }
    
    if (patient) {
      document.getElementById('patient-name').value = `${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`.trim();
      document.getElementById('patient-dob').value = patient.dob;
      document.getElementById('patient-gender').value = patient.gender;
      document.getElementById('patient-id').value = patient.id;
      
      // Load weight and height with fallback values
      document.getElementById('patient-weight').value = patient.weight || '';
      document.getElementById('patient-height').value = patient.height || '';
      
      // Load allergies
      const allergies = patient.allergies || [];
      const allergyText = allergies.map(a => `${a.allergen} - ${a.reaction} (${a.severity})`).join('\n');
      document.getElementById('patient-allergies').value = allergyText || 'No known allergies';
      
      // Update patient info display
      document.getElementById('prescription-patient-info').textContent = 
        `Patient: ${patient.firstName} ${patient.lastName} (${patient.id})`;
      
      console.log('Patient data loaded for prescription:', patient.firstName, patient.lastName);

      if (typeof window.populatePrescriptionDiagnosisPicker === 'function') {
        window.populatePrescriptionDiagnosisPicker(patient);
      }
    } else {
      console.error('Patient not found for prescription:', patientId);
    }
  } catch (error) {
    console.error('Error loading patient data:', error);
  }
}

// Load prescriber data
async function loadPrescriberDataForPrescription() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('Loading prescriber data for user:', user);
    
    // Get organization data from Supabase
    let orgData = null;
    let userData = null;
    
    if (window.supabaseClient) {
      try {
        // First, try to get user data from Supabase users table
        if (user.username) {
          const { data: userFromSupabase, error: userError } = await window.supabaseClient
            .from('users')
            .select('*, organizations(*)')
            .eq('username', user.username)
            .single();
          
          if (!userError && userFromSupabase) {
            userData = userFromSupabase;
            orgData = userFromSupabase.organizations;
            console.log('User data loaded from Supabase:', userFromSupabase);
            console.log('Organization data from user join:', orgData);
          }
        }
        
        // If no user data found, try to get organization directly
        if (!orgData && user.organization_id) {
          const { data: org, error: orgError } = await window.supabaseClient
            .from('organizations')
            .select('*')
            .eq('id', user.organization_id)
            .single();
          
          if (!orgError && org) {
            orgData = org;
            console.log('Organization data loaded directly from Supabase:', org);
          }
        }
        
        // Try with orgId if organization_id didn't work
        if (!orgData && user.orgId) {
          const { data: org, error: orgError } = await window.supabaseClient
            .from('organizations')
            .select('*')
            .eq('id', user.orgId)
            .single();
          
          if (!orgError && org) {
            orgData = org;
            console.log('Organization data loaded with orgId from Supabase:', org);
          }
        }
      } catch (supabaseError) {
        console.warn('Could not load data from Supabase:', supabaseError);
      }
    }
    
    // If no org data from Supabase, try localStorage fallback
    if (!orgData && user.orgId) {
      const orgs = JSON.parse(localStorage.getItem('organizations') || '[]');
      orgData = orgs.find(org => org.id === user.orgId);
      console.log('Organization data from localStorage:', orgData);
    }
    
    // If still no org data, try user.org object
    if (!orgData && user.org) {
      orgData = user.org;
      console.log('Organization data from user.org:', orgData);
    }
    
    // Set prescriber name
    const prescriberName = user.firstName && user.lastName ? 
      `Dr. ${user.firstName} ${user.lastName}` : 
      (user.username || 'Dr. Unknown');
    
    document.getElementById('prescriber-name').value = prescriberName;
    
    // Get medical license from Supabase user data first, then fallback to localStorage user
    // Use the same field name as edit-profile.html: medicalLicenseNumber
    const medicalLicense = userData?.medicalLicenseNumber || 
                          user.medicalLicenseNumber || 
                          userData?.medical_license || 
                          userData?.medicalLicense || 
                          userData?.license_number || 
                          userData?.licenseNumber ||
                          user.medicalLicense || 
                          user.licenseNumber || 
                          'LIC-001';
    
    console.log('Medical license lookup:', {
      userData_medicalLicenseNumber: userData?.medicalLicenseNumber,
      user_medicalLicenseNumber: user.medicalLicenseNumber,
      userData_medical_license: userData?.medical_license,
      userData_medicalLicense: userData?.medicalLicense,
      userData_license_number: userData?.license_number,
      userData_licenseNumber: userData?.licenseNumber,
      user_medicalLicense: user.medicalLicense,
      user_licenseNumber: user.licenseNumber,
      final_license: medicalLicense
    });
    
    document.getElementById('prescriber-license').value = medicalLicense;
    
    // Get specialty from Supabase user data first, then fallback to localStorage user
    const specialty = userData?.role || user.specialty || user.role || 'General Practice';
    document.getElementById('prescriber-specialty').value = specialty;
    
    // Use the most complete data available
    const address = orgData?.address || userData?.address || user.address || '123 Medical Center, Lagos, Nigeria';
    const phone = orgData?.phone || userData?.phone_number || user.phone || user.phoneNumber || '+234-XXX-XXXX';
    const email = userData?.email || user.email || `${user.username || 'doctor'}@${orgData?.name?.toLowerCase().replace(/\s+/g, '') || 'clinic'}.com`;
    
    document.getElementById('prescriber-address').value = address;
    document.getElementById('prescriber-phone').value = phone;
    document.getElementById('prescriber-email').value = email;
    
    console.log('Final prescriber data loaded:', {
      name: prescriberName,
      medicalLicense: medicalLicense,
      specialty: specialty,
      address: address,
      phone: phone,
      email: email,
      orgData: orgData,
      userData: userData
    });
  } catch (error) {
    console.error('Error loading prescriber data:', error);
    // Set fallback values even on error
    document.getElementById('prescriber-name').value = 'Dr. Unknown';
    document.getElementById('prescriber-license').value = 'LIC-001';
    document.getElementById('prescriber-specialty').value = 'General Practice';
    document.getElementById('prescriber-address').value = '123 Medical Center, Lagos, Nigeria';
    document.getElementById('prescriber-phone').value = '+234-XXX-XXXX';
    document.getElementById('prescriber-email').value = 'doctor@clinic.com';
  }
}

// Generate prescription ID
function generatePrescriptionId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const prescriptionId = `RX-${timestamp}-${random}`;
  document.getElementById('prescription-id').value = prescriptionId;
}

// Initialize signature canvas
function initializeSignatureCanvas() {
  const canvas = document.getElementById('signature-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    let isDrawing = false;

    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    canvas.addEventListener('mouseup', () => {
      isDrawing = false;
    });

    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      isDrawing = false;
    });

    // Show canvas when signature pad is clicked
    document.getElementById('signature-pad').addEventListener('click', () => {
      canvas.style.display = 'block';
      document.getElementById('signature-pad').style.display = 'none';
    });
  }
}

// Initialize prescription diagnosis selector
function initializePrescriptionDiagnosisSelector() {
  console.log('Creating ICD selector for prescription diagnosis field...');
  
  if (typeof createIcdSelector === 'function') {
    createIcdSelector('prescription-diagnosis', false, 'prescription-diagnosis');
    console.log('ICD selector created successfully for prescription diagnosis');
  } else {
    console.log('createIcdSelector function not available for prescription diagnosis');
  }
}

// Close prescription modal
function closePrescriptionModal() {
  const modal = document.getElementById('prescription-modal');
  if (modal) {
    modal.remove();
  }
}

// Add medication function (will be handled by prescriptions.js)
function addMedication() {
  // This function is just a placeholder - the actual implementation is in prescriptions.js
  console.log('Add medication called - this should be handled by prescriptions.js');
}

// Preview prescription function (will be handled by prescriptions.js)
function previewPrescription() {
  // This function is just a placeholder - the actual implementation is in prescriptions.js
  console.log('Preview prescription called - this should be handled by prescriptions.js');
}

// Save prescription function (will be handled by prescriptions.js)
function savePrescription() {
  // This function is just a placeholder - the actual implementation is in prescriptions.js
  console.log('Save prescription called - this should be handled by prescriptions.js');
}

// Download prescription as image function
function downloadPrescriptionAsImage() {
  if (typeof window.downloadPrescriptionAsImage === 'function') {
    window.downloadPrescriptionAsImage();
  } else {
    console.error('downloadPrescriptionAsImage function not available');
  }
}

// Print prescription function (will be handled by prescriptions.js)
function printPrescription() {
  if (typeof window.printPrescription === 'function') {
    window.printPrescription();
  } else {
    console.error('printPrescription function not available');
  }
}

// Email prescription function (will be handled by prescriptions.js)
function emailPrescription() {
  if (typeof window.emailPrescription === 'function') {
    window.emailPrescription();
  } else {
    console.error('emailPrescription function not available');
  }
}

// Clear prescription form function (will be handled by prescriptions.js)
function clearPrescriptionForm() {
  if (typeof window.clearPrescriptionForm === 'function') {
    window.clearPrescriptionForm();
  } else {
    console.error('clearPrescriptionForm function not available');
  }
}
