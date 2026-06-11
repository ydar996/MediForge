// Purpose: Medical specialties management for organization specialty selection
// Follows hybrid architecture: Supabase-first, localStorage fallback

// Comprehensive list of medical specialties
// Primary Care is first (default), followed by all other specialties
const MEDICAL_SPECIALTIES = [
  { name: "Primary Care", description: "General healthcare for all ages, focusing on prevention and common illnesses." },
  { name: "Addiction Medicine (Subspecialty)", description: "Prevention, evaluation, diagnosis, treatment, and recovery support for addiction disorders." },
  { name: "Adolescent Medicine (Subspecialty)", description: "Care for adolescents, including diagnostic and therapeutic services." },
  { name: "Adult Cardiac Anesthesiology (Subspecialty)", description: "Expertise in anesthesia for adults with advanced cardiac disease, including periprocedural care." },
  { name: "Aerospace Medicine", description: "Care for aviation and space travel-related health issues." },
  { name: "Allergy and Immunology", description: "Diagnoses and manages immune system disorders like asthma, allergies, anaphylaxis, eczema, and adverse reactions to drugs/foods/insects; also treats immune deficiencies, autoimmune diseases, transplantation issues, or immune malignancies." },
  { name: "Anesthesiology", description: "Provides anesthesia for surgical, obstetric, diagnostic, or therapeutic procedures; monitors vital functions; treats acute/chronic/cancer pain; manages critically ill/injured patients." },
  { name: "Bariatrics", description: "Causes, prevention, and treatment of obesity." },
  { name: "Cardiac Surgery (Subspecialty)", description: "Surgical treatment of heart and major blood vessels." },
  { name: "Cardiology (Subspecialty)", description: "Diseases of the cardiovascular system." },
  { name: "Cardiothoracic Surgery (Subspecialty)", description: "Surgical treatment of chest organs, including heart and lungs." },
  { name: "Child and Adolescent Psychiatry (Subspecialty)", description: "Mental health care for children and adolescents." },
  { name: "Addiction Psychiatry (Subspecialty)", description: "Diagnosis and treatment of substance use disorders and co-occurring psychiatric conditions." },
  { name: "Geriatric Psychiatry (Subspecialty)", description: "Mental health care for older adults, including dementia, depression, and age-related psychiatric conditions." },
  { name: "Consultation-Liaison Psychiatry (Subspecialty)", description: "Psychiatric care for patients with medical conditions, integrating mental health treatment with medical care (also known as Psychosomatic Medicine)." },
  { name: "Clinical Neurophysiology (Subspecialty)", description: "Diagnostic evaluation of nervous system function." },
  { name: "Colon and Rectal Surgery", description: "Diagnoses and treats diseases of the small intestine, colon, rectum, anal canal, perianal area, and related organs/tissues." },
  { name: "Critical Care Medicine (Subspecialty)", description: "Diagnoses and treats critical illnesses/injuries, especially trauma or multi-organ dysfunction; coordinates ICU care." },
  { name: "Dermatology", description: "Skin, hair, nail, and mucous membrane conditions." },
  { name: "Developmental Pediatrics (Subspecialty)", description: "Care for children with developmental disorders." },
  { name: "Emergency Medicine", description: "Initial management of acute and emergent medical conditions, often in ER or field settings." },
  { name: "Endocrinology (Subspecialty)", description: "Hormone-related disorders, including diabetes and thyroid diseases." },
  { name: "Family Medicine", description: "Comprehensive, continuing healthcare for individuals and families across all ages, integrating biological, clinical, and behavioral sciences." },
  { name: "Forensic Pathology (Subspecialty)", description: "Determination of cause of death through autopsy and analysis." },
  { name: "Forensic Psychiatry (Subspecialty)", description: "Mental health evaluations in legal contexts." },
  { name: "Gastroenterology (Subspecialty)", description: "Disorders of the digestive system and alimentary tract." },
  { name: "General Surgery", description: "Surgical treatment of a wide range of abdominal and other conditions." },
  { name: "Geriatrics (Subspecialty)", description: "Comprehensive care for elderly patients, focusing on aging-related issues." },
  { name: "Health Care Administration, Leadership, and Management (Subspecialty)", description: "Expertise in administrative functions, organizational effectiveness, process improvement, and patient safety in health care settings." },
  { name: "Hematology (Subspecialty)", description: "Blood disorders and malignancies." },
  { name: "Hospice and Palliative Medicine (Subspecialty)", description: "Care to prevent/relieve suffering in life-limiting illnesses; maximizes quality of life via interdisciplinary teams addressing physical, psychological, social, and spiritual needs." },
  { name: "Infectious Disease (Subspecialty)", description: "Diagnosis and management of infections and communicable diseases." },
  { name: "Internal Medicine", description: "Comprehensive adult medical care, including prevention, diagnosis, and treatment of complex illnesses." },
  { name: "Medical Genetics and Genomics", description: "Hereditary disorders, genetic counseling, and genomic medicine." },
  { name: "Nephrology (Subspecialty)", description: "Kidney diseases and hypertension." },
  { name: "Neurocritical Care (Subspecialty)", description: "Multisystem care for critically ill patients with neurological conditions." },
  { name: "Neurological Surgery", description: "Surgical treatment of brain, spine, and nervous system disorders." },
  { name: "Neurology", description: "Non-surgical treatment of nervous system disorders like stroke, epilepsy, and neurodegenerative diseases." },
  { name: "Nuclear Medicine", description: "Use of radioactive materials for diagnosis and therapy." },
  { name: "Obstetrics and Gynecology", description: "Women's reproductive health, pregnancy, and gynecological disorders." },
  { name: "Oncology (Subspecialty)", description: "Cancer diagnosis, treatment, and management." },
  { name: "Ophthalmology", description: "Eye diseases, vision care, and surgical interventions." },
  { name: "Orthopedic Surgery", description: "Musculoskeletal issues, including bones, joints, and trauma." },
  { name: "Otolaryngology – Head and Neck Surgery (ENT)", description: "Disorders of the ear, nose, throat, head, and neck." },
  { name: "Pain Medicine (Subspecialty)", description: "Diagnosis and treatment of acute, chronic, or cancer-related pain in various settings." },
  { name: "Pathology", description: "Diagnosis of diseases through analysis of tissues, cells, and fluids." },
  { name: "Pediatrics", description: "Comprehensive health care for infants, children, and adolescents." },
  { name: "Pediatric Anesthesiology (Subspecialty)", description: "Anesthesia for neonates, infants, children, and adolescents, including pre/post-operative care and pain management." },
  { name: "Physical Medicine and Rehabilitation", description: "Rehabilitation for disabilities, injuries, and functional impairments." },
  { name: "Plastic Surgery", description: "Reconstructive and cosmetic surgical procedures." },
  { name: "Podiatry", description: "Foot and ankle problems (non-ABMS, but common referral)." },
  { name: "Preventive Medicine", description: "Disease prevention, health promotion, and public health." },
  { name: "Psychiatry", description: "Mental health, emotional, and behavioral disorders." },
  { name: "Clinical Psychology", description: "Assessment, diagnosis, and treatment of mental health conditions through psychotherapy and psychological testing (PhD/PsyD)." },
  { name: "Licensed Clinical Social Work (LCSW)", description: "Therapy and counseling services addressing mental health, social, and environmental factors affecting individuals, families, and groups." },
  { name: "Licensed Professional Counseling (LPC)", description: "Therapy and counseling for a range of mental health issues, working with individuals, families, and groups." },
  { name: "Marriage and Family Therapy (MFT)", description: "Specialized therapy focusing on relationship dynamics, marital issues, and family systems." },
  { name: "Psychiatric/Mental Health Nurse Practitioner", description: "Advanced practice nursing with specialized training in mental health assessment, diagnosis, treatment, and medication management." },
  { name: "Clinical Mental Health Counseling", description: "Comprehensive counseling services for various mental health concerns, including individual, group, and family therapy." },
  { name: "Pulmonology (Subspecialty)", description: "Lung and respiratory system diseases." },
  { name: "Radiation Oncology", description: "Cancer treatment using radiation therapy." },
  { name: "Radiology", description: "Diagnostic imaging and interventional procedures using X-rays, MRI, CT, etc." },
  { name: "Rheumatology (Subspecialty)", description: "Autoimmune diseases, arthritis, and musculoskeletal disorders." },
  { name: "Sleep Medicine (Subspecialty)", description: "Diagnosis and management of sleep disorders, including polysomnography and sleep lab oversight." },
  { name: "Thoracic Surgery", description: "Surgical treatment of heart, lungs, esophagus, and chest wall." },
  { name: "Urology", description: "Urinary tract disorders and male reproductive issues." },
  { name: "Vascular Surgery", description: "Surgical treatment of diseases affecting the vascular system (arteries, veins, and lymphatic circulation)." },
  { name: "Pediatric Surgery", description: "Surgical care for infants, children, and adolescents, including congenital anomalies and pediatric trauma." },
  { name: "Sports Medicine", description: "Prevention, diagnosis, and treatment of injuries related to sports and exercise, including performance optimization." },
  { name: "Interventional Radiology", description: "Minimally invasive image-guided procedures for diagnosis and treatment, using X-rays, CT, MRI, and ultrasound." },
  { name: "Trauma Surgery", description: "Surgical management of acute injuries, including life-threatening trauma and emergency surgical procedures." },
  { name: "Transplant Surgery", description: "Surgical procedures for organ transplantation, including pre-transplant evaluation and post-transplant care." },
  { name: "Surgical Oncology", description: "Surgical treatment of cancer, including tumor removal and reconstructive procedures." },
  { name: "Pediatric Cardiology", description: "Diagnosis and treatment of heart conditions in infants, children, and adolescents." },
  { name: "Pediatric Emergency Medicine", description: "Emergency care for acutely ill or injured children and adolescents." },
  { name: "Maternal-Fetal Medicine", description: "High-risk pregnancy care, including management of maternal and fetal complications." },
  { name: "Reproductive Endocrinology and Infertility", description: "Diagnosis and treatment of hormonal disorders affecting reproduction and fertility." }
];

