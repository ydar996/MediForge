// Purpose: Handles logic for conditions-breakdown.html: aggregates unique diagnoses from patients, computes counts by gender, race, age, and displays in table.

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

function aggregateData() {
  const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
  const uniqueDiagnoses = getUniqueDiagnoses(patients);
  const summary = [];
  uniqueDiagnoses.forEach(diagnosis => {
    const stats = {
      total: 0,
      male: 0,
      female: 0,
      races: {},
      ages: AGE_GROUPS.map(() => 0)
    };
    const patientSet = new Set(); // To ensure unique patients per diagnosis
    patients.forEach(patient => {
      const hasDiag = patient.diagnoses?.some(d => d.diagnosis === diagnosis);
      if (hasDiag && !patientSet.has(patient.id)) {
        patientSet.add(patient.id);
        stats.total++;
        const gender = patient.gender.toLowerCase();
        if (gender === 'male') stats.male++;
        else if (gender === 'female') stats.female++;
        const raceVal = (patient.race || 'Unknown').trim() || 'Unknown';
        stats.races[raceVal] = (stats.races[raceVal] || 0) + 1;
        const age = calculateAge(patient.dob);
        const groupIndex = AGE_GROUPS.findIndex(g => age >= g.min && age <= g.max);
        if (groupIndex !== -1) stats.ages[groupIndex]++;
      }
    });
    if (stats.total > 0) { // Only include if at least one patient has it
      let raceStr = Object.entries(stats.races)
        .map(([raceVal, count]) => `${raceVal}: ${count}`)
        .join(', ');
      const raceCount = Object.keys(stats.races).length;
      const raceDisplay = raceCount > 1 ? 'Multiple' : raceStr;
      summary.push({
        diagnosis,
        ...stats,
        raceStr,
        raceDisplay,
        raceCount
      });
    }
  });
  return summary;
}

function displaySummary() {
  const summary = aggregateData();
  const tbody = document.getElementById("summary-body");
  tbody.innerHTML = "";
  summary.forEach(item => {
    const row = document.createElement("tr");
    const encodedDiagnosis = encodeURIComponent(item.diagnosis);
    const raceHtml = item.raceCount > 1 ? `<a href="condition-stats?condition=${encodedDiagnosis}">Multiple</a>` : item.raceStr || 'N/A';
    row.innerHTML = `
      <td><a href="condition-patients?condition=${encodedDiagnosis}">${item.diagnosis}</a></td>
      <td><a href="condition-patients?condition=${encodedDiagnosis}">${item.total}</a></td>
      <td>${item.male}</td>
      <td>${item.female}</td>
      <td>${raceHtml}</td>
      <td>${item.ages[0]}</td>
      <td>${item.ages[1]}</td>
      <td>${item.ages[2]}</td>
      <td>${item.ages[3]}</td>
    `;
    tbody.appendChild(row);
  });
}

window.onload = function() {
  displaySummary();
};