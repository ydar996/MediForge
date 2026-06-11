// Purpose: Comprehensive data backup and restore system for MediForge
// Handles automatic backups, manual export/import, and data validation

// Backup configuration
const BACKUP_CONFIG = {
  autoBackupEnabled: true,
  autoBackupInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  maxBackupSize: 50 * 1024 * 1024, // 50MB limit for backup files
  backupVersion: '1.0',
  encryptionEnabled: true // Enable encryption by default
};

// Get all data keys for the current organization
function getAllDataKeys() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const prefix = user.org || "";
  
  return {
    patients: prefix ? `${prefix}_patients` : 'patients',
    appointments: prefix ? `${prefix}_appointments` : 'appointments',
    specialists: prefix ? `${prefix}_specialists` : 'specialists',
    users: 'users',
    organizations: 'organizations'
  };
}

// Create comprehensive backup of all application data
window.createFullBackup = function() {
  try {
    console.log('Creating full backup...');
    
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const keys = getAllDataKeys();
    
    const backup = {
      metadata: {
        version: BACKUP_CONFIG.backupVersion,
        timestamp: new Date().toISOString(),
        createdBy: user.username || 'unknown',
        organization: user.org || 'unknown',
        appVersion: '1.0.0'
      },
      data: {
        patients: localStorage.getItem(keys.patients) || '[]',
        appointments: localStorage.getItem(keys.appointments) || '[]',
        specialists: localStorage.getItem(keys.specialists) || '[]',
        users: localStorage.getItem(keys.users) || '[]',
        organizations: localStorage.getItem(keys.organizations) || '{}'
      },
      statistics: {
        patientCount: JSON.parse(localStorage.getItem(keys.patients) || '[]').length,
        appointmentCount: JSON.parse(localStorage.getItem(keys.appointments) || '[]').length,
        userCount: JSON.parse(localStorage.getItem(keys.users) || '[]').length
      }
    };
    
    console.log('Backup created:', backup.metadata);
    return backup;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw new Error('Failed to create backup: ' + error.message);
  }
};

/**
 * Encrypt data using Web Crypto API (AES-GCM)
 * Uses PBKDF2 to derive key from password
 */
async function encryptBackupData(data, password) {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Derive key from password using PBKDF2
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBuffer
    );
    
    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64 for storage
    const base64 = btoa(String.fromCharCode(...result));
    
    return {
      encrypted: base64,
      algorithm: 'AES-GCM-256',
      iterations: 100000,
      saltLength: salt.length,
      ivLength: iv.length
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt backup: ' + error.message);
  }
}

/**
 * Decrypt data using Web Crypto API
 */
async function decryptBackupData(encryptedData, password) {
  try {
    const encoder = new TextEncoder();
    
    // Decode base64
    const binaryString = atob(encryptedData.encrypted);
    const dataArray = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      dataArray[i] = binaryString.charCodeAt(i);
    }
    
    // Extract salt, IV, and encrypted data
    const salt = dataArray.slice(0, encryptedData.saltLength);
    const iv = dataArray.slice(encryptedData.saltLength, encryptedData.saltLength + encryptedData.ivLength);
    const encrypted = dataArray.slice(encryptedData.saltLength + encryptedData.ivLength);
    
    // Derive key from password
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: encryptedData.iterations || 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt backup. Incorrect password or corrupted file.');
  }
}

