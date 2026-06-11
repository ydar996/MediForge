// Phone Number Migration Script
// Purpose: Convert existing Nigerian phone numbers from local format (08033234567) to international (+2348033234567)

(function() {
  'use strict';
  
  const PHONE_MIG_VERBOSE = localStorage.getItem('enableVerboseLogs') === 'true';
  const phoneMigLog = (...args) => { if (PHONE_MIG_VERBOSE) console.log(...args); };

  // Fallback for getDataKey if not defined
  if (typeof window.getDataKey === 'undefined') {
    window.getDataKey = function(key) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.org ? `${user.org}_${key}` : key;
    };
  }
  
  // Migrate phone number from local to international format
  function migratePhoneNumber(phone, defaultCountryCode = '+234') {
    if (!phone || phone.trim() === '') return phone;
    
    // Clean the phone number
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Already has country code
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Remove leading zero
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Add country code
    return defaultCountryCode + cleaned;
  }
  
  // Migrate all patient phone numbers
  function migratePatientPhones() {
    const orgName = getCurrentOrganization();
    if (!orgName) return;
    
    const patientsKey = getDataKey('patients');
    const patients = JSON.parse(localStorage.getItem(patientsKey) || '[]');
    let migrated = 0;
    
    patients.forEach(patient => {
      // Migrate patient phone
      if (patient.phone && !patient.phone.startsWith('+')) {
        const oldPhone = patient.phone;
        patient.phone = migratePhoneNumber(patient.phone);
        phoneMigLog(`Migrated patient phone: ${oldPhone} → ${patient.phone}`);
        migrated++;
      }
      
      // Migrate emergency contact phone
      if (patient.emergencyPhone && !patient.emergencyPhone.startsWith('+')) {
        const oldPhone = patient.emergencyPhone;
        patient.emergencyPhone = migratePhoneNumber(patient.emergencyPhone);
        phoneMigLog(`Migrated emergency phone: ${oldPhone} → ${patient.emergencyPhone}`);
        migrated++;
      }
    });
    
    if (migrated > 0) {
      localStorage.setItem(patientsKey, JSON.stringify(patients));
      phoneMigLog(`✅ Migrated ${migrated} phone numbers to international format`);
    }
  }
  
  // Migrate organization phone numbers
  function migrateOrganizationPhones() {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    let migrated = 0;
    
    for (const [orgName, orgData] of Object.entries(organizations)) {
      // Migrate office phone
      if (orgData.phone && !orgData.phone.startsWith('+')) {
        const oldPhone = orgData.phone;
        orgData.phone = migratePhoneNumber(orgData.phone);
        phoneMigLog(`Migrated org phone (${orgName}): ${oldPhone} → ${orgData.phone}`);
        migrated++;
      }
      
      // Migrate after hours phone
      if (orgData.afterHoursPhone && !orgData.afterHoursPhone.startsWith('+')) {
        const oldPhone = orgData.afterHoursPhone;
        orgData.afterHoursPhone = migratePhoneNumber(orgData.afterHoursPhone);
        phoneMigLog(`Migrated after hours phone (${orgName}): ${oldPhone} → ${orgData.afterHoursPhone}`);
        migrated++;
      }
    }
    
    if (migrated > 0) {
      localStorage.setItem('organizations', JSON.stringify(organizations));
      phoneMigLog(`✅ Migrated ${migrated} organization phone numbers to international format`);
    }
  }
  
  // Get current organization from user data
  function getCurrentOrganization() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user ? (user.organization || user.org || 'Default Organization') : 'Default Organization';
  }

  // Run migration
  function runPhoneMigration() {
    phoneMigLog('🔄 Starting phone number migration...');
    
    // Check if already migrated
    const migrationStatus = JSON.parse(localStorage.getItem('phoneMigrationStatus') || '{}');
    const orgName = getCurrentOrganization();
    
    if (migrationStatus[orgName]) {
      phoneMigLog('Phone migration already completed for', orgName);
      return;
    }
    
    migratePatientPhones();
    migrateOrganizationPhones();
    
    // Mark as migrated
    migrationStatus[orgName] = {
      migrated: true,
      migratedAt: new Date().toISOString()
    };
    localStorage.setItem('phoneMigrationStatus', JSON.stringify(migrationStatus));
    
    phoneMigLog('✅ Phone migration completed');
  }
  
  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(runPhoneMigration, 500);
    });
  } else {
    setTimeout(runPhoneMigration, 500);
  }
  
  phoneMigLog('Phone migration module loaded');
})();


