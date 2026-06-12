// Purpose: Data interoperability module for MediForge
// Handles bulk import, CSV/Excel parsing, and data format conversions

// Parse CSV file content
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty or invalid');
  }
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const values = parseCSVLine(lines[i]);
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return { headers, data };
}

// Parse a single CSV line (handles quoted values with commas)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push last field
  result.push(current.trim());
  
  return result;
}

// Map CSV headers to patient object fields
const CSV_FIELD_MAPPING = {
  // Common variations of field names
  'ID': 'id',
  'Patient ID': 'id',
  'PatientID': 'id',
  'First Name': 'firstName',
  'FirstName': 'firstName',
  'Middle Name': 'middleName',
  'MiddleName': 'middleName',
  'Last Name': 'lastName',
  'LastName': 'lastName',
  'DOB': 'dob',
  'Date of Birth': 'dob',
  'DateOfBirth': 'dob',
  'Gender': 'gender',
  'Sex': 'gender',
  'Marital Status': 'maritalStatus',
  'MaritalStatus': 'maritalStatus',
  'Race': 'race',
  'Ethnicity': 'race',
  'Email': 'email',
  'Phone': 'phone',
  'Telephone': 'phone',
  'Mobile': 'phone',
  'Address Line 1': 'addressLine1',
  'AddressLine1': 'addressLine1',
  'Address': 'addressLine1',
  'City': 'city',
  'State': 'state',
  'Province': 'state',
  'Country': 'country'
};

// Import patients from CSV
window.importPatientsFromCSV = function(file) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const csvText = e.target.result;
      const parsed = parseCSV(csvText);
      
      console.log('Parsed CSV:', parsed);
      
      // Map CSV data to patient objects
      const importedPatients = [];
      let skippedCount = 0;
      
      parsed.data.forEach((row, index) => {
        try {
          // Map CSV fields to patient object
          const patient = {};
          
          Object.keys(row).forEach(csvField => {
            const mappedField = CSV_FIELD_MAPPING[csvField] || csvField.toLowerCase().replace(/\s+/g, '');
            patient[mappedField] = row[csvField];
          });
          
          // Validate required fields
          if (!patient.firstName || !patient.lastName || !patient.dob) {
            console.warn(`Skipping row ${index + 2}: Missing required fields`);
            skippedCount++;
            return;
          }
          
          // Generate ID if not provided
          if (!patient.id) {
            patient.id = generatePatientId();
          }
          
          // Set defaults for optional fields
          patient.gender = patient.gender || 'Unknown';
          patient.maritalStatus = patient.maritalStatus || 'Unknown';
          patient.race = patient.race || 'Other';
          patient.phone = patient.phone || '';
          patient.email = patient.email || '';
          patient.addressLine1 = patient.addressLine1 || '';
          patient.city = patient.city || '';
          patient.state = patient.state || '';
          patient.country = patient.country || '';
          
          // Initialize arrays
          patient.medicalHistory = patient.medicalHistory || [];
          patient.diagnoses = patient.diagnoses || [];
          patient.medications = patient.medications || [];
          patient.allergies = patient.allergies || [];
          patient.immunizations = patient.immunizations || [];
          patient.visits = patient.visits || [];
          patient.prescriptions = patient.prescriptions || [];
          patient.encounters = patient.encounters || [];
          
          importedPatients.push(patient);
        } catch (err) {
          console.error(`Error processing row ${index + 2}:`, err);
          skippedCount++;
        }
      });
      
      if (importedPatients.length === 0) {
        alert('No valid patients found in CSV file');
        return;
      }
      
      // Confirm before importing
      const confirmMessage = `Ready to import ${importedPatients.length} patients${skippedCount > 0 ? ` (${skippedCount} rows skipped)` : ''}.\n\nThis will ADD to your existing patients. Continue?`;
      
      if (!confirm(confirmMessage)) {
        console.log('Import cancelled by user');
        return;
      }
      
      // Get existing patients
      const existingPatients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
      
      // Check for duplicate IDs
      const duplicates = [];
      importedPatients.forEach(newPatient => {
        if (existingPatients.some(p => p.id === newPatient.id)) {
          duplicates.push(newPatient.id);
        }
      });
      
      if (duplicates.length > 0) {
        const proceedWithDuplicates = confirm(`Warning: ${duplicates.length} patients have duplicate IDs:\n${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '...' : ''}\n\nThese will be skipped. Continue with the rest?`);
        
        if (!proceedWithDuplicates) {
          return;
        }
        
        // Filter out duplicates
        const noDuplicates = importedPatients.filter(p => !duplicates.includes(p.id));
        importedPatients.length = 0;
        importedPatients.push(...noDuplicates);
      }
      
      // Merge with existing patients
      const mergedPatients = [...existingPatients, ...importedPatients];
      localStorage.setItem(getDataKey("patients"), JSON.stringify(mergedPatients));
      
      // Log the import
      logAuditEvent('patients_imported', { 
        count: importedPatients.length, 
        skipped: skippedCount,
        duplicates: duplicates.length
      });
      
      alert(`✓ Successfully imported ${importedPatients.length} patients!${skippedCount > 0 ? `\n\n⚠️ ${skippedCount} rows were skipped due to errors.` : ''}${duplicates.length > 0 ? `\n\n⚠️ ${duplicates.length} duplicate IDs were skipped.` : ''}\n\nTotal patients: ${mergedPatients.length}`);
      
      // Offer to go to patients page
      if (confirm('Import complete! View patients list now?')) {
        window.location.href = '/patients';
      }
      
    } catch (error) {
      alert('Failed to import CSV: ' + error.message);
      console.error('CSV import error:', error);
    }
  };
  
  reader.onerror = function() {
    alert('Failed to read CSV file');
  };
  
  reader.readAsText(file);
};

