// Purpose: Manages preventive care gaps logic, including computing and displaying gaps for patients.
// Version: 3.0 - Added real-time sync between pages and proof attachments

// Use system current date and time
const CURRENT_DATE = new Date();

// Preventive interventions from CSV (parsed as array of objects)
const PREVENTIVE_INTERVENTIONS = [
  {ageRange: '3-17', gender: 'Any', intervention: 'Weight Assessment and Counseling for Nutrition and Physical Activity (BMI percentile, nutrition counseling, physical activity counseling)', frequency: 'Annually'},
  {ageRange: '0-2', gender: 'Any', intervention: 'Lead Screening (capillary or venous blood test)', frequency: 'By 2nd birthday'},
  {ageRange: '16-24', gender: 'Female', intervention: 'Chlamydia Screening', frequency: 'Annually'},
  {ageRange: '66+', gender: 'Any', intervention: 'Care for Older Adults (medication review, functional status assessment)', frequency: 'Annually'},
  {ageRange: '50-74', gender: 'Female', intervention: 'Breast Cancer Screening (mammogram)', frequency: 'Every 1-2 years (annual reporting)'},
  {ageRange: '21-64', gender: 'Female', intervention: 'Cervical Cancer Screening (cervical cytology)', frequency: 'Every 3 years'},
  {ageRange: '30-64', gender: 'Female', intervention: 'Cervical Cancer Screening (hrHPV testing)', frequency: 'Every 5 years'},
  {ageRange: '30-64', gender: 'Female', intervention: 'Cervical Cancer Screening (cytology/hrHPV cotesting)', frequency: 'Every 5 years'},
  {ageRange: '45-75', gender: 'Any', intervention: 'Colorectal Cancer Screening (FOBT or FIT)', frequency: 'Annually'},
  {ageRange: '45-75', gender: 'Any', intervention: 'Colorectal Cancer Screening (colonoscopy)', frequency: 'Every 10 years'},
  {ageRange: '45-75', gender: 'Any', intervention: 'Colorectal Cancer Screening (flexible sigmoidoscopy)', frequency: 'Every 5 years'},
  {ageRange: '45-75', gender: 'Any', intervention: 'Colorectal Cancer Screening (CT colonography)', frequency: 'Every 5 years'},
  {ageRange: '45-75', gender: 'Any', intervention: 'Colorectal Cancer Screening (sDNA-FIT)', frequency: 'Every 3 years'},
  {ageRange: '18-75', gender: 'Any with diabetes', intervention: 'Eye Exam for Patients With Diabetes (retinal exam)', frequency: 'Annually (or every 2 years if no retinopathy)'},
  {ageRange: '18-85', gender: 'Any with diabetes', intervention: 'Kidney Health Evaluation for Patients With Diabetes (eGFR and uACR)', frequency: 'Annually'},
  {ageRange: '12+', gender: 'Any', intervention: 'Depression Screening and Follow-Up', frequency: 'Annually, with follow-up within 30 days if positive'},
  {ageRange: '18+', gender: 'Any', intervention: 'Unhealthy Alcohol Use Screening and Follow-Up', frequency: 'Annually, with counseling if positive'},
  {ageRange: '18+', gender: 'Any', intervention: 'Unhealthy Drug Use Screening and Follow-Up', frequency: 'Annually, with counseling if positive'},
  {ageRange: 'During pregnancy', gender: 'Female', intervention: 'Prenatal Depression Screening and Follow-Up', frequency: 'During pregnancy, with follow-up within 30 days if positive'},
  {ageRange: 'Post-delivery', gender: 'Female', intervention: 'Postpartum Depression Screening and Follow-Up', frequency: 'Within 12 months post-delivery, with follow-up within 30 days if positive'},
  {ageRange: '0-2', gender: 'Any', intervention: 'Childhood Immunizations (DTaP, IPV, MMR, HiB, HepB, VZV, PCV, HepA, Rotavirus, Influenza)', frequency: 'By 2nd birthday (specific doses)'},
  {ageRange: '11-13', gender: 'Any', intervention: 'Immunizations for Adolescents (Meningococcal, Tdap, HPV)', frequency: 'By 13th birthday'},
  {ageRange: '19+', gender: 'Any', intervention: 'Adult Immunizations (Influenza)', frequency: 'Annually'},
  {ageRange: '19+', gender: 'Any', intervention: 'Adult Immunizations (Td/Tdap)', frequency: 'Every 10 years'},
  {ageRange: '50+', gender: 'Any', intervention: 'Adult Immunizations (Zoster)', frequency: '2 doses'},
  {ageRange: '65+', gender: 'Any', intervention: 'Adult Immunizations (Pneumococcal)', frequency: 'Once (for 66+)'},
  {ageRange: '19+', gender: 'Any at risk', intervention: 'Adult Immunizations (Hepatitis B)', frequency: '2-3 doses'},
  {ageRange: '3-21', gender: 'Any', intervention: 'Child and Adolescent Well-Care Visits', frequency: 'Annually'},
  {ageRange: '0-30 months', gender: 'Any', intervention: 'Well-Child Visits', frequency: '6+ in 0-15 months; 2+ in 15-30 months'},
  {ageRange: 'During pregnancy', gender: 'Female', intervention: 'Timeliness of Prenatal Care', frequency: 'In first trimester or within 42 days of enrollment'},
  {ageRange: 'Post-delivery', gender: 'Female', intervention: 'Postpartum Care', frequency: 'Between 7-84 days after delivery'},
  {ageRange: 'During pregnancy', gender: 'Female', intervention: 'Prenatal Immunization (Influenza)', frequency: 'During flu season'},
  {ageRange: 'During pregnancy', gender: 'Female', intervention: 'Prenatal Immunization (Tdap)', frequency: 'Once per pregnancy'},
  {ageRange: 'During pregnancy', gender: 'Female', intervention: 'Prenatal Immunization Status (combination: Tdap, Influenza, HepB)', frequency: 'Once per pregnancy (combination rate)'},
  {ageRange: '67-85', gender: 'Female', intervention: 'Osteoporosis Management in Women Who Had a Fracture (BMD test or medication)', frequency: 'Within 6 months of fracture'},
  {ageRange: '70+', gender: 'Male', intervention: 'Non-Recommended PSA-Based Screening in Older Men (avoid PSA testing unless indicated)', frequency: 'Annually (measure tracks avoidance of overuse)'},
  {ageRange: '20+', gender: 'Any', intervention: 'Adults Access to Preventive/Ambulatory Health Services', frequency: 'Annually'},
  {ageRange: '18-75', gender: 'Any with diabetes', intervention: 'Glycemic Status Assessment (HbA1c or GMI)', frequency: 'Annually'},
  // Expanded USPSTF-based interventions for broader coverage
  {ageRange: '18+', gender: 'Any', intervention: 'Hypertension Screening (Blood Pressure Measurement)', frequency: 'Annually'},
  {ageRange: '18+', gender: 'Any', intervention: 'Obesity Screening and Counseling (BMI Measurement)', frequency: 'Annually'},
  {ageRange: '18+', gender: 'Any', intervention: 'Tobacco Use Screening and Cessation Counseling', frequency: 'Annually'},
  {ageRange: '35-70', gender: 'Any', intervention: 'Type 2 Diabetes Screening (for overweight or obese adults)', frequency: 'Every 3 years'},
  {ageRange: '18-79', gender: 'Any', intervention: 'Hepatitis C Virus (HCV) Infection Screening', frequency: 'Once'},
  {ageRange: '15-65', gender: 'Any', intervention: 'HIV Infection Screening', frequency: 'Once, more if at risk'},
  {ageRange: '50-80', gender: 'Any', intervention: 'Lung Cancer Screening (for those with smoking history)', frequency: 'Annually'},
  {ageRange: '65-75', gender: 'Male', intervention: 'Abdominal Aortic Aneurysm Screening (one-time for ever-smokers)', frequency: 'Once'},
  {ageRange: '65+', gender: 'Female', intervention: 'Osteoporosis Screening', frequency: 'Every 2 years'},
  {ageRange: '18-64', gender: 'Any', intervention: 'Anxiety Disorders Screening', frequency: 'As needed'},
  {ageRange: '40-75', gender: 'Any', intervention: 'Statin Preventive Medication (for those with CVD risk factors)', frequency: 'As recommended'},
  {ageRange: '18+', gender: 'Any', intervention: 'Healthy Diet and Physical Activity Counseling (for CVD prevention in at-risk adults)', frequency: 'As needed'},
  {ageRange: '18+', gender: 'Any', intervention: 'Fall Prevention in Older Adults (for community-dwelling adults 65+)', frequency: 'Annually'},
  {ageRange: '6+', gender: 'Any', intervention: 'Skin Cancer Prevention Counseling (for fair-skinned individuals)', frequency: 'As needed'},
  {ageRange: '18+', gender: 'Female', intervention: 'Intimate Partner Violence Screening', frequency: 'Annually'},
  {ageRange: '0-5', gender: 'Any', intervention: 'Vision Screening in Children', frequency: 'At ages 3-5 years'},
  {ageRange: '12-17', gender: 'Any', intervention: 'Major Depressive Disorder Screening in Adolescents', frequency: 'Annually'},
  {ageRange: '18+', gender: 'Any', intervention: 'Latent Tuberculosis Infection Screening (for at-risk adults)', frequency: 'Once'},
  {ageRange: '18-75', gender: 'Any', intervention: 'Prediabetes and Type 2 Diabetes Screening', frequency: 'Every 3 years for at-risk'},
  {ageRange: '50-75', gender: 'Any', intervention: 'Colorectal Cancer Screening (general)', frequency: 'Every 5-10 years depending on method'},
  {ageRange: '40-49', gender: 'Female', intervention: 'Breast Cancer Screening Discussion', frequency: 'As needed'}
];