/**
 * Helper function to resolve organization ID (handles both UUID and name strings)
 * @param {string} orgId - Organization ID (UUID) or name
 * @returns {Promise<string|null>} Resolved UUID or null if not found
 */
async function resolveOrgId(orgId) {
  if (!orgId) return null;
  
  // If it's already a UUID (contains hyphens and is long), return it
  if (orgId.includes('-') && orgId.length > 30) {
    return orgId;
  }
  
  // Otherwise, it's a name - try to resolve to UUID
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from('organizations')
        .select('id')
        .eq('name', orgId)
        .maybeSingle();
      
      if (!error && data && data.id) {
        return data.id;
      }
    } catch (error) {
      console.warn('Error resolving org name to UUID:', error);
    }
  }
  
  // If we can't resolve, return null (will use name as fallback)
  return null;
}

/**
 * Get the current organization's medical specialty
 * Follows hybrid architecture: Supabase-first, localStorage fallback
 * @returns {Promise<string>} The medical specialty name, defaults to "Primary Care"
 */
window.getOrganizationSpecialty = async function() {
  try {
    // Get current user and organization
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let orgId = user.organizationId || user.organization_id || user.org;

    if (!orgId) {
      console.warn('No organization ID found, defaulting to Primary Care');
      return 'Primary Care';
    }

    // Try to resolve to UUID if it's a name
    const resolvedOrgId = await resolveOrgId(orgId);
    const queryOrgId = resolvedOrgId || orgId;

    // Try Supabase first
    if (window.supabaseClient) {
      // Try by UUID first if we have it
      let query = window.supabaseClient
        .from('organizations')
        .select('medical_specialty');
      
      if (resolvedOrgId) {
        query = query.eq('id', resolvedOrgId);
      } else {
        // Fallback to name if UUID not available
        query = query.eq('name', orgId);
      }
      
      const { data, error } = await query.maybeSingle();

      if (!error && data && data.medical_specialty) {
        // Cache in localStorage for fallback
        localStorage.setItem(`org_${orgId}_specialty`, data.medical_specialty);
        return data.medical_specialty;
      }
    }

    // Fallback to localStorage
    const cachedSpecialty = localStorage.getItem(`org_${orgId}_specialty`);
    if (cachedSpecialty) {
      return cachedSpecialty;
    }

    // Default to Primary Care
    return 'Primary Care';
  } catch (error) {
    console.warn('Error getting organization specialty:', error);
    // Fallback to localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id || user.org;
    const cachedSpecialty = orgId ? localStorage.getItem(`org_${orgId}_specialty`) : null;
    return cachedSpecialty || 'Primary Care';
  }
};

