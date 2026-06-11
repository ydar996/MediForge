// Purpose: Appointment Type Management
// Dynamically loads appointment types from billing services + standard types

const LEGACY_NAME_PREFIX = 'legacy-n:';

/**
 * Whether a standard appointment type "name" option matches stored appointment data.
 * Keeps "Lab Intervention - Laboratory Test Appointment" selected for legacy labels like "Lab Intervention".
 * Does not map individual catalog lab rows to the consolidated lab type (legacy rows stay on record until edited).
 */
window.appointmentTypeSelectMatches = function(storedName, storedId, type) {
  if (!type) return false;
  const n = (storedName != null ? String(storedName) : '').trim();
  const i = (storedId != null && storedId !== undefined) ? String(storedId).trim() : '';
  if (i && type.id && i === String(type.id)) return true;
  if (n && type.name && n === type.name) return true;
  if (type.id === 'follow-up-visit') {
    const norm = n.toLowerCase().replace(/[\s-]+/g, ' ').trim();
    if (norm === 'follow up visit' || norm === 'followup visit') return true;
  }
  if (type.id === 'general-consultation') {
    const norm = n.toLowerCase().replace(/[\s-]+/g, ' ').trim();
    if (norm === 'general consultation') return true;
  }
  if (type.id === 'blood-pressure-check') {
    const low = n.toLowerCase();
    if (low.includes('blood') && low.includes('pressure') && (low.includes('check') || low.includes('vital'))) return true;
  }
  if (type.id === 'lab-intervention') {
    const low = n.toLowerCase();
    if (low === 'lab intervention' || low === 'labintervention') return true;
    if (low.includes('lab intervention')) return true;
    if (n === 'Lab Intervention - Laboratory Test Appointment') return true;
    if (low.includes('laboratory test appointment') && low.includes('lab')) return true;
  }
  return false;
};

/**
 * Ensure the edit / modal type select can show a value not in the current catalog (e.g. old laboratory line items).
 */
window.applyAppointmentTypeToSelect = async function(typeSelect, appointment) {
  if (!typeSelect) return;
  const at = appointment && appointment.appointment_type != null
    ? String(appointment.appointment_type).trim()
    : '';
  const tid = (() => {
    const v = appointment && (appointment.appointment_type_id != null
      ? appointment.appointment_type_id
      : appointment.appointmentType);
    if (v == null || v === undefined) return '';
    return String(v).trim();
  })();
  typeSelect.querySelectorAll('optgroup[data-legacy-appt]').forEach(og => og.remove());

  const types = await window.getAppointmentTypes();
  const m = types.find(t => window.appointmentTypeSelectMatches(at, tid, t));
  if (m) {
    typeSelect.value = m.id;
    return;
  }
  if (tid) {
    const hasOption = Array.from(typeSelect.options).some(o => o.value === tid);
    if (hasOption) {
      typeSelect.value = tid;
      return;
    }
    const tFromPricing = await window.getAppointmentTypeById(tid);
    if (tFromPricing) {
      const og = document.createElement('optgroup');
      og.label = 'Saved on record (legacy)';
      og.setAttribute('data-legacy-appt', '1');
      const opt = document.createElement('option');
      opt.value = tid;
      opt.textContent = tFromPricing.name || at || tid;
      opt.selected = true;
      og.appendChild(opt);
      typeSelect.appendChild(og);
      typeSelect.value = tid;
      return;
    }
    if (at || tid) {
      const og = document.createElement('optgroup');
      og.label = 'Saved on record (legacy)';
      og.setAttribute('data-legacy-appt', '1');
      const opt = document.createElement('option');
      opt.value = tid;
      opt.textContent = at || tid;
      opt.selected = true;
      og.appendChild(opt);
      typeSelect.appendChild(og);
      typeSelect.value = tid;
      return;
    }
  }
  if (at) {
    const legVal = LEGACY_NAME_PREFIX + encodeURIComponent(at);
    const og = document.createElement('optgroup');
    og.label = 'Saved on record (legacy)';
    og.setAttribute('data-legacy-appt', '1');
    const opt = document.createElement('option');
    opt.value = legVal;
    opt.textContent = at;
    opt.selected = true;
    og.appendChild(opt);
    typeSelect.appendChild(og);
    typeSelect.value = legVal;
  }
};

/**
 * Get all available appointment types
 * Combines standard types with billing services
 */