// Helper: load patients using org-prefixed key with fallback to unprefixed key
function getPatientsWithFallback() {
  const prefixedKey = getDataKey("patients");
  let patients = JSON.parse(localStorage.getItem(prefixedKey) || "[]");
  let storageKey = prefixedKey;
  
  console.log('getPatientsWithFallback - prefixedKey:', prefixedKey, 'patients found:', patients.length);
  
  if (!Array.isArray(patients) || patients.length === 0) {
    const unprefixedKey = "patients";
    const unprefixedPatients = JSON.parse(localStorage.getItem(unprefixedKey) || "[]");
    console.log('getPatientsWithFallback - unprefixedKey:', unprefixedKey, 'patients found:', unprefixedPatients.length);
    
    if (Array.isArray(unprefixedPatients) && unprefixedPatients.length > 0) {
      patients = unprefixedPatients;
      storageKey = unprefixedKey;
      console.log('getPatientsWithFallback - using unprefixed data');
    }
  }
  
  if (!Array.isArray(patients)) {
    patients = [];
  }
  let changed = false;
  const beforeLen = patients.length;
  patients = patients.filter(p => p != null && typeof p === 'object');
  if (patients.length !== beforeLen) {
    changed = true;
  }
  
  // Ensure all patients have hasDiabetes field
  patients = patients.map(p => {
    if (!p || typeof p !== 'object') return p;
    if (p.hasDiabetes === undefined) {
      p.hasDiabetes = false;
      changed = true;
    }
    return p;
  });
  
  if (changed) {
    localStorage.setItem(storageKey, JSON.stringify(patients));
    console.log('getPatientsWithFallback - saved patient list (hasDiabetes migration and/or removed null entries)');
  }
  
  return { patients, storageKey };
}