// Direct backup download for doctors (bypasses approval workflow)
// Requires password confirmation (enter twice) and logs audit event
window.downloadBackupDirect = async function() {
  try {
    // Check user role - only doctors can use direct download
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userRole = (user.role || "").toLowerCase();
    
    if (userRole !== 'doctor') {
      alert('❌ Access Denied\n\nDirect backup download is only available for Doctors.\n\nOther roles must use the approval workflow.');
      return false;
    }
    
    // Password confirmation (enter twice)
    const password1 = prompt('🔒 Enter your password to confirm backup download:\n\n⚠️ IMPORTANT: You will need this password to restore the backup!\n\nPassword:');
    if (!password1) {
      alert('Backup cancelled - password required');
      return false;
    }
    
    const password2 = prompt('🔒 Confirm password:');
    if (password1 !== password2) {
      alert('❌ Passwords do not match. Backup cancelled.');
      return false;
    }
    
    // Log audit event BEFORE download
    if (typeof window.logAuditEvent === 'function') {
      await window.logAuditEvent('backup_download_direct', {
        user: user.username || 'unknown',
        role: user.role || 'unknown',
        organization: user.org || 'unknown',
        timestamp: new Date().toISOString(),
        method: 'direct_download',
        requires_approval: false
      });
    } else if (typeof SecurityLogger !== 'undefined' && SecurityLogger.logSecurityEvent) {
      // Fallback to SecurityLogger if available
      SecurityLogger.logSecurityEvent({
        event_type: 'backup_download_direct',
        user_id: user.id || user.user_id,
        username: user.username,
        role: user.role,
        organization_id: user.organizationId || user.organization_id,
        details: {
          method: 'direct_download',
          requires_approval: false
        }
      });
    }
    
    console.log('✅ Password confirmed, proceeding with backup download...');
    console.log('🔧 Calling downloadBackup with: encrypt=true, password=***, requestId=null, bypassApproval=true');
    
    // Proceed with download (encrypted by default)
    // Parameters: encrypt=true, password=password1, requestId=null, bypassApproval=true
    const result = await window.downloadBackup(true, password1, null, true); // true = bypass approval check
    
    if (result) {
      console.log('✅ Backup download completed successfully');
    } else {
      console.warn('⚠️ Backup download returned false');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in direct backup download:', error);
    alert('Failed to download backup: ' + error.message + '\n\nPlease check the console for more details.');
    return false;
  }
};

// Download backup as JSON file (with optional encryption)
window.downloadBackup = async function(encrypt = null, password = null, requestId = null, bypassApproval = false) {
  try {
    console.log('🔍 downloadBackup called with:', { encrypt, password: password ? '***' : null, requestId, bypassApproval });
    
    // SECURITY: Downloads are ONLY allowed with an approved request UNLESS bypassApproval is true (for doctors)
    if (!requestId && !bypassApproval) {
      console.log('⚠️ No requestId and bypassApproval=false, showing request modal...');
      // No request ID and not bypassing - show request modal instead
      try {
        // Load the download request modal script if not already loaded
        if (typeof window.showDownloadRequestModal === 'undefined') {
          const script = document.createElement('script');
          script.src = 'js/download-request-modal.js';
          document.head.appendChild(script);
          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }
        
        // Show modal and wait for request creation
        await window.showDownloadRequestModal('backup', 'Full organizational backup');
        
        // Request submitted successfully - STOP HERE, no download allowed
        alert('✅ Your download request has been submitted.\n\n⚠️ IMPORTANT: You must wait for approval from authorized personnel before you can download.\n\nPlease check your approved requests page or contact your administrator.');
        return false; // CRITICAL: Do NOT proceed with download
        
      } catch (error) {
        if (error.message === 'Request cancelled') {
          return false; // User cancelled
        }
        // If modal fails, still don't allow download
        alert('❌ Download request system unavailable. Please contact your administrator.\n\nDownloads require approval and cannot proceed without a valid request.');
        return false;
      }
    }
    
    // Only proceed if we have a requestId - verify it's approved (unless bypassing)
    if (requestId && !bypassApproval) {
      // Verify password matches the request
      try {
        await window.verifyDownloadPassword(requestId, password);
      } catch (error) {
        alert('Password verification failed: ' + error.message);
        return false;
      }
      
      // Verify request is actually approved
      const approvedRequest = await window.checkApprovedDownloadRequest(requestId);
      if (!approvedRequest) {
        alert('❌ This download request has not been approved yet, or has expired.\n\nPlease wait for approval from authorized personnel.');
        return false;
      }
      
      // Mark download as completed
      await window.markDownloadCompleted(requestId);
    }
    
    // If bypassing approval, log the direct download
    if (bypassApproval) {
      console.log('✅ Bypassing approval workflow - proceeding with direct download');
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (typeof window.logAuditEvent === 'function') {
        await window.logAuditEvent('backup_download_completed', {
          user: user.username || 'unknown',
          role: user.role || 'unknown',
          organization: user.org || 'unknown',
          method: 'direct_download',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log('📦 Creating backup data...');
    const backup = createFullBackup();
    let jsonString = JSON.stringify(backup, null, 2);
    let blob;
    let filename;
    
    // Check if encryption is requested (default to enabled if not specified)
    const shouldEncrypt = encrypt !== false && (BACKUP_CONFIG.encryptionEnabled || encrypt === true);
    
    if (shouldEncrypt) {
      // Prompt for password if not provided
      if (!password) {
        password = prompt('Enter a password to encrypt this backup:\n\n⚠️ IMPORTANT: You will need this password to restore the backup!\n\nPassword:');
        if (!password) {
          alert('Backup cancelled - password required for encryption');
          return false;
        }
        
        // Confirm password
        const confirmPassword = prompt('Confirm password:');
        if (password !== confirmPassword) {
          alert('Passwords do not match. Backup cancelled.');
          return false;
        }
      }
      
      // Encrypt the backup
      try {
        const encrypted = await encryptBackupData(jsonString, password);
        
        // Create encrypted backup structure
        const encryptedBackup = {
          encrypted: true,
          algorithm: encrypted.algorithm,
          iterations: encrypted.iterations,
          saltLength: encrypted.saltLength,
          ivLength: encrypted.ivLength,
          data: encrypted.encrypted,
          metadata: {
            ...backup.metadata,
            encryptedAt: new Date().toISOString()
          }
        };
        
        jsonString = JSON.stringify(encryptedBackup, null, 2);
        filename = `mediforge-backup-encrypted-${new Date().toISOString().split('T')[0]}.json`;
        blob = new Blob([jsonString], { type: 'application/json' });
      } catch (encryptError) {
        alert('Encryption failed: ' + encryptError.message + '\n\nWould you like to download unencrypted backup instead?');
        if (!confirm('Download unencrypted backup?')) {
          return false;
        }
        // Fall through to unencrypted download
        blob = new Blob([jsonString], { type: 'application/json' });
        filename = `mediforge-backup-${new Date().toISOString().split('T')[0]}.json`;
      }
    } else {
      // Unencrypted backup
      blob = new Blob([jsonString], { type: 'application/json' });
      filename = `mediforge-backup-${new Date().toISOString().split('T')[0]}.json`;
    }
    
    // Check size
    if (blob.size > BACKUP_CONFIG.maxBackupSize) {
      if (!confirm(`Warning: Backup file is ${(blob.size / 1024 / 1024).toFixed(2)}MB. This may take time to download. Continue?`)) {
        return;
      }
    }
    
    // DLP Monitoring: Track bulk data export
    const exportSizeMB = (blob.size / 1024 / 1024).toFixed(2);
    const patientCount = backup.statistics.patientCount || 0;
    const recordCount = patientCount + (backup.statistics.appointmentCount || 0) + (backup.statistics.userCount || 0);
    
    // Log export event for DLP monitoring
    if (typeof window.logAuditEvent === 'function') {
      window.logAuditEvent('data_export_backup', {
        export_type: 'full_backup',
        file_size_mb: parseFloat(exportSizeMB),
        patient_count: patientCount,
        total_records: recordCount,
        backup_version: backup.metadata.version,
        organization: backup.metadata.organization,
        is_bulk_export: recordCount >= 50, // Flag as bulk if 50+ records
        timestamp: new Date().toISOString()
      });
      
      // Alert on suspicious bulk export
      if (recordCount >= 100) {
        console.warn('⚠️ DLP ALERT: Large bulk export detected', {
          records: recordCount,
          size: exportSizeMB + ' MB',
          organization: backup.metadata.organization
        });
        
        // Optionally trigger security alert for very large exports
        if (typeof window.alertAccountLockout === 'function' && recordCount >= 500) {
          window.alertAccountLockout(
            `Large bulk export: ${recordCount} records (${exportSizeMB} MB)`,
            recordCount
          );
        }
      }
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const successMessage = shouldEncrypt 
      ? `Encrypted backup downloaded successfully!\n\nFile: ${filename}\nSize: ${(blob.size / 1024).toFixed(2)} KB\n\n⚠️ REMEMBER: You need the password to restore this backup!`
      : `Backup downloaded successfully!\n\nFile: ${filename}\nSize: ${(blob.size / 1024).toFixed(2)} KB\n\n⚠️ WARNING: This backup is NOT encrypted!`;
    
    alert(successMessage);
    
    // Update last backup timestamp
    localStorage.setItem('lastBackupDate', new Date().toISOString());
    
    return true;
  } catch (error) {
    alert('Failed to download backup: ' + error.message);
    console.error('Backup download error:', error);
    return false;
  }
};

// Validate backup file structure
function validateBackup(backup) {
  const errors = [];
  
  // Check required metadata
  if (!backup.metadata) {
    errors.push('Missing metadata section');
  } else {
    if (!backup.metadata.version) errors.push('Missing backup version');
    if (!backup.metadata.timestamp) errors.push('Missing timestamp');
  }
  
  // Check required data sections
  if (!backup.data) {
    errors.push('Missing data section');
  } else {
    if (!backup.data.patients) errors.push('Missing patients data');
    if (!backup.data.users) errors.push('Missing users data');
  }
  
  // Validate JSON structure
  try {
    if (backup.data.patients) JSON.parse(backup.data.patients);
    if (backup.data.appointments) JSON.parse(backup.data.appointments);
    if (backup.data.users) JSON.parse(backup.data.users);
    if (backup.data.organizations) JSON.parse(backup.data.organizations);
  } catch (e) {
    errors.push('Invalid JSON in data section: ' + e.message);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// Restore backup from file (handles both encrypted and unencrypted)
window.restoreBackup = async function(file) {
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    try {
      let backup = JSON.parse(e.target.result);
      
      // Check if backup is encrypted
      if (backup.encrypted === true && backup.data) {
        // Prompt for password
        const password = prompt('This backup is encrypted.\n\nEnter the password to decrypt:');
        if (!password) {
          alert('Password required to restore encrypted backup');
          return;
        }
        
        try {
          // Decrypt the backup
          const decryptedData = await decryptBackupData(backup, password);
          backup = JSON.parse(decryptedData);
          
          // Verify it's a valid backup structure
          if (!backup.metadata || !backup.data) {
            throw new Error('Decrypted data is not a valid backup file');
          }
          
          console.log('✅ Backup decrypted successfully');
        } catch (decryptError) {
          alert('Decryption failed: ' + decryptError.message + '\n\nPlease check your password and try again.');
          return;
        }
      }
      
      // Validate backup structure
      const validation = validateBackup(backup);
      if (!validation.valid) {
        alert('Invalid backup file:\n' + validation.errors.join('\n'));
        return;
      }
      
      // Show backup info and confirm
      const confirmMessage = `Restore backup from ${new Date(backup.metadata.timestamp).toLocaleString()}?\n\n` +
        `Organization: ${backup.metadata.organization}\n` +
        `Created by: ${backup.metadata.createdBy}\n` +
        `Patients: ${backup.statistics.patientCount}\n` +
        `Appointments: ${backup.statistics.appointmentCount}\n\n` +
        `WARNING: This will overwrite your current data!`;
      
      if (!confirm(confirmMessage)) {
        console.log('Backup restore cancelled by user');
        return;
      }
      
      // Create safety backup before restore
      const currentData = createFullBackup();
      localStorage.setItem('preRestoreBackup', JSON.stringify(currentData));
      
      // Restore data
      const keys = getAllDataKeys();
      
      if (backup.data.patients) {
        localStorage.setItem(keys.patients, backup.data.patients);
      }
      if (backup.data.appointments) {
        localStorage.setItem(keys.appointments, backup.data.appointments);
      }
      if (backup.data.specialists) {
        localStorage.setItem(keys.specialists, backup.data.specialists);
      }
      if (backup.data.users) {
        localStorage.setItem(keys.users, backup.data.users);
      }
      if (backup.data.organizations) {
        localStorage.setItem(keys.organizations, backup.data.organizations);
      }
      
      // Update restore timestamp
      localStorage.setItem('lastRestoreDate', new Date().toISOString());
      
      alert(`Backup restored successfully!\n\nRestored:\n- ${backup.statistics.patientCount} patients\n- ${backup.statistics.appointmentCount} appointments\n\nPage will reload...`);
      
      // Reload to refresh all data
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error) {
      alert('Failed to restore backup: ' + error.message);
      console.error('Backup restore error:', error);
    }
  };
  
  reader.onerror = function() {
    alert('Failed to read backup file');
  };
  
  reader.readAsText(file);
};

// Trigger file input for backup restore
window.selectBackupFile = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      restoreBackup(file);
    }
  };
  
  input.click();
};

// Check if auto-backup is due
function checkAutoBackup() {
  if (!BACKUP_CONFIG.autoBackupEnabled) return;
  
  const lastBackup = localStorage.getItem('lastBackupDate');
  if (!lastBackup) {
    // First time - suggest backup
    console.log('No previous backup found. Auto-backup recommended.');
    return;
  }
  
  const lastBackupDate = new Date(lastBackup);
  const now = new Date();
  const timeSinceBackup = now - lastBackupDate;
  
  if (timeSinceBackup > BACKUP_CONFIG.autoBackupInterval) {
    console.log(`Last backup was ${Math.floor(timeSinceBackup / (24 * 60 * 60 * 1000))} days ago. Auto-backup recommended.`);
    // Could trigger automatic download here
  }
}

// Get backup status for display
window.getBackupStatus = function() {
  const lastBackup = localStorage.getItem('lastBackupDate');
  const lastRestore = localStorage.getItem('lastRestoreDate');
  
  return {
    lastBackup: lastBackup ? new Date(lastBackup).toLocaleString() : 'Never',
    lastRestore: lastRestore ? new Date(lastRestore).toLocaleString() : 'Never',
    daysSinceBackup: lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / (24 * 60 * 60 * 1000)) : null
  };
};

// Export patients data as comprehensive CSV
window.exportPatientsCSV = function() {
  try {
    const keys = getAllDataKeys();
    const patients = JSON.parse(localStorage.getItem(keys.patients) || "[]");
    
    if (patients.length === 0) {
      alert('No patients to export');
      return;
    }
    
    // Comprehensive CSV with all patient fields
    let csv = "ID,First Name,Middle Name,Last Name,DOB,Gender,Marital Status,Tribe,Email,Phone,";
    csv += "Address Line 1,Address Line 2,City,State,Country,";
    csv += "Emergency Contact,Emergency Phone,Payment Source,Insurance Name,";
    csv += "Medical History Count,Diagnoses Count,Medications Count,Allergies Count,Immunizations Count,Visits Count\n";
    
    patients.forEach(p => {
      const escapeCsv = (val) => {
        if (!val) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      };
      
      csv += `${escapeCsv(p.id)},${escapeCsv(p.firstName)},${escapeCsv(p.middleName)},${escapeCsv(p.lastName)},`;
      csv += `${escapeCsv(p.dob)},${escapeCsv(p.gender)},${escapeCsv(p.maritalStatus)},${escapeCsv(p.tribe)},`;
      csv += `${escapeCsv(p.email)},${escapeCsv(p.phone)},`;
      csv += `${escapeCsv(p.addressLine1)},${escapeCsv(p.addressLine2)},${escapeCsv(p.city)},${escapeCsv(p.state)},${escapeCsv(p.country)},`;
      csv += `${escapeCsv(p.emergencyFirstName + ' ' + p.emergencyLastName)},${escapeCsv(p.phone)},`;
      csv += `${escapeCsv(p.paymentSource)},${escapeCsv(p.insuranceName)},`;
      csv += `${(p.medicalHistory || []).length},${(p.diagnoses || []).length},${(p.medications || []).length},`;
      csv += `${(p.allergies || []).length},${(p.immunizations || []).length},${(p.visits || []).length}\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients-comprehensive-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // DLP Monitoring: Track CSV export
    if (typeof window.logAuditEvent === 'function') {
      window.logAuditEvent('data_export_csv', {
        export_type: 'patients_csv',
        patient_count: patients.length,
        file_size_kb: (blob.size / 1024).toFixed(2),
        is_bulk_export: patients.length >= 50,
        timestamp: new Date().toISOString()
      });
      
      // Alert on bulk CSV export
      if (patients.length >= 100) {
        console.warn('⚠️ DLP ALERT: Large CSV export detected', {
          patients: patients.length,
          size: (blob.size / 1024).toFixed(2) + ' KB'
        });
      }
    }
    
    alert(`Exported ${patients.length} patients to CSV successfully!`);
  } catch (error) {
    alert('Failed to export patients: ' + error.message);
    console.error('CSV export error:', error);
  }
};

// Export individual patient full record
window.exportPatientRecord = function(patientId) {
  try {
    const keys = getAllDataKeys();
    const patients = JSON.parse(localStorage.getItem(keys.patients) || "[]");
    const patient = patients.find(p => p.id === patientId);
    
    if (!patient) {
      alert('Patient not found');
      return;
    }
    
    const fullRecord = {
      metadata: {
        exportDate: new Date().toISOString(),
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`.trim()
      },
      demographics: {
        id: patient.id,
        firstName: patient.firstName,
        middleName: patient.middleName,
        lastName: patient.lastName,
        dob: patient.dob,
        gender: patient.gender,
        maritalStatus: patient.maritalStatus,
        tribe: patient.tribe,
        email: patient.email,
        phone: patient.phone,
        address: {
          line1: patient.addressLine1,
          line2: patient.addressLine2,
          city: patient.city,
          state: patient.state,
          country: patient.country
        }
      },
      emergencyContact: {
        firstName: patient.emergencyFirstName,
        lastName: patient.emergencyLastName,
        relationship: patient.emergencyRelationship,
        phone: patient.emergencyPhone,
        address: {
          line1: patient.emergencyAddressLine1,
          line2: patient.emergencyAddressLine2,
          city: patient.emergencyCity,
          state: patient.emergencyState,
          country: patient.emergencyCountry
        }
      },
      medicalHistory: patient.medicalHistory || [],
      diagnoses: patient.diagnoses || [],
      medications: patient.medications || [],
      allergies: patient.allergies || [],
      immunizations: patient.immunizations || [],
      visits: patient.visits || [],
      prescriptions: patient.prescriptions || [],
      encounters: patient.encounters || [],
      orders: patient.orders || [],
      referrals: patient.referrals || [],
      preventiveGaps: patient.preventiveGaps || [],
      documents: (patient.documents || []).map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        size: d.size,
        uploadedAt: d.uploadedAt,
        folder: d.folder
        // Note: Actual file data not included in JSON export due to size
        // Use full backup for documents
      }))
    };
    
    const jsonString = JSON.stringify(fullRecord, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${patient.id}-full-record-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // DLP Monitoring: Track individual patient export
    if (typeof window.logAuditEvent === 'function') {
      window.logAuditEvent('data_export_patient', {
        export_type: 'patient_record',
        patient_id: patient.id,
        patient_name: `${patient.firstName} ${patient.lastName}`,
        file_size_kb: (blob.size / 1024).toFixed(2),
        includes_documents: (patient.documents || []).length > 0,
        timestamp: new Date().toISOString()
      });
    }
    
    alert(`Patient record exported successfully!\nFile: ${a.download}`);
  } catch (error) {
    alert('Failed to export patient record: ' + error.message);
    console.error('Patient export error:', error);
  }
};

// Undo last restore (safety feature)
window.undoLastRestore = function() {
  const preRestoreBackup = localStorage.getItem('preRestoreBackup');
  
  if (!preRestoreBackup) {
    alert('No previous restore to undo');
    return;
  }
  
  if (!confirm('Undo the last restore operation? This will revert to the state before the restore.')) {
    return;
  }
  
  try {
    const backup = JSON.parse(preRestoreBackup);
    const keys = getAllDataKeys();
    
    if (backup.data.patients) {
      localStorage.setItem(keys.patients, backup.data.patients);
    }
    if (backup.data.appointments) {
      localStorage.setItem(keys.appointments, backup.data.appointments);
    }
    if (backup.data.specialists) {
      localStorage.setItem(keys.specialists, backup.data.specialists);
    }
    
    localStorage.removeItem('preRestoreBackup');
    alert('Restore operation undone successfully! Page will reload...');
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    alert('Failed to undo restore: ' + error.message);
  }
};

// Check localStorage usage and quota
window.checkStorageUsage = function() {
  let totalSize = 0;
  let items = [];
  
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      const itemSize = (localStorage.getItem(key).length + key.length) * 2; // UTF-16 = 2 bytes per char
      totalSize += itemSize;
      items.push({
        key: key,
        size: itemSize,
        sizeKB: (itemSize / 1024).toFixed(2),
        sizeMB: (itemSize / 1024 / 1024).toFixed(2)
      });
    }
  }
  
  // Sort by size descending
  items.sort((a, b) => b.size - a.size);
  
  const totalMB = (totalSize / 1024 / 1024).toFixed(2);
  const quotaMB = 10; // Typical localStorage quota
  const usagePercent = ((totalSize / (quotaMB * 1024 * 1024)) * 100).toFixed(1);
  
  return {
    totalSize: totalSize,
    totalMB: totalMB,
    usagePercent: usagePercent,
    quotaMB: quotaMB,
    items: items,
    warning: usagePercent > 80 ? 'Storage usage is high! Consider archiving old data.' : null
  };
};

// Display storage usage
window.showStorageUsage = function() {
  const usage = checkStorageUsage();
  
  let message = `📊 Storage Usage Report\n\n`;
  message += `Total: ${usage.totalMB} MB of ~${usage.quotaMB} MB (${usage.usagePercent}%)\n\n`;
  message += `Top 5 Largest Items:\n`;
  
  usage.items.slice(0, 5).forEach((item, i) => {
    message += `${i + 1}. ${item.key}: ${item.sizeKB} KB\n`;
  });
  
  if (usage.warning) {
    message += `\n⚠️ ${usage.warning}`;
  }
  
  alert(message);
  return usage;
};

// Initialize auto-backup check on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    // Check if auto-backup is due (only on dashboard)
    if (window.location.pathname.includes('dashboard.html')) {
      checkAutoBackup();
    }
  });
}

console.log('Backup system loaded successfully');


