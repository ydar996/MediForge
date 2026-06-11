// Purpose: Generates simple reports and exports data.

window.addEventListener('load', async function() {
  if (document.getElementById("stats")) {
    const patients = await window.loadPatientsWithSupabasePriority();
    document.getElementById("stats").innerHTML = `Total Patients: ${patients.length}`;  // Basic count
  }
});

document.getElementById("export-btn").addEventListener("click", async function() {
  const patients = await window.loadPatientsWithSupabasePriority();
  let csv = "ID,Name,DOB,Gender\n";  // Updated headers
  patients.forEach(p => {
    const rawId = window.getPatientIdentifier ? window.getPatientIdentifier(p) : (p.patient_id || p.patientNumber || 'TEMP0001');
    const nonUuid = (rawId && !rawId.includes('-') && rawId.length < 36) ? rawId : 'TEMP0001';
    const finalId =
      typeof window.patientMrnDisplay === 'function' ? window.patientMrnDisplay(nonUuid || '') : nonUuid;
    csv += `${finalId},${p.firstName} ${p.lastName},${p.dob},${p.gender}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "patients.csv";
  a.click();
});