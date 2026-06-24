/**
 * MediForge bulk patient import: CSV and Excel (.xlsx).
 * Template mode: flexible header matching. Map mode: user maps columns + extras → Notes.
 */
(function () {
  'use strict';

  const IMPORT_PLACEHOLDER_DOB = '1900-01-01';
  const MAP_SKIP = '__skip__';
  const MAP_NOTES = '__notes__';

  const FIELD_LABELS = {
    patientId: 'Patient ID / chart number',
    firstName: 'First name',
    middleName: 'Middle name',
    lastName: 'Last name',
    dob: 'Date of birth',
    gender: 'Gender / sex',
    maritalStatus: 'Marital status',
    race: 'Race / ethnicity',
    email: 'Email',
    phone: 'Phone',
    phoneCountryCode: 'Phone country code',
    addressLine1: 'Street address',
    addressLine2: 'Address line 2',
    city: 'City',
    state: 'Province / state',
    country: 'Country',
    postalCode: 'Postal / ZIP code',
    emergencyFirstName: 'Emergency contact first name',
    emergencyLastName: 'Emergency contact last name',
    emergencyRelationship: 'Emergency contact relationship',
    emergencyPhone: 'Emergency contact phone',
    emergencyEmail: 'Emergency contact email',
    emergencyAddressLine1: 'Emergency contact address',
    emergencyCity: 'Emergency contact city',
    emergencyState: 'Emergency contact province/state',
    emergencyCountry: 'Emergency contact country',
    hasDiabetes: 'Has diabetes',
    paymentSource: 'Primary payer / payment source',
    province: 'Health card province',
    healthCardNumber: 'Health card number (PHN)',
    healthCardVersion: 'Health card version code',
    insuranceName: 'Insurance company',
    insuranceMemberNumber: 'Insurance member number',
    insurancePolicyGroupNumber: 'Insurance policy / group number',
    wcbClaimNumber: 'WCB / workers comp claim number',
    preferredPaymentMethod: 'Preferred payment method',
    medicalHistory: 'Medical history',
    medications: 'Medications',
    allergies: 'Allergies',
    immunizations: 'Immunizations',
    diagnoses: 'Diagnoses',
    notes: 'Notes / comments',
    enrolledPhysician: 'Enrolled Physician',
    enrolmentStatus: 'Status Enrolment',
    showEmailOnConsults: 'Show Email on Consults',
    dateJoinedPractice: 'Date Joined Practice',
    healthCardEffectiveDate: 'Health Insurance Card Effective Date',
    assignedPhysicianMrp: 'Assigned Physician MRP'
  };

  const HEADER_ALIASES = {
    patientId: [
      'record id', 'patient id', 'patientid', 'patient_id', 'mrn', 'file number',
      'file no', 'chart number', 'chart no', 'medical record number', 'record number'
    ],
    firstName: ['first name', 'firstname', 'first', 'given name', 'fname'],
    middleName: ['middle name', 'middlename', 'middle', 'mname'],
    lastName: ['last name', 'lastname', 'last', 'surname', 'family name', 'lname'],
    dob: ['age dob', 'age (dob)', 'dob', 'date of birth', 'dateofbirth', 'birth date', 'birthdate', 'birthday'],
    gender: ['gender', 'sex'],
    maritalStatus: ['marital status', 'maritalstatus', 'marital'],
    race: ['race', 'ethnicity'],
    email: ['email', 'e-mail', 'email address'],
    phone: ['phone h preferred', 'phone(h) preferred', 'phone', 'telephone', 'mobile', 'cell', 'phone number'],
    phoneCountryCode: ['phone country code', 'phone country', 'country code'],
    addressLine1: ['address line 1', 'addressline1', 'address', 'street', 'street address'],
    addressLine2: ['address line 2', 'addressline2', 'address 2', 'unit', 'apt'],
    city: ['city', 'town'],
    state: ['state', 'province', 'state/province', 'region', 'state province'],
    country: ['country', 'nation'],
    postalCode: ['postal code', 'postalcode', 'postal', 'zip', 'zip code', 'postcode'],
    emergencyFirstName: [
      'emergency contact first name', 'emergency first name', 'ec first name',
      'next of kin first name', 'nok first name'
    ],
    emergencyLastName: [
      'emergency contact last name', 'emergency last name', 'ec last name',
      'next of kin last name', 'nok last name'
    ],
    emergencyRelationship: ['emergency relationship', 'emergency contact relationship', 'relationship', 'ec relationship'],
    emergencyPhone: ['emergency phone', 'emergency contact phone', 'ec phone', 'nok phone'],
    emergencyEmail: ['emergency email', 'emergency contact email', 'ec email'],
    emergencyAddressLine1: ['emergency address', 'emergency address line 1', 'ec address'],
    emergencyCity: ['emergency city', 'ec city'],
    emergencyState: ['emergency state', 'emergency province', 'ec state'],
    emergencyCountry: ['emergency country', 'ec country'],
    hasDiabetes: ['has diabetes', 'diabetes', 'diabetic'],
    paymentSource: [
      'primary payer', 'payment source', 'payer', 'insurance type', 'coverage type'
    ],
    province: ['province (health card)', 'health card province', 'card province'],
    healthCardNumber: [
      'health ins', 'health ins #', 'health insurance', 'health insurance number',
      'health card number', 'phn', 'ohip', 'ramq', 'msp number'
    ],
    healthCardVersion: ['health card type', 'card type', 'health card version', 'version code', 'card version'],
    insuranceName: ['insurance company', 'insurance name', 'insurer', 'plan name'],
    insuranceMemberNumber: ['insurance member number', 'member number', 'certificate number', 'policy member'],
    insurancePolicyGroupNumber: ['insurance policy group', 'policy group', 'group number', 'policy number'],
    wcbClaimNumber: ['wcb claim number', 'wcb number', 'workers comp claim', 'wcb file'],
    preferredPaymentMethod: ['preferred payment method', 'payment method'],
    medicalHistory: ['medical history', 'history', 'past medical history', 'pmh'],
    medications: ['medications', 'meds', 'current medications', 'drugs'],
    allergies: ['allergies', 'allergy', 'drug allergies'],
    immunizations: ['immunizations', 'vaccines', 'vaccinations'],
    diagnoses: ['diagnoses', 'diagnosis', 'active diagnoses', 'problems'],
    notes: ['notes', 'comments', 'remarks', 'import notes'],
    enrolledPhysician: [
      'enrolled physician', 'enrollment physician', 'enrolment physician', 'enrolling physician'
    ],
    enrolmentStatus: [
      'status enrolment', 'enrolment status', 'enrollment status', 'patient status', 'enrollment status'
    ],
    showEmailOnConsults: [
      'show email on consults', 'eorder email consent', 'show email on consult', 'email on consults'
    ],
    dateJoinedPractice: [
      'date joined practice', 'date joined', 'joined practice', 'practice join date'
    ],
    healthCardEffectiveDate: [
      'health insurance card effective date', 'health card effective date', 'effective date',
      'card effective date', 'insurance effective date'
    ],
    assignedPhysicianMrp: [
      'assigned physician mrp', 'physician mrp', 'mrp', 'most responsible physician', 'physician/mrp'
    ]
  };

  function normalizeHeaderKey(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[\u2018\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scoreHeaderMatch(normHeader, alias, field) {
    if (!normHeader || !alias) return 0;
    if (normHeader === alias) return 1000;

    if (field === 'healthCardNumber') {
      if (/type|version|renew|effective|physician|mrp|enrollment|enrolment|joined|consent|email/.test(normHeader)) return 0;
      if (/health ins|phn|ohip|ramq|msp/.test(normHeader)) return 920;
      if (normHeader.indexOf('health card') !== -1 && normHeader.indexOf('type') === -1) return 500;
    }
    if (field === 'healthCardVersion') {
      if (/health card type|card type|version code/.test(normHeader)) return 920;
      if (/number|#|health ins/.test(normHeader) && normHeader.indexOf('version') === -1) return 0;
    }
    if (field === 'patientId') {
      if (normHeader === 'record id' || normHeader === 'record number') return 950;
      if (normHeader === 'id') return 120;
    }
    if (field === 'dob') {
      if (/age.*dob|dob.*age/.test(normHeader)) return 930;
    }
    if (field === 'dateJoinedPractice') {
      if (/date joined|joined practice/.test(normHeader)) return 940;
    }
    if (field === 'healthCardEffectiveDate') {
      if (/effective date|card effective/.test(normHeader)) return 930;
    }
    if (field === 'assignedPhysicianMrp') {
      if (/mrp|most responsible/.test(normHeader)) return 900;
    }
    if (field === 'enrolledPhysician') {
      if (/enroll.*physician|enrol.*physician/.test(normHeader)) return 900;
    }
    if (field === 'enrolmentStatus') {
      if (/enrol.*status|enrollment status|patient status/.test(normHeader)) return 880;
    }
    if (field === 'showEmailOnConsults') {
      if (/show email|email.*consult|eorder email/.test(normHeader)) return 900;
    }
    if (field === 'state') {
      if (normHeader === 'province' && normHeader.indexOf('health') === -1) return 880;
    }
    if (field === 'province') {
      if (normHeader === 'province') return 0;
      if (normHeader.indexOf('health') !== -1) return 850;
    }
    if (field === 'postalCode' && normHeader === 'postal') return 900;
    if (field === 'phone' && normHeader.indexOf('phone') !== -1) return 750;

    if (normHeader.indexOf(alias) !== -1 && alias.length >= 3) {
      return 300 + alias.length;
    }
    if (alias.indexOf(normHeader) !== -1 && normHeader.length >= 3) {
      return 200 + normHeader.length;
    }
    return 0;
  }

  function mapHeaders(headers) {
    const normalized = headers.map(normalizeHeaderKey);
    const candidates = [];
    Object.keys(HEADER_ALIASES).forEach(function (field) {
      HEADER_ALIASES[field].forEach(function (alias) {
        normalized.forEach(function (h, idx) {
          const score = scoreHeaderMatch(h, alias, field);
          if (score > 0) candidates.push({ field: field, idx: idx, score: score });
        });
      });
    });
    candidates.sort(function (a, b) { return b.score - a.score; });
    const fieldUsed = {};
    const colUsed = {};
    const mapping = {};
    candidates.forEach(function (c) {
      if (fieldUsed[c.field] !== undefined || colUsed[c.idx] !== undefined) return;
      fieldUsed[c.field] = c.idx;
      colUsed[c.idx] = c.field;
      mapping[c.field] = c.idx;
    });
    return mapping;
  }

  function suggestColumnMappings(headers, defaultUnmappedToNotes) {
    const headerMap = mapHeaders(headers);
    const colToField = {};
    Object.keys(headerMap).forEach(function (field) {
      colToField[headerMap[field]] = field;
    });
    return headers.map(function (h, idx) {
      if (colToField[idx]) return colToField[idx];
      return defaultUnmappedToNotes ? MAP_NOTES : MAP_SKIP;
    });
  }

  function buildParseConfig(headers, columnMappings) {
    const headerMap = {};
    const notesColumns = [];
    const usedFields = {};
    columnMappings.forEach(function (target, colIdx) {
      if (target === MAP_SKIP) return;
      if (target === MAP_NOTES) {
        notesColumns.push(colIdx);
        return;
      }
      if (usedFields[target]) {
        notesColumns.push(colIdx);
        return;
      }
      usedFields[target] = true;
      headerMap[target] = colIdx;
    });
    return { headerMap: headerMap, notesColumns: notesColumns, headers: headers };
  }

  function collectNotesFromColumns(rawRow, headers, notesColumns) {
    const parts = [];
    notesColumns.forEach(function (colIdx) {
      const val = cellVal(rawRow, colIdx);
      if (!val) return;
      const label = headers[colIdx] || ('Column ' + (colIdx + 1));
      parts.push(label + ': ' + val);
    });
    return parts.join('; ');
  }

  function cellVal(row, idx) {
    if (idx === undefined || idx === null) return '';
    const v = row[idx];
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return formatDateIso(v);
    return String(v).trim();
  }

  function formatDateIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parseFlexibleDate(raw) {
    if (!raw) return '';
    if (raw instanceof Date && !isNaN(raw.getTime())) return formatDateIso(raw);
    const s = String(raw).trim();
    if (!s) return '';
    const parenIso = s.match(/\((\d{4}-\d{2}-\d{2})\)/);
    if (parenIso) return parenIso[1];
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (mdy) {
      let y = parseInt(mdy[3], 10);
      if (y < 100) y += y > 30 ? 1900 : 2000;
      const mo = String(parseInt(mdy[1], 10)).padStart(2, '0');
      const da = String(parseInt(mdy[2], 10)).padStart(2, '0');
      return y + '-' + mo + '-' + da;
    }
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy && parseInt(dmy[2], 10) <= 12) {
      return dmy[3] + '-' + String(parseInt(dmy[2], 10)).padStart(2, '0') + '-' + String(parseInt(dmy[1], 10)).padStart(2, '0');
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return formatDateIso(parsed);
    return '';
  }

  function parseBool(val) {
    const s = String(val || '').trim().toLowerCase();
    if (!s) return false;
    return s === 'yes' || s === 'y' || s === 'true' || s === '1' || s === 'diabetic';
  }

  function normalizePaymentSource(val) {
    const s = String(val || '').trim().toLowerCase();
    if (!s) return '';
    if (s.indexOf('provincial') !== -1 || s.indexOf('ohip') !== -1 || s.indexOf('ramq') !== -1 || s.indexOf('msp') !== -1) {
      return 'provincial';
    }
    if (s.indexOf('private') !== -1 || s.indexOf('insurance') !== -1) return 'private_insurance';
    if (s.indexOf('wcb') !== -1 || s.indexOf('workers') !== -1) return 'wcb';
    if (s.indexOf('self') !== -1 || s.indexOf('cash') !== -1 || s.indexOf('uninsured') !== -1) return 'self_pay';
    if (['provincial', 'private_insurance', 'self_pay', 'wcb'].indexOf(s) !== -1) return s;
    return '';
  }

  function normalizeGender(val) {
    const s = String(val || '').trim().toLowerCase();
    if (!s) return '';
    if (s === 'm' || s === 'male' || s === 'man') return 'Male';
    if (s === 'f' || s === 'female' || s === 'woman') return 'Female';
    return String(val).trim();
  }

  function parseSimpleClinicalList(raw, kind) {
    if (!raw || !String(raw).trim()) return [];
    const parts = String(raw).split(/[;\n|]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    return parts.map(function (text) {
      if (kind === 'medications') {
        return { name: text, dosage: '', route: '', status: 'Active', source: 'import' };
      }
      if (kind === 'allergies') {
        return { allergen: text, reaction: '', severity: '', source: 'import' };
      }
      if (kind === 'immunizations') {
        return { vaccine: text, date: '', source: 'import' };
      }
      if (kind === 'diagnoses') {
        return { code: '', description: text, date: '', status: 'Active', source: 'import' };
      }
      return { condition: text, date: '', notes: 'Imported', source: 'import' };
    });
  }

  function rowToPatient(rawRow, headerMap, rowNum, parseConfig) {
    const warnings = [];
    const headers = (parseConfig && parseConfig.headers) || [];
    const notesColumns = (parseConfig && parseConfig.notesColumns) || [];
    const get = function (field) { return cellVal(rawRow, headerMap[field]); };

    const firstName = get('firstName');
    const lastName = get('lastName');
    if (!firstName && !lastName) {
      return { error: 'Row ' + rowNum + ': missing first and last name', rowNum: rowNum };
    }
    if (!firstName) warnings.push('missing first name');
    if (!lastName) warnings.push('missing last name');

    let dob = parseFlexibleDate(get('dob'));
    if (!dob) {
      dob = IMPORT_PLACEHOLDER_DOB;
      warnings.push('missing DOB (placeholder set: edit patient later)');
    }

    const patientIdRaw = get('patientId');
    let paymentSource = normalizePaymentSource(get('paymentSource'));
    const healthCardNumber = get('healthCardNumber');
    if (!paymentSource && healthCardNumber) paymentSource = 'provincial';
    if (!paymentSource) paymentSource = 'self_pay';

    let country = get('country');
    const stateVal = get('state');
    if (!country && (stateVal === 'ON' || stateVal === 'BC' || stateVal === 'AB' || stateVal === 'QC')) {
      country = 'Canada';
    }

    const noteParts = [];
    const mappedNotes = get('notes');
    if (mappedNotes) noteParts.push(mappedNotes);
    const extraNotes = collectNotesFromColumns(rawRow, headers, notesColumns);
    if (extraNotes) noteParts.push('From import file: ' + extraNotes);
    if (healthCardNumber) noteParts.push('PHN: ' + healthCardNumber);
    const hcv = get('healthCardVersion');
    if (hcv) noteParts.push('Health card version: ' + hcv);

    const patient = {
      id: patientIdRaw || null,
      customPatientId: patientIdRaw || null,
      firstName: firstName || 'Unknown',
      middleName: get('middleName'),
      lastName: lastName || 'Unknown',
      dob: dob,
      gender: normalizeGender(get('gender')),
      maritalStatus: get('maritalStatus') || '',
      race: get('race') || '',
      email: get('email'),
      phone: get('phone'),
      phoneCountryCode: get('phoneCountryCode'),
      addressLine1: get('addressLine1'),
      addressLine2: get('addressLine2'),
      city: get('city'),
      state: stateVal,
      country: country,
      postalCode: get('postalCode'),
      emergencyFirstName: get('emergencyFirstName'),
      emergencyLastName: get('emergencyLastName'),
      emergencyRelationship: get('emergencyRelationship'),
      emergencyPhone: get('emergencyPhone'),
      emergencyEmail: get('emergencyEmail'),
      emergencyAddressLine1: get('emergencyAddressLine1'),
      emergencyCity: get('emergencyCity'),
      emergencyState: get('emergencyState'),
      emergencyCountry: get('emergencyCountry'),
      hasDiabetes: parseBool(get('hasDiabetes')),
      paymentSource: paymentSource,
      province: get('province') || stateVal,
      healthCardNumber: healthCardNumber,
      healthCardVersion: hcv,
      phn: healthCardNumber,
      insuranceName: get('insuranceName'),
      insuranceMemberNumber: get('insuranceMemberNumber'),
      insurancePolicyGroupNumber: get('insurancePolicyGroupNumber'),
      wcbClaimNumber: get('wcbClaimNumber'),
      preferredPaymentMethod: get('preferredPaymentMethod') || 'cash',
      medicalHistory: parseSimpleClinicalList(get('medicalHistory'), 'history'),
      medications: parseSimpleClinicalList(get('medications'), 'medications'),
      allergies: parseSimpleClinicalList(get('allergies'), 'allergies'),
      immunizations: parseSimpleClinicalList(get('immunizations'), 'immunizations'),
      diagnoses: parseSimpleClinicalList(get('diagnoses'), 'diagnoses'),
      visits: [],
      preventiveGaps: [],
      prescriptions: [],
      encounters: [],
      importNotes: noteParts.join(' | '),
      warnings: warnings,
      rowNum: rowNum,
      enrolledPhysician: get('enrolledPhysician'),
      enrolmentStatus: get('enrolmentStatus'),
      showEmailOnConsults: parseBool(get('showEmailOnConsults')),
      dateJoinedPractice: parseFlexibleDate(get('dateJoinedPractice')) || formatDateIso(new Date()),
      healthCardEffectiveDate: parseFlexibleDate(get('healthCardEffectiveDate')),
      assignedPhysicianMrp: get('assignedPhysicianMrp')
    };

    if (!patient.gender) warnings.push('missing gender');
    if (!patient.race) warnings.push('missing race');
    if (!patient.addressLine1) warnings.push('missing address');
    if (!patient.phone) warnings.push('missing phone');

    const normalizedPatient = (typeof window !== 'undefined' && window.MediForgeRegistrationCase)
      ? window.MediForgeRegistrationCase.normalizePatientRecord(patient)
      : patient;

    return { patient: normalizedPatient, warnings: warnings, rowNum: rowNum };
  }

  function parseCsvText(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function (l, i, arr) {
      return i < arr.length - 1 || l.trim();
    });
    if (lines.length < 1) throw new Error('File appears empty');
    const delimiter = lines[0].indexOf('\t') !== -1 && lines[0].indexOf(',') === -1 ? '\t' : ',';
    const headers = parseCsvLine(lines[0], delimiter);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      rows.push(parseCsvLine(lines[i], delimiter));
    }
    return { headers: headers, rows: rows };
  }

  function parseCsvLine(line, delimiter) {
    delimiter = delimiter || ',';
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  function parseExcelArrayBuffer(buf) {
    if (typeof XLSX === 'undefined') throw new Error('Excel support not loaded.');
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    if (!rows.length) throw new Error('Excel sheet is empty');
    return { headers: rows[0].map(String), rows: rows.slice(1) };
  }

  function buildSupabaseRow(patient, orgId) {
    const incomplete = (patient.warnings || []).join('; ');
    const noteParts = [];
    if (patient.importLegacyId) {
      noteParts.push('Former chart number from import file: ' + patient.importLegacyId);
    }
    if (patient.importNotes) noteParts.push(patient.importNotes);
    if (incomplete) noteParts.push('Bulk import: review: ' + incomplete);
    const notes = noteParts.length ? noteParts.join(' | ') : null;

    return {
      patient_id: patient.id,
      first_name: patient.firstName,
      last_name: patient.lastName,
      middle_name: patient.middleName || null,
      gender: patient.gender || null,
      date_of_birth: patient.dob || IMPORT_PLACEHOLDER_DOB,
      phone: patient.phone || null,
      email: patient.email || null,
      address: patient.addressLine1
        ? patient.addressLine1 + (patient.addressLine2 ? ', ' + patient.addressLine2 : '')
        : null,
      address_line1: patient.addressLine1 || null,
      address_line2: patient.addressLine2 || null,
      city: patient.city || null,
      state: patient.state || null,
      country: patient.country || null,
      postal_code: patient.postalCode || null,
      emergency_contact_name: (patient.emergencyFirstName || patient.emergencyLastName)
        ? ((patient.emergencyFirstName || '') + ' ' + (patient.emergencyLastName || '')).trim()
        : null,
      emergency_contact_relationship: patient.emergencyRelationship || null,
      emergency_contact_phone: patient.emergencyPhone || null,
      race: patient.race || null,
      marital_status: patient.maritalStatus || null,
      allergies: JSON.stringify(patient.allergies || []),
      medications: JSON.stringify(patient.medications || []),
      medical_history: JSON.stringify(patient.medicalHistory || []),
      diagnoses: JSON.stringify(patient.diagnoses || []),
      immunizations: JSON.stringify(patient.immunizations || []),
      payment_source: patient.paymentSource || 'self_pay',
      insurance_name: patient.insuranceName || null,
      insurance_member_number: patient.insuranceMemberNumber || null,
      insurance_policy_number: patient.insurancePolicyGroupNumber || null,
      notes: notes,
      organization_id: orgId,
      status: 'active',
      enrolled_physician: patient.enrolledPhysician || null,
      enrolment_status: patient.enrolmentStatus || null,
      show_email_on_consults: !!patient.showEmailOnConsults,
      date_joined_practice: patient.dateJoinedPractice || formatDateIso(new Date()),
      health_card_effective_date: patient.healthCardEffectiveDate || null,
      assigned_physician_mrp: patient.assignedPhysicianMrp || null
    };
  }

  function buildLocalPatient(patient, supabaseUuid) {
    return Object.assign({}, patient, {
      id: patient.id,
      _supabaseUuid: supabaseUuid || null,
      _importedAt: new Date().toISOString()
    });
  }

  async function resolveOrgId() {
    if (typeof window.resolveOrganizationId === 'function') {
      try {
        const id = await window.resolveOrganizationId();
        if (id) return id;
      } catch (e) { /* fall through */ }
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let orgId = user.organizationId || user.organization_id;
    if (!orgId && user.org) {
      const orgs = JSON.parse(localStorage.getItem('organizations') || '{}');
      if (orgs[user.org] && orgs[user.org].id) orgId = orgs[user.org].id;
    }
    return orgId || null;
  }

  async function patientIdExists(orgId, patientId) {
    if (window.supabaseClient && orgId) {
      const { data } = await window.supabaseClient
        .from('patients')
        .select('patient_id')
        .eq('organization_id', orgId)
        .eq('patient_id', patientId)
        .maybeSingle();
      if (data) return true;
    }
    const key = typeof getDataKey === 'function' ? getDataKey('patients') : 'patients';
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    return local.some(function (p) { return p.id === patientId || p.patient_id === patientId; });
  }

  async function createIdAllocator(orgId) {
    let nextFn = null;
    if (window.supabaseClient && orgId && typeof window.generateSupabasePatientId === 'function') {
      const prefix = await (async function () {
        const { data: org } = await window.supabaseClient
          .from('organizations')
          .select('name, settings')
          .eq('id', orgId)
          .maybeSingle();
        return window.mfResolveDefaultPatientIdPrefix(orgId, org || {}, {});
      })();
      const { data: rows } = await window.supabaseClient
        .from('patients')
        .select('patient_id')
        .eq('organization_id', orgId);
      const max = window.mfMaxPatientMrnNumericSuffix(rows || []);
      let counter = max + 1;
      const reserved = new Set();
      nextFn = function () {
        let id;
        do {
          id = window.mfFormatPatientMrn(prefix, counter++);
        } while (reserved.has(id));
        reserved.add(id);
        return id;
      };
    } else if (typeof generatePatientId === 'function') {
      nextFn = function () { return generatePatientId(); };
    } else {
      nextFn = function () { return 'IMP' + Date.now().toString(36).toUpperCase(); };
    }
    return nextFn;
  }

  async function assignPatientId(patient, orgId, keepExistingIds, allocator, usedInFile) {
    const raw = (patient.customPatientId || patient.id || '').trim();
    if (keepExistingIds && raw) {
      if (usedInFile.has(raw)) {
        return { error: 'Duplicate Patient ID in file: ' + raw };
      }
      if (await patientIdExists(orgId, raw)) {
        return { error: 'Patient ID already exists: ' + raw };
      }
      usedInFile.add(raw);
      patient.id = raw;
      return { patient: patient };
    }
    if (raw) {
      patient.importLegacyId = raw;
    }
    const newId = allocator();
    patient.id = newId;
    patient.customPatientId = null;
    usedInFile.add(newId);
    return { patient: patient };
  }

  async function importOnePatient(patient, orgId) {
    const supabaseRow = buildSupabaseRow(patient, orgId);
    let supabaseUuid = null;

    if (window.supabaseClient && orgId) {
      const { data, error } = await window.supabaseClient
        .from('patients')
        .insert(supabaseRow)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      supabaseUuid = data && data.id;
    }

    const key = typeof getDataKey === 'function' ? getDataKey('patients') : 'patients';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const localPatient = buildLocalPatient(patient, supabaseUuid);
    existing.push(localPatient);
    localStorage.setItem(key, JSON.stringify(existing));
    return { supabaseUuid: supabaseUuid };
  }

  function parseWorkbook(data, parseConfig) {
    const headerMap = parseConfig ? parseConfig.headerMap : mapHeaders(data.headers);
    const config = parseConfig || {
      headerMap: headerMap,
      notesColumns: [],
      headers: data.headers
    };
    const parsed = [];
    const errors = [];
    data.rows.forEach(function (row, idx) {
      const rowNum = idx + 2;
      const allEmpty = row.every(function (c) { return !String(c || '').trim(); });
      if (allEmpty) return;
      const result = rowToPatient(row, config.headerMap, rowNum, config);
      if (result.error) {
        errors.push(result);
      } else {
        parsed.push(result);
      }
    });
    if (!parsed.length && errors.length) {
      throw new Error(errors[0].error || 'No valid rows found');
    }
    return { parsed: parsed, errors: errors, headerMap: config.headerMap, parseConfig: config };
  }

  const state = {
    rawData: null,
    columnMappings: [],
    importMode: 'template',
    parsed: [],
    errors: [],
    fileName: ''
  };

  function getImportMode() {
    const mapRadio = document.getElementById('mode-map');
    return mapRadio && mapRadio.checked ? 'map' : 'template';
  }

  function buildMappingSelectOptions(selected) {
    let html = '<option value="' + MAP_SKIP + '">: Skip :</option>';
    html += '<option value="' + MAP_NOTES + '"' + (selected === MAP_NOTES ? ' selected' : '') + '>Add to patient Notes</option>';
    Object.keys(FIELD_LABELS).forEach(function (key) {
      html += '<option value="' + key + '"' + (selected === key ? ' selected' : '') + '>' +
        escapeHtml(FIELD_LABELS[key]) + '</option>';
    });
    return html;
  }

  function renderMappingUI() {
    const tbody = document.getElementById('import-mapping-body');
    if (!tbody || !state.rawData) return;
    tbody.innerHTML = '';
    const sampleRow = state.rawData.rows.find(function (row) {
      return row.some(function (c) { return String(c || '').trim(); });
    }) || [];

    state.columnMappings = suggestColumnMappings(state.rawData.headers, true);

    state.rawData.headers.forEach(function (header, idx) {
      const tr = document.createElement('tr');
      const select = document.createElement('select');
      select.dataset.colIdx = String(idx);
      select.innerHTML = buildMappingSelectOptions(state.columnMappings[idx]);
      select.value = state.columnMappings[idx];
      select.addEventListener('change', function () {
        state.columnMappings[idx] = select.value;
      });
      const sampleTd = document.createElement('td');
      sampleTd.className = 'sample-cell';
      sampleTd.textContent = cellVal(sampleRow, idx) || ':';
      sampleTd.title = cellVal(sampleRow, idx);
      tr.innerHTML = '<td>' + escapeHtml(header) + '</td>';
      tr.appendChild(sampleTd);
      const mapTd = document.createElement('td');
      mapTd.appendChild(select);
      tr.appendChild(mapTd);
      tbody.appendChild(tr);
    });

    document.getElementById('import-mapping-section').style.display = 'block';
    document.getElementById('import-preview-section').style.display = 'none';
    const heading = document.getElementById('import-preview-heading');
    if (heading) heading.textContent = '3. Preview';
  }

  function readMappingFromUI() {
    const tbody = document.getElementById('import-mapping-body');
    if (!tbody) return state.columnMappings;
    tbody.querySelectorAll('select[data-col-idx]').forEach(function (sel) {
      const idx = parseInt(sel.dataset.colIdx, 10);
      state.columnMappings[idx] = sel.value;
    });
    return state.columnMappings;
  }

  function applyParseAndPreview() {
    if (!state.rawData) return;
    const mode = getImportMode();
    let parseConfig;
    if (mode === 'map') {
      readMappingFromUI();
      parseConfig = buildParseConfig(state.rawData.headers, state.columnMappings);
    } else {
      parseConfig = buildParseConfig(
        state.rawData.headers,
        suggestColumnMappings(state.rawData.headers, false)
      );
    }
    const result = parseWorkbook(state.rawData, parseConfig);
    state.parsed = result.parsed;
    state.errors = result.errors;
    renderPreview();
    document.getElementById('import-preview-section').style.display = 'block';
    if (mode === 'map') {
      document.getElementById('import-mapping-section').style.display = 'block';
    }
  }

  function renderPreview() {
    const tbody = document.getElementById('import-preview-body');
    const errEl = document.getElementById('import-parse-errors');
    const keepExisting = document.getElementById('opt-keep-patient-ids') &&
      document.getElementById('opt-keep-patient-ids').checked;
    if (!tbody) return;
    tbody.innerHTML = '';
    state.parsed.forEach(function (item) {
      const p = item.patient;
      const tr = document.createElement('tr');
      const warn = (item.warnings || []).join('; ') || ':';
      let idDisplay;
      if (keepExisting) {
        idDisplay = p.customPatientId || p.id || '(auto on import)';
      } else if (p.customPatientId || p.id) {
        idDisplay = '(new number: file had ' + (p.customPatientId || p.id) + ')';
      } else {
        idDisplay = '(new number on import)';
      }
      tr.innerHTML =
        '<td>' + item.rowNum + '</td>' +
        '<td>' + escapeHtml(idDisplay) + '</td>' +
        '<td>' + escapeHtml((p.firstName || '') + ' ' + (p.lastName || '')) + '</td>' +
        '<td>' + escapeHtml(p.dob === IMPORT_PLACEHOLDER_DOB ? ':' : p.dob) + '</td>' +
        '<td class="warn-cell">' + escapeHtml(warn) + '</td>' +
        '<td>Ready</td>';
      tbody.appendChild(tr);
    });
    if (errEl) {
      if (state.errors.length) {
        errEl.style.display = 'block';
        errEl.innerHTML = '<strong>Rows skipped during parse:</strong><ul>' +
          state.errors.map(function (e) { return '<li>' + escapeHtml(e.error) + '</li>'; }).join('') +
          '</ul>';
      } else {
        errEl.style.display = 'none';
        errEl.innerHTML = '';
      }
    }
    const summary = document.getElementById('import-preview-summary');
    if (summary) {
      summary.textContent = state.parsed.length + ' patient(s) ready' +
        (state.errors.length ? '; ' + state.errors.length + ' row(s) skipped' : '') +
        (state.fileName ? ': ' + state.fileName : '');
    }
    document.getElementById('import-run-btn').disabled = state.parsed.length === 0;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function handleRawData(data, fileName) {
    state.rawData = data;
    state.fileName = fileName || '';
    state.importMode = getImportMode();
    if (state.importMode === 'map') {
      renderMappingUI();
      const heading = document.getElementById('import-preview-heading');
      if (heading) heading.textContent = '3. Preview';
    } else {
      document.getElementById('import-mapping-section').style.display = 'none';
      const heading = document.getElementById('import-preview-heading');
      if (heading) heading.textContent = '2. Preview';
      applyParseAndPreview();
    }
  }

  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    let data;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      data = parseExcelArrayBuffer(buf);
    } else {
      const text = await file.text();
      data = parseCsvText(text);
    }
    await handleRawData(data, file.name);
  }

  async function runImport() {
    const keepExisting = document.getElementById('opt-keep-patient-ids').checked;
    const btn = document.getElementById('import-run-btn');
    const progress = document.getElementById('import-progress');
    const log = document.getElementById('import-log');

    if (!state.parsed.length) {
      alert('No patients to import. Upload a file first.');
      return;
    }
    const idMsg = keepExisting
      ? 'Patient IDs from the file will be kept when provided.'
      : 'Everyone will get a new org patient number. Old file numbers go into Notes.';
    if (!confirm('Import ' + state.parsed.length + ' patient(s)?\n\n' + idMsg + '\n\nEmpty fields can be completed later in the patient chart.')) {
      return;
    }

    btn.disabled = true;
    progress.style.display = 'block';
    log.innerHTML = '';

    const orgId = await resolveOrgId();
    if (!orgId) {
      alert('Could not determine your organization. Please log in again.');
      btn.disabled = false;
      return;
    }

    const allocator = await createIdAllocator(orgId);
    const usedInFile = new Set();
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < state.parsed.length; i++) {
      const item = state.parsed[i];
      const patient = Object.assign({}, item.patient);
      progress.textContent = 'Importing ' + (i + 1) + ' of ' + state.parsed.length + '…';

      try {
        const idResult = await assignPatientId(patient, orgId, keepExisting, allocator, usedInFile);
        if (idResult.error) {
          fail++;
          log.innerHTML += '<div class="log-err">Row ' + item.rowNum + ': ' + escapeHtml(idResult.error) + '</div>';
          continue;
        }
        await importOnePatient(idResult.patient, orgId);
        ok++;
        log.innerHTML += '<div class="log-ok">Row ' + item.rowNum + ': ' + escapeHtml(patient.id) + ': ' +
          escapeHtml(patient.firstName + ' ' + patient.lastName) + '</div>';
      } catch (err) {
        fail++;
        log.innerHTML += '<div class="log-err">Row ' + item.rowNum + ': ' + escapeHtml(err.message || String(err)) + '</div>';
      }
    }

    progress.textContent = 'Done: ' + ok + ' imported, ' + fail + ' failed.';
    btn.disabled = false;

    if (typeof window.logAuditEvent === 'function') {
      window.logAuditEvent('patients_bulk_imported', { imported: ok, failed: fail, file: state.fileName });
    }

    if (ok > 0 && confirm('Imported ' + ok + ' patient(s). Open the patient list now?')) {
      window.location.href = '/patients';
    }
  }

  function initBulkPatientImport() {
    const fileInput = document.getElementById('import-file');
    const pasteArea = document.getElementById('import-paste');
    const parsePasteBtn = document.getElementById('import-parse-paste-btn');
    const applyMappingBtn = document.getElementById('import-apply-mapping-btn');
    const keepIdsCheckbox = document.getElementById('opt-keep-patient-ids');

    ['mode-template', 'mode-map'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          if (state.rawData) {
            handleRawData(state.rawData, state.fileName).catch(function (err) {
              alert('Could not refresh: ' + err.message);
            });
          }
        });
      }
    });

    if (keepIdsCheckbox) {
      keepIdsCheckbox.addEventListener('change', function () {
        if (state.parsed.length) renderPreview();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        const f = e.target.files && e.target.files[0];
        if (f) handleFile(f).catch(function (err) { alert('Could not read file: ' + err.message); });
      });
    }

    if (parsePasteBtn && pasteArea) {
      parsePasteBtn.addEventListener('click', function () {
        try {
          const text = pasteArea.value.trim();
          if (!text) {
            alert('Paste CSV text first.');
            return;
          }
          const data = parseCsvText(text);
          handleRawData(data, 'pasted-data.csv').catch(function (err) {
            alert('Could not parse pasted data: ' + err.message);
          });
        } catch (err) {
          alert('Could not parse pasted data: ' + err.message);
        }
      });
    }

    if (applyMappingBtn) {
      applyMappingBtn.addEventListener('click', function () {
        try {
          applyParseAndPreview();
        } catch (err) {
          alert('Could not build preview: ' + err.message);
        }
      });
    }

    const runBtn = document.getElementById('import-run-btn');
    if (runBtn) runBtn.addEventListener('click', function () { runImport(); });
  }

  window.MediForgeBulkPatientImport = {
    parseCsvText: parseCsvText,
    parseWorkbook: parseWorkbook,
    mapHeaders: mapHeaders,
    suggestColumnMappings: suggestColumnMappings,
    init: initBulkPatientImport
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBulkPatientImport);
  } else {
    initBulkPatientImport();
  }
})();
