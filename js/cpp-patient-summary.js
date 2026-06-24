'use strict';

(function (global) {
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function findPatient(patientId) {
    const keys = [];
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.org) keys.push(`${user.org}_patients`);
    } catch (_) { /* ignore */ }
    keys.push('patients');
    for (let i = 0; i < keys.length; i += 1) {
      const list = JSON.parse(localStorage.getItem(keys[i]) || '[]');
      const hit = list.find((p) => String(p.id) === String(patientId));
      if (hit) return hit;
    }
    return null;
  }

  function row(label, value) {
    return `<tr><th>${esc(label)}</th><td>${esc(value || 'Not recorded')}</td></tr>`;
  }

  function renderCpp(patient) {
    const name = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
    let html = '';

    html += '<div class="section"><h2>1. Identification &amp; Demographics</h2><table>';
    html += row('Patient Name', name);
    html += row('Date of Birth', patient.dob);
    html += row('Gender', patient.gender);
    html += row('Health Card (PHN)', patient.phn || patient.healthCardNumber);
    html += row('Version Code', patient.healthCardVersion || patient.versionCode);
    html += row('Phone', patient.phone);
    html += row('Email', patient.email);
    html += row('Address', [patient.addressLine1, patient.city, patient.state, patient.postalCode].filter(Boolean).join(', '));
    html += '</table></div>';

    html += '<div class="section"><h2>2. Practice Enrolment</h2><table>';
    html += row('Enrolled Physician', patient.enrolledPhysician || patient.enrolled_physician);
    html += row('Assigned MRP', patient.assignedMRP || patient.assigned_mrp);
    html += row('Status Enrolment', patient.statusEnrolment || patient.status_enrolment);
    html += row('Date Joined Practice', patient.dateJoinedPractice || patient.date_joined_practice);
    html += row('Card Effective Date', patient.healthInsuranceCardEffectiveDate);
    html += '</table></div>';

    html += '<div class="section"><h2>3. Problem List / Diagnoses</h2>';
    if ((patient.diagnoses || []).length) {
      html += '<table><tr><th>Diagnosis</th><th>Code</th><th>Date</th></tr>';
      patient.diagnoses.forEach((d) => {
        html += `<tr><td>${esc(d.diagnosis || d.description)}</td><td>${esc(d.code)}</td><td>${esc(d.date)}</td></tr>`;
      });
      html += '</table>';
    } else html += '<p>No active problems recorded.</p>';
    html += '</div>';

    html += '<div class="section"><h2>4. Medications</h2>';
    if ((patient.medications || []).length) {
      html += '<table><tr><th>Medication</th><th>Dosage</th><th>Status</th></tr>';
      patient.medications.forEach((m) => {
        html += `<tr><td>${esc(m.name || m.drugName)}</td><td>${esc(m.dosage || m.dose)}</td><td>${esc(m.status || 'Active')}</td></tr>`;
      });
      html += '</table>';
    } else html += '<p>No medications recorded.</p>';
    html += '</div>';

    html += '<div class="section"><h2>5. Allergies &amp; Adverse Reactions</h2>';
    if ((patient.allergies || []).length) {
      html += '<table><tr><th>Allergen</th><th>Reaction</th><th>Severity</th></tr>';
      patient.allergies.forEach((a) => {
        html += `<tr><td>${esc(a.allergen || a.name)}</td><td>${esc(a.reaction)}</td><td>${esc(a.severity)}</td></tr>`;
      });
      html += '</table>';
    } else html += '<p>No known allergies recorded.</p>';
    html += '</div>';

    html += '<div class="section"><h2>6. Immunizations</h2>';
    if ((patient.immunizations || []).length) {
      html += '<table><tr><th>Vaccine</th><th>Date</th></tr>';
      patient.immunizations.forEach((imm) => {
        html += `<tr><td>${esc(imm.vaccine || imm.name)}</td><td>${esc(imm.date)}</td></tr>`;
      });
      html += '</table>';
    } else html += '<p>No immunizations recorded.</p>';
    html += '</div>';

    html += '<div class="section"><h2>7. Recent Vital Signs</h2>';
    const vitals = (patient.vitals || []).slice(-3).reverse();
    if (vitals.length) {
      html += '<table><tr><th>Date</th><th>BP</th><th>Pulse</th><th>Weight</th></tr>';
      vitals.forEach((v) => {
        const bp = v.bloodPressure || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '');
        html += `<tr><td>${esc(v.date)}</td><td>${esc(bp)}</td><td>${esc(v.pulse || v.heartRate)}</td><td>${esc(v.weight)}</td></tr>`;
      });
      html += '</table>';
    } else html += '<p>No vitals recorded.</p>';
    html += '</div>';

    html += '<div class="section"><h2>8. Preventive Care Gaps (i4C-Aligned)</h2>';
    const gaps = global.MediForgeI4cMap ? global.MediForgeI4cMap.summarizePatientGaps(patient) : (patient.preventiveGaps || []);
    const open = gaps.filter((g) => !g.addressed && g.status !== 'addressed');
    if (open.length) {
      html += '<table><tr><th>i4C Code</th><th>Indicator</th><th>Intervention</th></tr>';
      open.forEach((g) => {
        html += `<tr><td>${esc(g.i4cCode || '')}</td><td>${esc(g.i4cLabel || '')}</td><td>${esc(g.intervention || g.name)}</td></tr>`;
      });
      html += '</table>';
    } else html += '<p>No open preventive gaps.</p>';
    html += '</div>';

    return html;
  }

  function boot() {
    document.getElementById('gen-date').textContent = new Date().toLocaleString();
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId') || params.get('id');
    const el = document.getElementById('cpp-content');
    if (!patientId) {
      el.innerHTML = '<p>Patient ID required.</p>';
      return;
    }
    const patient = findPatient(patientId);
    if (!patient) {
      el.innerHTML = '<p>Patient not found. Open from the patient chart.</p>';
      return;
    }
    el.innerHTML = renderCpp(patient);
    if (typeof global.logAuditEvent === 'function') {
      global.logAuditEvent('cpp_summary_viewed', { patient_id: patientId });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
