// Purpose: Handles specialist management: loading specialties, adding/editing/deleting specialists, grouped display.

const SPECIALTIES = [
  { name: "Addiction Medicine (Subspecialty)", specialist: "Addiction Medicine Specialist", definition: "Prevention, evaluation, diagnosis, treatment, and recovery support for addiction disorders." },
  { name: "Adolescent Medicine (Subspecialty)", specialist: "Adolescent Medicine Specialist", definition: "Care for adolescents, including diagnostic and therapeutic services." },
  { name: "Adult Cardiac Anesthesiology (Subspecialty)", specialist: "Cardiac Anesthesiologist", definition: "Expertise in anesthesia for adults with advanced cardiac disease, including periprocedural care." },
  { name: "Aerospace Medicine", specialist: "Aerospace Medicine Specialist", definition: "Care for aviation and space travel-related health issues." },
  { name: "Allergy and Immunology", specialist: "Allergist/Immunologist", definition: "Diagnoses and manages immune system disorders like asthma, allergies, anaphylaxis, eczema, and adverse reactions to drugs/foods/insects; also treats immune deficiencies, autoimmune diseases, transplantation issues, or immune malignancies." },
  { name: "Anesthesiology", specialist: "Anesthesiologist", definition: "Provides anesthesia for surgical, obstetric, diagnostic, or therapeutic procedures; monitors vital functions; treats acute/chronic/cancer pain; manages critically ill/injured patients." },
  { name: "Bariatrics", specialist: "Bariatric Specialist", definition: "Causes, prevention, and treatment of obesity." },
  { name: "Cardiac Surgery (Subspecialty)", specialist: "Cardiac Surgeon", definition: "Surgical treatment of heart and major blood vessels." },
  { name: "Cardiology (Subspecialty)", specialist: "Cardiologist", definition: "Diseases of the cardiovascular system." },
  { name: "Cardiothoracic Surgery (Subspecialty)", specialist: "Cardiothoracic Surgeon", definition: "Surgical treatment of chest organs, including heart and lungs." },
  { name: "Child and Adolescent Psychiatry (Subspecialty)", specialist: "Child Psychiatrist", definition: "Mental health care for children and adolescents." },
  { name: "Clinical Neurophysiology (Subspecialty)", specialist: "Clinical Neurophysiologist", definition: "Diagnostic evaluation of nervous system function." },
  { name: "Colon and Rectal Surgery", specialist: "Colorectal Surgeon", definition: "Diagnoses and treats diseases of the small intestine, colon, rectum, anal canal, perianal area, and related organs/tissues." },
  { name: "Critical Care Medicine (Subspecialty)", specialist: "Critical Care Specialist", definition: "Diagnoses and treats critical illnesses/injuries, especially trauma or multi-organ dysfunction; coordinates ICU care." },
  { name: "Dermatology", specialist: "Dermatologist", definition: "Skin, hair, nail, and mucous membrane conditions." },
  { name: "Developmental Pediatrics (Subspecialty)", specialist: "Developmental Pediatrician", definition: "Care for children with developmental disorders." },
  { name: "Emergency Medicine", specialist: "Emergency Physician", definition: "Initial management of acute and emergent medical conditions, often in ER or field settings." },
  { name: "Endocrinology (Subspecialty)", specialist: "Endocrinologist", definition: "Hormone-related disorders, including diabetes and thyroid diseases." },
  { name: "Family Medicine", specialist: "Family Physician", definition: "Comprehensive, continuing healthcare for individuals and families across all ages, integrating biological, clinical, and behavioral sciences." },
  { name: "Forensic Pathology (Subspecialty)", specialist: "Forensic Pathologist", definition: "Determination of cause of death through autopsy and analysis." },
  { name: "Forensic Psychiatry (Subspecialty)", specialist: "Forensic Psychiatrist", definition: "Mental health evaluations in legal contexts." },
  { name: "Gastroenterology (Subspecialty)", specialist: "Gastroenterologist", definition: "Disorders of the digestive system and alimentary tract." },
  { name: "General Surgery", specialist: "Surgeon", definition: "Surgical treatment of a wide range of abdominal and other conditions." },
  { name: "Geriatrics (Subspecialty)", specialist: "Geriatrician", definition: "Comprehensive care for elderly patients, focusing on aging-related issues." },
  { name: "Health Care Administration, Leadership, and Management (Subspecialty)", specialist: "Health Care Administrator/Leader", definition: "Expertise in administrative functions, organizational effectiveness, process improvement, and patient safety in health care settings." },
  { name: "Hematology (Subspecialty)", specialist: "Hematologist", definition: "Blood disorders and malignancies." },
  { name: "Hospice and Palliative Medicine (Subspecialty)", specialist: "Palliative Care Specialist", definition: "Care to prevent/relieve suffering in life-limiting illnesses; maximizes quality of life via interdisciplinary teams addressing physical, psychological, social, and spiritual needs." },
  { name: "Infectious Disease (Subspecialty)", specialist: "Infectious Disease Specialist", definition: "Diagnosis and management of infections and communicable diseases." },
  { name: "Internal Medicine", specialist: "Internist", definition: "Comprehensive adult medical care, including prevention, diagnosis, and treatment of complex illnesses." },
  { name: "Medical Genetics and Genomics", specialist: "Medical Geneticist", definition: "Hereditary disorders, genetic counseling, and genomic medicine." },
  { name: "Nephrology (Subspecialty)", specialist: "Nephrologist", definition: "Kidney diseases and hypertension." },
  { name: "Neurocritical Care (Subspecialty)", specialist: "Neurocritical Care Specialist", definition: "Multisystem care for critically ill patients with neurological conditions." },
  { name: "Neurological Surgery", specialist: "Neurosurgeon", definition: "Surgical treatment of brain, spine, and nervous system disorders." },
  { name: "Neurology", specialist: "Neurologist", definition: "Non-surgical treatment of nervous system disorders like stroke, epilepsy, and neurodegenerative diseases." },
  { name: "Nuclear Medicine", specialist: "Nuclear Medicine Specialist", definition: "Use of radioactive materials for diagnosis and therapy." },
  { name: "Obstetrics and Gynecology", specialist: "Obstetrician/Gynecologist", definition: "Women's reproductive health, pregnancy, and gynecological disorders." },
  { name: "Oncology (Subspecialty)", specialist: "Oncologist", definition: "Cancer diagnosis, treatment, and management." },
  { name: "Ophthalmology", specialist: "Ophthalmologist", definition: "Eye diseases, vision care, and surgical interventions." },
  { name: "Orthopedic Surgery", specialist: "Orthopedic Surgeon", definition: "Musculoskeletal issues, including bones, joints, and trauma." },
  { name: "Otolaryngology – Head and Neck Surgery (ENT)", specialist: "Otolaryngologist", definition: "Disorders of the ear, nose, throat, head, and neck." },
  { name: "Pain Medicine (Subspecialty)", specialist: "Pain Management Specialist", definition: "Diagnosis and treatment of acute, chronic, or cancer-related pain in various settings." },
  { name: "Pathology", specialist: "Pathologist", definition: "Diagnosis of diseases through analysis of tissues, cells, and fluids." },
  { name: "Pediatrics", specialist: "Pediatrician", definition: "Comprehensive health care for infants, children, and adolescents." },
  { name: "Pediatric Anesthesiology (Subspecialty)", specialist: "Pediatric Anesthesiologist", definition: "Anesthesia for neonates, infants, children, and adolescents, including pre/post-operative care and pain management." },
  { name: "Physical Medicine and Rehabilitation", specialist: "Physiatrist", definition: "Rehabilitation for disabilities, injuries, and functional impairments." },
  { name: "Plastic Surgery", specialist: "Plastic Surgeon", definition: "Reconstructive and cosmetic surgical procedures." },
  { name: "Podiatry", specialist: "Podiatrist", definition: "Foot and ankle problems (non-ABMS, but common referral)." },
  { name: "Preventive Medicine", specialist: "Preventive Medicine Specialist", definition: "Disease prevention, health promotion, and public health." },
  { name: "Psychiatry", specialist: "Psychiatrist", definition: "Mental health, emotional, and behavioral disorders." },
  { name: "Pulmonology (Subspecialty)", specialist: "Pulmonologist", definition: "Lung and respiratory system diseases." },
  { name: "Radiation Oncology", specialist: "Radiation Oncologist", definition: "Cancer treatment using radiation therapy." },
  { name: "Radiology", specialist: "Radiologist", definition: "Diagnostic imaging and interventional procedures using X-rays, MRI, CT, etc." },
  { name: "Rheumatology (Subspecialty)", specialist: "Rheumatologist", definition: "Autoimmune diseases, arthritis, and musculoskeletal disorders." },
  { name: "Sleep Medicine (Subspecialty)", specialist: "Sleep Medicine Specialist", definition: "Diagnosis and management of sleep disorders, including polysomnography and sleep lab oversight." },
  { name: "Thoracic Surgery", specialist: "Thoracic Surgeon", definition: "Surgical treatment of heart, lungs, esophagus, and chest wall." },
  { name: "Urology", specialist: "Urologist", definition: "Urinary tract disorders and male reproductive issues." }
];

