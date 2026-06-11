/**
 * Encryption Initialization Helper
 * 
 * Purpose: Initialize encryption after successful login
 * Called automatically after login to check if encryption is enabled
 * and prompt for master password if needed
 * 
 * Version: 1.0.0
 */

/**
 * Check if encryption is enabled for the current organization
 * and initialize it if needed
 */
async function initializeEncryptionAfterLogin() {
  try {
    // Get user and organization info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.org;

    if (!orgId) {
      console.log('📋 No organization ID - skipping encryption initialization');
      return;
    }

    // Check if Supabase client is available
    if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
      console.log('📋 Supabase client not available - skipping encryption initialization');
      return;
    }

    // Check if encryption service is available
    if (typeof window.encryptionService === 'undefined') {
      console.log('📋 Encryption service not loaded - skipping encryption initialization');
      return;
    }

    // Check localStorage first to avoid unnecessary Supabase queries
    // This prevents 400 errors when settings column doesn't exist
    const encryptionStatusKey = `encryption_status_${orgId}`;
    const cachedStatus = localStorage.getItem(encryptionStatusKey);
    
    // If we've cached that encryption is not enabled, skip Supabase query
    if (cachedStatus === 'disabled' || cachedStatus === 'not_available') {
      // Encryption not enabled - skip quietly
      return;
    }

    // Only query Supabase if we haven't cached the status
    // Use a flag to track if settings column exists (prevents repeated failed queries)
    const settingsColumnExistsKey = `settings_column_exists_${orgId}`;
    const settingsColumnExists = localStorage.getItem(settingsColumnExistsKey);
    
    // If we know the settings column doesn't exist, skip the query entirely
    if (settingsColumnExists === 'false') {
      // Settings column doesn't exist - encryption not available
      localStorage.setItem(encryptionStatusKey, 'not_available');
      return;
    }

    // Try to query settings column, but handle gracefully if it doesn't exist
    let data = null;
    let error = null;
    
    try {
      const result = await window.supabaseClient
        .from('organizations')
        .select('settings')
        .eq('id', orgId)
        .single();
      
      data = result.data;
      error = result.error;
      
      // Cache that settings column exists (query succeeded)
      if (!error) {
        localStorage.setItem(settingsColumnExistsKey, 'true');
      }
    } catch (err) {
      // Handle case where settings column doesn't exist
      if (err.code === '42703' || err.message?.includes('does not exist') || err.message?.includes('column')) {
        // Column doesn't exist - cache this to avoid future queries
        localStorage.setItem(settingsColumnExistsKey, 'false');
        localStorage.setItem(encryptionStatusKey, 'not_available');
        return;
      }
      // Other errors - log but don't block
      console.warn('⚠️ Could not check encryption status:', err);
      return;
    }

    if (error) {
      // Suppress expected "column doesn't exist" errors
      if (error.code === '42703' || error.message?.includes('does not exist') || error.message?.includes('column')) {
        // Column doesn't exist - cache this to avoid future queries
        localStorage.setItem(settingsColumnExistsKey, 'false');
        localStorage.setItem(encryptionStatusKey, 'not_available');
        return;
      }
      // Only log unexpected errors
      console.warn('⚠️ Could not check encryption status:', error);
      return;
    }

    if (!data || !data.settings || !data.settings.encryption_enabled) {
      // Encryption not enabled - cache this status
      localStorage.setItem(encryptionStatusKey, 'disabled');
      return;
    }
    
    // Encryption is enabled - cache this status
    localStorage.setItem(encryptionStatusKey, 'enabled');

    // Encryption is enabled - check if already initialized
    if (window.encryptionService.isInitialized) {
      console.log('✅ Encryption already initialized');
      return;
    }

    // Encryption is enabled but not initialized - prompt for master password
    console.log('🔐 Encryption is enabled but not initialized - prompting for master password');
    
    // Check if user wants to use recovery key instead
    const useRecovery = confirm(
      'Encryption is enabled for your organization.\n\n' +
      'Do you remember your master password?\n\n' +
      'Click OK to enter master password\n' +
      'Click Cancel to use recovery key instead'
    );

    let masterPassword = null;

    if (useRecovery) {
      // User wants to use master password
      masterPassword = prompt(
        'Enter your master encryption password:\n\n' +
        '(This password is required to access encrypted patient records)'
      );
    } else {
      // User wants to use recovery key - redirect to recovery page
      console.log('🔑 User wants to use recovery key - redirecting to recovery page');
      window.location.href = '/recover-encryption';
      return;
    }

    if (!masterPassword) {
      // User cancelled - offer recovery key option
      const tryRecovery = confirm(
        '⚠️ Master password not provided.\n\n' +
        'Would you like to use your recovery key instead?\n\n' +
        'Click OK to use recovery key\n' +
        'Click Cancel to skip (you won\'t be able to access encrypted data)'
      );

      if (tryRecovery) {
        window.location.href = '/recover-encryption';
        return;
      } else {
        console.warn('⚠️ Master password not provided - encryption not initialized');
        alert('⚠️ Warning: Encryption is enabled but master password was not provided.\n\n' +
              'You will not be able to access encrypted patient data until you provide the master password or recovery key.\n\n' +
              'You can:\n' +
              '• Use your recovery key at: recover-encryption.html\n' +
              '• Contact platform administrator for help');
        return;
      }
    }

    // Initialize encryption with master password
    const initialized = await window.encryptionService.initialize(orgId, masterPassword);

    if (initialized) {
      console.log('✅ Encryption initialized successfully');
      // Optionally show a brief success message
      // alert('✅ Encryption initialized. You can now access encrypted patient data.');
    } else {
      console.warn('⚠️ Failed to initialize encryption');
      alert('❌ Failed to initialize encryption. Please check your master password and try again.\n\n' +
            'You can set up encryption from the dashboard or settings page.');
    }

  } catch (error) {
    console.error('❌ Error initializing encryption:', error);
    // Don't block login if encryption init fails
  }
}

// Auto-initialize after page load (if user is logged in)
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Delay slightly to ensure other scripts are loaded
      setTimeout(initializeEncryptionAfterLogin, 1000);
    });
  } else {
    // DOM already ready
    setTimeout(initializeEncryptionAfterLogin, 1000);
  }
}

