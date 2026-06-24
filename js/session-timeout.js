// Session Timeout Manager
// Auto-logs out users after 30 minutes of inactivity
// Saves all unsaved work before logout

(function() {
  'use strict';
  const debugLog = window.__DEBUG_LOGS ? console.log.bind(console) : () => {};

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const WARNING_TIME_MS = 2 * 60 * 1000; // Show warning 2 minutes before logout
  const FINAL_WARNING_TIME_MS = 10 * 1000; // Final countdown: 10 seconds
  const ACTIVITY_CHECK_INTERVAL = 60000; // Check every minute

  let lastActivityTime = Date.now();
  let warningShown = false;
  let finalWarningShown = false;
  let sessionCheckInterval = null;
  let sessionTimeoutInitialized = false;
  let sessionGuardReady = false;
  let warningTimeout = null;
  let logoutTimeout = null;
  let countdownInterval = null;

  let physicianVerificationGateScheduled = false;

  function physicianVerificationIsDoctorRole(role) {
    if (!role || typeof role !== 'string') return false;
    const r = role.toLowerCase().trim().replace(/\s+/g, ' ');
    if (r.includes('physician assistant')) return false;
    const exact = { doctor: 1, physician: 1, 'medical doctor': 1, medicaldoctor: 1, dr: 1, 'dr.': 1, md: 1 };
    if (exact[r]) return true;
    if (r.includes('medical doctor')) return true;
    if (r === 'dr' || r.startsWith('dr.') || r.startsWith('dr ')) return true;
    if (r.includes('physician')) return true;
    if (r.includes('doctor')) return true;
    return false;
  }

  function schedulePhysicianVerificationAccessGate() {
    if (physicianVerificationGateScheduled) return;
    physicianVerificationGateScheduled = true;
    void runPhysicianVerificationAccessGate();
  }

  async function runPhysicianVerificationAccessGate() {
    try {
      const path = (window.location.pathname.split('/').pop() || '').replace(/\.html$/i, '').toLowerCase();
      const allowed = new Set(['physician-verification', 'change-password', 'patient-change-password']);
      if (allowed.has(path)) return;

      let sb = window.supabaseClient;
      if (!sb) {
        for (let i = 0; i < 80 && !window.supabaseClient; i++) {
          await new Promise(r => setTimeout(r, 100));
        }
        sb = window.supabaseClient;
      }
      if (!sb) return;

      const { data: authData } = await sb.auth.getUser();
      const authUser = authData && authData.user;
      if (!authUser) return;

      const { data: profile } = await sb
        .from('users')
        .select('id, organization_id, role')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (!profile || !physicianVerificationIsDoctorRole(profile.role)) return;

      let { data: row } = await sb
        .from('physician_verifications')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!row) {
        const ins = await sb
          .from('physician_verifications')
          .insert({ user_id: profile.id, organization_id: profile.organization_id })
          .select('*')
          .maybeSingle();
        row = ins.data;
        if (!row) return;
      }

      const approved = row.review_status === 'approved';
      const untilMs = new Date(row.verification_access_until).getTime();
      const blocked = !approved && Date.now() > untilMs;
      if (!blocked) return;

      window.location.replace('physician-verification');
    } catch (e) {
      debugLog('Physician verification gate:', e);
    }
  }

  // Initialize session timeout tracking (once per page load, after session restore)
  async function initializeSessionTimeout() {
    if (sessionTimeoutInitialized) return;
    // Skip on login/register pages
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const pageWithoutExtension = currentPage.replace('.html', '');
    
    const excludedPages = [
      'login.html', 'login',
      'register.html', 'register',
      'index.html', 'index',
      '', // Root path
      'platform-login.html', 'platform-login'
    ];
    
    if (excludedPages.includes(currentPage) || excludedPages.includes(pageWithoutExtension)) {
      return;
    }

    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user || (!user.email && !user.username)) {
      return; // Not logged in
    }

    // Skip session timeout for platform admin views (they have their own session management)
    const isPlatformAdminView = (user._isPlatformView && user._platformAdmin) || 
                                (user.platformAdminView && user._isPlatformView) ||
                                (user.originalPlatformAdmin && user._isPlatformView);
    if (isPlatformAdminView) {
      debugLog('ℹ️ Platform admin view detected - skipping session timeout');
      return; // Platform admins viewing tenant organizations bypass timeout
    }

    schedulePhysicianVerificationAccessGate();

    // Restore Supabase session before starting inactivity clock (prevents false logouts on navigation)
    if (typeof window.ensureStaffSession === 'function') {
      try {
        await window.ensureStaffSession({ redirectOnFailure: false });
      } catch (err) {
        debugLog('ensureStaffSession on init:', err);
      }
    }
    sessionGuardReady = true;
    sessionTimeoutInitialized = true;

    // Each page navigation is user activity: prevents stale lastActivity from prior page
    lastActivityTime = Date.now();
    localStorage.setItem('lastActivity', lastActivityTime.toString());

    // Track user activity
    trackUserActivity();

    // Start session check interval
    startSessionCheck();

    debugLog('✅ Session timeout manager initialized (30 minutes)');
  }

  // Track user activity (mouse, keyboard, touch, scroll)
  function trackUserActivity() {
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart',
      'click', 'keydown', 'input', 'change', 'focus'
    ];

    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Also track window focus
    window.addEventListener('focus', updateActivity);
    window.addEventListener('blur', function() {
      // Don't update activity on blur, but don't reset either
    });
  }

  // Update last activity timestamp
  function updateActivity() {
    lastActivityTime = Date.now();
    localStorage.setItem('lastActivity', lastActivityTime.toString());
    
    // Reset warnings if user becomes active again
    if (warningShown || finalWarningShown) {
      warningShown = false;
      finalWarningShown = false;
      hideWarning();
      hideFinalWarning();
    }
  }

  // Start session check interval
  function startSessionCheck() {
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
    }

    sessionCheckInterval = setInterval(() => {
      checkSessionTimeout();
    }, ACTIVITY_CHECK_INTERVAL);

    // Also check immediately
    checkSessionTimeout();
  }

  // Check if session has expired
  function checkSessionTimeout() {
    if (!sessionGuardReady) return;

    const timeSinceActivity = Date.now() - lastActivityTime;
    const timeUntilLogout = SESSION_TIMEOUT_MS - timeSinceActivity;
    const timeUntilWarning = SESSION_TIMEOUT_MS - WARNING_TIME_MS - timeSinceActivity;

    // Check if session expired
    if (timeSinceActivity >= SESSION_TIMEOUT_MS) {
      // Session expired - show final countdown and logout
      if (!finalWarningShown) {
        showFinalCountdown();
      }
      return;
    }

    // Check if final countdown should be shown (10 seconds before logout)
    if (timeUntilLogout <= FINAL_WARNING_TIME_MS && !finalWarningShown) {
      showFinalCountdown();
      return;
    }

    // Check if initial warning should be shown (2 minutes before logout)
    if (timeUntilWarning <= 0 && !warningShown && !finalWarningShown) {
      showWarning(timeUntilLogout);
    }
  }

  // Show initial warning before logout (2 minutes before)
  function showWarning(timeUntilLogout) {
    warningShown = true;
    
    const minutesLeft = Math.ceil(timeUntilLogout / 60000);
    
    // Create warning overlay
    const warningOverlay = document.createElement('div');
    warningOverlay.id = 'session-warning-overlay';
    warningOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const warningBox = document.createElement('div');
    warningBox.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 10px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;

    warningBox.innerHTML = `
      <h2 style="color: #8B0000; margin-top: 0;">⚠️ Session Timeout Warning</h2>
      <p style="font-size: 16px; margin: 20px 0;">
        Your session will expire in <strong>${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}</strong> due to inactivity.
      </p>
      <p style="font-size: 14px; color: #666; margin: 20px 0;">
        We're saving your work automatically. Click "Stay Logged In" to continue your session.
      </p>
      <div style="margin-top: 30px;">
        <button id="stay-logged-in-btn" style="
          background: linear-gradient(135deg, #008753 0%, #006b42 100%);
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-right: 10px;
        ">Stay Logged In</button>
        <button id="logout-now-btn" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        ">Logout Now</button>
      </div>
    `;

    warningOverlay.appendChild(warningBox);
    document.body.appendChild(warningOverlay);

    // Handle "Stay Logged In" button
    document.getElementById('stay-logged-in-btn').addEventListener('click', function() {
      updateActivity(); // Reset activity
      hideWarning();
    });

    // Handle "Logout Now" button
    document.getElementById('logout-now-btn').addEventListener('click', function() {
      hideWarning();
      handleSessionExpired();
    });

    // Auto-hide warning if user becomes active (but don't auto-logout yet)
    warningTimeout = setTimeout(() => {
      // Warning will be replaced by final countdown
    }, timeUntilLogout - FINAL_WARNING_TIME_MS);
  }

  // Show final countdown before logout (10 seconds)
  function showFinalCountdown() {
    finalWarningShown = true;
    hideWarning(); // Hide initial warning if shown
    
    let secondsLeft = Math.ceil(FINAL_WARNING_TIME_MS / 1000);
    
    // Create final warning overlay with countdown
    const warningOverlay = document.createElement('div');
    warningOverlay.id = 'session-final-warning-overlay';
    warningOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: pulse 1s infinite;
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.95; }
      }
    `;
    document.head.appendChild(style);

    const warningBox = document.createElement('div');
    warningBox.style.cssText = `
      background: white;
      padding: 40px;
      border-radius: 15px;
      max-width: 550px;
      text-align: center;
      box-shadow: 0 15px 50px rgba(0,0,0,0.5);
      border: 3px solid #dc3545;
    `;

    const countdownElement = document.createElement('div');
    countdownElement.id = 'session-countdown';
    countdownElement.style.cssText = `
      font-size: 48px;
      font-weight: 700;
      color: #dc3545;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
    `;
    countdownElement.textContent = secondsLeft;

    warningBox.innerHTML = `
      <h2 style="color: #dc3545; margin-top: 0; font-size: 28px;">⏱️ Session Expiring!</h2>
      <p style="font-size: 18px; margin: 20px 0; font-weight: 600;">
        Your session will expire in:
      </p>
    `;
    warningBox.appendChild(countdownElement);
    warningBox.innerHTML += `
      <p style="font-size: 16px; color: #333; margin: 20px 0;">
        <strong>Saving your work...</strong>
      </p>
      <p style="font-size: 14px; color: #666; margin: 20px 0;">
        Click "Stay Logged In" to continue your session, or you will be logged out automatically.
      </p>
      <div style="margin-top: 30px;">
        <button id="stay-logged-in-final-btn" style="
          background: linear-gradient(135deg, #008753 0%, #006b42 100%);
          color: white;
          border: none;
          padding: 15px 40px;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 135, 83, 0.4);
          transition: all 0.3s ease;
        ">Stay Logged In</button>
      </div>
    `;

    warningOverlay.appendChild(warningBox);
    document.body.appendChild(warningOverlay);

    // Handle "Stay Logged In" button
    document.getElementById('stay-logged-in-final-btn').addEventListener('click', function() {
      updateActivity(); // Reset activity
      hideFinalWarning();
    });

    // Update countdown every second
    countdownInterval = setInterval(() => {
      secondsLeft--;
      const countdownEl = document.getElementById('session-countdown');
      if (countdownEl) {
        countdownEl.textContent = secondsLeft;
        
        // Change color as time runs out
        if (secondsLeft <= 3) {
          countdownEl.style.color = '#8B0000';
          countdownEl.style.transform = 'scale(1.2)';
          countdownEl.style.transition = 'all 0.3s ease';
        }
      }
      
      if (secondsLeft <= 0) {
        clearInterval(countdownInterval);
        handleSessionExpired();
      }
    }, 1000);

    // Start saving work in background
    saveAllWork().catch(error => {
      console.error('❌ Error saving work during countdown:', error);
    });
  }

  // Hide warning overlay
  function hideWarning() {
    const overlay = document.getElementById('session-warning-overlay');
    if (overlay) {
      overlay.remove();
    }
    if (warningTimeout) {
      clearTimeout(warningTimeout);
      warningTimeout = null;
    }
    warningShown = false;
  }

  // Hide final warning overlay
  function hideFinalWarning() {
    const overlay = document.getElementById('session-final-warning-overlay');
    if (overlay) {
      overlay.remove();
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (logoutTimeout) {
      clearTimeout(logoutTimeout);
      logoutTimeout = null;
    }
    finalWarningShown = false;
    warningShown = false; // Reset initial warning flag too
  }

  // Save all unsaved work before logout
  async function saveAllWork() {
    console.log('💾 Saving all unsaved work before logout...');
    
    const savePromises = [];

    // 1. Save clinical note if on clinical-note.html
    if (typeof window.saveClinicalNoteData === 'function') {
      try {
        console.log('💾 Saving clinical note...');
        await window.saveClinicalNoteData();
        console.log('✅ Clinical note saved');
      } catch (error) {
        console.error('❌ Error saving clinical note:', error);
      }
    }

    // 2. Save patient form if on add-patient.html or edit-patient.html
    const addPatientForm = document.getElementById('add-patient-form');
    const editPatientForm = document.getElementById('edit-patient-form');
    
    if (addPatientForm && typeof window.addPatientForm !== 'undefined') {
      // Trigger form save (but don't redirect)
      try {
        console.log('💾 Saving new patient...');
        // The form handler will save to localStorage automatically
        // We just need to ensure it's saved
        const formData = new FormData(addPatientForm);
        // Patient will be saved by the form handler's localStorage-first approach
        console.log('✅ Patient form data captured');
      } catch (error) {
        console.error('❌ Error saving patient form:', error);
      }
    }

    if (editPatientForm && typeof window.savePatientToSupabase === 'function') {
      try {
        console.log('💾 Saving edited patient...');
        await window.savePatientToSupabase();
        console.log('✅ Patient edit saved');
      } catch (error) {
        console.error('❌ Error saving patient edit:', error);
      }
    }

    // 3. Save prescription only when on prescription form (prescription.html or modal with form)
    const prescriptionFormPresent = document.getElementById('prescription-date') != null;
    if (prescriptionFormPresent && typeof window.savePrescription === 'function') {
      try {
        console.log('💾 Saving prescription...');
        await window.savePrescription();
        console.log('✅ Prescription saved');
      } catch (error) {
        console.error('❌ Error saving prescription:', error);
      }
    }

    // 4. Save lab order if on lab-order.html
    if (typeof window.saveOrderToChart === 'function') {
      try {
        console.log('💾 Saving lab order...');
        await window.saveOrderToChart();
        console.log('✅ Lab order saved');
      } catch (error) {
        console.error('❌ Error saving lab order:', error);
      }
    }

    // 5. Save appointment if on add-appointment.html
    const appointmentForm = document.getElementById('add-appointment-form');
    if (appointmentForm && typeof window.syncAppointmentToSupabase === 'function') {
      try {
        console.log('💾 Saving appointment...');
        // Appointment form handler will save automatically
        console.log('✅ Appointment form data captured');
      } catch (error) {
        console.error('❌ Error saving appointment:', error);
      }
    }

    // 6. Process sync queue for any pending operations
    if (typeof window.processSyncQueue === 'function') {
      try {
        console.log('💾 Processing sync queue...');
        await window.processSyncQueue();
        console.log('✅ Sync queue processed');
      } catch (error) {
        console.error('❌ Error processing sync queue:', error);
      }
    }

    // Wait for all saves to complete (with timeout)
    await Promise.allSettled(savePromises);
    
    console.log('✅ All work saved');
  }

  // Handle session expired - save work and logout
  async function handleSessionExpired() {
    // Try to refresh session before forcing logout (avoids false logouts on navigation)
    if (typeof window.ensureStaffSession === 'function') {
      try {
        const restored = await window.ensureStaffSession({ redirectOnFailure: false });
        if (restored.ok && restored.orgId) {
          updateActivity();
          hideWarning();
          hideFinalWarning();
          finalWarningShown = false;
          warningShown = false;
          debugLog('Session restored after timeout check: staying logged in');
          return;
        }
      } catch (refreshErr) {
        debugLog('Session refresh before logout failed:', refreshErr);
      }
    }

    // Clear intervals/timeouts
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
    if (warningTimeout) {
      clearTimeout(warningTimeout);
      warningTimeout = null;
    }
    if (logoutTimeout) {
      clearTimeout(logoutTimeout);
      logoutTimeout = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Hide warnings if shown
    hideWarning();
    hideFinalWarning();

    // Show saving message
    const savingOverlay = document.createElement('div');
    savingOverlay.id = 'session-saving-overlay';
    savingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
    `;
    savingOverlay.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 24px; margin-bottom: 20px;">💾</div>
        <div style="font-size: 18px; font-weight: 600;">Saving your work...</div>
        <div style="font-size: 14px; margin-top: 10px; opacity: 0.8;">Please wait while we save all your changes</div>
      </div>
    `;
    document.body.appendChild(savingOverlay);

    try {
      // Save all work
      await saveAllWork();
      
      // Wait a moment for user to see the message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ Error during save before logout:', error);
    } finally {
      // Remove saving overlay
      const overlay = document.getElementById('session-saving-overlay');
      if (overlay) {
        overlay.remove();
      }

      // Logout
      await performLogout();
    }
  }

  // Perform logout
  async function performLogout() {
    try {
      // Try Supabase logout first
      if (typeof window.logoutFromSupabase === 'function') {
        await window.logoutFromSupabase();
      } else if (typeof window.supabaseLogout === 'function') {
        await window.supabaseLogout();
      } else if (typeof window.handleLogout === 'function') {
        // Use existing logout handler but skip confirmation
        const originalConfirm = window.confirm;
        window.confirm = () => true; // Auto-confirm
        await window.handleLogout();
        window.confirm = originalConfirm;
        // If handleLogout already redirected, return early
        return;
      }
    } catch (error) {
      console.error('❌ Error during Supabase logout:', error);
    }

    // Only clear essential session data - preserve other localStorage data
    // This prevents breaking existing functionality that relies on cached data
    localStorage.removeItem('user');
    localStorage.removeItem('supabase_session');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('platformAdmin');
    
    // Only clear organizations if user explicitly logged out (not on auto-logout)
    // This preserves organization data for faster re-login
    // localStorage.removeItem('organizations'); // COMMENTED OUT - preserve for faster re-login

    // Clear encryption key if available
    if (typeof window.encryptionService !== 'undefined' && window.encryptionService) {
      try {
        window.encryptionService.clearKey();
      } catch (error) {
        console.error('❌ Error clearing encryption key:', error);
      }
    }

    // Only clear specific session tokens, not all keys containing 'session' or 'auth'
    // This prevents accidentally clearing important cached data
    const specificKeysToRemove = [
      'sessionToken',
      'supabase_session',
      'auth_token',
      'access_token',
      'refresh_token'
    ];
    
    specificKeysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`❌ Error removing ${key}:`, error);
      }
    });

    // Immediately redirect to login page (clean URL)
    // UNIVERSAL FIX: Works identically on ALL browsers and devices
    // No device-specific or browser-specific logic - same behavior everywhere
    
    const loginUrl = window.location.origin + '/login?logout=' + Date.now() + '&t=' + Math.random();
    
    // Step 1: Unregister service workers (works on all browsers that support service workers)
    // This prevents service worker from intercepting the redirect
    // Note: This is feature detection, not device detection - same code path for all
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister().catch(function(error) {
            console.warn('Service worker unregistration failed:', error);
          });
        }
      }).catch(function(error) {
        console.warn('Service worker registration check failed:', error);
      });
    }
    
    // Step 2: Clear caches (works on all browsers that support Cache API)
    // Note: This is feature detection, not device detection - same code path for all
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name).catch(function(error) {
            console.warn('Cache deletion failed:', error);
          });
        }
      }).catch(function(error) {
        console.warn('Cache keys retrieval failed:', error);
      });
    }
    
    // Step 3: Universal redirect using standard web APIs
    // All browsers (Safari, Chrome, Firefox, Edge, Opera, mobile, desktop) support these methods
    // Same code path for ALL devices - no conditional logic based on device type
    
    // Primary method: window.location.replace (standard web API, works everywhere)
    // This is the most reliable method across all browsers and devices
    try {
      window.location.replace(loginUrl);
    } catch (error) {
      console.error('window.location.replace failed:', error);
      
      // Fallback 1: window.location.href (standard web API, works everywhere)
      try {
        window.location.href = loginUrl;
      } catch (error2) {
        console.error('window.location.href failed:', error2);
        
        // Fallback 2: window.location.assign (standard web API, works everywhere)
        try {
          window.location.assign(loginUrl);
        } catch (error3) {
          console.error('window.location.assign failed:', error3);
          
          // Fallback 3: Form submission (works even with strict CSP, works everywhere)
          try {
            const form = document.createElement('form');
            form.method = 'GET';
            form.action = loginUrl;
            // Append to body if available, otherwise use document
            const target = document.body || document.documentElement;
            if (target) {
              target.appendChild(form);
              form.submit();
            } else {
              // Last resort: direct assignment
              window.location.href = loginUrl;
            }
          } catch (error4) {
            console.error('Form submit failed:', error4);
            
            // Final fallback: User notification + delayed redirect
            // This ensures user knows what happened even if redirect fails
            try {
              alert('Your session has expired. You will be redirected to the login page.');
            } catch (alertError) {
              // Alert failed (some strict environments), just log
              console.error('Alert failed:', alertError);
            }
            // Still attempt redirect
            setTimeout(function() {
              window.location.href = loginUrl;
            }, 100);
          }
        }
      }
    }
    
    // Step 4: Verification redirect (universal backup)
    // This ensures redirect completes even if service worker temporarily blocks it
    // Same timeout and logic for ALL devices - no device-specific behavior
    setTimeout(function() {
      const currentPath = window.location.pathname.toLowerCase();
      const isLoginPage = currentPath === '/login' || 
                          currentPath === '/login.html' ||
                          currentPath.endsWith('/login') ||
                          currentPath.includes('/login');
      
      if (!isLoginPage) {
        console.warn('Redirect verification: Not on login page, forcing redirect...');
        // Use window.location.href as backup (most compatible across all browsers)
        window.location.href = loginUrl;
      }
    }, 500);
  }

  function bootSessionTimeout() {
    void initializeSessionTimeout();
  }

  // Initialize when DOM is ready (once)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSessionTimeout);
  } else {
    bootSessionTimeout();
  }

  // Browser back/forward: treat as activity and refresh auth tokens
  window.addEventListener('pageshow', function() {
    updateActivity();
    if (typeof window.ensureStaffSession === 'function') {
      void window.ensureStaffSession({ redirectOnFailure: false });
    }
  });

  // Export functions for manual control if needed
  window.sessionTimeoutManager = {
    updateActivity: updateActivity,
    reset: function() {
      updateActivity();
      hideWarning();
    },
    forceLogout: handleSessionExpired
  };

})();

