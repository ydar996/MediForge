/**
 * MediForge Data Backup Script
 * Purpose: Export all localStorage data to downloadable JSON files
 * Run this BEFORE starting migration to production
 */

(function() {
  console.log('🔄 Starting MediForge Data Backup...');
  
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Helper function to safely get localStorage data
  function getLocalStorageData(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return defaultValue;
    }
  }
  
  // Helper function to download JSON file
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    console.log(`✅ Downloaded: ${filename}`);
  }
  
  // 1. Backup Organizations
  console.log('📊 Backing up organizations...');
  const organizations = getLocalStorageData('organizations', {});
  const orgCount = Object.keys(organizations).length;
  console.log(`   Found ${orgCount} organization(s)`);
  
  // 2. Backup Users
  console.log('👥 Backing up users...');
  const users = getLocalStorageData('users', []);
  console.log(`   Found ${users.length} user(s)`);
  
  // 3. Backup Platform Settings
  console.log('⚙️ Backing up platform settings...');
  const platformSettings = {
    platformAdmin: getLocalStorageData('platformAdmin', null),
    platform_subscription_plans: getLocalStorageData('platform_subscription_plans', null),
    platform_settings: getLocalStorageData('platform_settings', null)
  };
  
  // 4. Backup Organization-Specific Data
  console.log('📦 Backing up organization-specific data...');
  const orgData = {};
  
  Object.keys(organizations).forEach(orgName => {
    console.log(`   Processing: ${orgName}`);
    
    orgData[orgName] = {
      organization: organizations[orgName],
      patients: getLocalStorageData(`${orgName}_patients`, []),
      appointments: getLocalStorageData(`${orgName}_appointments`, []),
      billing_invoices: getLocalStorageData(`${orgName}_billing_invoices`, []),
      billing_payments: getLocalStorageData(`${orgName}_billing_payments`, []),
      billing_settings: getLocalStorageData(`${orgName}_billing_settings`, null),
      services: getLocalStorageData(`${orgName}_services`, []),
      specialists: getLocalStorageData(`${orgName}_specialists`, []),
      subscription: getLocalStorageData(`${orgName}_subscription`, null),
      schedule: getLocalStorageData(`${orgName}_schedule`, null)
    };
    
    // Count records
    const patientCount = orgData[orgName].patients.length;
    const apptCount = orgData[orgName].appointments.length;
    const invoiceCount = orgData[orgName].billing_invoices.length;
    
    console.log(`   - ${patientCount} patients`);
    console.log(`   - ${apptCount} appointments`);
    console.log(`   - ${invoiceCount} invoices`);
  });
  
  // 5. Backup Audit Logs
  console.log('📋 Backing up audit logs...');
  const auditLogs = getLocalStorageData('audit_log', []);
  console.log(`   Found ${auditLogs.length} audit log entries`);
  
  // Create comprehensive backup object
  const completeBackup = {
    backupInfo: {
      timestamp: new Date().toISOString(),
      date: timestamp,
      appVersion: 'v311', // Current service worker version
      organizationCount: orgCount,
      userCount: users.length,
      totalPatients: Object.values(orgData).reduce((sum, org) => sum + org.patients.length, 0),
      totalAppointments: Object.values(orgData).reduce((sum, org) => sum + org.appointments.length, 0)
    },
    organizations: organizations,
    users: users,
    platformSettings: platformSettings,
    organizationData: orgData,
    auditLogs: auditLogs
  };
  
  // Display summary
  console.log('\n📊 BACKUP SUMMARY:');
  console.log('═══════════════════════════════════════');
  console.log(`Organizations: ${completeBackup.backupInfo.organizationCount}`);
  console.log(`Users: ${completeBackup.backupInfo.userCount}`);
  console.log(`Total Patients: ${completeBackup.backupInfo.totalPatients}`);
  console.log(`Total Appointments: ${completeBackup.backupInfo.totalAppointments}`);
  console.log(`Audit Log Entries: ${auditLogs.length}`);
  console.log('═══════════════════════════════════════\n');
  
  // Download the backup
  const filename = `mediforge-backup-${timestamp}.json`;
  downloadJSON(completeBackup, filename);
  
  console.log('✅ BACKUP COMPLETE!');
  console.log(`📁 File saved as: ${filename}`);
  console.log('\n⚠️ IMPORTANT: Upload this file to Google Drive or Dropbox immediately!');
  console.log('This is your safety net if anything goes wrong during migration.\n');
  
  // Also create individual organization backups for easier restore
  Object.keys(organizations).forEach(orgName => {
    const orgBackup = {
      backupInfo: {
        timestamp: new Date().toISOString(),
        organizationName: orgName
      },
      ...orgData[orgName]
    };
    
    const safeOrgName = orgName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    downloadJSON(orgBackup, `backup-${safeOrgName}-${timestamp}.json`);
  });
  
  alert('✅ Backup complete! Check your Downloads folder.\n\nFiles created:\n1. Complete backup (all data)\n2. Individual organization backups\n\n⚠️ Upload these to Google Drive/Dropbox NOW!');
})();