/**
 * Save the organization's medical specialty
 * Follows hybrid architecture: Supabase-first, localStorage fallback
 * @param {string} specialty - The medical specialty name to save
 * @returns {Promise<boolean>} True if saved successfully, false otherwise
 */
window.saveOrganizationSpecialty = async function(specialty) {
  try {
    // Get current user and organization
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let orgId = user.organizationId || user.organization_id || user.org;

    if (!orgId) {
      console.error('No organization ID found, cannot save specialty');
      return false;
    }

    // Validate specialty
    if (!specialty || typeof specialty !== 'string') {
      console.error('Invalid specialty provided');
      return false;
    }

    // Try to resolve to UUID if it's a name
    const resolvedOrgId = await resolveOrgId(orgId);
    const queryOrgId = resolvedOrgId || orgId;

    // Try Supabase first
    if (window.supabaseClient) {
      let query = window.supabaseClient
        .from('organizations')
        .update({ medical_specialty: specialty, first_login_specialty_set: true });
      
      if (resolvedOrgId) {
        query = query.eq('id', resolvedOrgId);
      } else {
        // Fallback to name if UUID not available
        query = query.eq('name', orgId);
      }
      
      const { error } = await query;

      if (!error) {
        // Cache in localStorage for fallback
        localStorage.setItem(`org_${orgId}_specialty`, specialty);
        localStorage.setItem(`org_${orgId}_specialty_set`, 'true');
        console.log('Specialty saved to Supabase:', specialty);
        return true;
      } else {
        console.warn('Error saving to Supabase, falling back to localStorage:', error);
      }
    }

    // Fallback to localStorage
    localStorage.setItem(`org_${orgId}_specialty`, specialty);
    localStorage.setItem(`org_${orgId}_specialty_set`, 'true');
    console.log('Specialty saved to localStorage:', specialty);
    return true;
  } catch (error) {
    console.error('Error saving organization specialty:', error);
    // Still try localStorage fallback
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const orgId = user.organizationId || user.organization_id || user.org;
      if (orgId) {
        localStorage.setItem(`org_${orgId}_specialty`, specialty);
        localStorage.setItem(`org_${orgId}_specialty_set`, 'true');
        return true;
      }
    } catch (e) {
      console.error('Error with localStorage fallback:', e);
    }
    return false;
  }
};

