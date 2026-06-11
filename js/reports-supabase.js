// Purpose: Generates reports and exports data using Supabase

// Shared Supabase client helper
async function getSupabaseClient(maxRetries = 5, intervalMs = 200) {
  let attempts = 0;
  while (attempts < maxRetries) {
    if (typeof window !== 'undefined' && window.supabaseClient) {
      return window.supabaseClient;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts += 1;
  }
  console.error('❌ [REPORTS] Supabase client not available after retries');
  return null;
}

// Get current user's organization ID
async function getCurrentOrgId() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (user.org && user.org.includes('-')) {
    return user.org;
  }
  
  const client = await getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('organizations')
      .select('id')
      .eq('name', user.org)
      .single();
    
    if (error) {
      console.error('❌ [REPORTS] Error getting organization ID:', error);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('❌ [REPORTS] Exception getting organization ID:', error);
    return null;
  }
}

// Get organization statistics
async function getOrganizationStats() {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('❌ [REPORTS] Cannot get stats - no organization');
    return { patients: 0, appointments: 0, prescriptions: 0, invoices: 0 };
  }
  
  const client = await getSupabaseClient();
  if (!client) return { patients: 0, appointments: 0, prescriptions: 0, invoices: 0 };
  
  try {
    // Get patient count
    const { count: patientCount } = await client
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    
    // Get appointment count
    const { count: appointmentCount } = await client
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    
    // Get prescription count
    const { count: prescriptionCount } = await client
      .from('prescriptions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    
    // Get invoice count
    const { count: invoiceCount } = await client
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    
    return {
      patients: patientCount || 0,
      appointments: appointmentCount || 0,
      prescriptions: prescriptionCount || 0,
      invoices: invoiceCount || 0
    };
  } catch (error) {
    console.error('❌ [REPORTS] Exception getting stats:', error);
    return { patients: 0, appointments: 0, prescriptions: 0, invoices: 0 };
  }
}

// Export patients to CSV
async function exportPatientsToCSV() {
  try {
    const orgId = await getCurrentOrgId();
    if (!orgId) {
      alert('Cannot export - no organization found');
      return;
    }
    
    const client = await getSupabaseClient();
    if (!client) {
      alert('Cannot export - database not available');
      return;
    }
    
    const { data: patients, error } = await client
      .from('patients')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [REPORTS] Error fetching patients:', error);
      alert('Error fetching patients for export');
      return;
    }
    
    let csv = "Patient ID,First Name,Last Name,Date of Birth,Gender,Phone,Email,Address\n";
    
    patients.forEach(patient => {
      const row = [
        patient.patient_id || '',
        patient.first_name || '',
        patient.last_name || '',
        patient.date_of_birth || '',
        patient.gender || '',
        patient.phone || '',
        patient.email || '',
        `${patient.address_line1 || ''} ${patient.city || ''} ${patient.state || ''}`.trim()
      ].map(field => `"${field}"`).join(',');
      csv += row + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('❌ [REPORTS] Error exporting patients:', error);
    alert('Error exporting patients');
  }
}

// Export appointments to CSV
async function exportAppointmentsToCSV() {
  try {
    const orgId = await getCurrentOrgId();
    if (!orgId) {
      alert('Cannot export - no organization found');
      return;
    }
    
    const client = await getSupabaseClient();
    if (!client) {
      alert('Cannot export - database not available');
      return;
    }
    
    const { data: appointments, error } = await client
      .from('appointments')
      .select('*')
      .eq('organization_id', orgId)
      .order('appointment_date', { ascending: false });
    
    if (error) {
      console.error('❌ [REPORTS] Error fetching appointments:', error);
      alert('Error fetching appointments for export');
      return;
    }
    
    let csv = "Appointment ID,Patient Name,Date,Time,Type,Status,Notes\n";
    
    appointments.forEach(appointment => {
      const row = [
        appointment.id || '',
        appointment.patient_name || '',
        appointment.appointment_date || '',
        appointment.appointment_time || '',
        appointment.appointment_type || '',
        appointment.status || '',
        appointment.notes || ''
      ].map(field => `"${field}"`).join(',');
      csv += row + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('❌ [REPORTS] Error exporting appointments:', error);
    alert('Error exporting appointments');
  }
}

// Export prescriptions to CSV
async function exportPrescriptionsToCSV() {
  try {
    const orgId = await getCurrentOrgId();
    if (!orgId) {
      alert('Cannot export - no organization found');
      return;
    }
    
    const client = await getSupabaseClient();
    if (!client) {
      alert('Cannot export - database not available');
      return;
    }
    
    const { data: prescriptions, error } = await client
      .from('prescriptions')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [REPORTS] Error fetching prescriptions:', error);
      alert('Error fetching prescriptions for export');
      return;
    }
    
    let csv = "Prescription,Patient ID,Diagnosis,Medications,Status,Date,Record ID\n";
    
    prescriptions.forEach(prescription => {
      const medications = JSON.parse(prescription.medications || '[]');
      const medicationNames = medications.map(med => med.drug).join('; ');
      const display =
        prescription.prescription_number ||
        '';
      
      const row = [
        display,
        prescription.patient_id || '',
        prescription.diagnosis || '',
        medicationNames,
        prescription.status || '',
        prescription.created_at || '',
        prescription.id || ''
      ].map(field => `"${field}"`).join(',');
      csv += row + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prescriptions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('❌ [REPORTS] Error exporting prescriptions:', error);
    alert('Error exporting prescriptions');
  }
}

// Initialize reports page
async function initializeReportsPage() {
  console.log('🚀 [REPORTS] Initializing reports page');
  
  // Ensure Supabase is ready (non-fatal if not)
  await getSupabaseClient();
  
  // Update stats display
  const statsElement = document.getElementById("stats");
  if (statsElement) {
    try {
      const stats = await getOrganizationStats();
      statsElement.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; color: #1976d2;">👥 Patients</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #1976d2;">${stats.patients}</p>
          </div>
          <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; color: #7b1fa2;">📅 Appointments</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #7b1fa2;">${stats.appointments}</p>
          </div>
          <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; color: #388e3c;">💊 Prescriptions</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #388e3c;">${stats.prescriptions}</p>
          </div>
          <div style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; color: #f57c00;">💰 Invoices</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #f57c00;">${stats.invoices}</p>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('❌ [REPORTS] Error loading stats:', error);
      statsElement.innerHTML = '<p style="color: red;">Error loading statistics</p>';
    }
  }
  
  // Set up export button
  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportPatientsToCSV);
  }
}

// Export functions for global use
window.getOrganizationStats = getOrganizationStats;
window.exportPatientsToCSV = exportPatientsToCSV;
window.exportAppointmentsToCSV = exportAppointmentsToCSV;
window.exportPrescriptionsToCSV = exportPrescriptionsToCSV;

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeReportsPage);

// Initialize on load
console.log('✅ [REPORTS] Supabase reports module loaded');


