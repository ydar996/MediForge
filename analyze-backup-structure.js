const fs = require('fs');

console.log('📊 Analyzing backup structure...\n');

// Read the backup file
const backupText = fs.readFileSync('mediforge-backup-2025-10-14.json', 'utf8');

// Handle duplicate keys by cleaning
const cleanedText = backupText.replace(/"followup":\s*"[^"]*",\s*"followUp"/g, '"followUp"');
const backup = JSON.parse(cleanedText);

console.log('=== BACKUP OVERVIEW ===');
console.log(`Organizations: ${Object.keys(backup.organizations || {}).length}`);
console.log(`Users: ${(backup.users || []).length}`);
console.log(`Audit Logs: ${(backup.auditLogs || []).length}\n`);

// Analyze Mecure Clinics data
const mecure = backup.organizationData?.['Mecure Clinics'];
if (mecure) {
    console.log('=== MECURE CLINICS DATA ===');
    console.log(`Patients: ${(mecure.patients || []).length}`);
    console.log(`Appointments: ${(mecure.appointments || []).length}\n`);
    
    // Analyze patient structure
    if (mecure.patients && mecure.patients.length > 0) {
        console.log('=== PATIENT DATA STRUCTURE ===');
        const samplePatient = mecure.patients[0];
        
        function analyzeObject(obj, prefix = '') {
            const keys = Object.keys(obj);
            keys.forEach(key => {
                const value = obj[key];
                const type = Array.isArray(value) ? 'array' : typeof value;
                
                if (Array.isArray(value) && value.length > 0) {
                    console.log(`${prefix}${key}: array[${value.length}] of ${typeof value[0]}`);
                    if (typeof value[0] === 'object' && value[0] !== null) {
                        analyzeObject(value[0], `${prefix}  `);
                    }
                } else if (type === 'object' && value !== null) {
                    console.log(`${prefix}${key}: object`);
                    analyzeObject(value, `${prefix}  `);
                } else {
                    console.log(`${prefix}${key}: ${type}`);
                }
            });
        }
        
        analyzeObject(samplePatient);
    }
    
    // Analyze appointment structure
    if (mecure.appointments && mecure.appointments.length > 0) {
        console.log('\n=== APPOINTMENT DATA STRUCTURE ===');
        const sampleAppointment = mecure.appointments.find(a => a.invoice) || mecure.appointments[0];
        
        function analyzeObject(obj, prefix = '') {
            const keys = Object.keys(obj);
            keys.forEach(key => {
                const value = obj[key];
                const type = Array.isArray(value) ? 'array' : typeof value;
                
                if (Array.isArray(value) && value.length > 0) {
                    console.log(`${prefix}${key}: array[${value.length}] of ${typeof value[0]}`);
                    if (typeof value[0] === 'object' && value[0] !== null) {
                        analyzeObject(value[0], `${prefix}  `);
                    }
                } else if (type === 'object' && value !== null) {
                    console.log(`${prefix}${key}: object`);
                    analyzeObject(value, `${prefix}  `);
                } else {
                    console.log(`${prefix}${key}: ${type}`);
                }
            });
        }
        
        analyzeObject(sampleAppointment);
    }
    
    // Count total clinical data items
    console.log('\n=== CLINICAL DATA COUNTS ===');
    let totalVisits = 0;
    let totalVitals = 0;
    let totalDiagnoses = 0;
    let totalMedications = 0;
    let totalPrescriptions = 0;
    let totalMedicalHistory = 0;
    let totalPreventiveGaps = 0;
    let totalLabOrders = 0;
    let totalImagingOrders = 0;
    
    mecure.patients.forEach(patient => {
        totalVisits += (patient.visits || []).length;
        totalDiagnoses += (patient.diagnoses || []).length;
        totalMedications += (patient.medications || []).length;
        totalPrescriptions += (patient.prescriptions || []).length;
        totalMedicalHistory += (patient.medicalHistory || []).length;
        totalPreventiveGaps += (patient.preventiveGaps || []).length;
        
        (patient.visits || []).forEach(visit => {
            if (visit.soap?.objective?.vitals) {
                totalVitals += Array.isArray(visit.soap.objective.vitals) ? visit.soap.objective.vitals.length : 1;
            }
            if (visit.soap?.objective?.labOrders) {
                totalLabOrders += visit.soap.objective.labOrders.length;
            }
            if (visit.soap?.objective?.imagingOrders) {
                totalImagingOrders += visit.soap.objective.imagingOrders.length;
            }
        });
    });
    
    console.log(`Total Visits: ${totalVisits}`);
    console.log(`Total Vitals: ${totalVitals}`);
    console.log(`Total Diagnoses: ${totalDiagnoses}`);
    console.log(`Total Medications: ${totalMedications}`);
    console.log(`Total Prescriptions: ${totalPrescriptions}`);
    console.log(`Total Medical History: ${totalMedicalHistory}`);
    console.log(`Total Preventive Gaps: ${totalPreventiveGaps}`);
    console.log(`Total Lab Orders: ${totalLabOrders}`);
    console.log(`Total Imaging Orders: ${totalImagingOrders}`);
    
    // Count invoices
    let totalInvoices = 0;
    let totalPayments = 0;
    mecure.appointments.forEach(appt => {
        if (appt.invoice) totalInvoices++;
        if (appt.invoice?.payments) totalPayments += appt.invoice.payments.length;
    });
    console.log(`Total Invoices: ${totalInvoices}`);
    console.log(`Total Payments: ${totalPayments}`);
}

console.log('\n✅ Analysis complete!');



