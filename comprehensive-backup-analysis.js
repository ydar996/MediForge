const fs = require('fs');

console.log('🔍 COMPREHENSIVE BACKUP ANALYSIS\n');
console.log('Checking EVERY field in the backup...\n');

const backupText = fs.readFileSync('mediforge-backup-2025-10-14.json', 'utf8');
const cleanedText = backupText.replace(/"followup":\s*"[^"]*",\s*"followUp"/g, '"followUp"');
const backup = JSON.parse(cleanedText);

// Deep field collection
function collectAllFields(obj, prefix = '', allFields = new Set()) {
    if (obj === null || obj === undefined) return allFields;
    
    if (Array.isArray(obj)) {
        obj.forEach(item => collectAllFields(item, prefix, allFields));
    } else if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            allFields.add(fullPath);
            collectAllFields(obj[key], fullPath, allFields);
        });
    }
    
    return allFields;
}

// Analyze patient data
console.log('=== PATIENT DATA FIELDS ===');
const mecure = backup.organizationData?.['Mecure Clinics'];
if (mecure && mecure.patients && mecure.patients.length > 0) {
    const allPatientFields = new Set();
    mecure.patients.forEach(p => collectAllFields(p, 'patient', allPatientFields));
    
    const sortedFields = Array.from(allPatientFields).sort();
    console.log(`Total unique fields in patient data: ${sortedFields.length}\n`);
    
    sortedFields.forEach(field => console.log(`  ${field}`));
}

// Analyze appointments
console.log('\n\n=== APPOINTMENT DATA FIELDS ===');
if (mecure && mecure.appointments && mecure.appointments.length > 0) {
    const allApptFields = new Set();
    mecure.appointments.forEach(a => collectAllFields(a, 'appointment', allApptFields));
    
    const sortedFields = Array.from(allApptFields).sort();
    console.log(`Total unique fields in appointment data: ${sortedFields.length}\n`);
    
    sortedFields.forEach(field => console.log(`  ${field}`));
}

// Check for specific data types
console.log('\n\n=== DATA TYPE COUNTS ===');

let counts = {
    patients: 0,
    visits: 0,
    vitals: 0,
    diagnoses: 0,
    medications: 0,
    prescriptions: 0,
    medicalHistory: 0,
    preventiveGaps: 0,
    labOrders: 0,
    imagingOrders: 0,
    referrals: 0,
    allergies: 0,
    conditions: 0,
    insuranceInfo: 0,
    appointments: 0,
    invoices: 0,
    payments: 0,
    orders: 0
};

if (mecure && mecure.patients) {
    counts.patients = mecure.patients.length;
    
    mecure.patients.forEach(p => {
        if (p.visits) counts.visits += p.visits.length;
        if (p.diagnoses) counts.diagnoses += p.diagnoses.length;
        if (p.medications) counts.medications += p.medications.length;
        if (p.prescriptions) counts.prescriptions += p.prescriptions.length;
        if (p.medicalHistory) counts.medicalHistory += p.medicalHistory.length;
        if (p.preventiveGaps) counts.preventiveGaps += p.preventiveGaps.length;
        if (p.allergies && Array.isArray(p.allergies)) counts.allergies += p.allergies.length;
        if (p.conditions && Array.isArray(p.conditions)) counts.conditions += p.conditions.length;
        if (p.insuranceName) counts.insuranceInfo++;
        if (p.orders && Array.isArray(p.orders)) counts.orders += p.orders.length;
        
        // Count vitals, lab orders, imaging orders from visits
        if (p.visits) {
            p.visits.forEach(v => {
                if (v.soap?.objective?.vitals) {
                    counts.vitals += Array.isArray(v.soap.objective.vitals) ? v.soap.objective.vitals.length : 1;
                }
                if (v.soap?.objective?.labOrders) counts.labOrders += v.soap.objective.labOrders.length;
                if (v.soap?.objective?.imagingOrders) counts.imagingOrders += v.soap.objective.imagingOrders.length;
                if (v.soap?.plan?.referrals && typeof v.soap.plan.referrals === 'string' && v.soap.plan.referrals.trim()) {
                    counts.referrals++;
                }
            });
        }
        
        // Count referrals from patient level
        if (p.referrals && Array.isArray(p.referrals)) counts.referrals += p.referrals.length;
    });
}