// Trigger file input for CSV import
window.selectCSVImportFile = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.txt';
  
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      importPatientsFromCSV(file);
    }
  };
  
  input.click();
};

// Export comprehensive medical data for specific patient (HL7-inspired format)
window.exportPatientHL7Style = function(patientId) {
  try {
    const patients = JSON.parse(localStorage.getItem(getDataKey("patients")) || "[]");
    const patient = patients.find(p => p.id === patientId);
    
    if (!patient) {
      alert('Patient not found');
      return;
    }
    
    // Create HL7-style text format (simplified)
    let hl7 = `MSH|^~\\&|MEDIFORGE|${patient.id}|RECEIVER||${new Date().toISOString()}||ADT^A01|MSG${Date.now()}|P|2.5\n`;
    
    // Patient Identification
    hl7 += `PID|1||${patient.id}||${patient.lastName}^${patient.firstName}^${patient.middleName || ''}||${patient.dob}|${patient.gender}|||${patient.addressLine1}^${patient.addressLine2}^${patient.city}^${patient.state}^^${patient.country}||${patient.phone}||${patient.maritalStatus}|||${patient.race}\n`;
    
    // Diagnoses
    if (patient.diagnoses && patient.diagnoses.length > 0) {
      patient.diagnoses.forEach(dx => {
        hl7 += `DG1|1||${dx.diagnosis}|||${dx.date}\n`;
      });
    }
    
    // Medications
    if (patient.medications && patient.medications.length > 0) {
      patient.medications.forEach(med => {
        hl7 += `RXA|1||${med.name}|${med.dosage}||${med.startDate}|${med.endDate}\n`;
      });
    }
    
    // Allergies
    if (patient.allergies && patient.allergies.length > 0) {
      patient.allergies.forEach(allergy => {
        hl7 += `AL1|1||${allergy.allergen}|${allergy.severity}|${allergy.reaction}\n`;
      });
    }
    
    const blob = new Blob([hl7], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${patient.id}-HL7-${new Date().toISOString().split('T')[0]}.hl7`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logAuditEvent('patient_exported_hl7', { patientId: patient.id });
    
    alert(`Patient data exported in HL7 format!\nFile: ${a.download}`);
  } catch (error) {
    alert('Failed to export HL7: ' + error.message);
    console.error('HL7 export error:', error);
  }
};

// Create data import/export page UI
window.openDataImportExport = function() {
  window.location.href = '/data-import-export';
};

console.log('Interoperability module loaded successfully');