// Define groups for alternatives
const GROUPS = {
  'Cervical Cancer Screening': [
    'Cervical Cancer Screening (cervical cytology)',
    'Cervical Cancer Screening (hrHPV testing)',
    'Cervical Cancer Screening (cytology/hrHPV cotesting)'
  ],
  'Colorectal Cancer Screening': [
    'Colorectal Cancer Screening (FOBT or FIT)',
    'Colorectal Cancer Screening (colonoscopy)',
    'Colorectal Cancer Screening (flexible sigmoidoscopy)',
    'Colorectal Cancer Screening (CT colonography)',
    'Colorectal Cancer Screening (sDNA-FIT)',
    'Colorectal Cancer Screening (general)'
  ]
};

// Function to calculate age in years from DOB
function calculateAge(dob) {
  let parts = dob.split('-');
  let year, month, day;
  try {
    year = parseInt(parts[0]);
    month = parseInt(parts[1]) - 1;
    day = parseInt(parts[2]);
    let birthDate = new Date(year, month, day);
    if (isNaN(birthDate.getTime())) {
      // Try DD-MM-YYYY swap
      if (parts[0].length === 2 && parts[2].length === 4 && parseInt(parts[0]) <= 31 && parseInt(parts[1]) <= 12) {
        year = parseInt(parts[2]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[0]);
        birthDate = new Date(year, month, day);
        if (isNaN(birthDate.getTime())) return NaN;
        console.log('Auto-corrected DOB from DD-MM-YYYY to YYYY-MM-DD:', dob);
      } else {
        return NaN;
      }
    }
    let age = CURRENT_DATE.getFullYear() - birthDate.getFullYear();
    const m = CURRENT_DATE.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && CURRENT_DATE.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (e) {
    return NaN;
  }
}

// Function to parse frequency to years for lookback
function getFrequencyYears(freq) {
  if (freq.includes('Annually') || freq.includes('Annual')) return 1;
  if (freq.includes('Once') || freq.includes('By ')) return 100; // Lifetime
  if (freq.includes('As needed') || freq.includes('As recommended')) return 1; // Default to 1 year
  const match = freq.match(/Every (\d+)(?:-(\d+))? years?/);
  if (match) {
    return parseInt(match[1]); // Take minimum
  }
  return 1; // Default
}

// Helper to check if an intervention was addressed recently
function hasRecentIntervention(patient, intervention, years) {
  const cutoffDate = new Date(CURRENT_DATE);
  cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
  
  // Check medical history
  const historyMatch = (patient.medicalHistory || []).some(h => 
    (h.event.toLowerCase().includes(intervention.toLowerCase()) || (h.notes && h.notes.toLowerCase().includes(intervention.toLowerCase()))) 
    && new Date(h.date) >= cutoffDate
  );
  
  // Check immunizations
  const immunMatch = (patient.immunizations || []).some(i => 
    (i.vaccine.toLowerCase().includes(intervention.toLowerCase()) || (i.notes && i.notes.toLowerCase().includes(intervention.toLowerCase()))) 
    && new Date(i.date) >= cutoffDate
  );
  
  // Check visit SOAP notes
  const visitMatch = (patient.visits || []).some(v => {
    if (!v.soap) return false;
    const texts = [
      v.soap.subjective ? Object.values(v.soap.subjective).join(' ') : '',
      v.soap.objective ? Object.values(v.soap.objective).join(' ') : '',
      v.soap.assessment ? Object.values(v.soap.assessment).join(' ') : '',
      v.soap.plan ? Object.values(v.soap.plan).join(' ') : ''
    ].join(' ').toLowerCase();
    return texts.includes(intervention.toLowerCase()) && new Date(v.date) >= cutoffDate;
  });
  
  return historyMatch || immunMatch || visitMatch;
}

// Function to check if patient matches age range (parse 'X-Y', 'X+', 'During pregnancy', etc.)
function matchesAgeRange(age, range) {
  if (range === 'During pregnancy' || range === 'Post-delivery') {
    return false; // Placeholder; add pregnancy logic if needed
  }
  if (range.endsWith('+')) {
    return age >= parseInt(range);
  }
  const [minStr, maxStr] = range.split('-');
  let min = parseInt(minStr);
  let max = maxStr ? parseInt(maxStr.replace(' months', '')) : Infinity;
  if (maxStr && maxStr.includes(' months')) max /= 12; // Convert months to years
  return age >= min && age <= max;
}

// Function to compute gaps for a patient
function computeGaps(patient) {
  console.log('Computing gaps for patient:', patient.id, 'hasDiabetes:', patient.hasDiabetes); // Debug log
  const age = calculateAge(patient.dob);
  const gaps = [];
  PREVENTIVE_INTERVENTIONS.forEach(int => {
    const matchesAge = matchesAgeRange(age, int.ageRange);
    const baseGender = int.gender.split(' ')[0];  // Take first word as gender
    const matchesGender = (baseGender === 'Any') || (baseGender.toLowerCase() === patient.gender.toLowerCase());
    const hasDiabetes = patient.hasDiabetes ?? false; // Explicitly handle undefined
    const requiresDiabetes = int.gender.includes('with diabetes');
    const matchesDiabetes = !requiresDiabetes || hasDiabetes;
    if (matchesAge && matchesGender && matchesDiabetes) {
      const years = getFrequencyYears(int.frequency);
      const autoAddressed = hasRecentIntervention(patient, int.intervention, years);
      const gapEntry = patient.preventiveGaps?.find(g => g.intervention === int.intervention);
      const addressed = gapEntry ? gapEntry.addressed : autoAddressed;
      gaps.push({ intervention: int.intervention, frequency: int.frequency, addressed });
    }
  });
  // Sort gaps alphabetically by intervention name for better organization
  gaps.sort((a, b) => a.intervention.localeCompare(b.intervention));
  console.log('Computed gaps for patient', patient.id, ':', gaps);  // Debug log
  return gaps;
}

// Function to get frequency for an intervention
function getFrequency(intervention) {
  const int = PREVENTIVE_INTERVENTIONS.find(i => i.intervention === intervention);
  return int ? int.frequency : '';
}

// Function to ensure preventive care gaps styling is applied
function ensurePreventiveGapsStyling() {
  const container = document.getElementById('preventive-gaps-list') || document.getElementById('gaps-section');
  if (container) {
    // Force apply the grid layout
    container.style.setProperty('width', '100%', 'important');
    container.style.setProperty('margin', '20px 0', 'important');
    container.style.setProperty('clear', 'both', 'important');
    
    const ul = container.querySelector('ul');
    if (ul) {
      ul.style.setProperty('display', 'block', 'important');
      ul.style.setProperty('width', '100%', 'important');
      ul.style.setProperty('list-style', 'none', 'important');
      ul.style.setProperty('padding', '0', 'important');
      ul.style.setProperty('margin', '0', 'important');
      ul.style.setProperty('clear', 'both', 'important');
    }
    
    // Apply minimal styling to match patient-details.html
    const listItems = container.querySelectorAll('li');
    listItems.forEach(li => {
      li.style.setProperty('display', 'block', 'important');
      li.style.setProperty('width', '100%', 'important');
      li.style.setProperty('float', 'none', 'important');
      li.style.setProperty('clear', 'both', 'important');
      li.style.setProperty('margin', '0 0 10px 0', 'important');
      li.style.setProperty('box-sizing', 'border-box', 'important');
      li.style.setProperty('position', 'relative', 'important');
    });
    
    // Apply minimal styling to gap-text elements
    const gapTexts = container.querySelectorAll('.gap-text');
    gapTexts.forEach(text => {
      text.style.setProperty('margin', '0 0 8px 0', 'important');
      text.style.setProperty('padding', '0', 'important');
      text.style.setProperty('word-wrap', 'break-word', 'important');
      text.style.setProperty('display', 'block', 'important');
    });
    
    // Apply minimal styling to gap-buttons elements
    const gapButtons = container.querySelectorAll('.gap-buttons');
    gapButtons.forEach(buttons => {
      buttons.style.setProperty('display', 'block', 'important');
      buttons.style.setProperty('text-align', 'right', 'important');
      buttons.style.setProperty('margin', '0', 'important');
      buttons.style.setProperty('padding', '0', 'important');
    });
    
    // Apply minimal styling to buttons
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      button.style.setProperty('cursor', 'pointer', 'important');
      button.style.setProperty('white-space', 'nowrap', 'important');
      button.style.setProperty('flex-shrink', '0', 'important');
      button.style.setProperty('margin', '0', 'important');
      button.style.setProperty('display', 'inline-block', 'important');
      button.style.setProperty('position', 'relative', 'important');
    });
  }
}

