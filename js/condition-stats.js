// Purpose: Handles logic for condition-stats.html: computes percentage breakdowns by gender, tribe, age for all or specific conditions.

const AGE_GROUPS = [
  { label: '0-18', min: 0, max: 18 },
  { label: '19-25', min: 19, max: 25 },
  { label: '26-65', min: 26, max: 65 },
  { label: '66+', min: 66, max: Infinity }
];

function calculateAge(dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getUniqueDiagnoses(patients) {
  const diagSet = new Set();
  patients.forEach(patient => {
    patient.diagnoses?.forEach(d => diagSet.add(d.diagnosis));
  });
  return Array.from(diagSet);
}

function aggregateStats(specificCondition = null) {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const diagnoses = specificCondition ? [specificCondition] : getUniqueDiagnoses(patients);
  const summary = [];
  diagnoses.forEach(diagnosis => {
    let total = 0;
    const gender = { male: 0, female: 0 };
    const tribes = {};
    const ages = AGE_GROUPS.map(() => 0);
    const tribeCount = {}; // For counting unique tribes
    const patientSet = new Set();
    patients.forEach(patient => {
      const hasDiag = patient.diagnoses?.some(d => d.diagnosis === diagnosis);
      if (hasDiag && !patientSet.has(patient.id)) {
        patientSet.add(patient.id);
        total++;
        const g = patient.gender.toLowerCase();
        if (g === 'male') gender.male++;
        else if (g === 'female') gender.female++;
        const tribe = patient.tribe || 'Unknown';
        tribes[tribe] = (tribes[tribe] || 0) + 1;
        tribeCount[tribe] = true; // Just to count unique
        const age = calculateAge(patient.dob);
        const groupIndex = AGE_GROUPS.findIndex(g => age >= g.min && age <= g.max);
        if (groupIndex !== -1) ages[groupIndex]++;
      }
    });
    if (total > 0) {
      const genderStr = `Male: ${Math.round((gender.male / total) * 100)}%, Female: ${Math.round((gender.female / total) * 100)}%`;
      const numTribes = Object.keys(tribeCount).length;
      let tribeStr = numTribes > 1 ? 'Multiple' : Object.entries(tribes)
        .map(([t, c]) => `${t}: ${Math.round((c / total) * 100)}%`)
        .join(', ');
      const ageStr = AGE_GROUPS.map((g, i) => `${g.label}: ${Math.round((ages[i] / total) * 100)}%`).join(', ');
      summary.push({ diagnosis, genderStr, tribeStr, ageStr, numTribes });
    }
  });
  return summary;
}

function displayStats() {
  const urlParams = new URLSearchParams(window.location.search);
  const specificCondition = urlParams.get("condition") ? decodeURIComponent(urlParams.get("condition")) : null;
  const summary = aggregateStats(specificCondition);
  const tbody = document.getElementById("stats-body");
  tbody.innerHTML = "";
  summary.forEach(item => {
    const row = document.createElement("tr");
    const encodedDiagnosis = encodeURIComponent(item.diagnosis);
    const tribeHtml = item.numTribes > 1 ? `<a href="condition-patients?condition=${encodedDiagnosis}">Multiple</a>` : item.tribeStr;
    row.innerHTML = `
      <td><a href="condition-patients?condition=${encodedDiagnosis}">${item.diagnosis}</a></td>
      <td>${item.genderStr}</td>
      <td>${tribeHtml}</td>
      <td>${item.ageStr}</td>
    `;
    tbody.appendChild(row);
  });
  document.getElementById("page-title").innerHTML = specificCondition ? `Stats for "${specificCondition}"` : 'Condition Stats';
}

window.onload = function() {
  displayStats();
};