function loadSpecialties() {
  const select = document.getElementById("specialty");
  if (select) {
    SPECIALTIES.forEach(s => {
      const option = document.createElement("option");
      option.value = s.name;
      option.textContent = s.name;
      select.appendChild(option);
    });
  }
}

function migrateOldKey() {
  let specialists = JSON.parse(localStorage.getItem(getDataKey("specialists")) || "[]");
  if (specialists.length === 0) {
    const oldSpecialists = JSON.parse(localStorage.getItem("specialists") || "[]");
    if (oldSpecialists.length > 0) {
      localStorage.setItem(getDataKey("specialists"), JSON.stringify(oldSpecialists));
      localStorage.removeItem("specialists");
      console.log('Migrated old specialists data to prefixed key');
      specialists = oldSpecialists;
    }
  }
  return specialists;
}

function migrateIds(specialists) {
  let changed = false;
  specialists = specialists.map(s => {
    if (!s.id) {
      s.id = Date.now().toString() + Math.random().toString(36).slice(2);
      changed = true;
    }
    return s;
  });
  if (changed) {
    localStorage.setItem(getDataKey("specialists"), JSON.stringify(specialists));
    console.log('Migration completed: IDs added to old data');
  } else {
    console.log('No migration needed: All have IDs');
  }
  return specialists;
}