// Function to display gaps (e.g., in patient-details.html or clinical-note.html)
async function displayGaps(patientId, elementId) {
  console.log('displayGaps called for patientId:', patientId, 'elementId:', elementId);
  
  // Handle both URL parameter names
  if (!patientId) {
    const urlParams = new URLSearchParams(window.location.search);
    patientId = urlParams.get("id") || urlParams.get("patientId");
  }
  
  if (!patientId) {
    console.log('No patient ID found in URL parameters');
    return;
  }
  
  // CRITICAL FIX: Use resolvePatientByIdentifier to properly resolve patient ID
  // This handles UUIDs, legacy IDs, and temporary IDs correctly
  let patient = null;
  if (typeof window.resolvePatientByIdentifier === 'function') {
    try {
      patient = await window.resolvePatientByIdentifier(patientId);
      if (patient) {
        console.log('✅ displayGaps: Patient resolved via resolvePatientByIdentifier:', patient.id || patient.patient_id);
      }
    } catch (error) {
      console.warn('⚠️ displayGaps: Error resolving patient:', error);
    }
  }
  
  // Fallback: Try getPatientsWithFallback if resolvePatientByIdentifier didn't work
  if (!patient) {
  const { patients, storageKey } = getPatientsWithFallback();
  // Check both id (display ID) and _supabaseUuid (UUID) fields for patient lookup
  const patientIndex = patients.findIndex(p => 
    p.id === patientId || 
    p.patient_id === patientId ||
    p._supabaseUuid === patientId ||
    p.patientNumber === patientId
  );
    patient = patients[patientIndex];
  }
  
  if (!patient) {
    console.log('Patient not found for gaps display:', patientId);
    const container = document.getElementById(elementId);
    if (container) {
      container.innerHTML = '<p style="color: red;">Patient not found. Please refresh the page.</p>';
    }
    return;
  }
  
  // Get storage key for saving updates
  const { patients: allPatients, storageKey } = getPatientsWithFallback();
  const patientIndex = allPatients.findIndex(p => 
    p.id === patient.id || 
    p.patient_id === patient.patient_id ||
    p._supabaseUuid === patient._supabaseUuid ||
    p.id === patientId ||
    p.patient_id === patientId
  );
  if (patient.hasDiabetes === undefined) {
    patient.hasDiabetes = false;
    patients[patientIndex] = patient;
    localStorage.setItem(storageKey, JSON.stringify(patients));
  }
  const container = document.getElementById(elementId);
  if (container) {
    container.innerHTML = '';
    if (!patient.dob) {
      container.innerHTML = '<p>Patient DOB not set, cannot compute preventive care gaps.</p>';
      return;
    }
    console.log('Patient DOB:', patient.dob, 'Gender:', patient.gender, 'hasDiabetes:', patient.hasDiabetes);
    const age = calculateAge(patient.dob);
    console.log('Calculated age:', age);
    if (isNaN(age)) {
      container.innerHTML = '<p>Invalid DOB format (expected YYYY-MM-DD). Please edit patient to correct.</p>';
      return;
    }
    if (age < 0) {
      container.innerHTML = '<p>DOB is in the future. Please correct the DOB to compute gaps.</p>';
      return;
    }
    const computedGaps = computeGaps(patient);
    console.log('Gaps computed. Length:', computedGaps.length);
    
    // Merge computed gaps with stored gap data (including proof attachments)
    const storedGaps = patient.preventiveGaps || [];
    const gaps = computedGaps.map(gap => {
      const storedGap = storedGaps.find(sg => sg.intervention === gap.intervention);
      if (storedGap) {
        return {
          ...gap,
          addressed: storedGap.addressed,
          markedDate: storedGap.markedDate,
          proofAttachments: storedGap.proofAttachments || []
        };
      }
      return gap;
    });
    
    if (gaps.length === 0) {
      const diagnosticText = `No preventive care gaps identified. Diagnostic: Age ${age}, Gender "${patient.gender}", Diabetes: ${patient.hasDiabetes ? 'Yes' : 'No'}. If unexpected, check if details match any intervention criteria.`;
      container.innerHTML = `<p>${diagnosticText}</p>`;
    } else {
      container.innerHTML = '<ul>';
      // Process non-grouped first
      const grouped = {};
      Object.keys(GROUPS).forEach(groupName => {
        grouped[groupName] = [];
      });
      gaps.forEach(gap => {
        let isGrouped = false;
        Object.keys(GROUPS).forEach(groupName => {
          if (GROUPS[groupName].includes(gap.intervention)) {
            grouped[groupName].push(gap);
            isGrouped = true;
          }
        });
        if (!isGrouped) {
          const status = gap.addressed ? 'Addressed' : 'Unaddressed';
          let buttonHtml = '';
          if (!gap.addressed) {
            const safeIntervention = gap.intervention.replace(/'/g, "\\'");
            buttonHtml = `<button onclick="markGapAddressed('${patientId}', '${safeIntervention}', '${elementId}')">Mark Addressed</button>`;
          } else {
            const safeIntervention = gap.intervention.replace(/'/g, "\\'");
            const proofCount = gap.proofAttachments ? gap.proofAttachments.length : 0;
            buttonHtml = `<button onclick="markGapUnaddressed('${patientId}', '${safeIntervention}', '${elementId}')">Mark Unaddressed</button>`;
            buttonHtml += `<button onclick="addProofAttachment('${patientId}', '${safeIntervention}', '${elementId}')">Add Proof</button>`;
            if (proofCount > 0) {
              buttonHtml += `<button onclick="viewProofAttachments('${patientId}', '${safeIntervention}')">View Proof (${proofCount})</button>`;
            }
          }
          // Color coding for status
          const color = gap.addressed ? 'green' : 'red';
          container.innerHTML += `<li style="color: ${color};" title="${gap.frequency}">
            <div class="gap-text">${gap.intervention} (${gap.frequency}): ${status}</div>
            <div class="gap-buttons">${buttonHtml}</div>
          </li>`;
        }
      });
        // Process groups
      Object.keys(grouped).forEach(groupName => {
        const variants = grouped[groupName];
        if (variants.length > 0) {
          const addressedVariant = variants.find(v => v.addressed);
          let html = `<li style="color: ${addressedVariant ? 'green' : 'red'};" title="${addressedVariant ? addressedVariant.frequency : ''}">`;
          if (addressedVariant) {
            const proofCount = addressedVariant.proofAttachments ? addressedVariant.proofAttachments.length : 0;
            let buttonHtml = `<button onclick="markGapUnaddressed('${patientId}', '${addressedVariant.intervention.replace(/'/g, "\\'")}', '${elementId}')">Mark Unaddressed</button>`;
            buttonHtml += `<button onclick="addProofAttachment('${patientId}', '${addressedVariant.intervention.replace(/'/g, "\\'")}', '${elementId}')">Add Proof</button>`;
            if (proofCount > 0) {
              buttonHtml += `<button onclick="viewProofAttachments('${patientId}', '${addressedVariant.intervention.replace(/'/g, "\\'")}')">View Proof (${proofCount})</button>`;
            }
            html += `<div class="gap-text">${groupName}: Addressed with ${addressedVariant.intervention} (${addressedVariant.frequency})</div>`;
            html += `<div class="gap-buttons">${buttonHtml}</div>`;
          } else {
            let selectHtml = '<select id="select-' + groupName.replace(/\s/g, '') + '">';
            variants.forEach(v => {
              selectHtml += `<option value="${v.intervention}">${v.intervention} (${v.frequency})</option>`;
            });
            selectHtml += '</select>';
            let buttonHtml = `<button onclick="markGroupAddressed('${patientId}', '${groupName.replace(/\s/g, '')}', '${elementId}')">Mark Addressed</button>`;
            html += `<div class="gap-text">${groupName}: Unaddressed</div>`;
            html += `<div class="gap-buttons">${selectHtml} ${buttonHtml}</div>`;
          }
          html += '</li>';
          container.innerHTML += html;
        }
      });
      container.innerHTML += '</ul>';
    }
    
    // Ensure styling is applied after content is generated
    setTimeout(() => {
      ensurePreventiveGapsStyling();
    }, 100);
  } else {
    console.log('Container not found for gaps:', elementId);
  }
}

// Debug function to test gaps computation
window.debugGaps = function(patientId) {
  console.log('=== DEBUG GAPS FUNCTION ===');
  const { patients, storageKey } = getPatientsWithFallback();
  console.log('Total patients:', patients.length);
  console.log('Storage key:', storageKey);
  
  if (patientId) {
    // Check both id (display ID) and _supabaseUuid (UUID) fields for patient lookup
    const patient = patients.find(p => 
      p.id === patientId || 
      p.patient_id === patientId ||
      p._supabaseUuid === patientId ||
      p.patientNumber === patientId
    );
    if (patient) {
      console.log('Patient found:', patient);
      const age = calculateAge(patient.dob);
      console.log('Age:', age);
      const gaps = computeGaps(patient);
      console.log('Gaps:', gaps);
    } else {
      console.log('Patient not found with ID:', patientId);
    }
  } else {
    console.log('All patients:', patients);
  }
  console.log('=== END DEBUG GAPS ===');
};

// Function to mark a group as addressed (mark selected variant)
window.markGroupAddressed = function(patientId, groupId, elementId) {
  const select = document.getElementById('select-' + groupId);
  const selectedIntervention = select.value;
  markGapAddressed(patientId, selectedIntervention, elementId);
};

// Function to mark a gap as addressed
window.markGapAddressed = function(patientId, intervention, elementId) {
  const { patients, storageKey } = getPatientsWithFallback();
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  patient.preventiveGaps = patient.preventiveGaps || [];
  let gapEntry = patient.preventiveGaps.find(g => g.intervention === intervention);
  if (!gapEntry) {
    gapEntry = { intervention, addressed: true, markedDate: new Date().toISOString(), proofAttachments: [] };
    patient.preventiveGaps.push(gapEntry);
  } else {
    gapEntry.addressed = true;
    gapEntry.markedDate = new Date().toISOString();
    gapEntry.proofAttachments = gapEntry.proofAttachments || [];
  }
  localStorage.setItem(storageKey, JSON.stringify(patients));
  displayGaps(patientId, elementId);  // Refresh the list
  
  // Trigger custom event for real-time sync
  window.dispatchEvent(new CustomEvent('preventiveGapsUpdated', {
    detail: { patientId, intervention, action: 'markedAddressed' }
  }));
};

window.markGapUnaddressed = function(patientId, intervention, elementId) {
  const { patients, storageKey } = getPatientsWithFallback();
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  patient.preventiveGaps = patient.preventiveGaps || [];
  const gapIndex = patient.preventiveGaps.findIndex(g => g.intervention === intervention);
  if (gapIndex !== -1) {
    patient.preventiveGaps.splice(gapIndex, 1);
  }
  localStorage.setItem(storageKey, JSON.stringify(patients));
  displayGaps(patientId, elementId);  // Refresh the list
  
  // Trigger custom event for real-time sync
  window.dispatchEvent(new CustomEvent('preventiveGapsUpdated', {
    detail: { patientId, intervention, action: 'markedUnaddressed' }
  }));
};

// Function to add proof attachment to a gap
window.addProofAttachment = function(patientId, intervention, elementId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
  input.multiple = true;
  
  input.onchange = function(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const { patients, storageKey } = getPatientsWithFallback();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    patient.preventiveGaps = patient.preventiveGaps || [];
    let gapEntry = patient.preventiveGaps.find(g => g.intervention === intervention);
    if (!gapEntry) {
      gapEntry = { intervention, addressed: true, markedDate: new Date().toISOString(), proofAttachments: [] };
      patient.preventiveGaps.push(gapEntry);
    }
    gapEntry.proofAttachments = gapEntry.proofAttachments || [];
    
    // Process each file
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const attachment = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result,
          uploadedDate: new Date().toISOString()
        };
        gapEntry.proofAttachments.push(attachment);
        localStorage.setItem(storageKey, JSON.stringify(patients));
        displayGaps(patientId, elementId); // Refresh the display
        
        // Trigger custom event for real-time sync
        window.dispatchEvent(new CustomEvent('preventiveGapsUpdated', {
          detail: { patientId, intervention, action: 'attachmentAdded', attachmentName: file.name }
        }));
      };
      reader.readAsDataURL(file);
    });
  };
  
  input.click();
};