/**
 * Check if the organization's specialty has been explicitly set
 * Used to determine if this is a first login
 * @returns {Promise<boolean>} True if specialty was set, false if it's still default
 */
window.hasOrganizationSpecialtySet = async function() {
  try {
    // Get current user and organization
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id || user.org;

    if (!orgId) {
      // No org ID - assume set to avoid blocking (safer)
      return true;
    }

    // Check localStorage flag first (faster)
    const setFlag = localStorage.getItem(`org_${orgId}_specialty_set`);
    if (setFlag === 'true') {
      return true;
    }

    // Check Supabase for explicit setting
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from('organizations')
        .select('medical_specialty, first_login_specialty_set')
        .eq('id', orgId)
        .maybeSingle();

      if (!error && data) {
        // If first_login_specialty_set flag is true, specialty was explicitly set
        if (data.first_login_specialty_set === true) {
          localStorage.setItem(`org_${orgId}_specialty_set`, 'true');
          return true;
        }
        
        // If medical_specialty exists and is not null, consider it set
        // This handles existing organizations that got default "Primary Care" from migration
        // We assume if the column exists and has a value, it's been set (even if default)
        if (data.medical_specialty && data.medical_specialty.trim() !== '') {
          // Column exists and has value - assume it's set (safer to not force redirect)
          // Cache the flag to avoid repeated checks
          localStorage.setItem(`org_${orgId}_specialty_set`, 'true');
          return true;
        }
      } else if (error) {
        // If there's an error querying Supabase, assume set to avoid blocking
        console.warn('Error querying specialty status, assuming set:', error);
        return true;
      }
    }

    // If we can't determine, assume set to avoid blocking dashboard
    // This is safer - we don't want to force redirects on existing users
    return true;
  } catch (error) {
    console.warn('Error checking if specialty is set, assuming set to avoid blocking:', error);
    // On error, assume set (safer - won't block dashboard)
    return true;
  }
};

/**
 * Mark specialty as explicitly set (for first-login detection)
 * @returns {Promise<boolean>} True if marked successfully
 */
window.markSpecialtyAsSet = async function() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id || user.org;

    if (!orgId) {
      return false;
    }

    // Set localStorage flag
    localStorage.setItem(`org_${orgId}_specialty_set`, 'true');

    // Try to set Supabase flag (if column exists)
    if (window.supabaseClient) {
      try {
        await window.supabaseClient
          .from('organizations')
          .update({ first_login_specialty_set: true })
          .eq('id', orgId);
      } catch (e) {
        // Column might not exist yet, that's okay
        console.warn('Could not set first_login_specialty_set flag (column may not exist):', e);
      }
    }

    return true;
  } catch (error) {
    console.error('Error marking specialty as set:', error);
    return false;
  }
};

/**
 * Get specialty description by name
 * @param {string} specialtyName - The name of the specialty
 * @returns {string} The description, or empty string if not found
 */
window.getSpecialtyDescription = function(specialtyName) {
  const specialty = MEDICAL_SPECIALTIES.find(s => s.name === specialtyName);
  return specialty ? specialty.description : '';
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MEDICAL_SPECIALTIES,
    getOrganizationSpecialty: window.getOrganizationSpecialty,
    saveOrganizationSpecialty: window.saveOrganizationSpecialty,
    hasOrganizationSpecialtySet: window.hasOrganizationSpecialtySet,
    markSpecialtyAsSet: window.markSpecialtyAsSet,
    getSpecialtyDescription: window.getSpecialtyDescription
  };
}