function displaySpecialists() {
  console.log('Displaying specialists');
  let specialists = migrateOldKey();
  specialists = migrateIds(specialists);
  const grouped = {};
  specialists.forEach(s => {
    if (!grouped[s.specialty]) grouped[s.specialty] = [];
    grouped[s.specialty].push(s);
  });
  const listDiv = document.getElementById("specialists-list");
  listDiv.innerHTML = "";
  Object.keys(grouped).forEach(specialty => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `${specialty} (${grouped[specialty].length})`;
    details.appendChild(summary);
    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>Business Name</th>
          <th>First Name</th>
          <th>Last Name</th>
          <th>Address</th>
          <th>Gender</th>
          <th>License</th>
          <th>Business Type</th>
          <th>Telephone</th>
          <th>Fax</th>
          <th>Email</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    grouped[specialty].forEach(spec => {
      console.log('Displaying specialist ID:', spec.id);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${spec.details.businessName || ''}</td>
        <td>${spec.details.firstName}</td>
        <td>${spec.details.lastName}</td>
        <td>${spec.details.addressLine1} ${spec.details.addressLine2 || ''}, ${spec.details.city}, ${spec.details.state}, ${spec.details.country}</td>
        <td>${spec.details.gender}</td>
        <td>${spec.details.medicalLicense || ''}</td>
        <td>${spec.details.businessType || ''}</td>
        <td>${spec.details.telephone}</td>
        <td>${spec.details.fax || ''}</td>
        <td>${spec.details.email}</td>
        <td>
          <button class="edit-btn" data-id="${spec.id}">Edit</button>
          <button class="delete-btn" data-id="${spec.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    details.appendChild(table);
    listDiv.appendChild(details);
  });
  // Attach event listeners dynamically
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editSpecialist(btn.dataset.id));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteSpecialist(btn.dataset.id));
  });
}