window.getAppointmentTypes = async function() {
  const standardTypes = [
    {
      id: 'general-consultation',
      name: 'General Consultation',
      code: 'CONS-GEN',
      category: 'Consultation',
      isStandard: true,
      requiresClinicalNote: true,
      description: 'Initial medical consultation'
    },
    {
      id: 'follow-up-visit',
      name: 'Follow up Visit',
      code: 'CONS-FUP',
      category: 'Consultation',
      isStandard: true,
      requiresClinicalNote: true,
      description: 'Subsequent visit to review or continue care'
    },
    {
      id: 'lab-intervention',
      name: 'Lab Intervention - Laboratory Test Appointment',
      code: 'LAB-INT',
      category: 'Laboratory',
      isStandard: true,
      requiresClinicalNote: false,
      requiresLabNote: true,
      description: ''
    },
    {
      id: 'blood-pressure-check',
      name: 'Blood Pressure Check',
      code: 'VIT-BP',
      category: 'Vitals',
      isStandard: true,
      requiresClinicalNote: false,
      requiresBpNote: true,
      description: 'Blood pressure monitoring and vitals check'
    }
  ];

  // Load billing services and convert to appointment types (exclude Laboratory — single standard lab type only)
  let billingServiceTypes = [];
  if (typeof window.getPricingCatalog === 'function') {
    try {
      const catalog = window.getPricingCatalog();
      // Handle both sync and async getPricingCatalog
      const catalogData = catalog instanceof Promise ? await catalog : catalog;
      if (Array.isArray(catalogData)) {
        billingServiceTypes = catalogData
          .filter(service => service.active !== false)
          .filter(service => (service.category || '').trim().toLowerCase() !== 'laboratory')
          .map(service => ({
            id: `service-${service.id}`,
            name: service.name,
            code: service.code || `SRV-${service.id}`,
            category: service.category || 'Other',
            isStandard: false,
            requiresClinicalNote: false,
            description: service.description || service.name,
            serviceId: service.id,
            price: service.price,
            currency: service.currency
          }));
      }
    } catch (error) {
      console.error('Error loading billing services for appointment types:', error);
    }
  }

  // Combine standard types with billing services
  // Standard types appear first, then billing services
  return [...standardTypes, ...billingServiceTypes];
};

/**
 * Resolve a single service row from the pricing catalog (for legacy appointment_type_id not in the combined list)
 */
async function getPricingServiceForAppointmentTypeId(typeId) {
  if (!typeId || String(typeId).indexOf(LEGACY_NAME_PREFIX) === 0) return null;
  if (!String(typeId).startsWith('service-')) return null;
  if (typeof window.getPricingCatalog !== 'function') return null;
  const raw = window.getPricingCatalog();
  const catalogData = raw instanceof Promise ? await raw : raw;
  if (!Array.isArray(catalogData)) return null;
  const serviceId = String(typeId).replace(/^service-/, '');
  return catalogData.find(s => String(s.id) === serviceId) || null;
}

/**
 * Get appointment type by ID
 */
window.getAppointmentTypeById = async function(typeId) {
  if (typeId == null || typeId === '') return null;
  if (String(typeId).indexOf(LEGACY_NAME_PREFIX) === 0) {
    const name = decodeURIComponent(String(typeId).slice(LEGACY_NAME_PREFIX.length));
    return {
      id: typeId,
      name,
      isLegacy: true
    };
  }
  const types = await window.getAppointmentTypes();
  const fromList = types.find(t => t.id === typeId);
  if (fromList) return fromList;
  const service = await getPricingServiceForAppointmentTypeId(typeId);
  if (service) {
    return {
      id: typeId,
      name: service.name,
      code: service.code,
      category: service.category,
      isStandard: false,
      description: service.description || service.name,
      serviceId: service.id
    };
  }
  return null;
};

const STANDARD_TYPE_FLAGS = {
  'general-consultation': { requiresClinicalNote: true, requiresLabNote: false, requiresBpNote: false },
  'follow-up-visit': { requiresClinicalNote: true, requiresLabNote: false, requiresBpNote: false },
  'lab-intervention': { requiresClinicalNote: false, requiresLabNote: true, requiresBpNote: false },
  'blood-pressure-check': { requiresClinicalNote: false, requiresLabNote: false, requiresBpNote: true }
};

/**
 * Check if appointment type requires clinical note
 */
window.appointmentTypeRequiresClinicalNote = function(typeId) {
  if (!typeId) return false;
  const t = STANDARD_TYPE_FLAGS[typeId];
  return t ? t.requiresClinicalNote === true : false;
};

/**
 * Check if appointment type requires lab note
 */
window.appointmentTypeRequiresLabNote = function(typeId) {
  if (!typeId) return false;
  const t = STANDARD_TYPE_FLAGS[typeId];
  return t ? t.requiresLabNote === true : false;
};

/**
 * Get note type for appointment type
 * Returns: 'clinical-note', 'lab-intervention-note', 'blood-pressure-check-note', or null
 */
window.getNoteTypeForAppointment = async function(typeId) {
  const type = await window.getAppointmentTypeById(typeId);
  if (!type) return null;
  
  if (type.requiresLabNote) {
    return 'lab-intervention-note';
  } else if (type.requiresBpNote) {
    return 'blood-pressure-check-note';
  } else if (type.requiresClinicalNote) {
    return 'clinical-note';
  }
  if (String(typeId).startsWith('service-') && (type.category || '').toLowerCase() === 'laboratory') {
    return 'lab-intervention-note';
  }
  // For other service types, use clinical note template for now
  // (as per user requirement: "they may remain as the clinical note template for now")
  return 'clinical-note';
};

console.log('✅ Appointment types module loaded');

