const fs = require('fs');

console.log('🔍 FINAL COMPLETE DATA INVENTORY\n');

const backupText = fs.readFileSync('mediforge-backup-2025-10-14.json', 'utf8');
const cleanedText = backupText.replace(/"followup":\s*"[^"]*",\s*"followUp"/g, '"followUp"');
const backup = JSON.parse(cleanedText);

const mecure = backup.organizationData?.['Mecure Clinics'];

console.log('=== COMPLETE DATA INVENTORY ===\n');

// 1. Patient Clinical Data
let totalVisits = 0, totalVitals = 0, totalDiagnoses = 0;
let totalMedications = 0, totalPrescriptions = 0, totalMedicalHistory = 0;
let totalPreventive = 0, totalLabOrders = 0, totalImagingOrders = 0;
let totalAllergies = 0, totalImmunizations = 0, totalImagingResults = 0;
let totalOrders = 0, totalEncounters = 0, totalReferrals = 0;

if (mecure && mecure.patients) {
    mecure.patients.forEach(p => {
        if (p.visits) totalVisits += p.visits.length;
        if (p.diagnoses) totalDiagnoses += p.diagnoses.length;
        if (p.medications) totalMedications += p.medications.length;
        if (p.prescriptions) totalPrescriptions += p.prescriptions.length;
        if (p.medicalHistory) totalMedicalHistory += p.medicalHistory.length;
        if (p.preventiveGaps) totalPreventive += p.preventiveGaps.length;
        if (p.allergies && Array.isArray(p.allergies)) totalAllergies += p.allergies.length;
        if (p.immunizations && Array.isArray(p.immunizations)) totalImmunizations += p.immunizations.length;
        if (p.imagingResults && Array.isArray(p.imagingResults)) totalImagingResults += p.imagingResults.length;
        if (p.encounters && Array.isArray(p.encounters)) totalEncounters += p.encounters.length;
        if (p.orders && Array.isArray(p.orders)) totalOrders += p.orders.length;
        
        if (p.visits) {
            p.visits.forEach(v => {
                if (v.soap?.objective?.vitals) {
                    totalVitals += Array.isArray(v.soap.objective.vitals) ? v.soap.objective.vitals.length : 1;
                }
                if (v.soap?.objective?.labOrders) totalLabOrders += v.soap.objective.labOrders.length;
                if (v.soap?.objective?.imagingOrders) totalImagingOrders += v.soap.objective.imagingOrders.length;
                if (v.orders && Array.isArray(v.orders)) totalOrders += v.orders.length;
                if (v.referrals && Array.isArray(v.referrals)) totalReferrals += v.referrals.length;
            });
        }
    });
}

console.log('📋 CLINICAL DATA:');
console.log(`  Patients: ${mecure.patients.length}`);
console.log(`  Patient Visits/Encounters: ${totalVisits}`);
console.log(`  Vital Signs: ${totalVitals}`);
console.log(`  Diagnoses: ${totalDiagnoses}`);
console.log(`  Medications (Active): ${totalMedications}`);
console.log(`  Prescriptions: ${totalPrescriptions}`);
console.log(`  Medical History: ${totalMedicalHistory}`);
console.log(`  Preventive Care Items: ${totalPreventive}`);
console.log(`  Allergies: ${totalAllergies}`);
console.log(`  Immunizations: ${totalImmunizations}`);
console.log(`  Imaging Results (Files): ${totalImagingResults}`);
console.log(`  Lab Orders: ${totalLabOrders}`);
console.log(`  Imaging Orders: ${totalImagingOrders}`);
console.log(`  Clinical Orders: ${totalOrders}`);
console.log(`  Patient Encounter Requests: ${totalEncounters}`);
console.log(`  Referrals: ${totalReferrals}`);

// 2. Billing Data
const invoices = mecure?.billing_invoices || [];
const payments = mecure?.billing_payments || [];

console.log('\n💰 BILLING DATA:');
console.log(`  Invoices: ${invoices.length}`);
console.log(`  Payments: ${payments.length}`);

if (invoices.length > 0) {
    let totalRevenue = 0, totalPaid = 0, totalDue = 0;
    let serviceCount = 0;
    
    invoices.forEach(inv => {
        totalRevenue += inv.total || 0;
        totalPaid += inv.amountPaid || 0;
        totalDue += inv.amountDue || 0;
        if (inv.services) serviceCount += inv.services.length;
    });
    
    console.log(`  Total Revenue: ${totalRevenue.toLocaleString()} NGN`);
    console.log(`  Total Paid: ${totalPaid.toLocaleString()} NGN`);
    console.log(`  Total Due: ${totalDue.toLocaleString()} NGN`);
    console.log(`  Invoice Service Items: ${serviceCount}`);
}

// 3. Other Data
const specialists = mecure?.specialists || [];
const services = mecure?.services || [];
const appointments = mecure?.appointments || [];

console.log('\n📅 APPOINTMENTS & SCHEDULING:');
console.log(`  Appointments: ${appointments.length}`);

console.log('\n🏥 ORGANIZATIONAL DATA:');
console.log(`  Specialists/Referral Network: ${specialists.length}`);
console.log(`  Service Catalog: ${services.length}`);

// Sample data
console.log('\n\n=== SAMPLE BILLING DATA ===');
if (invoices.length > 0) {
    console.log('\nSample Invoice:');
    console.log(JSON.stringify(invoices[0], null, 2));
}

if (payments.length > 0) {
    console.log('\nSample Payment:');
    console.log(JSON.stringify(payments[0], null, 2));
}

if (specialists.length > 0) {
    console.log('\nSample Specialist:');
    console.log(JSON.stringify(specialists[0], null, 2));
}

console.log('\n\n✅ FINAL INVENTORY COMPLETE!\n');



