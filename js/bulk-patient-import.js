/**
 * MediForge bulk patient import — CSV and Excel (.xlsx).
 * Maps flexible / semi-structured headers to registration demographics.
 * Supabase-first save with localStorage cache; empty fields allowed (edit later).
 */
(function () {
  'use strict';

  const IMPORT_PLACEHOLDER_DOB = '1900-01-01';

  const HEADER_ALIASES = {
    patientId: [
      'patient id', 'patientid', 'patient_id', 'id', 'mrn', 'file number',
      'file no', 'chart number', 'chart no', 'medical record number', 'record number'
    ],
    firstName: ['first name', 'firstname', 'first', 'given name', 'fname'],
    middleName: ['middle name', 'middlename', 'middle', 'mname'],
    lastName: ['last name', 'lastname', 'last', 'surname', 'family name', 'lname'],
    dob: ['dob', 'date of birth', 'dateofbirth', 'birth date', 'birthdate', 'birthday'],
    gender: ['gender', 'sex'],
    maritalStatus: ['marital status', 'maritalstatus', 'marital'],
    race: ['race', 'ethnicity'],
    email: ['email', 'e-mail', 'email address'],
    phone: ['phone', 'telephone', 'mobile', 'cell', 'phone number'],
    phoneCountryCode: ['phone country code', 'phone country', 'country code'],
    addressLine1: ['address line 1', 'addressline1', 'address', 'street', 'street address'],
    addressLine2: ['address line 2', 'addressline2', 'address 2', 'unit', 'apt'],
    city: ['city', 'town'],
    state: ['state', 'province', 'state/province', 'region', 'state province'],
    country: ['country', 'nation'],
    postalCode: ['postal code', 'postalcode', 'zip', 'zip code', 'postcode'],
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
    healthCardNumber: ['health card number', 'phn', 'health card', 'ohip', 'ramq', 'msp number'],
    healthCardVersion: ['health card version', 'version code', 'card version'],
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
    notes: ['notes', 'comments', 'remarks', 'import notes']
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

  function mapHeaders(headers) {
    const mapping = {};
    const normalized = headers.map(normalizeHeaderKey);
    Object.keys(HEADER_ALIASES).forEach(function (field) {
      const aliases = HEADER_ALIASES[field];
      normalized.forEach(function (h, idx) {
        if (!h || mapping[field] !== undefined) return;
        if (aliases.indexOf(h) !== -1 || h === field.replace(/([A-Z])/g, ' $1').trim().toLowerCase()) {
          mapping[field] = idx;
        }
      });
    });
    normalized.forEach(function (h, idx) {
      if (!h) return;
      Object.keys(HEADER_ALIASES).forEach(function (field) {
        if (mapping[field] !== undefined) return;
        aliasesLoop: for (let i = 0; i < HEADER_ALIASES[field].length; i++) {
          const alias = HEADER_ALIASES[field][i];
          if (h.indexOf(alias) !== -1 || alias.indexOf(h) !== -1) {
            mapping[field] = idx;
            break aliasesLoop;
          }
        }
      });
    });
    return mapping;
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
    if (!s) return 'self_pay';
    if (s.indexOf('provincial') !== -1 || s.indexOf('ohip') !== -1 || s.indexOf('ramq') !== -1 || s.indexOf('msp') !== -1) {
      return 'provincial';
    }
    if (s.indexOf('private') !== -1 || s.indexOf('insurance') !== -1) return 'private_insurance';
    if (s.indexOf('wcb') !== -1 || s.indexOf('workers') !== -1) return 'wcb';
    if (s.indexOf('self') !== -1 || s.indexOf('cash') !== -1 || s.indexOf('uninsured') !== -1) return 'self_pay';
    if (['provincial', 'private_insurance', 'self_pay', 'wcb'].indexOf(s) !== -1) return s;
    return 'self_pay';
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
    return parts.map(function (text, i) {
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

  function rowToPatient(rawRow, headerMap, rowNum) {
    const warnings = [];
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
      warnings.push('missing DOB (placeholder set — edit patient later)');
    }

    const patientIdRaw = get('patientId');
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
      state: get('state'),
      country: get('country'),
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
      paymentSource: normalizePaymentSource(get('paymentSource')),
      province: get('province') || get('state'),
      healthCardNumber: get('healthCardNumber'),
      healthCardVersion: get('healthCardVersion'),
      phn: get('healthCardNumber'),
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
      importNotes: get('notes'),
      warnings: warnings,
      rowNum: rowNum
    };

    if (!patient.gender) warnings.push('missing gender');
    if (!patient.race) warnings.push('missing race');
    if (!patient.addressLine1) warnings.push('missing address');
    if (!patient.phone) warnings.push('missing phone');

    return { patient: patient, warnings: warnings, rowNum: rowNum };
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
    if (patient.importNotes) noteParts.push(patient.importNotes);
    if (incomplete) noteParts.push('Bulk import — review: ' + incomplete);
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
      status: 'active'
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
    const newId = allocator();
    patient.id = newId;
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

  function parseWorkbook(data) {
    const headerMap = mapHeaders(data.headers);
    const parsed = [];
    const errors = [];
    data.rows.forEach(function (row, idx) {
      const rowNum = idx + 2;
      const allEmpty = row.every(function (c) { return !String(c || '').trim(); });
      if (allEmpty) return;
      const result = rowToPatient(row, headerMap, rowNum);
      if (result.error) {
        errors.push(result);
      } else {
        parsed.push(result);
      }
    });
    if (!parsed.length && errors.length) {
      throw new Error(errors[0].error || 'No valid rows found');
    }
    return { parsed: parsed, errors: errors, headerMap: headerMap };
  }

  const state = {
    parsed: [],
    errors: [],
    fileName: ''
  };

  function renderPreview() {
    const tbody = document.getElementById('import-preview-body');
    const errEl = document.getElementById('import-parse-errors');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.parsed.forEach(function (item) {
      const p = item.patient;
      const tr = document.createElement('tr');
      const warn = (item.warnings || []).join('; ') || '—';
      const idDisplay = p.customPatientId || p.id || '(auto on import)';
      tr.innerHTML =
        '<td>' + item.rowNum + '</td>' +
        '<td>' + escapeHtml(idDisplay) + '</td>' +
        '<td>' + escapeHtml((p.firstName || '') + ' ' + (p.lastName || '')) + '</td>' +
        '<td>' + escapeHtml(p.dob === IMPORT_PLACEHOLDER_DOB ? '—' : p.dob) + '</td>' +
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
        (state.fileName ? ' — ' + state.fileName : '');
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

  async function handleFile(file) {
    if (!file) return;
    state.fileName = file.name;
    const name = file.name.toLowerCase();
    let data;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      data = parseExcelArrayBuffer(buf);
    } else {
      const text = await file.text();
      data = parseCsvText(text);
    }
    const result = parseWorkbook(data);
    state.parsed = result.parsed;
    state.errors = result.errors;
    renderPreview();
    document.getElementById('import-preview-section').style.display = 'block';
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
    if (!confirm('Import ' + state.parsed.length + ' patient(s) into your organization? Empty fields can be completed later in the patient chart.')) {
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
        log.innerHTML += '<div class="log-ok">Row ' + item.rowNum + ': ' + escapeHtml(patient.id) + ' — ' +
          escapeHtml(patient.firstName + ' ' + patient.lastName) + '</div>';
      } catch (err) {
        fail++;
        log.innerHTML += '<div class="log-err">Row ' + item.rowNum + ': ' + escapeHtml(err.message || String(err)) + '</div>';
      }
    }

    progress.textContent = 'Done — ' + ok + ' imported, ' + fail + ' failed.';
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
          state.fileName = 'pasted-data.csv';
          const data = parseCsvText(text);
          const result = parseWorkbook(data);
          state.parsed = result.parsed;
          state.errors = result.errors;
          renderPreview();
          document.getElementById('import-preview-section').style.display = 'block';
        } catch (err) {
          alert('Could not parse pasted data: ' + err.message);
        }
      });
    }

    const runBtn = document.getElementById('import-run-btn');
    if (runBtn) runBtn.addEventListener('click', function () { runImport(); });
  }

  window.MediForgeBulkPatientImport = {
    parseCsvText: parseCsvText,
    parseWorkbook: parseWorkbook,
    init: initBulkPatientImport
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBulkPatientImport);
  } else {
    initBulkPatientImport();
  }
})();