// Function to view proof attachments
window.viewProofAttachments = function(patientId, intervention) {
  const { patients } = getPatientsWithFallback();
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  const gapEntry = patient.preventiveGaps?.find(g => g.intervention === intervention);
  if (!gapEntry || !gapEntry.proofAttachments || gapEntry.proofAttachments.length === 0) {
    alert('No proof attachments found for this gap.');
    return;
  }
  
  // Create modal to display attachments
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
    align-items: center; justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 20px; border-radius: 8px; 
    max-width: 80%; max-height: 80%; overflow-y: auto;
  `;
  
  content.innerHTML = `
    <h3>Proof Attachments for: ${intervention}</h3>
    <div id="attachments-list"></div>
    <button onclick="this.closest('.modal').remove()" style="margin-top: 10px;">Close</button>
  `;
  
  const attachmentsList = content.querySelector('#attachments-list');
  
  gapEntry.proofAttachments.forEach(attachment => {
    const attachmentDiv = document.createElement('div');
    attachmentDiv.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px;';
    
    attachmentDiv.innerHTML = `
      <strong>${attachment.name}</strong> (${(attachment.size / 1024).toFixed(1)} KB)
      <br><small>Uploaded: ${new Date(attachment.uploadedDate).toLocaleDateString()}</small>
      <br>
      <button onclick="downloadAttachment('${attachment.id}', '${attachment.name}')">Download</button>
      <button onclick="deleteAttachment('${patientId}', '${intervention}', '${attachment.id}')" style="background: #dc3545;">Delete</button>
    `;
    
    attachmentsList.appendChild(attachmentDiv);
  });
  
  modal.className = 'modal';
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Close modal when clicking outside
  modal.onclick = function(e) {
    if (e.target === modal) modal.remove();
  };
};

// Function to download attachment
window.downloadAttachment = function(attachmentId, fileName) {
  const { patients } = getPatientsWithFallback();
  const patient = patients.find(p => p.preventiveGaps?.some(g => 
    g.proofAttachments?.some(a => a.id == attachmentId)
  ));
  
  if (!patient) return;
  
  const gap = patient.preventiveGaps.find(g => 
    g.proofAttachments?.some(a => a.id == attachmentId)
  );
  
  const attachment = gap.proofAttachments.find(a => a.id == attachmentId);
  if (!attachment) return;
  
  const link = document.createElement('a');
  link.href = attachment.data;
  link.download = fileName;
  link.click();
};

// Function to delete attachment
window.deleteAttachment = function(patientId, intervention, attachmentId) {
  if (!confirm('Are you sure you want to delete this attachment?')) return;
  
  const { patients, storageKey } = getPatientsWithFallback();
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;
  
  const gapEntry = patient.preventiveGaps?.find(g => g.intervention === intervention);
  if (!gapEntry || !gapEntry.proofAttachments) return;
  
  gapEntry.proofAttachments = gapEntry.proofAttachments.filter(a => a.id != attachmentId);
  localStorage.setItem(storageKey, JSON.stringify(patients));
  
  // Refresh the main gaps display
  const urlParams = new URLSearchParams(window.location.search);
  const elementId = urlParams.get("id") ? "gaps-section" : "preventive-gaps-list";
  displayGaps(patientId, elementId);
  
  // Trigger custom event for real-time sync
  window.dispatchEvent(new CustomEvent('preventiveGapsUpdated', {
    detail: { patientId, intervention, action: 'attachmentDeleted', attachmentId }
  }));
  
  // Refresh the modal
  const modal = document.querySelector('.modal');
  if (modal) {
    modal.remove();
    viewProofAttachments(patientId, intervention);
  }
};

// Aggregate gaps across all patients for summary (preventive-gaps.html)
function aggregateGaps() {
  const { patients } = getPatientsWithFallback();
  const summary = PREVENTIVE_INTERVENTIONS.map(int => {
    let totalRelevant = 0, addressed = 0, unaddressedPatients = [];
    patients.forEach(patient => {
      const age = calculateAge(patient.dob);
      const matchesAge = matchesAgeRange(age, int.ageRange);
      const baseGender = int.gender.split(' ')[0];  // Take first word as gender
      const matchesGender = (baseGender === 'Any') || (baseGender.toLowerCase() === patient.gender.toLowerCase());
      const hasDiabetes = patient.hasDiabetes ?? false; // Explicitly handle undefined
      const requiresDiabetes = int.gender.includes('with diabetes');
      const matchesDiabetes = !requiresDiabetes || hasDiabetes;
      if (matchesAge && matchesGender && matchesDiabetes) {
        totalRelevant++;
        const years = getFrequencyYears(int.frequency);
        const autoAddressed = hasRecentIntervention(patient, int.intervention, years);
        const gapEntry = patient.preventiveGaps?.find(g => g.intervention === int.intervention);
        const isAddressed = gapEntry ? gapEntry.addressed : autoAddressed;
        if (isAddressed) addressed++;
        else unaddressedPatients.push({ id: patient.id, name: `${patient.firstName} ${patient.lastName}` });
      }
    });
    return {
      intervention: int.intervention,
      totalRelevant,
      addressed,
      unaddressed: totalRelevant - addressed,
      unaddressedPatients
    };
  });
  return summary;
}