let editId = null;

window.editSpecialist = function(id) {
  console.log('Edit clicked for ID:', id);
  const specialists = JSON.parse(localStorage.getItem(getDataKey("specialists")) || "[]");
  const spec = specialists.find(s => s.id === id);
  if (spec) {
    const details = spec.details;
    document.getElementById("specialty").value = spec.specialty;
    document.getElementById("specialty").disabled = true;
    document.getElementById("businessName").value = details.businessName || '';
    document.getElementById("firstName").value = details.firstName;
    document.getElementById("lastName").value = details.lastName;
    document.getElementById("addressLine1").value = details.addressLine1;
    document.getElementById("addressLine2").value = details.addressLine2 || '';
    document.getElementById("city").value = details.city;
    document.getElementById("state").value = details.state;
    document.getElementById("country").value = details.country;
    document.getElementById("gender").value = details.gender;
    document.getElementById("medicalLicense").value = details.medicalLicense || '';
    document.getElementById("businessType").value = details.businessType || '';
    document.getElementById("telephone").value = details.telephone;
    document.getElementById("fax").value = details.fax || '';
    document.getElementById("email").value = details.email;
    document.querySelector("#add-specialist-form button[type='submit']").textContent = "Update Specialist";
    editId = id;
  } else {
    console.error('Specialist not found for ID:', id);
    alert('Specialist not found. Please refresh the page.');
  }
};

window.deleteSpecialist = function(id) {
  console.log('Delete clicked for ID:', id);
  if (!confirm("Are you sure you want to delete this specialist?")) return;
  let specialists = JSON.parse(localStorage.getItem(getDataKey("specialists")) || "[]");
  specialists = specialists.filter(s => s.id !== id);
  localStorage.setItem(getDataKey("specialists"), JSON.stringify(specialists));
  displaySpecialists();
};

const form = document.getElementById("add-specialist-form");
if (form) {
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    console.log('Form submit: editId =', editId);
    const specialty = document.getElementById("specialty").value;
    const details = {
      businessName: document.getElementById("businessName").value,
      firstName: document.getElementById("firstName").value,
      lastName: document.getElementById("lastName").value,
      addressLine1: document.getElementById("addressLine1").value,
      addressLine2: document.getElementById("addressLine2").value,
      city: document.getElementById("city").value,
      state: document.getElementById("state").value,
      country: document.getElementById("country").value,
      gender: document.getElementById("gender").value,
      medicalLicense: document.getElementById("medicalLicense").value,
      businessType: document.getElementById("businessType").value,
      telephone: document.getElementById("telephone").value,
      fax: document.getElementById("fax").value,
      email: document.getElementById("email").value
    };
    let specialists = JSON.parse(localStorage.getItem(getDataKey("specialists")) || "[]");
    if (editId) {
      const specIndex = specialists.findIndex(s => s.id === editId);
      console.log('Edit index found:', specIndex);
      if (specIndex !== -1) {
        specialists[specIndex].details = details;
      } else {
        console.error('Specialist not found for editId:', editId);
        alert('Specialist not found for editing. Please refresh and try again.');
      }
      editId = null;
      document.getElementById("specialty").disabled = false;
      document.querySelector("#add-specialist-form button[type='submit']").textContent = "Add Specialist";
    } else {
      specialists.push({ id: Date.now().toString() + Math.random().toString(36).slice(2), specialty, details });
    }
    localStorage.setItem(getDataKey("specialists"), JSON.stringify(specialists));
    form.reset();
    displaySpecialists();
  });
}

window.onload = function() {
  loadSpecialties();
  displaySpecialists();
};