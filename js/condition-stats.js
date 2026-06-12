// Purpose: Handles logic for condition-stats.html: computes percentage breakdowns by gender, race, age for all or specific conditions.

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
    const races = {};
    const ages = AGE_GROUPS.map(() => 0);
    const raceCount = {}; // For counting unique races
    const patientSet = new Set();
    patients.forEach(patient => {
      const hasDiag = patient.diagnoses?.some(d => d.diagnosis === diagnosis);
      if (hasDiag && !patientSet.has(patient.id)) {
        patientSet.add(patient.id);
        total++;
        const g = patient.gender.toLowerCase();
        if (g === 'male') gender.male++;
        else if (g === 'female') gender.female++;
        const raceVal = (patient.race || 'Unknown').trim() || 'Unknown';
        races[raceVal] = (races[raceVal] || 0) + 1;
        raceCount[raceVal] = true; // Just to count unique
        const age = calculateAge(patient.dob);
        const groupIndex = AGE_GROUPS.findIndex(g => age >= g.min && age <= g.max);
        if (groupIndex !== -1) ages[groupIndex]++;
      }
    });
    if (total > 0) {
      const genderStr = `Male: ${Math.round((gender.male / total) * 100)}%, Female: ${Math.round((gender.female / total) * 100)}%`;
      const numRaces = Object.keys(raceCount).length;
      let raceStr = numRaces > 1 ? 'Multiple' : Object.entries(races)
        .map(([t, c]) => `${t}: ${Math.round((c / total) * 100)}%`)
        .join(', ');
      const ageStr = AGE_GROUPS.map((g, i) => `${g.label}: ${Math.round((ages[i] / total) * 100)}%`).join(', ');
      summary.push({ diagnosis, genderStr, raceStr, ageStr, numRaces });
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
    const raceHtml = item.numRaces > 1 ? `<a href="condition-patients?condition=${encodedDiagnosis}">Multiple</a>` : item.raceStr;
    row.innerHTML = `
      <td><a href="condition-patients?condition=${encodedDiagnosis}">${item.diagnosis}</a></td>
      <td>${item.genderStr}</td>
      <td>${raceHtml}</td>
      <td>${item.ageStr}</td>
    `;
    tbody.appendChild(row);
  });
  document.getElementById("page-title").innerHTML = specificCondition ? `Stats for "${specificCondition}"` : 'Condition Stats';
}

window.onload = function() {
  displayStats();
};