if (mecure && mecure.appointments) {
    counts.appointments = mecure.appointments.length;
    
    mecure.appointments.forEach(a => {
        if (a.invoice) {
            counts.invoices++;
            if (a.invoice.payments) counts.payments += a.invoice.payments.length;
        }
        if (a.orders && Array.isArray(a.orders)) counts.orders += a.orders.length;
    });
}

console.log('\nData Counts:');
Object.entries(counts).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
});

// Check for any fields we might have missed
console.log('\n\n=== CHECKING FOR UNMAPPED FIELDS ===');

const mappedFields = [
    // Patient fields
    'id', 'firstName', 'middleName', 'lastName', 'dob', 'gender', 'maritalStatus',
    'race', 'email', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'country',
    'emergencyFirstName', 'emergencyLastName', 'emergencyRelationship', 'emergencyPhone',
    'emergencyEmail', 'emergencyAddressLine1', 'emergencyAddressLine2', 'emergencyCity',
    'emergencyState', 'emergencyCountry', 'bloodGroup', 'allergies', 'conditions',
    'hasDiabetes', 'paymentSource', 'insuranceName', 'insurancePolicyGroupNumber',
    'insuranceMemberNumber', 'insuranceCardFront', 'insuranceCardBack',
    // Clinical fields
    'visits', 'diagnoses', 'medications', 'prescriptions', 'medicalHistory', 
    'preventiveGaps', 'orders', 'referrals',
    // Appointment fields
    'patientName', 'date', 'time', 'doctor', 'notes', 'status', 'duration',
    'reason', 'checkInTime', 'checkOutTime', 'invoice'
];

console.log('\nChecking patient data for unmapped fields...');
if (mecure && mecure.patients && mecure.patients.length > 0) {
    const samplePatient = mecure.patients[0];
    const patientKeys = Object.keys(samplePatient);
    const unmappedPatient = patientKeys.filter(k => !mappedFields.includes(k));
    
    if (unmappedPatient.length > 0) {
        console.log('⚠️  UNMAPPED PATIENT FIELDS:');
        unmappedPatient.forEach(k => console.log(`  - ${k}: ${typeof samplePatient[k]}`));
    } else {
        console.log('✅ All patient fields are mapped');
    }
}

console.log('\nChecking appointment data for unmapped fields...');
if (mecure && mecure.appointments && mecure.appointments.length > 0) {
    const allApptKeys = new Set();
    mecure.appointments.forEach(a => {
        Object.keys(a).forEach(k => allApptKeys.add(k));
    });
    
    const unmappedAppt = Array.from(allApptKeys).filter(k => !mappedFields.includes(k));
    
    if (unmappedAppt.length > 0) {
        console.log('⚠️  UNMAPPED APPOINTMENT FIELDS:');
        unmappedAppt.forEach(k => console.log(`  - ${k}`));
    } else {
        console.log('✅ All appointment fields are mapped');
    }
}

// Sample data
console.log('\n\n=== SAMPLE DATA FOR VERIFICATION ===');
if (mecure && mecure.patients && mecure.patients.length > 0) {
    const patient = mecure.patients.find(p => p.visits && p.visits.length > 0) || mecure.patients[0];
    console.log('\nSample Patient (showing fields with data):');
    Object.keys(patient).forEach(key => {
        if (patient[key] && patient[key] !== '' && !Array.isArray(patient[key]) && typeof patient[key] !== 'object') {
            console.log(`  ${key}: ${patient[key]}`);
        }
    });
    
    if (patient.visits && patient.visits.length > 0) {
        console.log('\nSample Visit:');
        console.log(JSON.stringify(patient.visits[0], null, 2).substring(0, 500) + '...');
    }
}

console.log('\n✅ ANALYSIS COMPLETE!\n');



